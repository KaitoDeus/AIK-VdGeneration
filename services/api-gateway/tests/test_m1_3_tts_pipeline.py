"""
Automated Verification & Test Suite for Milestone M1.3:
Bilingual Audio Pipeline (Edge-TTS & ElevenLabs), MP3 Header Validation,
Exact Duration Extraction, and Remotion Frame Synchronization.
"""

from pathlib import Path
import re
import shutil
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
import pytest

from mutagen.mp3 import MP3

from src.main import JOBS_STORE, TEMP_JOBS_DIR, app
from src.schemas import PresentationScript, RemotionCompositionProps, SlideScriptItem, VoiceSettings
from src.services.tts_service import (
    EDGE_PEER_FALLBACK_VOICES,
    MIN_AUDIO_FILE_BYTES,
    TTSAudioPipeline,
    calculate_slide_frames,
    clean_tts_text,
    compute_audio_filename,
    verify_and_extract_duration,
    write_synthetic_mp3_fallback,
)

client = TestClient(app)


def _build_sample_script(language: str = "vi") -> PresentationScript:
    if language == "vi":
        return PresentationScript(
            title="Kiến trúc Điện toán Đám mây",
            language="vi",
            theme="modern_tech",
            slides=[
                SlideScriptItem(
                    slide_index=1,
                    layout="title_intro",
                    heading="Điện toán đám mây là gì?",
                    bullet_points=["Lưu trữ phân tán qua Internet", "Tối ưu chi phí vận hành"],
                    voiceover_script="Chào mừng bạn đến với bài tìm hiểu về điện toán đám mây hiện đại.",
                    visual_keywords="cloud computing servers",
                ),
                SlideScriptItem(
                    slide_index=2,
                    layout="bullet_list",
                    heading="Ba mô hình dịch vụ chính",
                    bullet_points=["Hạ tầng IaaS", "Nền tảng PaaS", "Phần mềm SaaS"],
                    voiceover_script="Có ba mô hình dịch vụ đám mây cốt lõi giúp doanh nghiệp linh hoạt mở rộng.",
                    visual_keywords="software infrastructure layers",
                ),
                SlideScriptItem(
                    slide_index=3,
                    layout="conclusion_cta",
                    heading="Bắt đầu chuyển đổi số",
                    bullet_points=["Triển khai nhanh chóng", "Bảo mật đa lớp"],
                    voiceover_script="Hãy áp dụng điện toán đám mây vào dự án của bạn ngay hôm nay.",
                    visual_keywords="digital transformation future",
                ),
            ],
        )
    return PresentationScript(
        title="Cloud Architecture Essentials",
        language="en",
        theme="modern_tech",
        slides=[
            SlideScriptItem(
                slide_index=1,
                layout="title_intro",
                heading="What is Cloud Computing?",
                bullet_points=["Distributed cloud infrastructure", "On-demand scalability"],
                voiceover_script="Welcome to our overview of modern cloud computing architecture.",
                visual_keywords="cloud computing servers",
            ),
            SlideScriptItem(
                slide_index=2,
                layout="bullet_list",
                heading="Three Core Service Models",
                bullet_points=["Infrastructure as a Service", "Platform as a Service", "Software as a Service"],
                voiceover_script="Cloud platforms offer three primary service models tailored to engineering teams.",
                visual_keywords="software infrastructure layers",
            ),
            SlideScriptItem(
                slide_index=3,
                layout="conclusion_cta",
                heading="Deploy Your First Workload",
                bullet_points=["Global low-latency reach", "Automated resilience"],
                voiceover_script="Start deploying your applications to the cloud today for global scale.",
                visual_keywords="digital transformation future",
            ),
        ],
    )


