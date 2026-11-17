/**
 * Automated Verification & Test Suite for Milestone M2.2:
 * StudioBlank Design System Compliance, Web Studio Components, and API Helpers.
 */

import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

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
    expect(componentFiles.length).toBeGreaterThanOrEqual(5);

    for (const file of componentFiles) {
      const src = fs.readFileSync(path.join(componentsDir, file), 'utf-8');
      // StudioBlank strictly forbids rounded corners and box-shadow classes
      expect(src).not.toMatch(/\brounded-(sm|md|lg|xl|2xl|3xl|full)\b/);
      expect(src).not.toMatch(/\bshadow-(sm|md|lg|xl|2xl)\b/);
      // Transitions must stay <= 200ms
      expect(src).not.toMatch(/\bduration-(300|500|700|1000)\b/);
    }
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

describe('M2.2 Web Studio UI Components SSR Rendering', () => {
  it('renders StudioHeader with live API & Redis queue telemetry', () => {
    const html = renderToStaticMarkup(
      <StudioHeader
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

    expect(html).toContain('AIK — STUDIO');
    expect(html).toContain('API ONLINE');
    expect(html).toContain('gemini-3.8-flash');
    expect(html).toContain('QUEUE: redis');
  });

  it('renders PromptStudioForm with quick templates, EN/VI chips, voice audition, and error notice', () => {
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

    const html = renderToStaticMarkup(
      <PromptStudioForm
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

    expect(html).toContain('TECH EXPLAINER');
    expect(html).toContain('EDUCATIONAL');
    expect(html).toContain('PITCH DECK');
    expect(html).toContain('MARKETING');
    expect(html).toContain('AUDITION VOICE SAMPLE');
    expect(html).toContain('Voice audition audio player');
    expect(html).toContain('Prompt validation sample message');
    expect(html).toContain('Generate Presentation');
    expect(html).toContain('Draft Script First');
  });

  it('renders LiveProgressTracker with WebSocket event feed and 1080p MP4 player on completion', () => {
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

    const html = renderToStaticMarkup(
      <LiveProgressTracker
        job={completedJob}
        events={completedJob.progress_events}
        wsConnected={false}
      />
    );

    expect(html).toContain('job_abc123');
    expect(html).toContain('100%');
    expect(html).toContain('MASTER RENDER COMPLETE');
    expect(html).toContain('Download 1080p MP4');
    expect(html).toContain('Export Remotion Props JSON');
    expect(html).toContain('http://localhost:8000/api/v1/jobs/job_abc123/video');
    expect(html).toContain('Video rendering complete and ready for playback! (100%)');
  });

  it('renders SlideReviewer with 16:9 canvas, slide list, audio player, and inline editor', () => {
    const html = renderToStaticMarkup(
      <SlideReviewer
        jobId="job_demo_01"
        script={SAMPLE_SCRIPT}
        remotionProps={SAMPLE_REMOTION_PROPS}
        aspectRatio="16:9"
        isCompiling={false}
        onUpdateScript={vi.fn()}
        onCompileSlides={vi.fn()}
      />
    );

    expect(html).toContain('Event-Driven Cloud Architecture');
    expect(html).toContain('data-testid="live-slide-canvas"');
    expect(html).toContain('aspect-video');
    expect(html).toContain('SYNTHESIZED SLIDE AUDIO');
    expect(html).toContain('slide_1_abc12345.mp3');
    expect(html).toContain('Compile &amp; Render 1080p MP4');
  });

  it('renders JobsArchiveFooter on inverse #0A0A0A surface with selectable jobs', () => {
    const html = renderToStaticMarkup(
      <JobsArchiveFooter
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

    expect(html).toContain('bg-[#0A0A0A]');
    expect(html).toContain('Recent Render History');
    expect(html).toContain('job_01');
    expect(html).toContain('Event-Driven Cloud Architecture');
  });
});
