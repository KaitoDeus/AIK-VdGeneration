# AIK-VdGeneration: Implementation Roadmap

This roadmap breaks down the product development into 4 distinct phases, from an initial working Proof of Concept (MVP) to a production-ready, scalable AI video generation SaaS.

---

## Phase 1: MVP & Core Pipeline (Weeks 1 - 3)
*Goal: Prove end-to-end viability. Given a text prompt, produce a high-quality 1080p MP4 slide video with Vietnamese/English voiceover.*

### Milestones:
- [x] **M1.1: Project Architecture & AI Guidelines**
  - Standardized monorepo/modular layout.
  - Integration of agent skills (`video-prompt-engineering`, `tts-audio-sync`, `remotion-render-engine`).
  - Strict JSON schemas & system documentation.
- [x] **M1.2: Orchestrator & LLM Script Generation**
  - Python service connecting to Gemini 3.8 Flash via the official `google-genai` SDK.
  - Native Structured Outputs converting prompts into strictly validated Slide JSON (`PresentationScript`) with retry and fallback mechanisms.
- [x] **M1.3: Audio Pipeline (TTS)**
  - Integration of `edge-tts >= 7.3.1` (zero-cost neural synthesis for En & Vi: `vi-VN-HoaiMyNeural`, `en-US-GuyNeural`).
  - Integration of ElevenLabs API (`eleven_multilingual_v2`) with automatic fallback to Edge-TTS.
  - MP3 header verification (`>10KB`), exact millisecond duration extraction via `mutagen`, and dynamic Remotion frame calculation (`RemotionCompositionProps`).
- [x] **M1.4: Remotion Presentation Compositions**
  - Complete 5 distinct slide layouts: `title_intro`, `bullet_list`, `split_card`, `quote_highlight`, `conclusion_cta`.
  - Spring-based smooth entrance/exit animations, progress timeline bar, Ken Burns background image layer with CSS radial-gradient fallback, and typography styling.
  - Dynamic `calculatePresentationMetadata` composition combining slides, 0.2s pre-padded voiceover audio sequences, and optional BGM track.
- [x] **M1.5: Local CLI Pipeline Runner**
  - Single CLI command (`npm run generate -- --prompt "Topic" --lang vi` or `python services/api-gateway/src/cli.py`) executing the complete pipeline (`Prompt -> Gemini 3.8 Flash -> Edge-TTS/ElevenLabs -> Remotion Render`) to output a verified 1080p `.mp4` video with automatic staging cleanup.

---

## Phase 2: Asynchronous Job Queue & Web Studio (Weeks 4 - 6)
*Goal: Provide a user-friendly Web UI and decouple rendering from HTTP request cycles.*

### Milestones:
- [x] **M2.1: Asynchronous Queue Worker**
  - Redis-backed distributed job orchestration (`RedisQueueBackend` with automatic `LocalMemoryQueueBackend` fallback for zero-dependency local dev) and `docker-compose.yml` Redis infrastructure.
  - Dedicated modular stage workers (`LLMWorker`, `TTSWorker`, `RenderWorker`, and standalone `src.worker` daemon) with 3-attempt automatic retries, Dead-Letter Queue (DLQ), and realtime `/ws/jobs/{job_id}` WebSocket progress streaming.
- [x] **M2.2: Next.js Web Studio (apps/web)**
  - Ultra-minimal StudioBlank Design System UI built with Next.js 15 App Router, TypeScript (strict), and Tailwind CSS (`0px` radius, zero shadows, `#FAFAFA`/`#0A0A0A` monochrome hierarchy, `Inter` + `IBM Plex Mono`).
  - Prompt studio with quick templates, bilingual EN/VI voice audition preview (`POST /api/v1/voices/preview`), interactive slide canvas reviewer & editor (`POST /api/v1/jobs/compile`), realtime WebSocket progress tracker (`/ws/jobs/{job_id}`), and built-in 1080p MP4 playback & download.
- [x] **M2.3: Asset Integration & Background Visuals**
  - Integration with Unsplash & Pexels API (`StockAssetService`) for automated slide background imagery based on `visual_keywords`, featuring timeout/retry protection, binary magic-header validation, disk caching, per-job staging in `RemotionRenderService`, and instant gradient fallback.
  - Alternating Ken Burns slow pan & zoom (`computeKenBurnsTransform`) with dark scrim contrast layer in Remotion `SlideCard` + interactive stock search & candidate picker (`POST /api/v1/assets/search`) in the `apps/web` Studio.
- [x] **M2.4: Storage & CDN Delivery**
  - Direct upload of final `.mp4` to AWS S3 or S3-compatible Cloudflare R2 (`CloudStorageService` with `boto3` SigV4 signing, optional custom CDN base URL, retry protection, and graceful local serving fallback).
  - Signed download URL endpoint (`GET /api/v1/jobs/{job_id}/video/url`), 307 redirect support for evicted local artifacts, and Studio delivery badge + signed link refresher in `apps/web`.

---

## Phase 3: Cloud Rendering Scale & Advanced Audio (Weeks 7 - 9)
*Goal: Handle concurrent users efficiently and elevate audiovisual quality.*

### Milestones:
- [ ] **M3.1: Serverless Render Farm (Remotion Lambda)**
  - Deploy Remotion bundle to AWS Lambda for distributed rendering (splitting 1 video into 50 parallel chunk renders).
  - Reduce 2-minute render time down to 15-20 seconds.
- [ ] **M3.2: Sound Design & BGM Ducking**
  - Royalty-free background music library categorized by mood (Inspiring, Tech, Corporate, Relaxed).
  - Automatic audio ducking: music volume drops during speech and swells during slide transitions.
- [ ] **M3.3: Automatic Animated Subtitles / Captions**
  - OpenAI Whisper integration to generate word-by-word timestamps.
  - Dynamic karaoke-style subtitle rendering in Remotion.

---

## Phase 4: Mobile App & Customization Studio (Weeks 10 - 12+)
*Goal: Expand to mobile devices and empower users to edit slides before rendering.*

### Milestones:
- [ ] **M4.1: Slide Editor / Canvas Inspection**
  - Interactive preview allowing users to edit text, swap images, or re-record TTS prior to final MP4 compilation.
- [ ] **M4.2: Mobile Client (Flutter / React Native)**
  - Cross-platform iOS & Android app connecting to the API Gateway.
  - Native video player and 1-click social media sharing (TikTok, YouTube Shorts, Reels in 9:16 aspect ratio).
- [ ] **M4.3: Digital Human / AI Avatar Integration (Optional)**
  - Picture-in-picture round avatar presenter talking in the bottom corner (HeyGen / SadTalker / LivePortrait).
