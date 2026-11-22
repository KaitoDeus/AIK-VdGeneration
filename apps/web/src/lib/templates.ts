import { PromptTemplate, SlideLayout, VisualTheme, VoiceOption } from '@/types/studio';

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'tech-explainer',
    label: 'TECH EXPLAINER',
    category: 'Architecture',
    language: 'en',
    theme: 'modern_tech',
    duration: 60,
    prompt:
      'Explain Event-Driven Microservices Architecture and how asynchronous message queues prevent system bottlenecks.',
  },
  {
    id: 'educational',
    label: 'EDUCATIONAL',
    category: 'Foundations',
    language: 'vi',
    theme: 'minimal',
    duration: 60,
    prompt:
      'Giải thích nguyên lý hoạt động của Điện toán Đám mây (Cloud Computing) và ba mô hình IaaS, PaaS, SaaS cho người mới bắt đầu.',
  },
  {
    id: 'pitch-deck',
    label: 'PITCH DECK',
    category: 'Venture',
    language: 'en',
    theme: 'corporate',
    duration: 45,
    prompt:
      'Investor pitch presentation for an AI-powered automated video production SaaS targeting global creators and B2B marketing teams.',
  },
  {
    id: 'marketing',
    label: 'MARKETING',
    category: 'Product Launch',
    language: 'vi',
    theme: 'modern_tech',
    duration: 45,
    prompt:
      'Giới thiệu nền tảng tự động biến văn bản thành video thuyết trình song ngữ Anh - Việt trong 60 giây với chất lượng phòng thu.',
  },
  {
    id: 'shorts-vi',
    label: 'SHORT DỌC 30S',
    category: 'Reels / Shorts',
    language: 'vi',
    theme: 'modern_tech',
    duration: 30,
    aspectRatio: '9:16',
    videoFormat: 'short',
    targetSlides: 4,
    enableSubtitles: true,
    enableBgm: true,
    voiceSpeed: 1.1,
    prompt:
      '3 bí quyết giúp AI tự động dựng video Short 9:16 cuốn hút từ văn bản thô chỉ trong 30 giây.',
  },
  {
    id: 'shorts-en',
    label: 'SHORTS HOOK 30S',
    category: 'TikTok / Shorts',
    language: 'en',
    theme: 'modern_tech',
    duration: 30,
    aspectRatio: '9:16',
    videoFormat: 'short',
    targetSlides: 4,
    enableSubtitles: true,
    enableBgm: true,
    voiceSpeed: 1.1,
    prompt:
      '3 reasons why automated AI vertical shorts convert viewers faster on TikTok and YouTube Shorts.',
  },
];

export const DEFAULT_VOICES: VoiceOption[] = [
  {
    voice_id: 'vi-VN-HoaiMyNeural',
    label: 'Hoài My (Nữ Miền Bắc · Tự Nhiên)',
    language: 'vi',
    provider: 'edge_tts',
    gender: 'female',
    sample_text: 'Xin chào, đây là giọng đọc AI tiếng Việt tự nhiên từ AIK Studio.',
  },
  {
    voice_id: 'vi-VN-NamMinhNeural',
    label: 'Nam Minh (Nam Miền Bắc · Trầm Ấm)',
    language: 'vi',
    provider: 'edge_tts',
    gender: 'male',
    sample_text: 'Chào mừng bạn đến với nền tảng tạo video thuyết trình tự động.',
  },
  {
    voice_id: 'vi-VN-GoogleVi',
    label: 'Thuần Việt Chuẩn (Nữ · Google TTS)',
    language: 'vi',
    provider: 'google_vi',
    gender: 'female',
    sample_text: 'Xin chào, đây là giọng đọc thuần Việt rõ chữ, chuẩn nhịp cho video ngắn.',
  },
  {
    voice_id: 'en-US-GuyNeural',
    label: 'Guy (US Natural Male)',
    language: 'en',
    provider: 'edge_tts',
    gender: 'male',
    sample_text: 'Welcome to AIK Studio. Transform any prompt into a synchronized presentation video.',
  },
  {
    voice_id: 'en-US-JennyNeural',
    label: 'Jenny (US Expressive Female)',
    language: 'en',
    provider: 'edge_tts',
    gender: 'female',
    sample_text: 'Audio drives the timeline with precision frame synchronization.',
  },
  {
    voice_id: 'en-US-AndrewMultilingualNeural',
    label: 'Andrew HD (US Warm Multilingual Male)',
    language: 'en',
    provider: 'edge_tts',
    gender: 'male',
    sample_text: 'Welcome to AIK Studio. Every slide stays synchronized with crystal-clear narration.',
  },
  {
    voice_id: 'en-US-AvaMultilingualNeural',
    label: 'Ava HD (US Expressive Multilingual Female)',
    language: 'en',
    provider: 'edge_tts',
    gender: 'female',
    sample_text: 'Discover smooth storytelling powered by studio-grade neural narration.',
  },
  {
    voice_id: '21m00Tcm4TlvDq8ikWAM',
    label: 'Rachel (ElevenLabs Multilingual)',
    language: 'en',
    provider: 'elevenlabs',
    gender: 'female',
    sample_text: 'Studio grade emotional voiceover powered by ElevenLabs Multilingual v2.',
  },
];

