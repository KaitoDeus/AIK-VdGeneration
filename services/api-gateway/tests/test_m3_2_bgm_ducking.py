"""
Automated Verification & Test Suite for Milestone M3.2:
Royalty-Free Mood BGM Library, Stereo WAV Loop Synthesis, Remotion Staging/Cleanup,
TTSWorker BGM Props Enrichment, and FastAPI BGM Catalog/Preview Endpoints.
"""

from pathlib import Path
import shutil
import wave

from fastapi.testclient import TestClient

from src.main import JOBS_STORE, TEMP_JOBS_DIR, app
from src.schemas import BGMSettings, PresentationScript, RemotionBGMProps, RemotionCompositionProps, RemotionSlideProps, SlideScriptItem
from src.services.bgm_service import BGM_CATALOG, BGMService
from src.services.render_service import RemotionRenderService

client = TestClient(app)


def _sample_script() -> PresentationScript:
    return PresentationScript(
        title="BGM Ducking Demo",
        language="en",
        theme="modern_tech",
        slides=[
            SlideScriptItem(
                slide_index=1,
                layout="title_intro",
                heading="Sound Design Introduction",
                bullet_points=["Inspiring BGM"],
                voiceover_script="Welcome to our sound design and BGM ducking showcase.",
                visual_keywords="music studio synth",
            ),
            SlideScriptItem(
                slide_index=2,
                layout="bullet_list",
                heading="Automatic Speech Ducking",
                bullet_points=["Drops 18dB during speech", "Swells +3dB between slides"],
                voiceover_script="Music drops smoothly while speech plays and swells in transitions.",
                visual_keywords="audio waveform equalizer",
            ),
            SlideScriptItem(
                slide_index=3,
                layout="conclusion_cta",
                heading="Studio Ready Audio",
                bullet_points=["4 curated mood presets"],
                voiceover_script="Choose from Inspiring, Tech, Corporate, or Relaxed moods.",
                visual_keywords="podcast studio",
            ),
        ],
    )


class TestBGMServiceCatalogAndSynthesis:
    """Verifies mood catalog coverage and valid stereo WAV synthesis & caching."""

    def test_catalog_covers_all_four_moods_and_synthesizes_stereo_wav(self, tmp_path: Path):
        svc = BGMService(output_base_dir=tmp_path / "jobs", cache_dir=tmp_path / "bgm_cache")
        all_tracks = svc.list_tracks()
        moods = {track.mood for track in all_tracks}
        assert moods == {"inspiring", "tech", "corporate", "relaxed"}
        assert len(svc.list_tracks(mood="tech")) >= 2

        wav_path = svc.get_track_audio_file(BGM_CATALOG[0].track_id)
        assert wav_path.exists()
        assert wav_path.read_bytes()[:4] == b"RIFF"

        with wave.open(str(wav_path), "rb") as w:
            assert w.getnchannels() == 2
            assert w.getframerate() == 44100
            assert w.getnframes() >= 44100 * 4

    def test_compile_bgm_props_stages_music_and_sets_ducking_curve(self, tmp_path: Path):
        svc = BGMService(output_base_dir=tmp_path / "jobs", cache_dir=tmp_path / "bgm_cache")
        disabled = svc.compile_bgm_props(BGMSettings(enabled=False), job_id="job_off")
        assert disabled.enabled is False

        props = svc.compile_bgm_props(
            BGMSettings(enabled=True, mood="inspiring", volume=0.25, ducking_enabled=True),
            job_id="job_bgm_1",
        )
        assert props.enabled is True
        assert props.mood == "inspiring"
        assert props.ducking_enabled is True
        assert props.duck_attenuation_db == 18.0
        assert props.transition_swell_db == 3.0
        assert props.audio_url == f"/music/job_bgm_1_{props.track_id}.wav"
        assert Path(props.audio_path).exists()


class TestRemotionMusicStagingAndCleanup:
    """Verifies RemotionRenderService stages `public/music/` and cleans up job tracks."""

    def test_stages_and_cleans_up_bgm_track(self, tmp_path: Path):
        renderer_dir = tmp_path / "video-renderer"
        render_service = RemotionRenderService(video_renderer_dir=renderer_dir)
        bgm_svc = BGMService(output_base_dir=tmp_path / "jobs", cache_dir=tmp_path / "bgm_cache")

        job_id = "job_stage_bgm"
        bgm_props: RemotionBGMProps = bgm_svc.compile_bgm_props(
            BGMSettings(enabled=True, mood="corporate", ducking_enabled=True),
            job_id=job_id,
        )
        src_audio = tmp_path / "jobs" / job_id / "audio" / "slide_1_aa.mp3"
        src_audio.parent.mkdir(parents=True, exist_ok=True)
        src_audio.write_bytes(b"ID3" + (b"\x00" * 512))

        props = RemotionCompositionProps(
            project_title="BGM Staging Check",
            total_duration_seconds=4.5,
            total_frames=135,
            slides=[
                RemotionSlideProps(
                    slide_index=1,
                    layout="title_intro",
                    heading="BGM Stage",
                    bullet_points=["Check"],
                    voiceover_script="Checking music staging.",
                    voiceover_audio_path=str(src_audio),
                    voiceover_audio_url=f"/audio_temp/{job_id}/slide_1_aa.mp3",
                    voiceover_duration_seconds=3.8,
                    calculated_frames=135,
                )
            ],
            bgm=bgm_props,
        )

        render_service.stage_audio_assets(props, job_id)
        expected_public_music = renderer_dir / "public" / "music" / f"{job_id}_{bgm_props.track_id}.wav"
        assert expected_public_music.exists()

        render_service.cleanup_staged_assets(job_id)
        assert not expected_public_music.exists()


