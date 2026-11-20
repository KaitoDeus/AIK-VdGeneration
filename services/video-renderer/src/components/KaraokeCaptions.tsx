/**
 * Dynamic Karaoke-Style Animated Subtitle Overlay Component (Milestone M3.3).
 * Highlights each spoken word in real time based on OpenAI Whisper / forced-alignment
 * word timestamps inside Remotion compositions.
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { CaptionStyle, WordTimestamp } from '../types';
import { resolveActiveCaptionState } from '../utils/captions';
import { DEFAULT_FPS, PADDING_BEFORE_SEC } from '../utils/timing';

export interface KaraokeCaptionsProps {
  words: WordTimestamp[];
  captionStyle?: CaptionStyle;
  maxWordsPerLine?: number;
  highlightColor?: string;
}

export const KaraokeCaptions: React.FC<KaraokeCaptionsProps> = ({
  words,
  captionStyle = 'karaoke_pill',
  maxWordsPerLine = 6,
  highlightColor = '#38bdf8',
}) => {
  const frame = useCurrentFrame();
  const videoConfig = useVideoConfig();
  const fps = videoConfig?.fps || DEFAULT_FPS;
  const isPortrait = (videoConfig?.height || 1080) > (videoConfig?.width || 1920);

  const active = resolveActiveCaptionState(
    words,
    frame,
    fps,
    PADDING_BEFORE_SEC,
    maxWordsPerLine
  );

  if (!active || active.lineWords.length === 0) {
    return null;
  }

  const activeWord = active.lineWords[active.activeWordIndex]?.word || '';
  const containerBg =
    captionStyle === 'minimal_line'
      ? 'rgba(10, 10, 10, 0.72)'
      : 'rgba(15, 23, 42, 0.88)';

  return (
    <div
      data-testid="karaoke-captions-overlay"
      data-caption-style={captionStyle}
      data-orientation={isPortrait ? 'portrait' : 'landscape'}
      data-active-word={activeWord}
      style={{
        position: 'absolute',
        left: isPortrait ? '44px' : '96px',
        right: isPortrait ? '44px' : '96px',
        bottom: isPortrait ? '144px' : '54px',
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 4,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: isPortrait ? '10px' : '12px',
          maxWidth: isPortrait ? '960px' : '1400px',
          backgroundColor: containerBg,
          border: '1px solid rgba(255, 255, 255, 0.16)',
          padding: captionStyle === 'minimal_line' ? '12px 24px' : isPortrait ? '18px 26px' : '16px 30px',
        }}
      >
        {active.lineWords.map((item, idx) => {
          const isCurrent = idx === active.activeWordIndex;
          const isSpoken = idx < active.activeWordIndex;

          const color = isCurrent
            ? captionStyle === 'karaoke_pill'
              ? '#0f172a'
              : highlightColor
            : isSpoken
            ? '#f8fafc'
            : 'rgba(248, 250, 252, 0.45)';

          const bg =
            isCurrent && captionStyle === 'karaoke_pill'
              ? highlightColor
              : 'transparent';

          return (
            <span
              key={`${idx}-${item.start_seconds}`}
              data-word-state={isCurrent ? 'active' : isSpoken ? 'spoken' : 'upcoming'}
              style={{
                fontSize:
                  captionStyle === 'bold_highlight'
                    ? isPortrait
                      ? '42px'
                      : '36px'
                    : isPortrait
                    ? '36px'
                    : '32px',
                fontWeight: isCurrent ? 700 : 500,
                lineHeight: 1.25,
                color,
                backgroundColor: bg,
                padding: captionStyle === 'karaoke_pill' ? '4px 10px' : '2px 4px',
                transform: isCurrent ? 'scale(1.06)' : 'scale(1)',
                transition: 'transform 80ms ease-out',
                display: 'inline-block',
              }}
            >
              {item.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
