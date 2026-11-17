'use client';

import React from 'react';
import { UiLocale } from '@/lib/i18n';

/**
 * Crisp geometric SVG Flag of Vietnam (0px sharp edges for StudioBlank compatibility).
 */
export const VietnamFlagIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    data-flag="vn"
    width="18"
    height="12"
    viewBox="0 0 30 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={`shrink-0 border border-black/15 ${className}`}
  >
    <rect width="30" height="20" fill="#DA251D" />
    <polygon
      points="15,4 16.76,9.43 22.46,9.43 17.85,12.78 19.61,18.21 15,14.86 10.39,18.21 12.15,12.78 7.54,9.43 13.24,9.43"
      fill="#FFFF00"
    />
  </svg>
);

/**
 * Crisp geometric SVG Union Jack (UK / British Flag for EN, 0px sharp edges).
 */
export const UkFlagIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    data-flag="gb"
    width="18"
    height="12"
    viewBox="0 0 60 40"
    fill="none"
    overflow="hidden"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={`shrink-0 border border-black/15 ${className}`}
  >
    <rect width="60" height="40" fill="#012169" />
    <path d="M0 0L60 40M60 0L0 40" stroke="#FFFFFF" strokeWidth="8" />
    <path d="M0 0L60 40M60 0L0 40" stroke="#C8102E" strokeWidth="4" />
    <path d="M30 0V40M0 20H60" stroke="#FFFFFF" strokeWidth="12" />
    <path d="M30 0V40M0 20H60" stroke="#C8102E" strokeWidth="7" />
  </svg>
);

interface LanguageSwitcherProps {
  locale: UiLocale;
  onChange: (locale: UiLocale) => void;
}

/**
 * Top-right bilingual UI language switcher displaying VIE (Vietnam flag) and EN (UK flag).
 */
export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  locale,
  onChange,
}) => {
  return (
    <div
      role="group"
      aria-label="Interface language switcher"
      data-testid="ui-language-switcher"
      className="inline-flex h-7 items-stretch border border-[#D4D4D8] bg-[#FFFFFF]"
    >
      <button
        type="button"
        data-testid="lang-switch-vie"
        aria-pressed={locale === 'vi'}
        onClick={() => onChange('vi')}
        className={`inline-flex items-center gap-1.5 px-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A] ${
          locale === 'vi'
            ? 'bg-[#0A0A0A] text-[#FAFAFA]'
            : 'bg-transparent text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#0A0A0A]'
        }`}
      >
        <VietnamFlagIcon />
        <span>VIE</span>
      </button>

      <div className="w-[1px] bg-[#D4D4D8]" aria-hidden="true" />

      <button
        type="button"
        data-testid="lang-switch-en"
        aria-pressed={locale === 'en'}
        onClick={() => onChange('en')}
        className={`inline-flex items-center gap-1.5 px-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A] ${
          locale === 'en'
            ? 'bg-[#0A0A0A] text-[#FAFAFA]'
            : 'bg-transparent text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#0A0A0A]'
        }`}
      >
        <UkFlagIcon />
        <span>EN</span>
      </button>
    </div>
  );
};
