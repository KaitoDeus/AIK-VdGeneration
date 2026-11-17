"""
Automated Verification & Test Suite for M2.2 Web Studio Backend Support Endpoints:
Voice Catalog, Voice Audition Preview MP3, Edited Script Compilation, and Media Streaming.
"""

from pathlib import Path
import shutil

from fastapi.testclient import TestClient

from src.main import JOBS_STORE, TEMP_JOBS_DIR, app
from src.schemas import JobStatusResponse, PresentationScript, SlideScriptItem
from src.services.tts_service import write_synthetic_mp3_fallback

client = TestClient(app)


def _sample_edited_script() -> PresentationScript:
    return PresentationScript(
        title="Edited Studio Presentation",
        language="en",
        theme="modern_tech",
        slides=[
            SlideScriptItem(
                slide_index=1,
                layout="title_intro",
                heading="Edited Slide One",
                bullet_points=["Custom bullet A", "Custom bullet B"],
                voiceover_script="This is the edited voiceover narration for slide one.",
                visual_keywords="minimal studio workspace",
            ),
            SlideScriptItem(
                slide_index=2,
                layout="bullet_list",
                heading="Edited Slide Two",
                bullet_points=["Custom bullet C"],
                voiceover_script="Second slide voiceover narration after user review.",
                visual_keywords="architecture diagram",
            ),
            SlideScriptItem(
                slide_index=3,
                layout="conclusion_cta",
                heading="Edited Conclusion",
                bullet_points=["Compile immediately"],
                voiceover_script="Final call to action slide narration.",
                visual_keywords="presentation launch",
            ),
        ],
    )


class TestWebStudioSupportEndpoints:
    """Verifies backend endpoints consumed by the Next.js Web Studio (apps/web)."""

    def test_list_voices_returns_bilingual_presets(self):
        all_resp = client.get("/api/v1/voices")
        assert all_resp.status_code == 200
        voices = all_resp.json()
        voice_ids = [v["voice_id"] for v in voices]
        assert "vi-VN-HoaiMyNeural" in voice_ids
        assert "en-US-GuyNeural" in voice_ids

        vi_resp = client.get("/api/v1/voices?language=vi")
        assert vi_resp.status_code == 200
        assert any(v["voice_id"] == "vi-VN-HoaiMyNeural" for v in vi_resp.json())

    def test_voice_preview_synthesizes_playable_mp3(self):
        try:
            resp = client.post(
                "/api/v1/voices/preview",
                json={
                    "provider": "edge_tts",
                    "voice_id": "en-US-GuyNeural",
                    "language": "en",
                    "sample_text": "Audio preview sample from AIK Studio.",
                },
            )
            assert resp.status_code == 200
            assert resp.headers["content-type"].startswith("audio/mpeg")
            assert len(resp.content) > 10 * 1024
        finally:
            shutil.rmtree(TEMP_JOBS_DIR / "voice_previews", ignore_errors=True)

    def test_compile_edited_script_bypasses_llm_and_synthesizes_audio(self):
        edited_script = _sample_edited_script()
        resp = client.post(
            "/api/v1/jobs/compile",
            json={
                "script": edited_script.model_dump(),
                "aspect_ratio": "16:9",
                "voice_settings": {
                    "provider": "edge_tts",
                    "voice_id": "en-US-GuyNeural",
                    "speed": 1.0,
                },
                "render_video": False,
            },
        )
        assert resp.status_code == 202
        job_id = resp.json()["job_id"]

        try:
            status_resp = client.get(f"/api/v1/jobs/{job_id}")
            assert status_resp.status_code == 200
            body = status_resp.json()
            assert body["status"] == "audio_ready"
            assert body["model_used"] == "studio-editor"
            assert body["remotion_props"] is not None
            first_audio_url = body["remotion_props"]["slides"][0]["voiceover_audio_url"]
            filename = first_audio_url.split("/")[-1]

            # Verify slide audio streaming endpoint serves the synthesized MP3
            audio_resp = client.get(f"/api/v1/jobs/{job_id}/audio/{filename}")
            assert audio_resp.status_code == 200
            assert audio_resp.headers["content-type"].startswith("audio/mpeg")
            assert len(audio_resp.content) > 10 * 1024
        finally:
            shutil.rmtree(TEMP_JOBS_DIR / job_id, ignore_errors=True)
            JOBS_STORE.pop(job_id, None)

    def test_download_video_endpoint_serves_mp4_and_rejects_missing(self, tmp_path: Path):
        job_id = "job_video_stream_test"
        mp4_path = tmp_path / f"{job_id}.mp4"
        mp4_path.write_bytes(b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + (b"\x00" * 1024))

        JOBS_STORE[job_id] = JobStatusResponse(
            job_id=job_id,
            status="completed",
            progress_percentage=100,
            render_requested=True,
            output_video_path=str(mp4_path),
        )
        try:
            resp = client.get(f"/api/v1/jobs/{job_id}/video")
            assert resp.status_code == 200
            assert resp.headers["content-type"].startswith("video/mp4")
            assert resp.content[4:8] == b"ftyp"

            missing_resp = client.get("/api/v1/jobs/nonexistent_job/video")
            assert missing_resp.status_code == 404
        finally:
            JOBS_STORE.pop(job_id, None)

    def test_slide_audio_path_traversal_is_blocked(self):
        audio_dir = TEMP_JOBS_DIR / "job_sec_check" / "audio"
        audio_dir.mkdir(parents=True, exist_ok=True)
        write_synthetic_mp3_fallback(audio_dir / "slide_1_safe1234.mp3")
        try:
            bad = client.get("/api/v1/jobs/job_sec_check/audio/..%2F..%2Fscript.json")
            assert bad.status_code in (400, 404)
        finally:
            shutil.rmtree(TEMP_JOBS_DIR / "job_sec_check", ignore_errors=True)
