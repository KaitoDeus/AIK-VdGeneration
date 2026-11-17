"""
AIK-VdGeneration: Main API Gateway & Asynchronous Orchestrator (Phase 2 - M2.1)
FastAPI service exposing prompt-to-script, script-to-audio, queued video generation,
queue telemetry, and realtime WebSocket job progress endpoints.
"""

import logging
import os
from pathlib import Path
from typing import Dict, List
import uuid

from dotenv import load_dotenv
from fastapi import (
    BackgroundTasks,
    FastAPI,
    HTTPException,
    Request,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware

try:
    from .schemas import (
        AudioSynthesizeRequest,
        JobStatusResponse,
        PresentationScript,
        QueueStatsResponse,
        QueueTaskPayload,
        RemotionCompositionProps,
        ScriptGenerateRequest,
        VideoGenerateRequest,
        VideoJobResponse,
    )
    from .services.llm_service import LLMScriptGenerator
    from .services.queue_service import (
        BaseQueueBackend,
        create_queue_backend,
        utc_timestamp,
    )
    from .services.render_service import RemotionRenderService
    from .services.tts_service import TTSAudioPipeline
    from .services.worker_service import PipelineWorkerCoordinator
except ImportError:
    from schemas import (  # type: ignore
        AudioSynthesizeRequest,
        JobStatusResponse,
        PresentationScript,
        QueueStatsResponse,
        QueueTaskPayload,
        RemotionCompositionProps,
        ScriptGenerateRequest,
        VideoGenerateRequest,
        VideoJobResponse,
    )
    from services.llm_service import LLMScriptGenerator  # type: ignore
    from services.queue_service import (  # type: ignore
        BaseQueueBackend,
        create_queue_backend,
        utc_timestamp,
    )
    from services.render_service import RemotionRenderService  # type: ignore
    from services.tts_service import TTSAudioPipeline  # type: ignore
    from services.worker_service import PipelineWorkerCoordinator  # type: ignore

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("api-gateway")

app = FastAPI(
    title="AIK-VdGeneration API Gateway",
    version="0.5.0",
    description=(
        "Automated presentation video generation from prompts with Gemini 3.8 Flash, "
        "bilingual TTS, Remotion rendering, and Redis/WebSocket async orchestration."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Shared job store & temporary job artifacts directory
JOBS_STORE: Dict[str, JobStatusResponse] = {}
TEMP_JOBS_DIR = Path(__file__).resolve().parent.parent / ".temp" / "jobs"

llm_generator = LLMScriptGenerator()
tts_pipeline = TTSAudioPipeline(output_base_dir=TEMP_JOBS_DIR)
render_service = RemotionRenderService()

queue_backend: BaseQueueBackend = create_queue_backend(shared_jobs_store=JOBS_STORE)
worker_coordinator = PipelineWorkerCoordinator(
    queue_backend=queue_backend,
    temp_jobs_dir=TEMP_JOBS_DIR,
    llm_generator=llm_generator,
    tts_pipeline=tts_pipeline,
    render_service=render_service,
)


def configure_queue_backend(new_backend: BaseQueueBackend) -> None:
    """Rebinds the active queue backend and worker coordinator (used in tests & lifecycle hooks)."""
    global queue_backend, worker_coordinator
    queue_backend = new_backend
    worker_coordinator = PipelineWorkerCoordinator(
        queue_backend=new_backend,
        temp_jobs_dir=TEMP_JOBS_DIR,
        llm_generator=llm_generator,
        tts_pipeline=tts_pipeline,
        render_service=render_service,
    )


def _should_dispatch_to_external_worker() -> bool:
    """Determines whether jobs should stay in Redis queues for external `src.worker` consumption."""
    external_flag = os.getenv("USE_EXTERNAL_WORKER", "false").strip().lower() == "true"
    return queue_backend.backend_name == "redis" and external_flag


@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "AIK-VdGeneration API Gateway",
        "version": app.version,
        "queue_backend": queue_backend.backend_name,
        "external_worker_enabled": _should_dispatch_to_external_worker(),
        "default_llm_model": llm_generator.default_model,
        "fallback_llm_model": llm_generator.fallback_model,
        "supported_tts_providers": ["edge_tts", "elevenlabs", "fpt"],
    }


@app.get("/api/v1/queue/stats", response_model=QueueStatsResponse)
async def get_queue_stats():
    """Returns live stage queue depths, DLQ counts, and Redis connectivity telemetry."""
    return queue_backend.get_stats()


@app.post("/api/v1/scripts/generate", response_model=PresentationScript)
async def generate_script_endpoint(request: ScriptGenerateRequest):
    """
    Synchronous endpoint (M1.2) that converts a user prompt into a strictly validated
    multi-slide PresentationScript JSON using Gemini Flash Structured Outputs.
    """
    try:
        script, _ = llm_generator.generate_script(
            prompt=request.prompt,
            language=request.language,
            target_duration_seconds=request.target_duration_seconds,
            theme=request.theme,
            model_override=request.model,
        )
        return script
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/v1/audio/synthesize", response_model=RemotionCompositionProps)
async def synthesize_audio_endpoint(request: AudioSynthesizeRequest):
    """
    Synchronous endpoint (M1.3) that synthesizes bilingual slide voiceovers, extracts
    exact MP3 durations, and compiles RemotionCompositionProps with dynamic frame math.
    """
    job_id = request.job_id or f"job_{uuid.uuid4().hex[:12]}"
    try:
        props, _ = tts_pipeline.synthesize_presentation(
            script=request.script,
            voice_settings=request.voice_settings,
            job_id=job_id,
            aspect_ratio=request.aspect_ratio,
            fps=request.fps,
        )
        return props
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/v1/videos/generate", response_model=VideoJobResponse, status_code=202)
async def generate_video(
    request: VideoGenerateRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
):
    """
    Asynchronous orchestrator endpoint. Immediately returns a job_id (HTTP 202)
    and dispatches the LLM -> TTS -> Remotion pipeline to either external Redis workers
    or in-process BackgroundTasks.
    """
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    max_retries = int(os.getenv("MAX_JOB_RETRIES", "3"))

    initial_job = JobStatusResponse(
        job_id=job_id,
        status="queued",
        progress_percentage=0,
        current_stage="llm",
        render_requested=request.render_video,
    )
    queue_backend.save_job(initial_job)
    queue_backend.emit_progress(
        job_id=job_id,
        step="queued",
        progress_percentage=0,
        message="Video generation job queued for processing. (0%)",
    )

    initial_task = QueueTaskPayload(
        job_id=job_id,
        stage="llm",
        request=request,
        attempt=1,
        max_retries=max_retries,
        created_at=utc_timestamp(),
    )

    if _should_dispatch_to_external_worker():
        queue_backend.enqueue_task(initial_task)
    else:
        background_tasks.add_task(worker_coordinator.run_inline_pipeline, initial_task)

    ws_scheme = "wss" if http_request.url.scheme == "https" else "ws"
    host = http_request.headers.get("host") or f"localhost:{os.getenv('PORT', '8000')}"
    websocket_url = f"{ws_scheme}://{host}/ws/jobs/{job_id}"

    return VideoJobResponse(
        job_id=job_id,
        status="queued",
        estimated_time_seconds=45,
        websocket_url=websocket_url,
        message="Video generation job accepted and enqueued for processing.",
    )


@app.get("/api/v1/jobs", response_model=List[JobStatusResponse])
async def list_jobs(limit: int = 20):
    """Lists recent video generation jobs."""
    return queue_backend.list_jobs(limit=max(1, min(100, limit)))


@app.get("/api/v1/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """Retrieve current status, progress percentage, generated script, and Remotion props for a job."""
    job = queue_backend.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return job


@app.websocket("/ws/jobs/{job_id}")
async def job_progress_websocket(websocket: WebSocket, job_id: str):
    """
    Realtime WebSocket progress tracker conforming to docs/API_SPEC.md Section 4.
    Replays recorded progress events and streams live updates until job completion.
    """
    await websocket.accept()

    job = queue_backend.get_job(job_id)
    if not job:
        await websocket.send_json(
            {
                "job_id": job_id,
                "step": "error",
                "progress_percentage": 0,
                "message": f"Job '{job_id}' not found.",
                "timestamp": utc_timestamp(),
            }
        )
        await websocket.close(code=4404)
        return

    try:
        async for event in queue_backend.stream_progress(job_id):
            await websocket.send_json(event.model_dump())
    except WebSocketDisconnect:
        logger.debug("WebSocket client disconnected from job %s", job_id)
    except Exception as exc:
        logger.warning("WebSocket stream error for job %s: %s", job_id, exc)
    finally:
        try:
            await websocket.close()
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("src.main:app", host="0.0.0.0", port=port, reload=True)
