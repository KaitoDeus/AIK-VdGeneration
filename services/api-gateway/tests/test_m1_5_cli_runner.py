"""
Automated Verification & End-to-End Test Suite for Milestone M1.5:
Local CLI Pipeline Runner, Asset Staging/Cleanup, and Real Remotion MP4 Rendering.
"""

from pathlib import Path
import shutil
from unittest.mock import MagicMock, patch

import pytest

from src.cli import GATEWAY_ROOT, parse_cli_args, run_cli_pipeline
from src.schemas import RemotionBGMProps, RemotionCompositionProps, RemotionSlideProps, RemotionThemeProps
from src.services.render_service import RemotionRenderService, verify_mp4_output
from src.services.tts_service import write_synthetic_mp3_fallback


def _create_dummy_mp4(path: Path, size_bytes: int = 4096) -> Path:
    """Writes a minimal valid ISO Base Media File Format ('ftypmp42') binary for unit tests."""
    path.parent.mkdir(parents=True, exist_ok=True)
    header = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom"
    padding = b"\x00" * max(0, size_bytes - len(header))
    path.write_bytes(header + padding)
    return path


class TestCLIArgParser:
    """Verifies CLI flag parsing for `npm run generate -- --prompt ...`."""

    def test_parses_required_prompt_and_defaults(self):
        args = parse_cli_args(["--prompt", "Explain Cloud Computing"])
        assert args.prompt == "Explain Cloud Computing"
        assert args.lang == "vi"
        assert args.output == "out/output.mp4"
        assert args.aspect_ratio == "16:9"
        assert args.voice_provider == "edge_tts"
        assert args.skip_render is False

    def test_parses_custom_cli_flags(self):
        args = parse_cli_args(
            [
                "--prompt",
                "Deep Learning Basics",
                "--lang",
                "en",
                "--theme",
                "corporate",
                "--aspect-ratio",
                "9:16",
                "--frames",
                "0-14",
                "--output",
                "out/custom_test.mp4",
            ]
        )
        assert args.lang == "en"
        assert args.theme == "corporate"
        assert args.aspect_ratio == "9:16"
        assert args.frames == "0-14"
        assert args.output == "out/custom_test.mp4"

    def test_missing_prompt_exits_with_error(self):
        with pytest.raises(SystemExit):
            parse_cli_args(["--lang", "vi"])


class TestMP4HeaderVerification:
    """Verifies ISO Base Media ('ftyp') MP4 header and size checks."""

    def test_valid_mp4_header_passes(self, tmp_path: Path):
        mp4_file = _create_dummy_mp4(tmp_path / "valid.mp4", size_bytes=8192)
        assert verify_mp4_output(mp4_file) == 8192

    def test_rejects_missing_mp4_file(self, tmp_path: Path):
        with pytest.raises(FileNotFoundError):
            verify_mp4_output(tmp_path / "nonexistent.mp4")

    def test_rejects_corrupted_non_mp4_header(self, tmp_path: Path):
        bad_file = tmp_path / "invalid.mp4"
        bad_file.write_bytes(b"NOT_AN_MP4_HEADER" * 200)
        with pytest.raises(ValueError, match="ftyp"):
            verify_mp4_output(bad_file)


