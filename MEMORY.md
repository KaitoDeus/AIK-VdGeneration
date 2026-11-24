# AIK-VdGeneration: Project Memory & Decision Log

## 1. Project Identity & Status
- **Project Name:** AIK-VdGeneration (AI-driven Prompt to Slide-Video Generator)
- **Status:** Phase 3 Completed (3/3 Milestones) — M3.3 Automatic Animated Subtitles / Captions Completed (Ready for Phase 4).
- **Current Milestone:** M3.3 - OpenAI Whisper Word Timestamps, Karaoke Captions & SRT Export Completed.
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
- **ADR-010: Sound Design & Automatic BGM Ducking (`M3.2`)**
  - *Context:* Background music elevates presentation polish but must never mask bilingual narration or rely on external broken stock audio URLs.
  - *Decision:* Built `BGMService` cataloging 4 mood tiers (`inspiring`, `tech`, `corporate`, `relaxed`) with deterministic 44.1kHz stereo WAV loop synthesis/caching (overridable via `assets/bgm/`), staged loops cleanly into `public/music/`, and implemented per-frame Remotion `<Audio volume={...} loop />` envelope math (`computeDuckedBgmVolume`) attenuating music `-18 dB` during voiceover speech windows and swelling `+3 dB` in slide transitions.
- **ADR-011: Word-Level Karaoke Subtitles via OpenAI Whisper + Alignment Fallback (`M3.3`)**
  - *Context:* Animated karaoke captions require exact word start/end timestamps while remaining operational without an active OpenAI API key in local development.
  - *Decision:* Implemented `WhisperSubtitleService` calling `OpenAI.audio.transcriptions.create(model="whisper-1", timestamp_granularities=["word"])` with retry recovery and monotonic syllable/punctuation-weighted alignment fallback, exporting `.srt` tracks (`/api/v1/jobs/{job_id}/subtitles.srt`) and rendering `KaraokeCaptions.tsx` inside `SlidePresentation.tsx`.
- **ADR-012: Unified Docker Compose Packaging (`docker-compose.yml`)**
  - *Context:* Running the full stack locally requires coordinating Python 3.13, Node.js 22, FFmpeg, Chromium system dependencies for Remotion, Redis 7, and Next.js 15 across developers and CI environments.
  - *Decision:* Added `docker/backend.Dockerfile` (single shared `aik-vdgeneration-backend:latest` image for both `api-gateway` and `worker` with Python 3.13, Node.js 22, FFmpeg, Chromium shared libs, and pre-cached `chrome-headless-shell-linux64` via `npx remotion browser ensure`), `docker/web.Dockerfile` (`aik-vdgeneration-web:latest` multi-stage build using Next.js `output: 'standalone'` when `NEXT_STANDALONE=1`), `.dockerignore` recursive exclusion globs, and `docker-compose.yml` wiring `redis`, `api-gateway`, `worker` (`shm_size: 1gb`, shared `aik_jobs_temp` volume), and `web` over `aik-net`.
- **ADR-013: Scalable 30-Slide Ceiling & Automatic AI Continuation Expansion (`/api/v1/scripts/expand`)**
  - *Context:* Users building deeper explainers or courses need more than the initial 8-slide limit and a 1-click way to automatically extend an existing deck with 10+ continuation slides.
  - *Decision:* Raised `MAX_PRESENTATION_SLIDES` (`schemas.py`, `API_SPEC.md`, `SlideReviewer.tsx`) from `8` to `30`, added optional `target_slides` (`3..30`) to script/video generation, and built `LLMScriptGenerator.expand_script` + `POST /api/v1/scripts/expand` (`SlideExpansionBatch` Gemini Structured Outputs & 14-facet EN/VI local fallback blueprints) inserting deep-dive slides before trailing `conclusion_cta`, exposed via `+5 AI SLIDES` / `+10 AI SLIDES` controls in `apps/web`.
