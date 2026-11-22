'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { JobsArchiveFooter } from '@/components/JobsArchiveFooter';
import { LiveProgressTracker } from '@/components/LiveProgressTracker';
import { PromptStudioForm, StudioFormState } from '@/components/PromptStudioForm';
import { SlideReviewer } from '@/components/SlideReviewer';
import { StudioHeader } from '@/components/StudioHeader';
import {
  buildWebSocketUrl,
  compileEditedScript,
  expandScript,
  fetchHealth,
  fetchJobs,
  fetchJobStatus,
  fetchQueueStats,
  fetchVoices,
  generateScript,
  generateVideoJob,
  previewVoiceAudio,
  uploadBgmAudio,
} from '@/lib/api';
import { STUDIO_DICTIONARY, UiLocale } from '@/lib/i18n';
import { DEFAULT_VOICES, PROMPT_TEMPLATES, resolveTemplatePrompt } from '@/lib/templates';
import {
  HealthResponse,
  JobLifecycleStatus,
  JobStatusResponse,
  PresentationScript,
  PromptTemplate,
  QueueStatsResponse,
  VoiceOption,
  WebSocketProgressEvent,
} from '@/types/studio';

const LOCALE_STORAGE_KEY = 'aik-studio-locale';

function syncLocaleToForm(prev: StudioFormState, targetLocale: UiLocale): StudioFormState {
  const trimmedPrompt = prev.prompt.trim();
  const matchedTemplate = PROMPT_TEMPLATES.find(
    (tpl) => tpl.prompts.en.trim() === trimmedPrompt || tpl.prompts.vi.trim() === trimmedPrompt
  );
  const nextPrompt = matchedTemplate
    ? resolveTemplatePrompt(matchedTemplate, targetLocale)
    : prev.prompt;

  if (prev.language === targetLocale && nextPrompt === prev.prompt) {
    return prev;
  }
  return {
    ...prev,
    prompt: nextPrompt,
    language: targetLocale,
    voiceProvider: 'edge_tts',
    voiceId: targetLocale === 'vi' ? 'vi-VN-HoaiMyNeural' : 'en-US-GuyNeural',
  };
}

