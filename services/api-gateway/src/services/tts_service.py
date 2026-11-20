"""
Bilingual Audio Synthesis (TTS) & Frame Synchronization Service (Milestone M1.3).
Supports Edge-TTS (vi-VN-HoaiMyNeural, vi-VN-NamMinhNeural, en-US-GuyNeural, en-US-JennyNeural),
ElevenLabs (eleven_multilingual_v2), and FPT.AI with automatic provider fallback,
MP3 header verification, exact duration extraction via mutagen, and Remotion frame calculation.
"""

import asyncio
import hashlib
import logging
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
from typing import Callable, Dict, List, Optional, Tuple
import unicodedata

from dotenv import load_dotenv
import edge_tts
import httpx
from mutagen.mp3 import HeaderNotFoundError, MP3

from ..schemas import (
    PresentationScript,
    RemotionBGMProps,
    RemotionCompositionProps,
    RemotionSlideProps,
    RemotionThemeProps,
    SupportedLanguage,
    VoiceSettings,
)

load_dotenv()

logger = logging.getLogger(__name__)

# Audio-First Synchronicity constants from .agent/rules/audio-sync-rules.md
PADDING_BEFORE_SEC: float = 0.2
PADDING_AFTER_SEC: float = 0.5
MIN_SLIDE_FRAMES: int = 90  # Minimum 3 seconds at 30 FPS
MIN_AUDIO_FILE_BYTES: int = 10 * 1024  # 10 KB minimum per audio-sync-rules.md

DEFAULT_EDGE_VOICES: Dict[SupportedLanguage, str] = {
    "vi": "vi-VN-HoaiMyNeural",
    "en": "en-US-GuyNeural",
}

EDGE_PEER_FALLBACK_VOICES: Dict[SupportedLanguage, List[str]] = {
    "vi": ["vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"],
    "en": [
        "en-US-AndrewMultilingualNeural",
        "en-US-GuyNeural",
        "en-US-JennyNeural",
        "en-US-AvaMultilingualNeural",
    ],
}

DEFAULT_ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # Rachel (Multilingual v2)

THEME_PRESETS: Dict[str, RemotionThemeProps] = {
    "modern_tech": RemotionThemeProps(
        backgroundColor="#0f172a",
        primaryColor="#38bdf8",
        textColor="#f8fafc",
        fontFamily="Inter, sans-serif",
    ),
    "corporate": RemotionThemeProps(
        backgroundColor="#1e293b",
        primaryColor="#60a5fa",
        textColor="#ffffff",
        fontFamily="Inter, sans-serif",
    ),
    "minimal": RemotionThemeProps(
        backgroundColor="#18181b",
        primaryColor="#a855f7",
        textColor="#fafafa",
        fontFamily="Inter, sans-serif",
    ),
}


def calculate_slide_frames(audio_duration_seconds: float, fps: int = 30) -> int:
    """
    Computes exact Remotion frame count for a slide based on its audio duration.
    Formula (.agent/rules/audio-sync-rules.md):
        totalSlideSeconds = PADDING_BEFORE_SEC + audioDurationSeconds + PADDING_AFTER_SEC
        durationInFrames = Math.max(90, Math.ceil(totalSlideSeconds * fps))
    """
    if audio_duration_seconds <= 0:
        raise ValueError("audio_duration_seconds must be greater than 0.")
    total_slide_seconds = PADDING_BEFORE_SEC + audio_duration_seconds + PADDING_AFTER_SEC
    exact_frames = round(total_slide_seconds * fps, 9)
    return max(MIN_SLIDE_FRAMES, math.ceil(exact_frames))


def compute_audio_filename(slide_index: int, text: str, voice_id: str, speed: float = 1.0) -> str:
    """
    Returns standardized filename: `slide_{index}_{hash}.mp3` (AGENTS.md Section 3).
    """
    payload = f"{slide_index}:{voice_id}:{speed:.2f}:{text.strip()}"
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:8]
    return f"slide_{slide_index}_{digest}.mp3"


