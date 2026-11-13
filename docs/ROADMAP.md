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
- [ ] **M1.2: Orchestrator & LLM Script Generation**
  - Python / Node.js service connecting to Gemini 1.5 Flash / GPT-4o-mini.
  - Conversion of prompt -> Structured Slide JSON with validation.
- [ ] **M1.3: Audio Pipeline (TTS)**
  - Integration of `edge-tts` (free, immediate testing for En & Vi).
  - Integration of ElevenLabs API for high-fidelity English/Vietnamese voiceovers.
  - Audio duration measurement & metadata generation.
- [ ] **M1.4: Remotion Presentation Compositions**
  - Basic slide layouts: `title_intro`, `bullet_list`, `split_card`, `conclusion_cta`.
  - Spring-based smooth animations and typography styling.
  - Video composition combining slides, audio, and transitions.
- [ ] **M1.5: Local CLI Pipeline Runner**
  - Single CLI command: `npm run generate -- --prompt "Topic" --lang vi` to output `output.mp4`.

---

## Phase 2: Asynchronous Job Queue & Web Studio (Weeks 4 - 6)
*Goal: Provide a user-friendly Web UI and decouple rendering from HTTP request cycles.*

### Milestones:
- [ ] **M2.1: Asynchronous Queue Worker**
  - Redis + BullMQ (or Celery) job orchestration.
  - Worker processes dedicated to LLM, TTS generation, and Remotion rendering.
- [ ] **M2.2: Next.js Web Studio (apps/web)**
  - Clean UI with prompt box, language selector, template picker, and voice audition preview.
  - Realtime progress tracker via WebSockets (e.g. "Generating script... 20%", "Synthesizing voice... 50%", "Rendering video... 85%").
- [ ] **M2.3: Asset Integration & Background Visuals**
  - Integration with Unsplash / Pexels API for automated background imagery based on slide keywords.
  - Subtle Ken Burns effect (slow pan & zoom) on background images.
- [ ] **M2.4: Storage & CDN Delivery**
  - Direct upload of final `.mp4` to AWS S3 / Cloudflare R2 with signed download URLs.

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
