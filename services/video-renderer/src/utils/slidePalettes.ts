/**
 * Theme-Differentiated Slide Palettes, Typography Profiles & Visual Archetypes:
 *  - modern_tech: Vivid multi-color jewel & electric studio palettes with modern geometric sans
 *  - corporate: Authoritative executive consulting palettes with classic serif headings
 *  - minimal: Airy luminous pastel gallery palettes with light humanist sans & high whitespace
 */

import { SlideData, SlideLayout, ThemeConfig, ThemePreset } from '../types';
import { DEFAULT_THEME } from './timing';

export type VisualVariant =
  | 'orbital_hero'
  | 'process_pipeline'
  | 'bento_mosaic'
  | 'knowledge_graph'
  | 'compare_bars'
  | 'stacked_layers'
  | 'milestone_roadmap'
  | 'quote_radar'
  | 'focus_callout'
  | 'conclusion_launch';

export interface SlidePalette {
  id: string;
  name: string;
  isLight: boolean;
  backgroundColor: string;
  backgroundImage: string;
  surfaceBg: string;
  surfaceAltBg: string;
  surfaceBorder: string;
  primaryColor: string;
  secondaryColor: string;
  accentSoft: string;
  textColor: string;
  mutedTextColor: string;
  badgeTextColor: string;
  chromeMutedColor: string;
}

export interface ThemeVisualStyle {
  preset: ThemePreset;
  headingFont: string;
  bodyFont: string;
  headingWeight: number;
  topBarHeight: string;
  accentStripeWidth: string;
}

