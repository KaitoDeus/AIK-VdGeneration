/**
 * Procedural Animated Vector Infographics & Kinetic Backdrop Scenes (NotebookLM-Inspired).
 * All motion uses deterministic frame/fps math via Remotion spring/interpolate and trig curves
 * so both real-time preview and 1080p FFmpeg rendering stay smooth and reproducible.
 */

import React from 'react';
import { interpolate, spring } from 'remotion';
import { SlidePalette, VisualVariant } from '../utils/slidePalettes';

export interface VisualMotionProps {
  frame: number;
  fps: number;
  palette: SlidePalette;
  slideIndex: number;
  itemCount?: number;
}

/**
 * Ambient continuously animated architectural backdrop behind slide content.
 * Cycles background motifs across slides so adjacent slides never look identical.
 */
export const KineticBackdropScene: React.FC<{
  frame: number;
  palette: SlidePalette;
  slideIndex: number;
  variant: VisualVariant;
}> = ({ frame, palette, slideIndex, variant }) => {
  const driftX = Math.sin(frame / 42 + slideIndex) * 28;
  const driftY = Math.cos(frame / 36 + slideIndex) * 20;
  const rotateDeg = ((frame * 0.22 + slideIndex * 37) % 360).toFixed(2);
  const gridOpacity = palette.isLight ? 0.08 : 0.11;
  const strokeMain = palette.isLight ? 'rgba(15, 23, 42, 0.09)' : 'rgba(255, 255, 255, 0.09)';

  const patternMode = slideIndex % 3;

  return (
    <div
      data-testid="kinetic-backdrop"
      data-backdrop-mode={patternMode}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {/* Drifting geometric color orb */}
      <div
        style={{
          position: 'absolute',
          top: '-140px',
          right: '-110px',
          width: '620px',
          height: '620px',
          borderRadius: '50%',
          border: `1.5px dashed ${palette.primaryColor}`,
          opacity: palette.isLight ? 0.16 : 0.2,
          transform: `translate(${driftX.toFixed(1)}px, ${driftY.toFixed(1)}px) rotate(${rotateDeg}deg)`,
        }}
      />

      {/* Secondary counterweight geometric shape */}
      <div
        style={{
          position: 'absolute',
          bottom: '-180px',
          left: '-140px',
          width: '520px',
          height: '520px',
          borderRadius: patternMode === 1 ? '44px' : '50%',
          border: `1px solid ${palette.secondaryColor}`,
          opacity: palette.isLight ? 0.14 : 0.18,
          transform: `translate(${(-driftX * 0.7).toFixed(1)}px, ${(-driftY * 0.7).toFixed(1)}px) rotate(-${rotateDeg}deg)`,
        }}
      />

      {/* Architectural SVG dot grid / diagonal ribs */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, opacity: gridOpacity }}
      >
        <defs>
          {patternMode === 0 && (
            <pattern
              id={`dots-${slideIndex}`}
              width="48"
              height="48"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="4" cy="4" r="2" fill={palette.primaryColor} />
            </pattern>
          )}
          {patternMode === 1 && (
            <pattern
              id={`grid-${slideIndex}`}
              width="80"
              height="80"
              patternUnits="userSpaceOnUse"
            >
              <path d="M 80 0 L 0 0 0 80" fill="none" stroke={strokeMain} strokeWidth="1.5" />
            </pattern>
          )}
          {patternMode === 2 && (
            <pattern
              id={`diag-${slideIndex}`}
              width="64"
              height="64"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(35)"
            >
              <line x1="0" y1="0" x2="0" y2="64" stroke={strokeMain} strokeWidth="1.5" />
            </pattern>
          )}
        </defs>
        <rect
          width="1920"
          height="1080"
          fill={
            patternMode === 0
              ? `url(#dots-${slideIndex})`
              : patternMode === 1
              ? `url(#grid-${slideIndex})`
              : `url(#diag-${slideIndex})`
          }
        />
      </svg>

      {/* Subtle corner accent frame bar aligned to variant */}
      <div
        style={{
          position: 'absolute',
          top: '36px',
          left: variant === 'focus_callout' ? '52px' : '84px',
          width: '64px',
          height: '4px',
          backgroundColor: palette.primaryColor,
          opacity: 0.7,
        }}
      />
    </div>
  );
};

