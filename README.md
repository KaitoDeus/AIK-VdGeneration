# AIK-VdGeneration (AI Video Slide Presentation Generator)

> Automated platform converting text prompts into synchronized 1080p presentation videos with bilingual (English / Vietnamese) voiceovers, Ken Burns stock imagery, mood BGM ducking, and animated karaoke subtitles.

---

## Project Architecture & Directory Layout

```text
D:\AIK-VdGeneration/
├── .agent/                             # AI Agent Workflows, Skills & Workspace Rules
│   ├── rules/
│   │   ├── architecture-rules.md       # Service boundary & independence rules
│   │   └── audio-sync-rules.md         # Audio-first duration & frame synchronization formula
│   └── skills/
│       ├── video-prompt-engineering/   # Prompt skill: Transform ideas into structured JSON
│       ├── tts-audio-sync/             # TTS skill: Generate EN/VI voiceovers & BGM ducking rules
│       └── remotion-render-engine/     # Remotion skill: Spring motion & composition pipeline
├── apps/
│   ├── web/                            # Web Studio UI (Next.js 15 App Router, StudioBlank Design)
│   └── mobile/                         # Mobile Client App (Phase 4 Planned: Flutter / React Native)
├── services/
│   ├── api-gateway/                    # FastAPI Backend Orchestrator, Workers, TTS, BGM, Whisper & Storage
│   └── video-renderer/                 # React + Remotion 4.0 Rendering Engine & Lambda Farm Scripts
├── docs/                               # Ground-Truth Architecture, API Contracts, Guides & Roadmap
│   ├── USER_GUIDE.md                   # Complete English User, CLI, Web Studio & Operations Guide
│   ├── ARCHITECTURE.md                 # End-to-end architecture overview & fault-tolerance matrix
│   ├── API_SPEC.md                     # REST endpoints, JSON schemas & WebSocket telemetry spec
│   ├── ROADMAP.md                      # 4-Phase implementation roadmap (Phases 1 - 4)
│   └── TTS_SETUP.md                    # Bilingual TTS configuration guide (Edge-TTS, ElevenLabs, FPT.AI)
├── scripts/
│   └── verify-env.ps1                  # Windows PowerShell runtime verification utility
├── docker-compose.yml                  # Redis 7 infrastructure for distributed job queues
├── package.json                        # Monorepo workspace scripts
├── AGENTS.md                           # Standards and rules for AI Coding Agents
├── GEMINI.md                           # Execution priorities for Gemini / Antigravity
├── MEMORY.md                           # Architectural Decision Records (ADR-001 to ADR-011)
└── .gitignore                          # Monorepo-wide ignore rules for binaries, caches & secrets
```

---

## Core Capabilities Implemented (Phases 1 - 3)

1. **AI Slide Scripting (`services/api-gateway`):** Gemini 3.8 Flash (`google-genai` SDK Interactions API with automatic fallback to `gemini-4-hydrogen` or offline dev mock) outputs strict JSON conforming to `PresentationScript`.
2. **Bilingual Voiceover & Audio-First Timeline:** Edge-TTS (`vi-VN-HoaiMyNeural`, `vi-VN-NamMinhNeural`, `en-US-GuyNeural`, `en-US-JennyNeural`) and ElevenLabs Multilingual v2 with `mutagen` duration extraction driving Remotion frames (`Math.max(90, Math.ceil((0.2 + audioSec + 0.5) * 30))`).
3. **Remotion 5 Slide Templates & Ken Burns Motion:** `title_intro`, `bullet_list`, `split_card`, `quote_highlight`, and `conclusion_cta` with alternating slow pan/zoom backdrops from Unsplash / Pexels (graceful radial-gradient fallback).
4. **Distributed Queue & Cloud Scale:** Redis / BullMQ-pattern stage queues (`llm`, `tts`, `render`) with automatic in-memory fallback, 3-attempt retries + DLQ, WebSocket telemetry (`/ws/jobs/{job_id}`), AWS S3 / Cloudflare R2 SigV4 signed download URLs, and 50-chunk Remotion Lambda rendering.
5. **Sound Design & Whisper Subtitles:** 4 curated BGM moods (`inspiring`, `tech`, `corporate`, `relaxed`) with automatic `-18 dB` speech ducking (`+3 dB` transition swells), OpenAI Whisper word-level timestamps + monotonic alignment fallback, `.srt` export, and animated karaoke overlays.
6. **Bilingual Next.js Web Studio (`apps/web`):** Monochrome flat StudioBlank UI with top-right `VIE`/`EN` flag switcher, voice & BGM audition players, interactive slide & stock-backdrop editor, and Chrome Playwright verification.

---

## Quick Start

### 1. Verify Environment
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-env.ps1
```

### 2. Generate a Video via CLI
```bash
npm run generate -- --prompt "Event-Driven Cloud Architecture" --lang en --bgm-mood tech --subtitles --output out/demo.mp4
```

### 3. Run the Full Web Studio & API Stack
```bash
# Terminal 1: Start API Gateway (port 8000)
npm run dev:api

# Terminal 2: Start Next.js Web Studio (port 3000)
npm run dev:web
```
Open `http://localhost:3000` in your browser. See [docs/USER_GUIDE.md](docs/USER_GUIDE.md) for complete setup, API configuration, Remotion Lambda deployment, and testing instructions.

---

## Implementation Roadmap Summary

- **Phase 1 (Weeks 1 - 3) [COMPLETED 5/5]:** Core MVP (`M1.1` Architecture -> `M1.5` CLI Pipeline Runner).
- **Phase 2 (Weeks 4 - 6) [COMPLETED 4/4]:** Async Redis Queues & DLQ, StudioBlank Web Studio, Unsplash/Pexels Visuals + Ken Burns, and S3/R2 Signed Storage.
- **Phase 3 (Weeks 7 - 9) [COMPLETED 3/3]:** Remotion Lambda 50-Chunk Farm, Royalty-Free BGM Ducking (`-18 dB`), and Whisper Word-Level Karaoke Subtitles + `.SRT` Export.
- **Phase 4 (Weeks 10 - 12+) [PENDING 0/3]:** Advanced Slide Canvas Inspector (`M4.1`), Mobile Client (`M4.2`), and Digital Human AI Avatar (`M4.3`).

Detailed tracker: [docs/ROADMAP.md](docs/ROADMAP.md)
