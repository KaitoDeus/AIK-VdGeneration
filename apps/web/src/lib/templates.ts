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
];

export const DEFAULT_VOICES: VoiceOption[] = [
  {
    voice_id: 'vi-VN-HoaiMyNeural',
    label: 'Hoài My (Northern Female)',
    language: 'vi',
    provider: 'edge_tts',
    gender: 'female',
    sample_text: 'Xin chào, đây là giọng đọc AI tiếng Việt tự nhiên từ AIK Studio.',
  },
  {
    voice_id: 'vi-VN-NamMinhNeural',
    label: 'Nam Minh (Northern Male)',
    language: 'vi',
    provider: 'edge_tts',
    gender: 'male',
    sample_text: 'Chào mừng bạn đến với nền tảng tạo video thuyết trình tự động.',
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
