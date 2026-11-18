/**
 * Automatic BGM Audio Ducking & Transition Swell Utilities (Milestone M3.2).
 * Implements `.agent/skills/tts-audio-sync/SKILL.md`:
 *  - Reduces BGM gain by 18 dB during voiceover speech windows.
 *  - Swells BGM smoothly (+3 dB) during inter-slide transition windows.
 */

import { SlideData } from '../types';
import {
  DEFAULT_FPS,
  PADDING_BEFORE_SEC,
  resolveSlideDurationInFrames,
} from './timing';

export const DEFAULT_DUCK_ATTENUATION_DB = 18;
export const DEFAULT_TRANSITION_SWELL_DB = 3;
export const DEFAULT_DUCK_FADE_FRAMES = 6; // 0.2s smooth envelope ramp @ 30fps

export interface SpeechWindow {
  slideIndex: number;
  startFrame: number;
  endFrame: number;
}

/** Converts decibels (dB) to linear gain multiplier. */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Extracts per-slide voiceover start/end frame intervals across the composition timeline.
 */
export function buildSpeechWindows(
  slides: SlideData[],
  fps: number = DEFAULT_FPS
): { windows: SpeechWindow[]; totalFrames: number } {
  const safeFps = fps > 0 ? fps : DEFAULT_FPS;
  const offsetFrames = Math.round(PADDING_BEFORE_SEC * safeFps);
  const windows: SpeechWindow[] = [];
  let cursor = 0;

  for (const slide of slides) {
    const slideFrames = resolveSlideDurationInFrames(slide, safeFps);
    const audioSec = Math.max(0.1, Number(slide.voiceover_duration_seconds) || 0);
    const hasAudioTrack = Boolean(slide.voiceover_audio_url || slide.voiceover_duration_seconds > 0);
    if (hasAudioTrack) {
      const speechFrames = Math.min(
        Math.max(1, slideFrames - offsetFrames),
        Math.ceil(audioSec * safeFps)
      );
      windows.push({
        slideIndex: slide.slide_index,
        startFrame: cursor + offsetFrames,
        endFrame: cursor + offsetFrames + speechFrames,
      });
    }
    cursor += slideFrames;
  }

  return { windows, totalFrames: Math.max(1, cursor) };
}

/**
 * Computes per-frame BGM gain applying automatic -18dB speech ducking and smooth
 * +3dB swells during slide transition gaps.
 */
export function computeDuckedBgmVolume(params: {
  frame: number;
  baseVolume?: number;
  speechWindows: SpeechWindow[];
  totalFrames?: number;
  duckingEnabled?: boolean;
  duckAttenuationDb?: number;
  transitionSwellDb?: number;
  fadeFrames?: number;
}): number {
  const base = Math.max(0, Math.min(1, params.baseVolume ?? 0.22));
  if (params.duckingEnabled === false || params.speechWindows.length === 0) {
    return Number(base.toFixed(4));
  }

  const duckDb = Math.max(0, params.duckAttenuationDb ?? DEFAULT_DUCK_ATTENUATION_DB);
  const swellDb = Math.max(0, params.transitionSwellDb ?? DEFAULT_TRANSITION_SWELL_DB);
  const fade = Math.max(1, Math.round(params.fadeFrames ?? DEFAULT_DUCK_FADE_FRAMES));

  const speechGain = base * dbToGain(-duckDb);
  const transitionGain = Math.min(0.45, base * dbToGain(swellDb));

  // Compute maximum ducking factor (0 = full transition swell, 1 = full speech duck)
  let maxDuckFactor = 0;
  const f = params.frame;

  for (const win of params.speechWindows) {
    if (f >= win.startFrame && f <= win.endFrame) {
      maxDuckFactor = 1;
      break;
    }
    if (f >= win.startFrame - fade && f < win.startFrame) {
      const rampIn = (f - (win.startFrame - fade)) / fade;
      maxDuckFactor = Math.max(maxDuckFactor, Math.max(0, Math.min(1, rampIn)));
    } else if (f > win.endFrame && f <= win.endFrame + fade) {
      const rampOut = 1 - (f - win.endFrame) / fade;
      maxDuckFactor = Math.max(maxDuckFactor, Math.max(0, Math.min(1, rampOut)));
    }
  }

  let gain = transitionGain + (speechGain - transitionGain) * maxDuckFactor;

  // Smooth master tail fade-out over the last 12 frames if composition length is known
  if (params.totalFrames && params.totalFrames > 24 && f >= params.totalFrames - 12) {
    const tailProgress = Math.max(0, Math.min(1, (params.totalFrames - f) / 12));
    gain *= tailProgress;
  }

  return Number(Math.max(0, Math.min(1, gain)).toFixed(4));
}
