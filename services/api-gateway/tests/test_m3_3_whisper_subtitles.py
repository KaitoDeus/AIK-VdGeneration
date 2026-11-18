"""
Automated Verification & Test Suite for Milestone M3.3:
OpenAI Whisper Word-Level Timestamp Generation, Proportional Forced-Alignment Fallback,
Synchronized `.srt` Export, Worker Integration, and FastAPI Subtitles Endpoint.
"""

from pathlib import Path
import shutil
from types import SimpleNamespace
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
import pytest

from src.main import JOBS_STORE, TEMP_JOBS_DIR, app
from src.schemas import (
    PresentationScript,
    RemotionCompositionProps,
    RemotionSlideProps,
    SlideScriptItem,
    SubtitleSettings,
)
from src.services.subtitle_service import (
    WhisperSubtitleService,
    align_words_proportionally,
    format_srt_timestamp,
)

client = TestClient(app)


def _sample_script() -> PresentationScript:
    return PresentationScript(
        title="Whisper Captions Demo",
        language="vi",
        theme="modern_tech",
        slides=[
            SlideScriptItem(
                slide_index=1,
                layout="title_intro",
                heading="Phụ Đề Karaoke Tự Động",
                bullet_points=["Whisper word timestamps", "Đồng bộ khung hình Remotion"],
                voiceover_script="Xin chào đến với hệ thống phụ đề tự động thông minh.",
                visual_keywords="waveform subtitle studio",
            ),
            SlideScriptItem(
                slide_index=2,
                layout="bullet_list",
                heading="Kiến Trúc Audio-First",
                bullet_points=["Nhấn mạnh từng từ đang đọc", "Xuất file SRT chuẩn mực"],
                voiceover_script="Mỗi từ vựng được căn chỉnh chính xác theo nhịp giọng đọc.",
                visual_keywords="digital typography screen",
            ),
            SlideScriptItem(
                slide_index=3,
                layout="conclusion_cta",
                heading="Sẵn Sàng Xuất Bản",
                bullet_points=["Xuất video 1080p MP4 kèm phụ đề"],
                voiceover_script="Bắt đầu tạo video thuyết trình chuyên nghiệp ngay hôm nay.",
                visual_keywords="creator desk studio",
            ),
        ],
    )


class TestProportionalAlignmentAndSRTMath:
    """Verifies monotonic forced alignment fallback and SubRip timestamp formatting."""

    def test_align_words_proportionally_maintains_monotonic_bounds(self):
        words = align_words_proportionally(
            "Xin chào, kiến trúc video đồng bộ âm thanh!",
            duration_seconds=3.6,
        )
        assert len(words) == 9
        assert words[0].start_seconds == 0.0
        assert words[-1].end_seconds == 3.6
        for prev, curr in zip(words, words[1:]):
            assert prev.start_seconds <= prev.end_seconds <= curr.start_seconds + 0.001

    def test_formats_subrip_timestamps_accurately(self):
        assert format_srt_timestamp(0.0) == "00:00:00,000"
        assert format_srt_timestamp(65.432) == "00:01:05,432"
        assert format_srt_timestamp(3661.5) == "01:01:01,500"