- **ADR-014: NotebookLM-Inspired Per-Slide Visual Diversity, Contrasting Light/Dark Palettes & Procedural SVG Infographics**
  - *Context:* Repeated slide renders shared one dark `#0f172a` slate backdrop and uniform glass list cards whenever stock imagery was absent or layouts repeated across long multi-slide decks.
  - *Decision:* Added `SLIDE_PALETTES` (`slidePalettes.ts` and `apps/web/src/lib/templates.ts`) rotating 8 high-contrast alternating dark studio (`sapphire_studio`, `emerald_forest`, `aubergine_spark`, `obsidian_amber`) and light warm editorial paper (`warm_editorial_paper`, `cobalt_porcelain`, `sage_botanical`, `blush_sand_studio`) themes across consecutive slides; built procedural animated Remotion SVG components (`SlideVisuals.tsx`: `OrbitalHeroSvg`, `ProcessFlowBeamSvg`, `KnowledgeGraphSvg`, `AnimatedMetricBarsSvg`, `StackedLayersSvg`, `MilestoneRoadmapSvg`, `EditorialRadarHaloSvg`, and `KineticBackdropScene`) paired with 10 layout visual archetypes (`VisualVariant`) inside `SlideLayouts.tsx` + `SlideCard.tsx`; enforced non-repeating body layouts in `llm_service.py` prompts and expansion catalogs; and mirrored the curated palettes and miniature diagrams in `SlideReviewer.tsx`.
- **ADR-015: Vertical Short Video Mode (`9:16` / TikTok / Reels / YouTube Shorts)**
  - *Context:* Generating `9:16` videos previously squeezed 16:9 multi-column grids and bottom-edge captions into a 1080px portrait width and lacked short-form narrative pacing.
  - *Decision:* Added explicit `video_format: 'presentation' | 'short'` and `aspect_ratio` awareness across `ScriptGenerateRequest` / `VideoGenerateRequest` / `LLMScriptGenerator` (hook-first 3-6 scene pacing and dedicated EN/VI Shorts fallback blueprints); adapted `SlideCard.tsx`, `SlideLayouts.tsx`, and `SlidePresentation.tsx` to collapse multi-column layouts vertically (`isPortrait = height > width`) with mobile safe-zone padding and 4-word `KaraokeCaptions` bursts (`bottom: 144px`, `42px` highlight); and added a one-click `9:16 SHORT VIDEO` mode switcher, 1.0x/1.1x/1.2x voice pacing controls, Shorts quick templates (`shorts-vi`, `shorts-en`), and vertical safe-zone canvas preview in `apps/web`.
- **ADR-016: Pure Vietnamese TTS Pipeline, Strict Language Voice Isolation & Single-Speaker Uniformity (`vi`)**
  - *Context:* Previously `EDGE_PEER_FALLBACK_VOICES["vi"]` included `en-US-AvaMultilingualNeural`, Edge-TTS intermittently rejected SSML `rate` strings (`NoAudioReceived`), the Vietnamese dropdown included English `Rachel (ElevenLabs Multilingual)`, and a mid-deck Edge fallback on Slide 2+ left Slide 1 speaking Male (`vi-VN-NamMinhNeural`) while Slides 2+ switched to Female (`vi-VN-HoaiMyNeural`).
  - *Decision:* Removed all `en-US-*` voices from Vietnamese fallback chains; removed unstable SSML `<prosody rate>` calls from Edge-TTS and delegated speed scaling to local FFmpeg `atempo`; raised default Edge-TTS resilience (`max_retries=6`, `0.25s` inter-slide pacing); added automatic single-speaker unification in `TTSAudioPipeline.synthesize_presentation` (re-synthesizing earlier slides whenever a fallback speaker takes over mid-deck so every slide speaks in one unified voice); added pure Vietnamese HTTP TTS (`google_vi` / `vi-VN-GoogleVi`); and filtered `/api/v1/voices` + `PromptStudioForm.tsx` strictly by `language` with localized Vietnamese labels.