/**
 * Orbital constellation vector visual for title & conclusion hero slides.
 */
export const OrbitalHeroSvg: React.FC<VisualMotionProps & { isConclusion?: boolean }> = ({
  frame,
  fps,
  palette,
  slideIndex,
  isConclusion = false,
}) => {
  const reveal = spring({
    frame: Math.max(0, frame - 4),
    fps,
    config: { damping: 14, stiffness: 80 },
  });

  const orbitA = (frame * 0.9) % 360;
  const orbitB = (frame * -0.55) % 360;
  const pulseScale = 1 + Math.sin(frame / 14) * 0.04;

  const nodes = [0, 72, 144, 216, 288].map((baseAngle, idx) => {
    const rad = ((baseAngle + orbitA * 0.5) * Math.PI) / 180;
    const radius = idx % 2 === 0 ? 156 : 112;
    return {
      cx: 240 + Math.cos(rad) * radius,
      cy: 240 + Math.sin(rad) * radius,
      r: idx % 2 === 0 ? 11 : 8,
      color: idx % 2 === 0 ? palette.primaryColor : palette.secondaryColor,
    };
  });

  return (
    <svg
      data-testid="visual-svg-orbital"
      width="480"
      height="480"
      viewBox="0 0 480 480"
      style={{
        transform: `scale(${interpolate(reveal, [0, 1], [0.88, 1])})`,
        opacity: interpolate(reveal, [0, 1], [0, 1]),
      }}
    >
      {/* Outer dashed ring */}
      <circle
        cx="240"
        cy="240"
        r="196"
        fill="none"
        stroke={palette.surfaceBorder}
        strokeWidth="2"
        strokeDasharray="10 12"
        transform={`rotate(${orbitB} 240 240)`}
      />
      {/* Mid solid orbit */}
      <circle
        cx="240"
        cy="240"
        r="156"
        fill="none"
        stroke={palette.primaryColor}
        strokeOpacity="0.38"
        strokeWidth="2"
      />
      {/* Inner secondary orbit */}
      <circle
        cx="240"
        cy="240"
        r="112"
        fill="none"
        stroke={palette.secondaryColor}
        strokeOpacity="0.42"
        strokeWidth="1.75"
        strokeDasharray="6 8"
        transform={`rotate(${orbitA} 240 240)`}
      />

      {/* Spoke connectors */}
      {nodes.map((node, i) => (
        <g key={`node-${i}`}>
          <line
            x1="240"
            y1="240"
            x2={node.cx}
            y2={node.cy}
            stroke={node.color}
            strokeOpacity="0.35"
            strokeWidth="2"
          />
          <circle cx={node.cx} cy={node.cy} r={node.r + 7} fill={node.color} fillOpacity="0.16" />
          <circle cx={node.cx} cy={node.cy} r={node.r} fill={node.color} />
        </g>
      ))}

      {/* Core emblem */}
      <g transform={`translate(240 240) scale(${pulseScale.toFixed(3)}) translate(-240 -240)`}>
        <circle cx="240" cy="240" r="64" fill={palette.surfaceAltBg} stroke={palette.primaryColor} strokeWidth="2.5" />
        <circle cx="240" cy="240" r="46" fill={palette.primaryColor} fillOpacity="0.18" />
        <text
          x="240"
          y="234"
          textAnchor="middle"
          fill={palette.textColor}
          fontSize="24"
          fontWeight="800"
          letterSpacing="0.1em"
        >
          {isConclusion ? 'NEXT' : String(slideIndex).padStart(2, '0')}
        </text>
        <text
          x="240"
          y="260"
          textAnchor="middle"
          fill={palette.primaryColor}
          fontSize="13"
          fontWeight="700"
          letterSpacing="0.16em"
        >
          {isConclusion ? 'ACTION' : 'TOPIC'}
        </text>
      </g>
    </svg>
  );
};

