import React from 'react';
import { Audio, Series } from 'remotion';
import { SlideCard } from '../components/SlideCard';
import { VideoPresentationProps } from '../types';

export const SlidePresentation: React.FC<VideoPresentationProps> = ({ slides, theme }) => {
  const fps = 30;

  return (
    <Series>
      {slides.map((slide, index) => {
        // Compute frames needed: audio duration + 0.6s breathing room
        const durationInFrames = Math.max(
          90,
          Math.ceil((slide.voiceover_duration_seconds + 0.6) * fps)
        );

        return (
          <Series.Sequence key={index} durationInFrames={durationInFrames}>
            {slide.voiceover_audio_url && (
              <Audio src={slide.voiceover_audio_url} />
            )}
            <SlideCard slide={slide} theme={theme} />
          </Series.Sequence>
        );
      })}
    </Series>
  );
};
