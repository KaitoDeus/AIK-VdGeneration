"""
AIK-VdGeneration: Main API Gateway & Asynchronous Orchestrator (Phase 2 - M2.1)
FastAPI service exposing prompt-to-script, script-to-audio, queued video generation,
queue telemetry, and realtime WebSocket job progress endpoints.
"""

import json
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
from fastapi.responses import FileResponse

try:
    from .schemas import (
        AudioSynthesizeRequest,
        JobStatusResponse,
        PresentationScript,
        QueueStatsResponse,
        QueueTaskPayload,
        RemotionCompositionProps,
        ScriptCompileRequest,
        ScriptGenerateRequest,
        StyleSettings,
        VideoGenerateRequest,
        VideoJobResponse,
        VoiceOption,
        VoicePreviewRequest,
        VoiceSettings,
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
        ScriptCompileRequest,
        ScriptGenerateRequest,
        StyleSettings,
        VideoGenerateRequest,
        VideoJobResponse,
        VoiceOption,
        VoicePreviewRequest,
        VoiceSettings,
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


VOICE_CATALOG: List[VoiceOption] = [
    VoiceOption(
        voice_id="vi-VN-HoaiMyNeural",
        label="Hoài My (Northern Female)",
        language="vi",
        provider="edge_tts",
        gender="female",
        sample_text="Xin chào, đây là giọng đọc AI tiếng Việt tự nhiên từ AIK Studio.",
    ),
    VoiceOption(
        voice_id="vi-VN-NamMinhNeural",
        label="Nam Minh (Northern Male)",
        language="vi",
        provider="edge_tts",
        gender="male",
        sample_text="Chào mừng bạn đến với nền tảng tạo video thuyết trình tự động.",
    ),
    VoiceOption(
        voice_id="en-US-GuyNeural",
        label="Guy (US Natural Male)",
        language="en",
        provider="edge_tts",
        gender="male",
        sample_text="Welcome to AIK Studio. Transform any prompt into a synchronized presentation video.",
    ),
    VoiceOption(
        voice_id="en-US-JennyNeural",
        label="Jenny (US Expressive Female)",
        language="en",
        provider="edge_tts",
        gender="female",
        sample_text="Audio drives the timeline with precision frame synchronization.",
    ),
    VoiceOption(
        voice_id="21m00Tcm4TlvDq8ikWAM",
        label="Rachel (ElevenLabs Multilingual)",
        language="en",
        provider="elevenlabs",
        gender="female",
        sample_text="Studio grade emotional voiceover powered by ElevenLabs Multilingual v2.",
    ),
]


@app.get("/api/v1/voices", response_model=List[VoiceOption])
async def list_voices(language: str | None = None):
    """Returns supported bilingual voiceover presets for Web Studio."""
    if language in ("vi", "en"):
        return [v for v in VOICE_CATALOG if v.language == language or v.provider == "elevenlabs"]
    return VOICE_CATALOG


@app.post("/api/v1/voices/preview")
async def preview_voice(request: VoicePreviewRequest):
    """Synthesizes or retrieves a cached voice audition MP3 sample for Web Studio playback."""
    preset = next((v for v in VOICE_CATALOG if v.voice_id == request.voice_id), None)
    text = (
        request.sample_text
        or (preset.sample_text if preset else None)
        or (
            "Xin chào, đây là giọng đọc thử nghiệm từ AIK Studio."
            if request.language == "vi"
            else "Hello, this is a voice audition preview from AIK Studio."
        )
    )
    try:
        file_path, _, _, _ = tts_pipeline.synthesize_slide_audio(
            slide_index=0,
            text=text,
            language=request.language,
            voice_settings=VoiceSettings(provider=request.provider, voice_id=request.voice_id),
            job_id="voice_previews",
        )
        return FileResponse(path=file_path, media_type="audio/mpeg", filename=file_path.name)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/v1/jobs/compile", response_model=VideoJobResponse, status_code=202)
async def compile_edited_script(
    request: ScriptCompileRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
):
    """
    Compiles user-reviewed/edited slides directly through TTS -> Remotion stages,
    bypassing LLM generation while streaming progress over WebSockets.
    """
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    max_retries = int(os.getenv("MAX_JOB_RETRIES", "3"))

    job_dir = TEMP_JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    script_path = job_dir / "script.json"
    script_path.write_text(
        json.dumps(request.script.model_dump(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    initial_job = JobStatusResponse(
        job_id=job_id,
        status="script_ready",
        progress_percentage=40,
        current_stage="tts",
        render_requested=request.render_video,
        model_used="studio-editor",
        script=request.script,
    )
    queue_backend.save_job(initial_job)
    queue_backend.emit_progress(
        job_id=job_id,
        step="script_ready",
        progress_percentage=40,
        message="Edited slide script accepted for audio & video compilation. (40%)",
    )

    video_req = VideoGenerateRequest(
        prompt=request.script.title,
        language=request.script.language,
        aspect_ratio=request.aspect_ratio,
        style=StyleSettings(theme=request.script.theme),
        voice_settings=request.voice_settings,
        render_video=request.render_video,
    )
    tts_task = QueueTaskPayload(
        job_id=job_id,
        stage="tts",
        request=video_req,
        attempt=1,
        max_retries=max_retries,
        created_at=utc_timestamp(),
    )

    if _should_dispatch_to_external_worker():
        queue_backend.enqueue_task(tts_task)
    else:
        background_tasks.add_task(worker_coordinator.run_inline_pipeline, tts_task)

    ws_scheme = "wss" if http_request.url.scheme == "https" else "ws"
    host = http_request.headers.get("host") or f"localhost:{os.getenv('PORT', '8000')}"
    return VideoJobResponse(
        job_id=job_id,
        status="queued",
        estimated_time_seconds=35,
        websocket_url=f"{ws_scheme}://{host}/ws/jobs/{job_id}",
        message="Edited slide deck queued for audio synthesis and rendering.",
    )


@app.get("/api/v1/jobs/{job_id}/audio/{filename}")
async def download_slide_audio(job_id: str, filename: str):
    """Serves synthesized slide MP3 files safely for Web Studio slide preview playback."""
    if Path(filename).name != filename or not filename.endswith(".mp3"):
        raise HTTPException(status_code=400, detail="Invalid audio filename.")
    audio_path = (TEMP_JOBS_DIR / job_id / "audio" / filename).resolve()
    expected_parent = (TEMP_JOBS_DIR / job_id / "audio").resolve()
    if audio_path.parent != expected_parent or not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio asset not found.")
    return FileResponse(path=audio_path, media_type="audio/mpeg", filename=filename)


@app.get("/api/v1/jobs/{job_id}/video")
async def download_rendered_video(job_id: str):
    """Serves the rendered 1080p MP4 video for Web Studio playback and download."""
    job = queue_backend.get_job(job_id)
    if not job or not job.output_video_path:
        raise HTTPException(status_code=404, detail="Rendered video not available for this job.")
    video_path = Path(job.output_video_path).resolve()
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Rendered video file missing on disk.")
    return FileResponse(
        path=video_path,
        media_type="video/mp4",
        filename=f"{job_id}.mp4",
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
