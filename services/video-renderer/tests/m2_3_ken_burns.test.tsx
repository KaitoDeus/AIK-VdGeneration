/**
 * Automated Verification & Test Suite for Milestone M2.3:
 * Alternating Ken Burns Pan/Zoom Math, Asset Source Resolution, & SlideCard Background Scrim.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Mock Remotion runtime hooks deterministically at mid-timeline (frame 90 of 181 => progress = 0.5)
vi.mock('remotion', async () => {
  const ReactMod = await import('react');
  return {
    useCurrentFrame: () => 90,
    useVideoConfig: () => ({
      fps: 30,
      durationInFrames: 181,
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
    Img: ({ src, style }: { src: string; style?: React.CSSProperties }) =>
      ReactMod.createElement('img', { src, style }),
    staticFile: (p: string) => `/${p.replace(/^\/+/, '')}`,
  };
});

import { SlideCard } from '../src/components/SlideCard';
import { SlideData } from '../src/types';
import { computeKenBurnsTransform, resolveAssetSrc } from '../src/utils/timing';

describe('M2.3 Ken Burns Pan & Zoom Calculations', () => {
  it('zooms in and pans right/down across frames for odd-indexed slides', () => {
    const start = computeKenBurnsTransform(0, 181, 1);
    expect(start.scale).toBe(1.02);
    expect(start.translateXPercent).toBe(-1.2);
    expect(start.translateYPercent).toBe(-0.8);
    expect(start.transformCss).toBe('translate(-1.200%, -0.800%) scale(1.0200)');

    const mid = computeKenBurnsTransform(90, 181, 1);
    expect(mid.scale).toBe(1.06);
    expect(mid.translateXPercent).toBe(0);
    expect(mid.translateYPercent).toBe(0);

    const end = computeKenBurnsTransform(180, 181, 1);
    expect(end.scale).toBe(1.1);
    expect(end.translateXPercent).toBe(1.2);
    expect(end.translateYPercent).toBe(0.8);
    expect(end.transformCss).toBe('translate(1.200%, 0.800%) scale(1.1000)');
  });

  it('zooms out and pans left/up across frames for even-indexed slides', () => {
    const start = computeKenBurnsTransform(0, 181, 2);
    expect(start.scale).toBe(1.1);
    expect(start.translateXPercent).toBe(1.2);
    expect(start.translateYPercent).toBe(0.8);

    const end = computeKenBurnsTransform(180, 181, 2);
    expect(end.scale).toBe(1.02);
    expect(end.translateXPercent).toBe(-1.2);
    expect(end.translateYPercent).toBe(-0.8);
  });

  it('clamps out-of-range frames and guards durationInFrames <= 1 against NaN', () => {
    const underflow = computeKenBurnsTransform(-25, 181, 1);
    expect(underflow.scale).toBe(1.02);
    expect(underflow.translateXPercent).toBe(-1.2);

    const overflow = computeKenBurnsTransform(999, 181, 1);
    expect(overflow.scale).toBe(1.1);
    expect(overflow.translateXPercent).toBe(1.2);

    const singleFrame = computeKenBurnsTransform(0, 1, 3);
    expect(Number.isFinite(singleFrame.scale)).toBe(true);
    expect(singleFrame.scale).toBe(1.02);
  });
});

describe('M2.3 Asset Source Resolver & SlideCard Scrim Rendering', () => {
  it('resolves HTTP/HTTPS/data URLs verbatim and local paths via staticFile()', () => {
    expect(resolveAssetSrc('')).toBe('');
    expect(resolveAssetSrc('https://images.unsplash.com/photo-123?w=1920')).toBe(
      'https://images.unsplash.com/photo-123?w=1920'
    );
    expect(resolveAssetSrc('http://localhost:8000/api/v1/jobs/j1/assets/slide_1.jpg')).toBe(
      'http://localhost:8000/api/v1/jobs/j1/assets/slide_1.jpg'
    );
    expect(resolveAssetSrc('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA');
    expect(resolveAssetSrc('/assets/job_99/slide_1_abc.jpg')).toBe('/assets/job_99/slide_1_abc.jpg');
    expect(resolveAssetSrc('assets/job_99/slide_1_abc.jpg')).toBe('/assets/job_99/slide_1_abc.jpg');
  });

  it('renders SlideCard Ken Burns transform, 0.28 image opacity, and dark contrast scrim', () => {
    const slideWithLocalAsset: SlideData = {
      slide_index: 1,
      layout: 'split_card',
      heading: 'Cloud Native Architecture',
      bullet_points: ['Resilient queues', 'Stock backdrop scrim'],
      voiceover_duration_seconds: 5.3,
      background_image_url: '/assets/job_1/slide_1_ab12cd.jpg',
    };

    const html = renderToStaticMarkup(<SlideCard slide={slideWithLocalAsset} totalSlides={3} />);
    expect(html).toContain('data-testid="slide-background-image"');
    expect(html).toContain('src="/assets/job_1/slide_1_ab12cd.jpg"');
    expect(html).toContain('translate(0.000%, 0.000%) scale(1.0600)');
    expect(html).toContain('opacity:0.28');
    expect(html).toContain('rgba(15, 23, 42, 0.45)');
  });

  it('renders external Unsplash/Pexels HTTPS background image cleanly in SlideCard', () => {
    const slideWithRemoteAsset: SlideData = {
      slide_index: 2,
      layout: 'quote_highlight',
      heading: 'Audio drives the visual timeline.',
      voiceover_duration_seconds: 4.0,
      background_image_url: 'https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg',
    };

    const html = renderToStaticMarkup(<SlideCard slide={slideWithRemoteAsset} totalSlides={3} />);
    expect(html).toContain(
      'src="https://images.pexels.com/photos/1181675/pexels-photo-1181675.jpeg"'
    );
  });

  it('omits stock backdrop and uses CSS gradient fallback when background_image_url is unset', () => {
    const slideWithoutAsset: SlideData = {
      slide_index: 3,
      layout: 'conclusion_cta',
      heading: 'Summary',
      voiceover_duration_seconds: 3.5,
    };

    const html = renderToStaticMarkup(<SlideCard slide={slideWithoutAsset} totalSlides={3} />);
    expect(html).not.toContain('data-testid="slide-background-image"');
    expect(html).toContain('radial-gradient');
  });
});
