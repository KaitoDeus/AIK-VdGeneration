"""
Royalty-Free Background Music (BGM) Catalog & Sound Synthesis Service (Milestone M3.2).
Provides categorized tracks across 4 moods (`inspiring`, `tech`, `corporate`, `relaxed`),
seamless stereo ambient loop synthesis when custom MP3/WAV assets are not supplied on disk,
and RemotionBGMProps compilation with -18 dB voiceover ducking parameters.
"""

from dataclasses import dataclass
import json
import logging
import math
from pathlib import Path
import re
import shutil
import struct
import subprocess
from typing import Dict, List, Optional
import uuid
import wave

from ..schemas import (
    BGMMood,
    BGMSettings,
    BGMTrackOption,
    BGMUploadResponse,
    RemotionBGMProps,
)

logger = logging.getLogger(__name__)

SAMPLE_RATE = 44100
DEFAULT_LOOP_SECONDS = 8.0
MAX_BGM_UPLOAD_BYTES = 25 * 1024 * 1024
ALLOWED_BGM_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"}
CUSTOM_BGM_ID_RE = re.compile(r"^bgm_[a-f0-9]{8,24}$")


class BGMUploadTooLargeError(ValueError):
    """Raised when an uploaded background audio file exceeds the configured byte limit."""


@dataclass(frozen=True)
class _MoodTrackSpec:
    track_id: str
    title: str
    mood: BGMMood
    bpm: int
    description: str
    chord_freqs: tuple[float, ...]
    pulse_hz: float


BGM_CATALOG: List[_MoodTrackSpec] = [
    _MoodTrackSpec(
        track_id="inspiring-horizon",
        title="Horizon Lift",
        mood="inspiring",
        bpm=112,
        description="Warm uplifting ambient harmonic progression for hero pitches & keynotes.",
        chord_freqs=(261.63, 329.63, 392.00, 493.88),
        pulse_hz=1.86,
    ),
    _MoodTrackSpec(
        track_id="inspiring-dawn",
        title="Dawn Momentum",
        mood="inspiring",
        bpm=100,
        description="Bright expansive major triad pad with gentle rhythmic pulse.",
        chord_freqs=(293.66, 369.99, 440.00, 587.33),
        pulse_hz=1.66,
    ),
    _MoodTrackSpec(
        track_id="tech-circuit",
        title="Circuit Pulse",
        mood="tech",
        bpm=120,
        description="Clean electronic pentatonic texture suited for architecture & AI explainers.",
        chord_freqs=(220.00, 277.18, 329.63, 440.00),
        pulse_hz=2.0,
    ),
    _MoodTrackSpec(
        track_id="tech-neural",
        title="Neural Drift",
        mood="tech",
        bpm=116,
        description="Minimal synth pad with subtle stereo phase motion.",
        chord_freqs=(246.94, 293.66, 369.99, 493.88),
        pulse_hz=1.93,
    ),
    _MoodTrackSpec(
        track_id="corporate-summit",
        title="Executive Flow",
        mood="corporate",
        bpm=108,
        description="Steady neutral presentation backdrop keeping narration front and center.",
        chord_freqs=(261.63, 311.13, 392.00, 466.16),
        pulse_hz=1.8,
    ),
    _MoodTrackSpec(
        track_id="relaxed-drift",
        title="Warm Calm Pad",
        mood="relaxed",
        bpm=84,
        description="Slow warm atmospheric underscore for tutorials & deep-dive walkthroughs.",
        chord_freqs=(196.00, 246.94, 293.66, 392.00),
        pulse_hz=1.4,
    ),
]

CATALOG_BY_ID: Dict[str, _MoodTrackSpec] = {item.track_id: item for item in BGM_CATALOG}


