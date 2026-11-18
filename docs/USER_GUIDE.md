# AIK-VdGeneration User & Operations Guide

This guide explains how to install, configure, operate, and test **AIK-VdGeneration** across both its **Command-Line Pipeline (CLI)** and **Next.js Web Studio + FastAPI Gateway** interfaces.

---

## 1. System Prerequisites

Verify that required runtimes are available in your shell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-env.ps1
```

| Runtime / Tool | Recommended Version | Purpose |
| :--- | :--- | :--- |
| **Python** | 3.12+ (tested on 3.13.5) | FastAPI gateway, LLM orchestration, TTS synthesis, BGM, Whisper captions, storage |
| **Node.js & npm** | Node 20+ / 22+ | Remotion video composition engine (`4.0.543`) and Next.js 15 Web Studio |
| **Git** | 2.40+ | Version control and workspace state |
| **Redis (Optional)** | 7.x via Docker (`docker-compose.yml`) | Distributed stage queues & WebSocket Pub/Sub (falls back to in-memory queue if absent) |
| **Chrome / Chromium** | System Chrome or Remotion Chromium | Headless Remotion MP4 rendering & Playwright UI verification |

---

## 2. Installation & Environment Setup

### 2.1 Install Dependencies
```bash
# Python backend dependencies
python -m pip install -r services/api-gateway/requirements.txt

# Video Renderer dependencies (Remotion + @remotion/lambda)
npm --prefix services/video-renderer install

# Next.js Web Studio dependencies
npm --prefix apps/web install
```

### 2.2 Configure Environment Variables
Copy the environment templates and fill in any optional provider keys:

```bash
cp services/api-gateway/.env.example services/api-gateway/.env
cp apps/web/.env.example apps/web/.env.local
```

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `8000` | API Gateway HTTP/WebSocket port |
| `GEMINI_API_KEY` | `""` | Google Gemini API key (`gemini-3.8-flash`). Leave blank for deterministic dev mock scripts |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Primary LLM model (`GEMINI_FALLBACK_MODEL=gemini-4-hydrogen`) |
| `ELEVENLABS_API_KEY` | `""` | ElevenLabs voice key; automatically falls back to free `edge-tts` if empty/unavailable |
| `UNSPLASH_ACCESS_KEY` | `""` | Unsplash photo search token; cascades to Pexels or radial gradient fallback |
| `PEXELS_API_KEY` | `""` | Pexels photo search token; falls back to CSS gradient if missing |
| `STOCK_IMAGE_PROVIDER` | `auto` | `auto`, `unsplash`, `pexels`, or `disabled` |
| `QUEUE_MODE` | `auto` | `auto`, `redis`, or `memory` |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection string when running distributed workers |
| `USE_EXTERNAL_WORKER` | `false` | Set `true` to offload tasks to `python services/api-gateway/src/worker.py` |
| `STORAGE_PROVIDER` | `auto` | `auto`, `local`, `s3`, or `r2` |
| `AWS_S3_BUCKET` / `R2_ACCOUNT_ID` | `""` | S3 bucket or Cloudflare R2 account ID for SigV4 presigned MP4 delivery |
| `CDN_PUBLIC_BASE_URL` | `""` | Optional public CDN prefix (CloudFront / Cloudflare) |
| `SIGNED_URL_EXPIRY_SECONDS` | `3600` | Presigned URL expiration window (`60` to `604800` seconds) |
| `RENDER_ENGINE` | `auto` | `auto`, `local`, or `lambda` (`@remotion/lambda` 50-chunk distributed farm) |
| `REMOTION_LAMBDA_FUNCTION_NAME` | `""` | Deployed AWS Lambda render function name |
| `REMOTION_LAMBDA_SERVE_URL` | `""` | S3 URL of deployed Remotion bundle (`npm run lambda:deploy`) |
| `OPENAI_API_KEY` | `""` | OpenAI key for Whisper (`whisper-1`) word timestamps; falls back cleanly to proportional alignment |

Zero-Cost Local Development Mode: Even without external API keys (`GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `UNSPLASH_ACCESS_KEY`, AWS credentials, or `OPENAI_API_KEY`), the entire pipeline remains runnable using Gemini mock fallback + Edge-TTS neural voices + CSS gradient slides + local stereo WAV BGM + proportional caption alignment + local Remotion MP4 rendering.

