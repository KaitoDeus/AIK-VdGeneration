"""
AIK-VdGeneration: Main API Gateway & Orchestrator (Milestone M1.2)
FastAPI service exposing prompt-to-script and prompt-to-video endpoints.
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
        JobStatusResponse,
        PresentationScript,
        ScriptGenerateRequest,
        VideoGenerateRequest,
        VideoJobResponse,
    )
    from .services.llm_service import LLMScriptGenerator
except ImportError:
    from schemas import (  # type: ignore
        JobStatusResponse,
        PresentationScript,
        ScriptGenerateRequest,
        VideoGenerateRequest,
        VideoJobResponse,
    )
    from services.llm_service import LLMScriptGenerator  # type: ignore

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("api-gateway")

app = FastAPI(
    title="AIK-VdGeneration API Gateway",
    version="0.2.0",
    description="Automated presentation video generation from prompts with Gemini Flash & bilingual TTS.",
)

# In-memory job store for Phase 1 MVP (replaced by Redis in Phase 2)
JOBS_STORE: Dict[str, JobStatusResponse] = {}
TEMP_JOBS_DIR = Path(__file__).resolve().parent.parent / ".temp" / "jobs"

llm_generator = LLMScriptGenerator()


def _execute_video_generation_pipeline(job_id: str, request: VideoGenerateRequest) -> None:
    """Background orchestration task executing M1.2 LLM Script Generation (and subsequent stages)."""
    job_state = JOBS_STORE.get(job_id)
    if not job_state:
        return

    try:
        job_state.status = "generating_script"
        job_state.progress_percentage = 20

        script, model_used = llm_generator.generate_script(
            prompt=request.prompt,
            language=request.language,
            target_duration_seconds=request.target_duration_seconds,
            theme=request.style.theme,
            model_override=request.model,
        )

        # Persist validated JSON script artifact to .temp/jobs/{job_id}/script.json
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
        logger.info("Job %s script generated and validated via %s -> %s", job_id, model_used, script_path)

    except Exception as exc:
        logger.exception("Job %s failed during script generation: %s", job_id, exc)
        job_state.status = "failed"
        job_state.error = str(exc)


@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "AIK-VdGeneration API Gateway",
        "version": "0.2.0",
        "default_llm_model": llm_generator.default_model,
        "fallback_llm_model": llm_generator.fallback_model,
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
    """Retrieve current status, progress percentage, and generated script for a job."""
    job = JOBS_STORE.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")
    return job


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("src.main:app", host="0.0.0.0", port=port, reload=True)
