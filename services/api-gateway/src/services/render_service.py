"""
Stateless Remotion Video Render Service (Milestone M1.5).
Bridges API Gateway / CLI orchestrator with `services/video-renderer` strictly via
JSON props files, temporary `public/audio_temp/{job_id}` asset staging, and
`remotion render` CLI execution (.agent/rules/architecture-rules.md).
"""

import json
import logging
from pathlib import Path
import re
import shutil
import subprocess
import time
from typing import Callable, List, Optional

from ..schemas import RemotionCompositionProps

logger = logging.getLogger(__name__)


def verify_mp4_output(mp4_path: Path, min_size_bytes: int = 1024) -> int:
    """
    Verifies that the rendered MP4 file exists, exceeds minimum byte size,
    and contains a valid ISO Base Media File Format (`ftyp`) header box.

    Returns:
        int: Size of the verified MP4 file in bytes.
    """
    if not mp4_path.exists():
        raise FileNotFoundError(f"Rendered MP4 file does not exist: {mp4_path}")

    size = mp4_path.stat().st_size
    if size < min_size_bytes:
        raise ValueError(
            f"Rendered MP4 file '{mp4_path.name}' is too small ({size} bytes < {min_size_bytes} bytes)."
        )

    with mp4_path.open("rb") as fh:
        header = fh.read(12)

    if len(header) < 8 or header[4:8] != b"ftyp":
        raise ValueError(
            f"File '{mp4_path.name}' does not have a valid MP4 'ftyp' header."
        )

    return size


