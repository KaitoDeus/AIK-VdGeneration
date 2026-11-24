/**
 * Strict TypeScript Contracts for AIK-VdGeneration Web Studio (Milestone M2.2).
 * Synchronized with docs/API_SPEC.md and services/api-gateway/src/schemas.py.
 */

export type SlideLayout =
  | 'title_intro'
  | 'bullet_list'
  | 'split_card'
  | 'quote_highlight'
  | 'conclusion_cta';

export type SupportedLanguage = 'vi' | 'en';
export type TTSProviderType = 'edge_tts' | 'elevenlabs' | 'fpt' | 'google_vi';
export type AspectRatio = '16:9' | '9:16';
export type VideoFormatType = 'presentation' | 'short';
export type VisualTheme = 'modern_tech' | 'corporate' | 'minimal';
export type StorageProviderType = 'local' | 's3' | 'r2';
export type RenderEngineType = 'local' | 'lambda';
export type BGMMood = 'inspiring' | 'tech' | 'corporate' | 'relaxed';
export type CaptionStyle = 'karaoke_pill' | 'minimal_line' | 'bold_highlight';

export interface WordTimestamp {
  word: string;
  start_seconds: number;
  end_seconds: number;
  confidence?: number | null;
}

export interface SubtitleSettings {
  enabled: boolean;
  style: CaptionStyle;
  max_words_per_line?: number;
  highlight_color?: string;
}

export interface RemotionSubtitleProps {
  enabled: boolean;
  style: CaptionStyle;
  provider_used?: 'openai_whisper' | 'forced_alignment' | null;
  max_words_per_line?: number;
  highlight_color?: string;
}

export interface BGMSettings {
  enabled: boolean;
  mood?: BGMMood;
  track_id?: string | null;
  custom_audio_id?: string | null;
  volume?: number;
  ducking_enabled: boolean;
  duck_attenuation_db?: number;
}

export interface UploadedBGMInfo {
  custom_audio_id: string;
  filename: string;
  duration_seconds: number;
  preview_url: string;
}

export interface BGMTrackOption {
  track_id: string;
  title: string;
  mood: BGMMood;
  bpm: number;
  duration_seconds: number;
  description: string;
  preview_url: string;
}

export interface SlideScriptItem {
  slide_index: number;
  layout: SlideLayout;
  heading: string;
  bullet_points: string[];
  voiceover_script: string;
  visual_keywords: string;
}

export interface PresentationScript {
  title: string;
  language: SupportedLanguage;
  theme: string;
  slides: SlideScriptItem[];
}

export interface RemotionSlideProps {
  slide_index: number;
  layout: SlideLayout;
  heading: string;
  bullet_points: string[];
  voiceover_script: string;
  voiceover_audio_url: string;
  voiceover_audio_path: string;
  voiceover_duration_seconds: number;
  calculated_frames: number;
  background_image_url?: string | null;
  background_image_path?: string | null;
  background_asset_provider?: string | null;
  word_timestamps?: WordTimestamp[];
}

export interface StockImageCandidate {
  provider: 'unsplash' | 'pexels';
  image_id: string;
  url: string;
  preview_url: string;
  width: number;
  height: number;
  photographer: string;
  attribution_url?: string | null;
}

export interface AssetSearchResponse {
  query: string;
  provider_used?: string | null;
  fallback_to_gradient: boolean;
  results: StockImageCandidate[];
}

export interface RemotionCompositionProps {
  project_title: string;
  fps: number;
  width: number;
  height: number;
  total_duration_seconds: number;
  total_frames: number;
  theme: {
    preset?: VisualTheme;
    backgroundColor: string;
    primaryColor: string;
    textColor: string;
    fontFamily: string;
  };
  slides: RemotionSlideProps[];
  bgm: {
    enabled: boolean;
    audio_url?: string | null;
    audio_path?: string | null;
    volume: number;
    mood?: BGMMood | null;
    track_id?: string | null;
    ducking_enabled?: boolean;
    duck_attenuation_db?: number;
    transition_swell_db?: number;
  };
  subtitles?: RemotionSubtitleProps;
}

export interface VoiceOption {
  voice_id: string;
  label: string;
  language: SupportedLanguage;
  provider: TTSProviderType;
  gender: 'female' | 'male';
  sample_text: string;
}

export interface WebSocketProgressEvent {
  job_id: string;
  step: string;
  progress_percentage: number;
  message: string;
  timestamp: string;
}

export type JobLifecycleStatus =
  | 'queued'
  | 'generating_script'
  | 'script_ready'
  | 'synthesizing_audio'
  | 'audio_ready'
  | 'rendering_video'
  | 'completed'
  | 'failed';

export interface JobStatusResponse {
  job_id: string;
  status: JobLifecycleStatus;
  progress_percentage: number;
  current_stage?: 'llm' | 'tts' | 'render' | null;
  render_requested: boolean;
  retry_count: number;
  model_used?: string | null;
  voice_provider_used?: string | null;
  script?: PresentationScript | null;
  remotion_props?: RemotionCompositionProps | null;
  output_video_path?: string | null;
  storage_provider?: StorageProviderType | null;
  storage_object_key?: string | null;
  video_download_url?: string | null;
  signed_url_expires_in_seconds?: number | null;
  render_engine_used?: RenderEngineType | null;
  lambda_render_id?: string | null;
  lambda_chunks_count?: number | null;
  progress_events: WebSocketProgressEvent[];
  error?: string | null;
}

export interface VideoDeliveryResponse {
  job_id: string;
  storage_provider: StorageProviderType;
  download_url: string;
  object_key?: string | null;
  cdn_url?: string | null;
  expires_in_seconds?: number | null;
  file_size_bytes?: number | null;
}

export interface VideoJobResponse {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  estimated_time_seconds: number;
  websocket_url: string;
  message: string;
}

export interface QueueStatsResponse {
  backend: 'redis' | 'memory';
  redis_connected: boolean;
  queues: Record<string, number>;
  dead_letter_count: number;
  total_jobs: number;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  queue_backend: string;
  storage_provider?: string;
  render_engine?: RenderEngineType;
  external_worker_enabled: boolean;
  default_llm_model: string;
  fallback_llm_model: string;
  supported_tts_providers: string[];
}

export interface PromptTemplate {
  id: string;
  label: string;
  category: string;
  language?: SupportedLanguage;
  theme: VisualTheme;
  duration: number;
  prompt: string;
  prompts: {
    en: string;
    vi: string;
  };
  aspectRatio?: AspectRatio;
  videoFormat?: VideoFormatType;
  targetSlides?: number;
  enableSubtitles?: boolean;
  enableBgm?: boolean;
  voiceSpeed?: number;
}

export interface ChannelContextProfile {
  handle: string;
  profile_url: string;
  display_name: string;
  bio: string;
  avatar_url?: string | null;
  follower_count?: number | null;
  following_count?: number | null;
  likes_count?: number | null;
  video_count?: number | null;
  verified: boolean;
  recent_video_titles: string[];
  hashtags: string[];
  niche_category: string;
  content_pillars: string[];
  target_audience: string;
  tone_and_style: string;
  detected_language: SupportedLanguage;
  recommended_theme: VisualTheme;
  recommended_format: VideoFormatType;
  keywords: string[];
  context_summary: string;
  suggested_prompt: string;
  extraction_source: 'tiktok_ssr' | 'tiktok_og_meta' | 'manual_notes';
  blocked_by_captcha: boolean;
  fetch_warning?: string | null;
}
