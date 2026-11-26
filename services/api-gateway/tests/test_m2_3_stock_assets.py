"""
Automated Verification & Test Suite for Milestone M2.3:
Stock Asset Integration (Unsplash / Pexels), Magic-Header Image Validation,
Disk Caching, Remotion Asset Staging/Cleanup, and FastAPI Stock Visual Endpoints.
"""

from pathlib import Path
import shutil
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
import httpx
import pytest

import src.main as main_module
from src.main import JOBS_STORE, TEMP_JOBS_DIR, app
from src.schemas import (
    AssetSearchResponse,
    PresentationScript,
    RemotionCompositionProps,
    RemotionSlideProps,
    SlideScriptItem,
    StockImageCandidate,
)
from src.services.asset_service import StockAssetService, validate_image_bytes
from src.services.render_service import RemotionRenderService

client = TestClient(app)

FAKE_JPEG_BYTES = b"\xff\xd8\xff\xe0" + (b"\x00" * 1500)
FAKE_PNG_BYTES = b"\x89PNG\r\n\x1a\n" + (b"\x01" * 1500)
FAKE_WEBP_BYTES = b"RIFF\x24\x08\x00\x00WEBP" + (b"\x02" * 1500)


def _sample_script() -> PresentationScript:
    return PresentationScript(
        title="M2.3 Stock Visuals Demo",
        language="en",
        theme="modern_tech",
        slides=[
            SlideScriptItem(
                slide_index=1,
                layout="title_intro",
                heading="Cloud Infrastructure",
                bullet_points=["Resilient queues", "Stock backgrounds"],
                voiceover_script="Welcome to cloud infrastructure with stock visuals.",
                visual_keywords="cloud computing server room",
            ),
            SlideScriptItem(
                slide_index=2,
                layout="bullet_list",
                heading="Async Rendering",
                bullet_points=["Decoupled workers", "Ken Burns backdrop"],
                voiceover_script="Background visuals are staged automatically before rendering.",
                visual_keywords="abstract technology network",
            ),
            SlideScriptItem(
                slide_index=3,
                layout="conclusion_cta",
                heading="Deploy Today",
                bullet_points=["Automated pipeline"],
                voiceover_script="Deploy your video generation pipeline today.",
                visual_keywords="minimal developer workspace",
            ),
        ],
    )


class TestValidateImageBytes:
    """Validates binary image magic-header checks and minimum byte guards."""

    def test_accepts_valid_jpeg_png_webp(self):
        assert validate_image_bytes(FAKE_JPEG_BYTES) == ".jpg"
        assert validate_image_bytes(FAKE_PNG_BYTES) == ".png"
        assert validate_image_bytes(FAKE_WEBP_BYTES) == ".webp"

    def test_rejects_undersized_or_corrupt_payloads(self):
        with pytest.raises(ValueError, match="too small"):
            validate_image_bytes(b"\xff\xd8\xff" + (b"\x00" * 100))

        with pytest.raises(ValueError, match="magic headers"):
            validate_image_bytes(b"<html><body>404 Not Found</body></html>" * 50)


