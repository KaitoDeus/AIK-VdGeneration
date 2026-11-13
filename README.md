# AIK-VdGeneration (AI Video Slide Presentation Generator)

> Automated platform transforming text prompts into presentation videos with fluid animations and synchronized bilingual (English / Vietnamese) voiceovers.

---

## 📁 Project Architecture & Directory Layout

```
D:\AIK-VdGeneration/
├── .agent/                             # AI Agent Workflows, Skills & Workspace Rules
│   ├── rules/
│   │   ├── architecture-rules.md       # Service boundary & independence rules
│   │   └── audio-sync-rules.md         # Formula for audio duration & frame synchronization
│   └── skills/
│       ├── video-prompt-engineering/   # Prompt skill: Transform ideas into structured JSON
│       ├── tts-audio-sync/             # TTS skill: Generate En/Vi voiceovers & extract durations
│       └── remotion-render-engine/     # Remotion skill: Spring motion & video render pipeline
├── apps/
│   ├── web/                            # Web Studio UI (Next.js 14+ & Tailwind CSS)
│   └── mobile/                         # Mobile App Client (Flutter / React Native)
├── services/
│   ├── api-gateway/                    # API Backend orchestrator (FastAPI / Python)
│   └── video-renderer/                 # Video rendering engine via React (Remotion)
├── docs/                               # System Architecture & Technical Specifications
│   ├── ARCHITECTURE.md                 # System architecture overview & Mermaid flow diagrams
│   ├── ROADMAP.md                      # 4-Phase implementation roadmap (MVP to Production)
│   ├── API_SPEC.md                     # JSON Schema contracts & WebSocket protocol
│   └── TTS_SETUP.md                    # Bilingual TTS setup guide (Edge-TTS, ElevenLabs, FPT.AI)
├── scripts/
│   └── verify-env.ps1                  # System runtime & environment verification script
├── AGENTS.md                           # Standards and rules for AI Coding Agents
├── GEMINI.md                           # Behavioral context & execution rules for Gemini / Antigravity
├── MEMORY.md                           # Architectural Decision Records (ADR) & active milestone tracking
└── .gitignore                          # Monorepo-wide ignore rules for binaries, caches & secrets
```

---

## 🧠 AI Skills & Context Engine

The repository includes a comprehensive context and decision framework for AI Agents (Antigravity, Cursor, Gemini):
1. **`MEMORY.md`:** Tracks all Architectural Decision Records (ADRs), current milestone progress, and required secrets.
2. **`AGENTS.md` & `GEMINI.md`:** Enforces core architectural tenets, primarily: **"Audio Drives the Timeline (Audio-First Synchronicity)"**.
3. **`.agent/skills/`:** Provides three standard operational procedures:
   - `video-prompt-engineering`: Strict LLM prompting to generate valid slide script JSON.
   - `tts-audio-sync`: Audio generation, precise duration extraction, and transition padding.
   - `remotion-render-engine`: Programmatic video generation with spring physics in React.

---

## 🗺️ Implementation Roadmap Summary

- **Phase 1 (Weeks 1 - 3) [IN PROGRESS]:** Core MVP. Prompt -> LLM -> JSON Script -> Edge-TTS (English/Vietnamese) -> Remotion renders 1080p `.mp4`.
- **Phase 2 (Weeks 4 - 6):** Asynchronous Job Queue (Redis + BullMQ) + Next.js Web Studio for real-time video generation.
- **Phase 3 (Weeks 7 - 9):** Distributed Cloud Rendering (Remotion Lambda), automatic background music ducking, and karaoke subtitles.
- **Phase 4 (Weeks 10 - 12+):** Cross-platform Mobile App, interactive slide editor canvas, and digital AI avatar presenter.

For the detailed breakdown, see: [docs/ROADMAP.md](file:///D:/AIK-VdGeneration/docs/ROADMAP.md).

---

## 🚀 Environment Verification

To verify that your development environment has all necessary runtimes and CLI tools installed, run in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-env.ps1
```
