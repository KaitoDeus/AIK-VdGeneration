# AIK-VdGeneration: Text-to-Speech (TTS) Setup Guide

This guide details how to configure bilingual English and Vietnamese voiceover synthesis and extract exact durations for audio-driven Remotion frame timing.

---

## 1. Provider Comparison

| Provider | Vietnamese Quality | English Quality | Pricing | Setup Difficulty | Best Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Edge-TTS** (`edge-tts >= 7.3.1`) | High (Natural, clear intonation) | High (Native neural studio voices) | Free | Minimal (No API key required) | Local dev, testing, zero-cost production |
| **ElevenLabs** (`eleven_multilingual_v2`) | Studio (High emotional fidelity) | Studio (Industry benchmark) | Paid per character | Easy (API key required) | Commercial narrations, expressive tone |
| **FPT.AI / Vbee** | High (Regional VN accents) | Basic | Paid | Moderate | Domestic Vietnamese enterprise workloads |

---

## 2. Option A: Edge-TTS (Zero-Cost Neural Default)

Edge-TTS (`edge-tts >= 7.3.1`) connects directly to Microsoft's neural speech synthesis endpoints without requiring a subscription key.

### Configured Default Voice IDs:
- **Vietnamese Female (Standard Northern):** `vi-VN-HoaiMyNeural`
- **Vietnamese Male (Standard Northern):** `vi-VN-NamMinhNeural`
- **English Male (Standard US):** `en-US-GuyNeural`
- **English Female (Expressive US):** `en-US-JennyNeural`

### Python Usage Example:
```python
import asyncio
import edge_tts

async def synthesize_speech(text: str, voice: str, output_path: str) -> None:
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)
    print(f"Audio saved to: {output_path}")

# asyncio.run(synthesize_speech("Welcome to AIK-VdGeneration", "en-US-GuyNeural", "slide_1.mp3"))
```

---

## 3. Option B: ElevenLabs (Commercial Production)

Set `ELEVENLABS_API_KEY` in `services/api-gateway/.env`. If `ELEVENLABS_API_KEY` is blank or unreachable, `TTSAudioPipeline` logs a warning and falls back cleanly to `edge-tts` so jobs do not fail.

### Recommended Voice Settings:
- **Model:** `eleven_multilingual_v2`
- **Voice IDs:** `21m00Tcm4TlvDq8ikWAM` (Rachel), `ErXwobaYiN019PkySvjV` (Antoni)

---

## 4. Audio Duration Verification & Timeline Sync

All synthesized slide files are verified against minimum size (`> 10 KB`) and valid MP3 frames via `mutagen` (`services/api-gateway/src/services/tts_service.py`) before computing Remotion frame counts:

$$\text{calculated\_frames} = \max\left(90,\; \lceil (0.2 + \text{audioDurationSeconds} + 0.5) \times 30 \rceil\right)$$

During video rendering, `SlidePresentation.tsx` also mixes optional royalty-free background music (`BGMService`) applying `-18 dB` voiceover attenuation during active speech windows and `+3 dB` transition swells between slides.
