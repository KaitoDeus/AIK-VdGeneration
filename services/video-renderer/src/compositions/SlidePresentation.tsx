/**
 * Main Remotion Slide Presentation Composition (Milestone M1.4).
 * Sequences all slides dynamically based on audio duration + padding rules,
 * aligns per-slide voiceover tracks with PADDING_BEFORE_SEC offset,
 * and mixes optional background music (BGM).
 */

import React from 'react';
import { AbsoluteFill, Audio, Sequence, Series, useVideoConfig } from 'remotion';
import { KaraokeCaptions } from '../components/KaraokeCaptions';
import { SlideCard } from '../components/SlideCard';
import { VideoPresentationProps } from '../types';
import {
  buildSpeechWindows,
  computeDuckedBgmVolume,
} from '../utils/audioDucking';
import {
  DEFAULT_FPS,
  PADDING_BEFORE_SEC,
  resolveAssetSrc,
  resolveSlideDurationInFrames,
} from '../utils/timing';

export const SlidePresentation: React.FC<VideoPresentationProps> = ({
  project_title,
  slides,
  theme,
  bgm,
  subtitles,
}) => {
  const videoConfig = useVideoConfig();
  const fps = videoConfig?.fps || DEFAULT_FPS;
  const isPortrait = (videoConfig?.height || 1080) > (videoConfig?.width || 1920);
  const audioStartOffsetFrames = Math.round(PADDING_BEFORE_SEC * fps);
  const { windows: speechWindows, totalFrames } = buildSpeechWindows(slides, fps);

  const bgmVolumeProp = bgm?.ducking_enabled
    ? (frame: number) =>
        computeDuckedBgmVolume({
          frame,
          baseVolume: bgm.volume ?? 0.22,
          speechWindows,
          totalFrames,
          duckingEnabled: true,
          duckAttenuationDb: bgm.duck_attenuation_db,
          transitionSwellDb: bgm.transition_swell_db,
        })
    : (bgm?.volume ?? 0.15);

  return (
    <AbsoluteFill>
      {/* Optional Background Music Track with Automatic Speech Ducking (M3.2) */}
      {bgm?.enabled && bgm?.audio_url && (
        <Audio src={resolveAssetSrc(bgm.audio_url)} volume={bgmVolumeProp} loop />
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
                  <Audio src={resolveAssetSrc(slide.voiceover_audio_url)} />
                </Sequence>
              )}
              <SlideCard
                slide={slide}
                theme={theme}
                projectTitle={project_title}
                totalSlides={slides.length}
              />
              {subtitles?.enabled &&
                Array.isArray(slide.word_timestamps) &&
                slide.word_timestamps.length > 0 && (
                  <KaraokeCaptions
                    words={slide.word_timestamps}
                    captionStyle={subtitles.style}
                    maxWordsPerLine={subtitles.max_words_per_line ?? (isPortrait ? 4 : 6)}
                    highlightColor={subtitles.highlight_color}
                  />
                )}
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
