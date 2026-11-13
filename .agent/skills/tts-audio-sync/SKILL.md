---
name: tts-audio-sync
description: Procedures for generating bilingual (English/Vietnamese) audio narrations, calculating precise durations, and preparing audio assets for video composition.
---

# TTS & Audio Synchronization Skill

## Step-by-Step Procedure

### 1. Engine Selection Logic
- If `target_language === "vi"`:
  - Production default: ElevenLabs `eleven_multilingual_v2` (Voice: "Rachel" or custom trained Vietnamese voice) OR FPT.AI API (`banmai` / `leminh`).
  - Dev/Free default: Edge-TTS voice `vi-VN-HoaiMyNeural` (Female, clear, natural) or `vi-VN-NamMinhNeural` (Male).
- If `target_language === "en"`:
  - Production default: ElevenLabs (`eleven_turbo_v2_5` or `eleven_multilingual_v2`).
  - Dev/Free default: Edge-TTS `en-US-GuyNeural` or `en-US-JennyNeural`.

### 2. Duration Extraction
Audio duration must be determined before invoking the video compiler:

```typescript
import { parseFile } from 'music-metadata';

export async function getAudioDuration(filePath: string): Promise<number> {
  const metadata = await parseFile(filePath);
  if (!metadata.format.duration) {
    throw new Error(`Unable to determine audio duration for ${filePath}`);
  }
  return metadata.format.duration; // returns seconds as float (e.g. 5.42)
}
```

### 3. Audio Normalization & Ducking
- Normalize all speech tracks to `-16 LUFS` to ensure uniform loudness across all slides.
- When background music (BGM) is enabled, reduce BGM volume by `18dB` during voiceover segments and fade back up `3dB` during slide transitions.
