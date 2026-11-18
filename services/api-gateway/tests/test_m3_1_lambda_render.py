"""
Automated Verification & Test Suite for Milestone M3.1:
Remotion Lambda Serverless Render Farm Orchestration, 50-Chunk Frame Planning,
S3 Asset URL Preparation, Graceful Local Fallback, and Health/Config Telemetry.
"""

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
import pytest

import src.main as main_module
from src.main import app
from src.schemas import (
    JobStatusResponse,
    QueueTaskPayload,
    RemotionCompositionProps,
    RemotionSlideProps,
    VideoGenerateRequest,
)
from src.services.lambda_render_service import RemotionLambdaRenderService
from src.services.queue_service import LocalMemoryQueueBackend, utc_timestamp
from src.services.render_service import RemotionRenderService
from src.services.storage_service import CloudStorageService
from src.services.worker_service import RenderWorker

client = TestClient(app)


def _sample_props(tmp_path: Path, job_id: str) -> RemotionCompositionProps:
    audio_file = tmp_path / "slide_1_aa11.mp3"
    audio_file.write_bytes(b"ID3" + (b"\x00" * 1024))
    bg_file = tmp_path / "slide_1_bg22.jpg"
    bg_file.write_bytes(b"\xff\xd8\xff\xe0" + (b"\x00" * 1500))

    return RemotionCompositionProps(
        project_title="Lambda Scale Presentation",
        total_duration_seconds=120.0,
        total_frames=3600,
        slides=[
            RemotionSlideProps(
                slide_index=1,
                layout="title_intro",
                heading="Serverless Chunk Farm",
                bullet_points=["50 parallel Lambda workers"],
                voiceover_script="Scaling presentation rendering across 50 Lambda workers.",
                voiceover_audio_url=f"/audio_temp/{job_id}/slide_1_aa11.mp3",
                voiceover_audio_path=str(audio_file),
                voiceover_duration_seconds=5.0,
                calculated_frames=171,
                background_image_url=f"/assets/{job_id}/slide_1_bg22.jpg",
                background_image_path=str(bg_file),
            )
        ],
    )


class TestLambdaChunkPlanningAndAssetPrep:
    """Verifies chunk math, configuration detection, and S3 HTTPS asset rewriting."""

    def test_splits_two_minute_video_into_50_parallel_chunks(self):
        frames_per_lambda, chunks = RemotionLambdaRenderService.compute_chunk_plan(3600, target_chunks=50)
        assert frames_per_lambda == 72
        assert chunks == 50

    def test_unconfigured_lambda_resolves_to_local_engine(self):
        svc = RemotionLambdaRenderService(
            render_mode="auto",
            function_name="",
            serve_url="",
            access_key_id="",
            secret_access_key="",
        )
        assert svc.is_configured() is False
        assert svc.resolve_active_engine() == "local"

    def test_prepares_s3_presigned_urls_for_lambda_media_assets(self, tmp_path: Path):
        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.side_effect = lambda _op, Params, ExpiresIn: (
            f"https://aik-bucket.s3.amazonaws.com/{Params['Key']}?X-Amz-Signature=ok"
        )
        storage = CloudStorageService(
            provider_mode="s3",
            bucket_name="aik-bucket",
            access_key_id="AKIA_TEST",
            secret_access_key="SECRET_TEST",
            s3_client=mock_s3,
        )
        lambda_svc = RemotionLambdaRenderService(
            storage_service=storage,
            render_mode="lambda",
            function_name="remotion-fn",
            serve_url="https://s3.amazonaws.com/site/index.html",
            access_key_id="AKIA_TEST",
            secret_access_key="SECRET_TEST",
        )

        props = _sample_props(tmp_path, "job_l_prep")
        prepared = lambda_svc.prepare_lambda_props(props, "job_l_prep")
        assert mock_s3.upload_file.call_count == 2
        assert prepared.slides[0].voiceover_audio_url.startswith("https://aik-bucket.s3.amazonaws.com/")
        assert (prepared.slides[0].background_image_url or "").startswith("https://aik-bucket.s3.amazonaws.com/")