class RemotionRenderService:
    """Executes Remotion CLI rendering and manages temporary asset staging & cleanup."""

    def __init__(
        self,
        video_renderer_dir: Optional[Path] = None,
        timeout_seconds: int = 600,
    ) -> None:
        repo_root = Path(__file__).resolve().parents[4]
        self.video_renderer_dir = (
            video_renderer_dir or (repo_root / "services" / "video-renderer")
        )
        self.public_audio_temp_dir = (
            self.video_renderer_dir / "public" / "audio_temp"
        )
        self.public_assets_dir = (
            self.video_renderer_dir / "public" / "assets"
        )
        self.public_music_dir = (
            self.video_renderer_dir / "public" / "music"
        )
        self.timeout_seconds = timeout_seconds

    def stage_audio_assets(
        self,
        props: RemotionCompositionProps,
        job_id: str,
    ) -> Path:
        """
        Copies synthesized slide MP3 files into `services/video-renderer/public/audio_temp/{job_id}/`
        and downloaded slide background visuals into `services/video-renderer/public/assets/{job_id}/`
        so Remotion's static asset server can serve them cleanly during rendering.
        """
        job_stage_dir = self.public_audio_temp_dir / job_id
        job_stage_dir.mkdir(parents=True, exist_ok=True)
        assets_stage_dir = self.public_assets_dir / job_id

        for slide in props.slides:
            src_path = Path(slide.voiceover_audio_path)
            if src_path.exists():
                target_path = job_stage_dir / src_path.name
                if src_path.resolve() != target_path.resolve():
                    shutil.copy2(src_path, target_path)
            else:
                logger.warning(
                    "Slide %d audio file not found at '%s' during staging.",
                    slide.slide_index,
                    src_path,
                )

            if slide.background_image_path:
                img_src = Path(slide.background_image_path)
                if img_src.exists():
                    assets_stage_dir.mkdir(parents=True, exist_ok=True)
                    img_target = assets_stage_dir / img_src.name
                    if img_src.resolve() != img_target.resolve():
                        shutil.copy2(img_src, img_target)

        if props.bgm and props.bgm.enabled and props.bgm.audio_path:
            bgm_src = Path(props.bgm.audio_path)
            if bgm_src.exists():
                self.public_music_dir.mkdir(parents=True, exist_ok=True)
                target_name = Path(props.bgm.audio_url or bgm_src.name).name
                bgm_target = self.public_music_dir / target_name
                if bgm_src.resolve() != bgm_target.resolve():
                    shutil.copy2(bgm_src, bgm_target)

        return job_stage_dir

    def cleanup_staged_assets(self, job_id: str) -> None:
        """Removes staged temporary audio, visual, and music files after rendering."""
        for stage_dir in (
            self.public_audio_temp_dir / job_id,
            self.public_assets_dir / job_id,
        ):
            if stage_dir.exists():
                shutil.rmtree(stage_dir, ignore_errors=True)
                logger.info("Cleaned up staged assets at %s", stage_dir)

        if self.public_music_dir.exists():
            for music_file in self.public_music_dir.glob(f"{job_id}_*"):
                music_file.unlink(missing_ok=True)

    def build_remotion_command(
        self,
        props_file: Path,
        output_mp4_path: Path,
        frame_range: Optional[str] = None,
        log_level: str = "error",
    ) -> List[str]:
        """Constructs the cross-platform `remotion render` CLI command array."""
        cli_js = (
            self.video_renderer_dir
            / "node_modules"
            / "@remotion"
            / "cli"
            / "remotion-cli.js"
        )
        if cli_js.exists():
            cmd = ["node", str(cli_js.resolve())]
        else:
            npx_bin = "npx.cmd" if shutil.which("npx.cmd") else "npx"
            cmd = [npx_bin, "@remotion/cli"]

        cmd.extend(
            [
                "render",
                "src/index.ts",
                "SlidePresentation",
                str(output_mp4_path.resolve()),
                f"--props={props_file.resolve()}",
                f"--log={log_level}",
            ]
        )
        if frame_range:
            cmd.append(f"--frames={frame_range}")
        return cmd

    def _run_remotion_with_progress(
        self,
        cmd: List[str],
        effective_timeout: int,
        progress_callback: Callable[[int, str], None],
    ) -> None:
        """Executes Remotion CLI streaming stdout lines and reporting monotonic 81%..98% progress."""
        proc = subprocess.Popen(
            cmd,
            cwd=str(self.video_renderer_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )
        tail_lines: List[str] = []
        last_pct = 81
        last_emit_ts = 0.0
        start_ts = time.monotonic()

        bundle_re = re.compile(r"Bundling\s+(\d+)%")
        render_re = re.compile(r"Rendered\s+(\d+)/(\d+)(?:,\s*time remaining:\s*([^\r\n]+))?")
        encode_re = re.compile(r"Encoded\s+(\d+)/(\d+)")

        def _maybe_emit(pct: int, msg: str, force: bool = False) -> None:
            nonlocal last_pct, last_emit_ts
            bounded = max(last_pct, min(98, pct))
            now = time.monotonic()
            if force or bounded > last_pct or (now - last_emit_ts >= 1.5 and msg):
                last_pct = bounded
                last_emit_ts = now
                progress_callback(bounded, f"{msg} ({bounded}%)")

        try:
            assert proc.stdout is not None
            for raw_line in proc.stdout:
                if time.monotonic() - start_ts > effective_timeout:
                    proc.kill()
                    raise subprocess.TimeoutExpired(cmd=cmd, timeout=effective_timeout)

                line = raw_line.strip()
                if not line:
                    continue
                tail_lines.append(line)
                if len(tail_lines) > 30:
                    tail_lines.pop(0)

                m_bundle = bundle_re.search(line)
                if m_bundle:
                    bpct = int(m_bundle.group(1))
                    mapped = 81 + round(4 * (bpct / 100.0))
                    _maybe_emit(mapped, f"Bundling Remotion templates ({bpct}%)...")
                    continue

                if "Getting composition" in line:
                    _maybe_emit(85, "Preparing headless Chromium renderer...", force=True)
                    continue

                m_render = render_re.search(line)
                if m_render:
                    cur = int(m_render.group(1))
                    tot = max(1, int(m_render.group(2)))
                    eta = m_render.group(3)
                    ratio = min(1.0, cur / tot)
                    mapped = 86 + round(9 * ratio)
                    eta_note = f", ETA {eta.strip()}" if eta else ""
                    _maybe_emit(mapped, f"Rendering frame {cur}/{tot}{eta_note}...")
                    continue

                m_encode = encode_re.search(line)
                if m_encode:
                    cur = int(m_encode.group(1))
                    tot = max(1, int(m_encode.group(2)))
                    ratio = min(1.0, cur / tot)
                    mapped = 95 + round(3 * ratio)
                    _maybe_emit(mapped, f"Encoding 1080p MP4 ({cur}/{tot} frames)...")

            returncode = proc.wait(timeout=max(5, int(effective_timeout - (time.monotonic() - start_ts))))
            if returncode != 0:
                raise RuntimeError(
                    f"Remotion CLI render exited with code {returncode}: {' '.join(tail_lines[-8:])}"
                )
        except Exception:
            if proc.poll() is None:
                proc.kill()
            raise

    def render_presentation(
        self,
        props: RemotionCompositionProps,
        job_id: str,
        output_mp4_path: Path,
        props_json_path: Optional[Path] = None,
        frame_range: Optional[str] = None,
        cleanup_staging: bool = True,
        progress_callback: Optional[Callable[[int, str], None]] = None,
    ) -> Path:
        """
        Stages audio assets, writes the Remotion input props JSON, invokes the Remotion CLI
        to compile the MP4 video, verifies the MP4 header, and cleans up staged files.
        """
        output_mp4_path = output_mp4_path.resolve()
        output_mp4_path.parent.mkdir(parents=True, exist_ok=True)

        if props_json_path is None:
            props_json_path = output_mp4_path.parent / f"{job_id}_remotion_props.json"
        else:
            props_json_path = props_json_path.resolve()
            props_json_path.parent.mkdir(parents=True, exist_ok=True)

        props_json_path.write_text(
            json.dumps(props.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        self.stage_audio_assets(props, job_id)
        effective_timeout = max(self.timeout_seconds, 120 + (props.total_frames // 6))

        try:
            log_mode = "info" if progress_callback is not None else "error"
            cmd = self.build_remotion_command(
                props_file=props_json_path,
                output_mp4_path=output_mp4_path,
                frame_range=frame_range,
                log_level=log_mode,
            )
            logger.info(
                "Starting Remotion render for job '%s': %s",
                job_id,
                " ".join(cmd),
            )
            if progress_callback is not None:
                self._run_remotion_with_progress(
                    cmd=cmd,
                    effective_timeout=effective_timeout,
                    progress_callback=progress_callback,
                )
            else:
                result = subprocess.run(
                    cmd,
                    cwd=str(self.video_renderer_dir),
                    capture_output=True,
                    text=True,
                    timeout=effective_timeout,
                    check=False,
                )
                if result.returncode != 0:
                    stderr_out = (result.stderr or result.stdout or "").strip()
                    raise RuntimeError(
                        f"Remotion CLI render exited with code {result.returncode}: {stderr_out}"
                    )

            verify_mp4_output(output_mp4_path)
            logger.info(
                "Remotion render completed for job '%s' -> %s (%d bytes)",
                job_id,
                output_mp4_path,
                output_mp4_path.stat().st_size,
            )
            return output_mp4_path

        finally:
            if cleanup_staging:
                self.cleanup_staged_assets(job_id)
