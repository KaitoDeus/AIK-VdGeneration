'use client';

import React, { useState } from 'react';
import { getBgmPreviewUrl } from '@/lib/api';
import { STUDIO_DICTIONARY, UiLocale } from '@/lib/i18n';
import { PROMPT_TEMPLATES, THEME_OPTIONS } from '@/lib/templates';
import {
  AspectRatio,
  BGMMood,
  BGMTrackOption,
  CaptionStyle,
  PromptTemplate,
  SupportedLanguage,
  TTSProviderType,
  VideoFormatType,
  VisualTheme,
  VoiceOption,
} from '@/types/studio';

export interface StudioFormState {
  prompt: string;
  language: SupportedLanguage;
  aspectRatio: AspectRatio;
  videoFormat?: VideoFormatType;
  voiceSpeed?: number;
  targetDuration: number;
  targetSlides?: number;
  theme: VisualTheme;
  voiceProvider: TTSProviderType;
  voiceId: string;
  renderVideo: boolean;
  bgmEnabled?: boolean;
  bgmMood?: BGMMood;
  bgmTrackId?: string;
  bgmDuckingEnabled?: boolean;
  subtitlesEnabled?: boolean;
  subtitleStyle?: CaptionStyle;
}

interface PromptStudioFormProps {
  locale: UiLocale;
  formState: StudioFormState;
  voices: VoiceOption[];
  bgmTracks?: BGMTrackOption[];
  isSubmitting: boolean;
  isAuditioning: boolean;
  auditionAudioUrl: string | null;
  validationError: string | null;
  onChange: (patch: Partial<StudioFormState>) => void;
  onApplyTemplate: (template: PromptTemplate) => void;
  onSwitchLanguage?: (lang: SupportedLanguage) => void;
  onAuditionVoice: () => void;
  onDraftScript: () => void;
  onGeneratePipeline: () => void;
}

