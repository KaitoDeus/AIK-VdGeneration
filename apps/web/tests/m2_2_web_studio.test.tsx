/**
 * Automated Verification & Test Suite for Milestone M2.2:
 * StudioBlank Design System Compliance, Top-Right Bilingual Switcher (VIE/EN + Flags),
 * Web Studio Components, and API Helpers.
 */

import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { LanguageSwitcher, UkFlagIcon, VietnamFlagIcon } from '../src/components/FlagIcons';
import { JobsArchiveFooter } from '../src/components/JobsArchiveFooter';
import { LiveProgressTracker } from '../src/components/LiveProgressTracker';
import { PromptStudioForm, StudioFormState } from '../src/components/PromptStudioForm';
import { SlideReviewer } from '../src/components/SlideReviewer';
import { StudioHeader } from '../src/components/StudioHeader';
import {
  buildWebSocketUrl,
  getApiBaseUrl,
  getJobAudioUrl,
  getJobVideoUrl,
} from '../src/lib/api';
import { DEFAULT_VOICES, PROMPT_TEMPLATES } from '../src/lib/templates';
import { JobStatusResponse, PresentationScript, RemotionCompositionProps } from '../src/types/studio';

const SAMPLE_SCRIPT: PresentationScript = {
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
      layout: 'quote_highlight',
      heading: 'Audio drives the timeline with precision frame synchronization.',
      bullet_points: ['Audio-First Synchronicity'],
      voiceover_script: 'Audio duration determines the exact frame length of every slide.',
      visual_keywords: 'audio waveform timeline',
    },
    {
      slide_index: 3,
      layout: 'conclusion_cta',
      heading: 'Deploy to Production Today',
      bullet_points: ['Queue jobs with Redis', 'Render 1080p MP4 via Remotion'],
      voiceover_script: 'Start building asynchronous video pipelines today.',
      visual_keywords: 'rocket deployment server',
    },
  ],
};

const SAMPLE_REMOTION_PROPS: RemotionCompositionProps = {
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
      bullet_points: ['Decoupled message brokers'],
      voiceover_script: 'Welcome to our architecture walkthrough.',
      voiceover_audio_url: '/audio_temp/job_demo_01/slide_1_abc12345.mp3',
      voiceover_audio_path: '/tmp/slide_1_abc12345.mp3',
      voiceover_duration_seconds: 4.5,
      calculated_frames: 156,
      background_image_url: null,
    },
  ],
  bgm: { enabled: false, audio_url: null, volume: 0.15 },
};

describe('M2.2 StudioBlank Design System Strict Compliance', () => {
  it('enforces 0px border-radius globally and avoids decorative shadows across all components', () => {
    const globalsCss = fs.readFileSync(
      path.resolve(__dirname, '../src/app/globals.css'),
      'utf-8'
    );
    expect(globalsCss).toContain('border-radius: 0px !important');
    expect(globalsCss).toContain('#FAFAFA');
    expect(globalsCss).toContain('#0A0A0A');

    const componentsDir = path.resolve(__dirname, '../src/components');
    const componentFiles = fs.readdirSync(componentsDir).filter((f) => f.endsWith('.tsx'));
    expect(componentFiles.length).toBeGreaterThanOrEqual(6);

    for (const file of componentFiles) {
      const src = fs.readFileSync(path.join(componentsDir, file), 'utf-8');
      expect(src).not.toMatch(/\brounded-(sm|md|lg|xl|2xl|3xl|full)\b/);
      expect(src).not.toMatch(/\bshadow-(sm|md|lg|xl|2xl)\b/);
      expect(src).not.toMatch(/\bduration-(300|500|700|1000)\b/);
    }
  });
});