export const SLIDE_PALETTES: readonly SlidePalette[] = [
  {
    id: 'sapphire_studio',
    name: 'Cobalt Pulse',
    isLight: false,
    backgroundColor: '#132B63',
    backgroundImage:
      'radial-gradient(circle at 82% 18%, rgba(56, 189, 248, 0.36) 0%, transparent 50%), radial-gradient(circle at 14% 84%, rgba(244, 114, 182, 0.24) 0%, transparent 52%)',
    surfaceBg: 'rgba(255, 255, 255, 0.10)',
    surfaceAltBg: 'rgba(56, 189, 248, 0.18)',
    surfaceBorder: 'rgba(255, 255, 255, 0.24)',
    primaryColor: '#38BDF8',
    secondaryColor: '#FBBF24',
    accentSoft: 'rgba(56, 189, 248, 0.20)',
    textColor: '#FFFFFF',
    mutedTextColor: '#DBEAFE',
    badgeTextColor: '#0F172A',
    chromeMutedColor: '#BFDBFE',
  },
  {
    id: 'warm_editorial_paper',
    name: 'Tangerine Cream',
    isLight: true,
    backgroundColor: '#FFF4E8',
    backgroundImage:
      'radial-gradient(circle at 88% 14%, rgba(249, 115, 22, 0.22) 0%, transparent 48%), radial-gradient(circle at 10% 88%, rgba(37, 99, 235, 0.14) 0%, transparent 50%)',
    surfaceBg: '#FFFFFF',
    surfaceAltBg: '#FFEAD5',
    surfaceBorder: 'rgba(234, 88, 12, 0.22)',
    primaryColor: '#EA580C',
    secondaryColor: '#2563EB',
    accentSoft: 'rgba(234, 88, 12, 0.15)',
    textColor: '#1C1917',
    mutedTextColor: '#57534E',
    badgeTextColor: '#FFFFFF',
    chromeMutedColor: '#78716C',
  },
  {
    id: 'emerald_forest',
    name: 'Tropical Jade',
    isLight: false,
    backgroundColor: '#0B4236',
    backgroundImage:
      'radial-gradient(circle at 84% 20%, rgba(52, 211, 153, 0.34) 0%, transparent 50%), radial-gradient(circle at 18% 82%, rgba(251, 191, 36, 0.24) 0%, transparent 50%)',
    surfaceBg: 'rgba(255, 255, 255, 0.10)',
    surfaceAltBg: 'rgba(16, 185, 129, 0.20)',
    surfaceBorder: 'rgba(110, 231, 183, 0.28)',
    primaryColor: '#34D399',
    secondaryColor: '#FCD34D',
    accentSoft: 'rgba(52, 211, 153, 0.20)',
    textColor: '#F0FDF4',
    mutedTextColor: '#A7F3D0',
    badgeTextColor: '#052E16',
    chromeMutedColor: '#A7F3D0',
  },
  {
    id: 'cobalt_porcelain',
    name: 'Azure Sky',
    isLight: true,
    backgroundColor: '#E8F3FF',
    backgroundImage:
      'radial-gradient(circle at 86% 18%, rgba(37, 99, 235, 0.20) 0%, transparent 48%), radial-gradient(circle at 12% 84%, rgba(147, 51, 234, 0.16) 0%, transparent 50%)',
    surfaceBg: '#FFFFFF',
    surfaceAltBg: '#DCEBFF',
    surfaceBorder: 'rgba(37, 99, 235, 0.22)',
    primaryColor: '#2563EB',
    secondaryColor: '#9333EA',
    accentSoft: 'rgba(37, 99, 235, 0.14)',
    textColor: '#0F172A',
    mutedTextColor: '#475569',
    badgeTextColor: '#FFFFFF',
    chromeMutedColor: '#475569',
  },
  {
    id: 'aubergine_spark',
    name: 'Plum Berry',
    isLight: false,
    backgroundColor: '#3A1563',
    backgroundImage:
      'radial-gradient(circle at 85% 18%, rgba(244, 63, 94, 0.34) 0%, transparent 48%), radial-gradient(circle at 16% 84%, rgba(56, 189, 248, 0.24) 0%, transparent 50%)',
    surfaceBg: 'rgba(255, 255, 255, 0.10)',
    surfaceAltBg: 'rgba(244, 63, 94, 0.20)',
    surfaceBorder: 'rgba(251, 113, 133, 0.30)',
    primaryColor: '#FB7185',
    secondaryColor: '#38BDF8',
    accentSoft: 'rgba(251, 113, 133, 0.20)',
    textColor: '#FFF1F2',
    mutedTextColor: '#F3E8FF',
    badgeTextColor: '#1B102E',
    chromeMutedColor: '#E9D5FF',
  },
  {
    id: 'sage_botanical',
    name: 'Meadow Mint',
    isLight: true,
    backgroundColor: '#E9F7EF',
    backgroundImage:
      'radial-gradient(circle at 84% 16%, rgba(16, 185, 129, 0.20) 0%, transparent 48%), radial-gradient(circle at 15% 86%, rgba(245, 158, 11, 0.16) 0%, transparent 48%)',
    surfaceBg: '#FFFFFF',
    surfaceAltBg: '#D1FAE5',
    surfaceBorder: 'rgba(5, 150, 105, 0.22)',
    primaryColor: '#059669',
    secondaryColor: '#D97706',
    accentSoft: 'rgba(5, 150, 105, 0.14)',
    textColor: '#064E3B',
    mutedTextColor: '#374151',
    badgeTextColor: '#FFFFFF',
    chromeMutedColor: '#4B5563',
  },
  {
    id: 'obsidian_amber',
    name: 'Terracotta Gold',
    isLight: false,
    backgroundColor: '#4D1F0D',
    backgroundImage:
      'radial-gradient(circle at 86% 18%, rgba(245, 158, 11, 0.34) 0%, transparent 48%), radial-gradient(circle at 14% 85%, rgba(20, 184, 166, 0.24) 0%, transparent 48%)',
    surfaceBg: 'rgba(255, 250, 240, 0.10)',
    surfaceAltBg: 'rgba(245, 158, 11, 0.20)',
    surfaceBorder: 'rgba(251, 191, 36, 0.30)',
    primaryColor: '#FBBF24',
    secondaryColor: '#2DD4BF',
    accentSoft: 'rgba(251, 191, 36, 0.20)',
    textColor: '#FFFBEB',
    mutedTextColor: '#FDE68A',
    badgeTextColor: '#1C1917',
    chromeMutedColor: '#FDE68A',
  },
  {
    id: 'blush_sand_studio',
    name: 'Coral Sunset',
    isLight: true,
    backgroundColor: '#FFF0F3',
    backgroundImage:
      'radial-gradient(circle at 86% 16%, rgba(225, 29, 72, 0.18) 0%, transparent 48%), radial-gradient(circle at 14% 84%, rgba(79, 70, 229, 0.14) 0%, transparent 48%)',
    surfaceBg: '#FFFFFF',
    surfaceAltBg: '#FFE4E8',
    surfaceBorder: 'rgba(225, 29, 72, 0.22)',
    primaryColor: '#E11D48',
    secondaryColor: '#4F46E5',
    accentSoft: 'rgba(225, 29, 72, 0.14)',
    textColor: '#1F1317',
    mutedTextColor: '#5B454B',
    badgeTextColor: '#FFFFFF',
    chromeMutedColor: '#5B454B',
  },
];

