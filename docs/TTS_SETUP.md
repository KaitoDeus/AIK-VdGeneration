# AIK-VdGeneration: Text-to-Speech (TTS) Setup Guide

This guide details how to integrate and configure high-quality English and Vietnamese voiceovers for video slide narrations.

---

## 1. Provider Comparison

| Provider | Vietnamese Quality | English Quality | Pricing | Setup Difficulty | Best Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Edge-TTS** (Microsoft Neural) | ⭐⭐⭐⭐ (Rất tự nhiên, rõ chữ) | ⭐⭐⭐⭐ (Chuẩn bản ngữ) | **Miễn phí** | Rất dễ (Không cần API key) | **MVP, Local dev, Testing** |
| **ElevenLabs** | ⭐⭐⭐⭐⭐ (Biểu cảm cảm xúc cao) | ⭐⭐⭐⭐⭐ (Đỉnh cao thế giới) | Trả phí theo ký tự | Dễ (Cần API key) | **Production, Premium Video** |
| **FPT.AI / Vbee** | ⭐⭐⭐⭐ (Chuẩn báo đài VN) | ⭐⭐ (Cơ bản) | Trả phí | Trung bình | **Doanh nghiệp nội địa VN** |

---

## 2. Option A: Edge-TTS (Zero-Cost Setup for MVP)

Edge-TTS uses Microsoft Edge's internal cloud speech service. It provides studio-grade neural voices without any API key or subscription.

### Recommended Voice IDs:
- **Vietnamese (Female - Northern standard):** `vi-VN-HoaiMyNeural`
- **Vietnamese (Male - Northern standard):** `vi-VN-NamMinhNeural`
- **English (Male - US Natural):** `en-US-GuyNeural`
- **English (Female - US Expressive):** `en-US-JennyNeural`

### Python Implementation Example:
```python
import asyncio
import edge_tts

async def synthesize_speech(text: str, voice: str, output_path: str):
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)
    print(f"Audio saved to: {output_path}")

# Run:
# asyncio.run(synthesize_speech("Chào mừng bạn đến với dự án AIK-VdGeneration", "vi-VN-HoaiMyNeural", "output.mp3"))
```

### Node.js Implementation Example:
Install: `npm install edge-tts` or run via CLI command.

---

## 3. Option B: ElevenLabs (Production Grade)

ElevenLabs provides human-like breathing, pauses, and emotional coloring.

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

To calculate video frames dynamically, the exact audio length in milliseconds is extracted:

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