class TestLambdaRenderWorkerAndFallback:
    """Verifies Lambda CLI execution in RenderWorker and graceful local fallback."""

    def test_render_worker_dispatches_to_lambda_and_persists_chunk_telemetry(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ):
        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.side_effect = lambda _op, Params, ExpiresIn: (
            f"https://aik-bucket.s3.amazonaws.com/{Params['Key']}?X-Amz-Signature=sig50"
        )
        storage = CloudStorageService(
            provider_mode="s3",
            bucket_name="aik-bucket",
            access_key_id="AKIA_TEST",
            secret_access_key="SECRET_TEST",
            s3_client=mock_s3,
        )
        lambda_svc = RemotionLambdaRenderService(
            storage_service=storage,
            render_mode="lambda",
            function_name="remotion-render-fn",
            serve_url="https://s3.amazonaws.com/sites/aik/index.html",
            bucket_name="aik-bucket",
            access_key_id="AKIA_TEST",
            secret_access_key="SECRET_TEST",
            target_chunks=50,
        )

        monkeypatch.setattr(
            "src.services.lambda_render_service.subprocess.run",
            lambda *args, **kwargs: SimpleNamespace(
                returncode=0,
                stdout=(
                    'PROGRESS_JSON:{"renderId":"rnd_50chunks","overallProgress":0.5,"chunks":50,"done":false}\n'
                    'RESULT_JSON:{"renderId":"rnd_50chunks","bucketName":"aik-bucket","outputFile":"https://aik-bucket.s3.amazonaws.com/videos/job_l_run/job_l_run.mp4","outKey":"videos/job_l_run/job_l_run.mp4","chunks":50,"framesPerLambda":72,"elapsedSeconds":16.4}\n'
                ),
                stderr="",
            ),
        )

        mock_local_renderer = MagicMock(spec=RemotionRenderService)
        mock_local_renderer.video_renderer_dir = lambda_svc.video_renderer_dir
        worker = RenderWorker(
            render_service=mock_local_renderer,
            storage_service=storage,
            lambda_service=lambda_svc,
        )

        job_id = "job_l_run"
        job_dir = tmp_path / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        backend = LocalMemoryQueueBackend()
        job = JobStatusResponse(
            job_id=job_id,
            status="audio_ready",
            progress_percentage=80,
            render_requested=True,
            remotion_props=_sample_props(tmp_path, job_id),
        )
        backend.save_job(job)

        worker.execute(
            task=QueueTaskPayload(
                job_id=job_id,
                stage="render",
                request=VideoGenerateRequest(prompt="Lambda render test", render_video=True),
                created_at=utc_timestamp(),
            ),
            job=job,
            job_dir=job_dir,
            queue_backend=backend,
        )

        saved = backend.get_job(job_id)
        assert saved is not None
        assert saved.status == "completed"
        assert saved.render_engine_used == "lambda"
        assert saved.lambda_render_id == "rnd_50chunks"
        assert saved.lambda_chunks_count == 50
        assert "X-Amz-Signature=sig50" in (saved.video_download_url or "")
        mock_local_renderer.render_presentation.assert_not_called()

    def test_lambda_error_falls_back_gracefully_to_local_remotion(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ):
        storage = CloudStorageService(provider_mode="local")
        lambda_svc = RemotionLambdaRenderService(
            storage_service=storage,
            render_mode="lambda",
            function_name="remotion-render-fn",
            serve_url="https://s3.amazonaws.com/sites/aik/index.html",
            access_key_id="AKIA_TEST",
            secret_access_key="SECRET_TEST",
            fallback_to_local=True,
        )

        monkeypatch.setattr(
            "src.services.lambda_render_service.subprocess.run",
            lambda *args, **kwargs: SimpleNamespace(
                returncode=1,
                stdout="",
                stderr="AWS Lambda quota exceeded",
            ),
        )

        job_id = "job_l_fallback"
        job_dir = tmp_path / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        local_mp4 = job_dir / f"{job_id}.mp4"
        local_mp4.write_bytes(b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + (b"\x00" * 1024))

        mock_local_renderer = MagicMock(spec=RemotionRenderService)
        mock_local_renderer.video_renderer_dir = lambda_svc.video_renderer_dir
        mock_local_renderer.render_presentation.return_value = local_mp4

        worker = RenderWorker(
            render_service=mock_local_renderer,
            storage_service=storage,
            lambda_service=lambda_svc,
        )
        backend = LocalMemoryQueueBackend()
        job = JobStatusResponse(
            job_id=job_id,
            status="audio_ready",
            progress_percentage=80,
            render_requested=True,
            remotion_props=_sample_props(tmp_path, job_id),
        )
        backend.save_job(job)

        worker.execute(
            task=QueueTaskPayload(
                job_id=job_id,
                stage="render",
                request=VideoGenerateRequest(prompt="Lambda fallback test", render_video=True),
                created_at=utc_timestamp(),
            ),
            job=job,
            job_dir=job_dir,
            queue_backend=backend,
        )

        saved = backend.get_job(job_id)
        assert saved is not None
        assert saved.status == "completed"
        assert saved.render_engine_used == "local"
        mock_local_renderer.render_presentation.assert_called_once()


class TestM31LambdaEndpoints:
    """Verifies FastAPI telemetry endpoints exposing active render engine & Lambda farm config."""

    def test_health_and_lambda_config_endpoint(self, monkeypatch: pytest.MonkeyPatch):
        mock_lambda = RemotionLambdaRenderService(
            render_mode="auto",
            region="us-east-1",
            function_name="remotion-fn-test",
            serve_url="https://s3.amazonaws.com/site/index.html",
            access_key_id="AKIA",
            secret_access_key="SECRET",
            target_chunks=50,
        )
        monkeypatch.setattr(main_module, "lambda_service", mock_lambda)

        health = client.get("/api/v1/health")
        assert health.status_code == 200
        assert health.json()["render_engine"] == "lambda"

        cfg = client.get("/api/v1/render/lambda/config")
        assert cfg.status_code == 200
        body = cfg.json()
        assert body["active_render_engine"] == "lambda"
        assert body["lambda_configured"] is True
        assert body["target_chunks"] == 50
        assert body["function_name"] == "remotion-fn-test"