/**
 * Hub-and-Spoke Knowledge Graph SVG for NotebookLM concept synthesis slides.
 */
export const KnowledgeGraphSvg: React.FC<VisualMotionProps> = ({
  frame,
  fps,
  palette,
  itemCount = 4,
}) => {
  const count = Math.max(2, Math.min(5, itemCount));
  const anim = spring({ frame: Math.max(0, frame - 6), fps, config: { damping: 14 } });
  const dashOffset = -(frame * 2.2) % 60;
  const center = { x: 230, y: 230 };

  const satellites = Array.from({ length: count }, (_, idx) => {
    const startDeg = -110 + (idx * 220) / Math.max(1, count - 1);
    const rad = (startDeg * Math.PI) / 180;
    const radius = idx % 2 === 0 ? 156 : 138;
    const wobble = Math.sin(frame / 18 + idx * 1.4) * 6;
    return {
      x: center.x + Math.cos(rad) * radius,
      y: center.y + Math.sin(rad) * radius + wobble,
      label: `0${idx + 1}`,
      color: idx % 2 === 0 ? palette.primaryColor : palette.secondaryColor,
    };
  });

  return (
    <svg
      data-testid="visual-svg-knowledge-graph"
      width="460"
      height="460"
      viewBox="0 0 460 460"
      style={{
        opacity: interpolate(anim, [0, 1], [0, 1]),
        transform: `scale(${interpolate(anim, [0, 1], [0.92, 1])})`,
      }}
    >
      <circle
        cx={center.x}
        cy={center.y}
        r="172"
        fill="none"
        stroke={palette.surfaceBorder}
        strokeWidth="1.5"
        strokeDasharray="6 8"
      />
      {satellites.map((sat, idx) => (
        <g key={`edge-${idx}`}>
          <line
            x1={center.x}
            y1={center.y}
            x2={sat.x}
            y2={sat.y}
            stroke={sat.color}
            strokeWidth="2.5"
            strokeDasharray="10 8"
            strokeDashoffset={dashOffset}
            strokeOpacity="0.68"
          />
          <circle cx={sat.x} cy={sat.y} r="34" fill={palette.isLight ? palette.surfaceBg : palette.backgroundColor} stroke={sat.color} strokeWidth="2.5" />
          <text
            x={sat.x}
            y={sat.y + 6}
            textAnchor="middle"
            fill={palette.textColor}
            fontSize="18"
            fontWeight="800"
          >
            {sat.label}
          </text>
        </g>
      ))}
      <circle cx={center.x} cy={center.y} r="54" fill={palette.primaryColor} />
      <text
        x={center.x}
        y={center.y + 6}
        textAnchor="middle"
        fill={palette.badgeTextColor}
        fontSize="16"
        fontWeight="800"
        letterSpacing="0.12em"
      >
        CORE
      </text>
    </svg>
  );
};

/**
 * Animated Comparative Bar Chart + Trend Curve SVG for analytical split slides.
 */
