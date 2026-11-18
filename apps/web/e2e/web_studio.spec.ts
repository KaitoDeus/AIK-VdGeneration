import { expect, Page, test } from '@playwright/test';

const MOCK_SCRIPT = {
  title: 'Browser E2E Presentation',
  language: 'en',
  theme: 'modern_tech',
  slides: [
    {
      slide_index: 1,
      layout: 'title_intro',
      heading: 'Automated Browser Verification',
      bullet_points: ['Zero border-radius StudioBlank UI', 'Real Chrome layout audit'],
      voiceover_script: 'Welcome to our automated Playwright verification walkthrough.',
      visual_keywords: 'minimal browser geometry',
    },
    {
      slide_index: 2,
      layout: 'bullet_list',
      heading: 'Audio-First Synchronicity',
      bullet_points: ['Dynamic frame calculation', 'Bilingual EN/VI TTS voices'],
      voiceover_script: 'Audio duration drives the video frame count precisely.',
      visual_keywords: 'audio waveform studio',
    },
    {
      slide_index: 3,
      layout: 'conclusion_cta',
      heading: 'Production Ready Pipeline',
      bullet_points: ['1080p H.264 MP4 output', 'Instant WebSocket updates'],
      voiceover_script: 'Your presentation video pipeline is ready for production.',
      visual_keywords: 'cloud deployment success',
    },
  ],
};

const MOCK_REMOTION_PROPS = {
  project_title: 'Browser E2E Presentation',
  fps: 30,
  width: 1920,
  height: 1080,
  total_duration_seconds: 12.6,
  total_frames: 378,
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
      heading: 'Automated Browser Verification',
      bullet_points: ['Zero border-radius StudioBlank UI'],
      voiceover_script: 'Welcome to our automated Playwright verification walkthrough.',
      voiceover_audio_url: '/audio_temp/job_e2e_01/slide_1_11112222.mp3',
      voiceover_audio_path: '/tmp/slide_1_11112222.mp3',
      voiceover_duration_seconds: 3.5,
      calculated_frames: 126,
      background_image_url: null,
    },
  ],
  bgm: { enabled: false, audio_url: null, volume: 0.15 },
};

async function attachMockApiGateway(page: Page) {
  let jobStatus = 'queued';
  let jobProgress = 0;

  await page.route('http://localhost:8000/api/v1/**', async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();

    if (url.endsWith('/health')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'healthy',
          service: 'AIK-VdGeneration API Gateway',
          version: '0.5.0',
          queue_backend: 'redis',
          external_worker_enabled: false,
          default_llm_model: 'gemini-3.8-flash',
          fallback_llm_model: 'gemini-4-hydrogen',
          supported_tts_providers: ['edge_tts', 'elevenlabs'],
        }),
      });
    }

    if (url.endsWith('/queue/stats')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          backend: 'redis',
          redis_connected: true,
          queues: { llm: 0, tts: 0, render: 0 },
          dead_letter_count: 0,
          total_jobs: 1,
        }),
      });
    }

    if (url.includes('/voices')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            voice_id: 'vi-VN-HoaiMyNeural',
            label: 'Hoài My (Northern Female)',
            language: 'vi',
            provider: 'edge_tts',
            gender: 'female',
            sample_text: 'Xin chào',
          },
          {
            voice_id: 'en-US-GuyNeural',
            label: 'Guy (US Natural Male)',
            language: 'en',
            provider: 'edge_tts',
            gender: 'male',
            sample_text: 'Hello',
          },
        ]),
      });
    }

    if (url.endsWith('/scripts/generate') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SCRIPT),
      });
    }

    if (url.endsWith('/jobs/compile') && method === 'POST') {
      jobStatus = 'completed';
      jobProgress = 100;
      return route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          job_id: 'job_e2e_01',
          status: 'queued',
          estimated_time_seconds: 15,
          websocket_url: 'ws://localhost:8000/ws/jobs/job_e2e_01',
          message: 'Compiled job queued.',
        }),
      });
    }

    if (url.endsWith('/jobs/job_e2e_01')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          job_id: 'job_e2e_01',
          status: jobStatus,
          progress_percentage: jobProgress,
          render_requested: true,
          retry_count: 0,
          script: MOCK_SCRIPT,
          remotion_props: MOCK_REMOTION_PROPS,
          output_video_path: '/tmp/job_e2e_01.mp4',
          progress_events: [],
        }),
      });
    }

    if (url.includes('/api/v1/bgm/tracks')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            track_id: 'tech-circuit',
            title: 'Circuit Pulse',
            mood: 'tech',
            bpm: 120,
            duration_seconds: 8.0,
            description: 'Clean electronic loop.',
            preview_url: '/api/v1/bgm/tracks/tech-circuit/preview',
          },
        ]),
      });
    }

    if (url.endsWith('/api/v1/assets/search') && method === 'POST') {
      const tinySvg =
        'data:image/svg+xml;utf8,' +
        encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#1e293b"/></svg>');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          query: 'minimal browser geometry',
          provider_used: 'unsplash',
          fallback_to_gradient: false,
          results: [
            {
              provider: 'unsplash',
              image_id: 'e2e_u1',
              url: tinySvg,
              preview_url: tinySvg,
              width: 1920,
              height: 1080,
              photographer: 'Studio Photographer',
            },
          ],
        }),
      });
    }

    if (url.includes('/video/url')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          job_id: 'job_e2e_01',
          storage_provider: 'local',
          download_url: '/api/v1/jobs/job_e2e_01/video',
          expires_in_seconds: null,
        }),
      });
    }

    if (url.includes('/api/v1/jobs') && !url.includes('/jobs/job_e2e_01')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    return route.fulfill({ status: 404, body: '{}' });
  });

  await page.routeWebSocket('ws://localhost:8000/ws/jobs/**', (ws) => {
    setTimeout(() => {
      ws.send(
        JSON.stringify({
          job_id: 'job_e2e_01',
          step: 'rendering_video',
          progress_percentage: 90,
          message: 'Rendering 1080p MP4 frames... (90%)',
          timestamp: '2026-11-17T11:10:00Z',
        })
      );
    }, 80);
    setTimeout(() => {
      ws.send(
        JSON.stringify({
          job_id: 'job_e2e_01',
          step: 'completed',
          progress_percentage: 100,
          message: 'Video rendering complete! (100%)',
          timestamp: '2026-11-17T11:10:05Z',
        })
      );
      ws.close();
    }, 180);
  });
}

