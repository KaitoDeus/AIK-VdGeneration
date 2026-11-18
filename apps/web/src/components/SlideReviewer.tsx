'use client';

import React, { useState } from 'react';
import { getJobAssetUrl, getJobAudioUrl, searchStockAssets } from '@/lib/api';
import { STUDIO_DICTIONARY, UiLocale } from '@/lib/i18n';
import { SLIDE_LAYOUT_LABELS } from '@/lib/templates';
import {
  AspectRatio,
  PresentationScript,
  RemotionCompositionProps,
  SlideLayout,
  SlideScriptItem,
  StockImageCandidate,
} from '@/types/studio';

interface SlideReviewerProps {
  locale: UiLocale;
  jobId: string | null;
  script: PresentationScript;
  remotionProps: RemotionCompositionProps | null;
  aspectRatio: AspectRatio;
  isCompiling: boolean;
  slideBackgrounds?: Record<number, string>;
  onChangeSlideBackground?: (slideIndex: number, url: string | null) => void;
  onUpdateScript: (updated: PresentationScript) => void;
  onCompileSlides: (renderVideo: boolean) => void;
}

const LAYOUT_KEYS: SlideLayout[] = [
  'title_intro',
  'bullet_list',
  'split_card',
  'quote_highlight',
  'conclusion_cta',
];