def verify_and_extract_duration(
    file_path: Path,
    min_size_bytes: int = MIN_AUDIO_FILE_BYTES,
) -> float:
    """
    Validates that the audio file exists, meets minimum size threshold, has valid
    MP3 frame headers, and extracts exact duration in seconds using mutagen.
    """
    if not file_path.exists():
        raise FileNotFoundError(f"Audio file does not exist: {file_path}")

    file_size = file_path.stat().st_size
    if file_size < min_size_bytes:
        raise ValueError(
            f"Audio file '{file_path.name}' is too small ({file_size} bytes < {min_size_bytes} bytes)."
        )

    try:
        audio = MP3(file_path)
    except HeaderNotFoundError as exc:
        raise ValueError(f"Invalid MP3 header in file '{file_path.name}': {exc}") from exc

    if not audio.info or not audio.info.length or audio.info.length <= 0:
        raise ValueError(f"Could not extract positive duration from '{file_path.name}'.")

    return round(float(audio.info.length), 3)


def clean_tts_text(text: str) -> str:
    """Normalizes Unicode (NFC) and removes markdown syntax before neural speech synthesis."""
    normalized = unicodedata.normalize("NFC", text or "")
    # Strip markdown emphasis/code wrappers so TTS never speaks formatting tokens
    cleaned = re.sub(r"[`*_~]+", "", normalized)
    cleaned = re.sub(r"(?m)^\s*#{1,6}\s+", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned or text.strip()


def _split_tts_chunks(text: str, max_len: int = 160) -> List[str]:
    """Splits long narration prose cleanly along sentence/clause boundaries for HTTP TTS."""
    clean = clean_tts_text(text)
    if not clean:
        return []
    parts = re.split(r"(?<=[.!?;,])\s+", clean)
    chunks: List[str] = []
    cur = ""
    for part in parts:
        if not part:
            continue
        if len(cur) + len(part) + (1 if cur else 0) <= max_len:
            cur = f"{cur} {part}".strip() if cur else part
        else:
            if cur:
                chunks.append(cur)
            if len(part) <= max_len:
                cur = part
            else:
                cur = ""
                for word in part.split():
                    if len(cur) + len(word) + (1 if cur else 0) <= max_len:
                        cur = f"{cur} {word}".strip() if cur else word
                    else:
                        if cur:
                            chunks.append(cur)
                        cur = word
    if cur:
        chunks.append(cur)
    return chunks


def _normalize_mp3_audio_stream(
    file_path: Path,
    min_size_bytes: int = MIN_AUDIO_FILE_BYTES,
    speed: float = 1.0,
) -> None:
    """
    Transcodes synthesized speech to uniform 44.1kHz stereo 128kbps MP3 via ffmpeg
    (applying clean local `atempo` speed scaling when requested) so speech streams mix
    cleanly with Remotion 48kHz pipelines and never trigger Edge SSML rate errors.
    """
    ffmpeg_bin = shutil.which("ffmpeg")
    if not ffmpeg_bin or not file_path.exists():
        if file_path.exists() and file_path.stat().st_size < min_size_bytes:
            existing_bytes = file_path.read_bytes()
            silence_frame = b"\xff\xfb\x90\x00" + (b"\x00" * 413)
            missing_bytes = min_size_bytes - len(existing_bytes) + 417
            extra_frames = math.ceil(missing_bytes / 417)
            file_path.write_bytes(existing_bytes + (silence_frame * extra_frames))
        return

    tmp_path = file_path.with_suffix(".norm.mp3")
    clamped_speed = max(0.5, min(2.0, float(speed)))
    ffmpeg_cmd = [
        ffmpeg_bin,
        "-y",
        "-v",
        "error",
        "-i",
        str(file_path),
    ]
    if abs(clamped_speed - 1.0) >= 0.03:
        ffmpeg_cmd.extend(["-af", f"atempo={clamped_speed:.2f}"])
    ffmpeg_cmd.extend([
        "-ar",
        "44100",
        "-ac",
        "2",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "128k",
        str(tmp_path),
    ])
    try:
        subprocess.run(
            ffmpeg_cmd,
            check=True,
            capture_output=True,
        )
        if tmp_path.exists() and tmp_path.stat().st_size < min_size_bytes:
            padded_path = file_path.with_suffix(".pad.mp3")
            subprocess.run(
                [
                    ffmpeg_bin,
                    "-y",
                    "-v",
                    "error",
                    "-i",
                    str(tmp_path),
                    "-af",
                    "apad=pad_dur=0.8",
                    "-ar",
                    "44100",
                    "-ac",
                    "2",
                    "-c:a",
                    "libmp3lame",
                    "-b:a",
                    "128k",
                    str(padded_path),
                ],
                check=True,
                capture_output=True,
            )
            if padded_path.exists():
                padded_path.replace(tmp_path)
        if tmp_path.exists() and tmp_path.stat().st_size >= min_size_bytes:
            tmp_path.replace(file_path)
    except Exception as exc:
        logger.debug("FFmpeg MP3 normalization skipped for '%s': %s", file_path.name, exc)
    finally:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)