describe('M2.2 Top-Right Bilingual Language Switcher (VIE / EN + SVG Flags)', () => {
  it('renders crisp geometric Vietnam flag for VIE and UK Union Jack flag for EN', () => {
    const vnFlagHtml = renderToStaticMarkup(<VietnamFlagIcon />);
    expect(vnFlagHtml).toContain('data-flag="vn"');
    expect(vnFlagHtml).toContain('#DA251D');
    expect(vnFlagHtml).toContain('#FFFF00');

    const ukFlagHtml = renderToStaticMarkup(<UkFlagIcon />);
    expect(ukFlagHtml).toContain('data-flag="gb"');
    expect(ukFlagHtml).toContain('#012169');
    expect(ukFlagHtml).toContain('#C8102E');

    const switcherVi = renderToStaticMarkup(<LanguageSwitcher locale="vi" onChange={vi.fn()} />);
    expect(switcherVi).toContain('data-testid="lang-switch-vie"');
    expect(switcherVi).toContain('VIE');
    expect(switcherVi).toContain('data-flag="vn"');
    expect(switcherVi).toContain('data-testid="lang-switch-en"');
    expect(switcherVi).toContain('EN');
    expect(switcherVi).toContain('data-flag="gb"');
    expect(switcherVi).toContain('aria-pressed="true"');
  });

  it('embeds LanguageSwitcher in top-right StudioHeader and translates header labels in EN and VI', () => {
    const htmlEn = renderToStaticMarkup(
      <StudioHeader
        locale="en"
        onLocaleChange={vi.fn()}
        apiOnline={true}
        activeSection="studio"
        onNavigate={vi.fn()}
        health={{
          status: 'healthy',
          service: 'AIK-VdGeneration API Gateway',
          version: '0.5.0',
          queue_backend: 'redis',
          external_worker_enabled: false,
          default_llm_model: 'gemini-3.8-flash',
          fallback_llm_model: 'gemini-4-hydrogen',
          supported_tts_providers: ['edge_tts', 'elevenlabs'],
        }}
        queueStats={{
          backend: 'redis',
          redis_connected: true,
          queues: { llm: 0, tts: 0, render: 0 },
          dead_letter_count: 0,
          total_jobs: 2,
        }}
      />
    );
    expect(htmlEn).toContain('WORKSPACE');
    expect(htmlEn).toContain('API ONLINE');
    expect(htmlEn).toContain('QUEUE: redis');
    expect(htmlEn).toContain('data-testid="ui-language-switcher"');

    const htmlVi = renderToStaticMarkup(
      <StudioHeader
        locale="vi"
        onLocaleChange={vi.fn()}
        apiOnline={false}
        activeSection="studio"
        onNavigate={vi.fn()}
        health={null}
        queueStats={null}
      />
    );
    expect(htmlVi).toContain('KHÔNG GIAN TẠO');
    expect(htmlVi).toContain('LỊCH SỬ RENDER');
    expect(htmlVi).toContain('API NGOẠI TUYẾN');
    expect(htmlVi).toContain('VIE');
    expect(htmlVi).toContain('EN');
  });
});

describe('M2.2 API Helper Utilities', () => {
  it('builds WebSocket and media URLs accurately from base URL', () => {
    expect(getApiBaseUrl()).toBe('http://localhost:8000');
    expect(buildWebSocketUrl('job_123')).toBe('ws://localhost:8000/ws/jobs/job_123');
    expect(buildWebSocketUrl('job_123', 'wss://api.example.com/ws/jobs/job_123')).toBe(
      'wss://api.example.com/ws/jobs/job_123'
    );
    expect(getJobAudioUrl('job_123', '/audio_temp/job_123/slide_1_deadbeef.mp3')).toBe(
      'http://localhost:8000/api/v1/jobs/job_123/audio/slide_1_deadbeef.mp3'
    );
    expect(getJobVideoUrl('job_123')).toBe('http://localhost:8000/api/v1/jobs/job_123/video');
  });
});