class TestStockAssetServiceSearchAndCache:
    """Tests Unsplash/Pexels parsing, cascade fallback, disk caching, and props enrichment."""

    def test_graceful_gradient_fallback_when_no_keys_configured(self, tmp_path: Path):
        service = StockAssetService(
            output_base_dir=tmp_path / "jobs",
            cache_dir=tmp_path / "cache",
            unsplash_access_key="your_unsplash_key_here",
            pexels_api_key="",
            provider_mode="auto",
        )
        res = service.search_stock_images("cloud servers", aspect_ratio="16:9", limit=4)
        assert res.fallback_to_gradient is True
        assert res.provider_used is None
        assert res.results == []

        rel_url, local_path, provider = service.resolve_slide_asset(
            slide_index=1,
            visual_keywords="cloud servers",
            job_id="job_nokey",
        )
        assert (rel_url, local_path, provider) == (None, None, None)

    def test_unsplash_search_and_cascade_to_pexels_on_failure(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ):
        service = StockAssetService(
            output_base_dir=tmp_path / "jobs",
            cache_dir=tmp_path / "cache",
            unsplash_access_key="test_unsplash_token",
            pexels_api_key="test_pexels_token",
            provider_mode="auto",
            max_retries=1,
        )

        # Case 1: Unsplash responds with 200 and orientation matches aspect_ratio=9:16
        captured_calls = []

        class _MockClient:
            def __init__(self, *args, **kwargs):
                pass

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def get(self, url: str, headers=None, params=None, **kwargs):
                captured_calls.append((url, headers, params))
                resp = MagicMock()
                if "unsplash.com" in url:
                    resp.raise_for_status.return_value = None
                    resp.json.return_value = {
                        "results": [
                            {
                                "id": "u_101",
                                "width": 1080,
                                "height": 1920,
                                "urls": {
                                    "regular": "https://images.unsplash.com/photo-101?w=1080",
                                    "small": "https://images.unsplash.com/photo-101?w=400",
                                },
                                "user": {"name": "Elena Rostova"},
                                "links": {"html": "https://unsplash.com/photos/u_101"},
                            }
                        ]
                    }
                    return resp
                raise AssertionError(f"Unexpected URL: {url}")

        monkeypatch.setattr(httpx, "Client", _MockClient)
        ok_res = service.search_stock_images("minimal desk", aspect_ratio="9:16", limit=3)
        assert ok_res.fallback_to_gradient is False
        assert ok_res.provider_used == "unsplash"
        assert len(ok_res.results) == 1
        assert ok_res.results[0].image_id == "u_101"
        assert ok_res.results[0].photographer == "Elena Rostova"
        assert captured_calls[0][2]["orientation"] == "portrait"

        # Case 2: Unsplash raises HTTP 500 -> automatic cascade to Pexels
        class _CascadeClient(_MockClient):
            def get(self, url: str, headers=None, params=None, **kwargs):
                resp = MagicMock()
                if "unsplash.com" in url:
                    resp.raise_for_status.side_effect = httpx.HTTPStatusError(
                        "500 Server Error",
                        request=MagicMock(),
                        response=MagicMock(status_code=500),
                    )
                    return resp
                resp.raise_for_status.return_value = None
                resp.json.return_value = {
                    "photos": [
                        {
                            "id": 9988,
                            "width": 1920,
                            "height": 1080,
                            "photographer": "Tran Minh",
                            "url": "https://www.pexels.com/photo/9988",
                            "src": {
                                "large2x": "https://images.pexels.com/photos/9988/large2x.jpeg",
                                "medium": "https://images.pexels.com/photos/9988/med.jpeg",
                            },
                        }
                    ]
                }
                return resp

        monkeypatch.setattr(httpx, "Client", _CascadeClient)
        cascade_res = service.search_stock_images("minimal desk", aspect_ratio="16:9", limit=4)
        assert cascade_res.fallback_to_gradient is False
        assert cascade_res.provider_used == "pexels"
        assert cascade_res.results[0].image_id == "9988"
        assert cascade_res.results[0].photographer == "Tran Minh"

    def test_download_disk_cache_and_enrich_remotion_props(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ):
        service = StockAssetService(
            output_base_dir=tmp_path / "jobs",
            cache_dir=tmp_path / "cache",
            provider_mode="disabled",
            max_retries=1,
        )

        download_count = 0

        class _DownloadClient:
            def __init__(self, *args, **kwargs):
                pass

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def get(self, url: str, **kwargs):
                nonlocal download_count
                download_count += 1
                resp = MagicMock()
                resp.raise_for_status.return_value = None
                resp.content = FAKE_PNG_BYTES
                return resp

        monkeypatch.setattr(httpx, "Client", _DownloadClient)

        script = _sample_script()
        base_props = RemotionCompositionProps(
            project_title=script.title,
            width=1920,
            height=1080,
            total_duration_seconds=9.4,
            total_frames=282,
            slides=[
                RemotionSlideProps(
                    slide_index=1,
                    layout="title_intro",
                    heading="Cloud Infrastructure",
                    bullet_points=["Resilient queues"],
                    voiceover_script="Welcome to cloud infrastructure with stock visuals.",
                    voiceover_audio_path="/tmp/slide_1.mp3",
                    voiceover_audio_url="/audio_temp/job_c1/slide_1.mp3",
                    voiceover_duration_seconds=4.0,
                    calculated_frames=141,
                ),
                RemotionSlideProps(
                    slide_index=2,
                    layout="bullet_list",
                    heading="Async Rendering",
                    bullet_points=["Decoupled workers"],
                    voiceover_script="Background visuals are staged automatically before rendering.",
                    voiceover_audio_path="/tmp/slide_2.mp3",
                    voiceover_audio_url="/audio_temp/job_c1/slide_2.mp3",
                    voiceover_duration_seconds=4.0,
                    calculated_frames=141,
                ),
            ],
        )

        # First enrichment downloads once via explicit URL; Slide 2 gracefully falls back to None
        enriched = service.enrich_remotion_props(
            props=base_props,
            script=script,
            job_id="job_c1",
            slide_backgrounds={1: "https://cdn.example.com/cloud.png"},
        )
        assert download_count == 1
        assert enriched.slides[0].background_image_url is not None
        assert enriched.slides[0].background_image_url.startswith("/assets/job_c1/slide_1_")
        assert enriched.slides[0].background_image_url.endswith(".png")
        assert enriched.slides[0].background_asset_provider == "custom-url"
        assert Path(enriched.slides[0].background_image_path).exists()
        assert enriched.slides[1].background_image_url is None

        # Second call with identical URL hits disk cache (no extra HTTP download)
        rel_again, _, _ = service.resolve_slide_asset(
            slide_index=1,
            visual_keywords="cloud computing",
            job_id="job_c2",
            explicit_image_url="https://cdn.example.com/cloud.png",
        )
        assert download_count == 1
        assert rel_again.startswith("/assets/job_c2/slide_1_")