export const AnimatedMetricBarsSvg: React.FC<VisualMotionProps> = ({
  frame,
  fps,
  palette,
  slideIndex,
  itemCount = 4,
}) => {
  const grow = spring({ frame: Math.max(0, frame - 6), fps, config: { damping: 14, stiffness: 75 } });
  const barHeights = [148, 206, 258, 312];
  const labels = ['PHASE 1', 'PHASE 2', 'PHASE 3', 'TARGET'];
  const pulse = Math.sin(frame / 14) * 4;
  const activeCols = Math.max(3, Math.min(4, itemCount));

  return (
    <svg
      data-testid="visual-svg-compare-bars"
      width="500"
      height="420"
      viewBox="0 0 500 420"
      style={{ overflow: 'visible' }}
    >
      {/* Subtle baseline grid lines */}
      {[100, 175, 250, 325].map((yPos) => (
        <line
          key={`grid-${yPos}`}
          x1="36"
          y1={yPos}
          x2="464"
          y2={yPos}
          stroke={palette.surfaceBorder}
          strokeWidth="1.2"
          strokeDasharray="4 6"
        />
      ))}

      {/* Axis baseline */}
      <line x1="36" y1="350" x2="468" y2="350" stroke={palette.mutedTextColor} strokeWidth="2" />

      {/* Bars */}
      {barHeights.slice(0, activeCols).map((targetH, idx) => {
        const wave = idx === activeCols - 1 ? pulse : 0;
        const height = Math.max(24, targetH * grow + wave);
        const x = 62 + idx * 102;
        const y = 350 - height;
        const barColor =
          idx === activeCols - 1
            ? palette.primaryColor
            : idx % 2 === 0
            ? palette.secondaryColor
            : palette.primaryColor;

        return (
          <g key={`bar-${idx}`}>
            <rect
              x={x}
              y={y}
              width="66"
              height={height}
              rx="10"
              fill={barColor}
              fillOpacity={idx === activeCols - 1 ? 0.96 : 0.72}
            />
            <text
              x={x + 33}
              y={y - 12}
              textAnchor="middle"
              fill={palette.textColor}
              fontSize="16"
              fontWeight="800"
            >
              +{35 + ((idx + slideIndex) % 5) * 18}%
            </text>
            <text
              x={x + 33}
              y="382"
              textAnchor="middle"
              fill={palette.mutedTextColor}
              fontSize="13"
              fontWeight="700"
              letterSpacing="0.08em"
            >
              {labels[idx]}
            </text>
          </g>
        );
      })}

      {/* Animated trend curve */}
      <path
        d="M 88 220 Q 190 165, 295 110 T 418 46"
        fill="none"
        stroke={palette.secondaryColor}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="460"
        strokeDashoffset={interpolate(grow, [0, 1], [460, 0])}
      />
      <circle cx="418" cy="46" r="9" fill={palette.secondaryColor} />
    </svg>
  );
};

/**
 * Levitating Stacked Architecture Planes SVG for multi-layer split layouts.
 */
