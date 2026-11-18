/**
 * Dynamic Karaoke Caption Timing Utilities (Milestone M3.3).
 * Groups word-level timestamps into readable lower-third lines and identifies
 * the actively spoken word at any video frame.
 */

import { WordTimestamp } from '../types';
import { PADDING_BEFORE_SEC } from './timing';

export interface CaptionLineChunk {
  words: WordTimestamp[];
  startSeconds: number;
  endSeconds: number;
}

export interface ActiveCaptionState {
  lineWords: WordTimestamp[];
  activeWordIndex: number;
  speechTimeSeconds: number;
}

/**
 * Groups word timestamps into readable lines capped at `maxWordsPerLine`.
 * Breaks early when a word ends with terminal sentence punctuation (., !, ?).
 */
export function groupWordsIntoLines(
  words: WordTimestamp[],
  maxWordsPerLine: number = 6
): CaptionLineChunk[] {
  if (!Array.isArray(words) || words.length === 0) return [];
  const limit = Math.max(2, Math.min(12, Math.round(maxWordsPerLine)));
  const lines: CaptionLineChunk[] = [];

  let current: WordTimestamp[] = [];
  for (const w of words) {
    current.push(w);
    const endsSentence = /[.!?]$/.test(w.word.trim());
    if (current.length >= limit || endsSentence) {
      lines.push({
        words: current,
        startSeconds: current[0].start_seconds,
        endSeconds: current[current.length - 1].end_seconds,
      });
      current = [];
    }
  }

  if (current.length > 0) {
    lines.push({
      words: current,
      startSeconds: current[0].start_seconds,
      endSeconds: current[current.length - 1].end_seconds,
    });
  }

  return lines;
}

/**
 * Resolves which caption line and active word index match the current slide frame.
 */
export function resolveActiveCaptionState(
  words: WordTimestamp[],
  frame: number,
  fps: number,
  audioOffsetSeconds: number = PADDING_BEFORE_SEC,
  maxWordsPerLine: number = 6
): ActiveCaptionState | null {
  const safeFps = fps > 0 ? fps : 30;
  const speechTimeSeconds = frame / safeFps - audioOffsetSeconds;
  if (speechTimeSeconds < -0.05) {
    return null;
  }

  const lines = groupWordsIntoLines(words, maxWordsPerLine);
  if (lines.length === 0) return null;

  const activeLine = lines.find(
    (line) =>
      speechTimeSeconds >= line.startSeconds - 0.08 &&
      speechTimeSeconds <= line.endSeconds + 0.15
  );
  if (!activeLine) return null;

  let activeWordIndex = 0;
  for (let i = 0; i < activeLine.words.length; i += 1) {
    const item = activeLine.words[i];
    if (speechTimeSeconds >= item.start_seconds) {
      activeWordIndex = i;
    }
  }

  return {
    lineWords: activeLine.words,
    activeWordIndex,
    speechTimeSeconds: Number(speechTimeSeconds.toFixed(3)),
  };
}
