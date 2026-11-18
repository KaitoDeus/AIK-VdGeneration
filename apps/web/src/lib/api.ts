import {
  AspectRatio,
  AssetSearchResponse,
  HealthResponse,
  JobStatusResponse,
  PresentationScript,
  QueueStatsResponse,
  SupportedLanguage,
  TTSProviderType,
  VideoJobResponse,
  VisualTheme,
  VoiceOption,
} from '@/types/studio';

export function getApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (configured && configured.trim().length > 0) {
    return configured.replace(/\/+$/, '');
  }
  return 'http://localhost:8000';
}

export function buildWebSocketUrl(jobId: string, providedWsUrl?: string): string {
  if (providedWsUrl && (providedWsUrl.startsWith('ws://') || providedWsUrl.startsWith('wss://'))) {
    return providedWsUrl;
  }
  const base = getApiBaseUrl();
  const wsBase = base.replace(/^https:\/\//i, 'wss://').replace(/^http:\/\//i, 'ws://');
  return `${wsBase}/ws/jobs/${jobId}`;
}

export function getJobAudioUrl(jobId: string, audioUrlOrPath: string): string {
  const filename = audioUrlOrPath.split(/[\\/]/).pop() || '';
  return `${getApiBaseUrl()}/api/v1/jobs/${encodeURIComponent(jobId)}/audio/${encodeURIComponent(filename)}`;
}

export function getJobVideoUrl(jobId: string): string {
  return `${getApiBaseUrl()}/api/v1/jobs/${encodeURIComponent(jobId)}/video`;
}

export function getJobAssetUrl(jobId: string | null, assetUrlOrPath: string): string {
  if (
    assetUrlOrPath.startsWith('http://') ||
    assetUrlOrPath.startsWith('https://') ||
    assetUrlOrPath.startsWith('data:')
  ) {
    return assetUrlOrPath;
  }
  if (!jobId) return assetUrlOrPath;
  const filename = assetUrlOrPath.split(/[\\/]/).pop() || '';
  return `${getApiBaseUrl()}/api/v1/jobs/${encodeURIComponent(jobId)}/assets/${encodeURIComponent(filename)}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const errBody = await response.json();
      if (errBody?.detail) {
        detail = typeof errBody.detail === 'string' ? errBody.detail : JSON.stringify(errBody.detail);
      }
    } catch {
      // keep status text fallback
    }
    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}

export async function fetchHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>('/api/v1/health');
}

export async function fetchQueueStats(): Promise<QueueStatsResponse> {
  return requestJson<QueueStatsResponse>('/api/v1/queue/stats');
}

export async function fetchVoices(language?: SupportedLanguage): Promise<VoiceOption[]> {
  const query = language ? `?language=${language}` : '';
  return requestJson<VoiceOption[]>(`/api/v1/voices${query}`);
}

export async function previewVoiceAudio(params: {
  provider: TTSProviderType;
  voice_id: string;
  language: SupportedLanguage;
  sample_text?: string;
}): Promise<Blob> {
  const response = await fetch(`${getApiBaseUrl()}/api/v1/voices/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    throw new Error(`Voice preview failed (${response.status})`);
  }
  return response.blob();
}

export async function generateScript(params: {
  prompt: string;
  language: SupportedLanguage;
  target_duration_seconds: number;
  theme: VisualTheme;
}): Promise<PresentationScript> {
  return requestJson<PresentationScript>('/api/v1/scripts/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function searchStockAssets(params: {
  query: string;
  aspect_ratio: AspectRatio;
  limit?: number;
}): Promise<AssetSearchResponse> {
  return requestJson<AssetSearchResponse>('/api/v1/assets/search', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function generateVideoJob(params: {
  prompt: string;
  language: SupportedLanguage;
  aspect_ratio: AspectRatio;
  target_duration_seconds: number;
  style: {
    theme: VisualTheme;
    color_palette: string;
    font_pair: string;
  };
  voice_settings: {
    provider: TTSProviderType;
    voice_id: string;
    speed: number;
  };
  render_video: boolean;
  include_stock_visuals?: boolean;
}): Promise<VideoJobResponse> {
  return requestJson<VideoJobResponse>('/api/v1/videos/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function compileEditedScript(params: {
  script: PresentationScript;
  aspect_ratio: AspectRatio;
  voice_settings: {
    provider: TTSProviderType;
    voice_id: string;
    speed: number;
  };
  render_video: boolean;
  include_stock_visuals?: boolean;
  slide_backgrounds?: Record<number, string>;
}): Promise<VideoJobResponse> {
  return requestJson<VideoJobResponse>('/api/v1/jobs/compile', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function fetchJobStatus(jobId: string): Promise<JobStatusResponse> {
  return requestJson<JobStatusResponse>(`/api/v1/jobs/${encodeURIComponent(jobId)}`);
}

export async function fetchJobs(limit: number = 20): Promise<JobStatusResponse[]> {
  return requestJson<JobStatusResponse[]>(`/api/v1/jobs?limit=${limit}`);
}