class TestM32BGMEndpoints:
    """Verifies FastAPI BGM catalog, streaming preview, and compile endpoint BGM enrichment."""

    def test_list_and_preview_bgm_tracks(self):
        res = client.get("/api/v1/bgm/tracks?mood=relaxed")
        assert res.status_code == 200
        tracks = res.json()
        assert len(tracks) >= 1
        assert tracks[0]["mood"] == "relaxed"
        track_id = tracks[0]["track_id"]

        preview = client.get(f"/api/v1/bgm/tracks/{track_id}/preview")
        assert preview.status_code == 200
        assert preview.content[:4] == b"RIFF"

        missing = client.get("/api/v1/bgm/tracks/nonexistent-track/preview")
        assert missing.status_code == 404

    def test_compile_endpoint_attaches_ducked_bgm_when_enabled(self):
        resp = client.post(
            "/api/v1/jobs/compile",
            json={
                "script": _sample_script().model_dump(),
                "aspect_ratio": "16:9",
                "voice_settings": {"provider": "edge_tts", "voice_id": "en-US-GuyNeural", "speed": 1.0},
                "render_video": False,
                "include_stock_visuals": False,
                "bgm_settings": {
                    "enabled": True,
                    "mood": "tech",
                    "volume": 0.22,
                    "ducking_enabled": True,
                },
            },
        )
        assert resp.status_code == 202
        job_id = resp.json()["job_id"]

        try:
            job_resp = client.get(f"/api/v1/jobs/{job_id}")
            assert job_resp.status_code == 200
            bgm = job_resp.json()["remotion_props"]["bgm"]
            assert bgm["enabled"] is True
            assert bgm["mood"] == "tech"
            assert bgm["ducking_enabled"] is True
            assert bgm["duck_attenuation_db"] == 18.0
            assert bgm["audio_url"].startswith(f"/music/{job_id}_")
        finally:
            shutil.rmtree(TEMP_JOBS_DIR / job_id, ignore_errors=True)
            JOBS_STORE.pop(job_id, None)


class TestCustomUploadedBGM:
    """Verifies user custom music upload, normalization, preview streaming, and mixing into jobs."""

    def _make_sample_wav_bytes(self, duration_sec: float = 0.6) -> bytes:
        import io
        import math
        import struct

        sample_rate = 44100
        frames = bytearray()
        total = int(sample_rate * duration_sec)
        for i in range(total):
            val = int(0.18 * math.sin(2.0 * math.pi * 440.0 * (i / sample_rate)) * 32767)
            frames.extend(struct.pack("<hh", val, val))
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(2)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(bytes(frames))
        return buf.getvalue()

    def test_upload_custom_bgm_preview_and_compile_into_job(self):
        wav_bytes = self._make_sample_wav_bytes(0.8)
        upload_resp = client.post(
            "/api/v1/bgm/upload",
            files={"file": ("my-custom-song.wav", wav_bytes, "audio/wav")},
        )
        assert upload_resp.status_code == 200
        uploaded = upload_resp.json()
        custom_audio_id = uploaded["custom_audio_id"]
        assert custom_audio_id.startswith("bgm_")
        assert uploaded["filename"] == "my-custom-song.wav"
        assert uploaded["duration_seconds"] >= 0.7

        uploads_dir = TEMP_JOBS_DIR / "_bgm_uploads"
        job_id = None
        try:
            # Uploaded file streams cleanly for preview
            preview_resp = client.get(f"/api/v1/bgm/uploads/{custom_audio_id}/preview")
            assert preview_resp.status_code == 200
            assert preview_resp.content[:4] == b"RIFF"

            # Enqueue compile job referencing uploaded custom_audio_id
            compile_resp = client.post(
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
                    "include_stock_visuals": False,
                    "bgm_settings": {
                        "enabled": True,
                        "custom_audio_id": custom_audio_id,
                        "volume": 0.45,
                        "ducking_enabled": True,
                        "duck_attenuation_db": 10.0,
                    },
                },
            )
            assert compile_resp.status_code == 202
            job_id = compile_resp.json()["job_id"]

            job_resp = client.get(f"/api/v1/jobs/{job_id}")
            assert job_resp.status_code == 200
            bgm = job_resp.json()["remotion_props"]["bgm"]
            assert bgm["enabled"] is True
            assert bgm["track_id"] == custom_audio_id
            assert bgm["volume"] == 0.45
            assert bgm["duck_attenuation_db"] == 10.0
            assert bgm["audio_url"] == f"/music/{job_id}_{custom_audio_id}.wav"
            assert Path(bgm["audio_path"]).exists()
        finally:
            if job_id:
                shutil.rmtree(TEMP_JOBS_DIR / job_id, ignore_errors=True)
                JOBS_STORE.pop(job_id, None)
            for p in uploads_dir.glob(f"{custom_audio_id}*"):
                p.unlink(missing_ok=True)

    def test_upload_custom_bgm_rejects_invalid_extension_and_corrupt_audio(self):
        bad_ext = client.post(
            "/api/v1/bgm/upload",
            files={"file": ("script.txt", b"hello", "text/plain")},
        )
        assert bad_ext.status_code == 400

        bad_bytes = client.post(
            "/api/v1/bgm/upload",
            files={"file": ("fake.mp3", b"not-valid-audio-data", "audio/mpeg")},
        )
        assert bad_bytes.status_code == 400
