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

export type ThemePreset = 'modern_tech' | 'corporate' | 'minimal';

export interface ThemeConfig {
  preset?: ThemePreset;
  backgroundColor?: string;
  primaryColor?: string;
  textColor?: string;
  fontFamily?: string;
}

export type BGMMood = 'inspiring' | 'tech' | 'corporate' | 'relaxed';

export interface BGMConfig {
  enabled: boolean;
  audio_url?: string | null;
  audio_path?: string | null;
  volume?: number;
  mood?: BGMMood | null;
  track_id?: string | null;
  ducking_enabled?: boolean;
  duck_attenuation_db?: number;
  transition_swell_db?: number;
}

export type CaptionStyle = 'karaoke_pill' | 'minimal_line' | 'bold_highlight';

export interface WordTimestamp {
  word: string;
  start_seconds: number;
  end_seconds: number;
  confidence?: number | null;
}

export interface SubtitleConfig {
  enabled: boolean;
  style?: CaptionStyle;
  provider_used?: 'openai_whisper' | 'forced_alignment' | null;
  max_words_per_line?: number;
  highlight_color?: string;
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
  word_timestamps?: WordTimestamp[];
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
  subtitles?: SubtitleConfig;
}