class TestAudioSyncMath:
    """Verifies frame synchronization math against .agent/rules/audio-sync-rules.md."""

    def test_minimum_frame_clamping_at_90_frames(self):
        # 1.0s audio + 0.2s before + 0.5s after = 1.7s * 30 = 51 frames -> clamped to 90 frames (3.0s)
        assert calculate_slide_frames(1.0, fps=30) == 90

    def test_standard_audio_duration_to_frames_formula(self):
        # 5.4s audio + 0.2s before + 0.5s after = 6.1s * 30 = 183 frames
        assert calculate_slide_frames(5.4, fps=30) == 183

    def test_fractional_frame_ceiling_rounding(self):
        # 4.11s + 0.7s padding = 4.81s * 30 = 144.3 -> ceil = 145 frames
        assert calculate_slide_frames(4.11, fps=30) == 145

    def test_rejects_non_positive_duration(self):
        with pytest.raises(ValueError):
            calculate_slide_frames(0.0, fps=30)
        with pytest.raises(ValueError):
            calculate_slide_frames(-2.5, fps=30)


class TestAudioVerificationAndNaming:
    """Verifies standardized naming `slide_{index}_{hash}.mp3` and mutagen MP3 header checks."""

    def test_standardized_slide_audio_filename_format(self):
        name = compute_audio_filename(1, "Hello world", "en-US-GuyNeural", 1.0)
        assert re.match(r"^slide_1_[0-9a-f]{8}\.mp3$", name)

    def test_valid_mp3_verification_and_duration_extraction(self, tmp_path: Path):
        mp3_file = tmp_path / "slide_1_test.mp3"
        write_synthetic_mp3_fallback(mp3_file, target_duration_seconds=4.2)

        assert mp3_file.exists()
        assert mp3_file.stat().st_size >= MIN_AUDIO_FILE_BYTES

        duration = verify_and_extract_duration(mp3_file)
        assert 4.0 <= duration <= 4.5

    def test_rejects_file_smaller_than_10kb(self, tmp_path: Path):
        tiny_file = tmp_path / "tiny.mp3"
        tiny_file.write_bytes(b"\xff\xfb\x90\x00" * 5)
        with pytest.raises(ValueError, match="too small"):
            verify_and_extract_duration(tiny_file)

    def test_rejects_corrupted_non_mp3_header(self, tmp_path: Path):
        corrupt_file = tmp_path / "corrupt.mp3"
        corrupt_file.write_bytes(b"NOT_AN_MP3_FILE_" * 1000)  # > 10KB but invalid header
        with pytest.raises(ValueError, match="Invalid MP3 header"):
            verify_and_extract_duration(corrupt_file)