export const SLIDE_LAYOUT_LABELS: Record<SlideLayout, string> = {
  title_intro: 'TITLE INTRO',
  bullet_list: 'BULLET LIST',
  split_card: 'SPLIT CARD',
  quote_highlight: 'QUOTE HIGHLIGHT',
  conclusion_cta: 'CONCLUSION CTA',
};

export const THEME_OPTIONS: { id: VisualTheme; label: string; swatch: string }[] = [
  { id: 'modern_tech', label: 'MODERN TECH', swatch: '#132B63' },
  { id: 'corporate', label: 'CORPORATE', swatch: '#8B2635' },
  { id: 'minimal', label: 'MINIMAL', swatch: '#EA580C' },
];

export interface WebThemeVisualStyle {
  preset: VisualTheme;
  headingFont: string;
  bodyFont: string;
  headingWeight: number;
  topBarHeight: string;
  accentStripeWidth: string;
}

export function resolveWebThemeStyle(theme: VisualTheme = 'modern_tech'): WebThemeVisualStyle {
  if (theme === 'corporate') {
    return {
      preset: 'corporate',
      headingFont: 'Georgia, "Times New Roman", "Noto Serif", serif',
      bodyFont: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
      headingWeight: 700,
      topBarHeight: '3px',
      accentStripeWidth: '3px',
    };
  }
  if (theme === 'minimal') {
    return {
      preset: 'minimal',
      headingFont: '"Helvetica Neue", "Segoe UI", Arial, sans-serif',
      bodyFont: '"Helvetica Neue", "Segoe UI", Arial, sans-serif',
      headingWeight: 500,
      topBarHeight: '0px',
      accentStripeWidth: '0px',
    };
  }
  return {
    preset: 'modern_tech',
    headingFont: '"Plus Jakarta Sans", "Inter", "Segoe UI", system-ui, sans-serif',
    bodyFont: '"Inter", "Segoe UI", system-ui, sans-serif',
    headingWeight: 800,
    topBarHeight: '6px',
    accentStripeWidth: '4px',
  };
}

export type WebVisualVariant =
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

export interface WebSlidePalette {
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
  textColor: string;
  mutedTextColor: string;
  badgeTextColor: string;
}

export const WEB_MODERN_TECH_PALETTES: readonly WebSlidePalette[] = [
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
    textColor: '#FFFFFF',
    mutedTextColor: '#DBEAFE',
    badgeTextColor: '#0F172A',
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
    textColor: '#1C1917',
    mutedTextColor: '#57534E',
    badgeTextColor: '#FFFFFF',
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
    textColor: '#F0FDF4',
    mutedTextColor: '#A7F3D0',
    badgeTextColor: '#052E16',
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
    textColor: '#0F172A',
    mutedTextColor: '#475569',
    badgeTextColor: '#FFFFFF',
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
    textColor: '#FFF1F2',
    mutedTextColor: '#F3E8FF',
    badgeTextColor: '#1B102E',
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
    textColor: '#064E3B',
    mutedTextColor: '#374151',
    badgeTextColor: '#FFFFFF',
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
    textColor: '#FFFBEB',
    mutedTextColor: '#FDE68A',
    badgeTextColor: '#1C1917',
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
    textColor: '#1F1317',
    mutedTextColor: '#5B454B',
    badgeTextColor: '#FFFFFF',
  },
];