test.describe('AIK Web Studio Real Browser Verification (StudioBlank)', () => {
  test('enforces StudioBlank geometry (0px radius, 0 shadow, monochrome) with zero layout overflow', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await attachMockApiGateway(page);
    await page.goto('/');

    await expect(page.getByTestId('ui-language-switcher')).toBeVisible();

    // Verify no horizontal overflow on Desktop or Mobile viewports
    const overflowMetrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(overflowMetrics.scrollWidth).toBeLessThanOrEqual(overflowMetrics.innerWidth);

    // Verify real computed CSS properties follow StudioBlank Design System
    const cssAudit = await page.evaluate(() => {
      const bodyStyle = getComputedStyle(document.body);
      const header = document.querySelector('header')!;
      const textarea = document.querySelector('textarea')!;
      const footer = document.querySelector('footer#archive')!;
      const switcher = document.querySelector('[data-testid="ui-language-switcher"]')!;
      const buttons = Array.from(document.querySelectorAll('button'));

      return {
        bodyBg: bodyStyle.backgroundColor,
        bodyColor: bodyStyle.color,
        footerBg: getComputedStyle(footer).backgroundColor,
        headerRadius: getComputedStyle(header).borderRadius,
        textareaRadius: getComputedStyle(textarea).borderRadius,
        switcherRadius: getComputedStyle(switcher).borderRadius,
        anyRoundedButton: buttons.some((b) => getComputedStyle(b).borderRadius !== '0px'),
        anyShadowedButton: buttons.some((b) => getComputedStyle(b).boxShadow !== 'none'),
      };
    });

    expect(cssAudit.bodyBg).toBe('rgb(250, 250, 250)');
    expect(cssAudit.bodyColor).toBe('rgb(10, 10, 10)');
    expect(cssAudit.footerBg).toBe('rgb(10, 10, 10)');
    expect(cssAudit.headerRadius).toBe('0px');
    expect(cssAudit.textareaRadius).toBe('0px');
    expect(cssAudit.switcherRadius).toBe('0px');
    expect(cssAudit.anyRoundedButton).toBe(false);
    expect(cssAudit.anyShadowedButton).toBe(false);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('renders VIE & EN flag switcher in top-right corner and persists language across reload', async ({
    page,
  }) => {
    await attachMockApiGateway(page);
    await page.goto('/');

    const switcher = page.getByTestId('ui-language-switcher');
    const vieBtn = page.getByTestId('lang-switch-vie');
    const enBtn = page.getByTestId('lang-switch-en');

    await expect(vieBtn.locator('svg[data-flag="vn"]')).toBeVisible();
    await expect(enBtn.locator('svg[data-flag="gb"]')).toBeVisible();

    // Verify physical placement in top-right quadrant of the viewport
    const viewport = page.viewportSize()!;
    const box = await switcher.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeGreaterThan(viewport.width * 0.6);
    expect(box!.y).toBeLessThan(64);

    // Click EN -> translates full UI & persists on reload
    await enBtn.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Prompt to Synchronized Slide Video.'
    );
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Prompt to Synchronized Slide Video.'
    );

    // Click VIE -> switches back cleanly to Vietnamese
    await vieBtn.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Biến Prompt thành Video Slide Đồng Bộ.'
    );
  });

  test('completes end-to-end Draft -> Interactive Slide Edit -> WebSocket Render flow in Chrome', async ({
    page,
  }) => {
    await attachMockApiGateway(page);
    await page.goto('/');

    // Select quick template, enable BGM & Whisper captions, and draft script
    await page.getByRole('button', { name: 'GIẢI THÍCH CÔNG NGHỆ' }).click();
    await page.getByTestId('bgm-mood-tech').click();
    await page.getByTestId('subtitles-enable-toggle').click();
    await page.getByRole('button', { name: 'Soạn Kịch Bản Trước' }).click();

    const canvas = page.getByTestId('live-slide-canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas).toContainText('Automated Browser Verification');

    // Edit slide heading and switch layout to split_card
    const headingInput = page.locator('#slide-heading-input');
    await headingInput.fill('Playwright Verified Slide');
    await expect(canvas).toContainText('Playwright Verified Slide');

    await page.locator('#slide-layout-select').selectOption('split_card');
    await expect(canvas).toHaveAttribute('data-layout', 'split_card');

    // Search stock visuals and pick backdrop onto live slide canvas
    await page.getByRole('button', { name: 'Tìm Ảnh Nền Stock' }).click();
    await page.getByRole('button', { name: /unsplash · Studio Photographer/i }).click();
    await expect(page.getByTestId('canvas-stock-backdrop')).toBeVisible();

    // Compile edited deck -> streams WebSocket progress to 100% and reveals MP4 download
    await page.getByRole('button', { name: 'Biên Dịch & Xuất MP4 1080p' }).click();
    await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    await expect(page.getByTestId('storage-provider-chip')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tải Xuống MP4 1080p' })).toBeVisible();
    await expect(page.locator('video')).toBeVisible();
  });
});
