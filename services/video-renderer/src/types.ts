/**
 * Strict TypeScript Data Contracts for Remotion Video Renderer (Milestone M1.4).
 * Synchronized with docs/API_SPEC.md Section 3 and services/api-gateway/src/schemas.py.
 */

export type SlideLayout =
  | 'title_intro'
  | 'bullet_list'
  | 'split_card'
  | 'quote_highlight'
  | 'conclusion_cta';

export interface ThemeConfig {
  backgroundColor?: string;
  primaryColor?: string;
  textColor?: string;
  fontFamily?: string;
}

export interface BGMConfig {
  enabled: boolean;
  audio_url?: string | null;
  volume?: number;
}

export interface SlideData {
  slide_index: number;
  layout: SlideLayout;
  heading: string;
  bullet_points?: string[];
  voiceover_script?: string;
  voiceover_audio_url?: string;
  voiceover_audio_path?: string;
  voiceover_duration_seconds: number;
  calculated_frames?: number;
  background_image_url?: string | null;
}

export interface VideoPresentationProps {
  project_title: string;
  fps?: number;
  width?: number;
  height?: number;
  total_duration_seconds?: number;
  total_frames?: number;
  theme?: ThemeConfig;
  slides: SlideData[];
  bgm?: BGMConfig;
}
