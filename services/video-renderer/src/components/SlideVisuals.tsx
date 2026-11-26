/**
 * Procedural Animated Vector Infographics & Kinetic Backdrop Scenes (NotebookLM-Inspired).
 * All motion uses deterministic frame/fps math via Remotion spring/interpolate and trig curves
 * so both real-time preview and 1080p FFmpeg rendering stay smooth and reproducible.
 */

import React from 'react';
import { interpolate, spring } from 'remotion';
import { ContextSceneCategory, SlidePalette, VisualVariant } from '../utils/slidePalettes';

export interface VisualMotionProps {
  frame: number;
  fps: number;
  palette: SlidePalette;
  slideIndex: number;
  itemCount?: number;
  contextCategory?: ContextSceneCategory;
}

/**
 * Ambient continuously animated architectural backdrop behind slide content.
 * Layers aurora spotlights, drifting bokeh particles, and parallax geometric patterns.
 */
export const KineticBackdropScene: React.FC<{
  frame: number;
  palette: SlidePalette;
  slideIndex: number;
  variant: VisualVariant;
  contextCategory?: ContextSceneCategory;
}> = ({ frame, palette, slideIndex, variant, contextCategory = 'general_abstract' }) => {
  const driftX = Math.sin(frame / 42 + slideIndex) * 32;
  const driftY = Math.cos(frame / 36 + slideIndex) * 24;
  const auroraX = Math.cos(frame / 54 + slideIndex * 0.8) * 45;
  const auroraY = Math.sin(frame / 48 + slideIndex * 0.6) * 34;
  const rotateDeg = ((frame * 0.28 + slideIndex * 37) % 360).toFixed(2);
  const gridOpacity = palette.isLight ? 0.08 : 0.11;
  const strokeMain = palette.isLight ? 'rgba(15, 23, 42, 0.09)' : 'rgba(255, 255, 255, 0.09)';

  const patternMode = slideIndex % 3;

  const particles = [0, 1, 2, 3, 4, 5].map((i) => {
    const px = 140 + ((i * 331 + slideIndex * 97) % 1640) + Math.sin(frame / (22 + i * 3) + i) * 24;
    const py = 120 + ((i * 211 + slideIndex * 61) % 820) + Math.cos(frame / (26 + i * 2) + i) * 20;
    const scale = 0.75 + Math.sin(frame / 16 + i * 1.3) * 0.25;
    return {
      cx: px,
      cy: py,
      r: (5 + (i % 3) * 4) * scale,
      color: i % 2 === 0 ? palette.primaryColor : palette.secondaryColor,
      opacity: palette.isLight ? 0.18 : 0.28,
    };
  });

  return (
    <div
      data-testid="kinetic-backdrop"
      data-backdrop-mode={patternMode}
      data-context-scene={contextCategory}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {/* Drifting luminous aurora bloom */}
      <div
        style={{
          position: 'absolute',
          top: '-18%',
          right: '-12%',
          width: '920px',
          height: '920px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${palette.primaryColor}38 0%, transparent 66%)`,
          transform: `translate(${auroraX.toFixed(1)}px, ${auroraY.toFixed(1)}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-22%',
          left: '-14%',
          width: '840px',
          height: '840px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${palette.secondaryColor}30 0%, transparent 66%)`,
          transform: `translate(${(-auroraX * 0.8).toFixed(1)}px, ${(-auroraY * 0.8).toFixed(1)}px)`,
        }}
      />

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
          opacity: palette.isLight ? 0.2 : 0.24,
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
          opacity: palette.isLight ? 0.16 : 0.2,
          transform: `translate(${(-driftX * 0.7).toFixed(1)}px, ${(-driftY * 0.7).toFixed(1)}px) rotate(-${rotateDeg}deg)`,
        }}
      />

      {/* Floating ambient bokeh particles */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0 }}
      >
        {particles.map((pt, idx) => (
          <circle
            key={`bokeh-${idx}`}
            cx={pt.cx}
            cy={pt.cy}
            r={pt.r}
            fill={pt.color}
            opacity={pt.opacity}
          />
        ))}
      </svg>

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