class TestWhisperSubtitleService:
    """Tests OpenAI Whisper API word-timestamp parsing, retry recovery, and fallback."""

    def test_openai_whisper_transcription_and_retry_recovery(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setattr("time.sleep", lambda _s: None)
        mp3 = tmp_path / "slide_1.mp3"
        mp3.write_bytes(b"ID3" + (b"\x00" * 1024))

        mock_openai = MagicMock()
        mock_openai.audio.transcriptions.create.side_effect = [
            RuntimeError("OpenAI temporary 502"),
            SimpleNamespace(
                words=[
                    {"word": "Audio", "start": 0.0, "end": 0.42},
                    {"word": "drives", "start": 0.45, "end": 0.91},
                    {"word": "video.", "start": 0.95, "end": 1.6},
                ]
            ),
        ]

        svc = WhisperSubtitleService(
            api_key="sk-test-whisper",
            max_retries=2,
            openai_client=mock_openai,
        )
        words, provider = svc.generate_slide_timestamps(
            audio_path=mp3,
            voiceover_script="Audio drives video.",
            duration_seconds=2.5,
            language="en",
        )
        assert provider == "openai_whisper"
        assert mock_openai.audio.transcriptions.create.call_count == 2
        assert [w.word for w in words] == ["Audio", "drives", "video."]
        assert words[1].start_seconds == 0.45

    def test_whisper_failure_gracefully_falls_back_to_forced_alignment(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setattr("time.sleep", lambda _s: None)
        mp3 = tmp_path / "slide_err.mp3"
        mp3.write_bytes(b"ID3" + (b"\x00" * 1024))

        failing_openai = MagicMock()
        failing_openai.audio.transcriptions.create.side_effect = RuntimeError("Invalid API Key")

        svc = WhisperSubtitleService(
            api_key="sk-bad",
            max_retries=2,
            openai_client=failing_openai,
        )
        words, provider = svc.generate_slide_timestamps(
            audio_path=mp3,
            voiceover_script="Fallback preserves captions cleanly.",
            duration_seconds=3.0,
            language="en",
        )
        assert provider == "forced_alignment"
        assert len(words) == 4
        assert words[-1].end_seconds == 3.0

    def test_enrich_remotion_props_generates_srt_with_cumulative_slide_offsets(self, tmp_path: Path):
        svc = WhisperSubtitleService(api_key="", provider_mode="forced_alignment")
        job_dir = tmp_path / "job_srt"

        props = RemotionCompositionProps(
            project_title="SRT Offset Check",
            fps=30,
            total_duration_seconds=9.4,
            total_frames=282,
            slides=[
                RemotionSlideProps(
                    slide_index=1,
                    layout="title_intro",
                    heading="Slide 1",
                    voiceover_script="First slide speech.",
                    voiceover_audio_url="/audio_temp/j/s1.mp3",
                    voiceover_audio_path="/tmp/s1.mp3",
                    voiceover_duration_seconds=4.0,
                    calculated_frames=141,  # 4.7s
                ),
                RemotionSlideProps(
                    slide_index=2,
                    layout="conclusion_cta",
                    heading="Slide 2",
                    voiceover_script="Second slide conclusion.",
                    voiceover_audio_url="/audio_temp/j/s2.mp3",
                    voiceover_audio_path="/tmp/s2.mp3",
                    voiceover_duration_seconds=4.0,
                    calculated_frames=141,
                ),
            ],
        )

        enriched = svc.enrich_remotion_props(
            props=props,
            settings=SubtitleSettings(enabled=True, style="karaoke_pill", max_words_per_line=5),
            language="en",
            job_dir=job_dir,
        )
        assert enriched.subtitles.enabled is True
        assert enriched.subtitles.provider_used == "forced_alignment"
        assert len(enriched.slides[0].word_timestamps) == 3

        srt_file = job_dir / "subtitles.srt"
        assert srt_file.exists()
        srt_text = srt_file.read_text(encoding="utf-8")
        # Slide 1 starts at 0.2s padding -> 00:00:00,200; Slide 2 starts at 4.7s + 0.2s = 00:00:04,900
        assert "00:00:00,200 -->" in srt_text
        assert "00:00:04,900 -->" in srt_text
        assert "First slide speech." in srt_text
        assert "Second slide conclusion." in srt_text


class TestM33SubtitlesEndpoint:
    """Verifies POST /api/v1/jobs/compile + GET /api/v1/jobs/{job_id}/subtitles.srt end-to-end."""

    def test_compile_with_subtitles_enabled_creates_word_timestamps_and_streams_srt(self):
        resp = client.post(
            "/api/v1/jobs/compile",
            json={
                "script": _sample_script().model_dump(),
                "aspect_ratio": "16:9",
                "voice_settings": {
                    "provider": "edge_tts",
                    "voice_id": "vi-VN-HoaiMyNeural",
                    "speed": 1.0,
                },
                "render_video": False,
                "include_stock_visuals": False,
                "subtitle_settings": {
                    "enabled": True,
                    "style": "bold_highlight",
                    "max_words_per_line": 6,
                },
            },
        )
        assert resp.status_code == 202
        job_id = resp.json()["job_id"]

        try:
            job_resp = client.get(f"/api/v1/jobs/{job_id}")
            assert job_resp.status_code == 200
            props = job_resp.json()["remotion_props"]
            assert props["subtitles"]["enabled"] is True
            assert props["subtitles"]["style"] == "bold_highlight"
            assert len(props["slides"][0]["word_timestamps"]) >= 5

            srt_resp = client.get(f"/api/v1/jobs/{job_id}/subtitles.srt")
            assert srt_resp.status_code == 200
            assert "subrip" in srt_resp.headers["content-type"]
            assert "00:00:00,200 -->" in srt_resp.text
            assert "Xin chào" in srt_resp.text

            missing_resp = client.get("/api/v1/jobs/nonexistent_srt_job/subtitles.srt")
            assert missing_resp.status_code == 404
        finally:
            shutil.rmtree(TEMP_JOBS_DIR / job_id, ignore_errors=True)
            JOBS_STORE.pop(job_id, None)
