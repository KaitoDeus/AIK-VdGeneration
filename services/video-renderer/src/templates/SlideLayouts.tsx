/**
 * Theme-Differentiated Slide Layout Templates for Remotion:
 * Renders 5 canonical SlideLayout structures adapted dynamically across 3 distinct
 * visual identities (`modern_tech`, `corporate`, `minimal`) with colorful cards,
 * expressive editorial typography, and non-repetitive prose/block formatting.
 */

import React from 'react';
import { interpolate, spring } from 'remotion';
import {
  AnimatedMetricBarsSvg,
  EditorialRadarHaloSvg,
  KnowledgeGraphSvg,
  MilestoneRoadmapSvg,
  OrbitalHeroSvg,
  ProcessFlowBeamSvg,
  StackedLayersSvg,
} from '../components/SlideVisuals';
import { SlideData, ThemeConfig } from '../types';
import {
  ContextSceneCategory,
  SlidePalette,
  ThemeVisualStyle,
  VisualVariant,
  resolveContextSceneCategory,
  resolveSlidePalette,
  resolveThemeVisualStyle,
  resolveVisualVariant,
} from '../utils/slidePalettes';

export interface LayoutTemplateProps {
  slide: SlideData;
  theme: Required<ThemeConfig>;
  frame: number;
  fps: number;
  palette?: SlidePalette;
  visualVariant?: VisualVariant;
  themeStyle?: ThemeVisualStyle;
  isPortrait?: boolean;
  contextCategory?: ContextSceneCategory;
}

function getResolvedContext(
  slide: SlideData,
  theme: Required<ThemeConfig>,
  palette?: SlidePalette,
  visualVariant?: VisualVariant,
  themeStyle?: ThemeVisualStyle
): { palette: SlidePalette; variant: VisualVariant; style: ThemeVisualStyle } {
  return {
    palette:
      palette ??
      resolveSlidePalette(
        slide.slide_index,
        slide.layout,
        theme,
        Boolean(slide.background_image_url)
      ),
    variant: visualVariant ?? resolveVisualVariant(slide),
    style: themeStyle ?? resolveThemeVisualStyle(theme),
  };
}

function computeStaggeredSpring(
  frame: number,
  fps: number,
  index: number,
  baseDelay: number = 6,
  stepDelay: number = 5
): { opacity: number; translateY: number } {
  const anim = spring({
    frame: Math.max(0, frame - (baseDelay + index * stepDelay)),
    fps,
    config: { damping: 14, stiffness: 105 },
  });
  return {
    opacity: interpolate(anim, [0, 1], [0, 1]),
    translateY: interpolate(anim, [0, 1], [22, 0]),
  };
}

/**
 * 1. Hero Title Intro Layout (`title_intro`)
 * Bold expressive opener with cohesive narrative summary copy instead of numbered bullets.
 */
