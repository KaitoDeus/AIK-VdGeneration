'use client';

import React from 'react';
import {
  WebContextSceneCategory,
  WebSlidePalette,
  WebVisualVariant,
} from '@/lib/templates';

interface BackdropProps {
  palette: WebSlidePalette;
  slideIndex: number;
  category: WebContextSceneCategory;
}

/**
 * Continuous animated atmospheric aurora, geometric lattice, and floating particles
 * inside the live Studio slide canvas (pure SVG shapes — 0px outer StudioBlank radius intact).
 */
export const WebSlideBackdropLayer: React.FC<BackdropProps> = ({
  palette,
  slideIndex,
  category,
}) => {
  const mode = slideIndex % 3;
  const gradIdA = `aik-aurora-a-${slideIndex}`;
  const gradIdB = `aik-aurora-b-${slideIndex}`;
  const gridId = `aik-grid-${slideIndex}`;

  const particles = [
    { cx: 110, cy: 90, r: 5 },
    { cx: 340, cy: 65, r: 7 },
    { cx: 610, cy: 130, r: 4 },
    { cx: 710, cy: 360, r: 6 },
    { cx: 180, cy: 380, r: 5 },
    { cx: 470, cy: 410, r: 4 },
  ];

  return (
    <div
      data-testid="web-kinetic-backdrop"
      data-context-scene={category}
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 800 450"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <radialGradient id={gradIdA} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={palette.primaryColor} stopOpacity="0.34" />
            <stop offset="100%" stopColor={palette.primaryColor} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={gradIdB} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={palette.secondaryColor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={palette.secondaryColor} stopOpacity="0" />
          </radialGradient>
          <pattern id={gridId} width="36" height="36" patternUnits="userSpaceOnUse">
            {mode === 0 ? (
              <circle cx="3" cy="3" r="1.2" fill={palette.primaryColor} fillOpacity="0.16" />
            ) : mode === 1 ? (
              <path
                d="M 36 0 L 0 0 0 36"
                fill="none"
                stroke={palette.primaryColor}
                strokeOpacity="0.10"
                strokeWidth="1"
              />
            ) : (
              <line
                x1="0"
                y1="36"
                x2="36"
                y2="0"
                stroke={palette.secondaryColor}
                strokeOpacity="0.10"
                strokeWidth="1"
              />
            )}
          </pattern>
        </defs>

        <rect width="800" height="450" fill={`url(#${gridId})`} />

        {/* Ambient floating luminous aurora clouds */}
        <g className="aik-float-y">
          <circle cx="670" cy="70" r="210" fill={`url(#${gradIdA})`} />
          <circle cx="110" cy="390" r="190" fill={`url(#${gradIdB})`} />
        </g>

        {/* Ambient geometric ring */}
        <g transform="translate(690 85)" className="aik-orbit-spin">
          <circle
            cx="0"
            cy="0"
            r="112"
            fill="none"
            stroke={palette.primaryColor}
            strokeOpacity="0.22"
            strokeWidth="1.5"
            strokeDasharray="8 10"
          />
        </g>

        {/* Subtle glowing light bokeh dots */}
        {particles.map((p, idx) => (
          <circle
            key={idx}
            cx={p.cx}
            cy={p.cy}
            r={p.r}
            fill={idx % 2 === 0 ? palette.primaryColor : palette.secondaryColor}
            className="aik-pulse-glow"
          />
        ))}
      </svg>
    </div>
  );
};

interface FocalSceneProps {
  variant: WebVisualVariant;
  category: WebContextSceneCategory;
  palette: WebSlidePalette;
  slideIndex: number;
}

/**
 * Rich animated context-aware SVG centerpiece rendered inside live Studio preview cards.
 */
export const WebSlideFocalScene: React.FC<FocalSceneProps> = ({
  variant,
  category,
  palette,
  slideIndex,
}) => {
  if (variant === 'compare_bars') {
    return (
      <svg width="164" height="128" viewBox="0 0 164 128" className="aik-float-y">
        {[24, 52, 80, 108].map((y) => (
          <line
            key={y}
            x1="14"
            y1={y}
            x2="152"
            y2={y}
            stroke={palette.surfaceBorder}
            strokeDasharray="3 4"
            strokeWidth="1"
          />
        ))}
        <rect x="20" y="68" width="22" height="44" rx="4" fill={palette.secondaryColor} fillOpacity="0.82" />
        <rect x="54" y="48" width="22" height="64" rx="4" fill={palette.primaryColor} fillOpacity="0.85" />
        <rect x="88" y="34" width="22" height="78" rx="4" fill={palette.secondaryColor} />
        <rect x="122" y="18" width="22" height="94" rx="4" fill={palette.primaryColor} />
        <path
          d="M 26 62 Q 66 38, 133 14"
          fill="none"
          stroke={palette.textColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="160"
          className="aik-dash-flow"
        />
        <circle cx="133" cy="14" r="5" fill={palette.primaryColor} className="aik-pulse-glow" />
      </svg>
    );
  }

  if (variant === 'stacked_layers') {
    return (
      <svg width="164" height="128" viewBox="0 0 164 128" className="aik-float-y">
        <polygon points="82,12 146,34 82,56 18,34" fill={palette.primaryColor} fillOpacity="0.92" />
        <polygon points="82,42 146,64 82,86 18,64" fill={palette.secondaryColor} fillOpacity="0.82" />
        <polygon
          points="82,72 146,94 82,116 18,94"
          fill={palette.surfaceBg}
          stroke={palette.primaryColor}
          strokeWidth="2"
        />
        <text
          x="82"
          y="39"
          textAnchor="middle"
          fill={palette.badgeTextColor}
          fontSize="10"
          fontWeight="800"
        >
          01
        </text>
        <text
          x="82"
          y="69"
          textAnchor="middle"
          fill={palette.badgeTextColor}
          fontSize="10"
          fontWeight="800"
        >
          02
        </text>
      </svg>
    );
  }

  if (variant === 'milestone_roadmap') {
    return (
      <svg width="164" height="128" viewBox="0 0 164 128">
        <path
          d="M 22 96 C 52 96, 54 54, 82 54 C 110 54, 114 78, 142 30"
          fill="none"
          stroke={palette.primaryColor}
          strokeWidth="3.5"
          strokeDasharray="8 6"
          strokeLinecap="round"
          className="aik-dash-flow"
        />
        {[
          { x: 22, y: 96, c: palette.primaryColor },
          { x: 82, y: 54, c: palette.secondaryColor },
          { x: 142, y: 30, c: palette.primaryColor },
        ].map((stop, i) => (
          <g key={i}>
            <circle cx={stop.x} cy={stop.y} r="13" fill={stop.c} fillOpacity="0.22" className="aik-pulse-glow" />
            <circle cx={stop.x} cy={stop.y} r="8" fill={palette.backgroundColor} stroke={stop.c} strokeWidth="2.5" />
          </g>
        ))}
      </svg>
    );
  }

  if (variant === 'knowledge_graph') {
    return (
      <svg width="164" height="128" viewBox="0 0 164 128">
        {[
          { x: 30, y: 28, c: palette.secondaryColor },
          { x: 134, y: 32, c: palette.primaryColor },
          { x: 32, y: 98, c: palette.primaryColor },
          { x: 132, y: 96, c: palette.secondaryColor },
        ].map((n, i) => (
          <g key={i}>
            <line
              x1="82"
              y1="64"
              x2={n.x}
              y2={n.y}
              stroke={n.c}
              strokeWidth="2"
              strokeDasharray="6 5"
              className="aik-dash-flow"
            />
            <circle cx={n.x} cy={n.y} r="11" fill={palette.backgroundColor} stroke={n.c} strokeWidth="2" />
            <text x={n.x} y={n.y + 3.5} textAnchor="middle" fill={palette.textColor} fontSize="8" fontWeight="800">
              0{i + 1}
            </text>
          </g>
        ))}
        <circle cx="82" cy="64" r="22" fill={palette.primaryColor} className="aik-float-y" />
        <text x="82" y="67" textAnchor="middle" fill={palette.badgeTextColor} fontSize="9" fontWeight="800">
          CORE
        </text>
      </svg>
    );
  }

  // Context-rich bespoke scene illustration for orbital_hero / conclusion_launch / focus scenes
  return (
    <svg width="164" height="128" viewBox="0 0 164 128" data-context-illustration={category}>
      <g transform="translate(82 64)" className="aik-orbit-spin">
        <circle
          cx="0"
          cy="0"
          r="52"
          fill="none"
          stroke={palette.primaryColor}
          strokeOpacity="0.45"
          strokeDasharray="5 6"
          strokeWidth="1.5"
        />
        <circle cx="52" cy="0" r="4.5" fill={palette.secondaryColor} />
        <circle cx="-52" cy="0" r="3.5" fill={palette.primaryColor} />
      </g>

      {category === 'tech_code' ? (
        <g className="aik-float-y">
          <rect
            x="40"
            y="30"
            width="84"
            height="68"
            rx="6"
            fill={palette.backgroundColor}
            stroke={palette.primaryColor}
            strokeWidth="2"
          />
          <line x1="40" y1="44" x2="124" y2="44" stroke={palette.surfaceBorder} strokeWidth="1" />
          <circle cx="50" cy="37" r="2.2" fill="#F43F5E" />
          <circle cx="58" cy="37" r="2.2" fill="#FBBF24" />
          <circle cx="66" cy="37" r="2.2" fill="#34D399" />
          <rect x="50" y="53" width="54" height="5" rx="2.5" fill={palette.primaryColor} />
          <rect x="50" y="64" width="38" height="5" rx="2.5" fill={palette.secondaryColor} />
          <rect x="50" y="75" width="62" height="5" rx="2.5" fill={palette.primaryColor} fillOpacity="0.8" />
          <rect x="50" y="86" width="26" height="5" rx="2.5" fill={palette.secondaryColor} className="aik-pulse-glow" />
        </g>
      ) : category === 'creator_studio' || category === 'gaming_hud' ? (
        <g className="aik-float-y">
          <rect
            x="42"
            y="32"
            width="80"
            height="64"
            rx="8"
            fill={palette.backgroundColor}
            stroke={palette.primaryColor}
            strokeWidth="2"
          />
          <circle cx="54" cy="43" r="3.2" fill="#FB7185" className="aik-pulse-glow" />
          <text x="61" y="46" fill={palette.textColor} fontSize="8" fontWeight="800">
            {category === 'gaming_hud' ? 'HUD' : 'LIVE'}
          </text>
          {[18, 30, 22, 36, 26].map((h, i) => (
            <rect
              key={i}
              x={52 + i * 13}
              y={86 - h}
              width="7"
              height={h}
              rx="3"
              fill={i % 2 === 0 ? palette.primaryColor : palette.secondaryColor}
            />
          ))}
        </g>
      ) : category === 'culinary_kitchen' ? (
        <g className="aik-float-y">
          <circle cx="82" cy="64" r="36" fill={palette.backgroundColor} stroke={palette.primaryColor} strokeWidth="2" />
          <path d="M 68 48 Q 64 38 70 30 M 82 44 Q 78 34 84 26 M 96 48 Q 92 38 98 30" fill="none" stroke={palette.secondaryColor} strokeWidth="2.5" strokeLinecap="round" className="aik-pulse-glow" />
          <path d="M 54 62 Q 82 92 110 62 Z" fill={palette.primaryColor} />
        </g>
      ) : category === 'finance_growth' ? (
        <g className="aik-float-y">
          <circle cx="82" cy="64" r="36" fill={palette.backgroundColor} stroke={palette.primaryColor} strokeWidth="2" />
          <rect x="60" y="66" width="8" height="18" rx="2" fill={palette.primaryColor} />
          <rect x="74" y="54" width="8" height="30" rx="2" fill={palette.secondaryColor} />
          <rect x="88" y="42" width="8" height="42" rx="2" fill={palette.primaryColor} />
          <path d="M 58 64 L 76 52 L 96 36" fill="none" stroke={palette.textColor} strokeWidth="2.5" strokeLinecap="round" />
        </g>
      ) : category === 'travel_globe' || category === 'science_atom' ? (
        <g className="aik-float-y">
          <circle cx="82" cy="64" r="34" fill={palette.backgroundColor} stroke={palette.primaryColor} strokeWidth="2" />
          <ellipse cx="82" cy="64" rx="28" ry="12" fill="none" stroke={palette.secondaryColor} strokeWidth="1.8" />
          <ellipse cx="82" cy="64" rx="12" ry="28" fill="none" stroke={palette.primaryColor} strokeWidth="1.8" />
          <circle cx="82" cy="64" r="7" fill={palette.primaryColor} />
        </g>
      ) : (
        <g className="aik-float-y">
          <circle cx="82" cy="64" r="30" fill={palette.surfaceAltBg} stroke={palette.primaryColor} strokeWidth="2" />
          <text x="82" y="62" textAnchor="middle" fill={palette.textColor} fontSize="14" fontWeight="800">
            {String(slideIndex).padStart(2, '0')}
          </text>
          <text x="82" y="75" textAnchor="middle" fill={palette.primaryColor} fontSize="8" fontWeight="700">
            SCENE
          </text>
        </g>
      )}
    </svg>
  );
};
