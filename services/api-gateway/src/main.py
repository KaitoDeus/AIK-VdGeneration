"""
AIK-VdGeneration: Main API Gateway & Asynchronous Orchestrator (Phase 2 - M2.1)
FastAPI service exposing prompt-to-script, script-to-audio, queued video generation,
queue telemetry, and realtime WebSocket job progress endpoints.
"""

import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional
import uuid

from dotenv import load_dotenv
from fastapi import (
    BackgroundTasks,
    FastAPI,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, RedirectResponse

try:
    from .schemas import (
        AssetSearchRequest,
        AssetSearchResponse,
        AudioSynthesizeRequest,
        BGMMood,
        BGMTrackOption,
        BGMUploadResponse,
        ChannelContextProfile,
        JobStatusResponse,
        LambdaStatusResponse,
        PresentationScript,
        QueueStatsResponse,
        QueueTaskPayload,
        RemotionCompositionProps,
        ScriptCompileRequest,
        ScriptExpandRequest,
        ScriptGenerateRequest,
        StyleSettings,
        TikTokChannelAnalyzeRequest,
        VideoDeliveryResponse,
        VideoGenerateRequest,
        VideoJobResponse,
        VoiceOption,
        VoicePreviewRequest,
        VoiceSettings,
    )
    from .services.asset_service import StockAssetService
    from .services.bgm_service import BGMService, BGMUploadTooLargeError
    from .services.channel_context_service import (
        TikTokChannelContextService,
        TikTokProfileBlockedError,
        TikTokProfileError,
    )
    from .services.lambda_render_service import RemotionLambdaRenderService
    from .services.llm_service import LLMScriptGenerator
    from .services.queue_service import (
        BaseQueueBackend,
        create_queue_backend,
        utc_timestamp,
    )
    from .services.render_service import RemotionRenderService
    from .services.storage_service import CloudStorageService
    from .services.subtitle_service import WhisperSubtitleService
    from .services.tts_service import TTSAudioPipeline
    from .services.worker_service import PipelineWorkerCoordinator
except ImportError:
    from schemas import (  # type: ignore
        AssetSearchRequest,
        AssetSearchResponse,
        AudioSynthesizeRequest,
        BGMMood,
        BGMTrackOption,
        BGMUploadResponse,
        ChannelContextProfile,
        JobStatusResponse,
        LambdaStatusResponse,
        PresentationScript,
        QueueStatsResponse,
        QueueTaskPayload,
        RemotionCompositionProps,
        ScriptCompileRequest,
        ScriptExpandRequest,
        ScriptGenerateRequest,
        StyleSettings,
        TikTokChannelAnalyzeRequest,
        VideoDeliveryResponse,
        VideoGenerateRequest,
        VideoJobResponse,
        VoiceOption,
        VoicePreviewRequest,
        VoiceSettings,
    )
    from services.asset_service import StockAssetService  # type: ignore
    from services.bgm_service import BGMService, BGMUploadTooLargeError  # type: ignore
    from services.channel_context_service import (  # type: ignore
        TikTokChannelContextService,
        TikTokProfileBlockedError,
        TikTokProfileError,
    )
    from services.lambda_render_service import RemotionLambdaRenderService  # type: ignore
    from services.llm_service import LLMScriptGenerator  # type: ignore
    from services.queue_service import (  # type: ignore
        BaseQueueBackend,
        create_queue_backend,
        utc_timestamp,
    )
    from services.render_service import RemotionRenderService  # type: ignore
    from services.storage_service import CloudStorageService  # type: ignore
    from services.subtitle_service import WhisperSubtitleService  # type: ignore
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
channel_context_service = TikTokChannelContextService(llm_generator=llm_generator)
tts_pipeline = TTSAudioPipeline(output_base_dir=TEMP_JOBS_DIR)
render_service = RemotionRenderService()
asset_service = StockAssetService(output_base_dir=TEMP_JOBS_DIR)
bgm_service = BGMService(output_base_dir=TEMP_JOBS_DIR)
subtitle_service = WhisperSubtitleService()
storage_service = CloudStorageService()
lambda_service = RemotionLambdaRenderService(
    video_renderer_dir=render_service.video_renderer_dir,
    storage_service=storage_service,
)

queue_backend: BaseQueueBackend = create_queue_backend(shared_jobs_store=JOBS_STORE)
worker_coordinator = PipelineWorkerCoordinator(
    queue_backend=queue_backend,
    temp_jobs_dir=TEMP_JOBS_DIR,
    llm_generator=llm_generator,
    tts_pipeline=tts_pipeline,
    render_service=render_service,
    asset_service=asset_service,
    storage_service=storage_service,
    lambda_service=lambda_service,
    bgm_service=bgm_service,
    subtitle_service=subtitle_service,
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
        asset_service=asset_service,
        storage_service=storage_service,
        lambda_service=lambda_service,
        bgm_service=bgm_service,
        subtitle_service=subtitle_service,
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
        "storage_provider": storage_service.resolve_provider(),
        "render_engine": lambda_service.resolve_active_engine(),
        "external_worker_enabled": _should_dispatch_to_external_worker(),
        "default_llm_model": llm_generator.default_model,
        "fallback_llm_model": llm_generator.fallback_model,
        "supported_tts_providers": ["edge_tts", "google_vi", "elevenlabs", "fpt"],
    }


@app.get("/api/v1/render/lambda/config", response_model=LambdaStatusResponse)
async def get_lambda_render_config():
    """Returns Remotion Lambda serverless farm configuration & target parallel chunk status (M3.1)."""
    return lambda_service.get_status()


@app.get("/api/v1/queue/stats", response_model=QueueStatsResponse)
async def get_queue_stats():
    """Returns live stage queue depths, DLQ counts, and Redis connectivity telemetry."""
    return queue_backend.get_stats()


@app.post("/api/v1/channels/tiktok/analyze", response_model=ChannelContextProfile)
async def analyze_tiktok_channel_endpoint(request: TikTokChannelAnalyzeRequest):
    """
    Reads public channel metadata (handle, display name, bio, follower stats, hashtags,
    recent captions) from a TikTok profile URL and synthesizes reusable channel context
    (niche, target audience, tone, content pillars, and topic prompt suggestion).
    """
    try:
        return channel_context_service.analyze_profile(
            profile_url=request.profile_url,
            language=request.language,
            manual_notes=request.manual_notes,
            model_override=request.model,
        )
    except TikTokProfileError as val_exc:
        raise HTTPException(status_code=400, detail=str(val_exc)) from val_exc
    except TikTokProfileBlockedError as blocked_exc:
        raise HTTPException(status_code=422, detail=str(blocked_exc)) from blocked_exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


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
            target_slides=request.target_slides,
            aspect_ratio=request.aspect_ratio,
            video_format=request.video_format,
            channel_context=request.channel_context,
        )
        return script
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/v1/scripts/expand", response_model=PresentationScript)
async def expand_script_endpoint(request: ScriptExpandRequest):
    """
    Automatically generates up to 20 additional continuation slides (default 10)
    for an existing PresentationScript and merges them cleanly up to 30 slides total.
    """
    try:
        expanded, _ = llm_generator.expand_script(
            script=request.script,
            additional_slides=request.additional_slides,
            topic_hint=request.topic_hint,
            model_override=request.model,
            channel_context=request.channel_context,
        )
        return expanded
    except ValueError as val_exc:
        raise HTTPException(status_code=400, detail=str(val_exc)) from val_exc
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
        label="Hoài My (Nữ Miền Bắc · Tự Nhiên)",
        language="vi",
        provider="edge_tts",
        gender="female",
        sample_text="Xin chào, đây là giọng đọc AI tiếng Việt tự nhiên từ AIK Studio.",
    ),
    VoiceOption(
        voice_id="vi-VN-NamMinhNeural",
        label="Nam Minh (Nam Miền Bắc · Trầm Ấm)",
        language="vi",
        provider="edge_tts",
        gender="male",
        sample_text="Chào mừng bạn đến với nền tảng tạo video thuyết trình tự động.",
    ),
    VoiceOption(
        voice_id="vi-VN-GoogleVi",
        label="Thuần Việt Chuẩn (Nữ · Google TTS)",
        language="vi",
        provider="google_vi",
        gender="female",
        sample_text="Xin chào, đây là giọng đọc thuần Việt rõ chữ, chuẩn nhịp cho video ngắn.",
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
        voice_id="en-US-AndrewMultilingualNeural",
        label="Andrew HD (US Warm Multilingual Male)",
        language="en",
        provider="edge_tts",
        gender="male",
        sample_text="Welcome to AIK Studio. Every slide stays synchronized with crystal-clear narration.",
    ),
    VoiceOption(
        voice_id="en-US-AvaMultilingualNeural",
        label="Ava HD (US Expressive Multilingual Female)",
        language="en",
        provider="edge_tts",
        gender="female",
        sample_text="Discover smooth storytelling powered by studio-grade neural narration.",
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
    """Returns strictly language-matched voiceover presets (pure VI voices for 'vi')."""
    if language in ("vi", "en"):
        return [v for v in VOICE_CATALOG if v.language == language]
    return VOICE_CATALOG


@app.post("/api/v1/voices/preview")
async def preview_voice(request: VoicePreviewRequest):
    """Synthesizes or retrieves a cached voice audition MP3 sample for Web Studio playback."""
    preset = next((v for v in VOICE_CATALOG if v.voice_id == request.voice_id), None)
    matching_preset_text = (
        preset.sample_text if preset and preset.language == request.language else None
    )
    text = (
        request.sample_text
        or matching_preset_text
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


@app.post("/api/v1/bgm/upload", response_model=BGMUploadResponse)
async def upload_custom_bgm(file: UploadFile = File(...)):
    """
    Uploads and normalizes a user-provided music track (.mp3, .wav, .m4a, .aac, .ogg, .flac)
    for mixing into rendered presentation/short videos.
    """
    raw_bytes = await file.read()
    try:
        return bgm_service.save_uploaded_bgm(
            raw_bytes=raw_bytes,
            original_filename=file.filename or "track.mp3",
        )
    except BGMUploadTooLargeError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/v1/bgm/uploads/{custom_audio_id}/preview")
async def preview_uploaded_bgm(custom_audio_id: str):
    """Streams normalized custom user-uploaded background audio for Web Studio audition."""
    try:
        audio_file = bgm_service.resolve_uploaded_audio_file(custom_audio_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return FileResponse(path=audio_file, media_type="audio/wav", filename=audio_file.name)


@app.get("/api/v1/bgm/tracks", response_model=List[BGMTrackOption])
async def list_bgm_tracks(mood: Optional[BGMMood] = None):
    """Lists royalty-free BGM library tracks categorized by mood (Inspiring, Tech, Corporate, Relaxed)."""
    return bgm_service.list_tracks(mood=mood)


@app.get("/api/v1/bgm/tracks/{track_id}/preview")
async def preview_bgm_track(track_id: str):
    """Streams royalty-free mood background track for Web Studio audio audition (M3.2)."""
    try:
        track_file = bgm_service.get_track_audio_file(track_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    media_type = "audio/mpeg" if track_file.suffix.lower() == ".mp3" else "audio/wav"
    return FileResponse(path=track_file, media_type=media_type, filename=track_file.name)


@app.post("/api/v1/assets/search", response_model=AssetSearchResponse)
async def search_stock_assets(request: AssetSearchRequest):
    """Searches Unsplash / Pexels stock photography with graceful gradient fallback (M2.3)."""
    return asset_service.search_stock_images(
        query=request.query,
        aspect_ratio=request.aspect_ratio,
        limit=request.limit,
    )


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
        include_stock_visuals=request.include_stock_visuals,
        bgm_settings=request.bgm_settings,
        subtitle_settings=request.subtitle_settings,
    )
    tts_task = QueueTaskPayload(
        job_id=job_id,
        stage="tts",
        request=video_req,
        slide_backgrounds=request.slide_backgrounds,
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


def _resolve_safe_job_file(
    job_id: str,
    subdir: str,
    filename: str,
    allowed_extensions: tuple[str, ...],
) -> Path:
    """Validates single-segment filenames inside job artifact directories to prevent path traversal."""
    if Path(filename).name != filename or not filename.lower().endswith(allowed_extensions):
        raise HTTPException(status_code=400, detail="Invalid asset filename.")
    expected_parent = (TEMP_JOBS_DIR / job_id / subdir).resolve()
    target_path = (expected_parent / filename).resolve()
    if target_path.parent != expected_parent or not target_path.exists():
        raise HTTPException(status_code=404, detail="Job asset not found.")
    return target_path


@app.get("/api/v1/jobs/{job_id}/audio/{filename}")
async def download_slide_audio(job_id: str, filename: str):
    """Serves synthesized slide MP3 files safely for Web Studio slide preview playback."""
    audio_path = _resolve_safe_job_file(job_id, "audio", filename, (".mp3",))
    return FileResponse(path=audio_path, media_type="audio/mpeg", filename=filename)


@app.get("/api/v1/jobs/{job_id}/assets/{filename}")
async def download_slide_asset(job_id: str, filename: str):
    """Serves downloaded stock background images safely for Web Studio canvas preview."""
    image_path = _resolve_safe_job_file(
        job_id, "assets", filename, (".jpg", ".jpeg", ".png", ".webp")
    )
    ext = image_path.suffix.lower()
    media_type = (
        "image/png" if ext == ".png" else "image/webp" if ext == ".webp" else "image/jpeg"
    )
    return FileResponse(path=image_path, media_type=media_type, filename=filename)


@app.get("/api/v1/jobs/{job_id}/subtitles.srt")
async def download_job_subtitles_srt(job_id: str):
    """Serves synchronized SubRip (.srt) subtitles compiled by Whisper / alignment (M3.3)."""
    job = queue_backend.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    srt_file = TEMP_JOBS_DIR / job_id / "subtitles.srt"
    if srt_file.exists():
        srt_text = srt_file.read_text(encoding="utf-8")
    elif job.remotion_props and job.remotion_props.subtitles and job.remotion_props.subtitles.enabled:
        srt_text = subtitle_service.export_srt(job.remotion_props)
    else:
        raise HTTPException(status_code=404, detail="Subtitles were not generated for this job.")

    return PlainTextResponse(
        content=srt_text,
        media_type="application/x-subrip",
        headers={"Content-Disposition": f'attachment; filename="{job_id}.srt"'},
    )


@app.get("/api/v1/jobs/{job_id}/video/url", response_model=VideoDeliveryResponse)
async def get_signed_video_download_url(
    job_id: str,
    expires_in: int = Query(default=3600, ge=60, le=604800),
):
    """
    Generates a fresh presigned S3 / Cloudflare R2 download URL (or local fallback path)
    for a completed rendered video job (Milestone M2.4).
    """
    job = queue_backend.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    local_path = Path(job.output_video_path).resolve() if job.output_video_path else None
    local_exists = bool(local_path and local_path.exists())
    if not local_exists and not job.storage_object_key:
        raise HTTPException(status_code=404, detail="Rendered video not available for this job.")

    file_size = local_path.stat().st_size if local_exists and local_path else None
    if not job.storage_object_key and job.storage_provider in (None, "local"):
        return VideoDeliveryResponse(
            job_id=job_id,
            storage_provider="local",
            download_url=f"/api/v1/jobs/{job_id}/video",
            file_size_bytes=file_size,
        )

    delivery = storage_service.create_presigned_download_url(
        job_id=job_id,
        object_key=job.storage_object_key,
        expires_in_seconds=expires_in,
        file_size_bytes=file_size,
    )
    job.video_download_url = delivery.cdn_url or delivery.download_url
    job.signed_url_expires_in_seconds = delivery.expires_in_seconds
    queue_backend.save_job(job)
    return delivery


@app.get("/api/v1/jobs/{job_id}/video")
async def download_rendered_video(job_id: str, redirect: bool = False):
    """
    Serves the rendered 1080p MP4 video from local storage or redirects transparently
    to a signed S3/R2 URL when hosted in cloud object storage.
    """
    job = queue_backend.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Rendered video not available for this job.")

    if redirect and job.storage_object_key:
        delivery = storage_service.create_presigned_download_url(
            job_id=job_id,
            object_key=job.storage_object_key,
        )
        target_url = delivery.cdn_url or delivery.download_url
        if target_url.startswith(("http://", "https://")):
            return RedirectResponse(url=target_url, status_code=307)

    if job.output_video_path:
        video_path = Path(job.output_video_path).resolve()
        if video_path.exists():
            return FileResponse(
                path=video_path,
                media_type="video/mp4",
                filename=f"{job_id}.mp4",
            )

    if job.storage_object_key:
        delivery = storage_service.create_presigned_download_url(
            job_id=job_id,
            object_key=job.storage_object_key,
        )
        target_url = delivery.cdn_url or delivery.download_url
        if target_url.startswith(("http://", "https://")):
            return RedirectResponse(url=target_url, status_code=307)

    raise HTTPException(status_code=404, detail="Rendered video file missing on disk.")


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
