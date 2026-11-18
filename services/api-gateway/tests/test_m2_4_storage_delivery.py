"""
Automated Verification & Test Suite for Milestone M2.4:
Cloud Storage Persistence (AWS S3 / Cloudflare R2), Real Boto3 SigV4 Presigned URLs,
Retry & Graceful Local Fallback, RenderWorker Upload Integration, and Signed URL Endpoints.
"""

from pathlib import Path
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
import pytest

import src.main as main_module
from src.main import JOBS_STORE, app
from src.schemas import (
    JobStatusResponse,
    PresentationScript,
    QueueTaskPayload,
    RemotionCompositionProps,
    RemotionSlideProps,
    SlideScriptItem,
    VideoGenerateRequest,
)
from src.services.queue_service import LocalMemoryQueueBackend, utc_timestamp
from src.services.render_service import RemotionRenderService
from src.services.storage_service import CloudStorageService
from src.services.worker_service import RenderWorker

client = TestClient(app)

FAKE_MP4_BYTES = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + (b"\x00" * 2048)


class TestCloudStorageProviderResolution:
    """Tests S3/R2 provider auto-detection, TTL clamping, and genuine Boto3 SigV4 signing."""

    def test_defaults_to_local_when_credentials_missing(self):
        svc = CloudStorageService(
            provider_mode="auto",
            bucket_name="",
            access_key_id="",
            secret_access_key="",
        )
        assert svc.resolve_provider() == "local"
        res = svc.create_presigned_download_url("job_local_1")
        assert res.storage_provider == "local"
        assert res.download_url == "/api/v1/jobs/job_local_1/video"

    def test_auto_detects_cloudflare_r2_and_generates_genuine_sigv4_presigned_url(self):
        svc = CloudStorageService(
            provider_mode="auto",
            bucket_name="aik-r2-bucket",
            r2_account_id="acct987654",
            access_key_id="AKIA_R2_TEST_KEY",
            secret_access_key="SECRET_R2_TEST_KEY",
            cdn_public_base_url="https://cdn.aik-studio.com/",
            default_expiry_seconds=9999999,  # Clamped to 604800s max
        )
        assert svc.resolve_provider() == "r2"
        assert svc.endpoint_url == "https://acct987654.r2.cloudflarestorage.com"
        assert svc.region_name == "auto"
        assert svc.default_expiry_seconds == 7 * 24 * 3600

        delivery = svc.create_presigned_download_url("job_r2_sign", expires_in_seconds=30)
        assert delivery.storage_provider == "r2"
        assert delivery.object_key == "videos/job_r2_sign/job_r2_sign.mp4"
        assert delivery.expires_in_seconds == 60  # Clamped minimum 60s
        assert delivery.cdn_url == "https://cdn.aik-studio.com/videos/job_r2_sign/job_r2_sign.mp4"
        assert "acct987654.r2.cloudflarestorage.com" in delivery.download_url
        assert "X-Amz-Algorithm=AWS4-HMAC-SHA256" in delivery.download_url
        assert "X-Amz-Expires=60" in delivery.download_url
        assert "response-content-type=video%2Fmp4" in delivery.download_url


