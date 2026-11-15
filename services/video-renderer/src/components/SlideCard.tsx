/**
 * Master Slide Container Component (Milestone M1.4).
 * Wraps the 5 layout templates with spring entrance/exit transitions,
 * background imagery (Ken Burns effect) with graceful CSS gradient fallback,
 * and an animated slide timeline progress bar.
 */

import React from 'react';
import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  BulletListLayout,
  ConclusionCtaLayout,
  QuoteHighlightLayout,
  SplitCardLayout,
  TitleIntroLayout,
} from '../templates/SlideLayouts';
import { SlideData, ThemeConfig } from '../types';
import { resolveTheme } from '../utils/timing';

export interface SlideCardProps {
  slide: SlideData;
  theme?: ThemeConfig;
  projectTitle?: string;
  totalSlides?: number;
}

export const SlideCard: React.FC<SlideCardProps> = ({
  slide,
  theme,
  projectTitle = 'AIK-VdGeneration',
  totalSlides = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const resolvedTheme = resolveTheme(theme);

  // Smooth spring entrance
  const entrance = spring({
    frame,
    fps,
    config: {
      damping: 14,
      mass: 0.8,
      stiffness: 100,
    },
  });

  // Smooth fade-in (first 12 frames) and cross-fade exit (last 12 frames)
  const enterOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exitStart = Math.max(15, durationInFrames - 12);
  const exitOpacity = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const combinedOpacity = Math.min(enterOpacity, exitOpacity);

  const translateY = interpolate(entrance, [0, 1], [36, 0]);

  // Subtle Ken Burns zoom for background image (1.0 -> 1.06)
  const bgScale = interpolate(frame, [0, Math.max(1, durationInFrames)], [1, 1.06], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Slide progress percentage (0% -> 100%)
  const progressPercent = interpolate(
    frame,
    [0, Math.max(1, durationInFrames - 1)],
    [0, 100],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  const renderLayout = () => {
    const layoutProps = {
      slide,
      theme: resolvedTheme,
      frame,
      fps,
    };

    switch (slide.layout) {
      case 'title_intro':
        return <TitleIntroLayout {...layoutProps} />;
      case 'split_card':
        return <SplitCardLayout {...layoutProps} />;
      case 'quote_highlight':
        return <QuoteHighlightLayout {...layoutProps} />;
      case 'conclusion_cta':
        return <ConclusionCtaLayout {...layoutProps} />;
      case 'bullet_list':
      default:
        return <BulletListLayout {...layoutProps} />;
    }
  };

  return (
    <div
      data-testid={`slide-card-${slide.slide_index}`}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: resolvedTheme.backgroundColor,
        backgroundImage: `radial-gradient(circle at 85% 15%, rgba(56, 189, 248, 0.16) 0%, transparent 45%), radial-gradient(circle at 15% 85%, rgba(99, 102, 241, 0.14) 0%, transparent 45%)`,
        color: resolvedTheme.textColor,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '80px 96px',
        fontFamily: resolvedTheme.fontFamily,
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Optional Background Image with Ken Burns effect & dark overlay */}
      {slide.background_image_url && (
        <div
          data-testid="slide-background-image"
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            zIndex: 0,
          }}
        >
          <Img
            src={slide.background_image_url}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${bgScale})`,
              opacity: 0.22,
            }}
          />
        </div>
      )}

      {/* Top Decorative Accent Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '8px',
          backgroundColor: resolvedTheme.primaryColor,
          zIndex: 2,
        }}
      />

      {/* Top Header Chrome (Project Title & Slide Counter) */}
      <div
        style={{
          position: 'absolute',
          top: '36px',
          left: '96px',
          right: '96px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '20px',
          fontWeight: 600,
          color: 'rgba(248, 250, 252, 0.6)',
          letterSpacing: '1px',
          zIndex: 2,
        }}
      >
        <span>{projectTitle}</span>
        <span>
          {String(slide.slide_index).padStart(2, '0')} /{' '}
          {String(Math.max(totalSlides, slide.slide_index)).padStart(2, '0')}
        </span>
      </div>

      {/* Main Animated Slide Content */}
      <div
        style={{
          opacity: combinedOpacity,
          transform: `translateY(${translateY}px)`,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1,
        }}
      >
        {renderLayout()}
      </div>

      {/* Bottom Slide Timeline Progress Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '6px',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          zIndex: 2,
        }}
      >
        <div
          data-testid="slide-progress-bar"
          style={{
            width: `${progressPercent}%`,
            height: '100%',
            backgroundColor: resolvedTheme.primaryColor,
          }}
        />
      </div>
    </div>
  );
};