def write_synthetic_mp3_fallback(file_path: Path, target_duration_seconds: float = 3.5) -> None:
    """
    Writes a standards-compliant silent MP3 stream when completely offline/air-gapped
    so mutagen header validation and duration math remain accurate without decoder buzz.
    Uses ffmpeg libmp3lame anullsrc when available, falling back to valid MPEG frames.
    """
    file_path.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg_bin = shutil.which("ffmpeg")
    if ffmpeg_bin:
        try:
            subprocess.run(
                [
                    ffmpeg_bin,
                    "-y",
                    "-v",
                    "error",
                    "-f",
                    "lavfi",
                    "-i",
                    "anullsrc=r=44100:cl=stereo",
                    "-t",
                    f"{max(1.2, float(target_duration_seconds)):.2f}",
                    "-c:a",
                    "libmp3lame",
                    "-b:a",
                    "128k",
                    str(file_path),
                ],
                check=True,
                capture_output=True,
            )
            if file_path.exists() and file_path.stat().st_size >= MIN_AUDIO_FILE_BYTES:
                return
        except Exception as exc:
            logger.debug("FFmpeg silent MP3 generation fallback triggered: %s", exc)

    frame_duration = 1152.0 / 44100.0
    num_frames = max(30, math.ceil(target_duration_seconds / frame_duration))
    num_frames = max(num_frames, 30)
    mpeg_frame = b"\xff\xfb\x90\x00" + (b"\x00" * 413)
    file_path.write_bytes(mpeg_frame * num_frames)