class TestCloudUploadRetryAndFallback:
    """Tests S3/R2 upload retries, local file cleanup option, and graceful local degradation."""

    def test_upload_retries_transient_error_and_returns_signed_url(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setattr("time.sleep", lambda _s: None)
        mp4_path = tmp_path / "job_s3_01.mp4"
        mp4_path.write_bytes(FAKE_MP4_BYTES)

        mock_s3 = MagicMock()
        mock_s3.upload_file.side_effect = [RuntimeError("Transient S3 503"), None]
        mock_s3.generate_presigned_url.return_value = (
            "https://aik-bucket.s3.us-east-1.amazonaws.com/videos/job_s3_01/job_s3_01.mp4?X-Amz-Signature=deadbeef"
        )

        svc = CloudStorageService(
            provider_mode="s3",
            bucket_name="aik-bucket",
            region_name="us-east-1",
            access_key_id="AKIA_TEST",
            secret_access_key="SECRET_TEST",
            max_retries=2,
            s3_client=mock_s3,
        )

        delivery = svc.upload_video(mp4_path, job_id="job_s3_01", delete_local_after_upload=True)
        assert mock_s3.upload_file.call_count == 2
        _, kwargs = mock_s3.upload_file.call_args
        assert kwargs["ExtraArgs"]["ContentType"] == "video/mp4"
        assert delivery.storage_provider == "s3"
        assert delivery.object_key == "videos/job_s3_01/job_s3_01.mp4"
        assert delivery.file_size_bytes == len(FAKE_MP4_BYTES)
        assert "X-Amz-Signature=deadbeef" in delivery.download_url
        # Local file removed when delete_local_after_upload=True
        assert not mp4_path.exists()

    def test_upload_failure_gracefully_falls_back_to_local_unless_strict(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setattr("time.sleep", lambda _s: None)
        mp4_path = tmp_path / "job_fail_01.mp4"
        mp4_path.write_bytes(FAKE_MP4_BYTES)

        mock_s3 = MagicMock()
        mock_s3.upload_file.side_effect = RuntimeError("Permanent S3 outage")

        svc = CloudStorageService(
            provider_mode="s3",
            bucket_name="aik-bucket",
            access_key_id="AKIA_TEST",
            secret_access_key="SECRET_TEST",
            max_retries=2,
            s3_client=mock_s3,
        )

        # Graceful fallback preserves local MP4 serving
        fallback_res = svc.upload_video(mp4_path, job_id="job_fail_01", strict_cloud=False)
        assert fallback_res.storage_provider == "local"
        assert fallback_res.download_url == "/api/v1/jobs/job_fail_01/video"
        assert mp4_path.exists()

        # strict_cloud=True surfaces the RuntimeError
        with pytest.raises(RuntimeError, match="Failed to upload MP4"):
            svc.upload_video(mp4_path, job_id="job_fail_01", strict_cloud=True)


class TestRenderWorkerStorageIntegration:
    """Verifies RenderWorker uploads final MP4 and writes signed delivery URLs to JobStatusResponse."""

    def test_render_worker_uploads_mp4_and_updates_job_storage_metadata(self, tmp_path: Path):
        job_id = "job_rw_s3_99"
        job_dir = tmp_path / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        out_mp4 = job_dir / f"{job_id}.mp4"
        out_mp4.write_bytes(FAKE_MP4_BYTES)

        mock_renderer = MagicMock(spec=RemotionRenderService)
        mock_renderer.render_presentation.return_value = out_mp4

        mock_s3 = MagicMock()
        mock_s3.upload_file.return_value = None
        mock_s3.generate_presigned_url.return_value = (
            "https://aik-bucket.s3.us-east-1.amazonaws.com/videos/job_rw_s3_99/job_rw_s3_99.mp4?X-Amz-Signature=sig99"
        )
        storage = CloudStorageService(
            provider_mode="s3",
            bucket_name="aik-bucket",
            access_key_id="AKIA_RW",
            secret_access_key="SECRET_RW",
            s3_client=mock_s3,
        )

        backend = LocalMemoryQueueBackend()
        worker = RenderWorker(render_service=mock_renderer, storage_service=storage)

        props = RemotionCompositionProps(
            project_title="Storage Integration Test",
            total_duration_seconds=4.5,
            total_frames=135,
            slides=[
                RemotionSlideProps(
                    slide_index=1,
                    layout="title_intro",
                    heading="Storage Test",
                    bullet_points=["S3 upload"],
                    voiceover_script="Testing cloud storage worker handoff.",
                    voiceover_audio_url="/audio_temp/job_rw_s3_99/slide_1.mp3",
                    voiceover_audio_path="/tmp/slide_1.mp3",
                    voiceover_duration_seconds=3.8,
                    calculated_frames=135,
                )
            ],
        )
        job = JobStatusResponse(
            job_id=job_id,
            status="audio_ready",
            progress_percentage=80,
            render_requested=True,
            remotion_props=props,
        )
        backend.save_job(job)

        task = QueueTaskPayload(
            job_id=job_id,
            stage="render",
            request=VideoGenerateRequest(prompt="Cloud storage integration demo", render_video=True),
            created_at=utc_timestamp(),
        )
        worker.execute(task=task, job=job, job_dir=job_dir, queue_backend=backend)

        saved = backend.get_job(job_id)
        assert saved is not None
        assert saved.status == "completed"
        assert saved.progress_percentage == 100
        assert saved.storage_provider == "s3"
        assert saved.storage_object_key == f"videos/{job_id}/{job_id}.mp4"
        assert "X-Amz-Signature=sig99" in (saved.video_download_url or "")
        assert [e.step for e in saved.progress_events] == [
            "rendering_video",
            "uploading_video",
            "completed",
        ]


class TestM24StorageAndSignedUrlEndpoints:
    """Verifies FastAPI signed URL endpoint, health storage reporting, and S3/R2 307 redirect fallback."""

    def test_health_and_signed_url_endpoints(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ):
        health_resp = client.get("/api/v1/health")
        assert health_resp.status_code == 200
        assert "storage_provider" in health_resp.json()

        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = (
            "https://aik-r2.example.r2.cloudflarestorage.com/videos/job_ep_cloud/job_ep_cloud.mp4?X-Amz-Signature=r2sig"
        )
        cloud_storage = CloudStorageService(
            provider_mode="r2",
            bucket_name="aik-r2",
            r2_account_id="acct123",
            access_key_id="R2_KEY",
            secret_access_key="R2_SEC",
            s3_client=mock_s3,
        )
        monkeypatch.setattr(main_module, "storage_service", cloud_storage)

        job_id = "job_ep_cloud"
        # Simulate local MP4 evicted after R2 upload so /video falls back seamlessly to 307 redirect
        JOBS_STORE[job_id] = JobStatusResponse(
            job_id=job_id,
            status="completed",
            progress_percentage=100,
            render_requested=True,
            output_video_path=str(tmp_path / "already_cleaned_up.mp4"),
            storage_provider="r2",
            storage_object_key=f"videos/{job_id}/{job_id}.mp4",
        )
        try:
            url_resp = client.get(f"/api/v1/jobs/{job_id}/video/url?expires_in=1800")
            assert url_resp.status_code == 200
            body = url_resp.json()
            assert body["storage_provider"] == "r2"
            assert body["expires_in_seconds"] == 1800
            assert "X-Amz-Signature=r2sig" in body["download_url"]

            # Follow_redirects=False verifies 307 redirect when local file is absent but R2 key exists
            redirect_resp = client.get(f"/api/v1/jobs/{job_id}/video", follow_redirects=False)
            assert redirect_resp.status_code == 307
            assert "X-Amz-Signature=r2sig" in redirect_resp.headers["location"]

            missing_resp = client.get("/api/v1/jobs/nonexistent_cloud_job/video/url")
            assert missing_resp.status_code == 404
        finally:
            JOBS_STORE.pop(job_id, None)
