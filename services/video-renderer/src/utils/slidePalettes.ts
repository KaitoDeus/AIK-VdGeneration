/**
 * Per-Slide Visual Palettes and Visual Archetype Resolvers (NotebookLM-Inspired).
 * Alternates curated dark studio surfaces and bright warm paper/editorial palettes
 * alongside distinct procedural infographic archetypes per slide.
 */

import { SlideData, SlideLayout, ThemeConfig } from '../types';
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

export const SLIDE_PALETTES: readonly SlidePalette[] = [
  {
    id: 'sapphire_studio',
    name: 'Sapphire Studio',
    isLight: false,
    backgroundColor: '#0B1220',
    backgroundImage:
      'radial-gradient(circle at 82% 18%, rgba(56, 189, 248, 0.24) 0%, transparent 48%), radial-gradient(circle at 14% 84%, rgba(99, 102, 241, 0.22) 0%, transparent 50%)',
    surfaceBg: 'rgba(255, 255, 255, 0.06)',
    surfaceAltBg: 'rgba(56, 189, 248, 0.11)',
    surfaceBorder: 'rgba(148, 163, 184, 0.22)',
    primaryColor: '#38BDF8',
    secondaryColor: '#818CF8',
    accentSoft: 'rgba(56, 189, 248, 0.18)',
    textColor: '#F8FAFC',
    mutedTextColor: '#94A3B8',
    badgeTextColor: '#0F172A',
    chromeMutedColor: '#94A3B8',
  },
  {
    id: 'warm_editorial_paper',
    name: 'Warm Editorial Paper',
    isLight: true,
    backgroundColor: '#FAF6EE',
    backgroundImage:
      'radial-gradient(circle at 88% 14%, rgba(234, 88, 12, 0.14) 0%, transparent 46%), radial-gradient(circle at 10% 88%, rgba(29, 78, 216, 0.10) 0%, transparent 48%)',
    surfaceBg: '#FFFFFF',
    surfaceAltBg: '#FFF4E6',
    surfaceBorder: 'rgba(20, 24, 36, 0.14)',
    primaryColor: '#EA580C',
    secondaryColor: '#1D4ED8',
    accentSoft: 'rgba(234, 88, 12, 0.14)',
    textColor: '#141824',
    mutedTextColor: '#475569',
    badgeTextColor: '#FFFFFF',
    chromeMutedColor: '#475569',
  },
  {
    id: 'emerald_forest',
    name: 'Emerald Forest',
    isLight: false,
    backgroundColor: '#06211B',
    backgroundImage:
      'radial-gradient(circle at 84% 20%, rgba(16, 185, 129, 0.24) 0%, transparent 48%), radial-gradient(circle at 18% 82%, rgba(251, 191, 36, 0.16) 0%, transparent 48%)',
    surfaceBg: 'rgba(236, 253, 245, 0.06)',
    surfaceAltBg: 'rgba(16, 185, 129, 0.14)',
    surfaceBorder: 'rgba(52, 211, 153, 0.24)',
    primaryColor: '#34D399',
    secondaryColor: '#FBBF24',
    accentSoft: 'rgba(52, 211, 153, 0.18)',
    textColor: '#F0FDF4',
    mutedTextColor: '#A7F3D0',
    badgeTextColor: '#052E16',
    chromeMutedColor: '#A7F3D0',
  },
  {
    id: 'cobalt_porcelain',
    name: 'Cobalt Porcelain',
    isLight: true,
    backgroundColor: '#F2F6FC',
    backgroundImage:
      'radial-gradient(circle at 86% 18%, rgba(37, 99, 235, 0.15) 0%, transparent 46%), radial-gradient(circle at 12% 84%, rgba(124, 58, 237, 0.12) 0%, transparent 48%)',
    surfaceBg: '#FFFFFF',
    surfaceAltBg: '#EBF2FE',
    surfaceBorder: 'rgba(37, 99, 235, 0.18)',
    primaryColor: '#2563EB',
    secondaryColor: '#7C3AED',
    accentSoft: 'rgba(37, 99, 235, 0.14)',
    textColor: '#0F172A',
    mutedTextColor: '#475569',
    badgeTextColor: '#FFFFFF',
    chromeMutedColor: '#475569',
  },
  {
    id: 'aubergine_spark',
    name: 'Aubergine Spark',
    isLight: false,
    backgroundColor: '#1B102E',
    backgroundImage:
      'radial-gradient(circle at 85% 18%, rgba(244, 63, 94, 0.24) 0%, transparent 46%), radial-gradient(circle at 16% 84%, rgba(245, 158, 11, 0.18) 0%, transparent 48%)',
    surfaceBg: 'rgba(255, 255, 255, 0.06)',
    surfaceAltBg: 'rgba(244, 63, 94, 0.14)',
    surfaceBorder: 'rgba(251, 113, 133, 0.25)',
    primaryColor: '#FB7185',
    secondaryColor: '#F59E0B',
    accentSoft: 'rgba(251, 113, 133, 0.18)',
    textColor: '#FFF1F2',
    mutedTextColor: '#E2D4F0',
    badgeTextColor: '#1B102E',
    chromeMutedColor: '#D8B4FE',
  },
  {
    id: 'sage_botanical',
    name: 'Sage Botanical',
    isLight: true,
    backgroundColor: '#EEF5EE',
    backgroundImage:
      'radial-gradient(circle at 84% 16%, rgba(13, 148, 136, 0.16) 0%, transparent 46%), radial-gradient(circle at 15% 86%, rgba(217, 119, 6, 0.12) 0%, transparent 46%)',
    surfaceBg: '#FFFFFF',
    surfaceAltBg: '#E0F2EE',
    surfaceBorder: 'rgba(15, 118, 110, 0.20)',
    primaryColor: '#0F766E',
    secondaryColor: '#D97706',
    accentSoft: 'rgba(15, 118, 110, 0.14)',
    textColor: '#11221C',
    mutedTextColor: '#3B5249',
    badgeTextColor: '#FFFFFF',
    chromeMutedColor: '#3B5249',
  },
  {
    id: 'obsidian_amber',
    name: 'Obsidian Amber',
    isLight: false,
    backgroundColor: '#161412',
    backgroundImage:
      'radial-gradient(circle at 86% 18%, rgba(245, 158, 11, 0.22) 0%, transparent 46%), radial-gradient(circle at 14% 85%, rgba(6, 182, 212, 0.18) 0%, transparent 46%)',
    surfaceBg: 'rgba(255, 250, 240, 0.06)',
    surfaceAltBg: 'rgba(245, 158, 11, 0.14)',
    surfaceBorder: 'rgba(251, 191, 36, 0.24)',
    primaryColor: '#F59E0B',
    secondaryColor: '#22D3EE',
    accentSoft: 'rgba(245, 158, 11, 0.18)',
    textColor: '#FFFBEB',
    mutedTextColor: '#D6CFC7',
    badgeTextColor: '#161412',
    chromeMutedColor: '#D6CFC7',
  },
  {
    id: 'blush_sand_studio',
    name: 'Blush Sand Studio',
    isLight: true,
    backgroundColor: '#FDF4F0',
    backgroundImage:
      'radial-gradient(circle at 86% 16%, rgba(225, 29, 72, 0.14) 0%, transparent 46%), radial-gradient(circle at 14% 84%, rgba(79, 70, 229, 0.11) 0%, transparent 46%)',
    surfaceBg: '#FFFFFF',
    surfaceAltBg: '#FFE4E6',
    surfaceBorder: 'rgba(190, 18, 60, 0.18)',
    primaryColor: '#E11D48',
    secondaryColor: '#4F46E5',
    accentSoft: 'rgba(225, 29, 72, 0.13)',
    textColor: '#1F1317',
    mutedTextColor: '#5B454B',
    badgeTextColor: '#FFFFFF',
    chromeMutedColor: '#5B454B',
  },
];

