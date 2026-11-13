# AIK-VdGeneration: Project Memory & Decision Log

## 1. Project Identity & Status
- **Project Name:** AIK-VdGeneration (AI-driven Prompt to Slide-Video Generator)
- **Status:** Phase 1 (Foundation & MVP Scaffolding)
- **Current Milestone:** M1.1 - Project Initialized with AI Skills, Memory & Architecture Docs.
- **Created Date:** 2026-11-14
- **Working Root:** `D:\AIK-VdGeneration`

---

## 2. Key Architectural Decisions (ADR)
- **ADR-001: Video Engine Selection -> Remotion**
  - *Context:* Need programmatic rendering of slide layouts with high CSS/React fidelity and dynamic duration calculation.
  - *Decision:* Remotion was chosen over FFmpeg-only scripts due to its component-based visual design, declarative animations, and scalability via Remotion Lambda.
- **ADR-002: Audio-Driven Timeline Architecture**
  - *Context:* Slide presentations must allow the speaker to finish talking before transitioning.
  - *Decision:* TTS is generated per slide first. `ffprobe` or audio metadata extracts exact millisecond durations. Frame counts for each slide are computed dynamically.
- **ADR-003: Bilingual TTS Strategy**
  - *Context:* Both English and Vietnamese voiceovers are required with high naturalness.
  - *Decision:*
    - Production: ElevenLabs Multilingual v2 / FPT.AI for regional accuracy.
    - Development/Testing: Edge-TTS (`vi-VN-HoaiMyNeural`, `vi-VN-NamMinhNeural`, `en-US-GuyNeural`) for zero-cost rapid iterations.
- **ADR-004: Decoupled Queue Worker Model**
  - *Context:* Video rendering can take 30-120 seconds, blocking standard HTTP request/response loops.
  - *Decision:* Redis + BullMQ (or Celery) job queue with WebSocket progress updates.

---

## 3. Environment & Secrets Mapping
The system relies on the following environment variables (stored in `.env` files, never committed):
```env
# LLM Providers
GEMINI_API_KEY=
OPENAI_API_KEY=

# TTS Providers
ELEVENLABS_API_KEY=
FPT_AI_API_KEY=

# Visual & Media
UNSPLASH_ACCESS_KEY=
PEXELS_API_KEY=

# Redis & Storage
REDIS_URL=redis://localhost:6379
AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

---

## 4. Active Roadmap Track
- [x] Initialized Workspace & Folder Architecture (`apps/`, `services/`, `docs/`, `.agent/`)
- [x] Defined AI Agent Guidelines (`AGENTS.md`, `GEMINI.md`)
- [x] Created Agent Skills (`video-prompt-engineering`, `tts-audio-sync`, `remotion-render-engine`)
- [x] Documented Architecture & Roadmap (`docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/API_SPEC.md`, `docs/TTS_SETUP.md`)
- [ ] Implement `services/api-gateway` orchestration endpoint
- [ ] Implement `services/video-renderer` starter Remotion compositions
- [ ] Connect Edge-TTS & ElevenLabs audio pipeline
- [ ] Build `apps/web` prompt & studio interface
