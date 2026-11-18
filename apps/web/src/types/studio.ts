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
export type TTSProviderType = 'edge_tts' | 'elevenlabs' | 'fpt';
export type AspectRatio = '16:9' | '9:16';
export type VisualTheme = 'modern_tech' | 'corporate' | 'minimal';
export type StorageProviderType = 'local' | 's3' | 'r2';
export type RenderEngineType = 'local' | 'lambda';

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
    backgroundColor: string;
    primaryColor: string;
    textColor: string;
    fontFamily: string;
  };
  slides: RemotionSlideProps[];
  bgm: {
    enabled: boolean;
    audio_url?: string | null;
    volume: number;
  };
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
  language: SupportedLanguage;
  theme: VisualTheme;
  duration: number;
  prompt: string;
}