export const PromptStudioForm: React.FC<PromptStudioFormProps> = ({
  locale,
  formState,
  voices,
  bgmTracks = [],
  isSubmitting,
  isAuditioning,
  auditionAudioUrl,
  validationError,
  onChange,
  onApplyTemplate,
  onSwitchLanguage,
  onAuditionVoice,
  onDraftScript,
  onGeneratePipeline,
}) => {
  const t = STUDIO_DICTIONARY[locale].form;
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const isShortMode = formState.videoFormat === 'short' || formState.aspectRatio === '9:16';
  const activeVoiceSpeed = formState.voiceSpeed ?? 1.0;
  const hasVietnameseDiacritics =
    /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
      formState.prompt
    );
  const showLanguageMismatchBanner =
    formState.language === 'en' && hasVietnameseDiacritics;
  const filteredVoices = voices.filter((v) => v.language === formState.language);
  const activeMood: BGMMood = formState.bgmMood || 'tech';
  const moodTracks = bgmTracks.filter((tr) => tr.mood === activeMood);
  const selectedTrackId =
    formState.bgmTrackId && moodTracks.some((tr) => tr.track_id === formState.bgmTrackId)
      ? formState.bgmTrackId
      : moodTracks[0]?.track_id || `${activeMood}-${activeMood === 'inspiring' ? 'horizon' : activeMood === 'corporate' ? 'summit' : activeMood === 'relaxed' ? 'drift' : 'circuit'}`;

  return (
    <section
      id="studio"
      aria-label={t.sectionTitle}
      className="border border-[#E5E5E5] bg-[#FFFFFF]"
    >
      {/* Production Format Switcher: Standard 16:9 Presentation vs Vertical 9:16 Short Video */}
      <div
        data-testid="video-format-switcher"
        className="flex flex-col justify-between gap-3 border-b border-[#E5E5E5] bg-[#FAFAFA] px-8 py-4 lg:flex-row lg:items-center"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="mr-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
            {t.modeLabel}
          </span>
          <button
            type="button"
            data-testid="mode-presentation-btn"
            aria-pressed={!isShortMode}
            onClick={() =>
              onChange({
                videoFormat: 'presentation',
                aspectRatio: '16:9',
                targetDuration: 45,
                targetSlides: undefined,
                voiceSpeed: 1.0,
              })
            }
            className={`h-8 border px-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.05em] transition-colors duration-150 ${
              !isShortMode
                ? 'border-[#0A0A0A] bg-[#0A0A0A] text-[#FAFAFA]'
                : 'border-[#D4D4D8] bg-[#FFFFFF] text-[#71717A] hover:border-[#0A0A0A] hover:text-[#0A0A0A]'
            }`}
          >
            {t.modePresentationBtn}
          </button>
          <button
            type="button"
            data-testid="mode-short-video-btn"
            aria-pressed={isShortMode}
            onClick={() =>
              onChange({
                videoFormat: 'short',
                aspectRatio: '9:16',
                targetDuration: 30,
                targetSlides: 4,
                subtitlesEnabled: true,
                subtitleStyle: 'bold_highlight',
                bgmEnabled: true,
                bgmMood: formState.bgmMood || 'tech',
                bgmDuckingEnabled: true,
                voiceSpeed: 1.1,
              })
            }
            className={`h-8 border px-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.05em] transition-colors duration-150 ${
              isShortMode
                ? 'border-[#0A0A0A] bg-[#0A0A0A] text-[#FAFAFA]'
                : 'border-[#D4D4D8] bg-[#FFFFFF] text-[#0A0A0A] hover:border-[#0A0A0A]'
            }`}
          >
            {t.modeShortVideoBtn}
          </button>
        </div>

        {isShortMode && (
          <span
            data-testid="short-mode-badge"
            className="border border-[#0A0A0A] bg-[#FFFFFF] px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[#0A0A0A]"
          >
            {t.shortActiveSummary}
          </span>
        )}
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
        {showLanguageMismatchBanner && (
          <div
            data-testid="language-mismatch-warning"
            className="mt-3 flex flex-col justify-between gap-3 border border-[#CA8A04] bg-[#FAFAFA] px-4 py-3 sm:flex-row sm:items-center"
          >
            <span className="font-mono text-[12px] text-[#0A0A0A]">
              {t.languageMismatchNotice}
            </span>
            <button
              type="button"
              data-testid="switch-to-vi-btn"
              onClick={() => {
                if (onSwitchLanguage) {
                  onSwitchLanguage('vi');
                  return;
                }
                onChange({
                  language: 'vi',
                  voiceProvider: 'edge_tts',
                  voiceId: 'vi-VN-HoaiMyNeural',
                });
              }}
              className="h-7 shrink-0 border border-[#0A0A0A] bg-[#0A0A0A] px-3 font-mono text-[11px] uppercase tracking-[0.05em] text-[#FAFAFA] transition-colors duration-150 hover:bg-[#FFFFFF] hover:text-[#0A0A0A]"
            >
              {t.languageMismatchSwitchBtn}
            </button>
          </div>
        )}

        {/* Quick Prompt Template Suggestion Chips */}
        <div
          data-testid="quick-prompt-templates"
          className="mt-4 flex flex-wrap items-center gap-2"
        >
          <span className="mr-1 font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[#71717A]">
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
                className={`h-7 border px-3 text-[11px] uppercase tracking-[0.05em] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A] ${
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

      {/* Balanced 2-Column Geometric Parameter Grid (Aspect ratio & language are controlled by top-level switchers) */}
      <div className="grid grid-cols-1 divide-y divide-[#E5E5E5] border-b border-[#E5E5E5] md:grid-cols-2 md:divide-x md:divide-y-0">

        {/* Column 1: Visual Theme & Duration */}
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
              {(isShortMode ? [15, 30, 45, 60] : [30, 45, 60, 90]).map((sec) => {
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

            <div className="flex gap-1.5">
              {(isShortMode ? [undefined, 3, 4, 5] : [undefined, 5, 10, 15]).map((cnt) => {
                const active = formState.targetSlides === cnt;
                return (
                  <button
                    key={cnt ?? 'auto'}
                    type="button"
                    data-testid={`target-slides-${cnt ?? 'auto'}`}
                    onClick={() => onChange({ targetSlides: cnt })}
                    className={`h-7 flex-1 border font-mono text-[10px] uppercase transition-colors duration-150 ${
                      active
                        ? 'border-[#0A0A0A] bg-[#0A0A0A] text-[#FAFAFA]'
                        : 'border-[#D4D4D8] text-[#71717A] hover:border-[#A1A1AA] hover:text-[#0A0A0A]'
                    }`}
                  >
                    {cnt ? `${cnt} SL` : t.slideCountAuto}
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

            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] uppercase text-[#71717A]">
                {t.voiceSpeedLabel}:
              </span>
              {[1.0, 1.1, 1.2].map((spd) => {
                const selected = Math.abs(activeVoiceSpeed - spd) < 0.05;
                return (
                  <button
                    key={spd}
                    type="button"
                    data-testid={`voice-speed-${spd.toFixed(1)}`}
                    onClick={() => onChange({ voiceSpeed: spd })}
                    className={`h-7 flex-1 border font-mono text-[11px] transition-colors duration-150 ${
                      selected
                        ? 'border-[#0A0A0A] bg-[#0A0A0A] text-[#FAFAFA]'
                        : 'border-[#D4D4D8] text-[#71717A] hover:border-[#0A0A0A] hover:text-[#0A0A0A]'
                    }`}
                  >
                    {spd.toFixed(1)}x
                  </button>
                );
              })}
            </div>

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
                data-testid="voice-audition-player"
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

      {/* Sound Design & BGM Ducking Bar (M3.2) */}
      <div className="border-b border-[#E5E5E5] bg-[#FAFAFA] px-8 py-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#71717A]">
              {t.soundDesignLabel}
            </span>

            <button
              type="button"
              role="checkbox"
              aria-checked={Boolean(formState.bgmEnabled)}
              data-testid="bgm-enable-toggle"
              onClick={() => onChange({ bgmEnabled: !formState.bgmEnabled })}
              className="flex items-center gap-2 text-[13px] font-medium text-[#0A0A0A]"
            >
              <span
                className={`flex h-[16px] w-[16px] items-center justify-center border text-[11px] font-bold ${
                  formState.bgmEnabled
                    ? 'border-[#0A0A0A] bg-[#0A0A0A] text-[#FAFAFA]'
                    : 'border-[#D4D4D8] bg-[#FFFFFF]'
                }`}
              >
                {formState.bgmEnabled ? '✓' : ''}
              </span>
              <span>{t.bgmEnableLabel}</span>
            </button>

            {formState.bgmEnabled && (
              <button
                type="button"
                role="checkbox"
                aria-checked={formState.bgmDuckingEnabled !== false}
                data-testid="bgm-ducking-toggle"
                onClick={() =>
                  onChange({ bgmDuckingEnabled: formState.bgmDuckingEnabled === false })
                }
                className="flex items-center gap-2 border border-[#D4D4D8] bg-[#FFFFFF] px-2.5 py-1 font-mono text-[11px] text-[#0A0A0A]"
              >
                <span>{formState.bgmDuckingEnabled === false ? 'OFF' : 'ON'}</span>
                <span>·</span>
                <span>{t.bgmDuckingLabel}</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['inspiring', 'tech', 'corporate', 'relaxed'] as BGMMood[]).map((moodKey) => {
              const isSelected = activeMood === moodKey && formState.bgmEnabled;
              return (
                <button
                  key={moodKey}
                  type="button"
                  data-testid={`bgm-mood-${moodKey}`}
                  onClick={() =>
                    onChange({ bgmEnabled: true, bgmMood: moodKey, bgmTrackId: undefined })
                  }
                  className={`h-7 border px-3 text-[11px] uppercase tracking-[0.05em] transition-colors duration-150 ${
                    isSelected
                      ? 'border-[#0A0A0A] bg-[#0A0A0A] text-[#FAFAFA]'
                      : 'border-[#D4D4D8] bg-[#FFFFFF] text-[#71717A] hover:border-[#0A0A0A] hover:text-[#0A0A0A]'
                  }`}
                >
                  {t.bgmMoods[moodKey]}
                </button>
              );
            })}

            {moodTracks.length > 0 && (
              <select
                aria-label="BGM Track Selection"
                value={selectedTrackId}
                onChange={(e) =>
                  onChange({ bgmEnabled: true, bgmTrackId: e.target.value })
                }
                className="h-7 border border-[#D4D4D8] bg-[#FFFFFF] px-2 font-mono text-[11px] text-[#0A0A0A]"
              >
                {moodTracks.map((tr) => (
                  <option key={tr.track_id} value={tr.track_id}>
                    {tr.title} ({tr.bpm} BPM)
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              data-testid="bgm-preview-btn"
              onClick={() => setPreviewTrackId(selectedTrackId)}
              className="h-7 border border-[#0A0A0A] px-3 text-[11px] uppercase tracking-[0.05em] text-[#0A0A0A] transition-colors duration-150 hover:bg-[#0A0A0A] hover:text-[#FAFAFA]"
            >
              {t.bgmPreviewBtn}
            </button>
          </div>
        </div>

        {previewTrackId && (
          <div className="mt-3">
            <audio
              data-testid="bgm-audition-player"
              controls
              src={getBgmPreviewUrl(previewTrackId)}
              className="h-8 w-full max-w-md"
              aria-label="BGM audition preview player"
            />
          </div>
        )}

        {/* Whisper Karaoke Subtitles Row (M3.3) */}
        <div className="mt-4 flex flex-col justify-between gap-3 border-t border-[#E5E5E5] pt-4 sm:flex-row sm:items-center">
          <button
            type="button"
            role="checkbox"
            aria-checked={Boolean(formState.subtitlesEnabled)}
            data-testid="subtitles-enable-toggle"
            onClick={() => onChange({ subtitlesEnabled: !formState.subtitlesEnabled })}
            className="flex items-center gap-2 text-[13px] font-medium text-[#0A0A0A]"
          >
            <span
              className={`flex h-[16px] w-[16px] items-center justify-center border text-[11px] font-bold ${
                formState.subtitlesEnabled
                  ? 'border-[#0A0A0A] bg-[#0A0A0A] text-[#FAFAFA]'
                  : 'border-[#D4D4D8] bg-[#FFFFFF]'
              }`}
            >
              {formState.subtitlesEnabled ? '✓' : ''}
            </span>
            <span>{t.subtitlesEnableLabel}</span>
          </button>

          {formState.subtitlesEnabled && (
            <div className="flex flex-wrap items-center gap-2">
              {(['karaoke_pill', 'minimal_line', 'bold_highlight'] as CaptionStyle[]).map((styleKey) => {
                const active = (formState.subtitleStyle || 'karaoke_pill') === styleKey;
                return (
                  <button
                    key={styleKey}
                    type="button"
                    data-testid={`subtitle-style-${styleKey}`}
                    onClick={() => onChange({ subtitleStyle: styleKey })}
                    className={`h-7 border px-3 font-mono text-[11px] uppercase transition-colors duration-150 ${
                      active
                        ? 'border-[#0A0A0A] bg-[#0A0A0A] text-[#FAFAFA]'
                        : 'border-[#D4D4D8] bg-[#FFFFFF] text-[#71717A] hover:border-[#0A0A0A] hover:text-[#0A0A0A]'
                    }`}
                  >
                    {t.subtitleStyles[styleKey]}
                  </button>
                );
              })}
            </div>
          )}
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
            {isSubmitting ? t.processingBtn : isShortMode ? t.generateShortBtn : t.generateBtn}
          </button>
        </div>
      </div>
    </section>
  );
};