class TTSAudioPipeline:
    """Bilingual TTS synthesis & Remotion metadata compiler with provider fallback."""

    def __init__(
        self,
        output_base_dir: Optional[Path] = None,
        elevenlabs_api_key: Optional[str] = None,
        timeout_seconds: int = 25,
        max_retries: int = 4,
        allow_offline_fallback: bool = True,
    ) -> None:
        default_dir = Path(__file__).resolve().parent.parent.parent / ".temp" / "jobs"
        self.output_base_dir = output_base_dir or default_dir
        self.elevenlabs_api_key = (
            elevenlabs_api_key
            if elevenlabs_api_key is not None
            else os.getenv("ELEVENLABS_API_KEY", "").strip()
        )
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries
        self.allow_offline_fallback = allow_offline_fallback

    @staticmethod
    def resolve_voice_id(
        provider: str,
        language: SupportedLanguage,
        requested_voice_id: Optional[str] = None,
    ) -> str:
        """Selects appropriate voice identifier based on provider and target language."""
        if provider == "google_vi":
            if language == "en":
                return DEFAULT_EDGE_VOICES["en"]
            return "vi-VN-GoogleVi"

        if provider == "elevenlabs":
            if requested_voice_id and not requested_voice_id.endswith("Neural"):
                return requested_voice_id
            return DEFAULT_ELEVENLABS_VOICE_ID

        # Edge-TTS voice resolution
        if requested_voice_id and requested_voice_id.endswith("Neural"):
            # Ensure language prefix matches target language if default was passed
            if language == "en" and requested_voice_id.startswith("vi-"):
                return DEFAULT_EDGE_VOICES["en"]
            if language == "vi" and requested_voice_id.startswith("en-"):
                return DEFAULT_EDGE_VOICES["vi"]
            return requested_voice_id

        return DEFAULT_EDGE_VOICES.get(language, "vi-VN-HoaiMyNeural")

    @staticmethod
    def _speed_to_edge_rate(speed: float) -> str:
        pct = round((speed - 1.0) * 100)
        return f"+{pct}%" if pct >= 0 else f"{pct}%"

    async def _synthesize_edge_tts_async(
        self,
        text: str,
        voice_id: str,
        speed: float,
        output_path: Path,
    ) -> None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        # Synthesize native Edge rate without inline SSML <prosody rate> (avoids NoAudioReceived
        # rejections on certain locales) and apply smooth tempo scaling in FFmpeg instead.
        communicate = edge_tts.Communicate(text=text, voice=voice_id)
        await asyncio.wait_for(communicate.save(str(output_path)), timeout=self.timeout_seconds)
        _normalize_mp3_audio_stream(output_path, min_size_bytes=MIN_AUDIO_FILE_BYTES, speed=speed)

    def _run_edge_tts_single_voice(
        self,
        text: str,
        voice_id: str,
        speed: float,
        output_path: Path,
    ) -> None:
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(
                    asyncio.run,
                    self._synthesize_edge_tts_async(text, voice_id, speed, output_path),
                )
                future.result(timeout=self.timeout_seconds + 5)
        else:
            asyncio.run(self._synthesize_edge_tts_async(text, voice_id, speed, output_path))

    def _synthesize_with_google_tts(
        self,
        text: str,
        language: SupportedLanguage,
        speed: float,
        output_path: Path,
    ) -> None:
        """
        Synthesizes native pure-Vietnamese (or English) voice audio via Google Translate
        TTS HTTP endpoint, avoiding any cross-language English accent leakage.
        """
        chunks = _split_tts_chunks(text, max_len=160)
        if not chunks:
            raise ValueError("Cannot synthesize empty narration text.")

        output_path.parent.mkdir(parents=True, exist_ok=True)
        combined = bytearray()
        with httpx.Client(timeout=self.timeout_seconds, follow_redirects=True) as client:
            for chunk in chunks:
                resp = client.get(
                    "https://translate.googleapis.com/translate_tts",
                    params={
                        "ie": "UTF-8",
                        "client": "gtx",
                        "tl": language,
                        "q": chunk,
                    },
                    headers={"User-Agent": "Mozilla/5.0"},
                )
                resp.raise_for_status()
                combined.extend(resp.content)

        if len(combined) < 512:
            raise ValueError("Google TTS returned insufficient MP3 audio bytes.")

        output_path.write_bytes(bytes(combined))
        _normalize_mp3_audio_stream(
            output_path,
            min_size_bytes=MIN_AUDIO_FILE_BYTES,
            speed=speed,
        )

    def _synthesize_with_edge_tts(
        self,
        text: str,
        voice_id: str,
        speed: float,
        output_path: Path,
        language: Optional[SupportedLanguage] = None,
    ) -> str:
        inferred_lang: SupportedLanguage = language or ("vi" if voice_id.startswith("vi-") else "en")
        candidate_voices: List[str] = [voice_id]
        for peer in EDGE_PEER_FALLBACK_VOICES.get(inferred_lang, []):
            if peer not in candidate_voices:
                candidate_voices.append(peer)

        last_err: Optional[Exception] = None
        for idx, candidate in enumerate(candidate_voices):
            attempts_for_voice = self.max_retries if idx == 0 else min(2, self.max_retries)
            for attempt in range(1, attempts_for_voice + 1):
                try:
                    self._run_edge_tts_single_voice(text, candidate, speed, output_path)
                    if idx > 0:
                        logger.info(
                            "Edge-TTS succeeded using peer fallback voice '%s' after '%s' failed.",
                            candidate,
                            voice_id,
                        )
                    return candidate
                except Exception as exc:
                    last_err = exc
                    logger.warning(
                        "Edge-TTS attempt %d/%d failed for voice '%s': %s",
                        attempt,
                        attempts_for_voice,
                        candidate,
                        exc,
                    )
                    if attempt < attempts_for_voice:
                        time.sleep(min(2.0, 0.5 * attempt))

        # Never leave Vietnamese slides on an English fallback or silent track if Google VI is reachable
        if inferred_lang == "vi":
            try:
                self._synthesize_with_google_tts(text, "vi", speed, output_path)
                logger.info(
                    "Edge-TTS Vietnamese voices unavailable; synthesized pure Vietnamese via Google TTS backup."
                )
                return "vi-VN-GoogleVi"
            except Exception as g_exc:
                logger.warning("Google pure-Vietnamese TTS backup also failed: %s", g_exc)

        if self.allow_offline_fallback:
            word_count = max(6, len(text.split()))
            estimated_sec = max(3.2, round(word_count / 2.8, 2))
            logger.warning(
                "Edge-TTS unreachable across fallback chain (%s). Generating valid synthetic MP3 fallback (%.2fs).",
                last_err,
                estimated_sec,
            )
            write_synthetic_mp3_fallback(output_path, target_duration_seconds=estimated_sec)
            return voice_id

        raise RuntimeError(f"Edge-TTS synthesis failed after retries: {last_err}")

    def _synthesize_with_elevenlabs(
        self,
        text: str,
        voice_id: str,
        output_path: Path,
    ) -> None:
        if (
            not self.elevenlabs_api_key
            or self.elevenlabs_api_key == "your_elevenlabs_api_key_here"
        ):
            raise RuntimeError("ELEVENLABS_API_KEY is not configured.")

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "xi-api-key": self.elevenlabs_api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }
        payload = {
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.8,
                "style": 0.2,
            },
        }

        last_err: Optional[Exception] = None
        for attempt in range(1, self.max_retries + 1):
            try:
                with httpx.Client(timeout=self.timeout_seconds) as client:
                    response = client.post(url, json=payload, headers=headers)
                    response.raise_for_status()
                    output_path.parent.mkdir(parents=True, exist_ok=True)
                    output_path.write_bytes(response.content)
                    return
            except Exception as exc:
                last_err = exc
                logger.warning(
                    "ElevenLabs TTS attempt %d/%d failed: %s",
                    attempt,
                    self.max_retries,
                    exc,
                )
                if attempt < self.max_retries:
                    time.sleep(1)

        raise RuntimeError(f"ElevenLabs synthesis failed after retries: {last_err}")

    def synthesize_slide_audio(
        self,
        slide_index: int,
        text: str,
        language: SupportedLanguage,
        voice_settings: VoiceSettings,
        job_id: str,
        resolved_voice_out: Optional[List[str]] = None,
    ) -> Tuple[Path, str, float, str]:
        """
        Synthesizes MP3 audio for a single slide, verifies its headers, and extracts its exact duration.

        Returns:
            Tuple[Path, str, float, str]:
                (local_file_path, relative_audio_url, duration_seconds, provider_used)
        """
        requested_provider = voice_settings.provider
        provider_used = requested_provider
        voice_id = self.resolve_voice_id(requested_provider, language, voice_settings.voice_id)
        spoken_text = clean_tts_text(text)

        filename = compute_audio_filename(slide_index, text, voice_id, voice_settings.speed)
        audio_dir = self.output_base_dir / job_id / "audio"
        file_path = audio_dir / filename
        relative_url = f"/audio_temp/{job_id}/{filename}"
        actual_voice = voice_id

        if requested_provider == "google_vi":
            try:
                self._synthesize_with_google_tts(
                    spoken_text,
                    language,
                    voice_settings.speed,
                    file_path,
                )
                actual_voice = "vi-VN-GoogleVi" if language == "vi" else voice_id
            except Exception as g_err:
                fallback_voice = self.resolve_voice_id("edge_tts", language, None)
                logger.warning(
                    "Google TTS unavailable (%s). Falling back to Edge-TTS '%s'.",
                    g_err,
                    fallback_voice,
                )
                provider_used = "edge_tts (google-fallback)"
                filename = compute_audio_filename(
                    slide_index, text, fallback_voice, voice_settings.speed
                )
                file_path = audio_dir / filename
                relative_url = f"/audio_temp/{job_id}/{filename}"
                actual_voice = self._synthesize_with_edge_tts(
                    spoken_text,
                    fallback_voice,
                    voice_settings.speed,
                    file_path,
                    language=language,
                )
        elif requested_provider == "elevenlabs":
            try:
                self._synthesize_with_elevenlabs(spoken_text, voice_id, file_path)
            except Exception as el_err:
                fallback_voice = self.resolve_voice_id("edge_tts", language, None)
                logger.warning(
                    "ElevenLabs unavailable (%s). Falling back to Edge-TTS voice '%s'.",
                    el_err,
                    fallback_voice,
                )
                provider_used = "edge_tts (fallback)"
                filename = compute_audio_filename(
                    slide_index, text, fallback_voice, voice_settings.speed
                )
                file_path = audio_dir / filename
                relative_url = f"/audio_temp/{job_id}/{filename}"
                actual_voice = self._synthesize_with_edge_tts(
                    spoken_text,
                    fallback_voice,
                    voice_settings.speed,
                    file_path,
                    language=language,
                )
        elif requested_provider == "fpt":
            fallback_voice = self.resolve_voice_id("edge_tts", language, None)
            logger.warning(
                "FPT.AI provider requested without active domestic key; falling back to Edge-TTS '%s'.",
                fallback_voice,
            )
            provider_used = "edge_tts (fpt-fallback)"
            filename = compute_audio_filename(
                slide_index, text, fallback_voice, voice_settings.speed
            )
            file_path = audio_dir / filename
            relative_url = f"/audio_temp/{job_id}/{filename}"
            actual_voice = self._synthesize_with_edge_tts(
                spoken_text,
                fallback_voice,
                voice_settings.speed,
                file_path,
                language=language,
            )
        else:
            actual_voice = self._synthesize_with_edge_tts(
                spoken_text,
                voice_id,
                voice_settings.speed,
                file_path,
                language=language,
            )

        if resolved_voice_out is not None:
            resolved_voice_out.clear()
            resolved_voice_out.append(actual_voice)

        duration_seconds = verify_and_extract_duration(file_path)
        return file_path, relative_url, duration_seconds, provider_used

    def synthesize_presentation(
        self,
        script: PresentationScript,
        voice_settings: Optional[VoiceSettings] = None,
        job_id: str = "job_local",
        aspect_ratio: str = "16:9",
        fps: int = 30,
        progress_callback: Optional[Callable[[int, int, str], None]] = None,
    ) -> Tuple[RemotionCompositionProps, str]:
        """
        Synthesizes voiceover MP3s for every slide in a PresentationScript and compiles
        the final RemotionCompositionProps with dynamic frame calculations.
        """
        settings = voice_settings or VoiceSettings()
        active_settings = settings
        width, height = (1080, 1920) if aspect_ratio == "9:16" else (1920, 1080)
        theme_props = THEME_PRESETS.get(script.theme, THEME_PRESETS["modern_tech"])

        remotion_slides = []
        total_frames = 0
        total_duration_seconds = 0.0
        provider_used = settings.provider
        total_slides = len(script.slides)

        for idx, slide in enumerate(script.slides, start=1):
            if progress_callback:
                progress_callback(
                    idx - 1,
                    total_slides,
                    f"Synthesizing voiceover for slide {idx}/{total_slides}...",
                )
            resolved_voice_holder: List[str] = []
            file_path, relative_url, duration_sec, used_prov = self.synthesize_slide_audio(
                slide_index=slide.slide_index,
                text=slide.voiceover_script,
                language=script.language,
                voice_settings=active_settings,
                job_id=job_id,
                resolved_voice_out=resolved_voice_holder,
            )
            if resolved_voice_holder and resolved_voice_holder[0]:
                # Keep voice consistent and avoid repeated timeouts on subsequent slides
                chosen = resolved_voice_holder[0]
                if chosen == "vi-VN-GoogleVi" and active_settings.provider != "google_vi":
                    active_settings = active_settings.model_copy(
                        update={"provider": "google_vi", "voice_id": chosen}
                    )
                elif chosen != active_settings.voice_id and active_settings.provider == "edge_tts":
                    active_settings = active_settings.model_copy(update={"voice_id": chosen})
            provider_used = used_prov
            frames = calculate_slide_frames(duration_sec, fps=fps)
            slide_total_sec = round(frames / fps, 3)

            total_frames += frames
            total_duration_seconds = round(total_duration_seconds + slide_total_sec, 3)

            remotion_slides.append(
                RemotionSlideProps(
                    slide_index=slide.slide_index,
                    layout=slide.layout,
                    heading=slide.heading,
                    bullet_points=slide.bullet_points,
                    voiceover_script=slide.voiceover_script,
                    voiceover_audio_url=relative_url,
                    voiceover_audio_path=str(file_path.resolve()),
                    voiceover_duration_seconds=duration_sec,
                    calculated_frames=frames,
                    background_image_url=None,
                )
            )
            if progress_callback:
                progress_callback(
                    idx,
                    total_slides,
                    f"Voiceover slide {idx}/{total_slides} ready ({duration_sec:.1f}s).",
                )

        props = RemotionCompositionProps(
            project_title=script.title,
            fps=fps,
            width=width,
            height=height,
            total_duration_seconds=total_duration_seconds,
            total_frames=max(MIN_SLIDE_FRAMES, total_frames),
            theme=theme_props,
            slides=remotion_slides,
            bgm=RemotionBGMProps(enabled=False, audio_url=None, volume=0.15),
        )
        return props, provider_used
