'use client';

import React from 'react';
import { UkFlagIcon, VietnamFlagIcon } from '@/components/FlagIcons';
import { STUDIO_DICTIONARY, UiLocale } from '@/lib/i18n';
import { PROMPT_TEMPLATES, THEME_OPTIONS } from '@/lib/templates';
import {
  AspectRatio,
  PromptTemplate,
  SupportedLanguage,
  TTSProviderType,
  VisualTheme,
  VoiceOption,
} from '@/types/studio';

export interface StudioFormState {
  prompt: string;
  language: SupportedLanguage;
  aspectRatio: AspectRatio;
  targetDuration: number;
  theme: VisualTheme;
  voiceProvider: TTSProviderType;
  voiceId: string;
  renderVideo: boolean;
}

interface PromptStudioFormProps {
  locale: UiLocale;
  formState: StudioFormState;
  voices: VoiceOption[];
  isSubmitting: boolean;
  isAuditioning: boolean;
  auditionAudioUrl: string | null;
  validationError: string | null;
  onChange: (patch: Partial<StudioFormState>) => void;
  onApplyTemplate: (template: PromptTemplate) => void;
  onAuditionVoice: () => void;
  onDraftScript: () => void;
  onGeneratePipeline: () => void;
}

export const PromptStudioForm: React.FC<PromptStudioFormProps> = ({
  locale,
  formState,
  voices,
  isSubmitting,
  isAuditioning,
  auditionAudioUrl,
  validationError,
  onChange,
  onApplyTemplate,
  onAuditionVoice,
  onDraftScript,
  onGeneratePipeline,
}) => {
  const t = STUDIO_DICTIONARY[locale].form;
  const filteredVoices = voices.filter(
    (v) => v.language === formState.language || v.provider === 'elevenlabs'
  );

  return (
    <section
      id="studio"
      aria-labelledby="studio-heading"
      className="border border-[#E5E5E5] bg-[#FFFFFF]"
    >
      {/* Panel Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E5E5E5] px-8 py-6 md:flex-row md:items-center">
        <div>
          <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#71717A]">
            {t.sectionEyebrow}
          </span>
          <h2 id="studio-heading" className="mt-1 text-[20px] font-semibold leading-[1.3] text-[#0A0A0A]">
            {t.sectionTitle}
          </h2>
        </div>

        {/* Quick Prompt Template Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-[12px] uppercase tracking-[0.05em] text-[#71717A]">
            {t.templatesLabel}
          </span>
          {PROMPT_TEMPLATES.map((tpl) => {
            const isSelected = formState.prompt.trim() === tpl.prompt.trim();
            const label =
              t.templateNames[tpl.id as keyof typeof t.templateNames] || tpl.label;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onApplyTemplate(tpl)}
                className={`h-7 border px-3 text-[12px] uppercase tracking-[0.05em] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A] ${
                  isSelected
                    ? 'border-[#0A0A0A] bg-[#0A0A0A] text-[#FAFAFA]'
                    : 'border-[#D4D4D8] bg-transparent text-[#71717A] hover:border-[#A1A1AA] hover:bg-[#F4F4F5] hover:text-[#0A0A0A]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Prompt Textarea */}
      <div className="border-b border-[#E5E5E5] p-8">
        <label
          htmlFor="prompt-input"
          className="mb-3 block text-[12px] font-semibold uppercase tracking-[0.08em] text-[#0A0A0A]"
        >
          {t.promptLabel}
        </label>
        <textarea
          id="prompt-input"
          rows={4}
          value={formState.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          placeholder={t.promptPlaceholder}
          className={`w-full resize-y border bg-[#FFFFFF] p-4 text-[14px] leading-[1.6] text-[#0A0A0A] placeholder:text-[#A1A1AA] focus:border-2 focus:border-[#0A0A0A] focus:outline-none ${
            validationError
              ? 'border-[#DC2626]'
              : 'border-[#D4D4D8] hover:border-[#A1A1AA]'
          }`}
        />
        {validationError && (
          <p role="alert" className="mt-2 font-mono text-[12px] text-[#DC2626]">
            {validationError}
          </p>
        )}
      </div>

      {/* Strict 4-Column Geometric Parameter Grid */}
      <div className="grid grid-cols-1 divide-y divide-[#E5E5E5] border-b border-[#E5E5E5] md:grid-cols-2 md:divide-x md:divide-y-0 lg:grid-cols-4">
        {/* Column 1: Language */}
        <div className="p-6">
          <span className="mb-3 block text-[12px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
            {t.languageLabel}
          </span>
          <div className="flex gap-2">
            {(['vi', 'en'] as SupportedLanguage[]).map((lang) => {
              const active = formState.language === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => {
                    const defaultVoice =
                      lang === 'vi' ? 'vi-VN-HoaiMyNeural' : 'en-US-GuyNeural';
                    onChange({
                      language: lang,
                      voiceProvider: 'edge_tts',
                      voiceId: defaultVoice,
                    });
                  }}
                  className={`inline-flex h-8 flex-1 items-center justify-center gap-1.5 border px-2 text-[11px] uppercase tracking-[0.05em] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A] ${
                    active
                      ? 'border-[#0A0A0A] bg-[#0A0A0A] text-[#FAFAFA]'
                      : 'border-[#D4D4D8] bg-transparent text-[#71717A] hover:border-[#A1A1AA] hover:text-[#0A0A0A]'
                  }`}
                >
                  {lang === 'vi' ? <VietnamFlagIcon /> : <UkFlagIcon />}
                  <span>{lang === 'vi' ? t.languageVi : t.languageEn}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Column 2: Aspect Ratio (StudioBlank Radio Style) */}
        <div className="p-6">
          <span className="mb-3 block text-[12px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
            {t.aspectRatioLabel}
          </span>
          <div className="flex flex-col gap-2">
            {([
              { value: '16:9', label: t.aspect169 },
              { value: '9:16', label: t.aspect916 },
            ] as const).map((ratio) => {
              const selected = formState.aspectRatio === ratio.value;
              return (
                <button
                  key={ratio.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange({ aspectRatio: ratio.value })}
                  className="flex items-center gap-3 text-left text-[12px] tracking-[0.04em] text-[#0A0A0A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A]"
                >
                  <span
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center border ${
                      selected ? 'border-[#0A0A0A]' : 'border-[#D4D4D8]'
                    }`}
                  >
                    {selected && <span className="h-2 w-2 bg-[#0A0A0A]" />}
                  </span>
                  <span className={selected ? 'font-semibold' : 'text-[#71717A]'}>
                    {ratio.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Column 3: Visual Theme & Duration */}
        <div className="p-6">
          <span className="mb-3 block text-[12px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
            {t.themeDurationLabel}
          </span>
          <div className="flex flex-col gap-3">
            <select
              aria-label="Slide Visual Theme"
              value={formState.theme}
              onChange={(e) => onChange({ theme: e.target.value as VisualTheme })}
              className="h-10 w-full border border-[#D4D4D8] bg-[#FFFFFF] px-3 text-[13px] text-[#0A0A0A] hover:border-[#A1A1AA] focus:border-2 focus:border-[#0A0A0A] focus:outline-none"
            >
              {THEME_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {t.themeNames[opt.id]}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              {[30, 45, 60, 90].map((sec) => {
                const active = formState.targetDuration === sec;
                return (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => onChange({ targetDuration: sec })}
                    className={`h-7 flex-1 border font-mono text-[12px] transition-colors duration-150 ${
                      active
                        ? 'border-[#0A0A0A] bg-[#0A0A0A] text-[#FAFAFA]'
                        : 'border-[#D4D4D8] text-[#71717A] hover:border-[#A1A1AA] hover:text-[#0A0A0A]'
                    }`}
                  >
                    {sec}S
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Column 4: Narrator Voice & Audition */}
        <div className="p-6">
          <span className="mb-3 block text-[12px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
            {t.voiceLabel}
          </span>
          <div className="flex flex-col gap-3">
            <select
              aria-label="Narrator Voice Selection"
              value={formState.voiceId}
              onChange={(e) => {
                const selected = voices.find((v) => v.voice_id === e.target.value);
                onChange({
                  voiceId: e.target.value,
                  voiceProvider: selected ? selected.provider : 'edge_tts',
                });
              }}
              className="h-10 w-full border border-[#D4D4D8] bg-[#FFFFFF] px-3 text-[13px] text-[#0A0A0A] hover:border-[#A1A1AA] focus:border-2 focus:border-[#0A0A0A] focus:outline-none"
            >
              {filteredVoices.map((voice) => (
                <option key={voice.voice_id} value={voice.voice_id}>
                  {voice.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onAuditionVoice}
              disabled={isAuditioning}
              className="h-8 w-full border border-[#0A0A0A] bg-transparent px-4 text-[12px] uppercase tracking-[0.05em] text-[#0A0A0A] transition-colors duration-150 hover:bg-[#0A0A0A] hover:text-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-30"
            >
              {isAuditioning ? t.auditionLoading : t.auditionButton}
            </button>

            {auditionAudioUrl && (
              <audio
                controls
                autoPlay
                src={auditionAudioUrl}
                className="h-8 w-full"
                aria-label="Voice audition audio player"
              />
            )}
          </div>
        </div>
      </div>

      {/* Execution Action Bar */}
      <div className="flex flex-col justify-between gap-4 px-8 py-6 md:flex-row md:items-center">
        <button
          type="button"
          role="checkbox"
          aria-checked={formState.renderVideo}
          onClick={() => onChange({ renderVideo: !formState.renderVideo })}
          className="flex items-center gap-3 text-[14px] text-[#0A0A0A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A]"
        >
          <span
            className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center border text-[12px] font-bold ${
              formState.renderVideo
                ? 'border-[#0A0A0A] bg-[#0A0A0A] text-[#FAFAFA]'
                : 'border-[#D4D4D8] bg-[#FFFFFF]'
            }`}
          >
            {formState.renderVideo ? '✓' : ''}
          </span>
          <span>{t.renderImmediateCheckbox}</span>
        </button>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onDraftScript}
            className="h-12 min-w-[160px] border border-[#0A0A0A] bg-transparent px-8 text-[14px] font-medium uppercase tracking-[0.06em] text-[#0A0A0A] transition-colors duration-150 hover:bg-[#0A0A0A] hover:text-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-30"
          >
            {t.draftScriptBtn}
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onGeneratePipeline}
            className="h-12 min-w-[200px] border border-[#0A0A0A] bg-[#0A0A0A] px-8 text-[14px] font-semibold uppercase tracking-[0.06em] text-[#FAFAFA] transition-colors duration-150 hover:bg-[#FFFFFF] hover:text-[#0A0A0A] disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isSubmitting ? t.processingBtn : t.generateBtn}
          </button>
        </div>
      </div>
    </section>
  );
};
