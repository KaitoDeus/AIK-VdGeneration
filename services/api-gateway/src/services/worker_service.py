"""
Dedicated Asynchronous Stage Workers & Pipeline Coordinator (Milestone M2.1).
Implements modular workers matching docs/ARCHITECTURE.md:
  - LLMWorker: Prompt -> Structured PresentationScript JSON
  - TTSWorker: Bilingual MP3 Synthesis & Frame Synchronization -> RemotionCompositionProps
  - RenderWorker: Stateless Remotion CLI Compilation -> 1080p MP4
Supports multi-stage distributed queue consumption, up to 3 automatic retries,
dead-letter queue (DLQ) routing, and realtime WebSocket progress broadcasting.
"""

import json
import logging
from pathlib import Path
import threading
import time
from typing import Dict, Optional, Sequence

from ..schemas import (
    JobStatusResponse,
    PresentationScript,
    QueueTaskPayload,
    RemotionCompositionProps,
    WorkerStage,
)
from .asset_service import StockAssetService
from .bgm_service import BGMService
from .lambda_render_service import RemotionLambdaRenderService
from .llm_service import LLMScriptGenerator
from .queue_service import BaseQueueBackend, STAGES_ORDER, utc_timestamp
from .render_service import RemotionRenderService
from .storage_service import CloudStorageService
from .tts_service import TTSAudioPipeline

logger = logging.getLogger(__name__)


class BaseStageWorker:
    """Base interface for an individual pipeline stage worker."""

    stage: WorkerStage

    def execute(
        self,
        task: QueueTaskPayload,
        job: JobStatusResponse,
        job_dir: Path,
        queue_backend: BaseQueueBackend,
    ) -> Optional[WorkerStage]:
        """Executes this stage and returns the next WorkerStage or None if complete."""
        raise NotImplementedError