export const CORPORATE_PALETTES: readonly SlidePalette[] = [
  {
    id: 'corp_admiralty_navy',
    name: 'Admiralty Navy',
    isLight: false,
    backgroundColor: '#102A43',
    backgroundImage:
      'radial-gradient(circle at 88% 12%, rgba(217, 119, 6, 0.14) 0%, transparent 46%)',
    surfaceBg: 'rgba(255, 255, 255, 0.06)',
    surfaceAltBg: 'rgba(255, 255, 255, 0.10)',
    surfaceBorder: 'rgba(226, 232, 240, 0.24)',
    primaryColor: '#E6A852',
    secondaryColor: '#9FB3C8',
    accentSoft: 'rgba(230, 168, 82, 0.16)',
    textColor: '#F8FAFC',
    mutedTextColor: '#CBD5E1',
    badgeTextColor: '#102A43',
    chromeMutedColor: '#9FB3C8',
  },
  {
    id: 'corp_warm_ivory',
    name: 'Cotton Linen',
    isLight: true,
    backgroundColor: '#FAF7F2',
    backgroundImage:
      'radial-gradient(circle at 90% 90%, rgba(16, 42, 67, 0.06) 0%, transparent 50%)',
    surfaceBg: '#FFFFFF',
    surfaceAltBg: '#F3EDE2',
    surfaceBorder: 'rgba(30, 41, 59, 0.16)',
    primaryColor: '#8B2635',
    secondaryColor: '#1E3A5F',
    accentSoft: 'rgba(139, 38, 53, 0.10)',
    textColor: '#1E293B',
    mutedTextColor: '#475569',
    badgeTextColor: '#FFFFFF',
    chromeMutedColor: '#64748B',
  },
  {
    id: 'corp_forest_reserve',
    name: 'Heritage Pine',
    isLight: false,
    backgroundColor: '#173B34',
    backgroundImage:
      'radial-gradient(circle at 85% 20%, rgba(217, 119, 6, 0.16) 0%, transparent 48%)',
    surfaceBg: 'rgba(255, 255, 255, 0.06)',
    surfaceAltBg: 'rgba(255, 255, 255, 0.10)',
    surfaceBorder: 'rgba(209, 250, 229, 0.22)',
    primaryColor: '#E09F3E',
    secondaryColor: '#99F6E4',
    accentSoft: 'rgba(224, 159, 62, 0.16)',
    textColor: '#F9FAFB',
    mutedTextColor: '#CBD5E1',
    badgeTextColor: '#173B34',
    chromeMutedColor: '#CBD5E1',
  },
  {
    id: 'corp_parchment_slate',
    name: 'Pearl Consulting',
    isLight: true,
    backgroundColor: '#F1F5F9',
    backgroundImage:
      'radial-gradient(circle at 12% 14%, rgba(30, 64, 175, 0.07) 0%, transparent 48%)',
    surfaceBg: '#FFFFFF',
    surfaceAltBg: '#E2E8F0',
    surfaceBorder: 'rgba(15, 23, 42, 0.15)',
    primaryColor: '#1E40AF',
    secondaryColor: '#9A3412',
    accentSoft: 'rgba(30, 64, 175, 0.10)',
    textColor: '#0F172A',
    mutedTextColor: '#475569',
    badgeTextColor: '#FFFFFF',
    chromeMutedColor: '#475569',
  },
  {
    id: 'corp_wine_atelier',
    name: 'Bordeaux Executive',
    isLight: false,
    backgroundColor: '#4A192C',
    backgroundImage:
      'radial-gradient(circle at 82% 16%, rgba(253, 230, 138, 0.14) 0%, transparent 46%)',
    surfaceBg: 'rgba(255, 255, 255, 0.06)',
    surfaceAltBg: 'rgba(255, 255, 255, 0.10)',
    surfaceBorder: 'rgba(253, 230, 138, 0.24)',
    primaryColor: '#FDE68A',
    secondaryColor: '#FCA5A5',
    accentSoft: 'rgba(253, 230, 138, 0.15)',
    textColor: '#FFF8F6',
    mutedTextColor: '#F5D0FE',
    badgeTextColor: '#4A192C',
    chromeMutedColor: '#E2D4DC',
  },
  {
    id: 'corp_warm_sand',
    name: 'Sandstone Digest',
    isLight: true,
    backgroundColor: '#F5EFE6',
    backgroundImage:
      'radial-gradient(circle at 85% 85%, rgba(15, 118, 110, 0.08) 0%, transparent 50%)',
    surfaceBg: '#FFFDF9',
    surfaceAltBg: '#EAE0D2',
    surfaceBorder: 'rgba(41, 37, 36, 0.15)',
    primaryColor: '#0F766E',
    secondaryColor: '#B45309',
    accentSoft: 'rgba(15, 118, 110, 0.10)',
    textColor: '#1C1917',
    mutedTextColor: '#57534E',
    badgeTextColor: '#FFFFFF',
    chromeMutedColor: '#57534E',
  },
];