export const StackedLayersSvg: React.FC<VisualMotionProps> = ({
  frame,
  fps,
  palette,
  itemCount = 3,
}) => {
  const anim = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 14 } });
  const layers = Math.max(3, Math.min(4, itemCount));

  return (
    <svg
      data-testid="visual-svg-stacked-layers"
      width="480"
      height="420"
      viewBox="0 0 480 420"
      style={{
        opacity: interpolate(anim, [0, 1], [0, 1]),
      }}
    >
      {Array.from({ length: layers }, (_, idx) => {
        const layerIndex = layers - 1 - idx;
        const floatY = Math.sin(frame / 16 + layerIndex * 1.1) * 7;
        const baseY = 92 + idx * 72 + floatY;
        const fill =
          idx === 0
            ? palette.primaryColor
            : idx === 1
            ? palette.secondaryColor
            : palette.surfaceAltBg;
        const fillOpacity = idx === 0 ? 0.92 : idx === 1 ? 0.8 : 1;

        return (
          <g key={`layer-${idx}`}>
            {/* Isometric rhombus plane */}
            <polygon
              points={`240,${baseY} 420,${baseY + 52} 240,${baseY + 104} 60,${baseY + 52}`}
              fill={fill}
              fillOpacity={fillOpacity}
              stroke={palette.surfaceBorder}
              strokeWidth="2.5"
            />
            <text
              x="240"
              y={baseY + 58}
              textAnchor="middle"
              fill={idx < 2 ? palette.badgeTextColor : palette.textColor}
              fontSize="16"
              fontWeight="800"
              letterSpacing="0.14em"
            >
              LAYER 0{idx + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/**
 * Undulating SVG Milestone Roadmap with traveling signal beacon.
 */
export const MilestoneRoadmapSvg: React.FC<VisualMotionProps> = ({
  frame,
  fps,
  palette,
  itemCount = 4,
}) => {
  const anim = spring({ frame: Math.max(0, frame - 6), fps, config: { damping: 14 } });
  const dashOffset = -(frame * 2.6) % 80;
  const allStops = [
    { x: 74, y: 290, label: '01' },
    { x: 184, y: 188, label: '02' },
    { x: 302, y: 236, label: '03' },
    { x: 416, y: 108, label: '04' },
  ];
  const stops = allStops.slice(0, Math.max(2, Math.min(4, itemCount)));
  const pathD =
    stops.length === 2
      ? 'M 74 290 C 130 290, 130 188, 184 188'
      : stops.length === 3
      ? 'M 74 290 C 130 290, 130 188, 184 188 C 242 188, 245 236, 302 236'
      : 'M 74 290 C 130 290, 130 188, 184 188 C 242 188, 245 236, 302 236 C 362 236, 360 108, 416 108';

  return (
    <svg
      data-testid="visual-svg-roadmap"
      width="490"
      height="390"
      viewBox="0 0 490 390"
      style={{
        opacity: interpolate(anim, [0, 1], [0, 1]),
      }}
    >
      <path
        d={pathD}
        fill="none"
        stroke={palette.primaryColor}
        strokeWidth="5"
        strokeDasharray="14 10"
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
      />
      {stops.map((s, idx) => {
        const pulse = 1 + Math.sin(frame / 12 + idx) * 0.1;
        const fill = idx === stops.length - 1 ? palette.secondaryColor : palette.primaryColor;
        return (
          <g key={`stop-${idx}`} transform={`translate(${s.x} ${s.y}) scale(${pulse.toFixed(3)})`}>
            <circle r="34" fill={fill} fillOpacity="0.18" />
            <circle r="24" fill={palette.backgroundColor} stroke={fill} strokeWidth="3.5" />
            <text
              y="6"
              textAnchor="middle"
              fill={palette.textColor}
              fontSize="16"
              fontWeight="800"
            >
              {s.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/**
 * Editorial acoustic radar halo for quote_highlight compositions.
 */
export const EditorialRadarHaloSvg: React.FC<VisualMotionProps> = ({ frame, palette }) => {
  const spinSlow = (frame * 0.35) % 360;
  const spinReverse = (-frame * 0.45) % 360;

  return (
    <svg
      data-testid="visual-svg-editorial-radar"
      width="680"
      height="680"
      viewBox="0 0 680 680"
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        opacity: palette.isLight ? 0.28 : 0.32,
        pointerEvents: 'none',
      }}
    >
      <circle
        cx="340"
        cy="340"
        r="300"
        fill="none"
        stroke={palette.primaryColor}
        strokeWidth="1.5"
        strokeDasharray="12 16"
        transform={`rotate(${spinSlow} 340 340)`}
      />
      <circle
        cx="340"
        cy="340"
        r="228"
        fill="none"
        stroke={palette.secondaryColor}
        strokeWidth="1.5"
        strokeDasharray="6 14"
        transform={`rotate(${spinReverse} 340 340)`}
      />
      <circle
        cx="340"
        cy="340"
        r="156"
        fill="none"
        stroke={palette.surfaceBorder}
        strokeWidth="1"
      />
    </svg>
  );
};

/**
 * Animated horizontal pipeline beam connecting step cards in Process Pipeline slides.
 */
export const ProcessFlowBeamSvg: React.FC<{ frame: number; palette: SlidePalette }> = ({
  frame,
  palette,
}) => {
  const dashOffset = -(frame * 3) % 64;
  return (
    <svg
      data-testid="visual-svg-process-beam"
      width="100%"
      height="28"
      viewBox="0 0 1200 28"
      preserveAspectRatio="none"
      style={{ marginBottom: '12px' }}
    >
      <line
        x1="12"
        y1="14"
        x2="1188"
        y2="14"
        stroke={palette.surfaceBorder}
        strokeWidth="3"
      />
      <line
        x1="12"
        y1="14"
        x2="1188"
        y2="14"
        stroke={palette.primaryColor}
        strokeWidth="4"
        strokeDasharray="18 14"
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
      />
    </svg>
  );
};
