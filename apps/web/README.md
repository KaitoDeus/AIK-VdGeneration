# AIK-VdGeneration: Web Studio Client (`apps/web`)

## Overview
Web Studio built with **Next.js 15 (App Router)**, **TypeScript (Strict Mode)**, and **Tailwind CSS**, designed strictly following the **StudioBlank Design System** (ultra-minimal monochrome palette `#FAFAFA`/`#0A0A0A`, zero border-radius, zero shadows, `Inter` + `IBM Plex Mono` typography, generous spacing).

## Implemented Features (Phase 2 M2.2)
1. **Top-Right Bilingual UI Switcher (`VIE` / `EN`):**
   - Instant client-side localization between Vietnamese (`VIE` + geometric Vietnam flag SVG) and English (`EN` + geometric Union Jack UK flag SVG) persisted across sessions.
2. **Prompt & Script Studio:**
   - Topic prompt editor with quick templates (`TECH EXPLAINER`, `EDUCATIONAL`, `PITCH DECK`, `MARKETING`).
   - Bilingual language selector (`VI` / `EN`), aspect ratio (`16:9` / `9:16`), visual theme, and target duration controls.
   - Live Voice Audition Player (`POST /api/v1/voices/preview`) for previewing narrator voices before rendering.
2. **Realtime Live Render Telemetry (`WS /ws/jobs/{job_id}`):**
   - Live WebSocket progress bar, 4-stage pipeline checklist, and `IBM Plex Mono` event console.
   - Built-in HTML5 1080p MP4 video player, direct MP4 download, and Remotion Props JSON export.
3. **Interactive Slide Reviewer & Canvas Preview:**
   - Master-detail 48px-row slide selector paired with a live 16:9 / 9:16 slide canvas preview mirroring Remotion layouts.
   - Inline editor for slide headings, layout templates, bullet points, and voiceover scripts, plus direct slide compilation (`POST /api/v1/jobs/compile`).
4. **Inverse Monochrome Jobs Archive:**
   - Recent render history synced with `GET /api/v1/jobs` with one-click job restoration into the studio.

## Quickstart
```bash
# From apps/web
npm install
npm run dev

# Or from repository root
npm run dev:web
```

Open `http://localhost:3000` while running `npm run dev:api` on port `8000`.
