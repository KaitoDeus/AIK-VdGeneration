/**
 * Automated Verification & Test Suite for Milestone M1.4:
 * Remotion Presentation Compositions, 5 Slide Layouts, Spring Physics & Dynamic Metadata.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Mock Remotion runtime hooks for deterministic unit & SSR component testing
vi.mock('remotion', async () => {
  const ReactMod = await import('react');
  return {
    useCurrentFrame: () => 25,
    useVideoConfig: () => ({
      fps: 30,
      durationInFrames: 180,
      width: 1920,
      height: 1080,
      id: 'SlidePresentation',
    }),
    spring: () => 1,
    interpolate: (
      input: number,
      inputRange: readonly number[],
      outputRange: readonly number[]
    ) => {
      if (input <= inputRange[0]) return outputRange[0];
      if (input >= inputRange[inputRange.length - 1]) {
        return outputRange[outputRange.length - 1];
      }
      const ratio =
        (input - inputRange[0]) / (inputRange[1] - inputRange[0] || 1);
      return outputRange[0] + ratio * (outputRange[1] - outputRange[0]);
    },
    AbsoluteFill: ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) =>
      ReactMod.createElement('div', { 'data-remotion': 'AbsoluteFill', style }, children),
    Series: Object.assign(
      ({ children }: { children?: React.ReactNode }) =>
        ReactMod.createElement('div', { 'data-remotion': 'Series' }, children),
      {
        Sequence: ({
          children,
          durationInFrames,
        }: {
          children?: React.ReactNode;
          durationInFrames: number;
        }) =>
          ReactMod.createElement(
            'div',
            { 'data-remotion': 'Series.Sequence', 'data-duration-frames': durationInFrames },
            children
          ),
      }
    ),
    Sequence: ({
      children,
      from,
    }: {
      children?: React.ReactNode;
      from: number;
    }) =>
      ReactMod.createElement(
        'div',
        { 'data-remotion': 'Sequence', 'data-from-frame': from },
        children
      ),
    Audio: ({ src, volume }: { src: string; volume?: number }) =>
      ReactMod.createElement('audio', { 'data-remotion': 'Audio', src, 'data-volume': volume }),
    Img: ({ src, style }: { src: string; style?: React.CSSProperties }) =>
      ReactMod.createElement('img', { src, style }),
    staticFile: (p: string) => `/${p.replace(/^\/+/, '')}`,
    Composition: () => null,
    registerRoot: () => undefined,
  };
});

import { SlideCard } from '../src/components/SlideCard';
import { SlidePresentation } from '../src/compositions/SlidePresentation';
import { defaultProps } from '../src/index';
import { SlideData, SlideLayout } from '../src/types';
import {
  calculatePresentationMetadata,
  resolveSlideDurationInFrames,
  resolveTheme,
} from '../src/utils/timing';

describe('M1.4 Audio-Driven Frame Synchronization & Metadata Math', () => {
  it('computes exact frame count using 0.2s pre-padding + audio + 0.5s post-padding at 30fps', () => {
    const slide: SlideData = {
      slide_index: 1,
      layout: 'title_intro',
      heading: 'Cloud Computing',
      voiceover_duration_seconds: 5.4,
    };
    // (0.2 + 5.4 + 0.5) * 30 = 6.1 * 30 = 183 frames
    expect(resolveSlideDurationInFrames(slide, 30)).toBe(183);
  });

  it('clamps short audio durations to a minimum of 90 frames (3.0 seconds)', () => {
    const shortSlide: SlideData = {
      slide_index: 1,
      layout: 'title_intro',
      heading: 'Short Intro',
      voiceover_duration_seconds: 1.0,
    };
    expect(resolveSlideDurationInFrames(shortSlide, 30)).toBe(90);
  });

  it('prioritizes pre-calculated M1.3 calculated_frames when >= 90', () => {
    const preCalculatedSlide: SlideData = {
      slide_index: 2,
      layout: 'bullet_list',
      heading: 'Pre-calculated Slide',
      voiceover_duration_seconds: 4.0,
      calculated_frames: 215,
    };
    expect(resolveSlideDurationInFrames(preCalculatedSlide, 30)).toBe(215);
  });

  it('dynamically computes total composition durationInFrames across all 5 default slides', () => {
    const meta = calculatePresentationMetadata(defaultProps);
    expect(meta.fps).toBe(30);
    expect(meta.width).toBe(1920);
    expect(meta.height).toBe(1080);

    // Slide 1 (4.5s -> 156) + Slide 2 (6.0s -> 201) + Slide 3 (5.5s -> 186) + Slide 4 (4.8s -> 165) + Slide 5 (5.2s -> 177) = 885 frames
    expect(meta.durationInFrames).toBe(885);
  });

  it('supports 9:16 vertical aspect ratio dimensions (1080x1920)', () => {
    const meta = calculatePresentationMetadata({
      ...defaultProps,
      width: 1080,
      height: 1920,
    });
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1920);
  });
});

describe('M1.4 5 Slide Layout Templates Rendering Verification', () => {
  const layouts: SlideLayout[] = [
    'title_intro',
    'bullet_list',
    'split_card',
    'quote_highlight',
    'conclusion_cta',
  ];

  it.each(layouts)('renders layout "%s" with heading and bullet points cleanly', (layout) => {
    const slide: SlideData = {
      slide_index: 2,
      layout,
      heading: `Test Heading for ${layout}`,
      bullet_points: ['First key insight', 'Second architectural pillar'],
      voiceover_duration_seconds: 5.0,
    };

    const html = renderToStaticMarkup(
      <SlideCard
        slide={slide}
        projectTitle="AIK Test Deck"
        totalSlides={5}
      />
    );

    expect(html).toContain(`data-layout="${layout}"`);
    expect(html).toContain(`Test Heading for ${layout}`);
    expect(html).toContain('First key insight');
    expect(html).toContain('Second architectural pillar');
    expect(html).toContain('AIK Test Deck');
    expect(html).toContain('02 / 05');
    expect(html).toContain('data-testid="slide-progress-bar"');
  });

  it('renders background image with Ken Burns container when background_image_url is provided', () => {
    const slideWithBg: SlideData = {
      slide_index: 1,
      layout: 'title_intro',
      heading: 'Visual Backdrop Test',
      voiceover_duration_seconds: 4.5,
      background_image_url: '/assets/cloud_bg.jpg',
    };

    const html = renderToStaticMarkup(<SlideCard slide={slideWithBg} />);
    expect(html).toContain('data-testid="slide-background-image"');
    expect(html).toContain('src="/assets/cloud_bg.jpg"');
  });

  it('gracefully falls back to CSS gradient without image element when background_image_url is null', () => {
    const slideNoBg: SlideData = {
      slide_index: 1,
      layout: 'title_intro',
      heading: 'Gradient Fallback Test',
      voiceover_duration_seconds: 4.5,
      background_image_url: null,
    };

    const html = renderToStaticMarkup(<SlideCard slide={slideNoBg} />);
    expect(html).not.toContain('data-testid="slide-background-image"');
    expect(html).toContain('radial-gradient');
  });

  it('resolves custom theme tokens with fallback defaults', () => {
    const custom = resolveTheme({ primaryColor: '#f43f5e' });
    expect(custom.primaryColor).toBe('#f43f5e');
    expect(custom.backgroundColor).toBe('#0f172a');
  });
});

describe('M1.4 SlidePresentation Master Composition Sequencing', () => {
  it('sequences all slides with audio offset (6 frames = 0.2s @ 30fps) and optional BGM', () => {
    const html = renderToStaticMarkup(
      <SlidePresentation
        project_title="Full Pipeline Demo"
        slides={[
          {
            slide_index: 1,
            layout: 'title_intro',
            heading: 'Slide One',
            voiceover_audio_url: '/audio_temp/job_1/slide_1.mp3',
            voiceover_duration_seconds: 4.5,
          },
          {
            slide_index: 2,
            layout: 'conclusion_cta',
            heading: 'Slide Two',
            voiceover_audio_url: '/audio_temp/job_1/slide_2.mp3',
            voiceover_duration_seconds: 5.4,
          },
        ]}
        bgm={{
          enabled: true,
          audio_url: '/music/ambient.mp3',
          volume: 0.15,
        }}
      />
    );

    expect(html).toContain('data-duration-frames="156"');
    expect(html).toContain('data-duration-frames="183"');
    expect(html).toContain('data-from-frame="6"');
    expect(html).toContain('src="/audio_temp/job_1/slide_1.mp3"');
    expect(html).toContain('src="/audio_temp/job_1/slide_2.mp3"');
    expect(html).toContain('src="/music/ambient.mp3"');
  });
});