const ContextSceneCoreEmblem: React.FC<{
  category: ContextSceneCategory;
  frame: number;
  palette: SlidePalette;
  slideIndex: number;
  isConclusion: boolean;
}> = ({ category, frame, palette, slideIndex, isConclusion }) => {
  const pulse = (Math.sin(frame / 10) + 1) * 0.5;

  if (category === 'tech_code') {
    const barW = [78, 56, 86, 44];
    return (
      <g>
        <rect x="174" y="188" width="132" height="104" rx="10" fill={palette.backgroundColor} stroke={palette.primaryColor} strokeWidth="2.5" />
        <line x1="174" y1="210" x2="306" y2="210" stroke={palette.surfaceBorder} strokeWidth="1.5" />
        <circle cx="188" cy="199" r="3.5" fill="#F43F5E" />
        <circle cx="199" cy="199" r="3.5" fill="#FBBF24" />
        <circle cx="210" cy="199" r="3.5" fill="#34D399" />
        {barW.map((w, idx) => (
          <rect
            key={`code-${idx}`}
            x="188"
            y={222 + idx * 16}
            width={Math.max(24, w * (0.72 + Math.sin(frame / 12 + idx) * 0.18))}
            height="7"
            rx="3.5"
            fill={idx % 2 === 0 ? palette.primaryColor : palette.secondaryColor}
            opacity="0.9"
          />
        ))}
      </g>
    );
  }

  if (category === 'creator_studio' || category === 'gaming_hud') {
    const bars = [22, 42, 32, 54, 28, 44];
    return (
      <g>
        <rect x="176" y="190" width="128" height="100" rx="12" fill={palette.backgroundColor} stroke={palette.primaryColor} strokeWidth="2.5" />
        <circle cx="194" cy="206" r="5" fill="#FB7185" opacity={0.4 + pulse * 0.6} />
        <text x="206" y="210" fill={palette.textColor} fontSize="11" fontWeight="800" letterSpacing="0.08em">
          {category === 'gaming_hud' ? 'LIVE HUD' : 'ON AIR'}
        </text>
        {bars.map((h, i) => {
          const animH = 14 + Math.abs(Math.sin(frame / 8 + i * 0.9)) * h * 0.72;
          return (
            <rect
              key={`eq-${i}`}
              x={190 + i * 17}
              y={274 - animH}
              width="10"
              height={animH}
              rx="4"
              fill={i % 2 === 0 ? palette.primaryColor : palette.secondaryColor}
            />
          );
        })}
      </g>
    );
  }

  if (category === 'culinary_kitchen') {
    const steamDrift = Math.sin(frame / 12) * 5;
    return (
      <g>
        <circle cx="240" cy="240" r="64" fill={palette.backgroundColor} stroke={palette.primaryColor} strokeWidth="2.5" />
        <path
          d={`M 218 ${222 + steamDrift} Q 212 208 220 194 M 240 ${216 - steamDrift} Q 234 202 242 188 M 262 ${222 + steamDrift} Q 256 208 264 194`}
          fill="none"
          stroke={palette.secondaryColor}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path d="M 196 238 Q 240 286 284 238 Z" fill={palette.primaryColor} />
        <line x1="208" y1="274" x2="272" y2="274" stroke={palette.textColor} strokeWidth="3" strokeLinecap="round" />
      </g>
    );
  }

  if (category === 'finance_growth') {
    return (
      <g>
        <circle cx="240" cy="240" r="66" fill={palette.backgroundColor} stroke={palette.primaryColor} strokeWidth="2.5" />
        {[26, 42, 36, 58].map((h, idx) => (
          <rect
            key={`fin-${idx}`}
            x={198 + idx * 22}
            y={270 - h}
            width="14"
            height={h}
            rx="3"
            fill={idx === 3 ? palette.secondaryColor : palette.primaryColor}
          />
        ))}
        <path
          d="M 196 250 L 222 232 L 246 238 L 274 202"
          fill="none"
          stroke={palette.textColor}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    );
  }

  if (category === 'travel_globe' || category === 'science_atom') {
    return (
      <g>
        <circle cx="240" cy="240" r="62" fill={palette.backgroundColor} stroke={palette.primaryColor} strokeWidth="2.5" />
        <ellipse cx="240" cy="240" rx="52" ry="22" fill="none" stroke={palette.secondaryColor} strokeWidth="2.2" transform={`rotate(${(frame * 1.1) % 360} 240 240)`} />
        <ellipse cx="240" cy="240" rx="52" ry="22" fill="none" stroke={palette.primaryColor} strokeWidth="2.2" transform={`rotate(${60 - ((frame * 0.8) % 360)} 240 240)`} />
        <circle cx="240" cy="240" r="14" fill={palette.primaryColor} />
      </g>
    );
  }

  return (
    <g>
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
  contextCategory = 'general_abstract',
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

      {/* Core emblem tailored to context scene */}
      <g transform={`translate(240 240) scale(${pulseScale.toFixed(3)}) translate(-240 -240)`}>
        <ContextSceneCoreEmblem
          category={contextCategory}
          frame={frame}
          palette={palette}
          slideIndex={slideIndex}
          isConclusion={isConclusion}
        />
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
      <circle
        cx={12 + ((frame * 14) % 1176)}
        cy="14"
        r="6"
        fill={palette.secondaryColor}
      />
    </svg>
  );
};
