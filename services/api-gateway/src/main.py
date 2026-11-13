"""
AIK-VdGeneration: Main API Gateway & Orchestrator
FastAPI service exposing prompt-to-video endpoints and pipeline triggers.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
import os

app = FastAPI(
    title="AIK-VdGeneration API",
    version="0.1.0",
    description="Automated presentation video generation from prompts with bilingual TTS."
)

class VideoGenerateRequest(BaseModel):
    prompt: str = Field(..., description="User prompt describing the video topic or raw text")
    language: str = Field("vi", description="'vi' for Vietnamese, 'en' for English")
    aspect_ratio: str = Field("16:9", description="'16:9' or '9:16'")
    voice_provider: str = Field("edge_tts", description="'edge_tts', 'elevenlabs', or 'fpt'")
    voice_id: Optional[str] = Field("vi-VN-HoaiMyNeural", description="Specific voice identifier")

class VideoJobResponse(BaseModel):
    job_id: str
    status: str
    message: str

@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "AIK-VdGeneration API Gateway",
        "version": "0.1.0"
    }

@app.post("/api/v1/videos/generate", response_model=VideoJobResponse, status_code=202)
async def generate_video(request: VideoGenerateRequest, background_tasks: BackgroundTasks):
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    
    # In Phase 2: Dispatch to Redis / BullMQ worker
    # In Phase 1 MVP: Dispatch via BackgroundTasks
    
    return VideoJobResponse(
        job_id=job_id,
        status="queued",
        message="Yêu cầu tạo video đã được tiếp nhận và đưa vào hàng đợi xử lý."
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