describe('M2.2 Web Studio Bilingual UI Components SSR Rendering', () => {
  it('renders PromptStudioForm in both EN and VI locales cleanly', () => {
    const formState: StudioFormState = {
      prompt: PROMPT_TEMPLATES[0].prompt,
      language: 'en',
      aspectRatio: '16:9',
      targetDuration: 60,
      theme: 'modern_tech',
      voiceProvider: 'edge_tts',
      voiceId: 'en-US-GuyNeural',
      renderVideo: true,
    };

    const htmlEn = renderToStaticMarkup(
      <PromptStudioForm
        locale="en"
        formState={formState}
        voices={DEFAULT_VOICES}
        isSubmitting={false}
        isAuditioning={false}
        auditionAudioUrl="blob:http://localhost:3000/sample"
        validationError="Prompt validation sample message"
        onChange={vi.fn()}
        onApplyTemplate={vi.fn()}
        onAuditionVoice={vi.fn()}
        onDraftScript={vi.fn()}
        onGeneratePipeline={vi.fn()}
      />
    );
    expect(htmlEn).toContain('TECH EXPLAINER');
    expect(htmlEn).toContain('AUDITION VOICE SAMPLE');
    expect(htmlEn).toContain('Generate Presentation');
    expect(htmlEn).toContain('Draft Script First');
    expect(htmlEn).not.toContain('01 / PROMPT &amp; PARAMETERS');
    expect(htmlEn).not.toContain('<h1');
    expect(htmlEn.indexOf('data-testid="quick-prompt-templates"')).toBeGreaterThan(
      htmlEn.indexOf('<textarea')
    );

    const htmlVi = renderToStaticMarkup(
      <PromptStudioForm
        locale="vi"
        formState={formState}
        voices={DEFAULT_VOICES}
        isSubmitting={false}
        isAuditioning={false}
        auditionAudioUrl={null}
        validationError={null}
        onChange={vi.fn()}
        onApplyTemplate={vi.fn()}
        onAuditionVoice={vi.fn()}
        onDraftScript={vi.fn()}
        onGeneratePipeline={vi.fn()}
      />
    );
    expect(htmlVi).not.toContain('01 / PROMPT &amp; THAM SỐ CẤU HÌNH');
    expect(htmlVi).not.toContain('<h1');
    expect(htmlVi).toContain('Chủ Đề Thuyết Trình Hoặc Nội Dung Thô');
    expect(htmlVi).toContain('NGHE THỬ GIỌNG ĐỌC');
    expect(htmlVi).toContain('Tạo Video Thuyết Trình');
    expect(htmlVi).toContain('Soạn Kịch Bản Trước');
  });

  it('renders LiveProgressTracker with localized progress status and MP4 player', () => {
    const completedJob: JobStatusResponse = {
      job_id: 'job_abc123',
      status: 'completed',
      progress_percentage: 100,
      current_stage: null,
      render_requested: true,
      retry_count: 0,
      script: SAMPLE_SCRIPT,
      remotion_props: SAMPLE_REMOTION_PROPS,
      output_video_path: '/tmp/job_abc123.mp4',
      progress_events: [
        {
          job_id: 'job_abc123',
          step: 'completed',
          progress_percentage: 100,
          message: 'Video rendering complete and ready for playback! (100%)',
          timestamp: '2026-11-17T10:50:00Z',
        },
      ],
    };

    const htmlVi = renderToStaticMarkup(
      <LiveProgressTracker
        locale="vi"
        job={completedJob}
        events={completedJob.progress_events}
        wsConnected={false}
      />
    );
    expect(htmlVi).toContain('KẾT XUẤT VIDEO HOÀN TẤT');
    expect(htmlVi).toContain('Tải Xuống MP4 1080p');
    expect(htmlVi).toContain('Xuất JSON Remotion Props');
    expect(htmlVi).toContain('http://localhost:8000/api/v1/jobs/job_abc123/video');
  });

  it('renders SlideReviewer and JobsArchiveFooter cleanly in EN and VI locales', () => {
    const reviewerVi = renderToStaticMarkup(
      <SlideReviewer
        locale="vi"
        jobId="job_demo_01"
        script={SAMPLE_SCRIPT}
        remotionProps={SAMPLE_REMOTION_PROPS}
        aspectRatio="16:9"
        isCompiling={false}
        onUpdateScript={vi.fn()}
        onCompileSlides={vi.fn()}
      />
    );
    expect(reviewerVi).toContain('TRÌNH DUYỆT &amp; CHỈNH SỬA SLIDE TRỰC QUAN');
    expect(reviewerVi).toContain('Biên Dịch &amp; Xuất MP4 1080p');
    expect(reviewerVi).toContain('slide_1_abc12345.mp3');

    const archiveVi = renderToStaticMarkup(
      <JobsArchiveFooter
        locale="vi"
        activeJobId="job_01"
        onSelectJob={vi.fn()}
        onRefresh={vi.fn()}
        jobs={[
          {
            job_id: 'job_01',
            status: 'completed',
            progress_percentage: 100,
            render_requested: true,
            retry_count: 0,
            script: SAMPLE_SCRIPT,
            progress_events: [],
          },
        ]}
      />
    );
    expect(archiveVi).toContain('bg-[#0A0A0A]');
    expect(archiveVi).toContain('Lịch Sử Kết Xuất Gần Đây');
    expect(archiveVi).toContain('HOÀN TẤT');
  });

  it('alternates NotebookLM per-slide color palettes and diagram variants in SlideReviewer canvas', () => {
    const multiSlideScript: PresentationScript = {
      title: 'Visual Diversity Deck',
      language: 'vi',
      theme: 'modern_tech',
      slides: [
        {
          slide_index: 1,
          layout: 'title_intro',
          heading: 'Mở Đầu Chuyên Đề',
          bullet_points: ['Điểm nhấn 1', 'Điểm nhấn 2'],
          voiceover_script: 'Xin chào các bạn đến với bài thuyết trình hôm nay.',
          visual_keywords: 'abstract studio',
        },
        {
          slide_index: 2,
          layout: 'split_card',
          heading: 'So Sánh Hiệu Năng Hệ Thống',
          bullet_points: ['Trước: 3 giờ', 'Sau: 60 giây'],
          voiceover_script: 'Hãy so sánh hiệu năng trước và sau khi tự động hóa.',
          visual_keywords: 'analytics growth',
        },
        {
          slide_index: 3,
          layout: 'bullet_list',
          heading: 'Kiến Trúc Các Tầng Xử Lý',
          bullet_points: ['Gateway', 'Queue', 'Renderer'],
          voiceover_script: 'Kiến trúc gồm ba tầng xử lý song song.',
          visual_keywords: 'system architecture',
        },
      ],
    };

    const slideOneHtml = renderToStaticMarkup(
      <SlideReviewer
        locale="vi"
        jobId="job_div_01"
        script={multiSlideScript}
        remotionProps={null}
        aspectRatio="16:9"
        isCompiling={false}
        onUpdateScript={vi.fn()}
        onCompileSlides={vi.fn()}
      />
    );
    expect(slideOneHtml).toContain('data-palette-id="sapphire_studio"');
    expect(slideOneHtml).toContain('data-visual-variant="orbital_hero"');
    expect(slideOneHtml).toContain('<svg');
  });
});
