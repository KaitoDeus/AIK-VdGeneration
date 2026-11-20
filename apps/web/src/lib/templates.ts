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
  { id: 'modern_tech', label: 'MODERN TECH', swatch: '#0F172A' },
  { id: 'corporate', label: 'CORPORATE', swatch: '#1E293B' },
  { id: 'minimal', label: 'MINIMAL', swatch: '#18181B' },
];

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

export const WEB_SLIDE_PALETTES: readonly WebSlidePalette[] = [
  {
    id: 'sapphire_studio',
    name: 'Sapphire Studio',
    isLight: false,
    backgroundColor: '#0B1220',
    backgroundImage:
      'radial-gradient(circle at 82% 18%, rgba(56, 189, 248, 0.24) 0%, transparent 48%), radial-gradient(circle at 14% 84%, rgba(99, 102, 241, 0.22) 0%, transparent 50%)',
    surfaceBg: 'rgba(255, 255, 255, 0.06)',
    surfaceAltBg: 'rgba(56, 189, 248, 0.11)',
    surfaceBorder: 'rgba(148, 163, 184, 0.24)',
    primaryColor: '#38BDF8',
    secondaryColor: '#818CF8',
    textColor: '#F8FAFC',
    mutedTextColor: '#94A3B8',
    badgeTextColor: '#0F172A',
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
    surfaceBorder: 'rgba(20, 24, 36, 0.16)',
    primaryColor: '#EA580C',
    secondaryColor: '#1D4ED8',
    textColor: '#141824',
    mutedTextColor: '#475569',
    badgeTextColor: '#FFFFFF',
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
    textColor: '#F0FDF4',
    mutedTextColor: '#A7F3D0',
    badgeTextColor: '#052E16',
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
    surfaceBorder: 'rgba(37, 99, 235, 0.20)',
    primaryColor: '#2563EB',
    secondaryColor: '#7C3AED',
    textColor: '#0F172A',
    mutedTextColor: '#475569',
    badgeTextColor: '#FFFFFF',
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
    surfaceBorder: 'rgba(251, 113, 133, 0.26)',
    primaryColor: '#FB7185',
    secondaryColor: '#F59E0B',
    textColor: '#FFF1F2',
    mutedTextColor: '#E2D4F0',
    badgeTextColor: '#1B102E',
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
    textColor: '#11221C',
    mutedTextColor: '#3B5249',
    badgeTextColor: '#FFFFFF',
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
    textColor: '#FFFBEB',
    mutedTextColor: '#D6CFC7',
    badgeTextColor: '#161412',
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
    textColor: '#1F1317',
    mutedTextColor: '#5B454B',
    badgeTextColor: '#FFFFFF',
  },
];

export function resolveWebSlidePalette(
  slideIndex: number,
  hasBackgroundImage: boolean = false
): WebSlidePalette {
  const idx = Math.max(0, (Math.floor(slideIndex) || 1) - 1);
  const chosen = WEB_SLIDE_PALETTES[idx % WEB_SLIDE_PALETTES.length];
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