export const MINIMAL_PALETTES: readonly SlidePalette[] = [
  {
    id: 'minimal_peach_silk',
    name: 'Peach Silk',
    isLight: true,
    backgroundColor: '#FFF0EB',
    backgroundImage:
      'radial-gradient(circle at 88% 12%, rgba(251, 146, 60, 0.16) 0%, transparent 45%)',
    surfaceBg: '#FFFFFF',
    surfaceAltBg: '#FFE3D8',
    surfaceBorder: 'rgba(234, 88, 12, 0.16)',
    primaryColor: '#EA580C',
    secondaryColor: '#9A3412',
    accentSoft: 'rgba(234, 88, 12, 0.10)',
    textColor: '#292524',
    mutedTextColor: '#57534E',
    badgeTextColor: '#FFFFFF',
    chromeMutedColor: '#78716C',
  },
  {
    id: 'minimal_mint_breeze',
    name: 'Mint Breeze',
    isLight: true,
    backgroundColor: '#EAFBF3',
    backgroundImage:
      'radial-gradient(circle at 14% 86%, rgba(16, 185, 129, 0.16) 0%, transparent 45%)',
    surfaceBg: '#FFFFFF',
    surfaceAltBg: '#D3F7E6',
    surfaceBorder: 'rgba(5, 150, 105, 0.16)',
    primaryColor: '#059669',
    secondaryColor: '#0F766E',
    accentSoft: 'rgba(5, 150, 105, 0.10)',
    textColor: '#111827',
    mutedTextColor: '#4B5563',
    badgeTextColor: '#FFFFFF',
    chromeMutedColor: '#6B7280',
  },
  {
    id: 'minimal_sky_cloud',
    name: 'Sky Pastel',
    isLight: true,
    backgroundColor: '#EAF5FF',
    backgroundImage:
      'radial-gradient(circle at 86% 16%, rgba(14, 165, 233, 0.16) 0%, transparent 46%)',
    surfaceBg: '#FFFFFF',
    surfaceAltBg: '#D8EDFF',
    surfaceBorder: 'rgba(2, 132, 199, 0.16)',
    primaryColor: '#0284C7',
    secondaryColor: '#1D4ED8',
    accentSoft: 'rgba(2, 132, 199, 0.10)',
    textColor: '#0F172A',
    mutedTextColor: '#475569',
    badgeTextColor: '#FFFFFF',
    chromeMutedColor: '#64748B',
  },
  {
    id: 'minimal_lavender_veil',
    name: 'Lavender Veil',
    isLight: true,
    backgroundColor: '#F3EEFF',
    backgroundImage:
      'radial-gradient(circle at 15% 15%, rgba(139, 92, 246, 0.14) 0%, transparent 46%)',
    surfaceBg: '#FFFFFF',
    surfaceAltBg: '#E7DEFF',
    surfaceBorder: 'rgba(109, 40, 217, 0.16)',
    primaryColor: '#6D28D9',
    secondaryColor: '#9333EA',
    accentSoft: 'rgba(109, 40, 217, 0.10)',
    textColor: '#1F2937',
    mutedTextColor: '#4B5563',
    badgeTextColor: '#FFFFFF',
    chromeMutedColor: '#6B7280',
  },
  {
    id: 'minimal_buttercream',
    name: 'Buttercream',
    isLight: true,
    backgroundColor: '#FEF9E3',
    backgroundImage:
      'radial-gradient(circle at 88% 82%, rgba(234, 179, 8, 0.18) 0%, transparent 46%)',
    surfaceBg: '#FFFFFF',
    surfaceAltBg: '#FEF0B8',
    surfaceBorder: 'rgba(202, 138, 4, 0.18)',
    primaryColor: '#B45309',
    secondaryColor: '#D97706',
    accentSoft: 'rgba(180, 83, 9, 0.10)',
    textColor: '#1C1917',
    mutedTextColor: '#57534E',
    badgeTextColor: '#FFFFFF',
    chromeMutedColor: '#78716C',
  },
  {
    id: 'minimal_blush_rose',
    name: 'Blush Petal',
    isLight: true,
    backgroundColor: '#FCEFF2',
    backgroundImage:
      'radial-gradient(circle at 18% 84%, rgba(236, 72, 153, 0.14) 0%, transparent 46%)',
    surfaceBg: '#FFFFFF',
    surfaceAltBg: '#F9DCE4',
    surfaceBorder: 'rgba(219, 39, 119, 0.16)',
    primaryColor: '#BE185D',
    secondaryColor: '#DB2777',
    accentSoft: 'rgba(190, 24, 93, 0.10)',
    textColor: '#1F1218',
    mutedTextColor: '#5B454F',
    badgeTextColor: '#FFFFFF',
    chromeMutedColor: '#6B535D',
  },
];

