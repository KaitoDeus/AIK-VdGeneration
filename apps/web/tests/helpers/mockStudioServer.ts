import { vi } from 'vitest';
import { DEFAULT_VOICES } from '@/lib/templates';
import {
  AssetSearchResponse,
  JobStatusResponse,
  PresentationScript,
  RemotionCompositionProps,
  WebSocketProgressEvent,
} from '@/types/studio';

export const MOCK_SCRIPT: PresentationScript = {
  title: 'Event-Driven Cloud Architecture',
  language: 'en',
  theme: 'modern_tech',
  slides: [
    {
      slide_index: 1,
      layout: 'title_intro',
      heading: 'Event-Driven Microservices',
      bullet_points: ['Decoupled message brokers', 'Horizontal worker scaling'],
      voiceover_script: 'Welcome to our architecture walkthrough on event-driven microservices.',
      visual_keywords: 'microservices cloud diagram',
    },
    {
      slide_index: 2,
      layout: 'bullet_list',
      heading: 'Asynchronous Redis Queues',
      bullet_points: ['Non-blocking 202 Accepted', 'Automatic 3-attempt retry'],
      voiceover_script: 'Redis queues isolate slow rendering workloads from the API gateway.',
      visual_keywords: 'redis queue architecture',
    },
    {
      slide_index: 3,
      layout: 'conclusion_cta',
      heading: 'Ship 1080p Slide Videos Fast',
      bullet_points: ['Audio-first frame timing', 'Remotion declarative rendering'],
      voiceover_script: 'Start building automated slide presentation videos today.',
      visual_keywords: 'video render cloud',
    },
  ],
};

export const MOCK_REMOTION_PROPS: RemotionCompositionProps = {
  project_title: 'Event-Driven Cloud Architecture',
  fps: 30,
  width: 1920,
  height: 1080,
  total_duration_seconds: 15.6,
  total_frames: 468,
  theme: {
    backgroundColor: '#0f172a',
    primaryColor: '#38bdf8',
    textColor: '#f8fafc',
    fontFamily: 'Inter, sans-serif',
  },
  slides: [
    {
      slide_index: 1,
      layout: 'title_intro',
      heading: 'Event-Driven Microservices',
      bullet_points: ['Decoupled message brokers', 'Horizontal worker scaling'],
      voiceover_script: 'Welcome to our architecture walkthrough on event-driven microservices.',
      voiceover_audio_url: '/audio_temp/job_mock_99/slide_1_11223344.mp3',
      voiceover_audio_path: '/tmp/slide_1_11223344.mp3',
      voiceover_duration_seconds: 4.5,
      calculated_frames: 156,
      background_image_url: null,
    },
  ],
  bgm: { enabled: false, audio_url: null, volume: 0.15 },
};

export class MockWebSocket {
  static instances: MockWebSocket[] = [];
  readonly url: string;
  readyState = 0;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = 1;
      this.onopen?.(new Event('open'));
    });
  }

  emitEvent(payload: WebSocketProgressEvent): void {
    this.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify(payload),
      })
    );
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.(new CloseEvent('close'));
  }
}

export interface MockStudioServerControl {
  jobState: JobStatusResponse;
  stockSearchResponse: AssetSearchResponse;
  setStockSearchResponse: (next: AssetSearchResponse) => void;
  fetchMock: ReturnType<typeof vi.fn>;
  restore: () => void;
}

/**
 * Installs deterministic mocked `fetch` and `WebSocket` globals for full-page
 * StudioWorkspacePage interactive DOM testing.
 */