export const SlideReviewer: React.FC<SlideReviewerProps> = ({
  locale,
  jobId,
  script,
  remotionProps,
  aspectRatio,
  isCompiling,
  slideBackgrounds = {},
  onChangeSlideBackground,
  onUpdateScript,
  onCompileSlides,
}) => {
  const t = STUDIO_DICTIONARY[locale].reviewer;
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isSearchingStock, setIsSearchingStock] = useState<boolean>(false);
  const [stockResults, setStockResults] = useState<StockImageCandidate[]>([]);
  const [stockFallbackNotice, setStockFallbackNotice] = useState<boolean>(false);

  const safeIndex = Math.min(activeIndex, Math.max(0, script.slides.length - 1));
  const currentSlide = script.slides[safeIndex];
  const currentAudioSlide = remotionProps?.slides.find(
    (s) => s.slide_index === currentSlide?.slide_index
  );

  if (!currentSlide) return null;

  const selectedOverrideUrl = slideBackgrounds[currentSlide.slide_index];
  const rawBackgroundUrl = selectedOverrideUrl || currentAudioSlide?.background_image_url || null;
  const resolvedCanvasBgUrl = rawBackgroundUrl
    ? getJobAssetUrl(jobId, rawBackgroundUrl)
    : null;

  const handleSearchStock = async () => {
    setIsSearchingStock(true);
    setStockFallbackNotice(false);
    try {
      const resp = await searchStockAssets({
        query: currentSlide.visual_keywords || currentSlide.heading,
        aspect_ratio: aspectRatio,
        limit: 4,
      });
      setStockResults(resp.results);
      setStockFallbackNotice(resp.fallback_to_gradient || resp.results.length === 0);
    } catch {
      setStockResults([]);
      setStockFallbackNotice(true);
    } finally {
      setIsSearchingStock(false);
    }
  };

  const updateCurrentSlide = (patch: Partial<SlideScriptItem>) => {
    const nextSlides = script.slides.map((slide, idx) =>
      idx === safeIndex ? { ...slide, ...patch } : slide
    );
    onUpdateScript({ ...script, slides: nextSlides });
  };

  const handleAddSlide = () => {
    if (script.slides.length >= 8) return;
    const nextIndex = script.slides.length + 1;
    const newSlide: SlideScriptItem = {
      slide_index: nextIndex,
      layout: 'bullet_list',
      heading: `${t.defaultSlideHeadingPrefix} ${nextIndex}`,
      bullet_points: [t.defaultSlideBulletA, t.defaultSlideBulletB],
      voiceover_script: t.defaultSlideVoiceover,
      visual_keywords: 'minimal architecture presentation workspace',
    };
    onUpdateScript({ ...script, slides: [...script.slides, newSlide] });
    setActiveIndex(script.slides.length);
  };

  const handleRemoveSlide = () => {
    if (script.slides.length <= 3) return;
    const remaining = script.slides
      .filter((_, idx) => idx !== safeIndex)
      .map((s, i) => ({ ...s, slide_index: i + 1 }));
    onUpdateScript({ ...script, slides: remaining });
    setActiveIndex(Math.max(0, safeIndex - 1));
  };

  const isVertical = aspectRatio === '9:16';

  return (
    <section
      aria-labelledby="reviewer-heading"
      className="border border-[#E5E5E5] bg-[#FFFFFF]"
    >
      {/* Reviewer Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E5E5E5] px-8 py-6 md:flex-row md:items-center">
        <div>
          <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#71717A]">
            {t.sectionEyebrow}
          </span>
          <h2 id="reviewer-heading" className="mt-1 text-[20px] font-semibold text-[#0A0A0A]">
            {script.title}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isCompiling}
            onClick={() => onCompileSlides(false)}
            className="h-10 border border-[#0A0A0A] bg-transparent px-5 text-[12px] font-medium uppercase tracking-[0.05em] text-[#0A0A0A] transition-colors duration-150 hover:bg-[#0A0A0A] hover:text-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-30"
          >
            {t.synthAudioBtn}
          </button>
          <button
            type="button"
            disabled={isCompiling}
            onClick={() => onCompileSlides(true)}
            className="h-10 border border-[#0A0A0A] bg-[#0A0A0A] px-6 text-[12px] font-semibold uppercase tracking-[0.05em] text-[#FAFAFA] transition-colors duration-150 hover:bg-[#FFFFFF] hover:text-[#0A0A0A] disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isCompiling ? t.compilingBtn : t.compileRenderBtn}
          </button>
        </div>
      </div>

      {/* Master-Detail Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left Column: Sharp 48px-Row Slide List */}
        <div className="border-b border-[#E5E5E5] lg:col-span-4 lg:border-b-0 lg:border-r">
          <div className="flex h-12 items-center justify-between border-b border-[#E5E5E5] px-4">
            <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-[#71717A]">
              {t.slidesCounter} ({script.slides.length} / 8)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAddSlide}
                disabled={script.slides.length >= 8}
                className="h-7 border border-[#D4D4D8] px-2 font-mono text-[11px] text-[#0A0A0A] hover:border-[#0A0A0A] disabled:opacity-30"
              >
                {t.addSlideBtn}
              </button>
              <button
                type="button"
                onClick={handleRemoveSlide}
                disabled={script.slides.length <= 3}
                className="h-7 border border-[#D4D4D8] px-2 font-mono text-[11px] text-[#DC2626] hover:border-[#DC2626] disabled:opacity-30"
              >
                {t.removeSlideBtn}
              </button>
            </div>
          </div>

          <ul className="divide-y divide-[#F4F4F5]" role="listbox" aria-label="Slide list">
            {script.slides.map((slide, idx) => {
              const isActive = idx === safeIndex;
              const timingSlide = remotionProps?.slides.find(
                (s) => s.slide_index === slide.slide_index
              );
              return (
                <li key={slide.slide_index}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => setActiveIndex(idx)}
                    className={`flex min-h-[48px] w-full items-center justify-between gap-3 px-4 py-3 text-left text-[14px] transition-colors duration-150 ${
                      isActive
                        ? 'bg-[#0A0A0A] text-[#FAFAFA]'
                        : 'bg-[#FFFFFF] text-[#0A0A0A] hover:bg-[#F4F4F5]'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`font-mono text-[12px] ${
                          isActive ? 'text-[#A1A1AA]' : 'text-[#71717A]'
                        }`}
                      >
                        {String(slide.slide_index).padStart(2, '0')}
                      </span>
                      <span className="truncate font-medium">{slide.heading}</span>
                    </div>
                    <span
                      className={`shrink-0 font-mono text-[11px] ${
                        isActive ? 'text-[#D4D4D8]' : 'text-[#71717A]'
                      }`}
                    >
                      {timingSlide
                        ? `${timingSlide.voiceover_duration_seconds.toFixed(1)}s`
                        : slide.layout}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right Column: Live Slide Canvas Preview + Content Inspector */}
        <div className="p-8 lg:col-span-8">
          {/* Pure Uncluttered Slide Canvas */}
          <div className="mb-8 flex justify-center border border-[#E5E5E5] bg-[#FAFAFA] p-6">
            <div
              data-testid="live-slide-canvas"
              data-layout={currentSlide.layout}
              className={`relative flex flex-col justify-center overflow-hidden border border-[#0A0A0A] bg-[#0F172A] p-8 text-[#F8FAFC] ${
                isVertical ? 'aspect-[9/16] w-full max-w-[320px]' : 'aspect-video w-full max-w-[760px]'
              }`}
            >
              {/* Stock Background Image Layer (Ken Burns Scrim Preview) */}
              {resolvedCanvasBgUrl && (
                <div
                  data-testid="canvas-stock-backdrop"
                  className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
                >
                  <img
                    src={resolvedCanvasBgUrl}
                    alt=""
                    className="h-full w-full object-cover opacity-30"
                  />
                  <div className="absolute inset-0 bg-[#0F172A]/45" />
                </div>
              )}

              {/* Top Accent Bar mirroring Remotion SlideCard */}
              <div className="absolute left-0 right-0 top-0 z-10 h-1.5 bg-[#38BDF8]" />

              <div className="relative z-10 mb-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.12em] text-[#38BDF8]">
                <span>{SLIDE_LAYOUT_LABELS[currentSlide.layout]}</span>
                <span>
                  {String(currentSlide.slide_index).padStart(2, '0')} /{' '}
                  {String(script.slides.length).padStart(2, '0')}
                </span>
              </div>

              {currentSlide.layout === 'quote_highlight' ? (
                <div className="relative z-10 py-4 text-center">
                  <div className="text-[48px] font-bold leading-none text-[#38BDF8]">“</div>
                  <h3 className="mt-2 text-[22px] font-bold italic leading-snug md:text-[28px]">
                    {currentSlide.heading}
                  </h3>
                </div>
              ) : (
                <h3
                  className={`relative z-10 font-bold leading-[1.2] ${
                    currentSlide.layout === 'title_intro'
                      ? 'text-center text-[24px] md:text-[32px]'
                      : 'text-[20px] md:text-[26px]'
                  }`}
                >
                  {currentSlide.heading}
                </h3>
              )}

              {currentSlide.bullet_points.length > 0 && (
                <div
                  className={`relative z-10 mt-5 grid gap-2.5 ${
                    currentSlide.layout === 'split_card' || currentSlide.layout === 'conclusion_cta'
                      ? 'grid-cols-1 md:grid-cols-2'
                      : 'grid-cols-1'
                  }`}
                >
                  {currentSlide.bullet_points.map((point, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 border border-white/15 bg-white/5 px-3.5 py-2.5 text-[13px] leading-snug"
                    >
                      <span className="font-mono text-[11px] font-bold text-[#38BDF8]">
                        {currentSlide.layout === 'conclusion_cta'
                          ? '✓'
                          : String(idx + 1).padStart(2, '0')}
                      </span>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Slide Audio Preview (if synthesized) */}
          {jobId && currentAudioSlide?.voiceover_audio_url && (
            <div className="mb-8 flex flex-col justify-between gap-4 border border-[#E5E5E5] bg-[#FAFAFA] p-4 md:flex-row md:items-center">
              <div>
                <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#71717A]">
                  {t.synthesizedAudioTitle}
                </span>
                <p className="font-mono text-[13px] text-[#0A0A0A]">
                  {currentAudioSlide.voiceover_duration_seconds.toFixed(2)}s ·{' '}
                  {currentAudioSlide.calculated_frames} {t.framesAt30Fps}
                </p>
              </div>
              <audio
                controls
                src={getJobAudioUrl(jobId, currentAudioSlide.voiceover_audio_url)}
                className="h-9 w-full md:w-72"
                aria-label={`Audio preview for slide ${currentSlide.slide_index}`}
              />
            </div>
          )}

          {/* Slide Content Inspector Form */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="slide-heading-input"
                  className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-[#71717A]"
                >
                  {t.slideHeadingLabel}
                </label>
                <input
                  id="slide-heading-input"
                  type="text"
                  value={currentSlide.heading}
                  onChange={(e) => updateCurrentSlide({ heading: e.target.value })}
                  className="h-10 w-full border border-[#D4D4D8] bg-[#FFFFFF] px-3 text-[14px] text-[#0A0A0A] hover:border-[#A1A1AA] focus:border-2 focus:border-[#0A0A0A] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="slide-layout-select"
                  className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-[#71717A]"
                >
                  {t.layoutTemplateLabel}
                </label>
                <select
                  id="slide-layout-select"
                  value={currentSlide.layout}
                  onChange={(e) =>
                    updateCurrentSlide({ layout: e.target.value as SlideLayout })
                  }
                  className="h-10 w-full border border-[#D4D4D8] bg-[#FFFFFF] px-3 text-[14px] text-[#0A0A0A] hover:border-[#A1A1AA] focus:border-2 focus:border-[#0A0A0A] focus:outline-none"
                >
                  {LAYOUT_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {SLIDE_LAYOUT_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="slide-bullets-input"
                className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-[#71717A]"
              >
                {t.bulletPointsLabel}
              </label>
              <textarea
                id="slide-bullets-input"
                rows={3}
                value={currentSlide.bullet_points.join('\n')}
                onChange={(e) => {
                  const lines = e.target.value.split('\n').slice(0, 5);
                  updateCurrentSlide({ bullet_points: lines });
                }}
                className="w-full border border-[#D4D4D8] bg-[#FFFFFF] p-3 text-[14px] leading-[1.6] text-[#0A0A0A] hover:border-[#A1A1AA] focus:border-2 focus:border-[#0A0A0A] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="slide-voiceover-input"
                className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-[#71717A]"
              >
                {t.voiceoverScriptLabel}
              </label>
              <textarea
                id="slide-voiceover-input"
                rows={3}
                value={currentSlide.voiceover_script}
                onChange={(e) => updateCurrentSlide({ voiceover_script: e.target.value })}
                className="w-full border border-[#D4D4D8] bg-[#FFFFFF] p-3 text-[14px] leading-[1.6] text-[#0A0A0A] hover:border-[#A1A1AA] focus:border-2 focus:border-[#0A0A0A] focus:outline-none"
              />
            </div>

            {/* Stock Background Visual Keywords & Search (M2.3) */}
            <div className="border-t border-[#E5E5E5] pt-6">
              <label
                htmlFor="slide-visual-keywords-input"
                className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-[#71717A]"
              >
                {t.visualKeywordsLabel}
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="slide-visual-keywords-input"
                  type="text"
                  value={currentSlide.visual_keywords}
                  onChange={(e) => updateCurrentSlide({ visual_keywords: e.target.value })}
                  className="h-10 flex-1 border border-[#D4D4D8] bg-[#FFFFFF] px-3 text-[14px] text-[#0A0A0A] hover:border-[#A1A1AA] focus:border-2 focus:border-[#0A0A0A] focus:outline-none"
                />
                <button
                  type="button"
                  disabled={isSearchingStock}
                  onClick={handleSearchStock}
                  className="h-10 border border-[#0A0A0A] bg-transparent px-5 text-[12px] font-medium uppercase tracking-[0.05em] text-[#0A0A0A] transition-colors duration-150 hover:bg-[#0A0A0A] hover:text-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {isSearchingStock ? t.searchingStockBtn : t.fetchStockBtn}
                </button>
                {resolvedCanvasBgUrl && onChangeSlideBackground && (
                  <button
                    type="button"
                    onClick={() => onChangeSlideBackground(currentSlide.slide_index, null)}
                    className="h-10 border border-[#D4D4D8] px-4 text-[12px] uppercase tracking-[0.05em] text-[#71717A] transition-colors duration-150 hover:border-[#0A0A0A] hover:text-[#0A0A0A]"
                  >
                    {t.clearBgBtn}
                  </button>
                )}
              </div>

              {stockFallbackNotice && (
                <p
                  data-testid="stock-fallback-note"
                  className="mt-3 border border-[#E5E5E5] bg-[#FAFAFA] px-4 py-2.5 font-mono text-[12px] text-[#71717A]"
                >
                  {t.stockFallbackNote}
                </p>
              )}

              {stockResults.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {stockResults.map((item) => {
                    const isPicked = selectedOverrideUrl === item.url;
                    return (
                      <button
                        key={`${item.provider}-${item.image_id}`}
                        type="button"
                        onClick={() =>
                          onChangeSlideBackground?.(currentSlide.slide_index, item.url)
                        }
                        className={`group border bg-[#FFFFFF] text-left transition-colors duration-150 ${
                          isPicked
                            ? 'border-2 border-[#0A0A0A]'
                            : 'border-[#E5E5E5] hover:border-[#0A0A0A]'
                        }`}
                      >
                        <img
                          src={item.preview_url}
                          alt={item.photographer}
                          className="aspect-video w-full object-cover"
                        />
                        <div className="px-2 py-1.5 font-mono text-[10px] uppercase text-[#71717A]">
                          {item.provider} · {item.photographer}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