---

## 3. Mode 1: Command-Line Pipeline (CLI)

Generate a complete 1080p MP4 video directly from a single command in the repository root:

```bash
npm run generate -- --prompt "Cloud Native Architecture" --lang en --output out/cloud_demo.mp4
```

### Full Phase 3 CLI Example (Bilingual + Stock Visuals + BGM Ducking + Karaoke Subtitles)
```bash
python services/api-gateway/src/cli.py \
  --prompt "Microservices vs Monolith Architecture" \
  --lang en \
  --duration 45 \
  --theme modern_tech \
  --aspect-ratio 16:9 \
  --voice-provider edge_tts \
  --bgm-mood tech \
  --subtitles \
  --subtitle-style karaoke_pill \
  --output out/architecture_karaoke.mp4
```

### Supported CLI Options
- `--prompt "<text>"` (required): Presentation topic or source text.
- `--lang vi|en`: Output script and voiceover language (`vi` default).
- `--output <path>`: Destination `.mp4` path (`out/output.mp4` default).
- `--duration <sec>`: Target total duration hint (`45` default).
- `--theme modern_tech|corporate|minimal`: Remotion color and font preset.
- `--aspect-ratio 16:9|9:16`: Widescreen `1920x1080` or Vertical `1080x1920`.
- `--voice-provider edge_tts|elevenlabs|fpt` and `--voice-id <id>`: Narrator voice selection.
- `--no-stock-visuals`: Skip Unsplash/Pexels lookups and render CSS radial gradients.
- `--bgm-mood inspiring|tech|corporate|relaxed`: Attach royalty-free looping BGM matching mood.
- `--no-bgm-ducking`: Disable automatic `-18 dB` BGM ducking during voiceover speech.
- `--subtitles` and `--subtitle-style karaoke_pill|minimal_line|bold_highlight`: Generate word timestamps (Whisper or proportional alignment), render dynamic karaoke captions, and save `subtitles.srt`.
- `--render-engine auto|local|lambda`: Route Stage 3 rendering locally or via Remotion Lambda.
- `--storage-provider auto|local|s3|r2`: Persist output MP4 locally or upload to S3 / R2.
- `--frames 0-89` / `--skip-render`: Fast partial frame preview or audio-only asset compilation.

Artifacts created per run are stored in `services/api-gateway/.temp/jobs/{job_id}/`, including `script.json`, `remotion_props.json`, `subtitles.srt` (when subtitles enabled), `audio/*.mp3`, and staged assets cleaned automatically from `services/video-renderer/public/` after rendering.

---

## 4. Mode 2: Web Studio & API Gateway

### 4.1 Starting Local Development Services

1. **Optional Redis Queue Backend:**
   ```bash
   docker-compose up -d redis
   ```
   (If Docker/Redis is not running, the API Gateway automatically uses `LocalMemoryQueueBackend`.)

2. **Start API Gateway (Port 8000):**
   ```bash
   npm run dev:api
   ```

3. **Optional Dedicated Queue Worker Daemon (when `USE_EXTERNAL_WORKER=true`):**
   ```bash
   npm run worker
   ```

4. **Start Next.js Web Studio (Port 3000):**
   ```bash
   npm run dev:web
   ```
   Navigate to `http://localhost:3000`.

### 4.2 Web Studio Workflow Walkthrough

1. **Header & Interface Language Switcher:**
   - Top-right `VIE` (Vietnam flag) and `EN` (UK flag) switcher toggles every label across the workspace immediately and persists selection in `localStorage`.
   - Status chips confirm API connectivity (`API ONLINE` / `API TRUC TUYEN`), active LLM model, and queue backend.

