# AI Agents Guidelines & Repository Standards: AIK-VdGeneration

Welcome AI Agent! You are working on **AIK-VdGeneration**, an automated platform converting text prompts into slide-based presentation videos with synchronized English/Vietnamese voiceovers.

---

## 1. Core Architectural Tenets

1. **Audio Drives the Timeline (Audio-First Synchronicity):**
   - Video frame duration is NEVER hardcoded.
   - For every slide: `DurationInFrames = Math.ceil((audioDurationSeconds + paddingSeconds) * FPS)`.
   - The total video duration is the sum of all slide audio segments plus transitions.

2. **Strict Schema Contracts:**
   - Any LLM output MUST be validated against `docs/API_SPEC.md` JSON Schema before sending to audio/video pipelines.
   - Never pass unformatted or freeform markdown directly to the video renderer.

3. **Asynchronous Decoupled Execution:**
   - Video rendering is CPU/GPU-intensive. The API gateway must immediately acknowledge generation requests with a `job_id`.
   - Long-running jobs run via worker queues (BullMQ/Redis), reporting progress over WebSockets.

---

## 2. Directory & Component Boundaries

- `apps/web`: Next.js web studio (Prompt UI, live slide preview, export monitor).
- `apps/mobile`: Mobile client interface (Flutter / React Native).
- `services/api-gateway`: FastAPI / Node.js backend orchestration, queue dispatch, database.
- `services/video-renderer`: Remotion composition templates, typography, transition physics, asset stitching.
- `.agent/skills/`: Custom workflow skills for prompt engineering, audio sync, and Remotion rendering.
- `docs/`: Ground truth architecture, roadmaps, and API specifications.
- `MEMORY.md`: Project state, architectural decisions, and current implementation milestone.

---

## 3. Bilingual Voiceover (TTS) Guidelines

- **English (en-US):**
  - Primary: ElevenLabs (`eleven_multilingual_v2` / `eleven_turbo_v2_5`)
  - Secondary/Dev: OpenAI TTS (`tts-1`) or Edge-TTS (`en-US-GuyNeural`).
- **Vietnamese (vi-VN):**
  - Primary: ElevenLabs Multilingual (natural intonation, high emotional fidelity)
  - Enterprise/Domestic: FPT.AI / Vbee / Zalo AI (standard Northern/Southern accents)
  - Development/Testing: Edge-TTS (`vi-VN-HoaiMyNeural`, `vi-VN-NamMinhNeural`).
- Audio files must be saved with standardized naming: `slide_{index}_{hash}.mp3` and validated for valid audio headers before feeding to Remotion.

---

## 4. Coding & Commit Rules

- **Languages:** TypeScript (Strict Mode) for Frontend & Remotion; Python 3.12+ or TypeScript for API Gateway.
- **Styling:** Tailwind CSS with fluid typography, responsive slide ratios (16:9 widescreen default: 1920x1080).
- **Error Handling:** Every external API call (LLM, TTS, Stock Photos) must have timeout and retry mechanisms.
- When adding new features or completing milestones, always update `MEMORY.md` and `docs/ROADMAP.md`.