- **ADR-017: Single Global Language Switcher Source of Truth (`en` Default) & Voice Coupling (`apps/web`)**
  - *Context:* Previously the Web Studio defaulted UI `locale` and video `language` to Vietnamese (`vi`) while maintaining two disconnected controls: the top-right `[VIE] [EN]` flag switcher (UI copy) and a separate `LANGUAGE` column (`[VIETNAMESE] [ENGLISH]`) inside `PromptStudioForm.tsx` (narrator voice language), causing header `EN` to display Vietnamese narrator voices (`Hoài My`) whenever switched independently.
  - *Decision:* Defaulted Web Studio initial state (`apps/web/src/app/page.tsx`) to English (`locale: 'en'`, `formState.language: 'en'`, `voiceId: 'en-US-GuyNeural'`), removed the redundant `Language` and `Aspect Ratio` radio columns in `PromptStudioForm.tsx` to form a balanced 2-column geometric parameter grid (`md:grid-cols-2`: Theme & Target Duration | Narrator Voice), removed the top panel header bar (`01 / PROMPT & PARAMETERS`), relocated the quick prompt template chips (`data-testid="quick-prompt-templates"`) directly below the topic `<textarea>`, and coupled `handleLocaleChange`, `localStorage` hydration, the language-mismatch quick-switch button, and `handleApplyTemplate` so changing language anywhere updates UI locale, `<html lang>`, `formState.language`, and default narrator voice together as a single source of truth.
- **ADR-018: Custom User Background Music Upload (`POST /api/v1/bgm/upload`), Loudness Normalization & Subtitles Terminology**
  - *Context:* Previously built-in ambient BGM synthesis generated `-32.6 dBFS` audio that combined with `0.22` volume and `-18 dB` ducking to `-64..-82 dBFS` inside rendered MP4s (practically silent), preset mood chips cluttered the Web Studio instead of allowing users to upload their own tracks, and Studio UI labels used "Karaoke" instead of "Subtitles" / "Phụ đề".
  - *Decision:* Added `POST /api/v1/bgm/upload` and `GET /api/v1/bgm/uploads/{custom_audio_id}/preview` backed by `python-multipart` and FFmpeg `-14 LUFS` stereo 44.1kHz PCM `.wav` normalization stored on the shared `aik_jobs_temp/_bgm_uploads` volume accessible to both `api-gateway` and `worker`; extended `BGMSettings` with `custom_audio_id` and configurable `duck_attenuation_db` (Web Studio mixes audible normalized BGM at `volume=0.45`, `-10 dB` ducking during speech); replaced preset mood buttons/dropdown in `PromptStudioForm.tsx` with a custom audio uploader (`bgm-upload-btn`), preview player, and missing-file guard; and standardized all UI/subtitle terminology on "Subtitles" / "Phụ đề".
- **ADR-019: Distinct 3-Theme Palette Families, Expressive Editorial Typography & Reduced Bullet Clutter**
  - *Context:* Previously all three visual themes (`modern_tech`, `corporate`, `minimal`) rendered almost identically dark monospace slides (`#1e293b`/`#18181b`/`#0f172a` with `Inter` sans, robotic `SLIDE_LAYOUT // PALETTE` badges, `VISUAL: variant` labels, `DARK STUDIO` footer tags, and numbered `01`/`02` bullet rectangles), while `SlideReviewer.tsx` ignored the active theme dropdown completely.
  - *Decision:* Replaced dark flat presets with three visually distinct color & typography families synchronized between `services/video-renderer` (`slidePalettes.ts`, `timing.ts`, `SlideCard.tsx`, `SlideLayouts.tsx`), `services/api-gateway` (`schemas.py`, `tts_service.py`, `llm_service.py`), and `apps/web` (`templates.ts`, `SlideReviewer.tsx`, `page.tsx`): vibrant multi-hue jewel & cream backdrops (`#132B63`, `#0B4236`, `#3A1563`, `#4D1F0D`) with bold geometric sans (`800` weight) for `modern_tech`, authoritative boardroom palettes (`corp_admiralty_navy`, `corp_warm_ivory`, etc.) paired with classic Georgia Serif (`700`) headings for `corporate`, and airy pastel gallery palettes (`minimal_peach_silk`, `minimal_mint_breeze`, etc.) with weight-`500` minimalist humanist typography and borderless whitespace (`0px` top bars) for `minimal`; removed robotic monospace stamps (`KEYNOTE BRIEFING`, `ACTION 01`, `SUMMARY COMPLETE`, `VISUAL:`, `DARK STUDIO`) and replaced repetitive numbered bullet stacks with cohesive subtitle copy and editorial insight cards.