export const TitleIntroLayout: React.FC<LayoutTemplateProps> = ({
  slide,
  theme,
  frame,
  fps,
  palette: providedPalette,
  visualVariant: providedVariant,
  themeStyle: providedStyle,
  isPortrait = false,
  contextCategory,
}) => {
  const resolvedContextCategory =
    contextCategory ??
    resolveContextSceneCategory(`${slide.heading} ${(slide.bullet_points || []).join(' ')}`);
  const { palette, variant, style } = getResolvedContext(
    slide,
    theme,
    providedPalette,
    providedVariant,
    providedStyle
  );

  const dividerWidth = interpolate(
    spring({ frame: Math.max(0, frame - 6), fps, config: { damping: 16, stiffness: 90 } }),
    [0, 1],
    [0, style.preset === 'minimal' ? 120 : 220]
  );

  const points = (slide.bullet_points || []).slice(0, 4);
  const leadNarrative = points.join('  ·  ');
  const headingSize = isPortrait
    ? slide.heading.length > 48
      ? '48px'
      : '56px'
    : slide.heading.length > 52
    ? '58px'
    : '68px';

  return (
    <div
      data-layout="title_intro"
      data-visual-variant={variant}
      data-theme-preset={style.preset}
      style={{
        display: 'grid',
        gridTemplateColumns: isPortrait ? '1fr' : '1.35fr 0.95fr',
        gap: isPortrait ? '32px' : '52px',
        alignItems: 'center',
        maxWidth: '1640px',
        width: '100%',
      }}
    >
      {/* Left Typographic Hero Stage */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <h1
          style={{
            fontFamily: style.headingFont,
            fontSize: headingSize,
            fontWeight: style.headingWeight,
            lineHeight: 1.14,
            color: palette.textColor,
            margin: '0 0 24px 0',
            letterSpacing: style.preset === 'corporate' ? '-0.3px' : '-0.8px',
          }}
        >
          {slide.heading}
        </h1>

        <div
          style={{
            width: `${dividerWidth}px`,
            height: style.preset === 'minimal' ? '3px' : '5px',
            background:
              style.preset === 'modern_tech'
                ? `linear-gradient(90deg, ${palette.primaryColor} 0%, ${palette.secondaryColor} 100%)`
                : palette.primaryColor,
            marginBottom: '28px',
          }}
        />

        {leadNarrative && (
          <p
            style={{
              fontFamily: style.bodyFont,
              fontSize: isPortrait ? '26px' : '29px',
              fontWeight: style.preset === 'minimal' ? 400 : 500,
              lineHeight: 1.5,
              color: palette.mutedTextColor,
              margin: 0,
              maxWidth: '860px',
              paddingLeft: style.preset === 'corporate' ? '22px' : '0px',
              borderLeft:
                style.preset === 'corporate' ? `3px solid ${palette.primaryColor}` : 'none',
            }}
          >
            {leadNarrative}
          </p>
        )}
      </div>

      {/* Right Colorful Hero Illustration Panel */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isPortrait ? '20px' : '34px',
          backgroundColor: style.preset === 'minimal' ? 'transparent' : palette.surfaceAltBg,
          border:
            style.preset === 'minimal' ? 'none' : `1px solid ${palette.surfaceBorder}`,
          position: 'relative',
        }}
      >
        <div
          style={{
            transform: isPortrait ? 'scale(0.76)' : 'none',
            margin: isPortrait ? '-56px 0' : '0',
          }}
        >
          <OrbitalHeroSvg
            frame={frame}
            fps={fps}
            palette={palette}
            slideIndex={slide.slide_index}
            contextCategory={resolvedContextCategory}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * 2. Multi-Variant Content Showcase (`bullet_list`)
 * Renders colorful tiled pillars, connected visual flows, or bento highlights without numbered bullet lists.
 */
export const BulletListLayout: React.FC<LayoutTemplateProps> = ({
  slide,
  theme,
  frame,
  fps,
  palette: providedPalette,
  visualVariant: providedVariant,
  themeStyle: providedStyle,
  isPortrait = false,
}) => {
  const { palette, variant, style } = getResolvedContext(
    slide,
    theme,
    providedPalette,
    providedVariant,
    providedStyle
  );
  const points = (slide.bullet_points || []).slice(0, 5);
  const headingSize = slide.heading.length > 50 ? '48px' : '54px';

  // Variant A: Flowing Color Block Grid with Visual Flow Beam
  if (variant === 'process_pipeline') {
    const colCount = Math.max(2, Math.min(4, points.length || 2));
    return (
      <div
        data-layout="bullet_list"
        data-visual-variant="process_pipeline"
        data-theme-preset={style.preset}
        style={{
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '1640px',
          width: '100%',
          gap: '26px',
        }}
      >
        <div
          style={{
            borderBottom:
              style.preset === 'minimal' ? 'none' : `1px solid ${palette.surfaceBorder}`,
            paddingBottom: '12px',
          }}
        >
          <h2
            style={{
              fontFamily: style.headingFont,
              fontSize: headingSize,
              fontWeight: style.headingWeight,
              color: palette.textColor,
              margin: 0,
              lineHeight: 1.18,
            }}
          >
            {slide.heading}
          </h2>
        </div>

        <ProcessFlowBeamSvg frame={frame} palette={palette} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isPortrait
              ? '1fr'
              : `repeat(${colCount}, minmax(0, 1fr))`,
            gap: isPortrait ? '16px' : '24px',
          }}
        >
          {points.map((point, idx) => {
            const motion = computeStaggeredSpring(frame, fps, idx);
            const accent = idx % 2 === 0 ? palette.primaryColor : palette.secondaryColor;
            const isHeroTile = style.preset === 'modern_tech' && idx === 0;
            return (
              <div
                key={`pipe-step-${idx}`}
                style={{
                  opacity: motion.opacity,
                  transform: `translateY(${motion.translateY}px)`,
                  backgroundColor: isHeroTile
                    ? accent
                    : idx % 2 === 0
                    ? palette.surfaceAltBg
                    : palette.surfaceBg,
                  color: isHeroTile ? palette.badgeTextColor : palette.textColor,
                  border:
                    style.preset === 'minimal'
                      ? `1px solid ${palette.surfaceBorder}`
                      : `1px solid ${palette.surfaceBorder}`,
                  borderTop:
                    style.preset === 'minimal'
                      ? `1px solid ${palette.surfaceBorder}`
                      : `5px solid ${accent}`,
                  padding: isPortrait ? '22px 24px' : '28px 26px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  minHeight: isPortrait ? 'auto' : '200px',
                }}
              >
                <p
                  style={{
                    fontFamily: style.bodyFont,
                    fontSize: points.length >= 4 ? '24px' : '27px',
                    fontWeight: style.preset === 'minimal' ? 400 : 600,
                    color: isHeroTile ? palette.badgeTextColor : palette.textColor,
                    lineHeight: 1.45,
                    margin: 0,
                  }}
                >
                  {point}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Variant B: Hub-and-Spoke Visual Paired with Smooth Concept Statements
  if (variant === 'knowledge_graph') {
    return (
      <div
        data-layout="bullet_list"
        data-visual-variant="knowledge_graph"
        data-theme-preset={style.preset}
        style={{
          display: 'grid',
          gridTemplateColumns: isPortrait ? '1fr' : '0.92fr 1.25fr',
          gap: isPortrait ? '26px' : '48px',
          alignItems: 'center',
          maxWidth: '1640px',
          width: '100%',
        }}
      >
        <div
          style={{
            backgroundColor: style.preset === 'minimal' ? 'transparent' : palette.surfaceAltBg,
            border:
              style.preset === 'minimal' ? 'none' : `1px solid ${palette.surfaceBorder}`,
            padding: isPortrait ? '20px' : '30px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              transform: isPortrait ? 'scale(0.8)' : 'none',
              margin: isPortrait ? '-44px 0' : '0',
            }}
          >
            <KnowledgeGraphSvg
              frame={frame}
              fps={fps}
              palette={palette}
              slideIndex={slide.slide_index}
              itemCount={points.length || 3}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2
            style={{
              fontFamily: style.headingFont,
              fontSize: headingSize,
              fontWeight: style.headingWeight,
              color: palette.textColor,
              margin: 0,
              lineHeight: 1.18,
            }}
          >
            {slide.heading}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {points.map((point, idx) => {
              const motion = computeStaggeredSpring(frame, fps, idx);
              const accent = idx % 2 === 0 ? palette.primaryColor : palette.secondaryColor;
              return (
                <div
                  key={`graph-pt-${idx}`}
                  style={{
                    opacity: motion.opacity,
                    transform: `translateY(${motion.translateY}px)`,
                    padding: style.preset === 'minimal' ? '16px 22px' : '20px 26px',
                    backgroundColor: idx === 0 ? palette.surfaceAltBg : palette.surfaceBg,
                    border:
                      style.preset === 'minimal'
                        ? 'none'
                        : `1px solid ${palette.surfaceBorder}`,
                    borderLeft:
                      style.accentStripeWidth === '0px'
                        ? 'none'
                        : `${style.accentStripeWidth} solid ${accent}`,
                  }}
                >
                  <p
                    style={{
                      fontFamily: style.bodyFont,
                      fontSize: points.length >= 4 ? '24px' : '27px',
                      fontWeight: style.preset === 'minimal' ? 400 : 500,
                      color: palette.textColor,
                      lineHeight: 1.42,
                      margin: 0,
                    }}
                  >
                    {point}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Variant C: Expressive Color Bento Mosaic
  const leadPoint = points[0];
  const secondaryPoints = points.slice(1);

  return (
    <div
      data-layout="bullet_list"
      data-visual-variant="bento_mosaic"
      data-theme-preset={style.preset}
      style={{
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '1640px',
        width: '100%',
        gap: '26px',
      }}
    >
      <h2
        style={{
          fontFamily: style.headingFont,
          fontSize: headingSize,
          fontWeight: style.headingWeight,
          color: palette.textColor,
          margin: 0,
          lineHeight: 1.18,
        }}
      >
        {slide.heading}
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isPortrait
            ? '1fr'
            : secondaryPoints.length > 0
            ? '0.95fr 1.25fr'
            : '1fr',
          gap: isPortrait ? '18px' : '26px',
          alignItems: 'stretch',
        }}
      >
        {leadPoint && (
          <div
            style={{
              backgroundColor:
                style.preset === 'corporate' ? palette.surfaceAltBg : palette.primaryColor,
              color:
                style.preset === 'corporate' ? palette.textColor : palette.badgeTextColor,
              border:
                style.preset === 'corporate' ? `2px solid ${palette.primaryColor}` : 'none',
              padding: isPortrait ? '28px 30px' : '38px 36px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minHeight: isPortrait ? 'auto' : '300px',
            }}
          >
            <p
              style={{
                fontFamily: style.headingFont,
                fontSize: isPortrait ? '30px' : '36px',
                fontWeight: style.headingWeight,
                color:
                  style.preset === 'corporate' ? palette.textColor : palette.badgeTextColor,
                lineHeight: 1.32,
                margin: 0,
              }}
            >
              {leadPoint}
            </p>
          </div>
        )}

        {secondaryPoints.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isPortrait
                ? '1fr'
                : secondaryPoints.length >= 3
                ? 'repeat(2, minmax(0, 1fr))'
                : '1fr',
              gap: isPortrait ? '14px' : '20px',
            }}
          >
            {secondaryPoints.map((point, idx) => {
              const motion = computeStaggeredSpring(frame, fps, idx + 1);
              return (
                <div
                  key={`bento-pt-${idx}`}
                  style={{
                    opacity: motion.opacity,
                    transform: `translateY(${motion.translateY}px)`,
                    backgroundColor: idx % 2 === 0 ? palette.surfaceBg : palette.surfaceAltBg,
                    border:
                      style.preset === 'minimal'
                        ? 'none'
                        : `1px solid ${palette.surfaceBorder}`,
                    padding: '26px 28px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <p
                    style={{
                      fontFamily: style.bodyFont,
                      fontSize: secondaryPoints.length >= 3 ? '24px' : '27px',
                      fontWeight: style.preset === 'minimal' ? 400 : 500,
                      color: palette.textColor,
                      lineHeight: 1.42,
                      margin: 0,
                    }}
                  >
                    {point}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 3. Two-Column Editorial Split Layout (`split_card`)
 * Pairs flowing editorial paragraphs cleanly with animated visual diagrams.
 */
export const SplitCardLayout: React.FC<LayoutTemplateProps> = ({
  slide,
  theme,
  frame,
  fps,
  palette: providedPalette,
  visualVariant: providedVariant,
  themeStyle: providedStyle,
  isPortrait = false,
}) => {
  const { palette, variant, style } = getResolvedContext(
    slide,
    theme,
    providedPalette,
    providedVariant,
    providedStyle
  );
  const points = (slide.bullet_points || []).slice(0, 5);
  const headingSize = slide.heading.length > 48 ? '46px' : '52px';

  return (
    <div
      data-layout="split_card"
      data-visual-variant={variant}
      data-theme-preset={style.preset}
      style={{
        display: 'grid',
        gridTemplateColumns: isPortrait ? '1fr' : '1fr 1.05fr',
        gap: isPortrait ? '28px' : '44px',
        maxWidth: '1640px',
        width: '100%',
        alignItems: 'stretch',
      }}
    >
      {/* Left Clean Narrative Editorial Column */}
      <div
        style={{
          backgroundColor: style.preset === 'minimal' ? palette.surfaceBg : palette.surfaceBg,
          border:
            style.preset === 'minimal' ? 'none' : `1px solid ${palette.surfaceBorder}`,
          borderTop:
            style.preset === 'minimal' ? 'none' : `5px solid ${palette.primaryColor}`,
          padding: style.preset === 'minimal' ? '34px 36px' : '40px 42px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '24px',
        }}
      >
        <h2
          style={{
            fontFamily: style.headingFont,
            fontSize: headingSize,
            fontWeight: style.headingWeight,
            color: palette.textColor,
            margin: 0,
            lineHeight: 1.18,
          }}
        >
          {slide.heading}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {points.map((point, idx) => {
            const motion = computeStaggeredSpring(frame, fps, idx);
            return (
              <p
                key={`split-pt-${idx}`}
                style={{
                  opacity: motion.opacity,
                  transform: `translateY(${motion.translateY}px)`,
                  fontFamily: style.bodyFont,
                  fontSize: points.length >= 4 ? '24px' : '27px',
                  fontWeight: idx === 0 && style.preset !== 'minimal' ? 600 : 400,
                  color: idx === 0 ? palette.textColor : palette.mutedTextColor,
                  lineHeight: 1.45,
                  margin: 0,
                  paddingBottom: idx < points.length - 1 ? '14px' : '0px',
                  borderBottom:
                    idx < points.length - 1 ? `1px solid ${palette.surfaceBorder}` : 'none',
                }}
              >
                {point}
              </p>
            );
          })}
        </div>
      </div>

      {/* Right Visual Infographic Panel */}
      <div
        style={{
          backgroundColor: style.preset === 'minimal' ? palette.surfaceAltBg : palette.surfaceAltBg,
          border:
            style.preset === 'minimal' ? 'none' : `1px solid ${palette.surfaceBorder}`,
          padding: '32px 36px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            transform: isPortrait ? 'scale(0.84)' : 'none',
            margin: isPortrait ? '-28px 0' : '0',
          }}
        >
          {variant === 'compare_bars' ? (
            <AnimatedMetricBarsSvg
              frame={frame}
              fps={fps}
              palette={palette}
              slideIndex={slide.slide_index}
              itemCount={points.length || 4}
            />
          ) : variant === 'milestone_roadmap' ? (
            <MilestoneRoadmapSvg
              frame={frame}
              fps={fps}
              palette={palette}
              slideIndex={slide.slide_index}
              itemCount={points.length || 4}
            />
          ) : (
            <StackedLayersSvg
              frame={frame}
              fps={fps}
              palette={palette}
              slideIndex={slide.slide_index}
              itemCount={points.length || 3}
            />
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * 4. Quote Highlight Layout (`quote_highlight`)
 * Expressive centerpiece quotation & graceful supporting context without robotic callout stamps.
 */
export const QuoteHighlightLayout: React.FC<LayoutTemplateProps> = ({
  slide,
  theme,
  frame,
  fps,
  palette: providedPalette,
  visualVariant: providedVariant,
  themeStyle: providedStyle,
  isPortrait = false,
}) => {
  const { palette, variant, style } = getResolvedContext(
    slide,
    theme,
    providedPalette,
    providedVariant,
    providedStyle
  );
  const scaleAnim = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90 },
  });
  const points = (slide.bullet_points || []).slice(0, 4);

  if (variant === 'focus_callout') {
    return (
      <div
        data-layout="quote_highlight"
        data-visual-variant="focus_callout"
        data-theme-preset={style.preset}
        style={{
          display: 'grid',
          gridTemplateColumns: isPortrait
            ? '1fr'
            : points.length > 0
            ? '1.3fr 0.85fr'
            : '1fr',
          gap: isPortrait ? '24px' : '38px',
          maxWidth: '1600px',
          width: '100%',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            transform: `scale(${interpolate(scaleAnim, [0, 1], [0.95, 1])})`,
            backgroundColor: palette.surfaceBg,
            border:
              style.preset === 'minimal' ? 'none' : `1px solid ${palette.surfaceBorder}`,
            borderLeft:
              style.preset === 'minimal' ? 'none' : `10px solid ${palette.primaryColor}`,
            padding: '50px 54px',
          }}
        >
          <blockquote
            style={{
              fontFamily: style.headingFont,
              fontSize: slide.heading.length > 70 ? '42px' : '50px',
              fontWeight: style.headingWeight,
              fontStyle: style.preset === 'corporate' ? 'italic' : 'normal',
              lineHeight: 1.28,
              color: palette.textColor,
              margin: 0,
            }}
          >
            &ldquo;{slide.heading}&rdquo;
          </blockquote>
        </div>

        {points.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {points.map((pt, idx) => {
              const motion = computeStaggeredSpring(frame, fps, idx);
              return (
                <div
                  key={`callout-${idx}`}
                  style={{
                    opacity: motion.opacity,
                    transform: `translateY(${motion.translateY}px)`,
                    padding: '24px 28px',
                    backgroundColor: palette.surfaceAltBg,
                    border:
                      style.preset === 'minimal'
                        ? 'none'
                        : `1px solid ${palette.surfaceBorder}`,
                  }}
                >
                  <p
                    style={{
                      fontFamily: style.bodyFont,
                      fontSize: '25px',
                      fontWeight: style.preset === 'minimal' ? 400 : 500,
                      color: palette.textColor,
                      lineHeight: 1.4,
                      margin: 0,
                    }}
                  >
                    {pt}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      data-layout="quote_highlight"
      data-visual-variant="quote_radar"
      data-theme-preset={style.preset}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        maxWidth: '1460px',
        width: '100%',
        position: 'relative',
        padding: '44px 56px',
      }}
    >
      <EditorialRadarHaloSvg
        frame={frame}
        fps={fps}
        palette={palette}
        slideIndex={slide.slide_index}
      />

      <div
        style={{
          fontFamily: style.headingFont,
          fontSize: '104px',
          lineHeight: 0.7,
          fontWeight: 700,
          color: palette.primaryColor,
          marginBottom: '18px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        &ldquo;
      </div>

      <blockquote
        style={{
          transform: `scale(${interpolate(scaleAnim, [0, 1], [0.95, 1])})`,
          fontFamily: style.headingFont,
          fontSize: slide.heading.length > 70 ? '46px' : '56px',
          fontWeight: style.headingWeight,
          fontStyle: style.preset === 'corporate' ? 'italic' : 'normal',
          lineHeight: 1.28,
          color: palette.textColor,
          margin: '0 0 30px 0',
          maxWidth: '1240px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {slide.heading}
      </blockquote>

      {points.length > 0 && (
        <p
          style={{
            fontFamily: style.bodyFont,
            fontSize: '25px',
            fontWeight: 500,
            color: palette.mutedTextColor,
            margin: 0,
            position: 'relative',
            zIndex: 1,
            maxWidth: '960px',
          }}
        >
          {points.join('  ·  ')}
        </p>
      )}
    </div>
  );
};

/**
 * 5. Conclusion Layout (`conclusion_cta`)
 * Clean colorful takeaway cards without uppercase generic AI CTA banners.
 */
export const ConclusionCtaLayout: React.FC<LayoutTemplateProps> = ({
  slide,
  theme,
  frame,
  fps,
  palette: providedPalette,
  visualVariant: providedVariant,
  themeStyle: providedStyle,
  isPortrait = false,
  contextCategory,
}) => {
  const resolvedContextCategory =
    contextCategory ??
    resolveContextSceneCategory(`${slide.heading} ${(slide.bullet_points || []).join(' ')}`);
  const { palette, variant, style } = getResolvedContext(
    slide,
    theme,
    providedPalette,
    providedVariant,
    providedStyle
  );

  const points = (slide.bullet_points || []).slice(0, 4);

  return (
    <div
      data-layout="conclusion_cta"
      data-visual-variant={variant}
      data-theme-preset={style.preset}
      style={{
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '1640px',
        width: '100%',
        gap: isPortrait ? '24px' : '32px',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isPortrait ? '1fr' : '1.4fr 0.6fr',
          gap: isPortrait ? '20px' : '32px',
          alignItems: 'center',
          backgroundColor:
            style.preset === 'minimal' ? 'transparent' : palette.surfaceAltBg,
          border:
            style.preset === 'minimal' ? 'none' : `1px solid ${palette.surfaceBorder}`,
          padding: isPortrait ? '24px 26px' : '30px 40px',
        }}
      >
        <h2
          style={{
            fontFamily: style.headingFont,
            fontSize: slide.heading.length > 52 ? '48px' : '56px',
            fontWeight: style.headingWeight,
            color: palette.textColor,
            margin: 0,
            lineHeight: 1.18,
          }}
        >
          {slide.heading}
        </h2>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ transform: 'scale(0.56)', margin: '-110px 0' }}>
            <OrbitalHeroSvg
              frame={frame}
              fps={fps}
              palette={palette}
              slideIndex={slide.slide_index}
              isConclusion
              contextCategory={resolvedContextCategory}
            />
          </div>
        </div>
      </div>

      {points.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isPortrait
              ? '1fr'
              : `repeat(${Math.min(4, Math.max(1, points.length))}, minmax(0, 1fr))`,
            gap: isPortrait ? '14px' : '22px',
          }}
        >
          {points.map((pt, idx) => {
            const accent = idx % 2 === 0 ? palette.primaryColor : palette.secondaryColor;
            const motion = computeStaggeredSpring(frame, fps, idx);
            const useColorFill = style.preset === 'modern_tech' && idx === 0;
            return (
              <div
                key={`cta-pt-${idx}`}
                style={{
                  opacity: motion.opacity,
                  transform: `translateY(${motion.translateY}px)`,
                  padding: '28px 28px',
                  backgroundColor: useColorFill ? accent : palette.surfaceBg,
                  color: useColorFill ? palette.badgeTextColor : palette.textColor,
                  border:
                    style.preset === 'minimal'
                      ? 'none'
                      : `1px solid ${palette.surfaceBorder}`,
                  borderTop:
                    style.preset === 'minimal' ? 'none' : `4px solid ${accent}`,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <p
                  style={{
                    fontFamily: style.bodyFont,
                    fontSize: '25px',
                    fontWeight: style.preset === 'minimal' ? 400 : 600,
                    color: useColorFill ? palette.badgeTextColor : palette.textColor,
                    lineHeight: 1.42,
                    margin: 0,
                  }}
                >
                  {pt}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
