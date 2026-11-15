/**
 * Audio-First Frame Synchronization & Metadata Utilities (Milestone M1.4).
 * Implements formulas from .agent/rules/audio-sync-rules.md and .agent/skills/remotion-render-engine/SKILL.md.
 */

import { SlideData, ThemeConfig, VideoPresentationProps } from '../types';

export const DEFAULT_FPS = 30;
export const DEFAULT_WIDTH = 1920;
export const DEFAULT_HEIGHT = 1080;

export const PADDING_BEFORE_SEC = 0.2;
export const PADDING_AFTER_SEC = 0.5;
export const MIN_SLIDE_FRAMES = 90; // Minimum 3.0 seconds at 30 FPS

export const DEFAULT_THEME: Required<ThemeConfig> = {
  backgroundColor: '#0f172a',
  primaryColor: '#38bdf8',
  textColor: '#f8fafc',
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
};

/**
 * Resolves a complete theme object by merging user overrides with default design tokens.
 */
export function resolveTheme(theme?: ThemeConfig): Required<ThemeConfig> {
  return {
    backgroundColor: theme?.backgroundColor || DEFAULT_THEME.backgroundColor,
    primaryColor: theme?.primaryColor || DEFAULT_THEME.primaryColor,
    textColor: theme?.textColor || DEFAULT_THEME.textColor,
    fontFamily: theme?.fontFamily || DEFAULT_THEME.fontFamily,
  };
}

/**
 * Computes the exact frame duration for a single slide based on its voiceover audio duration.
 * Formula (.agent/rules/audio-sync-rules.md):
 *   totalSlideSeconds = PADDING_BEFORE_SEC + audioDurationSeconds + PADDING_AFTER_SEC
 *   durationInFrames = Math.max(90, Math.ceil(totalSlideSeconds * fps))
 */
export function resolveSlideDurationInFrames(
  slide: SlideData,
  fps: number = DEFAULT_FPS
): number {
  if (
    typeof slide.calculated_frames === 'number' &&
    Number.isFinite(slide.calculated_frames) &&
    slide.calculated_frames >= MIN_SLIDE_FRAMES
  ) {
    return Math.round(slide.calculated_frames);
  }

  const audioSeconds = Math.max(0.1, Number(slide.voiceover_duration_seconds) || 0);
  const totalSlideSeconds = PADDING_BEFORE_SEC + audioSeconds + PADDING_AFTER_SEC;
  // Round to 9 decimal places to eliminate IEEE 754 floating-point drift before Math.ceil
  const exactFrames = Number((totalSlideSeconds * fps).toFixed(9));
  return Math.max(MIN_SLIDE_FRAMES, Math.ceil(exactFrames));
}

/**
 * Dynamically calculates total composition metadata (durationInFrames, fps, width, height)
 * from the input slides array. Never hardcodes composition length statically.
 */
export function calculatePresentationMetadata(props: VideoPresentationProps): {
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
} {
  const fps = props.fps && props.fps > 0 ? props.fps : DEFAULT_FPS;
  const width = props.width && props.width > 0 ? props.width : DEFAULT_WIDTH;
  const height = props.height && props.height > 0 ? props.height : DEFAULT_HEIGHT;

  if (!Array.isArray(props.slides) || props.slides.length === 0) {
    return {
      durationInFrames: MIN_SLIDE_FRAMES,
      fps,
      width,
      height,
    };
  }

  const totalFrames = props.slides.reduce((acc, slide) => {
    return acc + resolveSlideDurationInFrames(slide, fps);
  }, 0);

  return {
    durationInFrames: Math.max(MIN_SLIDE_FRAMES, totalFrames),
    fps,
    width,
    height,
  };
}