export function installMockStudioServer(options?: {
  archivedJobs?: JobStatusResponse[];
}): MockStudioServerControl {
  MockWebSocket.instances = [];

  const jobState: JobStatusResponse = {
    job_id: 'job_mock_99',
    status: 'queued',
    progress_percentage: 0,
    current_stage: 'llm',
    render_requested: true,
    retry_count: 0,
    model_used: 'gemini-3.8-flash',
    voice_provider_used: 'edge_tts',
    script: null,
    remotion_props: null,
    output_video_path: null,
    progress_events: [],
    error: null,
  };

  let stockSearchResponse: AssetSearchResponse = {
    query: 'microservices cloud diagram',
    provider_used: 'unsplash',
    fallback_to_gradient: false,
    results: [
      {
        provider: 'unsplash',
        image_id: 'mock_u_1',
        url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920',
        preview_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=400',
        width: 1920,
        height: 1080,
        photographer: 'Taylor Vick',
      },
      {
        provider: 'pexels',
        image_id: 'mock_p_2',
        url: 'https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg',
        preview_url: 'https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg?w=400',
        width: 1920,
        height: 1080,
        photographer: 'Christina Morillo',
      },
    ],
  };

  const archived = options?.archivedJobs || [
    {
      job_id: 'job_archive_01',
      status: 'completed',
      progress_percentage: 100,
      current_stage: null,
      render_requested: true,
      retry_count: 0,
      script: MOCK_SCRIPT,
      remotion_props: MOCK_REMOTION_PROPS,
      output_video_path: '/tmp/job_archive_01.mp4',
      progress_events: [
        {
          job_id: 'job_archive_01',
          step: 'completed',
          progress_percentage: 100,
          message: 'Archived video ready (100%)',
          timestamp: '2026-11-17T10:00:00Z',
        },
      ],
    },
    {
      job_id: 'job_archive_s3',
      status: 'completed',
      progress_percentage: 100,
      current_stage: null,
      render_requested: true,
      retry_count: 0,
      storage_provider: 's3',
      storage_object_key: 'videos/job_archive_s3/job_archive_s3.mp4',
      video_download_url: 'https://aik-bucket.s3.us-east-1.amazonaws.com/videos/job_archive_s3/job_archive_s3.mp4?X-Amz-Signature=initial',
      signed_url_expires_in_seconds: 3600,
      script: MOCK_SCRIPT,
      remotion_props: {
        ...MOCK_REMOTION_PROPS,
        subtitles: {
          enabled: true,
          style: 'karaoke_pill',
          provider_used: 'openai_whisper',
          max_words_per_line: 6,
          highlight_color: '#38bdf8',
        },
      },
      output_video_path: '/tmp/job_archive_s3.mp4',
      progress_events: [
        {
          job_id: 'job_archive_s3',
          step: 'completed',
          progress_percentage: 100,
          message: 'Uploaded to S3 storage (100%)',
          timestamp: '2026-11-18T11:00:00Z',
        },
      ],
    },
  ];

  const jsonResponse = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method || 'GET').toUpperCase();

    if (url.endsWith('/api/v1/health')) {
      return jsonResponse({
        status: 'healthy',
        service: 'AIK-VdGeneration API Gateway',
        version: '0.5.0',
        queue_backend: 'redis',
        external_worker_enabled: false,
        default_llm_model: 'gemini-3.8-flash',
        fallback_llm_model: 'gemini-4-hydrogen',
        supported_tts_providers: ['edge_tts', 'elevenlabs'],
      });
    }

    if (url.endsWith('/api/v1/queue/stats')) {
      return jsonResponse({
        backend: 'redis',
        redis_connected: true,
        queues: { llm: 0, tts: 0, render: 0 },
        dead_letter_count: 0,
        total_jobs: archived.length,
      });
    }

    if (url.includes('/api/v1/voices/preview') && method === 'POST') {
      return new Response('FAKE_MP3_BYTES', {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
      });
    }

    if (url.includes('/api/v1/bgm/tracks')) {
      return jsonResponse([
        {
          track_id: 'inspiring-horizon',
          title: 'Horizon Lift',
          mood: 'inspiring',
          bpm: 112,
          duration_seconds: 8.0,
          description: 'Warm uplifting ambient progression.',
          preview_url: '/api/v1/bgm/tracks/inspiring-horizon/preview',
        },
        {
          track_id: 'tech-circuit',
          title: 'Circuit Pulse',
          mood: 'tech',
          bpm: 120,
          duration_seconds: 8.0,
          description: 'Clean electronic pentatonic texture.',
          preview_url: '/api/v1/bgm/tracks/tech-circuit/preview',
        },
      ]);
    }

    if (url.includes('/api/v1/voices')) {
      return jsonResponse(DEFAULT_VOICES);
    }

    if (url.endsWith('/api/v1/assets/search') && method === 'POST') {
      return jsonResponse(stockSearchResponse);
    }

    if (url.endsWith('/api/v1/scripts/generate') && method === 'POST') {
      return jsonResponse(MOCK_SCRIPT);
    }

    if (url.endsWith('/api/v1/scripts/expand') && method === 'POST') {
      const payload = init?.body ? JSON.parse(String(init.body)) : {};
      const script = payload.script as PresentationScript;
      const addCount = Math.min(Number(payload.additional_slides || 10), 30 - script.slides.length);
      const extraSlides = Array.from({ length: addCount }, (_, idx) => ({
        slide_index: script.slides.length + idx + 1,
        layout: (idx % 2 === 0 ? 'split_card' : 'bullet_list') as 'split_card' | 'bullet_list',
        heading: `AI Continuation Slide ${idx + 1}`,
        bullet_points: ['Generated deep-dive point', 'Practical architecture insight'],
        voiceover_script: `Detailed AI narration segment number ${idx + 1}.`,
        visual_keywords: 'modern architecture servers',
      }));
      const existing = [...script.slides];
      const mergedRaw =
        existing.length > 0 && existing[existing.length - 1].layout === 'conclusion_cta'
          ? [...existing.slice(0, -1), ...extraSlides, existing[existing.length - 1]]
          : [...existing, ...extraSlides];
      return jsonResponse({
        ...script,
        slides: mergedRaw.map((s, idx) => ({ ...s, slide_index: idx + 1 })),
      });
    }

    if (url.endsWith('/api/v1/videos/generate') && method === 'POST') {
      return jsonResponse(
        {
          job_id: jobState.job_id,
          status: 'queued',
          estimated_time_seconds: 30,
          websocket_url: `ws://localhost:8000/ws/jobs/${jobState.job_id}`,
          message: 'Video generation job accepted.',
        },
        202
      );
    }

    if (url.endsWith('/api/v1/jobs/compile') && method === 'POST') {
      return jsonResponse(
        {
          job_id: jobState.job_id,
          status: 'queued',
          estimated_time_seconds: 25,
          websocket_url: `ws://localhost:8000/ws/jobs/${jobState.job_id}`,
          message: 'Edited deck compiled.',
        },
        202
      );
    }

    if (url.includes('/video/url')) {
      const targetJobId = url.split('/api/v1/jobs/')[1]?.split('/video/url')[0] || jobState.job_id;
      return jsonResponse({
        job_id: targetJobId,
        storage_provider: 's3',
        object_key: `videos/${targetJobId}/${targetJobId}.mp4`,
        download_url: `https://aik-bucket.s3.us-east-1.amazonaws.com/videos/${targetJobId}/${targetJobId}.mp4?X-Amz-Signature=refreshed99`,
        expires_in_seconds: 3600,
      });
    }

    if (url.includes(`/api/v1/jobs/${jobState.job_id}`)) {
      return jsonResponse(jobState);
    }

    if (url.includes('/api/v1/jobs')) {
      return jsonResponse(archived);
    }

    return jsonResponse({ detail: `Unhandled mock URL: ${url}` }, 404);
  });

  const origFetch = globalThis.fetch;
  const origWs = globalThis.WebSocket;
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

  return {
    jobState,
    stockSearchResponse,
    setStockSearchResponse: (next: AssetSearchResponse) => {
      stockSearchResponse = next;
    },
    fetchMock,
    restore: () => {
      globalThis.fetch = origFetch;
      globalThis.WebSocket = origWs;
    },
  };
}
