'use client';

import React, { useEffect, useState } from 'react';
import { fetchSignedVideoUrl, getJobDownloadHref, getJobVideoUrl } from '@/lib/api';
import { STUDIO_DICTIONARY, UiLocale } from '@/lib/i18n';
import { JobStatusResponse, VideoDeliveryResponse, WebSocketProgressEvent } from '@/types/studio';

interface LiveProgressTrackerProps {
  locale: UiLocale;
  job: JobStatusResponse;
  events: WebSocketProgressEvent[];
  wsConnected: boolean;
}

const STATUS_CHIP_STYLE: Record<string, string> = {
  queued: 'border-[#D4D4D8] bg-transparent text-[#71717A]',
  generating_script: 'border-[#0A0A0A] bg-transparent text-[#0A0A0A]',
  script_ready: 'border-[#0A0A0A] bg-transparent text-[#0A0A0A]',
  synthesizing_audio: 'border-[#0A0A0A] bg-transparent text-[#0A0A0A]',
  audio_ready: 'border-[#0A0A0A] bg-[#0A0A0A] text-[#FAFAFA]',
  rendering_video: 'border-[#0A0A0A] bg-transparent text-[#0A0A0A]',
  completed: 'border-[#16A34A] bg-[#16A34A] text-[#FAFAFA]',
  failed: 'border-[#DC2626] bg-[#DC2626] text-[#FAFAFA]',
};