def _synthesize_ambient_loop_wav(
    target_path: Path,
    spec: _MoodTrackSpec,
    duration_seconds: float = DEFAULT_LOOP_SECONDS,
) -> Path:
    """
    Generates a seamless, click-free 44.1kHz 16-bit stereo WAV ambient loop for a given mood spec.
    Both boundaries fade cleanly via sinusoidal envelope modulation so Remotion `loop` is seamless.
    """
    target_path.parent.mkdir(parents=True, exist_ok=True)
    total_frames = int(SAMPLE_RATE * duration_seconds)
    two_pi = 2.0 * math.pi

    frames_buffer = bytearray()
    for i in range(total_frames):
        t = i / SAMPLE_RATE
        # Smooth seamless pulse envelope locked cleanly to whole loop cycles
        cycle_env = 0.55 + 0.45 * math.sin(two_pi * (t / duration_seconds) * 2.0 - math.pi / 2.0)
        boundary_fade = 1.0
        if i < 2205:  # 50ms fade-in
            boundary_fade = i / 2205.0
        elif i > total_frames - 2205:  # 50ms fade-out
            boundary_fade = (total_frames - i) / 2205.0

        left_val = 0.0
        right_val = 0.0
        for idx, freq in enumerate(spec.chord_freqs):
            phase = two_pi * freq * t
            harmonic = math.sin(phase) + 0.25 * math.sin(2.0 * phase)
            pan = 0.35 + 0.15 * idx
            left_val += harmonic * (1.0 - pan * 0.4)
            right_val += harmonic * (0.6 + pan * 0.4)

        norm = 0.55 * cycle_env * boundary_fade / len(spec.chord_freqs)
        pcm_l = max(-32767, min(32767, int(left_val * norm * 32767)))
        pcm_r = max(-32767, min(32767, int(right_val * norm * 32767)))
        frames_buffer.extend(struct.pack("<hh", pcm_l, pcm_r))

    with wave.open(str(target_path), "wb") as wav_file:
        wav_file.setnchannels(2)
        wav_file.setsampwidth(2)
        wav_file.setframerate(SAMPLE_RATE)
        wav_file.writeframes(bytes(frames_buffer))

    return target_path