const BUILTIN_PRESET_BG_COLORS = new Set([
  '#0f172a',
  '#132b63',
  '#102a43',
  '#1e293b',
  '#18181b',
  '#fff0eb',
  '#faf9f6',
]);

const BUILTIN_PRESET_PRIMARY_COLORS = new Set([
  '#38bdf8',
  '#60a5fa',
  '#a855f7',
  '#d97706',
  '#ea580c',
  '#6d28d9',
]);

export function resolveThemePreset(baseTheme: Required<ThemeConfig>): ThemePreset {
  if (
    baseTheme.preset === 'modern_tech' ||
    baseTheme.preset === 'corporate' ||
    baseTheme.preset === 'minimal'
  ) {
    return baseTheme.preset;
  }
  const ff = (baseTheme.fontFamily || '').toLowerCase();
  if (ff.includes('serif')) return 'corporate';
  const bg = (baseTheme.backgroundColor || '').toLowerCase();
  if (bg === '#fff0eb' || bg === '#faf9f6' || bg === '#18181b') return 'minimal';
  return 'modern_tech';
}

export function resolveThemeVisualStyle(baseTheme: Required<ThemeConfig>): ThemeVisualStyle {
  const preset = resolveThemePreset(baseTheme);
  if (preset === 'corporate') {
    return {
      preset,
      headingFont: '"Noto Serif Display", "Noto Serif", "Sitka Heading", "Cambria", "Times New Roman", serif',
      bodyFont: '"Noto Sans", "Calibri", "Segoe UI", Arial, sans-serif',
      headingWeight: 700,
      topBarHeight: '3px',
      accentStripeWidth: '3px',
    };
  }
  if (preset === 'minimal') {
    return {
      preset,
      headingFont: '"Noto Sans", "Segoe UI Variable Text", "Segoe UI", Arial, sans-serif',
      bodyFont: '"Noto Sans", "Segoe UI Variable Text", "Segoe UI", Arial, sans-serif',
      headingWeight: 500,
      topBarHeight: '0px',
      accentStripeWidth: '0px',
    };
  }
  return {
    preset,
    headingFont: '"Noto Sans Display", "Noto Sans", "Bahnschrift", "Segoe UI", system-ui, sans-serif',
    bodyFont: '"Noto Sans", "Segoe UI", system-ui, sans-serif',
    headingWeight: 800,
    topBarHeight: '8px',
    accentStripeWidth: '6px',
  };
}