class TestTTSAudioPipeline:
    """Verifies Edge-TTS live synthesis, ElevenLabs integration, and provider fallback."""

    def test_voice_resolution_bilingual(self):
        assert TTSAudioPipeline.resolve_voice_id("edge_tts", "vi", None) == "vi-VN-HoaiMyNeural"
        assert TTSAudioPipeline.resolve_voice_id("edge_tts", "en", None) == "en-US-GuyNeural"
        # Auto-corrects mismatched language default voice
        assert (
            TTSAudioPipeline.resolve_voice_id("edge_tts", "en", "vi-VN-HoaiMyNeural")
            == "en-US-GuyNeural"
        )
        assert (
            TTSAudioPipeline.resolve_voice_id("elevenlabs", "vi", None)
            == "21m00Tcm4TlvDq8ikWAM"
        )

    def test_live_edge_tts_synthesis_vietnamese(self, tmp_path: Path):
        pipeline = TTSAudioPipeline(output_base_dir=tmp_path)
        file_path, rel_url, duration_sec, provider_used = pipeline.synthesize_slide_audio(
            slide_index=1,
            text="Xin chào, đây là hệ thống tạo video tự động với giọng đọc tiếng Việt tự nhiên.",
            language="vi",
            voice_settings=VoiceSettings(provider="edge_tts", voice_id="vi-VN-HoaiMyNeural"),
            job_id="job_test_vi",
        )
        assert file_path.exists()
        assert file_path.stat().st_size >= MIN_AUDIO_FILE_BYTES
        assert rel_url.startswith("/audio_temp/job_test_vi/slide_1_")
        assert duration_sec > 1.5
        assert provider_used == "edge_tts"

    @patch("src.services.tts_service.httpx.Client")
    def test_elevenlabs_synthesis_success(self, mock_httpx_client_cls, tmp_path: Path):
        # Build valid MP3 payload (>10KB) returned by mocked ElevenLabs API
        mpeg_frame = b"\xff\xfb\x90\x00" + (b"\x00" * 413)
        mock_response = MagicMock()
        mock_response.content = mpeg_frame * 160
        mock_response.raise_for_status.return_value = None

        mock_client = MagicMock()
        mock_client.__enter__.return_value.post.return_value = mock_response
        mock_httpx_client_cls.return_value = mock_client

        pipeline = TTSAudioPipeline(
            output_base_dir=tmp_path,
            elevenlabs_api_key="el_live_test_key",
        )
        file_path, _, duration_sec, provider_used = pipeline.synthesize_slide_audio(
            slide_index=2,
            text="High emotional fidelity voiceover from ElevenLabs Multilingual v2.",
            language="en",
            voice_settings=VoiceSettings(provider="elevenlabs", voice_id="21m00Tcm4TlvDq8ikWAM"),
            job_id="job_test_el",
        )
        assert provider_used == "elevenlabs"
        assert file_path.exists()
        assert duration_sec > 3.5

    def test_elevenlabs_missing_key_falls_back_to_edge_tts(self, tmp_path: Path):
        pipeline = TTSAudioPipeline(output_base_dir=tmp_path, elevenlabs_api_key="")
        file_path, _, duration_sec, provider_used = pipeline.synthesize_slide_audio(
            slide_index=1,
            text="Fallback test when ElevenLabs key is not configured.",
            language="en",
            voice_settings=VoiceSettings(provider="elevenlabs"),
            job_id="job_test_fallback",
        )
        assert provider_used == "edge_tts (fallback)"
        assert file_path.exists()
        assert duration_sec > 1.5

    def test_clean_tts_text_strips_markdown_and_normalizes_nfc(self):
        # NFD decomposed Vietnamese 'o\u0302\u0301' + markdown formatting
        raw = "## **Kiến trúc** `AI` to\u0302\u0301i ưu\ncho video"
        cleaned = clean_tts_text(raw)
        assert cleaned == "Kiến trúc AI tối ưu cho video"
        assert "**" not in cleaned
        assert "`" not in cleaned

    def test_edge_tts_primary_voice_failure_falls_over_to_peer_voice(self, tmp_path: Path):
        called_voices = []
        valid_mp3_payload = (b"\xff\xfb\x90\x00" + (b"\x00" * 413)) * 140

        def _mock_single_voice(self_obj, text: str, voice_id: str, speed: float, out_path: Path):
            called_voices.append(voice_id)
            if voice_id == "vi-VN-HoaiMyNeural":
                raise RuntimeError("No audio was received. Please verify that your parameters are correct.")
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(valid_mp3_payload)

        pipeline = TTSAudioPipeline(
            output_base_dir=tmp_path,
            max_retries=2,
            allow_offline_fallback=False,
        )
        with patch("src.services.tts_service.time.sleep", return_value=None), patch.object(
            TTSAudioPipeline, "_run_edge_tts_single_voice", new=_mock_single_voice
        ):
            file_path, _, duration_sec, provider_used = pipeline.synthesize_slide_audio(
                slide_index=1,
                text="Xin chào, kiểm tra cơ chế chuyển giọng dự phòng tiếng Việt.",
                language="vi",
                voice_settings=VoiceSettings(provider="edge_tts", voice_id="vi-VN-HoaiMyNeural"),
                job_id="job_peer_fallback",
            )

        assert called_voices == [
            "vi-VN-HoaiMyNeural",
            "vi-VN-HoaiMyNeural",
            "vi-VN-NamMinhNeural",
        ]
        assert provider_used == "edge_tts"
        assert file_path.exists()
        assert MP3(file_path).info.length > 2.5
        assert duration_sec > 2.5


