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

  it('connects to API telemetry and switches full UI between VIE and EN via top-right flags', async () => {
    const user = userEvent.setup();
    render(<StudioWorkspacePage />);

    // Initial health & telemetry loaded
    await waitFor(() => {
      expect(screen.getByTestId('api-status-chip')).toHaveTextContent('API TRỰC TUYẾN');
    });

    // Top-right VIE & EN buttons with flag SVGs are visible
    const vieBtn = screen.getByTestId('lang-switch-vie');
    const enBtn = screen.getByTestId('lang-switch-en');
    expect(vieBtn).toHaveAttribute('aria-pressed', 'true');
    expect(enBtn).toHaveAttribute('aria-pressed', 'false');
    expect(vieBtn.querySelector('svg[data-flag="vn"]')).toBeInTheDocument();
    expect(enBtn.querySelector('svg[data-flag="gb"]')).toBeInTheDocument();

    // Switch to English
    await user.click(enBtn);
    expect(enBtn).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem('aik-studio-locale')).toBe('en');
    expect(screen.getByText('Prompt to Synchronized Slide Video.')).toBeInTheDocument();
    expect(screen.getByTestId('api-status-chip')).toHaveTextContent('API ONLINE');
    expect(screen.getByRole('button', { name: 'Generate Presentation' })).toBeInTheDocument();

    // Switch back to Vietnamese
    await user.click(vieBtn);
    expect(vieBtn).toHaveAttribute('aria-pressed', 'true');
    expect(window.localStorage.getItem('aik-studio-locale')).toBe('vi');
    expect(screen.getByText('Biến Prompt thành Video Slide Đồng Bộ.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo Video Thuyết Trình' })).toBeInTheDocument();
  });

  it('shows validation alert on empty prompt, applies quick template, and auditions voice audio', async () => {
    const user = userEvent.setup();
    render(<StudioWorkspacePage />);

    await waitFor(() => {
      expect(screen.getByTestId('api-status-chip')).toHaveTextContent('API TRỰC TUYẾN');
    });

    // Submit empty prompt -> displays localized validation error
    await user.click(screen.getByRole('button', { name: 'Tạo Video Thuyết Trình' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Prompt phải chứa ít nhất 3 ký tự.');

    // Click quick template chip -> clears error and populates prompt & settings
    await user.click(screen.getByRole('button', { name: 'GIẢI THÍCH CÔNG NGHỆ' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const promptBox = screen.getByLabelText('Chủ Đề Thuyết Trình Hoặc Nội Dung Thô') as HTMLTextAreaElement;
    expect(promptBox.value).toContain('Event-Driven Microservices');

    // Audition Voice Sample mounts audio preview player
    await user.click(screen.getByRole('button', { name: 'NGHE THỬ GIỌNG ĐỌC' }));
    await waitFor(() => {
      const audioEl = screen.getByTestId('voice-audition-player') as HTMLAudioElement;
      expect(audioEl).toBeInTheDocument();
      expect(audioEl.getAttribute('src')).toContain('blob:');
    });
  });

  it('drafts script, edits slide content in real time, and adds/removes slides within 3..8 bounds', async () => {
    const user = userEvent.setup();
    render(<StudioWorkspacePage />);

    await user.click(screen.getByRole('button', { name: 'GIẢI THÍCH CÔNG NGHỆ' }));
    await user.click(screen.getByRole('button', { name: 'Soạn Kịch Bản Trước' }));

    // SlideReviewer mounts with 3 slides
    await waitFor(() => {
      expect(screen.getByTestId('live-slide-canvas')).toBeInTheDocument();
    });
    expect(screen.getByText('DANH SÁCH SLIDE (3 / 8)')).toBeInTheDocument();

    // Edit Slide 1 heading -> immediately reflected on live slide canvas
    const headingInput = screen.getByLabelText('Tiêu Đề Slide') as HTMLInputElement;
    await user.clear(headingInput);
    await user.type(headingInput, 'Custom Studio Heading');
    expect(screen.getByTestId('live-slide-canvas')).toHaveTextContent('Custom Studio Heading');

    // Switch layout template -> updates live canvas data-layout attribute
    await user.selectOptions(screen.getByLabelText('Mẫu Bố Cục (Layout)'), 'quote_highlight');
    expect(screen.getByTestId('live-slide-canvas')).toHaveAttribute('data-layout', 'quote_highlight');

    // Add slide -> increases from 3/8 to 4/8, then Remove -> drops back to 3/8
    await user.click(screen.getByRole('button', { name: '+ THÊM' }));
    expect(screen.getByText('DANH SÁCH SLIDE (4 / 8)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'XÓA' }));
    expect(screen.getByText('DANH SÁCH SLIDE (3 / 8)')).toBeInTheDocument();
  });

  it('executes full pipeline, streams realtime WebSocket progress to 100%, and displays MP4 player', async () => {
    const user = userEvent.setup();
    render(<StudioWorkspacePage />);

    await user.click(screen.getByRole('button', { name: 'GIẢI THÍCH CÔNG NGHỆ' }));
    await user.click(screen.getByRole('checkbox', { name: /Kết xuất ngay video MP4 1080p/i }));
    await user.click(screen.getByRole('button', { name: 'Tạo Video Thuyết Trình' }));

    // Wait for LiveProgressTracker and MockWebSocket to open
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    });

    const ws = MockWebSocket.instances[0];

    // Emit live progress events over WebSocket
    await act(async () => {
      ws.emitEvent({
        job_id: server.jobState.job_id,
        step: 'generating_script',
        progress_percentage: 20,
        message: 'Generating script via Gemini 3.8 Flash... (20%)',
        timestamp: '2026-11-17T11:05:00Z',
      });
    });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '20');

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
      expect(screen.getByRole('link', { name: 'Tải Xuống MP4 1080p' })).toHaveAttribute(
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
      expect(screen.getByTestId('job-status-chip')).toHaveTextContent('HOÀN TẤT');
      expect(screen.getByTestId('live-slide-canvas')).toBeInTheDocument();
    });
  });

  it('searches stock visuals, previews backdrop on canvas, sends slide_backgrounds on compile, and shows gradient fallback notice', async () => {
    const user = userEvent.setup();
    render(<StudioWorkspacePage />);

    await user.click(screen.getByRole('button', { name: 'GIẢI THÍCH CÔNG NGHỆ' }));
    await user.click(screen.getByRole('button', { name: 'Soạn Kịch Bản Trước' }));

    await waitFor(() => {
      expect(screen.getByTestId('live-slide-canvas')).toBeInTheDocument();
    });

    // Search Unsplash/Pexels stock backgrounds
    await user.click(screen.getByRole('button', { name: 'Tìm Ảnh Nền Stock' }));
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
    await user.click(screen.getByRole('button', { name: 'Biên Dịch & Xuất MP4 1080p' }));
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
    await user.click(screen.getByRole('button', { name: 'Dùng Nền Gradient' }));
    expect(screen.queryByTestId('canvas-stock-backdrop')).not.toBeInTheDocument();

    // Missing keys / empty match triggers graceful fallback note without error crash
    server.setStockSearchResponse({
      query: 'microservices cloud diagram',
      provider_used: null,
      fallback_to_gradient: true,
      results: [],
    });
    await user.click(screen.getByRole('button', { name: 'Tìm Ảnh Nền Stock' }));
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

    const downloadLink = screen.getByRole('link', { name: 'Tải Xuống MP4 1080p' });
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

  it('enables mood-based BGM with -18dB speech ducking, mounts preview audio, and submits bgm_settings', async () => {
    const user = userEvent.setup();
    render(<StudioWorkspacePage />);

    await user.click(screen.getByRole('button', { name: 'GIẢI THÍCH CÔNG NGHỆ' }));
    await user.click(screen.getByTestId('bgm-mood-inspiring'));

    expect(screen.getByTestId('bgm-ducking-toggle')).toBeInTheDocument();

    await user.click(screen.getByTestId('bgm-preview-btn'));
    const bgmPlayer = screen.getByTestId('bgm-audition-player') as HTMLAudioElement;
    expect(bgmPlayer).toBeInTheDocument();
    expect(bgmPlayer.getAttribute('src')).toContain('/api/v1/bgm/tracks/inspiring-horizon/preview');

    await user.click(screen.getByRole('button', { name: 'Tạo Video Thuyết Trình' }));
    await waitFor(() => {
      const genCall = server.fetchMock.mock.calls.find(
        ([url, init]) => String(url).endsWith('/api/v1/videos/generate') && init?.method === 'POST'
      );
      expect(genCall).toBeDefined();
      const body = JSON.parse(String(genCall?.[1]?.body));
      expect(body.bgm_settings).toEqual({
        enabled: true,
        mood: 'inspiring',
        track_id: null,
        ducking_enabled: true,
      });
    });
  });
});
