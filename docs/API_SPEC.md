# AIK-VdGeneration: Data Contracts & API Specifications

Base URL (Local Dev): `http://localhost:8000`
API Version: `v0.5.0+` (Phases 1 - 3)

---

## 1. System Telemetry & Configuration Endpoints

### `GET /api/v1/health`
Returns service status, active queue backend, active cloud storage backend, active render engine (`local` or `lambda`), configured LLM models, and supported TTS providers.

```json
{
  "status": "healthy",
  "service": "AIK-VdGeneration API Gateway",
  "version": "0.5.0",
  "queue_backend": "memory",
  "storage_provider": "local",
  "render_engine": "local",
  "external_worker_enabled": false,
  "default_llm_model": "gemini-3.8-flash",
  "fallback_llm_model": "gemini-4-hydrogen",
  "supported_tts_providers": ["edge_tts", "elevenlabs", "fpt"]
}
```

### `GET /api/v1/queue/stats`
Returns queue depth telemetry (`llm`, `tts`, `render`), Redis connection flag, Dead-Letter Queue (`dead_letter_count`) count, and total tracked jobs.

### `GET /api/v1/render/lambda/config`
Returns Remotion Lambda distributed render farm status (`render_engine_mode`, `active_render_engine`, `lambda_configured`, `region`, `target_chunks` default `50`, `function_name`, `serve_url_configured`).

---

## 2. Voices, Sound Design (BGM) & Stock Visual Catalog Endpoints

### `GET /api/v1/voices?language={vi|en}`
Lists bilingual voice presets for English and Vietnamese narrations.

### `POST /api/v1/voices/preview`
Synthesizes a short audio sample (`audio/mpeg`) for the Web Studio narrator audition player.

### `GET /api/v1/bgm/tracks?mood={inspiring|tech|corporate|relaxed}`
Returns royalty-free curated background music tracks filtered optionally by mood.

### `GET /api/v1/bgm/tracks/{track_id}/preview`
Streams stereo loop audio (`audio/wav` or `audio/mpeg`) for instant track audition in the studio.

### `POST /api/v1/assets/search`
Searches Unsplash / Pexels stock photography by slide keywords (`query`, `aspect_ratio`, `limit`). Never fails on missing keys; returns `"fallback_to_gradient": true` cleanly when unavailable.

### `POST /api/v1/channels/tiktok/analyze`
Reads public metadata from a TikTok creator profile URL (`profile_url`, optional `language`, optional `manual_notes`) using SSR rehydration JSON / OpenGraph meta parsing and Gemini Structured Outputs (`TikTokChannelAnalysisInsight` with bilingual deterministic fallback), returning a `ChannelContextProfile` (`handle`, `display_name`, `bio`, stats, `niche_category`, `content_pillars`, `target_audience`, `tone_and_style`, `recommended_theme`, `suggested_prompt`). Enforces strict SSRF domain allowlisting (`tiktok.com`, `www.tiktok.com`, `m.tiktok.com`), never bypasses anti-bot/CAPTCHA gates (returns HTTP `422` when gated without `manual_notes`), and accepts optional `channel_context` in `POST /api/v1/scripts/generate`, `POST /api/v1/scripts/expand`, and `POST /api/v1/videos/generate`.

---

## 3. Pipeline & Studio Endpoints

### `POST /api/v1/scripts/generate`
Synchronously generates and validates a `PresentationScript` (3 to 30 slides, optional `target_slides`) from a user prompt using Gemini Structured Outputs.

### `POST /api/v1/scripts/expand`
Automatically generates up to 20 additional non-overlapping continuation slides (`additional_slides`, default `10`) for an existing `PresentationScript` using Gemini Structured Outputs (or bilingual deterministic expansion fallback), inserting body slides cleanly before any concluding CTA slide up to the 30-slide deck ceiling.

### `POST /api/v1/audio/synthesize`
Synchronously synthesizes TTS MP3s for a `PresentationScript` and returns compiled `RemotionCompositionProps`.

### `POST /api/v1/videos/generate` -> `202 Accepted`
Queues the full asynchronous pipeline (`LLM -> TTS + Visuals + BGM + Subtitles -> Render + Storage`).

```json
{
  "prompt": "Explain event-driven architecture for engineering teams",
  "language": "en",
  "aspect_ratio": "16:9",
  "video_format": "presentation",
  "target_duration_seconds": 45,
  "style": {
    "theme": "modern_tech",
    "color_palette": "indigo_slate",
    "font_pair": "Inter_Roboto"
  },
  "voice_settings": {
    "provider": "edge_tts",
    "voice_id": "en-US-GuyNeural",
    "speed": 1.0
  },
  "render_video": true,
  "include_stock_visuals": true,
  "bgm_settings": {
    "enabled": true,
    "mood": "tech",
    "track_id": "tech-circuit",
    "volume": 0.22,
    "ducking_enabled": true
  },
  "subtitle_settings": {
    "enabled": true,
    "style": "karaoke_pill",
    "max_words_per_line": 6,
    "highlight_color": "#38bdf8"
  }
}
```

Response (`202 Accepted`):
```json
{
  "job_id": "job_984f88e10cf2",
  "status": "queued",
  "estimated_time_seconds": 45,
  "websocket_url": "ws://localhost:8000/ws/jobs/job_984f88e10cf2",
  "message": "Video generation job accepted."
}
```