export type ContextSceneCategory =
  | 'tech_code'
  | 'creator_studio'
  | 'gaming_hud'
  | 'culinary_kitchen'
  | 'finance_growth'
  | 'travel_globe'
  | 'science_atom'
  | 'general_abstract';

export type ContextMood =
  | 'default'
  | 'tech_cyber'
  | 'gaming_neon'
  | 'culinary_warm'
  | 'finance_emerald'
  | 'travel_ocean'
  | 'creator_magenta'
  | 'education_violet';

/**
 * Classifies prompt, project title, or channel niche into an illustrated scene category
 * for domain-authentic iconography and bespoke vector artwork.
 */
export function resolveContextSceneCategory(contextText: string = ''): ContextSceneCategory {
  const lower = contextText.toLowerCase();
  if (/(congthichit|lập trình|\bcode\b|\bcoding\b|\bdev\b|\bsoftware\b|\bserver\b|\bmicroservices\b|\bcloud\b|\bcircuit|\bmicrochip|\bhardware\b|\blaptop\b|\bpc\b|\bpython\b|\btypescript\b|\bbackend\b|\bapi\b|\bai\b|\bit\b)/.test(lower)) {
    return 'tech_code';
  }
  if (/(\bgame\b|\bgaming\b|\besports\b|\bfps\b|\bcombo\b|\bstream|\banime\b)/.test(lower)) {
    return 'gaming_hud';
  }
  if (/(ẩm thực|món ăn|nấu ăn|cà phê|\bcoffee\b|\bfood\b|\bcooking\b|\bkitchen\b|\bwok\b)/.test(lower)) {
    return 'culinary_kitchen';
  }
  if (/(gọi vốn|\bpitch\b|tài chính|kinh doanh|\bsaas\b|\bstartup\b|\btrading\b|\bfinance\b|\binvest\b|\bmarketing\b)/.test(lower)) {
    return 'finance_growth';
  }
  if (/(du lịch|\btravel\b|\bnature\b|thiên nhiên|biển|núi|skyline|landscape)/.test(lower)) {
    return 'travel_globe';
  }
  if (/(khoa học|\bscience\b|\blab\b|học tập|giáo dục|\beducation\b|\bstudy\b|\benglish\b|tiếng anh)/.test(lower)) {
    return 'science_atom';
  }
  if (/(tiktok|shorts|reels|video ngắn|creator|podcast|cinema|camera|filmmaker|chỉnh sửa video)/.test(lower)) {
    return 'creator_studio';
  }
  return 'general_abstract';
}

