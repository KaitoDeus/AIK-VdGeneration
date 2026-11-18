"""
AIK-VdGeneration: Local End-to-End CLI Pipeline Runner (Milestone M1.5).
Executes the complete Phase 1 MVP pipeline from a single command:
  Prompt -> Gemini 3.8 Flash Script -> Bilingual TTS Audio -> Remotion 1080p MP4 Video.

Usage:
  npm run generate -- --prompt "Cloud Computing Explained" --lang vi
  python services/api-gateway/src/cli.py --prompt "Cloud Computing" --lang en --output out/output.mp4
"""

import argparse
import json
import logging
from pathlib import Path
import sys
import time
from typing import List, Optional
import uuid

# Ensure `src` package imports resolve when invoked directly as a script
GATEWAY_ROOT = Path(__file__).resolve().parent.parent
if str(GATEWAY_ROOT) not in sys.path:
    sys.path.insert(0, str(GATEWAY_ROOT))

from src.schemas import SupportedLanguage, TTSProviderType, VoiceSettings
from src.services.asset_service import StockAssetService
from src.services.llm_service import LLMScriptGenerator
from src.services.render_service import RemotionRenderService, verify_mp4_output
from src.services.storage_service import CloudStorageService
from src.services.tts_service import TTSAudioPipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("cli-runner")


def parse_cli_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="aik-generate",
        description="End-to-End Prompt-to-Video CLI Pipeline Runner for AIK-VdGeneration.",
    )
    parser.add_argument(
        "--prompt",
        type=str,
        required=True,
        help="Topic or text prompt for the presentation video.",
    )
    parser.add_argument(
        "--lang",
        type=str,
        choices=["vi", "en"],
        default="vi",
        help="Target presentation and voiceover language ('vi' or 'en').",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="out/output.mp4",
        help="Output MP4 file path (default: out/output.mp4).",
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=45,
        help="Target approximate video duration in seconds (default: 45).",
    )
    parser.add_argument(
        "--theme",
        type=str,
        default="modern_tech",
        choices=["modern_tech", "corporate", "minimal"],
        help="Visual theme preset (default: modern_tech).",
    )
    parser.add_argument(
        "--aspect-ratio",
        type=str,
        default="16:9",
        choices=["16:9", "9:16"],
        help="Video aspect ratio ('16:9' widescreen or '9:16' vertical).",
    )
    parser.add_argument(
        "--voice-provider",
        type=str,
        default="edge_tts",
        choices=["edge_tts", "elevenlabs", "fpt"],
        help="TTS voiceover synthesis provider (default: edge_tts).",
    )
    parser.add_argument(
        "--voice-id",
        type=str,
        default=None,
        help="Optional voice identifier override (e.g. 'vi-VN-HoaiMyNeural', 'en-US-GuyNeural').",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="Optional Gemini model override (defaults to GEMINI_MODEL='gemini-3.8-flash').",
    )
    parser.add_argument(
        "--frames",
        type=str,
        default=None,
        help="Optional frame range to render (e.g. '0-29' for fast preview verification).",
    )
    parser.add_argument(
        "--skip-render",
        action="store_true",
        help="Generate script.json, audio MP3s, and remotion_props.json without running Remotion MP4 encoding.",
    )
    parser.add_argument(
        "--no-stock-visuals",
        action="store_true",
        help="Disable Unsplash/Pexels stock background fetching and use pure CSS gradient backgrounds.",
    )
    parser.add_argument(
        "--storage-provider",
        type=str,
        choices=["auto", "local", "s3", "r2"],
        default=None,
        help="Storage delivery provider override ('auto', 'local', 's3', or 'r2').",
    )
    return parser.parse_args(argv)


