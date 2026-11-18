"""
OpenAI Whisper Word-Level Subtitle Alignment & SRT Export Service (Milestone M3.3).
Generates exact per-word start/end timestamps using OpenAI Whisper (`whisper-1` with
`timestamp_granularities=["word"]`) with timeout/retry protection, and falls back
deterministically to proportional word alignment when no API key is configured.
"""

import logging
import os
from pathlib import Path
import time
from typing import Any, List, Optional, Tuple

from dotenv import load_dotenv

from ..schemas import (
    RemotionCompositionProps,
    RemotionSlideProps,
    RemotionSubtitleProps,
    SubtitleProviderType,
    SubtitleSettings,
    SupportedLanguage,
    WordTimestamp,
)

load_dotenv()

logger = logging.getLogger(__name__)


def _clean_api_key(value: Optional[str]) -> str:
    if not value:
        return ""
    cleaned = value.strip()
    if cleaned.lower().startswith("your_"):
        return ""
    return cleaned


def format_srt_timestamp(seconds: float) -> str:
    """Formats seconds into SubRip timecode `HH:MM:SS,mmm`."""
    safe_ms = max(0, int(round(seconds * 1000)))
    hours = safe_ms // 3_600_000
    safe_ms %= 3_600_000
    minutes = safe_ms // 60_000
    safe_ms %= 60_000
    secs = safe_ms // 1000
    millis = safe_ms % 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def align_words_proportionally(script: str, duration_seconds: float) -> List[WordTimestamp]:
    """
    Deterministic syllable/punctuation-weighted forced alignment fallback.
    Distributes word intervals strictly monotonically across `[0, duration_seconds]`.
    """
    tokens = [tok.strip() for tok in (script or "").split() if tok.strip()]
    if not tokens:
        return []

    total_dur = max(0.25, float(duration_seconds or 1.0))

    weights: List[float] = []
    for tok in tokens:
        alnum_count = sum(1 for ch in tok if ch.isalnum())
        base_weight = max(1.0, float(alnum_count))
        if tok.endswith((",", ";", ":")):
            base_weight += 1.5
        elif tok.endswith((".", "!", "?")):
            base_weight += 3.0
        weights.append(base_weight)

    weight_sum = sum(weights) or float(len(tokens))
    timestamps: List[WordTimestamp] = []
    cursor = 0.0

    for idx, (tok, w) in enumerate(zip(tokens, weights)):
        slice_dur = (w / weight_sum) * total_dur
        start = round(cursor, 3)
        end = round(total_dur if idx == len(tokens) - 1 else min(total_dur, cursor + slice_dur), 3)
        if end < start:
            end = start
        timestamps.append(WordTimestamp(word=tok, start_seconds=start, end_seconds=end))
        cursor += slice_dur

    return timestamps


