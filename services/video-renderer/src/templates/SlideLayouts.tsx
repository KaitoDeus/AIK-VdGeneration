/**
 * 5 Distinct Animated Slide Layout Templates for Remotion (Milestone M1.4):
 *  1. title_intro      - Centered hero opener with animated divider and pill highlights
 *  2. bullet_list      - Left-aligned header with numbered staggered glassmorphic cards
 *  3. split_card       - Asymmetric 2-column split panel (hero callout left, feature cards right)
 *  4. quote_highlight  - Editorial spotlight with oversized quote glyphs and context badges
 *  5. conclusion_cta   - High-impact summary grid with action checklist and CTA banner
 */

import React from 'react';
import { interpolate, spring } from 'remotion';
import { SlideData, ThemeConfig } from '../types';

export interface LayoutTemplateProps {
  slide: SlideData;
  theme: Required<ThemeConfig>;
  frame: number;
  fps: number;
}

/**
 * 1. Hero Title Intro Layout (`title_intro`)
 */
export const TitleIntroLayout: React.FC<LayoutTemplateProps> = ({
  slide,
  theme,
  frame,
  fps,
}) => {
  const badgeSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  const dividerWidth = interpolate(
    spring({ frame: frame - 6, fps, config: { damping: 16, stiffness: 90 } }),
    [0, 1],
    [0, 220]
  );

  const points = slide.bullet_points || [];

  return (
    <div
      data-layout="title_intro"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        maxWidth: '1440px',
        width: '100%',
      }}
    >
      <div
        style={{
          transform: `scale(${interpolate(badgeSpring, [0, 1], [0.85, 1])})`,
          padding: '10px 28px',
          borderRadius: '999px',
          backgroundColor: 'rgba(56, 189, 248, 0.14)',
          border: `1px solid ${theme.primaryColor}`,
          color: theme.primaryColor,
          fontSize: '22px',
          fontWeight: 700,
          letterSpacing: '3px',
          textTransform: 'uppercase',
          marginBottom: '28px',
        }}
      >
        Presentation Introduction • Slide {String(slide.slide_index).padStart(2, '0')}
      </div>

      <h1
        style={{
          fontSize: '76px',
          fontWeight: 800,
          lineHeight: 1.15,
          color: theme.textColor,
          margin: '0 0 28px 0',
          letterSpacing: '-1px',
        }}
      >
        {slide.heading}
      </h1>

      <div
        style={{
          width: `${dividerWidth}px`,
          height: '6px',
          borderRadius: '999px',
          backgroundColor: theme.primaryColor,
          marginBottom: '44px',
        }}
      />

      {points.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '20px',
            width: '100%',
          }}
        >
          {points.map((point, index) => {
            const delay = 12 + index * 8;
            const progress = spring({
              frame: frame - delay,
              fps,
              config: { damping: 14, stiffness: 100 },
            });
            const itemOpacity = interpolate(frame - delay, [0, 10], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            return (
              <div
                key={index}
                style={{
                  opacity: itemOpacity,
                  transform: `translateY(${interpolate(progress, [0, 1], [24, 0])}px)`,
                  padding: '20px 34px',
                  borderRadius: '18px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  fontSize: '30px',
                  fontWeight: 500,
                  color: theme.textColor,
                }}
              >
                {point}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * 2. Structured Bullet List Layout (`bullet_list`)
 */
export const BulletListLayout: React.FC<LayoutTemplateProps> = ({
  slide,
  theme,
  frame,
  fps,
}) => {
  const points = slide.bullet_points || [];

  return (
    <div
      data-layout="bullet_list"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        maxWidth: '1440px',
        width: '100%',
      }}
    >
      <span
        style={{
          fontSize: '22px',
          textTransform: 'uppercase',
          letterSpacing: '3px',
          color: theme.primaryColor,
          marginBottom: '14px',
          fontWeight: 700,
        }}
      >
        Key Insights • Slide {String(slide.slide_index).padStart(2, '0')}
      </span>

      <h1
        style={{
          fontSize: '58px',
          fontWeight: 800,
          lineHeight: 1.2,
          margin: '0 0 40px 0',
          color: theme.textColor,
        }}
      >
        {slide.heading}
      </h1>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '22px',
          width: '100%',
        }}
      >
        {points.map((point, index) => {
          const itemDelay = 10 + index * 8;
          const itemProgress = spring({
            frame: frame - itemDelay,
            fps,
            config: { damping: 15, stiffness: 105 },
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
                transform: `translateX(${interpolate(itemProgress, [0, 1], [-28, 0])}px)`,
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                padding: '24px 32px',
                borderRadius: '18px',
                borderLeft: `6px solid ${theme.primaryColor}`,
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(56, 189, 248, 0.16)',
                  color: theme.primaryColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {String(index + 1).padStart(2, '0')}
              </div>
              <span style={{ fontSize: '32px', fontWeight: 500, lineHeight: 1.35 }}>
                {point}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * 3. Two-Column Split Card Layout (`split_card`)
 */
export const SplitCardLayout: React.FC<LayoutTemplateProps> = ({
  slide,
  theme,
  frame,
  fps,
}) => {
  const leftSpring = spring({
    frame: frame - 4,
    fps,
    config: { damping: 14, stiffness: 95 },
  });

  const points = slide.bullet_points || [];

  return (
    <div
      data-layout="split_card"
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: '48px',
        maxWidth: '1520px',
        width: '100%',
      }}
    >
      {/* Left Hero Callout Panel */}
      <div
        style={{
          flex: '0 0 44%',
          transform: `translateX(${interpolate(leftSpring, [0, 1], [-30, 0])}px)`,
          backgroundColor: 'rgba(56, 189, 248, 0.09)',
          border: `1px solid ${theme.primaryColor}`,
          borderRadius: '28px',
          padding: '48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <span
            style={{
              display: 'inline-block',
              padding: '8px 18px',
              borderRadius: '8px',
              backgroundColor: theme.primaryColor,
              color: '#0f172a',
              fontSize: '18px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '2px',
              marginBottom: '24px',
            }}
          >
            Deep Dive • Slide {String(slide.slide_index).padStart(2, '0')}
          </span>
          <h1
            style={{
              fontSize: '52px',
              fontWeight: 800,
              lineHeight: 1.2,
              color: theme.textColor,
              margin: 0,
            }}
          >
            {slide.heading}
          </h1>
        </div>

        <div
          style={{
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.15)',
            fontSize: '22px',
            color: 'rgba(248, 250, 252, 0.78)',
            lineHeight: 1.5,
          }}
        >
          Core comparative breakdown & architectural highlights
        </div>
      </div>

      {/* Right Stacked Feature Cards */}
      <div
        style={{
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '20px',
        }}
      >
        {points.map((point, index) => {
          const delay = 10 + index * 9;
          const cardSpring = spring({
            frame: frame - delay,
            fps,
            config: { damping: 14, stiffness: 105 },
          });
          const cardOpacity = interpolate(frame - delay, [0, 10], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          return (
            <div
              key={index}
              style={{
                opacity: cardOpacity,
                transform: `translateX(${interpolate(cardSpring, [0, 1], [32, 0])}px)`,
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '20px',
                padding: '28px 32px',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
              }}
            >
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '4px',
                  backgroundColor: theme.primaryColor,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: '30px', fontWeight: 600, color: theme.textColor }}>
                {point}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * 4. Editorial Quote / Spotlight Layout (`quote_highlight`)
 */
export const QuoteHighlightLayout: React.FC<LayoutTemplateProps> = ({
  slide,
  theme,
  frame,
  fps,
}) => {
  const quoteScale = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 100 },
  });

  const points = slide.bullet_points || [];

  return (
    <div
      data-layout="quote_highlight"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        maxWidth: '1380px',
        width: '100%',
        padding: '56px 64px',
        borderRadius: '32px',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        position: 'relative',
      }}
    >
      <div
        style={{
          transform: `scale(${interpolate(quoteScale, [0, 1], [0.5, 1])})`,
          fontSize: '110px',
          lineHeight: 0.7,
          color: theme.primaryColor,
          fontWeight: 900,
          marginBottom: '20px',
          opacity: 0.85,
        }}
      >
        “
      </div>

      <h1
        style={{
          fontSize: '58px',
          fontWeight: 800,
          fontStyle: 'italic',
          lineHeight: 1.28,
          color: theme.textColor,
          margin: '0 0 36px 0',
        }}
      >
        {slide.heading}
      </h1>

      {points.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '18px',
            marginTop: '12px',
          }}
        >
          {points.map((point, index) => {
            const delay = 12 + index * 7;
            const pillOpacity = interpolate(frame - delay, [0, 10], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            return (
              <div
                key={index}
                style={{
                  opacity: pillOpacity,
                  padding: '14px 28px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(56, 189, 248, 0.14)',
                  border: `1px solid ${theme.primaryColor}`,
                  color: theme.textColor,
                  fontSize: '26px',
                  fontWeight: 500,
                }}
              >
                {point}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * 5. Conclusion & Call-To-Action Layout (`conclusion_cta`)
 */
export const ConclusionCtaLayout: React.FC<LayoutTemplateProps> = ({
  slide,
  theme,
  frame,
  fps,
}) => {
  const points = slide.bullet_points || [];
  const ctaSpring = spring({
    frame: frame - 18,
    fps,
    config: { damping: 12, stiffness: 110 },
  });

  return (
    <div
      data-layout="conclusion_cta"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: '1440px',
        width: '100%',
      }}
    >
      <div
        style={{
          padding: '10px 26px',
          borderRadius: '999px',
          backgroundColor: theme.primaryColor,
          color: '#0f172a',
          fontSize: '20px',
          fontWeight: 800,
          letterSpacing: '2.5px',
          textTransform: 'uppercase',
          marginBottom: '24px',
        }}
      >
        Summary & Action Plan • Slide {String(slide.slide_index).padStart(2, '0')}
      </div>

      <h1
        style={{
          fontSize: '64px',
          fontWeight: 800,
          textAlign: 'center',
          lineHeight: 1.2,
          color: theme.textColor,
          margin: '0 0 40px 0',
        }}
      >
        {slide.heading}
      </h1>

      {points.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: points.length > 1 ? 'repeat(2, 1fr)' : '1fr',
            gap: '24px',
            width: '100%',
            marginBottom: '36px',
          }}
        >
          {points.map((point, index) => {
            const delay = 8 + index * 7;
            const itemSpring = spring({
              frame: frame - delay,
              fps,
              config: { damping: 14, stiffness: 100 },
            });
            const itemOpacity = interpolate(frame - delay, [0, 10], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            return (
              <div
                key={index}
                style={{
                  opacity: itemOpacity,
                  transform: `translateY(${interpolate(itemSpring, [0, 1], [24, 0])}px)`,
                  padding: '28px 32px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: theme.primaryColor,
                    color: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '22px',
                    fontWeight: 900,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </div>
                <span style={{ fontSize: '28px', fontWeight: 600, color: theme.textColor }}>
                  {point}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div
        style={{
          transform: `scale(${interpolate(ctaSpring, [0, 1], [0.92, 1])})`,
          padding: '18px 42px',
          borderRadius: '16px',
          border: `2px solid ${theme.primaryColor}`,
          backgroundColor: 'rgba(56, 189, 248, 0.12)',
          color: theme.primaryColor,
          fontSize: '24px',
          fontWeight: 700,
          letterSpacing: '1px',
        }}
      >
        Thank You for Watching • Powered by AIK-VdGeneration
      </div>
    </div>
  );
};
