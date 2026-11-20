/**
 * Automated Verification & Test Suite for 9:16 Vertical Short Video Composition:
 * Verifies 1080x1920 Portrait Layouts (Single-Column Responsive Stacks),
 * Shorts Safe-Zone Padding, and Dynamic 4-Word Bold Karaoke Captions.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Mock Remotion in true 9:16 Vertical Shorts resolution (1080x1920)
vi.mock('remotion', async () => {
  const ReactMod = await import('react');
  return {
    useCurrentFrame: () => 24,
    useVideoConfig: () => ({
      fps: 30,
      durationInFrames: 180,
      width: 1080,
      height: 1920,
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
      const ratio = (input - inputRange[0]) / (inputRange[1] - inputRange[0] || 1);
      return outputRange[0] + ratio * (outputRange[1] - outputRange[0]);
    },
    AbsoluteFill: ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) =>
      ReactMod.createElement('div', { 'data-remotion': 'AbsoluteFill', style }, children),
    Series: Object.assign(
      ({ children }: { children?: React.ReactNode }) =>
        ReactMod.createElement('div', { 'data-remotion': 'Series' }, children),
      {
        Sequence: ({ children }: { children?: React.ReactNode }) =>
          ReactMod.createElement('div', { 'data-remotion': 'Series.Sequence' }, children),
      }
    ),
    Sequence: ({ children }: { children?: React.ReactNode }) =>
      ReactMod.createElement('div', { 'data-remotion': 'Sequence' }, children),
    Audio: ({ src }: { src: string }) => ReactMod.createElement('audio', { src }),
    Img: ({ src, style }: { src: string; style?: React.CSSProperties }) =>
      ReactMod.createElement('img', { src, style }),
    staticFile: (p: string) => `/${p.replace(/^\/+/, '')}`,
  };
});

import { KaraokeCaptions } from '../src/components/KaraokeCaptions';
import { SlideCard } from '../src/components/SlideCard';
import { SlidePresentation } from '../src/compositions/SlidePresentation';
import { SlideData, WordTimestamp } from '../src/types';

describe('9:16 Vertical Short Video Portrait Rendering', () => {
  it('adapts SlideCard padding, orientation attribute, and single-column grids across all 5 layouts in 1080x1920', () => {
    const shortDeck: SlideData[] = [
      {
        slide_index: 1,
        layout: 'title_intro',
        heading: '3-Second Viral Hook',
        bullet_points: ['Stop scrolling now'],
        voiceover_duration_seconds: 3.5,
      },
      {
        slide_index: 2,
        layout: 'split_card',
        heading: 'Why AI Shorts Convert Faster',
        bullet_points: ['5x speed', 'Zero editing friction'],
        voiceover_duration_seconds: 4.0,
      },
      {
        slide_index: 3,
        layout: 'bullet_list',
        heading: 'Quy Trình Tạo Short',
        bullet_points: ['Hook 3 giây', 'Màu tương phản', 'Phụ đề karaoke'],
        voiceover_duration_seconds: 4.5,
      },
      {
        slide_index: 4,
        layout: 'quote_highlight',
        heading: 'Vertical framing demands bold clarity.',
        bullet_points: ['Mobile-First Design'],
        voiceover_duration_seconds: 3.5,
      },
      {
        slide_index: 5,
        layout: 'conclusion_cta',
        heading: 'Try Shorts Workflow Today',
        bullet_points: ['Save preset', 'Publish to TikTok & Reels'],
        voiceover_duration_seconds: 4.0,
      },
    ];

    for (const slide of shortDeck) {
      const html = renderToStaticMarkup(<SlideCard slide={slide} totalSlides={5} />);
      expect(html).toContain('data-orientation="portrait"');
      expect(html).toContain(`data-layout="${slide.layout}"`);
      expect(html).toContain('padding:112px 54px 250px 54px');
      // Ensures multi-column horizontal splits collapse vertically to 1fr in 1080x1920
      expect(html).not.toContain('1.35fr 0.95fr');
      expect(html).not.toContain('1fr 1.05fr');
      expect(html).not.toContain('0.92fr 1.25fr');
    }
  });

  it('positions KaraokeCaptions in Shorts mobile safe zone (bottom 144px, bold 42px) and defaults SlidePresentation to 4 words per line', () => {
    const words: WordTimestamp[] = [
      { word: 'Stop', start_seconds: 0.0, end_seconds: 0.25 },
      { word: 'scrolling', start_seconds: 0.25, end_seconds: 0.55 },
      { word: 'right', start_seconds: 0.55, end_seconds: 0.8 },
      { word: 'now!', start_seconds: 0.8, end_seconds: 1.1 },
      { word: 'Watch', start_seconds: 1.2, end_seconds: 1.5 },
      { word: 'this', start_seconds: 1.5, end_seconds: 1.8 },
    ];

    const captionHtml = renderToStaticMarkup(
      <KaraokeCaptions words={words} captionStyle="bold_highlight" maxWordsPerLine={4} />
    );
    expect(captionHtml).toContain('data-orientation="portrait"');
    expect(captionHtml).toContain('bottom:144px');
    expect(captionHtml).toContain('font-size:42px');

    const fullShortHtml = renderToStaticMarkup(
      <SlidePresentation
        project_title="Short Video Test"
        fps={30}
        width={1080}
        height={1920}
        slides={[
          {
            slide_index: 1,
            layout: 'title_intro',
            heading: 'Quick Hook',
            bullet_points: ['Short insight'],
            voiceover_duration_seconds: 4.0,
            word_timestamps: words,
          },
        ]}
        subtitles={{
          enabled: true,
          style: 'bold_highlight',
        }}
      />
    );
    expect(fullShortHtml).toContain('data-orientation="portrait"');
    expect(fullShortHtml).toContain('data-testid="karaoke-captions-overlay"');
    // Line 1 should chunk cleanly to 4 words max ("Stop scrolling right now!"), hiding "Watch this" on frame 24
    expect(fullShortHtml).toContain('scrolling');
    expect(fullShortHtml).not.toContain('>Watch<');
  });
});
