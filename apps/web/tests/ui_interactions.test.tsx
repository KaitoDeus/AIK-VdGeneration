/**
 * Interactive DOM & User-Flow UI Test Suite (React Testing Library + user-event + jsdom).
 * Verifies real user interactions across the entire StudioWorkspacePage:
 *  - Top-right VIE / EN language switcher + localStorage persistence
 *  - Validation states & quick prompt template chips
 *  - Voice audition preview player
 *  - Draft script -> Interactive Slide Reviewer editing, adding/removing slides
 *  - Full Generate Presentation -> Live WebSocket Progress -> 1080p MP4 Player
 *  - Jobs Archive click-to-restore flow
 */

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import StudioWorkspacePage from '../src/app/page';
import {
  installMockStudioServer,
  MOCK_REMOTION_PROPS,
  MOCK_SCRIPT,
  MockStudioServerControl,
  MockWebSocket,
} from './helpers/mockStudioServer';

describe('Interactive Web Studio User Flows (jsdom + Testing Library)', () => {
  let server: MockStudioServerControl;

  beforeEach(() => {
    window.localStorage.clear();
    server = installMockStudioServer();
  });

  afterEach(() => {
    server.restore();
  });

  it('defaults to EN on initial load, couples top-right VIE/EN switcher with narrator voice, and omits duplicate language buttons', async () => {
    const user = userEvent.setup();
    render(<StudioWorkspacePage />);

    // Initial health & telemetry loaded in English by default
    await waitFor(() => {
      expect(screen.getByTestId('api-status-chip')).toHaveTextContent('API ONLINE');
    });

    // Top-right VIE & EN buttons with flag SVGs are visible; EN is active by default
    const vieBtn = screen.getByTestId('lang-switch-vie');
    const enBtn = screen.getByTestId('lang-switch-en');
    expect(enBtn).toHaveAttribute('aria-pressed', 'true');
    expect(vieBtn).toHaveAttribute('aria-pressed', 'false');
    expect(vieBtn.querySelector('svg[data-flag="vn"]')).toBeInTheDocument();
    expect(enBtn.querySelector('svg[data-flag="gb"]')).toBeInTheDocument();
    expect(screen.queryByText('Script & Voice Configuration')).not.toBeInTheDocument();
    expect(screen.queryByText('01 / PROMPT & PARAMETERS')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Presentation Topic or Raw Narrative')).toBeInTheDocument();
    expect(screen.getByTestId('quick-prompt-templates')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Presentation' })).toBeInTheDocument();

    // Redundant inline Language and Aspect Ratio columns in the parameter grid must not exist
    expect(screen.queryByRole('button', { name: 'VIETNAMESE' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ENGLISH' })).not.toBeInTheDocument();
    expect(screen.queryByText('Aspect Ratio')).not.toBeInTheDocument();
    expect(screen.queryByText('16:9 WIDESCREEN (1920×1080)')).not.toBeInTheDocument();

    // Default narrator voice matches EN cleanly
    const voiceSelect = screen.getByLabelText('Narrator Voice Selection') as HTMLSelectElement;
    expect(voiceSelect.value).toBe('en-US-GuyNeural');
    expect(Array.from(voiceSelect.options).some((o) => o.value === 'en-US-GuyNeural')).toBe(true);
    expect(Array.from(voiceSelect.options).some((o) => o.value === 'vi-VN-HoaiMyNeural')).toBe(false);

    // Switch to Vietnamese via global switcher -> UI text AND narrator voice switch together
    await user.click(vieBtn);
    expect(vieBtn).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem('aik-studio-locale')).toBe('vi');
    expect(screen.queryByText('Thiết Lập Kịch Bản & Giọng Đọc')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Chủ Đề Thuyết Trình Hoặc Nội Dung Thô')).toBeInTheDocument();
    expect(screen.queryByText('Biến Prompt thành Video Slide Đồng Bộ.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo Video Thuyết Trình' })).toBeInTheDocument();
    expect(voiceSelect.value).toBe('vi-VN-HoaiMyNeural');
    expect(Array.from(voiceSelect.options).some((o) => o.value === 'vi-VN-HoaiMyNeural')).toBe(true);
    expect(Array.from(voiceSelect.options).some((o) => o.value === 'en-US-GuyNeural')).toBe(false);

    // Switch back to English -> UI text AND narrator voice revert together
    await user.click(enBtn);
    expect(enBtn).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem('aik-studio-locale')).toBe('en');
    expect(screen.getByLabelText('Presentation Topic or Raw Narrative')).toBeInTheDocument();
    expect(screen.queryByText('Prompt to Synchronized Slide Video.')).not.toBeInTheDocument();
    expect(screen.getByTestId('api-status-chip')).toHaveTextContent('API ONLINE');
    expect(screen.getByRole('button', { name: 'Generate Presentation' })).toBeInTheDocument();
    expect(voiceSelect.value).toBe('en-US-GuyNeural');
  });

  it('shows validation alert on empty prompt, applies quick template, and auditions voice audio', async () => {
    const user = userEvent.setup();
    render(<StudioWorkspacePage />);

    await waitFor(() => {
      expect(screen.getByTestId('api-status-chip')).toHaveTextContent('API ONLINE');
    });

    // Submit empty prompt -> displays localized validation error
    await user.click(screen.getByRole('button', { name: 'Generate Presentation' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Prompt must contain at least 3 characters.');

    // Click quick template chip -> clears error and populates prompt & settings
    await user.click(screen.getByRole('button', { name: 'TECH EXPLAINER' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const promptBox = screen.getByLabelText('Presentation Topic or Raw Narrative') as HTMLTextAreaElement;
    expect(promptBox.value).toContain('Event-Driven Microservices');

    // Audition Voice Sample mounts audio preview player
    await user.click(screen.getByRole('button', { name: 'AUDITION VOICE SAMPLE' }));
    await waitFor(() => {
      const audioEl = screen.getByTestId('voice-audition-player') as HTMLAudioElement;
      expect(audioEl).toBeInTheDocument();
      expect(audioEl.getAttribute('src')).toContain('blob:');
    });
  });

  it('drafts script, edits slide content in real time, adds/removes slides, and AI-expands +10 slides up to 30 max', async () => {
    const user = userEvent.setup();
    render(<StudioWorkspacePage />);

    await user.click(screen.getByRole('button', { name: 'TECH EXPLAINER' }));
    await user.click(screen.getByRole('button', { name: 'Draft Script First' }));

    // SlideReviewer mounts with 3 slides
    await waitFor(() => {
      expect(screen.getByTestId('live-slide-canvas')).toBeInTheDocument();
    });
    expect(screen.getByText('SLIDES (3 / 30)')).toBeInTheDocument();

    // Edit Slide 1 heading -> immediately reflected on live slide canvas
    const headingInput = screen.getByLabelText('Slide Heading') as HTMLInputElement;
    await user.clear(headingInput);
    await user.type(headingInput, 'Custom Studio Heading');
    expect(screen.getByTestId('live-slide-canvas')).toHaveTextContent('Custom Studio Heading');

    // Switch layout template -> updates live canvas data-layout attribute
    await user.selectOptions(screen.getByLabelText('Layout Template'), 'quote_highlight');
    expect(screen.getByTestId('live-slide-canvas')).toHaveAttribute('data-layout', 'quote_highlight');

    // Add slide -> increases from 3/30 to 4/30, then Remove -> drops back to 3/30
    await user.click(screen.getByRole('button', { name: '+ ADD' }));
    expect(screen.getByText('SLIDES (4 / 30)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'REMOVE' }));
    expect(screen.getByText('SLIDES (3 / 30)')).toBeInTheDocument();

    // Auto-expand +10 continuation slides via AI button -> reaches 13 / 30
    await user.click(screen.getByTestId('ai-expand-10-btn'));
    await waitFor(() => {
      expect(screen.getByText('SLIDES (13 / 30)')).toBeInTheDocument();
    });
    expect(screen.getByRole('listbox', { name: 'Slide list' })).toHaveTextContent(
      'AI Continuation Slide 10'
    );
  });

  it('executes full pipeline, streams realtime WebSocket progress to 100%, and displays MP4 player', async () => {
    const user = userEvent.setup();
    render(<StudioWorkspacePage />);

    await user.click(screen.getByRole('button', { name: 'TECH EXPLAINER' }));
    const renderCheckbox = screen.getByRole('checkbox', {
      name: /Compile final 1080p MP4 via Remotion immediately/i,
    });
    expect(renderCheckbox).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: 'Generate Presentation' }));

    await waitFor(() => {
      const genCall = server.fetchMock.mock.calls.find(
        ([url, init]) => String(url).endsWith('/api/v1/videos/generate') && init?.method === 'POST'
      );
      expect(genCall).toBeDefined();
      const body = JSON.parse(String(genCall?.[1]?.body));
      expect(body.render_video).toBe(true);
      expect(body.language).toBe('en');
      expect(body.voice_settings.voice_id).toBe('en-US-GuyNeural');
      expect(body.target_slides).toBeGreaterThanOrEqual(5);
    });

    // Wait for LiveProgressTracker and MockWebSocket to open
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    });

    const ws = MockWebSocket.instances[0];

    // Emit live fine-grained progress events over WebSocket (TTS slide -> Remotion render)
    await act(async () => {
      ws.emitEvent({
        job_id: server.jobState.job_id,
        step: 'synthesizing_audio',
        progress_percentage: 58,
        message: 'Voiceover slide 3/5 ready (4.2s). (58%)',
        timestamp: '2026-11-17T11:05:05Z',
      });
    });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '58');
    expect(screen.getByTestId('job-status-chip')).toHaveTextContent('SYNTHESIZING AUDIO');
    expect(screen.getByTestId('live-activity-ticker')).toHaveTextContent('Voiceover slide 3/5 ready');

    await act(async () => {
      ws.emitEvent({
        job_id: server.jobState.job_id,
        step: 'rendering_video',
        progress_percentage: 91,
        message: 'Rendering frame 180/300, ETA 8s... (91%)',
        timestamp: '2026-11-17T11:05:15Z',
      });
    });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '91');
    expect(screen.getByTestId('job-status-chip')).toHaveTextContent('RENDERING VIDEO');
    expect(screen.getByTestId('live-activity-ticker')).toHaveTextContent('Rendering frame 180/300');

    // Update backend job state and emit completion over WebSocket
    server.jobState.status = 'completed';
    server.jobState.progress_percentage = 100;
    server.jobState.script = MOCK_SCRIPT;
    server.jobState.remotion_props = MOCK_REMOTION_PROPS;
    server.jobState.output_video_path = '/tmp/job_mock_99.mp4';

    await act(async () => {
      ws.emitEvent({
        job_id: server.jobState.job_id,
        step: 'completed',
        progress_percentage: 100,
        message: 'Video rendering complete! (100%)',
        timestamp: '2026-11-17T11:05:30Z',
      });
    });

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
      expect(screen.getByTestId('rendered-video-player')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Download 1080p MP4' })).toHaveAttribute(
        'href',
        'http://localhost:8000/api/v1/jobs/job_mock_99/video'
      );
    });
  });

  it('restores an archived job from the inverse dark footer into the active studio', async () => {
    const user = userEvent.setup();
    render(<StudioWorkspacePage />);

    const archiveRow = await screen.findByRole('button', { name: /job_archive_01/i });
    await user.click(archiveRow);

    await waitFor(() => {
      expect(screen.getByTestId('job-status-chip')).toHaveTextContent('COMPLETED');
      expect(screen.getByTestId('live-slide-canvas')).toBeInTheDocument();
    });
  });

  it('searches stock visuals, previews backdrop on canvas, sends slide_backgrounds on compile, and shows gradient fallback notice', async () => {
    const user = userEvent.setup();
    render(<StudioWorkspacePage />);

    await user.click(screen.getByRole('button', { name: 'TECH EXPLAINER' }));
    await user.click(screen.getByRole('button', { name: 'Draft Script First' }));

    await waitFor(() => {
      expect(screen.getByTestId('live-slide-canvas')).toBeInTheDocument();
    });

    // Search Unsplash/Pexels stock backgrounds
    await user.click(screen.getByRole('button', { name: 'Search Stock Visuals' }));
    const firstCandidateBtn = await screen.findByRole('button', { name: /unsplash · Taylor Vick/i });
    await user.click(firstCandidateBtn);

    // Live slide canvas displays scrim backdrop with selected photo URL
    const backdrop = screen.getByTestId('canvas-stock-backdrop');
    expect(backdrop).toBeInTheDocument();
    expect(backdrop.querySelector('img')).toHaveAttribute(
      'src',
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920'
    );

    // Compiling edited deck passes slide_backgrounds override to /api/v1/jobs/compile
    await user.click(screen.getByRole('button', { name: 'Compile & Render 1080p MP4' }));
    await waitFor(() => {
      const compileCall = server.fetchMock.mock.calls.find(
        ([url, init]) => String(url).endsWith('/api/v1/jobs/compile') && init?.method === 'POST'
      );
      expect(compileCall).toBeDefined();
      const parsedBody = JSON.parse(String(compileCall?.[1]?.body));
      expect(parsedBody.include_stock_visuals).toBe(true);
      expect(parsedBody.slide_backgrounds).toEqual({
        '1': 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920',
      });
    });

    // Clear override -> reverts canvas backdrop to pure gradient
    await user.click(screen.getByRole('button', { name: 'Use Gradient' }));
    expect(screen.queryByTestId('canvas-stock-backdrop')).not.toBeInTheDocument();

    // Missing keys / empty match triggers graceful fallback note without error crash
    server.setStockSearchResponse({
      query: 'microservices cloud diagram',
      provider_used: null,
      fallback_to_gradient: true,
      results: [],
    });
    await user.click(screen.getByRole('button', { name: 'Search Stock Visuals' }));
    await waitFor(() => {
      expect(screen.getByTestId('stock-fallback-note')).toBeInTheDocument();
    });
  });

  it('displays S3 signed URL badge for cloud-stored job and refreshes presigned download link', async () => {
    const user = userEvent.setup();
    render(<StudioWorkspacePage />);

    const cloudArchiveRow = await screen.findByRole('button', { name: /job_archive_s3/i });
    await user.click(cloudArchiveRow);

    await waitFor(() => {
      expect(screen.getByTestId('storage-provider-chip')).toHaveTextContent('AWS S3 SIGNED');
    });

    const downloadLink = screen.getByRole('link', { name: 'Download 1080p MP4' });
    expect(downloadLink).toHaveAttribute(
      'href',
      'https://aik-bucket.s3.us-east-1.amazonaws.com/videos/job_archive_s3/job_archive_s3.mp4?X-Amz-Signature=initial'
    );

    await user.click(screen.getByTestId('refresh-signed-url-btn'));
    await waitFor(() => {
      expect(downloadLink).toHaveAttribute(
        'href',
        'https://aik-bucket.s3.us-east-1.amazonaws.com/videos/job_archive_s3/job_archive_s3.mp4?X-Amz-Signature=refreshed99'
      );
      expect(screen.getByTestId('rendered-video-player')).toHaveAttribute(
        'src',
        'https://aik-bucket.s3.us-east-1.amazonaws.com/videos/job_archive_s3/job_archive_s3.mp4?X-Amz-Signature=refreshed99'
      );
    });
  });

  it('uploads custom background music without preset mood suggestions, previews it, and submits custom_audio_id', async () => {
    const user = userEvent.setup();
    render(<StudioWorkspacePage />);

    // Preset mood suggestions and stock dropdown must be absent
    expect(screen.queryByTestId('bgm-mood-tech')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bgm-mood-inspiring')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('BGM Track Selection')).not.toBeInTheDocument();

    // User uploads their own audio track
    const fileInput = screen.getByTestId('bgm-file-input') as HTMLInputElement;
    const customFile = new File(['RIFF\x00\x00\x00\x00WAVE'], 'my-bgm.mp3', {
      type: 'audio/mpeg',
    });
    await user.upload(fileInput, customFile);

    await waitFor(() => {
      expect(screen.getByTestId('bgm-uploaded-file-chip')).toHaveTextContent('my-bgm.mp3 · 18.5s');
    });
    expect(screen.getByTestId('bgm-ducking-toggle')).toBeInTheDocument();

    await user.click(screen.getByTestId('bgm-preview-btn'));
    const bgmPlayer = screen.getByTestId('bgm-audition-player') as HTMLAudioElement;
    expect(bgmPlayer).toBeInTheDocument();
    expect(bgmPlayer.getAttribute('src')).toContain('/api/v1/bgm/uploads/bgm_mocktrack01/preview');

    await user.click(screen.getByRole('button', { name: 'TECH EXPLAINER' }));
    await user.click(screen.getByRole('button', { name: 'Generate Presentation' }));
    await waitFor(() => {
      const genCall = server.fetchMock.mock.calls.find(
        ([url, init]) => String(url).endsWith('/api/v1/videos/generate') && init?.method === 'POST'
      );
      expect(genCall).toBeDefined();
      const body = JSON.parse(String(genCall?.[1]?.body));
      expect(body.bgm_settings).toEqual({
        enabled: true,
        custom_audio_id: 'bgm_mocktrack01',
        mood: 'tech',
        track_id: null,
        volume: 0.45,
        ducking_enabled: true,
        duck_attenuation_db: 10,
      });
    });
  });

  it('enables Whisper subtitles without Karaoke labels, selects bold_highlight style, and shows .SRT export link', async () => {
    const user = userEvent.setup();
    render(<StudioWorkspacePage />);

    // Subtitles control uses Subtitles/Phu de labels cleanly without Karaoke
    expect(screen.getByText('Auto Subtitles (Whisper)')).toBeInTheDocument();
    expect(screen.queryByText(/karaoke/i)).not.toBeInTheDocument();

    // Enable subtitles & pick bold_highlight style
    await user.click(screen.getByTestId('subtitles-enable-toggle'));
    expect(screen.getByTestId('subtitle-style-karaoke_pill')).toHaveTextContent('HIGHLIGHT PILL');
    await user.click(screen.getByTestId('subtitle-style-bold_highlight'));
    await user.click(screen.getByRole('button', { name: 'TECH EXPLAINER' }));
    await user.click(screen.getByRole('button', { name: 'Generate Presentation' }));

    await waitFor(() => {
      const genCall = server.fetchMock.mock.calls.find(
        ([url, init]) => String(url).endsWith('/api/v1/videos/generate') && init?.method === 'POST'
      );
      expect(genCall).toBeDefined();
      const body = JSON.parse(String(genCall?.[1]?.body));
      expect(body.subtitle_settings).toEqual({
        enabled: true,
        style: 'bold_highlight',
      });
    });

    // Wait for generateVideoJob state transition to settle before restoring archive job
    await screen.findByRole('progressbar');

    // Restore cloud job with subtitles enabled -> .SRT export link appears
    const cloudArchiveRow = await screen.findByRole('button', { name: /job_archive_s3/i });
    await user.click(cloudArchiveRow);
    await waitFor(() => {
      expect(screen.getByTestId('download-srt-link')).toHaveAttribute(
        'href',
        'http://localhost:8000/api/v1/jobs/job_archive_s3/subtitles.srt'
      );
    });
  });

  it('detects Vietnamese prompt pasted while English language is active and syncs UI + voice via 1-click button', async () => {
    const user = userEvent.setup();
    render(<StudioWorkspacePage />);

    // Default active language is already EN; typing Vietnamese triggers mismatch notice
    const promptBox = screen.getByLabelText('Presentation Topic or Raw Narrative') as HTMLTextAreaElement;
    await user.type(promptBox, 'Hướng dẫn sử dụng điện toán đám mây');

    // Warning banner prompts switching to Vietnamese
    expect(screen.getByTestId('language-mismatch-warning')).toBeInTheDocument();
    await user.click(screen.getByTestId('switch-to-vi-btn'));

    // Switching resolves mismatch, flips top-right switcher to VIE, and sets Vietnamese voice
    expect(screen.queryByTestId('language-mismatch-warning')).not.toBeInTheDocument();
    expect(screen.getByTestId('lang-switch-vie')).toHaveAttribute('aria-pressed', 'true');
    const voiceSelect = screen.getByLabelText('Narrator Voice Selection') as HTMLSelectElement;
    expect(voiceSelect.value).toBe('vi-VN-HoaiMyNeural');
  });

  it('activates Vertical 9:16 Short Video mode presets, drafts short script, and renders vertical safe-zone canvas', async () => {
    const user = userEvent.setup();
    render(<StudioWorkspacePage />);

    // Click the dedicated "Create Short Video 9:16" mode switcher
    const shortModeBtn = screen.getByTestId('mode-short-video-btn');
    await user.click(shortModeBtn);

    expect(shortModeBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByTestId('short-mode-badge')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Short Video 9:16' })).toBeInTheDocument();

    // Apply Short quick template and draft script
    await user.click(screen.getByRole('button', { name: 'SHORTS HOOK (30S)' }));
    await user.click(screen.getByRole('button', { name: 'Draft Script First' }));

    await waitFor(() => {
      const draftCall = server.fetchMock.mock.calls.find(
        ([url, init]) => String(url).endsWith('/api/v1/scripts/generate') && init?.method === 'POST'
      );
      expect(draftCall).toBeDefined();
      const body = JSON.parse(String(draftCall?.[1]?.body));
      expect(body.aspect_ratio).toBe('9:16');
      expect(body.video_format).toBe('short');
      expect(body.target_slides).toBe(4);
    });

    // Live vertical 9:16 preview renders with Shorts subtitle safe-zone badge
    const canvas = await screen.findByTestId('live-slide-canvas');
    expect(canvas.className).toContain('aspect-[9/16]');
    expect(screen.getByTestId('vertical-shorts-caption-preview')).toHaveTextContent(
      '9:16 SHORTS · SUBTITLES SAFE ZONE'
    );

    // Enqueue Short Video pipeline -> sends speed 1.1 and 4-word subtitle bursts
    await user.click(screen.getByRole('button', { name: 'Generate Short Video 9:16' }));
    await waitFor(() => {
      const genCall = server.fetchMock.mock.calls.find(
        ([url, init]) => String(url).endsWith('/api/v1/videos/generate') && init?.method === 'POST'
      );
      expect(genCall).toBeDefined();
      const body = JSON.parse(String(genCall?.[1]?.body));
      expect(body.aspect_ratio).toBe('9:16');
      expect(body.video_format).toBe('short');
      expect(body.voice_settings.speed).toBe(1.1);
      expect(body.subtitle_settings).toEqual({
        enabled: true,
        style: 'bold_highlight',
        max_words_per_line: 4,
      });
    });
  });

  it('shows strictly pure Vietnamese narrator voices when switched to VIE via global header toggle (hiding English Rachel)', async () => {
    const user = userEvent.setup();
    render(<StudioWorkspacePage />);

    // Switch global UI + voice language to Vietnamese via top-right flag toggle
    await user.click(screen.getByTestId('lang-switch-vie'));

    const voiceSelect = screen.getByLabelText('Narrator Voice Selection') as HTMLSelectElement;
    const optionTextsVi = Array.from(voiceSelect.options).map((opt) => opt.text);

    expect(optionTextsVi).toContain('Hoài My (Nữ Miền Bắc · Tự Nhiên)');
    expect(optionTextsVi).toContain('Nam Minh (Nam Miền Bắc · Trầm Ấm)');
    expect(optionTextsVi).toContain('Thuần Việt Chuẩn (Nữ · Google TTS)');
    expect(optionTextsVi.some((t) => t.includes('Rachel') || t.includes('Northern Female'))).toBe(false);

    // Selecting "Thuần Việt Chuẩn" updates voiceProvider cleanly to 'google_vi'
    await user.selectOptions(voiceSelect, 'vi-VN-GoogleVi');
    expect(voiceSelect.value).toBe('vi-VN-GoogleVi');

    // Apply VI template preserves VI language AND Google Vi narrator voice without resetting
    await user.click(screen.getByRole('button', { name: 'GIÁO DỤC' }));
    expect(voiceSelect.value).toBe('vi-VN-GoogleVi');
    await user.click(screen.getByRole('button', { name: 'Tạo Video Thuyết Trình' }));

    await waitFor(() => {
      const genCall = server.fetchMock.mock.calls.find(
        ([url, init]) => String(url).endsWith('/api/v1/videos/generate') && init?.method === 'POST'
      );
      expect(genCall).toBeDefined();
      const body = JSON.parse(String(genCall?.[1]?.body));
      expect(body.voice_settings.provider).toBe('google_vi');
      expect(body.voice_settings.voice_id).toBe('vi-VN-GoogleVi');
    });
  });

  it('keeps active language locked across all templates and translates active template when toggling EN/VIE', async () => {
    const user = userEvent.setup();
    render(<StudioWorkspacePage />);

    const promptInput = screen.getByLabelText('Presentation Topic or Raw Narrative') as HTMLTextAreaElement;
    const voiceSelect = screen.getByLabelText('Narrator Voice Selection') as HTMLSelectElement;

    // Default EN: clicking EDUCATIONAL or MARKETING populates English prompt and stays on EN
    await user.click(screen.getByRole('button', { name: 'EDUCATIONAL' }));
    expect(screen.getByTestId('lang-switch-en')).toHaveAttribute('aria-pressed', 'true');
    expect(voiceSelect.value).toBe('en-US-GuyNeural');
    expect(promptInput.value).toContain('Cloud Computing');

    await user.click(screen.getByRole('button', { name: 'MARKETING' }));
    expect(screen.getByTestId('lang-switch-en')).toHaveAttribute('aria-pressed', 'true');
    expect(voiceSelect.value).toBe('en-US-GuyNeural');
    expect(promptInput.value).toContain('synchronized bilingual studio-grade presentation videos');

    // Switching global language to VIE translates the selected template to Vietnamese simultaneously
    await user.click(screen.getByTestId('lang-switch-vie'));
    expect(screen.getByTestId('lang-switch-vie')).toHaveAttribute('aria-pressed', 'true');
    expect(voiceSelect.value).toBe('vi-VN-HoaiMyNeural');
    expect(screen.getByLabelText('Chủ Đề Thuyết Trình Hoặc Nội Dung Thô')).toHaveValue(
      'Giới thiệu nền tảng tự động biến văn bản thành video thuyết trình song ngữ Anh - Việt trong 60 giây với chất lượng phòng thu.'
    );

    // While in VIE: clicking TECH EXPLAINER / PITCH DECK fills Vietnamese prompt and NEVER flips back to EN
    await user.click(screen.getByRole('button', { name: 'GIẢI THÍCH CÔNG NGHỆ' }));
    expect(screen.getByTestId('lang-switch-vie')).toHaveAttribute('aria-pressed', 'true');
    expect(voiceSelect.value).toBe('vi-VN-HoaiMyNeural');
    expect((screen.getByLabelText('Chủ Đề Thuyết Trình Hoặc Nội Dung Thô') as HTMLTextAreaElement).value).toContain(
      'Microservices hướng sự kiện'
    );
  });

  it('extracts TikTok channel context, reveals fallback notes on verification gate, and forwards channel_context to generation', async () => {
    const user = userEvent.setup();
    render(<StudioWorkspacePage />);

    const urlInput = screen.getByTestId('tiktok-profile-url-input');
    const analyzeBtn = screen.getByTestId('analyze-tiktok-btn');

    // 1. Gated/blocked profile reveals manual notes input cleanly without bypassing CAPTCHA
    await user.type(urlInput, 'https://www.tiktok.com/@blocked.creator');
    await user.click(analyzeBtn);

    expect(await screen.findByTestId('tiktok-channel-error')).toHaveTextContent(
      'TikTok gated direct automated profile access'
    );
    const notesInput = screen.getByTestId('tiktok-manual-notes-input');
    await user.type(notesInput, 'AI workflows and creator tools #AI');
    await user.click(analyzeBtn);

    // 2. Renders Channel Context summary card and auto-populates empty prompt
    const card = await screen.findByTestId('tiktok-channel-context-card');
    expect(card).toHaveTextContent('Dat Tech & AI');
    expect(card).toHaveTextContent('@dattech.ai');
    expect(card).toHaveTextContent('Technology & AI Workflows');

    const promptInput = screen.getByLabelText('Presentation Topic or Raw Narrative') as HTMLTextAreaElement;
    expect(promptInput.value).toContain('@dattech.ai');

    // 3. Drafting script includes channel_context in request body
    await user.click(screen.getByRole('button', { name: 'Draft Script First' }));
    await waitFor(() => {
      const draftCall = server.fetchMock.mock.calls.find(
        ([url, init]) => String(url).endsWith('/api/v1/scripts/generate') && init?.method === 'POST'
      );
      expect(draftCall).toBeDefined();
      const body = JSON.parse(String(draftCall?.[1]?.body));
      expect(body.channel_context.handle).toBe('@dattech.ai');
      expect(body.channel_context.niche_category).toBe('Technology & AI Workflows');
    });

    // 4. Clearing channel context removes card cleanly
    await user.click(screen.getByTestId('clear-channel-context-btn'));
    expect(screen.queryByTestId('tiktok-channel-context-card')).not.toBeInTheDocument();
  });
});