class TestM13APIEndpoints:
    """Verifies FastAPI /api/v1/audio/synthesize and end-to-end /api/v1/videos/generate."""

    def test_audio_synthesize_endpoint_compiles_remotion_props(self):
        script = _build_sample_script("en")
        job_id = "job_test_m13_sync"
        try:
            response = client.post(
                "/api/v1/audio/synthesize",
                json={
                    "script": script.model_dump(),
                    "voice_settings": {
                        "provider": "edge_tts",
                        "voice_id": "en-US-GuyNeural",
                        "speed": 1.0,
                    },
                    "aspect_ratio": "16:9",
                    "fps": 30,
                    "job_id": job_id,
                },
            )
            assert response.status_code == 200
            props = RemotionCompositionProps.model_validate(response.json())
            assert props.project_title == "Cloud Architecture Essentials"
            assert props.width == 1920
            assert props.height == 1080
            assert len(props.slides) == 3
            assert props.total_frames == sum(s.calculated_frames for s in props.slides)
            for slide in props.slides:
                assert slide.calculated_frames >= 90
                assert slide.voiceover_duration_seconds > 0
                assert Path(slide.voiceover_audio_path).exists()
        finally:
            shutil.rmtree(TEMP_JOBS_DIR / job_id, ignore_errors=True)

    def test_full_video_generate_pipeline_reaches_audio_ready(self):
        response = client.post(
            "/api/v1/videos/generate",
            json={
                "prompt": "Explain DevOps CI/CD pipeline",
                "language": "vi",
                "aspect_ratio": "16:9",
                "target_duration_seconds": 45,
            },
        )
        assert response.status_code == 202
        job_id = response.json()["job_id"]

        try:
            status_resp = client.get(f"/api/v1/jobs/{job_id}")
            assert status_resp.status_code == 200
            body = status_resp.json()
            assert body["status"] == "audio_ready"
            assert body["progress_percentage"] == 80
            assert body["remotion_props"] is not None
            assert body["remotion_props"]["total_frames"] >= 270

            props_file = TEMP_JOBS_DIR / job_id / "remotion_props.json"
            assert props_file.exists()
        finally:
            shutil.rmtree(TEMP_JOBS_DIR / job_id, ignore_errors=True)
            JOBS_STORE.pop(job_id, None)

    def test_vietnamese_edge_fallback_never_uses_english_voices_and_falls_over_to_google_vi(self, tmp_path: Path):
        # Verify Vietnamese Edge fallback list contains zero English voices
        assert all(v.startswith("vi-") for v in EDGE_PEER_FALLBACK_VOICES["vi"])

        valid_mp3_payload = (b"\xff\xfb\x90\x00" + (b"\x00" * 413)) * 140
        google_calls = []

        def _always_fail_edge(self_obj, text: str, voice_id: str, speed: float, out_path: Path):
            raise RuntimeError("No audio was received.")

        def _mock_google_vi(self_obj, text: str, language: str, speed: float, out_path: Path):
            google_calls.append((language, text))
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(valid_mp3_payload)

        pipeline = TTSAudioPipeline(
            output_base_dir=tmp_path,
            max_retries=1,
            allow_offline_fallback=False,
        )
        with patch.object(
            TTSAudioPipeline, "_run_edge_tts_single_voice", new=_always_fail_edge
        ), patch.object(
            TTSAudioPipeline, "_synthesize_with_google_tts", new=_mock_google_vi
        ):
            resolved_voice = []
            file_path, _, duration_sec, provider_used = pipeline.synthesize_slide_audio(
                slide_index=1,
                text="Xin chào, đây là giọng đọc thuần Việt khi dự phòng.",
                language="vi",
                voice_settings=VoiceSettings(provider="edge_tts", voice_id="vi-VN-HoaiMyNeural"),
                job_id="job_pure_vi_fallback",
                resolved_voice_out=resolved_voice,
            )

        assert google_calls == [("vi", "Xin chào, đây là giọng đọc thuần Việt khi dự phòng.")]
        assert resolved_voice == ["vi-VN-GoogleVi"]
        assert file_path.exists()
        assert duration_sec > 2.0
        assert provider_used == "edge_tts"

    def test_pure_vietnamese_voice_catalog_and_google_vi_direct_synthesis(self, tmp_path: Path):
        vi_resp = client.get("/api/v1/voices?language=vi")
        assert vi_resp.status_code == 200
        vi_voices = vi_resp.json()
        assert len(vi_voices) == 3
        assert all(v["language"] == "vi" for v in vi_voices)
        assert not any("Rachel" in v["label"] or v["voice_id"].startswith("en-") for v in vi_voices)
        assert {v["voice_id"] for v in vi_voices} == {
            "vi-VN-HoaiMyNeural",
            "vi-VN-NamMinhNeural",
            "vi-VN-GoogleVi",
        }

        pipeline = TTSAudioPipeline(output_base_dir=tmp_path)
        file_path, _, duration_sec, provider_used = pipeline.synthesize_slide_audio(
            slide_index=1,
            text="Xin chào, đây là giọng đọc thuần Việt rõ chữ từ Google TTS.",
            language="vi",
            voice_settings=VoiceSettings(
                provider="google_vi",
                voice_id="vi-VN-GoogleVi",
                speed=1.1,
            ),
            job_id="job_google_vi_direct",
        )
        assert provider_used == "google_vi"
        assert file_path.exists()
        assert file_path.stat().st_size >= MIN_AUDIO_FILE_BYTES
        assert duration_sec > 1.5

    def test_synthesize_presentation_backfills_earlier_slides_for_single_speaker_uniformity(self, tmp_path: Path):
        """
        If Slide 1 uses Male (vi-VN-NamMinhNeural) and Slide 2 triggers fallback to
        HoaiMy/GoogleVi, Slide 1 MUST be re-synthesized with the locked fallback voice
        so the entire presentation uses one single speaker without switching mid-video.
        """
        valid_mp3_nam = (b"\xff\xfb\x90\x00" + (b"\x00" * 413)) * 120
        valid_mp3_nu = (b"\xff\xfb\x90\x00" + (b"\x00" * 413)) * 155
        synth_calls = []

        def _mock_single_voice(self_obj, text: str, voice_id: str, speed: float, out_path: Path):
            synth_calls.append((voice_id, text[:20]))
            if voice_id == "vi-VN-NamMinhNeural" and "ba mô hình" in text:
                raise RuntimeError("No audio was received.")
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(valid_mp3_nam if voice_id == "vi-VN-NamMinhNeural" else valid_mp3_nu)

        script = _build_sample_script("vi")
        pipeline = TTSAudioPipeline(
            output_base_dir=tmp_path,
            max_retries=1,
            allow_offline_fallback=False,
        )
        with patch("src.services.tts_service.time.sleep", return_value=None), patch.object(
            TTSAudioPipeline, "_run_edge_tts_single_voice", new=_mock_single_voice
        ):
            props, _ = pipeline.synthesize_presentation(
                script=script,
                voice_settings=VoiceSettings(provider="edge_tts", voice_id="vi-VN-NamMinhNeural"),
                job_id="job_unified_voice",
            )

        # Slide 1 originally wrote with NamMinh (120 frames payload), Slide 2 failed NamMinh and switched to HoaiMy (155 frames),
        # Slide 3 ran on HoaiMy, and THEN Slide 1 was backfilled cleanly with HoaiMy!
        assert [s.voiceover_audio_path for s in props.slides]
        for slide in props.slides:
            # Verify Slide 1's final duration matches the backfilled HoaiMy 155-frame payload (~4.0s), NOT initial 120 frames (~3.1s)
            assert slide.voiceover_duration_seconds > 3.8
        assert props.total_frames == sum(s.calculated_frames for s in props.slides)
        assert ("vi-VN-HoaiMyNeural", "Chào mừng bạn đến vớ") in synth_calls