class TestRemotionRenderService:
    """Verifies stateless asset staging into `public/audio_temp/{job_id}` and automatic cleanup."""

    def test_stages_and_cleans_up_audio_assets(self, tmp_path: Path):
        audio_file = tmp_path / "slide_1_abcd1234.mp3"
        write_synthetic_mp3_fallback(audio_file, target_duration_seconds=3.5)

        props = RemotionCompositionProps(
            project_title="Staging Test",
            fps=30,
            width=1920,
            height=1080,
            total_duration_seconds=4.2,
            total_frames=126,
            theme=RemotionThemeProps(),
            slides=[
                RemotionSlideProps(
                    slide_index=1,
                    layout="title_intro",
                    heading="Slide 1",
                    bullet_points=["Point A"],
                    voiceover_script="Testing audio staging.",
                    voiceover_audio_url="/audio_temp/job_stage_test/slide_1_abcd1234.mp3",
                    voiceover_audio_path=str(audio_file),
                    voiceover_duration_seconds=3.5,
                    calculated_frames=126,
                )
            ],
            bgm=RemotionBGMProps(),
        )

        renderer = RemotionRenderService()
        staged_dir = renderer.stage_audio_assets(props, "job_stage_test")
        staged_mp3 = staged_dir / "slide_1_abcd1234.mp3"

        try:
            assert staged_mp3.exists()
            assert staged_mp3.stat().st_size == audio_file.stat().st_size
        finally:
            renderer.cleanup_staged_assets("job_stage_test")

        assert not staged_dir.exists()

    @patch("src.services.render_service.subprocess.run")
    def test_render_presentation_invokes_remotion_cli_and_cleans_up(
        self, mock_subproc_run, tmp_path: Path
    ):
        audio_file = tmp_path / "slide_1_ef567890.mp3"
        write_synthetic_mp3_fallback(audio_file, target_duration_seconds=3.5)
        output_mp4 = tmp_path / "out" / "rendered.mp4"

        def _fake_remotion_cli(*_args, **_kwargs):
            _create_dummy_mp4(output_mp4, size_bytes=16384)
            res = MagicMock()
            res.returncode = 0
            res.stdout = "Rendered!"
            res.stderr = ""
            return res

        mock_subproc_run.side_effect = _fake_remotion_cli

        props = RemotionCompositionProps(
            project_title="Mock CLI Render Test",
            fps=30,
            width=1920,
            height=1080,
            total_duration_seconds=4.2,
            total_frames=126,
            slides=[
                RemotionSlideProps(
                    slide_index=1,
                    layout="title_intro",
                    heading="Slide 1",
                    bullet_points=["Point 1"],
                    voiceover_script="Hello world",
                    voiceover_audio_url="/audio_temp/job_mock_render/slide_1_ef567890.mp3",
                    voiceover_audio_path=str(audio_file),
                    voiceover_duration_seconds=3.5,
                    calculated_frames=126,
                )
            ],
        )

        renderer = RemotionRenderService()
        result_path = renderer.render_presentation(
            props=props,
            job_id="job_mock_render",
            output_mp4_path=output_mp4,
            frame_range="0-9",
        )

        assert result_path.exists()
        assert verify_mp4_output(result_path) == 16384
        # Confirm staged audio directory was automatically cleaned up after render
        assert not (renderer.public_audio_temp_dir / "job_mock_render").exists()

    @patch("src.services.render_service.subprocess.Popen")
    def test_render_presentation_streams_realtime_progress_via_popen(
        self, mock_popen_cls, tmp_path: Path
    ):
        audio_file = tmp_path / "slide_1_realtime.mp3"
        write_synthetic_mp3_fallback(audio_file, target_duration_seconds=3.5)
        output_mp4 = tmp_path / "out" / "realtime_streamed.mp4"

        def _fake_popen(*_args, **_kwargs):
            _create_dummy_mp4(output_mp4, size_bytes=16384)
            proc = MagicMock()
            proc.stdout = iter(
                [
                    "Bundling 25%\n",
                    "Bundling 100%\n",
                    "Getting composition\n",
                    "Rendered 50/100, time remaining: 6s\n",
                    "Rendered 100/100\n",
                    "Encoded 60/100\n",
                    "Encoded 100/100\n",
                ]
            )
            proc.wait.return_value = 0
            proc.poll.return_value = 0
            return proc

        mock_popen_cls.side_effect = _fake_popen

        props = RemotionCompositionProps(
            project_title="Realtime Popen Stream Test",
            fps=30,
            width=1920,
            height=1080,
            total_duration_seconds=4.2,
            total_frames=126,
            slides=[
                RemotionSlideProps(
                    slide_index=1,
                    layout="title_intro",
                    heading="Slide 1",
                    bullet_points=["Realtime progress"],
                    voiceover_script="Streaming render frames over WebSocket.",
                    voiceover_audio_url="/audio_temp/job_rt/slide_1_realtime.mp3",
                    voiceover_audio_path=str(audio_file),
                    voiceover_duration_seconds=3.5,
                    calculated_frames=126,
                )
            ],
        )

        emitted = []
        renderer = RemotionRenderService()
        renderer.render_presentation(
            props=props,
            job_id="job_rt",
            output_mp4_path=output_mp4,
            progress_callback=lambda pct, msg: emitted.append((pct, msg)),
        )

        assert emitted, "Expected realtime progress emissions during Remotion Popen streaming"
        pcts = [p for p, _ in emitted]
        assert pcts == sorted(pcts)
        assert pcts[0] >= 81 and pcts[-1] == 98
        assert any("Rendering frame 50/100" in msg for _, msg in emitted)
        assert any("Encoding 1080p MP4 (100/100 frames)" in msg for _, msg in emitted)


class TestEndToEndCLIRunner:
    """Verifies end-to-end execution of `src/cli.py` including a real Remotion MP4 render."""

    def test_cli_pipeline_skip_render_mode(self):
        result = run_cli_pipeline(
            [
                "--prompt",
                "Event-Driven Microservices",
                "--lang",
                "en",
                "--skip-render",
            ]
        )
        job_id = result["job_id"]
        try:
            assert Path(result["script_path"]).exists()
            assert Path(result["props_path"]).exists()
            assert result["total_frames"] >= 270
            assert result["output_video_path"] is None
        finally:
            shutil.rmtree(GATEWAY_ROOT / ".temp" / "jobs" / job_id, ignore_errors=True)

    def test_real_end_to_end_cli_remotion_mp4_render(self, tmp_path: Path):
        """
        Executes a real end-to-end run:
        Prompt -> Script -> Live Edge-TTS Audio -> Real Remotion Chromium/FFmpeg MP4 Render (frames 0-9).
        """
        output_mp4 = tmp_path / "e2e_output.mp4"
        result = run_cli_pipeline(
            [
                "--prompt",
                "Cloud Native Architecture",
                "--lang",
                "vi",
                "--frames",
                "0-9",
                "--output",
                str(output_mp4),
            ]
        )
        job_id = result["job_id"]
        try:
            assert output_mp4.exists()
            mp4_size = verify_mp4_output(output_mp4, min_size_bytes=2048)
            assert mp4_size > 2048
            assert result["output_video_path"] == str(output_mp4.resolve())
        finally:
            shutil.rmtree(GATEWAY_ROOT / ".temp" / "jobs" / job_id, ignore_errors=True)
