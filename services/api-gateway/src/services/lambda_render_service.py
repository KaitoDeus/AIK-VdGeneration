"""
Remotion Lambda Distributed Render Farm Client (Milestone M3.1).
Orchestrates parallel serverless Chrome rendering via `@remotion/lambda`
(splitting compositions into up to 50 parallel chunks) with asset URL preparation
and seamless graceful fallback to local Remotion rendering.
"""

from dataclasses import dataclass
import json
import logging
import os
from pathlib import Path
import subprocess
from typing import Callable, Optional, Tuple

from dotenv import load_dotenv

from ..schemas import LambdaStatusResponse, RemotionCompositionProps, RenderEngineType
from .storage_service import CloudStorageService

load_dotenv()

logger = logging.getLogger(__name__)

DEFAULT_LAMBDA_CHUNKS = 50
MIN_FRAMES_PER_LAMBDA = 20


def _clean_env(name: str, default: str = "") -> str:
    val = os.getenv(name, default).strip()
    if val.lower().startswith("your_"):
        return ""
    return val


@dataclass
class LambdaRenderResult:
    """Structured telemetry returned after a distributed Remotion Lambda render."""

    render_id: str
    bucket_name: str
    output_file: Optional[str]
    object_key: Optional[str]
    chunks: int
    frames_per_lambda: int
    elapsed_seconds: float


