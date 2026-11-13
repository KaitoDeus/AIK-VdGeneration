import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { SlideData } from '../types';

interface SlideCardProps {
  slide: SlideData;
  theme?: {
    backgroundColor?: string;
    primaryColor?: string;
    textColor?: string;
  };
}

export const SlideCard: React.FC<SlideCardProps> = ({ slide, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Smooth entrance spring
  const entrance = spring({
    frame,
    fps,
    config: {
      damping: 14,
      mass: 0.8,
      stiffness: 100,
    },
  });

  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const translateY = interpolate(entrance, [0, 1], [40, 0]);

  const bg = theme?.backgroundColor || '#0f172a';
  const primary = theme?.primaryColor || '#38bdf8';
  const text = theme?.textColor || '#f8fafc';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: bg,
        color: text,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '80px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* Decorative accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '8px',
          backgroundColor: primary,
        }}
      />

      {/* Main Container with spring animation */}
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          maxWidth: '1400px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: slide.layout === 'title_intro' ? 'center' : 'flex-start',
          textAlign: slide.layout === 'title_intro' ? 'center' : 'left',
        }}
      >
        <span
          style={{
            fontSize: '24px',
            textTransform: 'uppercase',
            letterSpacing: '3px',
            color: primary,
            marginBottom: '16px',
            fontWeight: 700,
          }}
        >
          Slide {slide.slide_index}
        </span>

        <h1
          style={{
            fontSize: slide.layout === 'title_intro' ? '72px' : '56px',
            fontWeight: 800,
            lineHeight: 1.2,
            marginBottom: '40px',
            color: text,
          }}
        >
          {slide.heading}
        </h1>

        {slide.bullet_points && slide.bullet_points.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              width: '100%',
            }}
          >
            {slide.bullet_points.map((point, index) => {
              const itemDelay = 10 + index * 8;
              const itemProgress = spring({
                frame: frame - itemDelay,
                fps,
                config: { damping: 15 },
              });
              const itemOpacity = interpolate(frame - itemDelay, [0, 10], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });

              return (
                <div
                  key={index}
                  style={{
                    opacity: itemOpacity,
                    transform: `translateX(${interpolate(itemProgress, [0, 1], [-20, 0])}px)`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    padding: '24px 32px',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: primary,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: '32px', fontWeight: 500 }}>{point}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
