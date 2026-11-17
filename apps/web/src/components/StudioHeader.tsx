'use client';

import React from 'react';
import { LanguageSwitcher } from '@/components/FlagIcons';
import { STUDIO_DICTIONARY, UiLocale } from '@/lib/i18n';
import { HealthResponse, QueueStatsResponse } from '@/types/studio';

interface StudioHeaderProps {
  locale: UiLocale;
  onLocaleChange: (locale: UiLocale) => void;
  health: HealthResponse | null;
  queueStats: QueueStatsResponse | null;
  apiOnline: boolean;
  activeSection: 'studio' | 'archive';
  onNavigate: (section: 'studio' | 'archive') => void;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  locale,
  onLocaleChange,
  health,
  queueStats,
  apiOnline,
  activeSection,
  onNavigate,
}) => {
  const t = STUDIO_DICTIONARY[locale].header;

  return (
    <header className="w-full border-b border-[#E5E5E5] bg-[#FAFAFA]">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3 md:h-16 md:flex-nowrap md:px-12 md:py-0">
        <div className="order-1 flex items-center gap-6 md:gap-8">
          <a
            href="#studio"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('studio');
            }}
            className="shrink-0 text-[14px] font-bold uppercase tracking-[0.16em] text-[#0A0A0A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A]"
          >
            {t.brand}
          </a>

          <nav className="hidden items-center gap-5 md:flex md:gap-6" aria-label="Primary navigation">
            <button
              type="button"
              onClick={() => onNavigate('studio')}
              className={`h-8 shrink-0 text-[12px] uppercase tracking-[0.08em] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A] ${
                activeSection === 'studio'
                  ? 'border-b-2 border-[#0A0A0A] font-semibold text-[#0A0A0A]'
                  : 'text-[#71717A] hover:text-[#0A0A0A]'
              }`}
            >
              {t.workspace}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('archive')}
              className={`h-8 shrink-0 text-[12px] uppercase tracking-[0.08em] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A] ${
                activeSection === 'archive'
                  ? 'border-b-2 border-[#0A0A0A] font-semibold text-[#0A0A0A]'
                  : 'text-[#71717A] hover:text-[#0A0A0A]'
              }`}
            >
              {t.archive}
            </button>
          </nav>
        </div>

        <div className="order-2 flex shrink-0 items-center gap-2.5 font-mono text-[12px] md:gap-3">
          {health && (
            <span className="hidden h-7 items-center border border-[#D4D4D8] px-3 text-[#71717A] lg:inline-flex">
              {health.default_llm_model}
            </span>
          )}

          {queueStats && (
            <span className="hidden h-7 items-center border border-[#D4D4D8] px-3 uppercase text-[#71717A] xl:inline-flex">
              {t.queuePrefix}: {queueStats.backend}
            </span>
          )}

          <span
            data-testid="api-status-chip"
            className={`hidden h-7 items-center gap-2 border px-3 uppercase tracking-[0.05em] sm:inline-flex ${
              apiOnline
                ? 'border-[#0A0A0A] text-[#0A0A0A]'
                : 'border-[#D4D4D8] text-[#71717A]'
            }`}
          >
            <span
              className={`h-2 w-2 ${apiOnline ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`}
              aria-hidden="true"
            />
            {apiOnline ? t.apiOnline : t.apiOffline}
          </span>

          {/* Top-right Bilingual Switcher (VIE / EN with crisp SVG flags) */}
          <LanguageSwitcher locale={locale} onChange={onLocaleChange} />
        </div>

        {/* Clean mobile sub-row navigation (< md) preventing header horizontal overflow */}
        <nav
          className="order-3 flex w-full items-center gap-5 border-t border-[#F4F4F5] pt-2 md:hidden"
          aria-label="Mobile navigation"
        >
          <button
            type="button"
            onClick={() => onNavigate('studio')}
            className={`h-7 shrink-0 text-[11px] uppercase tracking-[0.08em] transition-colors duration-150 ${
              activeSection === 'studio'
                ? 'border-b-2 border-[#0A0A0A] font-semibold text-[#0A0A0A]'
                : 'text-[#71717A]'
            }`}
          >
            {t.workspace}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('archive')}
            className={`h-7 shrink-0 text-[11px] uppercase tracking-[0.08em] transition-colors duration-150 ${
              activeSection === 'archive'
                ? 'border-b-2 border-[#0A0A0A] font-semibold text-[#0A0A0A]'
                : 'text-[#71717A]'
            }`}
          >
            {t.archive}
          </button>
        </nav>
      </div>
    </header>
  );
};
