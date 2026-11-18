# AIK-VdGeneration: Web Studio Client (`apps/web`)

## Overview
Web Studio built with **Next.js 15 (App Router)**, **TypeScript (Strict Mode)**, and **Tailwind CSS**, strictly adhering to the **StudioBlank Design System** (monochrome palette `#FAFAFA`/`#0A0A0A`, `0px` border-radius, zero shadows, `Inter` + `IBM Plex Mono` typography, and responsive layouts).

## Implemented Features (Phases 2 & 3)
1. **Top-Right Bilingual UI Switcher (`VIE` / `EN`):**
   - Instant client-side switching between Vietnamese (`VIE` with geometric Vietnam flag SVG) and English (`EN` with geometric UK Union Jack SVG), persisted in `localStorage`.
2. **Prompt, Sound Design & Subtitles Studio (`PromptStudioForm`):**
   - Topic editor with quick templates (`TECH EXPLAINER`, `EDUCATIONAL`, `PITCH DECK`, `MARKETING`), aspect ratio (`16:9` / `9:16`), visual theme, and target duration controls.
   - Narrator voice audition player (`POST /api/v1/voices/preview`).
   - Royalty-free mood BGM selector (`INSPIRING`, `TECH`, `CORPORATE`, `RELAXED`) with track audition (`/api/v1/bgm/tracks/{id}/preview`) and automatic `-18 dB` speech ducking toggle.
   - Automatic Whisper karaoke subtitle controls (`karaoke_pill`, `minimal_line`, `bold_highlight`).
3. **Interactive Slide Reviewer, Canvas & Stock Visuals (`SlideReviewer`):**
   - Master-detail 48px slide selector paired with a live 16:9 / 9:16 preview canvas matching Remotion slide layouts.
   - Inline editor for slide headings, layouts, bullets, voiceover text, and Unsplash/Pexels stock background search (`POST /api/v1/assets/search`) with dark scrim canvas preview and CSS gradient fallback.
4. **Live Pipeline Telemetry, Cloud Storage & Exports (`LiveProgressTracker`):**
   - Live `WS /ws/jobs/{job_id}` progress bar, 4-stage matrix, and `IBM Plex Mono` log console.
   - Delivery badges for storage provider (`LOCAL STREAM`, `AWS S3 SIGNED`, `CLOUDFLARE R2`) and render engine (`LOCAL REMOTION`, `LAMBDA · CHUNKS`).
   - Built-in 1080p MP4 player with Remotion Props JSON export, SubRip `.SRT` subtitle download, Presigned URL refresher, and MP4 download.
5. **Inverse Monochrome Jobs Archive (`JobsArchiveFooter`):**
   - Lists recent jobs via `GET /api/v1/jobs` with one-click session restoration.

## Quickstart & Verification
```bash
# Development server (from apps/web or repo root via `npm run dev:web`)
npm install
npm run dev

# Interactive DOM & component test suite (Vitest + jsdom + Testing Library)
npm run typecheck
npm test

# Production build & real headless Chrome E2E suite (Playwright: desktop & mobile)
npm run build
npm run test:e2e
```

Open `http://localhost:3000` alongside `npm run dev:api` running on port `8000`.
