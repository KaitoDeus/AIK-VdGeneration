"""
AIK-VdGeneration: Main API Gateway & Orchestrator (Milestones M1.2 & M1.3)
FastAPI service exposing prompt-to-script, script-to-audio, and prompt-to-video endpoints.
"""

import json
import logging
import os
from pathlib import Path
from typing import Dict
import uuid

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException

try:
    from .schemas import (
        AudioSynthesizeRequest,
        JobStatusResponse,
        PresentationScript,
        RemotionCompositionProps,
        ScriptGenerateRequest,
        VideoGenerateRequest,
        VideoJobResponse,
    )
    from .services.llm_service import LLMScriptGenerator
    from .services.render_service import RemotionRenderService
    from .services.tts_service import TTSAudioPipeline
except ImportError:
    from schemas import (  # type: ignore
        AudioSynthesizeRequest,
        JobStatusResponse,
        PresentationScript,
        RemotionCompositionProps,
        ScriptGenerateRequest,
        VideoGenerateRequest,
        VideoJobResponse,
    )
    from services.llm_service import LLMScriptGenerator  # type: ignore
    from services.render_service import RemotionRenderService  # type: ignore
    from services.tts_service import TTSAudioPipeline  # type: ignore

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("api-gateway")

app = FastAPI(
    title="AIK-VdGeneration API Gateway",
    version="0.4.0",
    description="Automated presentation video generation from prompts with Gemini 3.8 Flash, bilingual TTS & Remotion.",
)

# In-memory job store for Phase 1 MVP (replaced by Redis in Phase 2)
JOBS_STORE: Dict[str, JobStatusResponse] = {}
TEMP_JOBS_DIR = Path(__file__).resolve().parent.parent / ".temp" / "jobs"

llm_generator = LLMScriptGenerator()
tts_pipeline = TTSAudioPipeline(output_base_dir=TEMP_JOBS_DIR)
render_service = RemotionRenderService()


def _execute_video_generation_pipeline(job_id: str, request: VideoGenerateRequest) -> None:
    """
    Background orchestration task executing:
      - Stage 1 (M1.2): LLM Script Generation & Schema Validation
      - Stage 2 (M1.3): Bilingual TTS Audio Synthesis, Duration Extraction & Remotion Props Compilation
    """
    job_state = JOBS_STORE.get(job_id)
    if not job_state:
        return

    try:
        # Stage 1: LLM Script Generation (M1.2)
        job_state.status = "generating_script"
        job_state.progress_percentage = 20

        script, model_used = llm_generator.generate_script(
            prompt=request.prompt,
            language=request.language,
            target_duration_seconds=request.target_duration_seconds,
            theme=request.style.theme,
            model_override=request.model,
        )

        job_dir = TEMP_JOBS_DIR / job_id
        job_dir.mkdir(parents=True, exist_ok=True)
        script_path = job_dir / "script.json"
        script_path.write_text(
            json.dumps(script.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        job_state.script = script
        job_state.model_used = model_used
        job_state.status = "script_ready"
        job_state.progress_percentage = 40
        logger.info("Job %s script generated via %s -> %s", job_id, model_used, script_path)

        # Stage 2: TTS Audio Synthesis & Frame Synchronization (M1.3)
        job_state.status = "synthesizing_audio"
        job_state.progress_percentage = 60

        remotion_props, provider_used = tts_pipeline.synthesize_presentation(
            script=script,
            voice_settings=request.voice_settings,
            job_id=job_id,
            aspect_ratio=request.aspect_ratio,
            fps=30,
        )

        props_path = job_dir / "remotion_props.json"
        props_path.write_text(
            json.dumps(remotion_props.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        job_state.remotion_props = remotion_props
        job_state.voice_provider_used = provider_used
        job_state.status = "audio_ready"
        job_state.progress_percentage = 80
        logger.info(
            "Job %s audio synthesized (%d frames, %.2fs) via %s -> %s",
            job_id,
            remotion_props.total_frames,
            remotion_props.total_duration_seconds,
            provider_used,
            props_path,
        )

        # Stage 3: Optional Remotion MP4 Rendering (M1.5)
        if request.render_video:
            job_state.status = "rendering_video"
            job_state.progress_percentage = 90
            output_mp4 = job_dir / f"{job_id}.mp4"
            rendered_path = render_service.render_presentation(
                props=remotion_props,
                job_id=job_id,
                output_mp4_path=output_mp4,
                props_json_path=props_path,
            )
            job_state.output_video_path = str(rendered_path)
            job_state.status = "completed"
            job_state.progress_percentage = 100
            logger.info("Job %s completed full MP4 video render -> %s", job_id, rendered_path)

    except Exception as exc:
        logger.exception("Job %s failed during pipeline execution: %s", job_id, exc)
        job_state.status = "failed"
        job_state.error = str(exc)


@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "AIK-VdGeneration API Gateway",
        "version": "0.3.0",
        "default_llm_model": llm_generator.default_model,
        "fallback_llm_model": llm_generator.fallback_model,
        "supported_tts_providers": ["edge_tts", "elevenlabs", "fpt"],
    }


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
async def generate_video(request: VideoGenerateRequest, background_tasks: BackgroundTasks):
    """
    Asynchronous orchestrator endpoint. Immediately returns a job_id (HTTP 202)
    and dispatches the LLM -> TTS -> Remotion pipeline in the background.
    """
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    JOBS_STORE[job_id] = JobStatusResponse(
        job_id=job_id,
        status="queued",
        progress_percentage=0,
    )

    background_tasks.add_task(_execute_video_generation_pipeline, job_id, request)

    return VideoJobResponse(
        job_id=job_id,
        status="queued",
        estimated_time_seconds=45,
        websocket_url=f"ws://localhost:8000/ws/jobs/{job_id}",
        message="Video generation job accepted and enqueued for processing.",
    )


@app.get("/api/v1/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """Retrieve current status, progress percentage, generated script, and Remotion props for a job."""
    job = JOBS_STORE.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return job


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("src.main:app", host="0.0.0.0", port=port, reload=True)