class LLMWorker(BaseStageWorker):
    """Stage 1 Worker: Generates and validates structured slide scripts via Gemini 3.8 Flash."""

    stage: WorkerStage = "llm"

    def __init__(self, llm_generator: LLMScriptGenerator) -> None:
        self.llm_generator = llm_generator

    def execute(
        self,
        task: QueueTaskPayload,
        job: JobStatusResponse,
        job_dir: Path,
        queue_backend: BaseQueueBackend,
    ) -> Optional[WorkerStage]:
        job.status = "generating_script"
        job.current_stage = "llm"
        job.progress_percentage = 20
        queue_backend.save_job(job)
        queue_backend.emit_progress(
            job_id=job.job_id,
            step="generating_script",
            progress_percentage=20,
            message="Generating structured presentation script with Gemini... (20%)",
        )

        script, model_used = self.llm_generator.generate_script(
            prompt=task.request.prompt,
            language=task.request.language,
            target_duration_seconds=task.request.target_duration_seconds,
            theme=task.request.style.theme,
            model_override=task.request.model,
        )

        job_dir.mkdir(parents=True, exist_ok=True)
        script_path = job_dir / "script.json"
        script_path.write_text(
            json.dumps(script.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        job.script = script
        job.model_used = model_used
        job.status = "script_ready"
        job.progress_percentage = 40
        queue_backend.save_job(job)
        queue_backend.emit_progress(
            job_id=job.job_id,
            step="script_ready",
            progress_percentage=40,
            message=f"Slide script validated ({len(script.slides)} slides via {model_used}). (40%)",
        )
        logger.info("Job %s [LLMWorker] script ready via %s -> %s", job.job_id, model_used, script_path)
        return "tts"


class TTSWorker(BaseStageWorker):
    """Stage 2 Worker: Synthesizes bilingual voiceover audio, resolves stock visuals, and compiles Remotion props."""

    stage: WorkerStage = "tts"

    def __init__(
        self,
        tts_pipeline: TTSAudioPipeline,
        asset_service: Optional[StockAssetService] = None,
        bgm_service: Optional[BGMService] = None,
    ) -> None:
        self.tts_pipeline = tts_pipeline
        self.asset_service = asset_service
        self.bgm_service = bgm_service

    def execute(
        self,
        task: QueueTaskPayload,
        job: JobStatusResponse,
        job_dir: Path,
        queue_backend: BaseQueueBackend,
    ) -> Optional[WorkerStage]:
        script = job.script
        if script is None:
            script_path = job_dir / "script.json"
            if not script_path.exists():
                raise FileNotFoundError(f"Missing script artifact for job '{job.job_id}' at {script_path}")
            script = PresentationScript.model_validate_json(script_path.read_text(encoding="utf-8"))

        job.status = "synthesizing_audio"
        job.current_stage = "tts"
        job.progress_percentage = 60
        queue_backend.save_job(job)
        queue_backend.emit_progress(
            job_id=job.job_id,
            step="synthesizing_audio",
            progress_percentage=60,
            message="Synthesizing bilingual voiceovers and fetching slide visuals... (60%)",
        )

        remotion_props, provider_used = self.tts_pipeline.synthesize_presentation(
            script=script,
            voice_settings=task.request.voice_settings,
            job_id=job.job_id,
            aspect_ratio=task.request.aspect_ratio,
            fps=30,
        )

        # MediaPool AssetWorker step (M2.3): Enrich slides with stock photography or fallback cleanly
        if self.asset_service and (task.request.include_stock_visuals or task.slide_backgrounds):
            remotion_props = self.asset_service.enrich_remotion_props(
                props=remotion_props,
                script=script,
                job_id=job.job_id,
                aspect_ratio=task.request.aspect_ratio,
                slide_backgrounds=task.slide_backgrounds,
            )

        # Sound Design & BGM Ducking (M3.2): Resolve royalty-free mood loop when enabled
        if self.bgm_service and task.request.bgm_settings and task.request.bgm_settings.enabled:
            bgm_props = self.bgm_service.compile_bgm_props(task.request.bgm_settings, job_id=job.job_id)
            remotion_props = remotion_props.model_copy(update={"bgm": bgm_props})

        job_dir.mkdir(parents=True, exist_ok=True)
        props_path = job_dir / "remotion_props.json"
        props_path.write_text(
            json.dumps(remotion_props.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        job.remotion_props = remotion_props
        job.voice_provider_used = provider_used
        job.status = "audio_ready"
        job.progress_percentage = 80
        if not task.request.render_video:
            job.current_stage = None
        queue_backend.save_job(job)
        queue_backend.emit_progress(
            job_id=job.job_id,
            step="audio_ready",
            progress_percentage=80,
            message=(
                f"Voiceover synthesis complete ({remotion_props.total_frames} frames, "
                f"{remotion_props.total_duration_seconds:.1f}s via {provider_used}). (80%)"
            ),
        )
        logger.info(
            "Job %s [TTSWorker] audio ready (%d frames, %.2fs) via %s -> %s",
            job.job_id,
            remotion_props.total_frames,
            remotion_props.total_duration_seconds,
            provider_used,
            props_path,
        )

        return "render" if task.request.render_video else None


class RenderWorker(BaseStageWorker):
    """
    Stage 3 Worker: Executes Remotion compilation (distributed AWS Lambda farm when configured,
    or local stateless Remotion CLI) and persists final MP4 delivery URLs.
    """

    stage: WorkerStage = "render"

    def __init__(
        self,
        render_service: RemotionRenderService,
        storage_service: Optional[CloudStorageService] = None,
        lambda_service: Optional[RemotionLambdaRenderService] = None,
    ) -> None:
        self.render_service = render_service
        self.storage_service = storage_service or CloudStorageService()
        self.lambda_service = lambda_service or RemotionLambdaRenderService(
            video_renderer_dir=getattr(self.render_service, "video_renderer_dir", None),
            storage_service=self.storage_service,
        )

    def _finish_local_render(
        self,
        props: RemotionCompositionProps,
        job: JobStatusResponse,
        job_dir: Path,
        props_path: Path,
        queue_backend: BaseQueueBackend,
    ) -> None:
        output_mp4 = job_dir / f"{job.job_id}.mp4"
        rendered_path = self.render_service.render_presentation(
            props=props,
            job_id=job.job_id,
            output_mp4_path=output_mp4,
            props_json_path=props_path,
        )

        if self.storage_service.resolve_provider() in ("s3", "r2"):
            job.progress_percentage = 96
            queue_backend.save_job(job)
            queue_backend.emit_progress(
                job_id=job.job_id,
                step="uploading_video",
                progress_percentage=96,
                message=(
                    f"Uploading 1080p MP4 to {self.storage_service.resolve_provider().upper()} "
                    "storage & signing download URL... (96%)"
                ),
            )

        delivery = self.storage_service.upload_video(rendered_path, job_id=job.job_id)

        job.output_video_path = str(rendered_path)
        job.render_engine_used = "local"
        job.storage_provider = delivery.storage_provider
        job.storage_object_key = delivery.object_key
        job.video_download_url = delivery.cdn_url or delivery.download_url
        job.signed_url_expires_in_seconds = delivery.expires_in_seconds
        job.status = "completed"
        job.current_stage = None
        job.progress_percentage = 100
        queue_backend.save_job(job)
        queue_backend.emit_progress(
            job_id=job.job_id,
            step="completed",
            progress_percentage=100,
            message=(
                f"Video rendering complete via {delivery.storage_provider.upper()} storage "
                "and ready for playback! (100%)"
            ),
        )
        logger.info(
            "Job %s [RenderWorker] completed local render (%s) -> %s",
            job.job_id,
            delivery.storage_provider,
            rendered_path,
        )

    def execute(
        self,
        task: QueueTaskPayload,
        job: JobStatusResponse,
        job_dir: Path,
        queue_backend: BaseQueueBackend,
    ) -> Optional[WorkerStage]:
        props = job.remotion_props
        props_path = job_dir / "remotion_props.json"
        if props is None:
            if not props_path.exists():
                raise FileNotFoundError(
                    f"Missing remotion_props.json artifact for job '{job.job_id}' at {props_path}"
                )
            props = RemotionCompositionProps.model_validate_json(
                props_path.read_text(encoding="utf-8")
            )

        job.status = "rendering_video"
        job.current_stage = "render"
        job.progress_percentage = 90
        queue_backend.save_job(job)
        queue_backend.emit_progress(
            job_id=job.job_id,
            step="rendering_video",
            progress_percentage=90,
            message="Rendering 1080p video frames via Remotion Engine... (90%)",
        )

        if self.lambda_service.resolve_active_engine() == "lambda":
            try:
                def _on_lambda_progress(pct: int, msg: str) -> None:
                    job.progress_percentage = pct
                    queue_backend.save_job(job)
                    queue_backend.emit_progress(
                        job_id=job.job_id,
                        step="rendering_video",
                        progress_percentage=pct,
                        message=msg,
                    )

                lambda_result = self.lambda_service.render_on_lambda(
                    props=props,
                    job_id=job.job_id,
                    props_json_path=props_path,
                    progress_callback=_on_lambda_progress,
                )
                object_key = lambda_result.object_key or self.storage_service.build_object_key(job.job_id)
                delivery = self.storage_service.create_presigned_download_url(
                    job_id=job.job_id,
                    object_key=object_key,
                )

                job.render_engine_used = "lambda"
                job.lambda_render_id = lambda_result.render_id
                job.lambda_chunks_count = lambda_result.chunks
                job.storage_provider = "s3" if delivery.storage_provider == "local" else delivery.storage_provider
                job.storage_object_key = object_key
                job.video_download_url = (
                    delivery.cdn_url
                    or (delivery.download_url if delivery.download_url.startswith("http") else None)
                    or lambda_result.output_file
                )
                job.signed_url_expires_in_seconds = delivery.expires_in_seconds
                job.status = "completed"
                job.current_stage = None
                job.progress_percentage = 100
                queue_backend.save_job(job)
                queue_backend.emit_progress(
                    job_id=job.job_id,
                    step="completed",
                    progress_percentage=100,
                    message=(
                        f"Distributed Remotion Lambda render complete ({lambda_result.chunks} chunks in "
                        f"{lambda_result.elapsed_seconds:.1f}s)! (100%)"
                    ),
                )
                return None
            except Exception as exc:
                if not self.lambda_service.fallback_to_local:
                    raise
                logger.warning(
                    "Job %s [RenderWorker] Remotion Lambda failed (%s); falling back to local Remotion CLI.",
                    job.job_id,
                    exc,
                )

        self._finish_local_render(
            props=props,
            job=job,
            job_dir=job_dir,
            props_path=props_path,
            queue_backend=queue_backend,
        )
        return None


class PipelineWorkerCoordinator:
    """
    Coordinates stage workers (`llm`, `tts`, `render`), handles retries up to `max_retries` (3),
    Dead-Letter Queue (DLQ) routing, and both standalone queue consumption & inline execution.
    """

    def __init__(
        self,
        queue_backend: BaseQueueBackend,
        temp_jobs_dir: Path,
        llm_generator: Optional[LLMScriptGenerator] = None,
        tts_pipeline: Optional[TTSAudioPipeline] = None,
        render_service: Optional[RemotionRenderService] = None,
        asset_service: Optional[StockAssetService] = None,
        storage_service: Optional[CloudStorageService] = None,
        lambda_service: Optional[RemotionLambdaRenderService] = None,
        bgm_service: Optional[BGMService] = None,
        retry_delay_seconds: float = 0.0,
    ) -> None:
        self.queue_backend = queue_backend
        self.temp_jobs_dir = temp_jobs_dir
        self.retry_delay_seconds = retry_delay_seconds

        active_storage = storage_service or CloudStorageService()
        active_renderer = render_service or RemotionRenderService()
        active_lambda = lambda_service or RemotionLambdaRenderService(
            video_renderer_dir=getattr(active_renderer, "video_renderer_dir", None),
            storage_service=active_storage,
        )

        self.llm_worker = LLMWorker(llm_generator or LLMScriptGenerator())
        self.tts_worker = TTSWorker(
            tts_pipeline or TTSAudioPipeline(output_base_dir=temp_jobs_dir),
            asset_service=asset_service or StockAssetService(output_base_dir=temp_jobs_dir),
            bgm_service=bgm_service or BGMService(output_base_dir=temp_jobs_dir),
        )
        self.render_worker = RenderWorker(
            active_renderer,
            storage_service=active_storage,
            lambda_service=active_lambda,
        )

        self.workers: Dict[WorkerStage, BaseStageWorker] = {
            "llm": self.llm_worker,
            "tts": self.tts_worker,
            "render": self.render_worker,
        }

    def process_task(
        self,
        task: QueueTaskPayload,
        auto_enqueue_next: bool = True,
    ) -> Optional[QueueTaskPayload]:
        """
        Executes a single QueueTaskPayload on its corresponding stage worker.

        Returns:
            Optional[QueueTaskPayload]: The next stage task (or retry task), or None if finished/failed.
        """
        job = self.queue_backend.get_job(task.job_id)
        if job is None:
            job = JobStatusResponse(
                job_id=task.job_id,
                status="queued",
                progress_percentage=0,
                current_stage=task.stage,
                render_requested=task.request.render_video,
            )
            self.queue_backend.save_job(job)

        worker = self.workers[task.stage]
        job_dir = self.temp_jobs_dir / task.job_id

        try:
            next_stage = worker.execute(task, job, job_dir, self.queue_backend)
            if next_stage is None:
                return None

            next_task = QueueTaskPayload(
                job_id=task.job_id,
                stage=next_stage,
                request=task.request,
                attempt=1,
                max_retries=task.max_retries,
                created_at=utc_timestamp(),
            )
            if auto_enqueue_next:
                self.queue_backend.enqueue_task(next_task)
            return next_task

        except Exception as exc:
            logger.warning(
                "Job %s stage '%s' failed (attempt %d/%d): %s",
                task.job_id,
                task.stage,
                task.attempt,
                task.max_retries,
                exc,
            )
            if task.attempt < task.max_retries:
                job.retry_count += 1
                self.queue_backend.save_job(job)
                self.queue_backend.emit_progress(
                    job_id=job.job_id,
                    step="retrying",
                    progress_percentage=job.progress_percentage,
                    message=(
                        f"Retrying stage '{task.stage}' "
                        f"(attempt {task.attempt + 1}/{task.max_retries})..."
                    ),
                )
                retry_task = QueueTaskPayload(
                    job_id=task.job_id,
                    stage=task.stage,
                    request=task.request,
                    attempt=task.attempt + 1,
                    max_retries=task.max_retries,
                    created_at=utc_timestamp(),
                )
                if self.retry_delay_seconds > 0:
                    time.sleep(self.retry_delay_seconds)
                if auto_enqueue_next:
                    self.queue_backend.enqueue_task(retry_task)
                return retry_task

            # Retries exhausted: mark job failed and move to Dead-Letter Queue
            job.status = "failed"
            job.current_stage = None
            job.error = str(exc)
            self.queue_backend.save_job(job)
            self.queue_backend.push_dead_letter(task, str(exc))
            self.queue_backend.emit_progress(
                job_id=job.job_id,
                step="failed",
                progress_percentage=job.progress_percentage,
                message=f"Pipeline failed at stage '{task.stage}' after {task.max_retries} attempts: {exc}",
            )
            return None

    def run_once(
        self,
        stages: Sequence[WorkerStage] = STAGES_ORDER,
        timeout_seconds: int = 1,
    ) -> bool:
        """Consumes and processes at most one queued task. Returns True if a task was processed."""
        task = self.queue_backend.dequeue_task(stages=stages, timeout_seconds=timeout_seconds)
        if task is None:
            return False
        self.process_task(task, auto_enqueue_next=True)
        return True

    def drain_all(
        self,
        stages: Sequence[WorkerStage] = STAGES_ORDER,
        max_iterations: int = 50,
    ) -> int:
        """Processes all currently queued tasks (and their downstream stages) until queues are empty."""
        processed = 0
        while processed < max_iterations:
            if not self.run_once(stages=stages, timeout_seconds=0):
                break
            processed += 1
        return processed

    def run_forever(
        self,
        stages: Sequence[WorkerStage] = STAGES_ORDER,
        poll_timeout: int = 1,
        stop_event: Optional[threading.Event] = None,
    ) -> None:
        """Blocking worker loop for standalone dedicated worker processes."""
        logger.info("Worker loop started. Listening on stages: %s", ", ".join(stages))
        while not (stop_event and stop_event.is_set()):
            try:
                self.run_once(stages=stages, timeout_seconds=poll_timeout)
            except Exception as exc:
                logger.exception("Unexpected error in worker loop: %s", exc)
                time.sleep(0.5)
        logger.info("Worker loop stopped cleanly.")

    def run_inline_pipeline(self, task: QueueTaskPayload) -> None:
        """
        Executes a job end-to-end inside FastAPI BackgroundTasks when no external
        worker daemon is deployed, preserving identical stage/retry/WebSocket behavior.
        """
        current_task: Optional[QueueTaskPayload] = task
        while current_task is not None:
            current_task = self.process_task(current_task, auto_enqueue_next=False)
