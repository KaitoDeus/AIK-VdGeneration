/**
 * Automated Verification & Test Suite for Milestone M3.2:
 * Audio Ducking Envelope Math (-18dB Speech Ducking, +3dB Transition Swell) & Remotion BGM Loop.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('remotion', async () => {
  const ReactMod = await import('react');
  return {
    useCurrentFrame: () => 20,
    useVideoConfig: () => ({
      fps: 30,
      durationInFrames: 330,
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
    Audio: ({
      src,
      volume,
      loop,
    }: {
      src: string;
      volume?: number | ((f: number) => number);
      loop?: boolean;
    }) => {
      const evaluatedVol = typeof volume === 'function' ? volume(30) : volume;
      return ReactMod.createElement('audio', {
        'data-remotion': 'Audio',
        src,
        'data-volume': evaluatedVol,
        'data-loop': loop ? 'true' : undefined,
      });
    },
    Img: ({ src, style }: { src: string; style?: React.CSSProperties }) =>
      ReactMod.createElement('img', { src, style }),
    staticFile: (p: string) => `/${p.replace(/^\/+/, '')}`,
  };
});

import { SlidePresentation } from '../src/compositions/SlidePresentation';
import { SlideData } from '../src/types';
import {
  buildSpeechWindows,
  computeDuckedBgmVolume,
  dbToGain,
} from '../src/utils/audioDucking';

describe('M3.2 Audio Ducking Mathematics (-18dB Speech / +3dB Swell)', () => {
  const sampleSlides: SlideData[] = [
    {
      slide_index: 1,
      layout: 'title_intro',
      heading: 'Slide 1',
      voiceover_audio_url: '/audio_temp/j1/slide_1.mp3',
      voiceover_duration_seconds: 4.0, // (0.2 + 4.0 + 0.5) * 30 = 141 frames; speech [6..126]
    },
    {
      slide_index: 2,
      layout: 'bullet_list',
      heading: 'Slide 2',
      voiceover_audio_url: '/audio_temp/j1/slide_2.mp3',
      voiceover_duration_seconds: 5.0, // offset 141 => speech [147..297]
    },
  ];

  it('extracts accurate speech windows separated by transition gaps', () => {
    const { windows, totalFrames } = buildSpeechWindows(sampleSlides, 30);
    expect(totalFrames).toBe(141 + 171); // 141 + Math.ceil(5.7 * 30)
    expect(windows).toEqual([
      { slideIndex: 1, startFrame: 6, endFrame: 126 },
      { slideIndex: 2, startFrame: 147, endFrame: 297 },
    ]);
  });

  it('drops BGM volume by 18dB during speech and swells +3dB during slide transitions', () => {
    const { windows, totalFrames } = buildSpeechWindows(sampleSlides, 30);
    const baseVolume = 0.22;

    const expectedSpeechGain = Number((baseVolume * dbToGain(-18)).toFixed(4));
    const expectedTransitionGain = Number((baseVolume * dbToGain(3)).toFixed(4));

    // Inside slide 1 narration (frame 60) -> ducked -18dB
    const duringSpeech = computeDuckedBgmVolume({
      frame: 60,
      baseVolume,
      speechWindows: windows,
      totalFrames,
      duckingEnabled: true,
    });
    expect(duringSpeech).toBeCloseTo(expectedSpeechGain, 3);
    expect(duringSpeech).toBeLessThan(0.05);

    // Mid-transition gap between slide 1 speech (end 126) and slide 2 speech (start 147): frame 136
    const duringTransition = computeDuckedBgmVolume({
      frame: 136,
      baseVolume,
      speechWindows: windows,
      totalFrames,
      duckingEnabled: true,
    });
    expect(duringTransition).toBeCloseTo(expectedTransitionGain, 3);
    expect(duringTransition).toBeGreaterThan(duringSpeech * 4);

    // Smooth tail fade out near final frame
    const nearEnd = computeDuckedBgmVolume({
      frame: totalFrames - 2,
      baseVolume,
      speechWindows: windows,
      totalFrames,
      duckingEnabled: true,
    });
    expect(nearEnd).toBeLessThan(duringTransition);
  });

  it('maintains flat base volume when duckingEnabled is false', () => {
    const { windows, totalFrames } = buildSpeechWindows(sampleSlides, 30);
    const flat = computeDuckedBgmVolume({
      frame: 60,
      baseVolume: 0.25,
      speechWindows: windows,
      totalFrames,
      duckingEnabled: false,
    });
    expect(flat).toBe(0.25);
  });
});

describe('M3.2 SlidePresentation Ducked BGM Track Rendering', () => {
  it('mounts looping BGM Audio track with evaluated speech ducking gain', () => {
    const html = renderToStaticMarkup(
      <SlidePresentation
        project_title="BGM Ducking Deck"
        slides={[
          {
            slide_index: 1,
            layout: 'title_intro',
            heading: 'Intro',
            voiceover_audio_url: '/audio_temp/j_bgm/slide_1.mp3',
            voiceover_duration_seconds: 4.0,
          },
        ]}
        bgm={{
          enabled: true,
          mood: 'tech',
          track_id: 'tech-circuit',
          audio_url: '/music/j_bgm_tech-circuit.wav',
          volume: 0.22,
          ducking_enabled: true,
        }}
      />
    );

    expect(html).toContain('src="/music/j_bgm_tech-circuit.wav"');
    expect(html).toContain('data-loop="true"');
    // At mocked frame 30 (inside slide 1 speech window [6..126]), gain is ducked (-18dB => ~0.0277)
    expect(html).toContain('data-volume="0.0277"');
  });
});
