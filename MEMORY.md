# AIK-VdGeneration: Project Memory & Decision Log

## 1. Project Identity & Status
- **Project Name:** AIK-VdGeneration (AI-driven Prompt to Slide-Video Generator)
- **Status:** Phase 3 In Progress (1/3 Milestones) — M3.1 Serverless Render Farm (Remotion Lambda) Completed.
- **Current Milestone:** M3.1 - Remotion Lambda 50-Chunk Parallel Farm & Gateway Integration Completed.
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
- **ADR-004: Decoupled Queue Worker Model (Stage Queues + Redis Pub/Sub)**
  - *Context:* Video rendering can take 30-120 seconds, blocking standard HTTP request/response loops.
  - *Decision:* Implemented `RedisQueueBackend` with dedicated stage queues (`llm`, `tts`, `render`), atomic progress history (`aik:progress_history:{job_id}`), Redis Pub/Sub WebSocket streaming (`/ws/jobs/{job_id}`), 3-attempt automatic retry with Dead-Letter Queue (`aik:queue:dlq`), and seamless `LocalMemoryQueueBackend` fallback when Redis is absent.
- **ADR-005: LLM Engine Upgrade to Gemini 3.8 Flash (`google-genai` >= 3.2.0 Interactions API)**
  - *Context:* Legacy Gemini 1.5/2.5 Flash and `generateContent` API are outdated; strict JSON schema compliance is critical for the slide pipeline.
  - *Decision:* Adopted the unified `google-genai` >= 3.2.0 SDK (`client.interactions.create`) targeting `gemini-3.8-flash` (configurable via `GEMINI_MODEL` with automatic fallback to `gemini-4-hydrogen`) using native `response_format` JSON Schema Structured Outputs, exponential backoff retries, and local dev mock fallback.
- **ADR-006: StudioBlank Monochrome Design System (`apps/web`)**
  - *Context:* Phase 2 Web Studio requires a focused, distraction-free interface so generated slide visuals and video output command attention.
  - *Decision:* Built `apps/web` with Next.js 15 App Router + Tailwind CSS adhering strictly to `StudioBlank` (`#FAFAFA`/`#0A0A0A` monochrome palette, `0px` border-radius, zero shadows, `<= 200ms` transitions, `Inter` + `IBM Plex Mono`) paired with FastAPI voice audition, edited-deck compilation, and media streaming endpoints.
- **ADR-007: Stock Visual Asset Pipeline & Alternating Ken Burns Effect (`M2.3`)**
  - *Context:* Slides need dynamic visual backdrops matching `visual_keywords` while preserving `SlideScriptItem` JSON Schema purity and rendering reliability offline or without stock API keys.
  - *Decision:* Kept `SlideScriptItem` free of URL fields and built `StockAssetService` in `services/api-gateway` (Unsplash/Pexels cascade with timeouts/retries, magic-header JPEG/PNG/WebP validation, `.temp/asset_cache` reuse, and immediate CSS gradient fallback), staged per-job visuals alongside audio in `RemotionRenderService`, implemented alternating Ken Burns pan/zoom (`computeKenBurnsTransform`) with a dark scrim in `SlideCard.tsx`, and added `/api/v1/assets/search` + thumbnail candidate picking in `apps/web`.
- **ADR-008: Cloud Object Storage (`AWS S3` / `Cloudflare R2`) & Signed URL Delivery (`M2.4`)**
  - *Context:* Rendered 1080p MP4 artifacts need durable cloud persistence and time-limited presigned download URLs without breaking local development when S3/R2 keys are unconfigured.
  - *Decision:* Implemented `CloudStorageService` using `boto3` (`signature_version='s3v4'`) supporting AWS S3, Cloudflare R2 (`R2_ACCOUNT_ID` / custom endpoint), optional `CDN_PUBLIC_BASE_URL`, retry recovery, and seamless fallback to local `/api/v1/jobs/{job_id}/video` streaming; added `GET /api/v1/jobs/{job_id}/video/url`, 307 cloud redirects, and UI signed-link refresh in `apps/web`.
- **ADR-009: Serverless Render Farm (`@remotion/lambda` 50-Chunk Parallelism) (`M3.1`)**
  - *Context:* Single-node Chrome rendering bottlenecks 2-minute 1080p videos (~120s); `services/video-renderer` must remain isolated from `services/api-gateway` imports.
  - *Decision:* Added `@remotion/lambda@4.0.543` deploy/render Node scripts inside `services/video-renderer` with `calculateLambdaChunkPlan` targeting 50 parallel chunks (`framesPerLambda >= 20`) and built `RemotionLambdaRenderService` in `services/api-gateway` to upload local media assets to S3 HTTPS URLs before dispatching Lambda jobs, with automatic local CLI fallback when Lambda is unconfigured or fails.

---

## 3. Environment & Secrets Mapping
The system relies on the following environment variables (stored in `.env` files, never committed):
```env
# LLM Providers (Google GenAI SDK >= 3.2.0)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash
GEMINI_FALLBACK_MODEL=gemini-4-hydrogen
OPENAI_API_KEY=

# TTS Providers
ELEVENLABS_API_KEY=
FPT_AI_API_KEY=

# Visual & Media
STOCK_IMAGE_PROVIDER=auto # auto | unsplash | pexels | disabled
UNSPLASH_ACCESS_KEY=
PEXELS_API_KEY=

# Redis & Storage
REDIS_URL=redis://localhost:6379/0
QUEUE_MODE=auto # auto | redis | memory
USE_EXTERNAL_WORKER=false
MAX_JOB_RETRIES=3
AWS_S3_BUCKET=
AWS_REGION=us-east-1
STORAGE_PROVIDER=auto # auto | local | s3 | r2
R2_ACCOUNT_ID=
S3_ENDPOINT_URL=
CDN_PUBLIC_BASE_URL=
SIGNED_URL_EXPIRY_SECONDS=3600
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

---

## 4. Active Roadmap Track
- [x] Initialized Workspace & Folder Architecture (`apps/`, `services/`, `docs/`, `.agent/`)
- [x] Defined AI Agent Guidelines (`AGENTS.md`, `GEMINI.md`)
- [x] Created Agent Skills (`video-prompt-engineering`, `tts-audio-sync`, `remotion-render-engine`)
- [x] Documented Architecture & Roadmap (`docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/API_SPEC.md`, `docs/TTS_SETUP.md`)
- [x] Implement `services/api-gateway` orchestration & Gemini 3.8 Flash script generation (M1.2)
- [x] Connect Edge-TTS & ElevenLabs audio pipeline & Remotion frame sync (M1.3)
- [x] Implement `services/video-renderer` 5 Remotion slide layouts & dynamic metadata (M1.4)
- [x] Build Local CLI Pipeline Runner & stateless Remotion MP4 render service (M1.5)
- [x] Implement Redis Queue Workers (`LLMWorker`, `TTSWorker`, `RenderWorker`), Retry/DLQ & WebSocket streaming (M2.1)
- [x] Build `apps/web` Next.js Web Studio with StudioBlank UI & backend studio endpoints (M2.2)
- [x] Integrate Unsplash / Pexels stock background imagery & Ken Burns pipeline (M2.3)
- [x] Direct `.mp4` upload to AWS S3 / Cloudflare R2 with signed download URLs (M2.4)
- [x] Serverless Render Farm with Remotion Lambda (`@remotion/lambda`, 50-chunk split, S3 asset staging) (M3.1)
- [ ] Royalty-free Sound Design & Automatic BGM Audio Ducking (M3.2)