/**
 * Selects a visually distinct palette per slide index while honoring explicit custom
 * caller theme overrides (or darkening text contrast when a stock backdrop is rendered).
 */
export function resolveSlidePalette(
  slideIndex: number,
  _layout: SlideLayout,
  baseTheme: Required<ThemeConfig>,
  hasBackgroundImage: boolean = false
): SlidePalette {
  const safeIndex = Math.max(0, (Math.floor(slideIndex) || 1) - 1);
  const chosen = SLIDE_PALETTES[safeIndex % SLIDE_PALETTES.length];

  const hasCustomPrimary =
    baseTheme.primaryColor.toLowerCase() !== DEFAULT_THEME.primaryColor.toLowerCase();
  const hasCustomBg =
    baseTheme.backgroundColor.toLowerCase() !== DEFAULT_THEME.backgroundColor.toLowerCase();
  const hasCustomText =
    baseTheme.textColor.toLowerCase() !== DEFAULT_THEME.textColor.toLowerCase();

  // When stock photography overlays a dark contrast scrim, keep typography crisp & luminous
  if (hasBackgroundImage) {
    return {
      ...chosen,
      isLight: false,
      backgroundColor: hasCustomBg ? baseTheme.backgroundColor : '#0B1220',
      surfaceBg: 'rgba(15, 23, 42, 0.66)',
      surfaceAltBg: 'rgba(15, 23, 42, 0.80)',
      surfaceBorder: 'rgba(255, 255, 255, 0.20)',
      primaryColor: hasCustomPrimary ? baseTheme.primaryColor : chosen.primaryColor,
      textColor: '#F8FAFC',
      mutedTextColor: '#CBD5E1',
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
 * Deterministically assigns a rich procedural visual archetype for the slide layout
 * so repeated layouts across a multi-slide deck never render with identical structure.
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