class TestRemotionAssetStagingAndCleanup:
    """Verifies staging of both audio MP3s and stock background images into Remotion public/."""

    def test_stages_and_cleans_up_audio_and_background_images(self, tmp_path: Path):
        renderer_dir = tmp_path / "video-renderer"
        render_service = RemotionRenderService(video_renderer_dir=renderer_dir)

        src_dir = tmp_path / "job_sources"
        src_dir.mkdir(parents=True, exist_ok=True)
        mp3_file = src_dir / "slide_1_aa11.mp3"
        mp3_file.write_bytes(b"ID3" + (b"\x00" * 512))
        bg_file = src_dir / "slide_1_bb22.jpg"
        bg_file.write_bytes(FAKE_JPEG_BYTES)

        props = RemotionCompositionProps(
            project_title="Staging Test",
            total_duration_seconds=4.7,
            total_frames=141,
            slides=[
                RemotionSlideProps(
                    slide_index=1,
                    layout="title_intro",
                    heading="Stage Check",
                    bullet_points=["Item"],
                    voiceover_script="Stage check slide narration.",
                    voiceover_audio_path=str(mp3_file),
                    voiceover_audio_url="/audio_temp/job_stage_9/slide_1_aa11.mp3",
                    voiceover_duration_seconds=4.0,
                    calculated_frames=141,
                    background_image_url="/assets/job_stage_9/slide_1_bb22.jpg",
                    background_image_path=str(bg_file),
                    background_asset_provider="unsplash",
                )
            ],
        )

        render_service.stage_audio_assets(props, "job_stage_9")
        assert (renderer_dir / "public" / "audio_temp" / "job_stage_9" / "slide_1_aa11.mp3").exists()
        assert (renderer_dir / "public" / "assets" / "job_stage_9" / "slide_1_bb22.jpg").exists()

        render_service.cleanup_staged_assets("job_stage_9")
        assert not (renderer_dir / "public" / "audio_temp" / "job_stage_9").exists()
        assert not (renderer_dir / "public" / "assets" / "job_stage_9").exists()