def run_cli_pipeline(argv: Optional[List[str]] = None) -> dict:
    """
    Executes the full M1.2 -> M1.3 -> M1.4 -> M1.5 local CLI pipeline and returns
    a summary dictionary of generated artifacts.
    """
    args = parse_cli_args(argv)
    start_time = time.time()
    job_id = f"job_cli_{uuid.uuid4().hex[:8]}"

    repo_root = GATEWAY_ROOT.parent.parent
    temp_jobs_dir = GATEWAY_ROOT / ".temp" / "jobs"
    job_dir = temp_jobs_dir / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    output_mp4_path = Path(args.output)
    if not output_mp4_path.is_absolute():
        output_mp4_path = (repo_root / output_mp4_path).resolve()

    lang: SupportedLanguage = "vi" if args.lang == "vi" else "en"
    provider: TTSProviderType = args.voice_provider

    logger.info("==============================================================")
    logger.info(" AIK-VdGeneration: End-to-End Local CLI Pipeline Runner (M1.5)")
    logger.info(" Job ID: %s | Language: %s | Aspect Ratio: %s", job_id, lang, args.aspect_ratio)
    logger.info("==============================================================")

    # Stage 1: LLM Script Generation (M1.2)
    logger.info("[1/3] Generating structured slide script via Gemini Flash...")
    llm_generator = LLMScriptGenerator()
    script, model_used = llm_generator.generate_script(
        prompt=args.prompt,
        language=lang,
        target_duration_seconds=args.duration,
        theme=args.theme,
        model_override=args.model,
    )
    script_path = job_dir / "script.json"
    script_path.write_text(
        json.dumps(script.model_dump(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    logger.info(
        "  -> Script ready: '%s' (%d slides, model: %s)",
        script.title,
        len(script.slides),
        model_used,
    )

    # Stage 2: Bilingual TTS Audio Synthesis & Frame Synchronization (M1.3)
    logger.info("[2/3] Synthesizing bilingual voiceovers & computing frame durations...")
    tts_pipeline = TTSAudioPipeline(output_base_dir=temp_jobs_dir)
    voice_settings = VoiceSettings(
        provider=provider,
        voice_id=args.voice_id,
        speed=1.0,
    )
    remotion_props, provider_used = tts_pipeline.synthesize_presentation(
        script=script,
        voice_settings=voice_settings,
        job_id=job_id,
        aspect_ratio=args.aspect_ratio,
        fps=30,
    )

    if not args.no_stock_visuals:
        asset_service = StockAssetService(output_base_dir=temp_jobs_dir)
        remotion_props = asset_service.enrich_remotion_props(
            props=remotion_props,
            script=script,
            job_id=job_id,
            aspect_ratio=args.aspect_ratio,
        )

    props_path = job_dir / "remotion_props.json"
    props_path.write_text(
        json.dumps(remotion_props.model_dump(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    logger.info(
        "  -> Audio ready: %d slides | Total duration: %.2fs (%d frames @ 30fps) via %s",
        len(remotion_props.slides),
        remotion_props.total_duration_seconds,
        remotion_props.total_frames,
        provider_used,
    )

    # Stage 3: Remotion MP4 Video Compilation (M1.4 + M1.5 + M2.4)
    rendered_mp4: Optional[Path] = None
    mp4_size_bytes: int = 0
    storage_provider: str = "local"
    video_download_url: Optional[str] = None

    if args.skip_render:
        logger.info("[3/3] Skipping Remotion MP4 encoding (--skip-render enabled).")
    else:
        logger.info("[3/3] Rendering 1080p MP4 video via Remotion Engine -> %s ...", output_mp4_path)
        renderer = RemotionRenderService()
        rendered_mp4 = renderer.render_presentation(
            props=remotion_props,
            job_id=job_id,
            output_mp4_path=output_mp4_path,
            props_json_path=props_path,
            frame_range=args.frames,
            cleanup_staging=True,
        )
        mp4_size_bytes = verify_mp4_output(rendered_mp4)
        logger.info(
            "  -> Video render complete: %s (%.1f KB)",
            rendered_mp4,
            mp4_size_bytes / 1024.0,
        )

        storage_service = CloudStorageService(provider_mode=args.storage_provider)
        delivery = storage_service.upload_video(rendered_mp4, job_id=job_id)
        storage_provider = delivery.storage_provider
        video_download_url = delivery.cdn_url or delivery.download_url
        if delivery.storage_provider != "local":
            logger.info(
                "  -> Cloud delivery ready (%s): %s",
                delivery.storage_provider.upper(),
                video_download_url,
            )

    elapsed = round(time.time() - start_time, 2)
    logger.info("==============================================================")
    logger.info(" Pipeline finished in %.2fs!", elapsed)
    logger.info("==============================================================")

    return {
        "job_id": job_id,
        "model_used": model_used,
        "voice_provider_used": provider_used,
        "script_path": str(script_path),
        "props_path": str(props_path),
        "output_video_path": str(rendered_mp4) if rendered_mp4 else None,
        "output_video_size_bytes": mp4_size_bytes,
        "storage_provider": storage_provider,
        "video_download_url": video_download_url,
        "total_frames": remotion_props.total_frames,
        "total_duration_seconds": remotion_props.total_duration_seconds,
        "elapsed_seconds": elapsed,
    }


if __name__ == "__main__":
    run_cli_pipeline()