export default function StudioWorkspacePage() {
  const [locale, setLocale] = useState<UiLocale>('en');
  const [formState, setFormState] = useState<StudioFormState>({
    prompt: '',
    language: 'en',
    aspectRatio: '16:9',
    videoFormat: 'presentation',
    voiceSpeed: 1.0,
    targetDuration: 45,
    theme: 'modern_tech',
    voiceProvider: 'edge_tts',
    voiceId: 'en-US-GuyNeural',
    renderVideo: true,
    bgmEnabled: false,
    customAudioId: null,
    customAudioName: null,
    customAudioDuration: null,
    bgmDuckingEnabled: true,
    subtitlesEnabled: false,
    subtitleStyle: 'karaoke_pill',
  });

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStatsResponse | null>(null);
  const [apiOnline, setApiOnline] = useState<boolean>(false);
  const [voices, setVoices] = useState<VoiceOption[]>(DEFAULT_VOICES);

  const [activeSection, setActiveSection] = useState<'studio' | 'archive'>('studio');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isExpanding, setIsExpanding] = useState<boolean>(false);
  const [isAuditioning, setIsAuditioning] = useState<boolean>(false);
  const [isUploadingBgm, setIsUploadingBgm] = useState<boolean>(false);
  const [auditionAudioUrl, setAuditionAudioUrl] = useState<string | null>(null);

  const [activeJob, setActiveJob] = useState<JobStatusResponse | null>(null);
  const [liveEvents, setLiveEvents] = useState<WebSocketProgressEvent[]>([]);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [draftScript, setDraftScript] = useState<PresentationScript | null>(null);
  const [slideBackgrounds, setSlideBackgrounds] = useState<Record<number, string>>({});
  const [jobsArchive, setJobsArchive] = useState<JobStatusResponse[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeStreamJobRef = useRef<string | null>(null);

  const t = STUDIO_DICTIONARY[locale];

  const persistLocalePreference = (nextLocale: UiLocale) => {
    setLocale(nextLocale);
    document.documentElement.lang = nextLocale;
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // ignore storage errors
    }
  };

  // Hydrate saved UI locale preference on client mount and keep voice language aligned
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (saved === 'en' || saved === 'vi') {
        setLocale(saved);
        document.documentElement.lang = saved;
        setFormState((prev) => syncLocaleToForm(prev, saved));
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleLocaleChange = (nextLocale: UiLocale) => {
    persistLocalePreference(nextLocale);
    setFormState((prev) => syncLocaleToForm(prev, nextLocale));
    setValidationError(null);
  };

  const loadTelemetry = useCallback(async () => {
    try {
      const [h, stats, voiceCatalog, recentJobs] = await Promise.all([
        fetchHealth(),
        fetchQueueStats(),
        fetchVoices(),
        fetchJobs(20),
      ]);
      setHealth(h);
      setQueueStats(stats);
      if (voiceCatalog.length > 0) setVoices(voiceCatalog);
      setJobsArchive(recentJobs);
      setApiOnline(true);
    } catch {
      setApiOnline(false);
    }
  }, []);

  useEffect(() => {
    loadTelemetry();
  }, [loadTelemetry]);

  const teardownStream = useCallback(() => {
    activeStreamJobRef.current = null;
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setWsConnected(false);
  }, []);

  useEffect(() => {
    return () => {
      teardownStream();
      if (auditionAudioUrl) URL.revokeObjectURL(auditionAudioUrl);
    };
  }, [teardownStream, auditionAudioUrl]);

  const attachJobTelemetry = useCallback(
    (jobId: string, providedWsUrl?: string) => {
      teardownStream();
      activeStreamJobRef.current = jobId;

      const refreshJobRecord = async () => {
        if (activeStreamJobRef.current !== jobId) return;
        try {
          const latest = await fetchJobStatus(jobId);
          if (activeStreamJobRef.current !== jobId) return;
          setActiveJob((prev) => {
            if (!prev || prev.job_id !== latest.job_id) return latest;
            // Preserve higher realtime WebSocket progress while actively streaming non-terminal states
            const keepWsPct =
              latest.status !== 'completed' &&
              latest.status !== 'failed' &&
              prev.progress_percentage > latest.progress_percentage;
            return keepWsPct
              ? { ...latest, progress_percentage: prev.progress_percentage }
              : latest;
          });
          if (latest.script) setDraftScript(latest.script);
          if (
            latest.status === 'completed' ||
            latest.status === 'failed' ||
            (latest.status === 'audio_ready' && !latest.render_requested)
          ) {
            teardownStream();
            loadTelemetry();
          }
        } catch {
          // ignore transient poll failures
        }
      };

      try {
        const wsUrl = buildWebSocketUrl(jobId, providedWsUrl);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => setWsConnected(true);
        ws.onmessage = (msg) => {
          try {
            const evt = JSON.parse(msg.data) as WebSocketProgressEvent;
            setLiveEvents((prev) => {
              const dup = prev.some(
                (p) =>
                  p.step === evt.step &&
                  p.progress_percentage === evt.progress_percentage &&
                  p.message === evt.message
              );
              return dup ? prev : [...prev, evt];
            });
            const lifecycleSteps = new Set<JobLifecycleStatus>([
              'queued',
              'generating_script',
              'script_ready',
              'synthesizing_audio',
              'audio_ready',
              'rendering_video',
              'completed',
              'failed',
            ]);
            setActiveJob((prev) =>
              prev
                ? {
                    ...prev,
                    status: lifecycleSteps.has(evt.step as JobLifecycleStatus)
                      ? (evt.step as JobLifecycleStatus)
                      : prev.status,
                    progress_percentage:
                      evt.step === 'failed'
                        ? evt.progress_percentage
                        : Math.max(prev.progress_percentage, evt.progress_percentage),
                  }
                : prev
            );
            if (
              evt.step === 'script_ready' ||
              evt.step === 'audio_ready' ||
              evt.step === 'completed' ||
              evt.step === 'failed'
            ) {
              refreshJobRecord();
            }
          } catch {
            // ignore malformed websocket payload
          }
        };
        ws.onclose = () => {
          setWsConnected(false);
          refreshJobRecord();
        };
      } catch {
        // Fallback to polling if WebSocket constructor unavailable
      }

      pollIntervalRef.current = setInterval(refreshJobRecord, 1500);
      refreshJobRecord();
    },
    [loadTelemetry, teardownStream]
  );

  const handleNavigate = (section: 'studio' | 'archive') => {
    setActiveSection(section);
    const target = document.getElementById(section);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  };

  const handleApplyTemplate = (template: PromptTemplate) => {
    setValidationError(null);
    const activeLang = locale;
    const nextPrompt = resolveTemplatePrompt(template, activeLang);
    const nextAspect = template.aspectRatio ?? '16:9';
    const nextFormat =
      template.videoFormat ?? (nextAspect === '9:16' ? 'short' : 'presentation');
    setFormState((prev) => ({
      ...prev,
      prompt: nextPrompt,
      aspectRatio: nextAspect,
      videoFormat: nextFormat,
      theme: template.theme,
      targetDuration: template.duration,
      targetSlides: template.targetSlides,
      voiceSpeed: template.voiceSpeed ?? (nextFormat === 'short' ? 1.1 : 1.0),
      subtitlesEnabled: template.enableSubtitles ?? prev.subtitlesEnabled,
      subtitleStyle: template.enableSubtitles ? 'bold_highlight' : prev.subtitleStyle,
      bgmEnabled: prev.customAudioId ? (template.enableBgm ?? prev.bgmEnabled) : false,
    }));
  };

  const handleUploadBgm = async (file: File) => {
    setIsUploadingBgm(true);
    setValidationError(null);
    setStatusMessage(null);
    try {
      const uploaded = await uploadBgmAudio(file);
      setFormState((prev) => ({
        ...prev,
        bgmEnabled: true,
        customAudioId: uploaded.custom_audio_id,
        customAudioName: uploaded.filename,
        customAudioDuration: uploaded.duration_seconds,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.form.bgmUploadError;
      setValidationError(msg);
      throw err;
    } finally {
      setIsUploadingBgm(false);
    }
  };

  const handleAuditionVoice = async () => {
    setIsAuditioning(true);
    setStatusMessage(null);
    try {
      const blob = await previewVoiceAudio({
        provider: formState.voiceProvider,
        voice_id: formState.voiceId,
        language: formState.language,
      });
      if (auditionAudioUrl) URL.revokeObjectURL(auditionAudioUrl);
      const url = URL.createObjectURL(blob);
      setAuditionAudioUrl(url);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : t.form.auditionError);
    } finally {
      setIsAuditioning(false);
    }
  };

  const validatePrompt = (): boolean => {
    if (formState.prompt.trim().length < 3) {
      setValidationError(t.form.promptMinError);
      return false;
    }
    setValidationError(null);
    return true;
  };

  const validateBgmOrAlert = (): boolean => {
    if (formState.bgmEnabled && !formState.customAudioId) {
      setValidationError(t.form.bgmMissingFileError);
      return false;
    }
    return true;
  };

  const buildBgmPayload = () =>
    formState.bgmEnabled && formState.customAudioId
      ? {
          enabled: true,
          custom_audio_id: formState.customAudioId,
          mood: 'tech' as const,
          track_id: null,
          volume: formState.bgmDuckingEnabled === false ? 0.25 : 0.45,
          ducking_enabled: formState.bgmDuckingEnabled !== false,
          duck_attenuation_db: 10.0,
        }
      : {
          enabled: false,
          mood: 'tech' as const,
          track_id: null,
          ducking_enabled: formState.bgmDuckingEnabled !== false,
        };

  const resolveEffectiveFormat = () =>
    formState.videoFormat || (formState.aspectRatio === '9:16' ? 'short' : 'presentation');

  const resolveEffectiveTargetSlides = (): number => {
    if (formState.targetSlides !== undefined) {
      return formState.targetSlides;
    }
    if (resolveEffectiveFormat() === 'short') {
      return Math.min(6, Math.max(3, Math.round(formState.targetDuration / 8)));
    }
    return Math.min(30, Math.max(5, Math.round(formState.targetDuration / 9)));
  };

  const handleDraftScript = async () => {
    if (!validatePrompt()) return;
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const script = await generateScript({
        prompt: formState.prompt.trim(),
        language: formState.language,
        aspect_ratio: formState.aspectRatio,
        video_format: resolveEffectiveFormat(),
        target_duration_seconds: formState.targetDuration,
        theme: formState.theme,
        target_slides: resolveEffectiveTargetSlides(),
      });
      setDraftScript(script);
      setActiveJob(null);
      setLiveEvents([]);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : t.form.scriptError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGeneratePipeline = async () => {
    if (!validatePrompt() || !validateBgmOrAlert()) return;
    setIsSubmitting(true);
    setStatusMessage(null);
    setLiveEvents([]);
    const effectiveFormat = resolveEffectiveFormat();
    try {
      const resp = await generateVideoJob({
        prompt: formState.prompt.trim(),
        language: formState.language,
        aspect_ratio: formState.aspectRatio,
        video_format: effectiveFormat,
        target_duration_seconds: formState.targetDuration,
        target_slides: resolveEffectiveTargetSlides(),
        style: {
          theme: formState.theme,
          color_palette: 'indigo_slate',
          font_pair: 'Inter_Roboto',
        },
        voice_settings: {
          provider: formState.voiceProvider,
          voice_id: formState.voiceId,
          speed: formState.voiceSpeed ?? 1.0,
        },
        render_video: formState.renderVideo,
        include_stock_visuals: true,
        bgm_settings: buildBgmPayload(),
        subtitle_settings: {
          enabled: Boolean(formState.subtitlesEnabled),
          style: formState.subtitleStyle || 'karaoke_pill',
          ...(effectiveFormat === 'short' ? { max_words_per_line: 4 } : {}),
        },
      });

      setActiveJob({
        job_id: resp.job_id,
        status: 'queued',
        progress_percentage: 0,
        render_requested: formState.renderVideo,
        retry_count: 0,
        progress_events: [],
      });
      attachJobTelemetry(resp.job_id, resp.websocket_url);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : t.form.enqueueError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompileEditedSlides = async (renderVideo: boolean) => {
    if (!draftScript || !validateBgmOrAlert()) return;
    setIsSubmitting(true);
    setStatusMessage(null);
    setLiveEvents([]);
    const effectiveFormat = resolveEffectiveFormat();
    try {
      const resp = await compileEditedScript({
        script: { ...draftScript, theme: formState.theme },
        aspect_ratio: formState.aspectRatio,
        voice_settings: {
          provider: formState.voiceProvider,
          voice_id: formState.voiceId,
          speed: formState.voiceSpeed ?? 1.0,
        },
        render_video: renderVideo,
        include_stock_visuals: true,
        bgm_settings: buildBgmPayload(),
        subtitle_settings: {
          enabled: Boolean(formState.subtitlesEnabled),
          style: formState.subtitleStyle || 'karaoke_pill',
          ...(effectiveFormat === 'short' ? { max_words_per_line: 4 } : {}),
        },
        slide_backgrounds: slideBackgrounds,
      });
      setActiveJob({
        job_id: resp.job_id,
        status: 'queued',
        progress_percentage: 40,
        render_requested: renderVideo,
        retry_count: 0,
        script: draftScript,
        progress_events: [],
      });
      attachJobTelemetry(resp.job_id, resp.websocket_url);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : t.form.compileError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExpandSlides = async (additionalSlides: number) => {
    if (!draftScript) return;
    setIsExpanding(true);
    setStatusMessage(null);
    try {
      const expanded = await expandScript({
        script: draftScript,
        additional_slides: additionalSlides,
        topic_hint: formState.prompt.trim() || undefined,
      });
      setDraftScript(expanded);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : t.reviewer.aiExpandError);
    } finally {
      setIsExpanding(false);
    }
  };

  const handleSelectArchivedJob = (job: JobStatusResponse) => {
    teardownStream();
    setActiveJob(job);
    setLiveEvents(job.progress_events || []);
    if (job.script) setDraftScript(job.script);
    setActiveSection('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAFA] text-[#0A0A0A]">
      <StudioHeader
        locale={locale}
        onLocaleChange={handleLocaleChange}
        health={health}
        queueStats={queueStats}
        apiOnline={apiOnline}
        activeSection={activeSection}
        onNavigate={handleNavigate}
      />

      <main className="mx-auto w-full max-w-[1360px] flex-1 px-6 pt-10 md:px-12 md:pt-12">

        {statusMessage && (
          <div
            role="status"
            className="mb-8 border border-[#CA8A04] bg-[#FFFFFF] px-6 py-4 font-mono text-[13px] text-[#0A0A0A]"
          >
            NOTE: {statusMessage}
          </div>
        )}

        {/* Generous Section Stack (gap-16 = 64px minimum between major sections) */}
        <div className="flex flex-col gap-16">
          <PromptStudioForm
            locale={locale}
            formState={formState}
            voices={voices}
            isSubmitting={isSubmitting}
            isAuditioning={isAuditioning}
            isUploadingBgm={isUploadingBgm}
            auditionAudioUrl={auditionAudioUrl}
            validationError={validationError}
            onChange={(patch) => setFormState((prev) => ({ ...prev, ...patch }))}
            onApplyTemplate={handleApplyTemplate}
            onSwitchLanguage={handleLocaleChange}
            onUploadBgm={handleUploadBgm}
            onAuditionVoice={handleAuditionVoice}
            onDraftScript={handleDraftScript}
            onGeneratePipeline={handleGeneratePipeline}
          />

          {activeJob && (
            <LiveProgressTracker
              locale={locale}
              job={activeJob}
              events={liveEvents}
              wsConnected={wsConnected}
            />
          )}

          {draftScript && (
            <SlideReviewer
              locale={locale}
              jobId={activeJob?.job_id ?? null}
              script={draftScript}
              remotionProps={activeJob?.remotion_props ?? null}
              aspectRatio={formState.aspectRatio}
              activeTheme={formState.theme}
              isCompiling={isSubmitting}
              isExpanding={isExpanding}
              slideBackgrounds={slideBackgrounds}
              onChangeSlideBackground={(slideIndex, url) => {
                setSlideBackgrounds((prev) => {
                  const next = { ...prev };
                  if (url) {
                    next[slideIndex] = url;
                  } else {
                    delete next[slideIndex];
                  }
                  return next;
                });
              }}
              onUpdateScript={setDraftScript}
              onCompileSlides={handleCompileEditedSlides}
              onExpandSlides={handleExpandSlides}
            />
          )}
        </div>
      </main>

      <JobsArchiveFooter
        locale={locale}
        jobs={jobsArchive}
        activeJobId={activeJob?.job_id ?? null}
        onSelectJob={handleSelectArchivedJob}
        onRefresh={loadTelemetry}
      />
    </div>
  );
}