class TestM23StockAssetEndpoints:
    """Tests FastAPI endpoints for stock search, job asset streaming, and edited compilation."""

    def test_search_endpoint_returns_mocked_candidates(self, monkeypatch: pytest.MonkeyPatch):
        mock_response = AssetSearchResponse(
            query="minimal workspace",
            provider_used="unsplash",
            fallback_to_gradient=False,
            results=[
                StockImageCandidate(
                    provider="unsplash",
                    image_id="img_77",
                    url="https://images.unsplash.com/photo-77?w=1920",
                    preview_url="https://images.unsplash.com/photo-77?w=400",
                    width=1920,
                    height=1080,
                    photographer="Minh Studio",
                )
            ],
        )
        monkeypatch.setattr(
            main_module.asset_service,
            "search_stock_images",
            lambda query, aspect_ratio="16:9", limit=4: mock_response,
        )

        resp = client.post(
            "/api/v1/assets/search",
            json={"query": "minimal workspace", "aspect_ratio": "16:9", "limit": 4},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["provider_used"] == "unsplash"
        assert data["fallback_to_gradient"] is False
        assert data["results"][0]["image_id"] == "img_77"

    def test_job_asset_endpoint_serves_image_and_blocks_traversal(self):
        job_id = "job_asset_sec_01"
        assets_dir = TEMP_JOBS_DIR / job_id / "assets"
        assets_dir.mkdir(parents=True, exist_ok=True)
        (assets_dir / "slide_1_cafe.jpg").write_bytes(FAKE_JPEG_BYTES)

        try:
            ok_resp = client.get(f"/api/v1/jobs/{job_id}/assets/slide_1_cafe.jpg")
            assert ok_resp.status_code == 200
            assert ok_resp.headers["content-type"].startswith("image/jpeg")
            assert ok_resp.content[:3] == b"\xff\xd8\xff"

            bad_traversal = client.get(f"/api/v1/jobs/{job_id}/assets/..%2F..%2Fscript.json")
            assert bad_traversal.status_code in (400, 404)

            bad_ext = client.get(f"/api/v1/jobs/{job_id}/assets/notes.txt")
            assert bad_ext.status_code == 400
        finally:
            shutil.rmtree(TEMP_JOBS_DIR / job_id, ignore_errors=True)

    def test_compile_endpoint_enriches_and_serves_slide_background(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setattr(
            main_module.asset_service,
            "_download_and_cache",
            lambda image_url: (FAKE_PNG_BYTES, ".png"),
        )

        resp = client.post(
            "/api/v1/jobs/compile",
            json={
                "script": _sample_script().model_dump(),
                "aspect_ratio": "16:9",
                "voice_settings": {
                    "provider": "edge_tts",
                    "voice_id": "en-US-GuyNeural",
                    "speed": 1.0,
                },
                "render_video": False,
                "include_stock_visuals": True,
                "slide_backgrounds": {
                    "1": "https://cdn.example.com/selected-stock-hero.png"
                },
            },
        )
        assert resp.status_code == 202
        job_id = resp.json()["job_id"]

        try:
            status_resp = client.get(f"/api/v1/jobs/{job_id}")
            assert status_resp.status_code == 200
            job_data = status_resp.json()
            assert job_data["status"] == "audio_ready"
            slide_1 = job_data["remotion_props"]["slides"][0]
            assert slide_1["background_asset_provider"] == "custom-url"
            assert slide_1["background_image_url"].startswith(f"/assets/{job_id}/slide_1_")

            filename = slide_1["background_image_url"].split("/")[-1]
            img_resp = client.get(f"/api/v1/jobs/{job_id}/assets/{filename}")
            assert img_resp.status_code == 200
            assert img_resp.headers["content-type"].startswith("image/png")
        finally:
            shutil.rmtree(TEMP_JOBS_DIR / job_id, ignore_errors=True)
            JOBS_STORE.pop(job_id, None)

    def test_openverse_zero_key_public_photo_search(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        service = StockAssetService(
            output_base_dir=tmp_path / "jobs",
            cache_dir=tmp_path / "cache",
            unsplash_access_key="",
            pexels_api_key="",
            provider_mode="openverse",
            max_retries=1,
        )

        class _MockOpenverseClient:
            def __init__(self, *args, **kwargs):
                pass

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def get(self, url: str, params=None, headers=None, **kwargs):
                resp = MagicMock()
                resp.raise_for_status.return_value = None
                resp.json.return_value = {
                    "results": [
                        {
                            "id": "ov_101",
                            "url": "https://images.rawpixel.com/coding-setup-101.jpg",
                            "thumbnail": "https://api.openverse.org/v1/images/ov_101/thumb/",
                            "width": 1920,
                            "height": 1080,
                            "creator": "Openverse Dev",
                            "foreign_landing_url": "https://openverse.org/image/ov_101",
                        }
                    ]
                }
                return resp

        monkeypatch.setattr("src.services.asset_service.httpx.Client", _MockOpenverseClient)
        res = service.search_stock_images("software developer neon desk", aspect_ratio="16:9", limit=4)
        assert res.fallback_to_gradient is False
        assert res.provider_used == "openverse"
        assert res.results[0].url == "https://images.rawpixel.com/coding-setup-101.jpg"
