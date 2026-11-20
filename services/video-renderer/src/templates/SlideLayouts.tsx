/**
 * NotebookLM-Inspired Animated Slide Layout Templates for Remotion (Visual Upgrade):
 * Preserves the 5 canonical SlideLayout enums while dispatching multiple structural
 * sub-variants (`visualVariant`) and per-slide contrasting palettes (`SlidePalette`)
 * paired with live animated SVG diagrams from SlideVisuals.
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
  SlidePalette,
  VisualVariant,
  resolveSlidePalette,
  resolveVisualVariant,
} from '../utils/slidePalettes';

export interface LayoutTemplateProps {
  slide: SlideData;
  theme: Required<ThemeConfig>;
  frame: number;
  fps: number;
  palette?: SlidePalette;
  visualVariant?: VisualVariant;
  isPortrait?: boolean;
}

function getResolvedContext(
  slide: SlideData,
  theme: Required<ThemeConfig>,
  palette?: SlidePalette,
  visualVariant?: VisualVariant
): { palette: SlidePalette; variant: VisualVariant } {
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
 * Asymmetric editorial opener pairing bold typography with a live orbital SVG diagram.
 */
export const TitleIntroLayout: React.FC<LayoutTemplateProps> = ({
  slide,
  theme,
  frame,
  fps,
  palette: providedPalette,
  visualVariant: providedVariant,
  isPortrait = false,
}) => {
  const { palette, variant } = getResolvedContext(
    slide,
    theme,
    providedPalette,
    providedVariant
  );

  const badgeSpring = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  const dividerWidth = interpolate(
    spring({ frame: Math.max(0, frame - 6), fps, config: { damping: 16, stiffness: 90 } }),
    [0, 1],
    [0, 280]
  );

  const points = (slide.bullet_points || []).slice(0, 4);
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
      style={{
        display: 'grid',
        gridTemplateColumns: isPortrait ? '1fr' : '1.35fr 0.95fr',
        gap: isPortrait ? '32px' : '48px',
        alignItems: 'center',
        maxWidth: '1640px',
        width: '100%',
      }}
    >
      {/* Left Typographic Hero Stage */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <div
          style={{
            transform: `scale(${interpolate(badgeSpring, [0, 1], [0.88, 1])})`,
            padding: '10px 22px',
            backgroundColor: palette.accentSoft,
            border: `1.5px solid ${palette.primaryColor}`,
            color: palette.primaryColor,
            fontSize: '18px',
            fontWeight: 800,
            letterSpacing: '2.5px',
            textTransform: 'uppercase',
            marginBottom: '26px',
          }}
        >
          KEYNOTE BRIEFING / SLIDE {String(slide.slide_index).padStart(2, '0')}
        </div>

        <h1
          style={{
            fontSize: headingSize,
            fontWeight: 800,
            lineHeight: 1.12,
            color: palette.textColor,
            margin: '0 0 24px 0',
            letterSpacing: '-1px',
          }}
        >
          {slide.heading}
        </h1>

        <div
          style={{
            width: `${dividerWidth}px`,
            height: '6px',
            background: `linear-gradient(90deg, ${palette.primaryColor} 0%, ${palette.secondaryColor} 100%)`,
            marginBottom: '30px',
          }}
        />

        {points.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              width: '100%',
            }}
          >
            {points.map((point, idx) => {
              const motion = computeStaggeredSpring(frame, fps, idx, 10, 5);
              const accent = idx % 2 === 0 ? palette.primaryColor : palette.secondaryColor;
              return (
                <div
                  key={`intro-pt-${idx}`}
                  style={{
                    opacity: motion.opacity,
                    transform: `translateY(${motion.translateY}px)`,
                    padding: '16px 24px',
                    backgroundColor: palette.surfaceBg,
                    border: `1px solid ${palette.surfaceBorder}`,
                    borderLeft: `6px solid ${accent}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '18px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color: accent,
                      minWidth: '32px',
                    }}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span
                    style={{
                      fontSize: '25px',
                      fontWeight: 600,
                      color: palette.textColor,
                      lineHeight: 1.35,
                    }}
                  >
                    {point}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right Procedural Orbital Infographic Card */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isPortrait ? '20px' : '32px',
          backgroundColor: palette.surfaceAltBg,
          border: `1.5px solid ${palette.surfaceBorder}`,
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
          />
        </div>
        <div
          style={{
            marginTop: '8px',
            fontSize: '15px',
            fontWeight: 700,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: palette.mutedTextColor,
          }}
        >
          VISUAL SYNTHESIS / {palette.name}
        </div>
      </div>
    </div>
  );
};

/**
 * 2. Bullet List Layout (`bullet_list`)
 * Dynamically branches into 3 visually distinct NotebookLM architectures:
 *  - process_pipeline: Horizontal stepped sequence + flowing SVG pulse beam
 *  - knowledge_graph: Live hub-and-spoke SVG network + crisp takeaway stack
 *  - bento_mosaic: Asymmetric NotebookLM Bento highlight + secondary tile grid
 */
export const BulletListLayout: React.FC<LayoutTemplateProps> = ({
  slide,
  theme,
  frame,
  fps,
  palette: providedPalette,
  visualVariant: providedVariant,
  isPortrait = false,
}) => {
  const { palette, variant } = getResolvedContext(
    slide,
    theme,
    providedPalette,
    providedVariant
  );
  const points = (slide.bullet_points || []).slice(0, 5);
  const headingSize = slide.heading.length > 50 ? '48px' : '54px';

  // Variant A: Horizontal Process Flow Pipeline
  if (variant === 'process_pipeline') {
    const colCount = Math.max(2, Math.min(4, points.length || 2));
    return (
      <div
        data-layout="bullet_list"
        data-visual-variant="process_pipeline"
        style={{
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '1640px',
          width: '100%',
          gap: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderBottom: `2px solid ${palette.surfaceBorder}`,
            paddingBottom: '18px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '17px',
                fontWeight: 800,
                letterSpacing: '3px',
                textTransform: 'uppercase',
                color: palette.primaryColor,
                marginBottom: '10px',
              }}
            >
              WORKFLOW SEQUENCE / SLIDE {String(slide.slide_index).padStart(2, '0')}
            </div>
            <h2
              style={{
                fontSize: headingSize,
                fontWeight: 800,
                color: palette.textColor,
                margin: 0,
                lineHeight: 1.15,
              }}
            >
              {slide.heading}
            </h2>
          </div>
          <span
            style={{
              padding: '8px 18px',
              backgroundColor: palette.accentSoft,
              border: `1px solid ${palette.primaryColor}`,
              color: palette.primaryColor,
              fontSize: '16px',
              fontWeight: 700,
              letterSpacing: '1.5px',
            }}
          >
            {points.length} STAGES
          </span>
        </div>

        <ProcessFlowBeamSvg frame={frame} palette={palette} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isPortrait
              ? '1fr'
              : `repeat(${colCount}, minmax(0, 1fr))`,
            gap: isPortrait ? '16px' : '22px',
          }}
        >
          {points.map((point, idx) => {
            const motion = computeStaggeredSpring(frame, fps, idx);
            const accent = idx % 2 === 0 ? palette.primaryColor : palette.secondaryColor;
            return (
              <div
                key={`pipe-step-${idx}`}
                style={{
                  opacity: motion.opacity,
                  transform: `translateY(${motion.translateY}px)`,
                  backgroundColor: idx === 0 ? palette.surfaceAltBg : palette.surfaceBg,
                  border: `1.5px solid ${palette.surfaceBorder}`,
                  borderTop: isPortrait ? `1.5px solid ${palette.surfaceBorder}` : `6px solid ${accent}`,
                  borderLeft: isPortrait ? `6px solid ${accent}` : `1.5px solid ${palette.surfaceBorder}`,
                  padding: isPortrait ? '20px 24px' : '26px 24px',
                  display: 'flex',
                  flexDirection: isPortrait ? 'row' : 'column',
                  alignItems: isPortrait ? 'center' : 'stretch',
                  justifyContent: isPortrait ? 'flex-start' : 'space-between',
                  gap: isPortrait ? '20px' : '0px',
                  minHeight: isPortrait ? 'auto' : '220px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '18px',
                  }}
                >
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      backgroundColor: accent,
                      color: palette.badgeTextColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      fontWeight: 800,
                    }}
                  >
                    0{idx + 1}
                  </div>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      letterSpacing: '1.5px',
                      color: palette.mutedTextColor,
                      textTransform: 'uppercase',
                    }}
                  >
                    STEP 0{idx + 1}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: points.length >= 4 ? '24px' : '27px',
                    fontWeight: 600,
                    color: palette.textColor,
                    lineHeight: 1.4,
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

  // Variant B: Hub-and-Spoke Knowledge Graph Synthesis
  if (variant === 'knowledge_graph') {
    return (
      <div
        data-layout="bullet_list"
        data-visual-variant="knowledge_graph"
        style={{
          display: 'grid',
          gridTemplateColumns: isPortrait ? '1fr' : '0.92fr 1.25fr',
          gap: isPortrait ? '26px' : '42px',
          alignItems: 'center',
          maxWidth: '1640px',
          width: '100%',
        }}
      >
        {/* Left Interactive Mind-Map Stage */}
        <div
          style={{
            backgroundColor: palette.surfaceAltBg,
            border: `1.5px solid ${palette.surfaceBorder}`,
            padding: isPortrait ? '20px' : '28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              alignSelf: 'flex-start',
              fontSize: '15px',
              fontWeight: 800,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: palette.primaryColor,
              marginBottom: '6px',
            }}
          >
            KNOWLEDGE GRAPH
          </div>
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

        {/* Right Structured Concept Nodes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <div
              style={{
                fontSize: '17px',
                fontWeight: 800,
                letterSpacing: '2.8px',
                textTransform: 'uppercase',
                color: palette.secondaryColor,
                marginBottom: '8px',
              }}
            >
              CONNECTED PILLARS / SLIDE {String(slide.slide_index).padStart(2, '0')}
            </div>
            <h2
              style={{
                fontSize: headingSize,
                fontWeight: 800,
                color: palette.textColor,
                margin: 0,
                lineHeight: 1.15,
              }}
            >
              {slide.heading}
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {points.map((point, idx) => {
              const motion = computeStaggeredSpring(frame, fps, idx);
              const accent = idx % 2 === 0 ? palette.primaryColor : palette.secondaryColor;
              return (
                <div
                  key={`graph-pt-${idx}`}
                  style={{
                    opacity: motion.opacity,
                    transform: `translateY(${motion.translateY}px)`,
                    padding: '18px 24px',
                    backgroundColor: palette.surfaceBg,
                    border: `1px solid ${palette.surfaceBorder}`,
                    borderLeft: `6px solid ${accent}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                  }}
                >
                  <span
                    style={{
                      width: '38px',
                      height: '38px',
                      backgroundColor: palette.accentSoft,
                      border: `1.5px solid ${accent}`,
                      color: accent,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    0{idx + 1}
                  </span>
                  <span
                    style={{
                      fontSize: points.length >= 4 ? '25px' : '27px',
                      fontWeight: 600,
                      color: palette.textColor,
                      lineHeight: 1.38,
                    }}
                  >
                    {point}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Variant C: NotebookLM Bento Mosaic Grid (default rich variant)
  const leadPoint = points[0];
  const secondaryPoints = points.slice(1);

  return (
    <div
      data-layout="bullet_list"
      data-visual-variant="bento_mosaic"
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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: '24px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '17px',
              fontWeight: 800,
              letterSpacing: '3px',
              textTransform: 'uppercase',
              color: palette.primaryColor,
              marginBottom: '10px',
            }}
          >
            BENTO BRIEFING / SLIDE {String(slide.slide_index).padStart(2, '0')}
          </div>
          <h2
            style={{
              fontSize: headingSize,
              fontWeight: 800,
              color: palette.textColor,
              margin: 0,
              lineHeight: 1.15,
            }}
          >
            {slide.heading}
          </h2>
        </div>
        <div
          style={{
            padding: '10px 20px',
            backgroundColor: palette.surfaceBg,
            border: `1px solid ${palette.surfaceBorder}`,
            fontSize: '15px',
            fontWeight: 700,
            color: palette.secondaryColor,
            letterSpacing: '1.5px',
          }}
        >
          KEY INSIGHTS ({points.length})
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isPortrait
            ? '1fr'
            : secondaryPoints.length > 0
            ? '0.95fr 1.25fr'
            : '1fr',
          gap: isPortrait ? '18px' : '24px',
          alignItems: 'stretch',
        }}
      >
        {/* Featured Anchor Card */}
        {leadPoint && (
          <div
            style={{
              backgroundColor: palette.surfaceAltBg,
              border: `1.5px solid ${palette.primaryColor}`,
              borderTop: `8px solid ${palette.primaryColor}`,
              padding: isPortrait ? '26px 28px' : '34px 32px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: isPortrait ? 'auto' : '320px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '42px',
                  fontWeight: 900,
                  color: palette.primaryColor,
                  lineHeight: 1,
                }}
              >
                01
              </span>
              <span
                style={{
                  padding: '6px 14px',
                  backgroundColor: palette.primaryColor,
                  color: palette.badgeTextColor,
                  fontSize: '14px',
                  fontWeight: 800,
                  letterSpacing: '1.5px',
                }}
              >
                PRIMARY FOCUS
              </span>
            </div>
            <p
              style={{
                fontSize: '33px',
                fontWeight: 700,
                color: palette.textColor,
                lineHeight: 1.35,
                margin: '24px 0 0 0',
              }}
            >
              {leadPoint}
            </p>
          </div>
        )}

        {/* Supporting Bento Tiles */}
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
              const accent = idx % 2 === 0 ? palette.secondaryColor : palette.primaryColor;
              return (
                <div
                  key={`bento-pt-${idx}`}
                  style={{
                    opacity: motion.opacity,
                    transform: `translateY(${motion.translateY}px)`,
                    backgroundColor: palette.surfaceBg,
                    border: `1px solid ${palette.surfaceBorder}`,
                    borderLeft: `6px solid ${accent}`,
                    padding: '24px 26px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span
                      style={{
                        fontSize: '18px',
                        fontWeight: 800,
                        color: accent,
                      }}
                    >
                      0{idx + 2}
                    </span>
                    <span
                      style={{
                        height: '2px',
                        flex: 1,
                        backgroundColor: palette.surfaceBorder,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: secondaryPoints.length >= 3 ? '24px' : '27px',
                      fontWeight: 600,
                      color: palette.textColor,
                      lineHeight: 1.38,
                    }}
                  >
                    {point}
                  </span>
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
 * 3. Asymmetric Two-Column Split Layout (`split_card`)
 * Pairs editorial points on the left with a tailored animated SVG infographic stage on the right:
 *  - compare_bars: Animated comparative vertical bars + rising trend spline
 *  - stacked_layers: Levitating layered architecture stack diagram
 *  - milestone_roadmap: Smooth curved milestone path with traveling progress beacon
 */
export const SplitCardLayout: React.FC<LayoutTemplateProps> = ({
  slide,
  theme,
  frame,
  fps,
  palette: providedPalette,
  visualVariant: providedVariant,
  isPortrait = false,
}) => {
  const { palette, variant } = getResolvedContext(
    slide,
    theme,
    providedPalette,
    providedVariant
  );
  const points = (slide.bullet_points || []).slice(0, 5);
  const headingSize = slide.heading.length > 48 ? '44px' : '50px';

  const visualTitle =
    variant === 'compare_bars'
      ? 'IMPACT BENCHMARK & GROWTH'
      : variant === 'milestone_roadmap'
      ? 'EXECUTION TRAJECTORY'
      : 'LAYERED ARCHITECTURE';

  return (
    <div
      data-layout="split_card"
      data-visual-variant={variant}
      style={{
        display: 'grid',
        gridTemplateColumns: isPortrait ? '1fr' : '1fr 1.05fr',
        gap: isPortrait ? '28px' : '40px',
        maxWidth: '1640px',
        width: '100%',
        alignItems: 'stretch',
      }}
    >
      {/* Left Narrative Panel */}
      <div
        style={{
          backgroundColor: palette.surfaceBg,
          border: `1.5px solid ${palette.surfaceBorder}`,
          borderTop: `8px solid ${palette.primaryColor}`,
          padding: '38px 40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '22px',
        }}
      >
        <div>
          <span
            style={{
              display: 'inline-block',
              fontSize: '16px',
              fontWeight: 800,
              letterSpacing: '2.5px',
              textTransform: 'uppercase',
              color: palette.primaryColor,
              marginBottom: '12px',
            }}
          >
            DEEP DIVE / SLIDE {String(slide.slide_index).padStart(2, '0')}
          </span>
          <h2
            style={{
              fontSize: headingSize,
              fontWeight: 800,
              color: palette.textColor,
              margin: 0,
              lineHeight: 1.18,
            }}
          >
            {slide.heading}
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {points.map((point, idx) => {
            const motion = computeStaggeredSpring(frame, fps, idx);
            const accent = idx % 2 === 0 ? palette.primaryColor : palette.secondaryColor;
            return (
              <div
                key={`split-pt-${idx}`}
                style={{
                  opacity: motion.opacity,
                  transform: `translateY(${motion.translateY}px)`,
                  padding: '16px 20px',
                  backgroundColor: idx === 0 ? palette.surfaceAltBg : 'transparent',
                  border: `1px solid ${palette.surfaceBorder}`,
                  borderLeft: `5px solid ${accent}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                <span
                  style={{
                    fontSize: '18px',
                    fontWeight: 800,
                    color: accent,
                    minWidth: '30px',
                  }}
                >
                  0{idx + 1}
                </span>
                <span
                  style={{
                    fontSize: points.length >= 4 ? '23px' : '25px',
                    fontWeight: 600,
                    color: palette.textColor,
                    lineHeight: 1.38,
                  }}
                >
                  {point}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Procedural Infographic Panel */}
      <div
        style={{
          backgroundColor: palette.surfaceAltBg,
          border: `1.5px solid ${palette.surfaceBorder}`,
          padding: '30px 34px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: `1px solid ${palette.surfaceBorder}`,
            paddingBottom: '12px',
          }}
        >
          <span
            style={{
              fontSize: '15px',
              fontWeight: 800,
              letterSpacing: '2px',
              color: palette.secondaryColor,
            }}
          >
            {visualTitle}
          </span>
          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: palette.mutedTextColor,
              letterSpacing: '1.2px',
            }}
          >
            {palette.name.toUpperCase()}
          </span>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
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
 * Switches between an atmospheric radar halo centerpiece and an editorial broadsheet card.
 */
export const QuoteHighlightLayout: React.FC<LayoutTemplateProps> = ({
  slide,
  theme,
  frame,
  fps,
  palette: providedPalette,
  visualVariant: providedVariant,
  isPortrait = false,
}) => {
  const { palette, variant } = getResolvedContext(
    slide,
    theme,
    providedPalette,
    providedVariant
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
        style={{
          display: 'grid',
          gridTemplateColumns: isPortrait
            ? '1fr'
            : points.length > 0
            ? '1.3fr 0.85fr'
            : '1fr',
          gap: isPortrait ? '24px' : '36px',
          maxWidth: '1600px',
          width: '100%',
          alignItems: 'center',
        }}
      >
        {/* Editorial Broadsheet Statement */}
        <div
          style={{
            transform: `scale(${interpolate(scaleAnim, [0, 1], [0.95, 1])})`,
            backgroundColor: palette.surfaceBg,
            border: `1.5px solid ${palette.surfaceBorder}`,
            borderLeft: `14px solid ${palette.primaryColor}`,
            padding: '52px 54px',
          }}
        >
          <div
            style={{
              fontSize: '18px',
              fontWeight: 800,
              letterSpacing: '3px',
              textTransform: 'uppercase',
              color: palette.primaryColor,
              marginBottom: '20px',
            }}
          >
            CORE PERSPECTIVE / SLIDE {String(slide.slide_index).padStart(2, '0')}
          </div>
          <blockquote
            style={{
              fontSize: slide.heading.length > 70 ? '42px' : '50px',
              fontWeight: 700,
              lineHeight: 1.28,
              color: palette.textColor,
              margin: 0,
            }}
          >
            &ldquo;{slide.heading}&rdquo;
          </blockquote>
        </div>

        {/* Supporting Context Annotations */}
        {points.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {points.map((pt, idx) => {
              const motion = computeStaggeredSpring(frame, fps, idx);
              const accent = idx % 2 === 0 ? palette.secondaryColor : palette.primaryColor;
              return (
                <div
                  key={`callout-${idx}`}
                  style={{
                    opacity: motion.opacity,
                    transform: `translateY(${motion.translateY}px)`,
                    padding: '22px 26px',
                    backgroundColor: palette.surfaceAltBg,
                    border: `1px solid ${palette.surfaceBorder}`,
                    borderTop: `4px solid ${accent}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 800,
                      letterSpacing: '1.5px',
                      color: accent,
                      marginBottom: '8px',
                    }}
                  >
                    ANNOTATION 0{idx + 1}
                  </div>
                  <div
                    style={{
                      fontSize: '25px',
                      fontWeight: 600,
                      color: palette.textColor,
                      lineHeight: 1.38,
                    }}
                  >
                    {pt}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Variant: Atmospheric Quote Radar
  return (
    <div
      data-layout="quote_highlight"
      data-visual-variant="quote_radar"
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
          fontSize: '110px',
          lineHeight: 0.7,
          fontWeight: 900,
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
          fontSize: slide.heading.length > 70 ? '46px' : '56px',
          fontWeight: 700,
          lineHeight: 1.28,
          color: palette.textColor,
          margin: '0 0 34px 0',
          maxWidth: '1240px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {slide.heading}
      </blockquote>

      {points.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {points.map((pt, idx) => {
            const accent = idx % 2 === 0 ? palette.primaryColor : palette.secondaryColor;
            return (
              <span
                key={`quote-badge-${idx}`}
                style={{
                  padding: '12px 26px',
                  backgroundColor: palette.surfaceBg,
                  border: `1.5px solid ${accent}`,
                  color: palette.textColor,
                  fontSize: '22px',
                  fontWeight: 600,
                }}
              >
                {pt}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * 5. Conclusion & Call-to-Action Layout (`conclusion_cta`)
 * Pairs strategic wrap-up cards with an energetic orbital finish emblem.
 */
export const ConclusionCtaLayout: React.FC<LayoutTemplateProps> = ({
  slide,
  theme,
  frame,
  fps,
  palette: providedPalette,
  visualVariant: providedVariant,
  isPortrait = false,
}) => {
  const { palette, variant } = getResolvedContext(
    slide,
    theme,
    providedPalette,
    providedVariant
  );

  const ctaAnim = spring({
    frame: Math.max(0, frame - 12),
    fps,
    config: { damping: 12, stiffness: 110 },
  });

  const points = (slide.bullet_points || []).slice(0, 4);

  return (
    <div
      data-layout="conclusion_cta"
      data-visual-variant={variant}
      style={{
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '1640px',
        width: '100%',
        gap: isPortrait ? '22px' : '26px',
      }}
    >
      {/* Top Executive Wrap Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isPortrait ? '1fr' : '1.35fr 0.65fr',
          gap: isPortrait ? '20px' : '32px',
          alignItems: 'center',
          backgroundColor: palette.surfaceAltBg,
          border: `1.5px solid ${palette.surfaceBorder}`,
          borderLeft: `10px solid ${palette.primaryColor}`,
          padding: isPortrait ? '28px 30px' : '28px 38px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '17px',
              fontWeight: 800,
              letterSpacing: '3px',
              textTransform: 'uppercase',
              color: palette.primaryColor,
              marginBottom: '12px',
            }}
          >
            EXECUTIVE SYNTHESIS & NEXT STEPS
          </div>
          <h2
            style={{
              fontSize: slide.heading.length > 52 ? '48px' : '56px',
              fontWeight: 800,
              color: palette.textColor,
              margin: 0,
              lineHeight: 1.15,
            }}
          >
            {slide.heading}
          </h2>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ transform: 'scale(0.56)', margin: '-110px 0' }}>
            <OrbitalHeroSvg
              frame={frame}
              fps={fps}
              palette={palette}
              slideIndex={slide.slide_index}
              isConclusion
            />
          </div>
        </div>
      </div>

      {/* Action Cards Grid */}
      {points.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isPortrait
              ? '1fr'
              : `repeat(${Math.min(4, Math.max(1, points.length))}, minmax(0, 1fr))`,
            gap: isPortrait ? '14px' : '20px',
          }}
        >
          {points.map((pt, idx) => {
            const accent = idx % 2 === 0 ? palette.primaryColor : palette.secondaryColor;
            const motion = computeStaggeredSpring(frame, fps, idx);
            return (
              <div
                key={`cta-pt-${idx}`}
                style={{
                  opacity: motion.opacity,
                  transform: `translateY(${motion.translateY}px)`,
                  padding: '24px 26px',
                  backgroundColor: palette.surfaceBg,
                  border: `1.5px solid ${palette.surfaceBorder}`,
                  borderTop: `6px solid ${accent}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 800,
                    letterSpacing: '1.5px',
                    color: accent,
                  }}
                >
                  ACTION 0{idx + 1}
                </span>
                <span
                  style={{
                    fontSize: '25px',
                    fontWeight: 600,
                    color: palette.textColor,
                    lineHeight: 1.38,
                  }}
                >
                  {pt}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Closing CTA Banner */}
      <div
        style={{
          alignSelf: 'flex-start',
          transform: `scale(${interpolate(ctaAnim, [0, 1], [0.92, 1])})`,
          padding: '16px 36px',
          background: `linear-gradient(90deg, ${palette.primaryColor} 0%, ${palette.secondaryColor} 100%)`,
          color: palette.badgeTextColor,
          fontSize: '22px',
          fontWeight: 800,
          letterSpacing: '1.2px',
          textTransform: 'uppercase',
        }}
      >
        SUMMARY COMPLETE / READY FOR IMPLEMENTATION
      </div>
    </div>
  );
};
