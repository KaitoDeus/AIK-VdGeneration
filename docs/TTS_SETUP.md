# AIK-VdGeneration: Text-to-Speech (TTS) Setup Guide

This guide details how to integrate and configure high-quality English and Vietnamese voiceovers for video slide narrations.

---

## 1. Provider Comparison

| Provider | Vietnamese Quality | English Quality | Pricing | Setup Difficulty | Best Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Edge-TTS** (Microsoft Neural) | ⭐⭐⭐⭐ (Natural, clear intonation) | ⭐⭐⭐⭐ (Native studio standard) | **Free** | Very easy (No API key required) | **MVP, Local dev, Testing** |
| **ElevenLabs** | ⭐⭐⭐⭐⭐ (High emotional fidelity) | ⭐⭐⭐⭐⭐ (Industry gold standard) | Paid per character | Easy (API key required) | **Production, Premium Video** |
| **FPT.AI / Vbee** | ⭐⭐⭐⭐ (Regional VN broadcast accent) | ⭐⭐ (Basic) | Paid | Moderate | **Domestic Vietnamese Enterprise** |

---

## 2. Option A: Edge-TTS (Zero-Cost Setup for MVP)

Edge-TTS uses Microsoft Edge's cloud speech service. It provides studio-grade neural voices without requiring an API key or subscription.

### Recommended Voice IDs:
- **Vietnamese (Female - Standard Northern):** `vi-VN-HoaiMyNeural`
- **Vietnamese (Male - Standard Northern):** `vi-VN-NamMinhNeural`
- **English (Male - Natural US):** `en-US-GuyNeural`
- **English (Female - Expressive US):** `en-US-JennyNeural`

### Python Implementation Example:
```python
import asyncio
import edge_tts

async def synthesize_speech(text: str, voice: str, output_path: str):
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)
    print(f"Audio saved to: {output_path}")

# Run:
# asyncio.run(synthesize_speech("Welcome to the AIK-VdGeneration video platform", "vi-VN-HoaiMyNeural", "output.mp3"))
```

### Node.js Implementation Example:
Install: `npm install edge-tts` or invoke via CLI child process.

---

## 3. Option B: ElevenLabs (Production Grade)

ElevenLabs provides human-like breathing, natural pauses, and dynamic emotional coloring.

### Voice Settings for Vietnamese & English:
- **Model:** `eleven_multilingual_v2`
- **Recommended Voice IDs:**
  - `21m00Tcm4TlvDq8ikWAM` (Rachel - Friendly narrator)
  - `ErXwobaYiN019PkySvjV` (Antoni - Professional presenter)

### Node.js Example:
```typescript
import axios from 'axios';
import fs from 'fs';

export async function generateElevenLabsAudio(text: string, voiceId: string, outputPath: string) {
  const response = await axios({
    method: 'post',
    url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    data: {
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.2,
      },
    },
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    responseType: 'arraybuffer',
  });

  fs.writeFileSync(outputPath, Buffer.from(response.data));
}
```

---

## 4. Extracting Exact Duration in Node.js

To calculate video frames dynamically, the exact audio length in seconds/milliseconds is extracted:

```typescript
import { parseFile } from 'music-metadata';

export async function getAudioDuration(filePath: string): Promise<number> {
  const metadata = await parseFile(filePath);
  if (!metadata.format.duration) {
    throw new Error(`Failed to extract duration for ${filePath}`);
  }
  return metadata.format.duration; // e.g. 7.34 seconds
}
```