class BGMService:
    """Manages custom user-uploaded BGM tracks, categorized presets, and Remotion audio props."""

    def __init__(
        self,
        output_base_dir: Optional[Path] = None,
        cache_dir: Optional[Path] = None,
        custom_assets_dir: Optional[Path] = None,
        uploads_dir: Optional[Path] = None,
    ) -> None:
        gateway_root = Path(__file__).resolve().parent.parent.parent
        self.output_base_dir = output_base_dir or (gateway_root / ".temp" / "jobs")
        self.cache_dir = cache_dir or (gateway_root / ".temp" / "bgm_cache")
        self.custom_assets_dir = custom_assets_dir or (gateway_root / "assets" / "bgm")
        self.uploads_dir = uploads_dir or (self.output_base_dir / "_bgm_uploads")

    def save_uploaded_bgm(
        self,
        raw_bytes: bytes,
        original_filename: str,
    ) -> BGMUploadResponse:
        """
        Validates a user-uploaded audio file, converts and loudness-normalizes it via FFmpeg
        to 44.1kHz stereo PCM WAV (-14 LUFS) inside shared storage, and returns metadata.
        """
        if not raw_bytes:
            raise ValueError("Uploaded audio file is empty.")
        if len(raw_bytes) > MAX_BGM_UPLOAD_BYTES:
            raise BGMUploadTooLargeError(
                f"Uploaded audio exceeds maximum limit of {MAX_BGM_UPLOAD_BYTES // (1024 * 1024)}MB."
            )

        raw_name = Path(original_filename or "music.mp3").name
        safe_name = re.sub(r"[^A-Za-z0-9._ -]", "_", raw_name)[:120] or "music.mp3"
        suffix = Path(safe_name).suffix.lower()
        if suffix not in ALLOWED_BGM_EXTENSIONS:
            raise ValueError(
                f"Unsupported audio format '{suffix or 'unknown'}'. Allowed: {', '.join(sorted(ALLOWED_BGM_EXTENSIONS))}."
            )

        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        bgm_id = f"bgm_{uuid.uuid4().hex[:12]}"
        raw_tmp = self.uploads_dir / f"{bgm_id}.raw{suffix}"
        target_wav = self.uploads_dir / f"{bgm_id}.wav"

        try:
            raw_tmp.write_bytes(raw_bytes)
            ffmpeg_bin = shutil.which("ffmpeg")
            if ffmpeg_bin:
                # Normalize any user track (-14 LUFS stereo WAV) so Remotion mixes audibly without distortion
                norm_cmd = [
                    ffmpeg_bin,
                    "-y",
                    "-v",
                    "error",
                    "-i",
                    str(raw_tmp),
                    "-vn",
                    "-ac",
                    "2",
                    "-ar",
                    str(SAMPLE_RATE),
                    "-t",
                    "300",
                    "-af",
                    "loudnorm=I=-14:TP=-1.5:LRA=11",
                    "-c:a",
                    "pcm_s16le",
                    str(target_wav),
                ]
                proc = subprocess.run(norm_cmd, capture_output=True, text=True, timeout=60, check=False)
                if proc.returncode != 0 or not target_wav.exists() or target_wav.stat().st_size < 64:
                    plain_cmd = [
                        ffmpeg_bin,
                        "-y",
                        "-v",
                        "error",
                        "-i",
                        str(raw_tmp),
                        "-vn",
                        "-ac",
                        "2",
                        "-ar",
                        str(SAMPLE_RATE),
                        "-t",
                        "300",
                        "-c:a",
                        "pcm_s16le",
                        str(target_wav),
                    ]
                    plain_proc = subprocess.run(
                        plain_cmd, capture_output=True, text=True, timeout=60, check=False
                    )
                    if plain_proc.returncode != 0 or not target_wav.exists() or target_wav.stat().st_size < 64:
                        raise ValueError("Uploaded file does not contain a valid decodable audio track.")
            elif suffix == ".wav" and raw_bytes[:4] == b"RIFF":
                shutil.copy2(raw_tmp, target_wav)
            else:
                raise ValueError("FFmpeg binary is required to process uploaded non-WAV audio tracks.")

            try:
                with wave.open(str(target_wav), "rb") as wf:
                    frames = wf.getnframes()
                    rate = wf.getframerate() or SAMPLE_RATE
                    duration_seconds = frames / float(rate)
            except wave.Error as exc:
                raise ValueError("Uploaded file failed WAV validation.") from exc

            if duration_seconds < 0.2:
                raise ValueError("Uploaded background track is shorter than 0.2 seconds.")

            meta_path = self.uploads_dir / f"{bgm_id}.json"
            meta_path.write_text(
                json.dumps(
                    {
                        "custom_audio_id": bgm_id,
                        "filename": safe_name,
                        "duration_seconds": round(duration_seconds, 2),
                    },
                    ensure_ascii=False,
                    indent=2,
                ),
                encoding="utf-8",
            )
            logger.info(
                "Saved custom uploaded BGM '%s' (%s, %.2fs) -> %s",
                bgm_id,
                safe_name,
                duration_seconds,
                target_wav,
            )
            return BGMUploadResponse(
                custom_audio_id=bgm_id,
                filename=safe_name,
                duration_seconds=round(duration_seconds, 2),
                preview_url=f"/api/v1/bgm/uploads/{bgm_id}/preview",
            )
        except Exception:
            target_wav.unlink(missing_ok=True)
            raise
        finally:
            raw_tmp.unlink(missing_ok=True)

    def resolve_uploaded_audio_file(self, custom_audio_id: str) -> Path:
        """Validates a custom_audio_id token and returns the normalized local audio file."""
        if not custom_audio_id or not CUSTOM_BGM_ID_RE.match(custom_audio_id):
            raise ValueError("Invalid custom_audio_id format.")
        expected_dir = self.uploads_dir.resolve()
        candidate = (expected_dir / f"{custom_audio_id}.wav").resolve()
        if candidate.parent != expected_dir or not candidate.exists() or candidate.stat().st_size <= 44:
            raise FileNotFoundError(f"Uploaded BGM track '{custom_audio_id}' not found.")
        return candidate

    def list_tracks(self, mood: Optional[BGMMood] = None) -> List[BGMTrackOption]:
        """Returns available royalty-free BGM tracks, optionally filtered by mood."""
        items = [s for s in BGM_CATALOG if mood is None or s.mood == mood]
        return [
            BGMTrackOption(
                track_id=item.track_id,
                title=item.title,
                mood=item.mood,
                bpm=item.bpm,
                duration_seconds=DEFAULT_LOOP_SECONDS,
                description=item.description,
                preview_url=f"/api/v1/bgm/tracks/{item.track_id}/preview",
            )
            for item in items
        ]

    def resolve_track(
        self,
        mood: BGMMood = "tech",
        track_id: Optional[str] = None,
    ) -> _MoodTrackSpec:
        if track_id and track_id in CATALOG_BY_ID:
            return CATALOG_BY_ID[track_id]
        for item in BGM_CATALOG:
            if item.mood == mood:
                return item
        return BGM_CATALOG[0]

    def get_track_audio_file(self, track_id: str) -> Path:
        """
        Resolves a curated royalty-free audio file for `track_id`, checking custom local
        MP3/WAV assets first and synthesizing/caching a stereo WAV loop when absent.
        """
        spec = CATALOG_BY_ID.get(track_id)
        if spec is None:
            raise KeyError(f"Unknown BGM track_id '{track_id}'.")

        for ext in (".mp3", ".wav"):
            custom_file = self.custom_assets_dir / f"{track_id}{ext}"
            if custom_file.exists() and custom_file.stat().st_size > 1024:
                return custom_file

        cached_wav = self.cache_dir / f"{track_id}.wav"
        if not cached_wav.exists() or cached_wav.stat().st_size < 1024:
            _synthesize_ambient_loop_wav(cached_wav, spec)
            logger.info("Synthesized cached BGM loop for mood '%s' -> %s", spec.mood, cached_wav)
        return cached_wav

    def compile_bgm_props(
        self,
        settings: Optional[BGMSettings],
        job_id: str,
    ) -> RemotionBGMProps:
        """
        Stages per-job BGM audio file (prioritizing user-uploaded custom audio)
        and returns validated RemotionBGMProps with smooth speech ducking parameters.
        """
        if not settings or not settings.enabled:
            return RemotionBGMProps(enabled=False)

        duck_db = (
            float(settings.duck_attenuation_db)
            if settings.duck_attenuation_db is not None
            else 18.0
        )

        if settings.custom_audio_id:
            source_file = self.resolve_uploaded_audio_file(settings.custom_audio_id)
            resolved_track_id = settings.custom_audio_id
            resolved_mood: Optional[BGMMood] = None
        else:
            spec = self.resolve_track(mood=settings.mood, track_id=settings.track_id)
            source_file = self.get_track_audio_file(spec.track_id)
            resolved_track_id = spec.track_id
            resolved_mood = spec.mood

        job_music_dir = self.output_base_dir / job_id / "music"
        job_music_dir.mkdir(parents=True, exist_ok=True)
        staged_filename = f"{job_id}_{resolved_track_id}{source_file.suffix.lower()}"
        staged_path = job_music_dir / staged_filename
        shutil.copy2(source_file, staged_path)

        return RemotionBGMProps(
            enabled=True,
            audio_url=f"/music/{staged_filename}",
            audio_path=str(staged_path.resolve()),
            volume=settings.volume,
            mood=resolved_mood,
            track_id=resolved_track_id,
            ducking_enabled=settings.ducking_enabled,
            duck_attenuation_db=duck_db,
            transition_swell_db=3.0,
        )