- **ADR-020: Bilingual Quick Prompt Templates & Preserved Active Language**
  - *Context:* Previously each quick prompt template (`PROMPT_TEMPLATES`) was hardcoded to a single language (`tech-explainer`/`pitch-deck` in `en`, `educational`/`marketing` in `vi`), and `handleApplyTemplate` called `persistLocalePreference(template.language)`, unexpectedly switching the entire Web Studio UI language and narrator voice whenever a user clicked a template in a different category.
  - *Decision:* Gave every quick prompt template dual simultaneous `prompts: { en, vi }` copy and language-neutral short labels; updated `handleApplyTemplate` in `apps/web/src/app/page.tsx` via `resolveTemplatePrompt(template, locale)` to fill the prompt matching the currently active language without altering UI `locale`, `formState.language`, or selected narrator voice; and updated `syncLocaleToForm` to automatically translate an active template prompt when toggling `[VIE]` / `[EN]` in the header.
- **ADR-021: Vietnamese-Native Font Stacks (`Cambria`/`Sitka`/`Noto Serif` & `Inter`/`Segoe UI`/`Noto Sans`), NFC Normalization & No-Store HTML Headers**
  - *Context:* `Georgia` (`GEORGIA.TTF`) and `Helvetica Neue` lack full precomposed Vietnamese Extended Latin diacritics (`ế`, `ầ`, `ố`, `ừ`), causing fallback font splits inside headings (e.g., `Kiê´n`, `Phâ`n`, `Cô´t`) in the Web Studio `corporate` canvas and potential Remotion mismatch; additionally Next.js static prerendering cached `/` with `s-maxage=31536000` across container rebuilds.
  - *Decision:* Verified precomposed Vietnamese glyphs (`U+1EBF`, `U+1EA7`, `U+1ED1`, `U+1EEB`) in Windows system fonts (`Sitka Heading`, `Cambria`, `Times New Roman`, `Segoe UI Variable Text`, `Bahnschrift`) alongside `Inter` (`subsets: ['latin', 'vietnamese']`) in Next.js and Linux Docker fonts (`Noto Serif Display`, `Noto Serif`, `Noto Sans Display`, `Noto Sans`); replaced `Georgia` and `Helvetica Neue` across `templates.ts`, `slidePalettes.ts`, and `tts_service.py`; normalized slide copy to Unicode `NFC` in `schemas.py` and `SlideReviewer.tsx`; and configured `Cache-Control: no-store, must-revalidate` for `/` in `apps/web/next.config.ts`.
- **ADR-022: TikTok Profile Channel Context Extractor (`POST /api/v1/channels/tiktok/analyze`) & Script Personalization**
  - *Context:* Creators want generated video scripts and visual style to reflect the niche, audience, tone, and recurring topics of a specific TikTok account directly from its profile URL, while TikTok's web frontend often gates automated HTML requests behind `SlardarWAF`.
  - *Decision:* Built `TikTokChannelContextService` (`services/api-gateway/src/services/channel_context_service.py`) validating profile URLs strictly against `tiktok.com` / `www.tiktok.com` / `m.tiktok.com` (preventing SSRF), parsing public `__UNIVERSAL_DATA_FOR_REHYDRATION__` / `SIGI_STATE` SSR payloads and OpenGraph tags, querying TikTok's official documented oEmbed API (`https://www.tiktok.com/oembed`) when direct HTML encounters `SlardarWAF`/anti-bot verification, raising `HTTP 422` cleanly without bypassing CAPTCHA when neither public data nor oEmbed metadata is available (`manual_notes` fallback always supported), and synthesizing `ChannelContextProfile` insights via Gemini Structured Outputs (`TikTokChannelAnalysisInsight` with optional `google_search` grounding when bio is sparse and deterministic bilingual fallback); wired `channel_context` across `ScriptGenerateRequest`, `ScriptExpandRequest`, `VideoGenerateRequest`, `LLMScriptGenerator`, `LLMWorker`, and `PromptStudioForm.tsx`.

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
- [x] Royalty-free Sound Design & Automatic BGM Audio Ducking (M3.2)
- [x] OpenAI Whisper Word-Level Timestamps & Karaoke Subtitles (M3.3)
- [ ] Phase 4: Slide Editor Canvas Inspection, Mobile Client & AI Avatar (M4.1 - M4.3)
