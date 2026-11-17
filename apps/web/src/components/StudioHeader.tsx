'use client';

import React from 'react';
import { HealthResponse, QueueStatsResponse } from '@/types/studio';

interface StudioHeaderProps {
  health: HealthResponse | null;
  queueStats: QueueStatsResponse | null;
  apiOnline: boolean;
  activeSection: 'studio' | 'archive';
  onNavigate: (section: 'studio' | 'archive') => void;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  health,
  queueStats,
  apiOnline,
  activeSection,
  onNavigate,
}) => {
  return (
    <header className="w-full border-b border-[#E5E5E5] bg-[#FAFAFA]">
      <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-8">
          <a
            href="#studio"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('studio');
            }}
            className="text-[14px] font-bold uppercase tracking-[0.16em] text-[#0A0A0A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A]"
          >
            AIK — STUDIO
          </a>

          <nav className="flex items-center gap-6" aria-label="Primary navigation">
            <button
              type="button"
              onClick={() => onNavigate('studio')}
              className={`h-8 text-[12px] uppercase tracking-[0.08em] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A] ${
                activeSection === 'studio'
                  ? 'border-b-2 border-[#0A0A0A] font-semibold text-[#0A0A0A]'
                  : 'text-[#71717A] hover:text-[#0A0A0A]'
              }`}
            >
              WORKSPACE
            </button>
            <button
              type="button"
              onClick={() => onNavigate('archive')}
              className={`h-8 text-[12px] uppercase tracking-[0.08em] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A] ${
                activeSection === 'archive'
                  ? 'border-b-2 border-[#0A0A0A] font-semibold text-[#0A0A0A]'
                  : 'text-[#71717A] hover:text-[#0A0A0A]'
              }`}
            >
              ARCHIVE
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3 font-mono text-[12px]">
          <span
            data-testid="api-status-chip"
            className={`inline-flex h-7 items-center gap-2 border px-3 uppercase tracking-[0.05em] ${
              apiOnline
                ? 'border-[#0A0A0A] text-[#0A0A0A]'
                : 'border-[#D4D4D8] text-[#71717A]'
            }`}
          >
            <span
              className={`h-2 w-2 ${apiOnline ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`}
              aria-hidden="true"
            />
            {apiOnline ? 'API ONLINE' : 'API OFFLINE'}
          </span>

          {health && (
            <span className="hidden border border-[#D4D4D8] px-3 py-1 text-[#71717A] md:inline-flex">
              {health.default_llm_model}
            </span>
          )}

          {queueStats && (
            <span className="hidden border border-[#D4D4D8] px-3 py-1 uppercase text-[#71717A] lg:inline-flex">
              QUEUE: {queueStats.backend}
            </span>
          )}
        </div>
      </div>
    </header>
  );
};
