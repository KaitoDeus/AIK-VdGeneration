import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { SlidePresentation } from './compositions/SlidePresentation';
import { VideoPresentationProps } from './types';
import {
  calculatePresentationMetadata,
  DEFAULT_FPS,
  DEFAULT_HEIGHT,
  DEFAULT_WIDTH,
} from './utils/timing';

/**
 * Default 5-slide showcase props covering all 5 layout templates for local Studio preview.
 */
export const defaultProps: VideoPresentationProps = {
  project_title: 'AIK-VdGeneration Presentation Demo',
  fps: DEFAULT_FPS,
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
  theme: {
    backgroundColor: '#0f172a',
    primaryColor: '#38bdf8',
    textColor: '#f8fafc',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  slides: [
    {
      slide_index: 1,
      layout: 'title_intro',
      heading: 'Welcome to AIK-VdGeneration',
      bullet_points: [
        'Automated slide video generation from text prompts',
        'Synchronized bilingual English and Vietnamese voiceovers',
      ],
      voiceover_duration_seconds: 4.5,
    },
    {
      slide_index: 2,
      layout: 'bullet_list',
      heading: 'Remotion Engine & Queue System',
      bullet_points: [
        'Timeline duration dynamically driven by speech length',
        'Fluid spring animations with declarative React styling',
        'Scalable cloud rendering via serverless workers',
      ],
      voiceover_duration_seconds: 6.0,
    },
    {
      slide_index: 3,
      layout: 'split_card',
      heading: 'Bilingual Voiceover Architecture',
      bullet_points: [
        'Edge-TTS neural voices for instant zero-cost iteration',
        'ElevenLabs Multilingual v2 for studio emotional fidelity',
        'Exact frame calculation via mutagen MP3 header inspection',
      ],
      voiceover_duration_seconds: 5.5,
    },
    {
      slide_index: 4,
      layout: 'quote_highlight',
      heading: 'Audio drives the timeline — video frame duration is never hardcoded.',
      bullet_points: ['Audio-First Synchronicity', 'Strict JSON Contracts'],
      voiceover_duration_seconds: 4.8,
    },
    {
      slide_index: 5,
      layout: 'conclusion_cta',
      heading: 'Ready to Generate Your First Presentation Video',
      bullet_points: [
        'Submit a topic prompt via API or Web Studio',
        'Review structured slides and bilingual audio',
        'Export crisp 1080p MP4 at 30 FPS',
        'Scale effortlessly to cloud workers',
      ],
      voiceover_duration_seconds: 5.2,
    },
  ],
  bgm: {
    enabled: false,
    audio_url: null,
    volume: 0.15,
  },
};

export const RemotionRoot: React.FC = () => {
  const initialMeta = calculatePresentationMetadata(defaultProps);
  // Cast component for Remotion Composition generic compatibility
  const PresentationComponent =
    SlidePresentation as unknown as React.FC<Record<string, unknown>>;

  return React.createElement(Composition, {
    id: 'SlidePresentation',
    component: PresentationComponent,
    durationInFrames: initialMeta.durationInFrames,
    fps: initialMeta.fps,
    width: initialMeta.width,
    height: initialMeta.height,
    defaultProps: defaultProps as unknown as Record<string, unknown>,
    calculateMetadata: ({ props }: { props: Record<string, unknown> }) => {
      const typedProps = props as unknown as VideoPresentationProps;
      return calculatePresentationMetadata(typedProps);
    },
  });
};

registerRoot(RemotionRoot);