2. **Section 01 - Prompt, Voice & Audio Configuration:**
   - Choose a Quick Template (`TECH EXPLAINER`, `EDUCATIONAL`, `PITCH DECK`, `MARKETING`) or enter a custom prompt (minimum 3 characters).
   - Configure Video Language (`VIETNAMESE` / `ENGLISH`), Aspect Ratio (`16:9` or `9:16`), Theme & Duration, and Narrator Voice.
   - Click `AUDITION VOICE SAMPLE` to synthesize and play an MP3 voice sample directly in the browser.
   - **Sound Design & BGM Ducking Bar:** Toggle `Enable Royalty-Free BGM`, choose mood (`INSPIRING`, `TECH`, `CORPORATE`, `RELAXED`), verify `Auto Ducking (-18dB Speech)`, and click `Preview Track` to audition the stereo ambient loop.
   - **Auto Karaoke Subtitles Row:** Toggle Whisper karaoke subtitles and pick a caption style (`KARAOKE PILL`, `MINIMAL LINE`, `BOLD HIGHLIGHT`).
   - Click **Draft Script First** to inspect/edit slides before rendering, or **Generate Presentation** (with optional immediate Remotion MP4 toggle) to execute the full pipeline.

3. **Section 02 - Pipeline Telemetry & Media Delivery:**
   - Streams live `WS /ws/jobs/{job_id}` progress (`0%` queued -> `40%` script -> `80%` audio/assets/BGM/subtitles -> `90%` Remotion render -> `96%` S3/R2 upload -> `100%` complete).
   - Displays badges for storage backend (`LOCAL STREAM`, `AWS S3 SIGNED`, `CLOUDFLARE R2`) and render engine (`LOCAL REMOTION` vs `LAMBDA · 50 CHUNKS`).
   - Built-in HTML5 `<video>` player with buttons for `Export Remotion Props JSON`, `Download Subtitles (.SRT)` (when enabled), `Refresh Signed URL` (for S3/R2 jobs), and `Download 1080p MP4`.

4. **Section 03 - Interactive Slide Reviewer & Stock Backdrop Picker:**
   - Select any slide on the left rail (`+ ADD` / `REMOVE` within 3-8 slides) to inspect live 16:9 / 9:16 layout rendering.
   - Edit heading, layout template (`title_intro`, `bullet_list`, `split_card`, `quote_highlight`, `conclusion_cta`), bullet points, voiceover script, and stock visual keywords.
   - Click **Search Stock Visuals** to browse Unsplash/Pexels candidates, preview the dark contrast scrim directly on the slide canvas, or click **Use Gradient** to fall back cleanly.
   - Click **Compile & Render 1080p MP4** (or audio only) to enqueue `POST /api/v1/jobs/compile`.

5. **Section 04 - Recent Render History (Archive Footer):**
   - Inverse dark footer lists past jobs and storage badges; click any row to reload its script, telemetry, player, and signed links back into the studio.

---

## 5. Serverless Cloud Deployment (Remotion Lambda + S3/R2)

To distribute long renders across ~50 parallel AWS Lambda containers (`15-20s` typical render for a 2-minute video):

1. Configure `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, and `REMOTION_AWS_REGION` in `services/api-gateway/.env`.
2. Deploy the Remotion site bundle and render function:
   ```bash
   npm --prefix services/video-renderer run lambda:deploy
   ```
3. Copy the output `serveUrl` and `functionName` into `REMOTION_LAMBDA_SERVE_URL` and `REMOTION_LAMBDA_FUNCTION_NAME`, and set `RENDER_ENGINE=auto` (or `lambda`).
4. When a render job starts, `RemotionLambdaRenderService` automatically uploads local slide MP3s, stock backdrops, and BGM tracks to S3/R2 HTTPS presigned URLs so headless Chrome containers on Lambda can fetch them directly.

---

## 6. Running the Automated Test Suites

Run verification across all monorepo packages:

```bash
# 1. API Gateway (Pytest: 82 tests covering LLM schemas, TTS, CLI, Queues, Assets, Storage, Lambda, BGM, Whisper)
python -m pytest services/api-gateway/tests/ -v

# 2. Remotion Video Renderer (TypeScript check + Vitest: 32 tests covering layouts, Ken Burns, Lambda, Ducking, Karaoke)
npm --prefix services/video-renderer run typecheck
npm --prefix services/video-renderer test

# 3. Web Studio (TypeScript check + Vitest DOM flows: 16 tests + Production Next build)
npm --prefix apps/web run typecheck
npm --prefix apps/web test
npm --prefix apps/web run build

# 4. Real Headless Chrome E2E & StudioBlank CSS Audit (Playwright: 6 tests across Desktop & Mobile viewports)
npm --prefix apps/web run test:e2e
```