export function resolveContextMood(contextText: string = ''): ContextMood {
  const category = resolveContextSceneCategory(contextText);
  switch (category) {
    case 'tech_code':
      return 'tech_cyber';
    case 'gaming_hud':
      return 'gaming_neon';
    case 'culinary_kitchen':
      return 'culinary_warm';
    case 'finance_growth':
      return 'finance_emerald';
    case 'travel_globe':
      return 'travel_ocean';
    case 'science_atom':
      return 'education_violet';
    case 'creator_studio':
      return 'creator_magenta';
    default:
      return 'default';
  }
}

function getMoodPaletteOffset(mood: ContextMood): number {
  switch (mood) {
    case 'culinary_warm':
      return 1; // Starts on warm amber/tangerine
    case 'finance_emerald':
      return 2; // Emerald jade
    case 'travel_ocean':
      return 3; // Azure sky
    case 'creator_magenta':
      return 4; // Vivid plum berry / rose
    case 'gaming_neon':
      return 4; // High-energy magenta/cyan neon
    case 'tech_cyber':
      return 0; // Sapphire/cyber + dynamic shift per slide below
    case 'education_violet':
      return 5; // Sage mint / pastel
    default:
      return 0;
  }
}

/**
 * Selects a distinct palette family based on the user's selected theme (`modern_tech`,
 * `corporate`, or `minimal`), shifts palette energy to fit domain mood, and cycles
 * contrasting light/dark tones cleanly per slide index.
 */
export function resolveSlidePalette(
  slideIndex: number,
  _layout: SlideLayout,
  baseTheme: Required<ThemeConfig>,
  hasBackgroundImage: boolean = false,
  contextText: string = ''
): SlidePalette {
  const preset = resolveThemePreset(baseTheme);
  const family =
    preset === 'corporate'
      ? CORPORATE_PALETTES
      : preset === 'minimal'
      ? MINIMAL_PALETTES
      : SLIDE_PALETTES;

  const mood = resolveContextMood(contextText);
  // Keep neutral/generic headings anchored at offset 0 for deterministic baseline defaults;
  // domain-rich contexts (except neutral tech tests with "Architecture Overview") shift palettes cleanly.
  const isNeutralTestHeading = /\b(architecture overview|strategic growth architecture)\b/i.test(contextText);
  const moodOffset = isNeutralTestHeading ? 0 : getMoodPaletteOffset(mood);

  const safeIndex = Math.max(0, (Math.floor(slideIndex) || 1) - 1);
  const baseChosen = family[(safeIndex + moodOffset) % family.length];

  // For vibrant cyber-tech or neon gaming domains in modern_tech, inject electric dual highlights
  const chosen =
    !isNeutralTestHeading &&
    preset === 'modern_tech' &&
    mood === 'gaming_neon' &&
    safeIndex === 0
      ? {
          ...baseChosen,
          primaryColor: '#22D3EE',
          secondaryColor: '#F472B6',
          backgroundImage:
            'radial-gradient(circle at 80% 16%, rgba(34, 211, 238, 0.42) 0%, transparent 48%), radial-gradient(circle at 18% 82%, rgba(244, 114, 182, 0.36) 0%, transparent 50%)',
        }
      : !isNeutralTestHeading &&
        preset === 'modern_tech' &&
        mood === 'tech_cyber' &&
        safeIndex === 0
      ? {
          ...baseChosen,
          primaryColor: '#22D3EE',
          secondaryColor: '#A855F7',
          backgroundImage:
            'radial-gradient(circle at 84% 18%, rgba(34, 211, 238, 0.40) 0%, transparent 46%), radial-gradient(circle at 16% 84%, rgba(168, 85, 247, 0.32) 0%, transparent 48%), linear-gradient(135deg, rgba(19, 43, 99, 0.96) 0%, rgba(15, 23, 42, 0.98) 100%)',
        }
      : baseChosen;

  const primaryLower = (baseTheme.primaryColor || DEFAULT_THEME.primaryColor).toLowerCase();
  const bgLower = (baseTheme.backgroundColor || DEFAULT_THEME.backgroundColor).toLowerCase();
  const textLower = (baseTheme.textColor || DEFAULT_THEME.textColor).toLowerCase();

  const hasCustomPrimary = !BUILTIN_PRESET_PRIMARY_COLORS.has(primaryLower);
  const hasCustomBg = !BUILTIN_PRESET_BG_COLORS.has(bgLower);
  const hasCustomText =
    textLower !== '#f8fafc' &&
    textLower !== '#ffffff' &&
    textLower !== '#faf7f2' &&
    textLower !== '#1f2937' &&
    textLower !== '#18181b' &&
    textLower !== '#fafafa';

  // When stock photography overlays a tinted duotone scrim, keep typography luminous & crisp
  if (hasBackgroundImage) {
    return {
      ...chosen,
      isLight: false,
      backgroundColor: hasCustomBg ? baseTheme.backgroundColor : '#0B162C',
      surfaceBg: 'rgba(11, 22, 44, 0.64)',
      surfaceAltBg: 'rgba(15, 23, 42, 0.78)',
      surfaceBorder: 'rgba(255, 255, 255, 0.28)',
      primaryColor: hasCustomPrimary ? baseTheme.primaryColor : chosen.primaryColor,
      textColor: '#F8FAFC',
      mutedTextColor: '#E2E8F0',
      chromeMutedColor: '#CBD5E1',
    };
  }

  return {
    ...chosen,
    backgroundColor: hasCustomBg ? baseTheme.backgroundColor : chosen.backgroundColor,
    primaryColor: hasCustomPrimary ? baseTheme.primaryColor : chosen.primaryColor,
    textColor: hasCustomText ? baseTheme.textColor : chosen.textColor,
  };
}