### `POST /api/v1/jobs/compile` -> `202 Accepted`
Compiles user-edited slides (`script`, `slide_backgrounds`, `voice_settings`, `bgm_settings`, `subtitle_settings`, `render_video`) directly through TTS -> Asset/BGM/Subtitle enrichment -> Remotion render, bypassing the LLM stage.

---

## 4. Job Inspection, Media & Signed Delivery Endpoints

- `GET /api/v1/jobs?limit=20`: Lists recent jobs (`JobStatusResponse[]`).
- `GET /api/v1/jobs/{job_id}`: Returns full job status, script, `remotion_props`, `storage_provider` (`local | s3 | r2`), `video_download_url`, `render_engine_used` (`local | lambda`), `lambda_chunks_count`, `progress_events`, and `error`.
- `GET /api/v1/jobs/{job_id}/audio/{filename}`: Streams slide voiceover `.mp3` safely (path traversal protected).
- `GET /api/v1/jobs/{job_id}/assets/{filename}`: Streams cached stock backdrop image (`.jpg`, `.png`, `.webp`) safely.
- `GET /api/v1/jobs/{job_id}/subtitles.srt`: Serves synchronized SubRip (`.srt`) captions (`application/x-subrip`) when subtitles were generated.
- `GET /api/v1/jobs/{job_id}/video?redirect={bool}`: Streams local `.mp4` or returns `307 Redirect` to cloud presigned URL when evicted locally or `redirect=true`.
- `GET /api/v1/jobs/{job_id}/video/url?expires_in=3600`: Mints a fresh AWS S3 / Cloudflare R2 SigV4 presigned URL (`VideoDeliveryResponse`, TTL `60s`–`604800s`).

---

## 5. LLM Structured Output Schema (`PresentationScript`)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "language": { "type": "string", "enum": ["vi", "en"] },
    "theme": { "type": "string" },
    "slides": {
      "type": "array",
      "minItems": 3,
      "maxItems": 30,
      "items": {
        "type": "object",
        "properties": {
          "slide_index": { "type": "integer" },
          "layout": {
            "type": "string",
            "enum": ["title_intro", "bullet_list", "split_card", "quote_highlight", "conclusion_cta"]
          },
          "heading": { "type": "string" },
          "bullet_points": {
            "type": "array",
            "maxItems": 5,
            "items": { "type": "string" }
          },
          "voiceover_script": { "type": "string" },
          "visual_keywords": { "type": "string" }
        },
        "required": ["slide_index", "layout", "heading", "voiceover_script", "visual_keywords"]
      }
    }
  },
  "required": ["title", "language", "slides"]
}
```

---

## 6. Remotion Composition Input Props (`RemotionCompositionProps`)

```json
{
  "project_title": "Cloud Computing Fundamentals",
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "total_duration_seconds": 12.6,
  "total_frames": 378,
  "theme": {
    "backgroundColor": "#0f172a",
    "primaryColor": "#38bdf8",
    "textColor": "#f8fafc",
    "fontFamily": "Inter, sans-serif"
  },
  "slides": [
    {
      "slide_index": 1,
      "layout": "title_intro",
      "heading": "What is Cloud Computing?",
      "bullet_points": [
        "Data stored on remote distributed servers",
        "On-demand computing accessible over the Internet"
      ],
      "voiceover_script": "Welcome to cloud computing fundamentals.",
      "voiceover_audio_url": "/audio_temp/job_123/slide_1_ab12.mp3",
      "voiceover_duration_seconds": 5.4,
      "calculated_frames": 183,
      "background_image_url": "/assets/job_123/slide_1_c3d4.jpg",
      "background_asset_provider": "unsplash",
      "word_timestamps": [
        { "word": "Welcome", "start_seconds": 0.0, "end_seconds": 0.45 },
        { "word": "to", "start_seconds": 0.45, "end_seconds": 0.65 },
        { "word": "cloud", "start_seconds": 0.65, "end_seconds": 1.1 }
      ]
    }
  ],
  "bgm": {
    "enabled": true,
    "audio_url": "/music/job_123_tech-circuit.wav",
    "volume": 0.22,
    "mood": "tech",
    "track_id": "tech-circuit",
    "ducking_enabled": true,
    "duck_attenuation_db": 18.0,
    "transition_swell_db": 3.0
  },
  "subtitles": {
    "enabled": true,
    "style": "karaoke_pill",
    "provider_used": "openai_whisper",
    "max_words_per_line": 6,
    "highlight_color": "#38bdf8"
  }
}
```

---

## 7. WebSocket Progress Protocol (`WS /ws/jobs/{job_id}`)

Clients receive JSON progress frames matching `WebSocketProgressEvent`:

```json
{
  "job_id": "job_984f88e10cf2",
  "step": "rendering_video",
  "progress_percentage": 90,
  "message": "Rendering 1080p video frames via Remotion Engine... (90%)",
  "timestamp": "2026-11-18T09:00:00Z"
}
```

Standard step sequence: `queued (0%)` -> `generating_script (20%)` -> `script_ready (40%)` -> `synthesizing_audio (60%)` -> `audio_ready (80%)` -> `rendering_video (90%)` -> `uploading_video (96%, S3/R2 only)` -> `completed (100%)` / `failed`.
