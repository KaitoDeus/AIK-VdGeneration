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
import {
  computeKenBurnsTransform,
  resolveAssetSrc,
  resolveTheme,
} from '../utils/timing';
import {
  resolveSlidePalette,
  resolveVisualVariant,
} from '../utils/slidePalettes';
import { KineticBackdropScene } from './SlideVisuals';

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
  const hasBackgroundImage = Boolean(slide.background_image_url);
  const palette = resolveSlidePalette(
    slide.slide_index,
    slide.layout,
    resolvedTheme,
    hasBackgroundImage
  );
  const visualVariant = resolveVisualVariant(slide);

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

  // Alternating Ken Burns pan + zoom for stock background imagery (M2.3)
  const kenBurns = computeKenBurnsTransform(frame, durationInFrames, slide.slide_index);

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
      palette,
      visualVariant,
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
      data-palette-id={palette.id}
      data-visual-variant={visualVariant}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: palette.backgroundColor,
        backgroundImage: palette.backgroundImage,
        color: palette.textColor,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '84px 96px 92px 96px',
        fontFamily: resolvedTheme.fontFamily,
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Procedural Animated Geometric Backdrop */}
      <KineticBackdropScene
        frame={frame}
        palette={palette}
        slideIndex={slide.slide_index}
        variant={visualVariant}
      />

      {/* Optional Background Image with Ken Burns pan/zoom effect & dark scrim */}
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
            src={resolveAssetSrc(slide.background_image_url)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: kenBurns.transformCss,
              opacity: 0.28,
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.45)',
            }}
          />
        </div>
      )}

      {/* Top Decorative Dual-Tone Gradient Accent Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '8px',
          background: `linear-gradient(90deg, ${palette.primaryColor} 0%, ${palette.secondaryColor} 100%)`,
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
          color: palette.chromeMutedColor,
          letterSpacing: '1px',
          zIndex: 2,
        }}
      >
        <span>{projectTitle}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 700,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              color: palette.primaryColor,
              padding: '4px 12px',
              backgroundColor: palette.accentSoft,
              border: `1px solid ${palette.surfaceBorder}`,
            }}
          >
            {palette.name}
          </span>
          <span>
            {String(slide.slide_index).padStart(2, '0')} /{' '}
            {String(Math.max(totalSlides, slide.slide_index)).padStart(2, '0')}
          </span>
        </div>
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
          backgroundColor: palette.isLight
            ? 'rgba(15, 23, 42, 0.12)'
            : 'rgba(255, 255, 255, 0.08)',
          zIndex: 2,
        }}
      >
        <div
          data-testid="slide-progress-bar"
          style={{
            width: `${progressPercent}%`,
            height: '100%',
            backgroundColor: palette.primaryColor,
          }}
        />
      </div>
    </div>
  );
};