class RemotionLambdaRenderService:
    """Bridges FastAPI / RQ Workers to Remotion Lambda via CLI subprocess isolation."""

    def __init__(
        self,
        video_renderer_dir: Optional[Path] = None,
        storage_service: Optional[CloudStorageService] = None,
        render_mode: Optional[str] = None,
        region: Optional[str] = None,
        function_name: Optional[str] = None,
        serve_url: Optional[str] = None,
        bucket_name: Optional[str] = None,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        target_chunks: Optional[int] = None,
        timeout_seconds: Optional[int] = None,
        fallback_to_local: Optional[bool] = None,
    ) -> None:
        repo_root = Path(__file__).resolve().parents[4]
        self.video_renderer_dir = video_renderer_dir or (repo_root / "services" / "video-renderer")
        self.storage_service = storage_service or CloudStorageService()

        self.render_mode = (
            render_mode if render_mode is not None else os.getenv("RENDER_ENGINE", "auto")
        ).strip().lower()
        self.region = (
            region
            if region is not None
            else (_clean_env("REMOTION_AWS_REGION") or _clean_env("AWS_REGION") or "us-east-1")
        )
        self.function_name = (
            function_name if function_name is not None else _clean_env("REMOTION_LAMBDA_FUNCTION_NAME")
        )
        self.serve_url = (
            serve_url if serve_url is not None else _clean_env("REMOTION_LAMBDA_SERVE_URL")
        )
        self.bucket_name = (
            bucket_name
            if bucket_name is not None
            else (_clean_env("AWS_S3_BUCKET") or _clean_env("REMOTION_LAMBDA_BUCKET"))
        )
        self.access_key_id = (
            access_key_id if access_key_id is not None else _clean_env("AWS_ACCESS_KEY_ID")
        )
        self.secret_access_key = (
            secret_access_key
            if secret_access_key is not None
            else _clean_env("AWS_SECRET_ACCESS_KEY")
        )
        self.target_chunks = max(
            1,
            int(
                target_chunks
                if target_chunks is not None
                else (os.getenv("REMOTION_LAMBDA_MAX_CHUNKS", str(DEFAULT_LAMBDA_CHUNKS)) or DEFAULT_LAMBDA_CHUNKS)
            ),
        )
        self.timeout_seconds = max(
            30,
            int(
                timeout_seconds
                if timeout_seconds is not None
                else (os.getenv("REMOTION_LAMBDA_TIMEOUT_SECONDS", "240") or "240")
            ),
        )
        self.fallback_to_local = (
            fallback_to_local
            if fallback_to_local is not None
            else os.getenv("REMOTION_LAMBDA_FALLBACK_TO_LOCAL", "true").strip().lower() == "true"
        )

    def is_configured(self) -> bool:
        """True when Lambda function, S3 site bundle serve URL, and AWS credentials are present."""
        return bool(
            self.function_name
            and self.serve_url
            and self.access_key_id
            and self.secret_access_key
        )

    def resolve_active_engine(self, engine_override: Optional[str] = None) -> RenderEngineType:
        """Selects `'lambda'` when active and configured; safely returns `'local'` otherwise."""
        mode = (engine_override or self.render_mode or "auto").strip().lower()
        if mode == "local":
            return "local"
        if mode == "lambda":
            return "lambda" if self.is_configured() else "local"
        return "lambda" if self.is_configured() else "local"

    def get_status(self) -> LambdaStatusResponse:
        return LambdaStatusResponse(
            render_engine_mode=self.render_mode,
            active_render_engine=self.resolve_active_engine(),
            lambda_configured=self.is_configured(),
            region=self.region,
            target_chunks=self.target_chunks,
            function_name=self.function_name or None,
            serve_url_configured=bool(self.serve_url),
        )

    @staticmethod
    def compute_chunk_plan(
        total_frames: int,
        target_chunks: int = DEFAULT_LAMBDA_CHUNKS,
        explicit_frames_per_lambda: Optional[int] = None,
    ) -> Tuple[int, int]:
        """
        Calculates `(frames_per_lambda, estimated_chunks)` splitting the video across
        up to `target_chunks` (default 50) parallel AWS Lambda workers.
        """
        safe_total = max(90, int(total_frames or 90))
        safe_chunks = max(1, min(200, int(target_chunks or DEFAULT_LAMBDA_CHUNKS)))

        if explicit_frames_per_lambda and explicit_frames_per_lambda >= MIN_FRAMES_PER_LAMBDA:
            frames_per_lambda = int(explicit_frames_per_lambda)
        else:
            frames_per_lambda = max(MIN_FRAMES_PER_LAMBDA, -(-safe_total // safe_chunks))

        estimated_chunks = max(1, -(-safe_total // frames_per_lambda))
        return frames_per_lambda, estimated_chunks

    def prepare_lambda_props(
        self,
        props: RemotionCompositionProps,
        job_id: str,
    ) -> RemotionCompositionProps:
        """
        Uploads local slide audio/image assets to S3/R2 when cloud storage is enabled
        so stateless AWS Lambda workers can stream HTTPS media URLs directly.
        """
        if self.storage_service.resolve_provider() == "local":
            return props

        client = self.storage_service._get_client()
        updated_slides = []

        for slide in props.slides:
            updates: dict = {}

            audio_path = Path(slide.voiceover_audio_path) if slide.voiceover_audio_path else None
            if audio_path and audio_path.exists():
                audio_key = self.storage_service.build_object_key(job_id, filename=audio_path.name)
                client.upload_file(
                    str(audio_path),
                    self.storage_service.bucket_name,
                    audio_key,
                    ExtraArgs={"ContentType": "audio/mpeg"},
                )
                updates["voiceover_audio_url"] = self.storage_service.create_presigned_download_url(
                    job_id=job_id,
                    object_key=audio_key,
                    filename=audio_path.name,
                ).download_url

            bg_path = Path(slide.background_image_path) if slide.background_image_path else None
            if bg_path and bg_path.exists():
                ext = bg_path.suffix.lower()
                mime = "image/png" if ext == ".png" else "image/webp" if ext == ".webp" else "image/jpeg"
                bg_key = self.storage_service.build_object_key(job_id, filename=bg_path.name)
                client.upload_file(
                    str(bg_path),
                    self.storage_service.bucket_name,
                    bg_key,
                    ExtraArgs={"ContentType": mime},
                )
                updates["background_image_url"] = self.storage_service.create_presigned_download_url(
                    job_id=job_id,
                    object_key=bg_key,
                    filename=bg_path.name,
                ).download_url

            updated_slides.append(slide.model_copy(update=updates) if updates else slide)

        return props.model_copy(update={"slides": updated_slides})

    def build_lambda_command(
        self,
        props_file: Path,
        job_id: str,
        frames_per_lambda: int,
    ) -> list[str]:
        script_path = self.video_renderer_dir / "scripts" / "lambda-render.mjs"
        return [
            "node",
            str(script_path.resolve()),
            "--props",
            str(props_file.resolve()),
            "--job-id",
            job_id,
            "--frames-per-lambda",
            str(frames_per_lambda),
            "--target-chunks",
            str(self.target_chunks),
        ]

    @staticmethod
    def parse_lambda_result(stdout: str) -> LambdaRenderResult:
        """Extracts structured `RESULT_JSON:{...}` payload emitted by `lambda-render.mjs`."""
        for line in reversed((stdout or "").splitlines()):
            line = line.strip()
            if line.startswith("RESULT_JSON:"):
                payload = json.loads(line.split("RESULT_JSON:", 1)[1])
                return LambdaRenderResult(
                    render_id=str(payload["renderId"]),
                    bucket_name=str(payload.get("bucketName", "")),
                    output_file=payload.get("outputFile"),
                    object_key=payload.get("outKey"),
                    chunks=int(payload.get("chunks", 1)),
                    frames_per_lambda=int(payload.get("framesPerLambda", MIN_FRAMES_PER_LAMBDA)),
                    elapsed_seconds=float(payload.get("elapsedSeconds", 0.0)),
                )
        raise ValueError("Remotion Lambda runner did not emit a valid RESULT_JSON payload.")

    def render_on_lambda(
        self,
        props: RemotionCompositionProps,
        job_id: str,
        props_json_path: Path,
        progress_callback: Optional[Callable[[int, str], None]] = None,
    ) -> LambdaRenderResult:
        """Executes distributed chunk rendering on AWS Lambda via `@remotion/lambda`."""
        if not self.is_configured():
            raise RuntimeError(
                "Remotion Lambda is not configured (missing AWS creds, REMOTION_LAMBDA_FUNCTION_NAME, or REMOTION_LAMBDA_SERVE_URL)."
            )

        lambda_props = self.prepare_lambda_props(props, job_id)
        lambda_props_path = props_json_path.parent / f"{job_id}_lambda_props.json"
        lambda_props_path.write_text(
            json.dumps(lambda_props.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        frames_per_lambda, est_chunks = self.compute_chunk_plan(
            lambda_props.total_frames,
            target_chunks=self.target_chunks,
        )
        if progress_callback:
            progress_callback(
                92,
                f"Dispatching {lambda_props.total_frames} frames across {est_chunks} Remotion Lambda chunks... (92%)",
            )

        cmd = self.build_lambda_command(
            props_file=lambda_props_path,
            job_id=job_id,
            frames_per_lambda=frames_per_lambda,
        )

        env = os.environ.copy()
        env["REMOTION_AWS_REGION"] = self.region
        env["REMOTION_LAMBDA_FUNCTION_NAME"] = self.function_name
        env["REMOTION_LAMBDA_SERVE_URL"] = self.serve_url
        if self.bucket_name:
            env["AWS_S3_BUCKET"] = self.bucket_name

        result = subprocess.run(
            cmd,
            cwd=str(self.video_renderer_dir),
            env=env,
            capture_output=True,
            text=True,
            timeout=self.timeout_seconds,
            check=False,
        )
        if result.returncode != 0:
            err = (result.stderr or result.stdout or "").strip()
            raise RuntimeError(f"Remotion Lambda exited with code {result.returncode}: {err}")

        parsed = self.parse_lambda_result(result.stdout)
        logger.info(
            "Job %s [Lambda] Render '%s' completed across %d chunks in %.2fs",
            job_id,
            parsed.render_id,
            parsed.chunks,
            parsed.elapsed_seconds,
        )
        return parsed
