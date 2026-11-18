/**
 * Automated Verification & Test Suite for Milestone M3.3:
 * Word-Level Karaoke Caption Grouping, Real-Time Frame Word Highlighting,
 * and Remotion SlidePresentation Subtitle Overlay.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Mock Remotion deterministically at frame 24 @ 30fps => 0.8s elapsed (0.6s into speech after 0.2s padding)
vi.mock('remotion', async () => {
  const ReactMod = await import('react');
  return {
    useCurrentFrame: () => 24,
    useVideoConfig: () => ({
      fps: 30,
      durationInFrames: 180,
      width: 1920,
      height: 1080,
      id: 'SlidePresentation',
    }),
    spring: () => 1,
    interpolate: (input: number, inputRange: readonly number[], outputRange: readonly number[]) => {
      if (input <= inputRange[0]) return outputRange[0];
      if (input >= inputRange[inputRange.length - 1]) return outputRange[outputRange.length - 1];
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
import { SlidePresentation } from '../src/compositions/SlidePresentation';
import { WordTimestamp } from '../src/types';
import {
  groupWordsIntoLines,
  resolveActiveCaptionState,
} from '../src/utils/captions';

const SAMPLE_WORDS: WordTimestamp[] = [
  { word: 'Audio', start_seconds: 0.0, end_seconds: 0.25 },
  { word: 'drives', start_seconds: 0.25, end_seconds: 0.5 },
  { word: 'the', start_seconds: 0.5, end_seconds: 0.7 },
  { word: 'visual', start_seconds: 0.7, end_seconds: 1.0 },
  { word: 'timeline.', start_seconds: 1.0, end_seconds: 1.35 },
  { word: 'Clean', start_seconds: 1.4, end_seconds: 1.7 },
  { word: 'captions', start_seconds: 1.7, end_seconds: 2.1 },
];

describe('M3.3 Karaoke Caption Timing & Grouping', () => {
  it('breaks lines early at terminal sentence punctuation and caps maxWordsPerLine', () => {
    const lines = groupWordsIntoLines(SAMPLE_WORDS, 6);
    expect(lines.length).toBe(2);
    expect(lines[0].words.map((w) => w.word)).toEqual([
      'Audio',
      'drives',
      'the',
      'visual',
      'timeline.',
    ]);
    expect(lines[1].words.map((w) => w.word)).toEqual(['Clean', 'captions']);
  });

  it('tracks exact spoken word index per video frame while accounting for 0.2s pre-padding', () => {
    // frame 1 @ 30fps => 0.033s total => speechTime = -0.167s -> hidden before speech starts
    expect(resolveActiveCaptionState(SAMPLE_WORDS, 1, 30, 0.2, 6)).toBeNull();

    // frame 24 @ 30fps => 0.8s total => speechTime = 0.6s -> active word "the" [0.5 .. 0.7]
    const state = resolveActiveCaptionState(SAMPLE_WORDS, 24, 30, 0.2, 6);
    expect(state).not.toBeNull();
    expect(state?.speechTimeSeconds).toBe(0.6);
    expect(state?.activeWordIndex).toBe(2);
    expect(state?.lineWords[2].word).toBe('the');
  });
});

describe('M3.3 KaraokeCaptions & SlidePresentation Integration', () => {
  it('renders highlighted active word pill, spoken words, and upcoming muted words', () => {
    const html = renderToStaticMarkup(
      <KaraokeCaptions
        words={SAMPLE_WORDS}
        captionStyle="karaoke_pill"
        maxWordsPerLine={6}
        highlightColor="#38bdf8"
      />
    );

    expect(html).toContain('data-testid="karaoke-captions-overlay"');
    expect(html).toContain('data-caption-style="karaoke_pill"');
    expect(html).toContain('data-active-word="the"');
    expect(html).toContain('data-word-state="spoken"');
    expect(html).toContain('data-word-state="active"');
    expect(html).toContain('data-word-state="upcoming"');
    expect(html).toContain('timeline.');
    expect(html).not.toContain('captions</span>'); // Line 2 cue not yet active at frame 24
  });

  it('mounts animated subtitles inside SlidePresentation only when enabled', () => {
    const enabledHtml = renderToStaticMarkup(
      <SlidePresentation
        project_title="Karaoke Subtitle Presentation"
        slides={[
          {
            slide_index: 1,
            layout: 'title_intro',
            heading: 'Whisper Captions',
            voiceover_audio_url: '/audio_temp/j_sub/slide_1.mp3',
            voiceover_duration_seconds: 3.5,
            word_timestamps: SAMPLE_WORDS,
          },
        ]}
        subtitles={{
          enabled: true,
          style: 'bold_highlight',
          max_words_per_line: 6,
          highlight_color: '#38bdf8',
        }}
      />
    );
    expect(enabledHtml).toContain('data-testid="karaoke-captions-overlay"');
    expect(enabledHtml).toContain('data-caption-style="bold_highlight"');

    const disabledHtml = renderToStaticMarkup(
      <SlidePresentation
        project_title="No Subtitles Deck"
        slides={[
          {
            slide_index: 1,
            layout: 'title_intro',
            heading: 'Clean Slide',
            voiceover_audio_url: '/audio_temp/j_nosub/slide_1.mp3',
            voiceover_duration_seconds: 3.5,
            word_timestamps: SAMPLE_WORDS,
          },
        ]}
        subtitles={{ enabled: false }}
      />
    );
    expect(disabledHtml).not.toContain('data-testid="karaoke-captions-overlay"');
  });
});
