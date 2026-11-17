'use client';

import React from 'react';
import { STUDIO_DICTIONARY, UiLocale } from '@/lib/i18n';
import { JobStatusResponse } from '@/types/studio';

interface JobsArchiveFooterProps {
  locale: UiLocale;
  jobs: JobStatusResponse[];
  activeJobId: string | null;
  onSelectJob: (job: JobStatusResponse) => void;
  onRefresh: () => void;
}

export const JobsArchiveFooter: React.FC<JobsArchiveFooterProps> = ({
  locale,
  jobs,
  activeJobId,
  onSelectJob,
  onRefresh,
}) => {
  const t = STUDIO_DICTIONARY[locale].archive;
  const statuses = STUDIO_DICTIONARY[locale].progress.statuses;

  return (
    <footer
      id="archive"
      aria-labelledby="archive-heading"
      className="mt-16 w-full bg-[#0A0A0A] py-16 text-[#FAFAFA]"
    >
      <div className="mx-auto max-w-[1360px] px-6 md:px-12">
        <div className="mb-8 flex flex-col justify-between gap-4 border-b border-white/15 pb-6 md:flex-row md:items-end">
          <div>
            <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#71717A]">
              {t.sectionEyebrow}
            </span>
            <h2 id="archive-heading" className="mt-1 text-[28px] font-semibold leading-[1.2] text-[#FAFAFA]">
              {t.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            className="h-9 border border-white/40 px-4 text-[12px] uppercase tracking-[0.06em] text-[#FAFAFA] transition-colors duration-150 hover:border-[#FAFAFA] hover:bg-[#FAFAFA] hover:text-[#0A0A0A]"
          >
            {t.refreshBtn}
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="border border-white/15 px-6 py-10 font-mono text-[13px] text-[#71717A]">
            {t.emptyState}
          </div>
        ) : (
          <div className="divide-y divide-white/10 border border-white/15">
            {jobs.map((job) => {
              const isSelected = job.job_id === activeJobId;
              return (
                <button
                  key={job.job_id}
                  type="button"
                  onClick={() => onSelectJob(job)}
                  className={`flex min-h-[48px] w-full flex-col justify-between gap-2 px-4 py-3 text-left transition-colors duration-150 md:flex-row md:items-center ${
                    isSelected
                      ? 'bg-[#FAFAFA] text-[#0A0A0A]'
                      : 'bg-transparent text-[#FAFAFA] hover:bg-white/10'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span
                      className={`font-mono text-[12px] ${
                        isSelected ? 'text-[#71717A]' : 'text-[#A1A1AA]'
                      }`}
                    >
                      {job.job_id}
                    </span>
                    <span className="truncate text-[14px] font-medium">
                      {job.script?.title || t.untitledJob}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-4 font-mono text-[12px]">
                    <span className="uppercase">
                      {statuses[job.status] || job.status.replace(/_/g, ' ')}
                    </span>
                    <span>{job.progress_percentage}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-16 flex flex-col justify-between gap-4 border-t border-white/15 pt-8 font-mono text-[12px] text-[#71717A] md:flex-row md:items-center">
          <span>{t.footerLeft}</span>
          <span>{t.footerRight}</span>
        </div>
      </div>
    </footer>
  );
};