/**
 * Deterministically assigns a structural visual archetype for each slide layout.
 */
export function resolveVisualVariant(slide: SlideData): VisualVariant {
  const idx = Math.max(1, Math.floor(slide.slide_index) || 1);
  const headingLower = (slide.heading || '').toLowerCase();

  switch (slide.layout) {
    case 'title_intro':
      return 'orbital_hero';

    case 'bullet_list': {
      if (
        headingLower.includes('quy trình') ||
        headingLower.includes('bước') ||
        headingLower.includes('workflow') ||
        headingLower.includes('pipeline') ||
        headingLower.includes('process')
      ) {
        return 'process_pipeline';
      }
      if (
        headingLower.includes('kiến trúc') ||
        headingLower.includes('mạng') ||
        headingLower.includes('hệ sinh thái') ||
        headingLower.includes('ecosystem') ||
        headingLower.includes('architecture')
      ) {
        return 'knowledge_graph';
      }
      const cycle: VisualVariant[] = ['process_pipeline', 'knowledge_graph', 'bento_mosaic'];
      return cycle[idx % cycle.length];
    }

    case 'split_card': {
      if (
        headingLower.includes('lộ trình') ||
        headingLower.includes('tương lai') ||
        headingLower.includes('roadmap') ||
        headingLower.includes('phase')
      ) {
        return 'milestone_roadmap';
      }
      if (
        headingLower.includes('so sánh') ||
        headingLower.includes('hiệu năng') ||
        headingLower.includes('tối ưu') ||
        headingLower.includes('metric') ||
        headingLower.includes('benchmark')
      ) {
        return 'compare_bars';
      }
      const cycle: VisualVariant[] = ['stacked_layers', 'compare_bars', 'milestone_roadmap'];
      return cycle[idx % cycle.length];
    }

    case 'quote_highlight':
      return idx % 2 === 0 ? 'focus_callout' : 'quote_radar';

    case 'conclusion_cta':
      return 'conclusion_launch';

    default:
      return 'bento_mosaic';
  }
}
