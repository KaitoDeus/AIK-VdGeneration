/**
 * Main Remotion Slide Presentation Composition (Milestone M1.4).
 * Sequences all slides dynamically based on audio duration + padding rules,
 * aligns per-slide voiceover tracks with PADDING_BEFORE_SEC offset,
 * and mixes optional background music (BGM).
 */

import React from 'react';
import { AbsoluteFill, Audio, Sequence, Series, useVideoConfig } from 'remotion';
import { SlideCard } from '../components/SlideCard';
import { VideoPresentationProps } from '../types';
import {
  DEFAULT_FPS,
  PADDING_BEFORE_SEC,
  resolveSlideDurationInFrames,
} from '../utils/timing';

export const SlidePresentation: React.FC<VideoPresentationProps> = ({
  project_title,
  slides,
  theme,
  bgm,
}) => {
  const videoConfig = useVideoConfig();
  const fps = videoConfig?.fps || DEFAULT_FPS;
  const audioStartOffsetFrames = Math.round(PADDING_BEFORE_SEC * fps);

  return (
    <AbsoluteFill>
      {/* Optional Background Music Track */}
      {bgm?.enabled && bgm?.audio_url && (
        <Audio src={bgm.audio_url} volume={bgm.volume ?? 0.15} />
      )}

      <Series>
        {slides.map((slide, index) => {
          const durationInFrames = resolveSlideDurationInFrames(slide, fps);

          return (
            <Series.Sequence
              key={slide.slide_index || index}
              durationInFrames={durationInFrames}
            >
              {slide.voiceover_audio_url && (
                <Sequence from={audioStartOffsetFrames}>
                  <Audio src={slide.voiceover_audio_url} />
                </Sequence>
              )}
              <SlideCard
                slide={slide}
                theme={theme}
                projectTitle={project_title}
                totalSlides={slides.length}
              />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