export const WEB_CORPORATE_PALETTES: readonly WebSlidePalette[] = [
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
    textColor: '#F8FAFC',
    mutedTextColor: '#CBD5E1',
    badgeTextColor: '#102A43',
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
    textColor: '#1E293B',
    mutedTextColor: '#475569',
    badgeTextColor: '#FFFFFF',
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
    textColor: '#F9FAFB',
    mutedTextColor: '#CBD5E1',
    badgeTextColor: '#173B34',
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
    textColor: '#0F172A',
    mutedTextColor: '#475569',
    badgeTextColor: '#FFFFFF',
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
    textColor: '#FFF8F6',
    mutedTextColor: '#F5D0FE',
    badgeTextColor: '#4A192C',
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
    textColor: '#1C1917',
    mutedTextColor: '#57534E',
    badgeTextColor: '#FFFFFF',
  },
];

export const WEB_MINIMAL_PALETTES: readonly WebSlidePalette[] = [
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
    textColor: '#292524',
    mutedTextColor: '#57534E',
    badgeTextColor: '#FFFFFF',
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
    textColor: '#111827',
    mutedTextColor: '#4B5563',
    badgeTextColor: '#FFFFFF',
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
    textColor: '#0F172A',
    mutedTextColor: '#475569',
    badgeTextColor: '#FFFFFF',
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
    textColor: '#1F2937',
    mutedTextColor: '#4B5563',
    badgeTextColor: '#FFFFFF',
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
    textColor: '#1C1917',
    mutedTextColor: '#57534E',
    badgeTextColor: '#FFFFFF',
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
    textColor: '#1F1218',
    mutedTextColor: '#5B454F',
    badgeTextColor: '#FFFFFF',
  },
];

export const WEB_SLIDE_PALETTES = WEB_MODERN_TECH_PALETTES;

export function resolveWebSlidePalette(
  slideIndex: number,
  hasBackgroundImage: boolean = false,
  theme: VisualTheme = 'modern_tech'
): WebSlidePalette {
  const family =
    theme === 'corporate'
      ? WEB_CORPORATE_PALETTES
      : theme === 'minimal'
      ? WEB_MINIMAL_PALETTES
      : WEB_MODERN_TECH_PALETTES;
  const idx = Math.max(0, (Math.floor(slideIndex) || 1) - 1);
  const chosen = family[idx % family.length];
  if (hasBackgroundImage) {
    return {
      ...chosen,
      isLight: false,
      backgroundColor: '#0B1220',
      surfaceBg: 'rgba(15, 23, 42, 0.66)',
      surfaceAltBg: 'rgba(15, 23, 42, 0.80)',
      surfaceBorder: 'rgba(255, 255, 255, 0.20)',
      textColor: '#F8FAFC',
      mutedTextColor: '#CBD5E1',
    };
  }
  return chosen;
}

export function resolveWebVisualVariant(
  slideIndex: number,
  layout: SlideLayout,
  heading: string = ''
): WebVisualVariant {
  const idx = Math.max(1, Math.floor(slideIndex) || 1);
  const lower = heading.toLowerCase();

  switch (layout) {
    case 'title_intro':
      return 'orbital_hero';
    case 'bullet_list': {
      if (lower.includes('quy trình') || lower.includes('workflow') || lower.includes('pipeline')) {
        return 'process_pipeline';
      }
      if (lower.includes('kiến trúc') || lower.includes('architecture') || lower.includes('ecosystem')) {
        return 'knowledge_graph';
      }
      const cycle: WebVisualVariant[] = ['process_pipeline', 'knowledge_graph', 'bento_mosaic'];
      return cycle[idx % cycle.length];
    }
    case 'split_card': {
      if (lower.includes('lộ trình') || lower.includes('roadmap') || lower.includes('phase')) {
        return 'milestone_roadmap';
      }
      if (lower.includes('so sánh') || lower.includes('metric') || lower.includes('hiệu năng')) {
        return 'compare_bars';
      }
      const cycle: WebVisualVariant[] = ['stacked_layers', 'compare_bars', 'milestone_roadmap'];
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