class WhisperSubtitleService:
    """Produces word-by-word timestamps via OpenAI Whisper API with graceful alignment fallback."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        provider_mode: Optional[str] = None,
        timeout_seconds: int = 30,
        max_retries: int = 2,
        openai_client: Optional[Any] = None,
    ) -> None:
        self.api_key = _clean_api_key(
            api_key if api_key is not None else os.getenv("OPENAI_API_KEY")
        )
        self.model = (
            model if model is not None else os.getenv("OPENAI_WHISPER_MODEL", "whisper-1")
        ).strip()
        self.provider_mode = (
            provider_mode if provider_mode is not None else os.getenv("SUBTITLE_PROVIDER", "auto")
        ).strip().lower()
        self.timeout_seconds = max(5, timeout_seconds)
        self.max_retries = max(1, max_retries)
        self._injected_client = openai_client

    def _can_use_whisper(self) -> bool:
        if self.provider_mode == "forced_alignment":
            return False
        return bool(self.api_key or self._injected_client is not None)

    def _get_client(self) -> Any:
        if self._injected_client is not None:
            return self._injected_client
        from openai import OpenAI

        return OpenAI(api_key=self.api_key, timeout=self.timeout_seconds)

    def _transcribe_whisper_words(
        self,
        audio_path: Path,
        language: SupportedLanguage,
        duration_seconds: float,
    ) -> List[WordTimestamp]:
        last_err: Optional[Exception] = None
        for attempt in range(1, self.max_retries + 1):
            try:
                client = self._get_client()
                with audio_path.open("rb") as audio_file:
                    transcript = client.audio.transcriptions.create(
                        model=self.model,
                        file=audio_file,
                        response_format="verbose_json",
                        timestamp_granularities=["word"],
                        language=language,
                    )

                raw_words = getattr(transcript, "words", None)
                if raw_words is None and isinstance(transcript, dict):
                    raw_words = transcript.get("words")

                parsed: List[WordTimestamp] = []
                last_end = 0.0
                for item in raw_words or []:
                    word_text = (
                        getattr(item, "word", None)
                        if not isinstance(item, dict)
                        else item.get("word")
                    )
                    start_raw = (
                        getattr(item, "start", None)
                        if not isinstance(item, dict)
                        else item.get("start")
                    )
                    end_raw = (
                        getattr(item, "end", None)
                        if not isinstance(item, dict)
                        else item.get("end")
                    )
                    if not word_text:
                        continue
                    start_s = max(last_end, float(start_raw or last_end))
                    end_s = min(duration_seconds, max(start_s, float(end_raw or start_s + 0.1)))
                    parsed.append(
                        WordTimestamp(
                            word=str(word_text).strip(),
                            start_seconds=round(start_s, 3),
                            end_seconds=round(end_s, 3),
                        )
                    )
                    last_end = end_s

                if parsed:
                    return parsed
                raise ValueError("Whisper transcription response contained no word timestamps.")
            except Exception as exc:
                last_err = exc
                logger.warning(
                    "Whisper transcription attempt %d/%d failed for '%s': %s",
                    attempt,
                    self.max_retries,
                    audio_path.name,
                    exc,
                )
                if attempt < self.max_retries:
                    time.sleep(0.5)

        raise RuntimeError(f"OpenAI Whisper failed after {self.max_retries} attempts: {last_err}")

    def generate_slide_timestamps(
        self,
        audio_path: Optional[Path],
        voiceover_script: str,
        duration_seconds: float,
        language: SupportedLanguage = "vi",
    ) -> Tuple[List[WordTimestamp], SubtitleProviderType]:
        """
        Generates word timestamps via OpenAI Whisper when configured and audio exists,
        with seamless fallback to proportionate word alignment.
        """
        if self._can_use_whisper() and audio_path and audio_path.exists():
            try:
                words = self._transcribe_whisper_words(
                    audio_path=audio_path,
                    language=language,
                    duration_seconds=duration_seconds,
                )
                return words, "openai_whisper"
            except Exception as exc:
                logger.warning(
                    "Falling back to proportional caption alignment after Whisper error: %s",
                    exc,
                )

        aligned = align_words_proportionally(voiceover_script, duration_seconds)
        return aligned, "forced_alignment"

    @staticmethod
    def export_srt(props: RemotionCompositionProps, words_per_cue: int = 6) -> str:
        """Builds SubRip (.srt) caption track synchronized with Remotion slide frames."""
        fps = props.fps or 30
        padding_before_sec = 0.2
        cues: List[str] = []
        cue_number = 1
        timeline_cursor = 0.0

        for slide in props.slides:
            slide_start = timeline_cursor + padding_before_sec
            words = slide.word_timestamps
            for start_idx in range(0, len(words), words_per_cue):
                chunk = words[start_idx : start_idx + words_per_cue]
                if not chunk:
                    continue
                cue_start = format_srt_timestamp(slide_start + chunk[0].start_seconds)
                cue_end = format_srt_timestamp(slide_start + chunk[-1].end_seconds)
                cue_text = " ".join(w.word for w in chunk)
                cues.append(f"{cue_number}\n{cue_start} --> {cue_end}\n{cue_text}")
                cue_number += 1

            timeline_cursor += slide.calculated_frames / fps

        return "\n\n".join(cues) + ("\n" if cues else "")

    def enrich_remotion_props(
        self,
        props: RemotionCompositionProps,
        settings: Optional[SubtitleSettings],
        language: SupportedLanguage = "vi",
        job_dir: Optional[Path] = None,
    ) -> RemotionCompositionProps:
        """Populates per-slide `word_timestamps`, `subtitles` config, and optional `.srt` artifact."""
        if not settings or not settings.enabled:
            return props.model_copy(
                update={"subtitles": RemotionSubtitleProps(enabled=False)}
            )

        updated_slides: List[RemotionSlideProps] = []
        used_provider: SubtitleProviderType = "forced_alignment"

        for slide in props.slides:
            audio_file = Path(slide.voiceover_audio_path) if slide.voiceover_audio_path else None
            words, provider = self.generate_slide_timestamps(
                audio_path=audio_file,
                voiceover_script=slide.voiceover_script,
                duration_seconds=slide.voiceover_duration_seconds,
                language=language,
            )
            if provider == "openai_whisper":
                used_provider = "openai_whisper"
            updated_slides.append(slide.model_copy(update={"word_timestamps": words}))

        enriched = props.model_copy(
            update={
                "slides": updated_slides,
                "subtitles": RemotionSubtitleProps(
                    enabled=True,
                    style=settings.style,
                    provider_used=used_provider,
                    max_words_per_line=settings.max_words_per_line,
                    highlight_color=settings.highlight_color,
                ),
            }
        )

        if job_dir is not None:
            job_dir.mkdir(parents=True, exist_ok=True)
            srt_content = self.export_srt(enriched, words_per_cue=settings.max_words_per_line)
            (job_dir / "subtitles.srt").write_text(srt_content, encoding="utf-8")

        return enriched