export const LiveProgressTracker: React.FC<LiveProgressTrackerProps> = ({
  locale,
  job,
  events,
  wsConnected,
}) => {
  const t = STUDIO_DICTIONARY[locale].progress;
  const [signedDelivery, setSignedDelivery] = useState<VideoDeliveryResponse | null>(null);
  const [isSigningUrl, setIsSigningUrl] = useState(false);

  useEffect(() => {
    setSignedDelivery(null);
  }, [job.job_id]);

  const chipStyle =
    STATUS_CHIP_STYLE[job.status] || 'border-[#D4D4D8] bg-transparent text-[#71717A]';

  const activeStorageProvider = signedDelivery?.storage_provider || job.storage_provider || 'local';
  const storageLabel =
    activeStorageProvider === 's3'
      ? t.storageS3
      : activeStorageProvider === 'r2'
      ? t.storageR2
      : t.storageLocal;

  const resolvedVideoHref = (() => {
    const freshUrl = signedDelivery?.cdn_url || signedDelivery?.download_url;
    if (freshUrl && (freshUrl.startsWith('http://') || freshUrl.startsWith('https://'))) {
      return freshUrl;
    }
    if (freshUrl && freshUrl.startsWith('/api/v1/')) {
      return getJobVideoUrl(job.job_id);
    }
    return getJobDownloadHref(job);
  })();

  const handleRefreshSignedUrl = async () => {
    setIsSigningUrl(true);
    try {
      const delivery = await fetchSignedVideoUrl(job.job_id);
      setSignedDelivery(delivery);
    } catch {
      // keep existing fallback URL if Gateway does not support dynamic signing
    } finally {
      setIsSigningUrl(false);
    }
  };

  const pipelineSteps = [
    { id: '01', label: t.steps.queued, threshold: 0 },
    { id: '02', label: t.steps.script, threshold: 40 },
    { id: '03', label: t.steps.audio, threshold: 80 },
    { id: '04', label: t.steps.render, threshold: 100 },
  ];

  const handleDownloadProps = () => {
    if (!job.remotion_props) return;
    const blob = new Blob([JSON.stringify(job.remotion_props, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${job.job_id}_remotion_props.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      aria-labelledby="progress-heading"
      className="border border-[#E5E5E5] bg-[#FFFFFF]"
    >
      {/* Header Row */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E5E5E5] px-8 py-6 md:flex-row md:items-center">
        <div>
          <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#71717A]">
            {t.sectionEyebrow}
          </span>
          <div className="mt-1 flex flex-wrap items-center gap-4">
            <h2 id="progress-heading" className="text-[20px] font-semibold text-[#0A0A0A]">
              {t.title}
            </h2>
            <span className="font-mono text-[13px] text-[#71717A]">
              {job.job_id}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[12px] uppercase text-[#71717A]">
            WS: {wsConnected ? t.wsStreaming : t.wsClosed}
          </span>
          <span
            data-testid="job-status-chip"
            className={`inline-flex h-7 items-center border px-3 text-[12px] uppercase tracking-[0.05em] ${chipStyle}`}
          >
            {t.statuses[job.status] || job.status.replace(/_/g, ' ')}
          </span>
          <span className="font-mono text-[20px] font-semibold text-[#0A0A0A]">
            {job.progress_percentage}%
          </span>
        </div>
      </div>

      {/* Sharp Linear Progress Bar */}
      <div className="w-full border-b border-[#E5E5E5] bg-[#F4F4F5]">
        <div
          role="progressbar"
          aria-valuenow={job.progress_percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ width: `${job.progress_percentage}%` }}
          className={`h-[4px] transition-all duration-150 ${
            job.status === 'failed' ? 'bg-[#DC2626]' : 'bg-[#0A0A0A]'
          }`}
        />
      </div>

      {/* 4-Stage Milestone Matrix */}
      <div className="grid grid-cols-2 divide-x divide-[#E5E5E5] border-b border-[#E5E5E5] md:grid-cols-4">
        {pipelineSteps.map((step) => {
          const isReached = job.progress_percentage >= step.threshold && job.status !== 'failed';
          return (
            <div key={step.id} className="px-6 py-4">
              <span className="font-mono text-[11px] text-[#71717A]">{step.id}</span>
              <p
                className={`mt-1 text-[12px] uppercase tracking-[0.06em] ${
                  isReached ? 'font-semibold text-[#0A0A0A]' : 'text-[#A1A1AA]'
                }`}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Error Notice */}
      {job.error && (
        <div role="alert" className="border-b border-[#E5E5E5] bg-[#FEF2F2] px-8 py-4 font-mono text-[13px] text-[#DC2626]">
          {t.errorPrefix}: {job.error}
        </div>
      )}

      {/* Built-in 1080p Video Player & Export Controls (When MP4 is compiled) */}
      {(job.output_video_path || job.video_download_url) && job.status === 'completed' && (
        <div className="border-b border-[#E5E5E5] p-8">
          <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#16A34A]">
                  {t.masterComplete}
                </span>
                <span
                  data-testid="storage-provider-chip"
                  className="border border-[#E5E5E5] bg-[#FAFAFA] px-2 py-0.5 font-mono text-[11px] uppercase text-[#0A0A0A]"
                >
                  {storageLabel}
                </span>
              </div>
              {job.remotion_props && (
                <p className="mt-1 font-mono text-[13px] text-[#71717A]">
                  {job.remotion_props.width}×{job.remotion_props.height} @ {job.remotion_props.fps}FPS ·{' '}
                  {job.remotion_props.total_duration_seconds.toFixed(2)}s ({job.remotion_props.total_frames} {t.framesUnit.toLowerCase()})
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {job.remotion_props && (
                <button
                  type="button"
                  onClick={handleDownloadProps}
                  className="h-10 border border-[#0A0A0A] px-6 text-[12px] uppercase tracking-[0.05em] text-[#0A0A0A] transition-colors duration-150 hover:bg-[#0A0A0A] hover:text-[#FAFAFA]"
                >
                  {t.exportPropsBtn}
                </button>
              )}
              {(activeStorageProvider === 's3' || activeStorageProvider === 'r2') && (
                <button
                  type="button"
                  data-testid="refresh-signed-url-btn"
                  disabled={isSigningUrl}
                  onClick={handleRefreshSignedUrl}
                  className="h-10 border border-[#0A0A0A] px-5 text-[12px] uppercase tracking-[0.05em] text-[#0A0A0A] transition-colors duration-150 hover:bg-[#0A0A0A] hover:text-[#FAFAFA] disabled:opacity-40"
                >
                  {isSigningUrl ? t.refreshingSignedUrlBtn : t.refreshSignedUrlBtn}
                </button>
              )}
              <a
                href={resolvedVideoHref}
                download={`${job.job_id}.mp4`}
                className="inline-flex h-10 items-center bg-[#0A0A0A] px-6 text-[12px] font-semibold uppercase tracking-[0.05em] text-[#FAFAFA] transition-colors duration-150 hover:bg-[#27272A]"
              >
                {t.downloadMp4Btn}
              </a>
            </div>
          </div>

          <div className="border border-[#0A0A0A] bg-[#0A0A0A]">
            <video
              data-testid="rendered-video-player"
              controls
              src={resolvedVideoHref}
              className="aspect-video w-full"
              aria-label="Rendered presentation video playback"
            />
          </div>
        </div>
      )}

      {/* WebSocket Event Stream Console (IBM Plex Mono) */}
      <div className="p-8">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-[#71717A]">
            {t.eventLogTitle} ({events.length})
          </span>
          {job.remotion_props && (
            <span className="font-mono text-[12px] text-[#71717A]">
              {t.durationLabel}: {job.remotion_props.total_duration_seconds.toFixed(2)}S ({job.remotion_props.total_frames} {t.framesUnit})
            </span>
          )}
        </div>

        <div className="max-h-48 overflow-y-auto border border-[#E5E5E5] bg-[#FAFAFA] p-4 font-mono text-[13px] leading-[1.5]">
          {events.length === 0 ? (
            <p className="text-[#71717A]">{t.waitingEvents}</p>
          ) : (
            <ul className="space-y-1">
              {events.map((evt, idx) => (
                <li key={`${evt.timestamp}-${idx}`} className="flex gap-4">
                  <span className="shrink-0 text-[#71717A]">{evt.timestamp}</span>
                  <span className="w-36 shrink-0 uppercase text-[#0A0A0A]">[{evt.step}]</span>
                  <span className="text-[#0A0A0A]">{evt.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};
