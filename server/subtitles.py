"""
Subtitle Generator Service
Leverages Faster-Whisper (local AI) and PyAV for speech-to-text transcription.
"""

import os
import time
import logging
from typing import List, Dict, Any, Optional
from server.davinci import format_davinci_srt, format_webvtt

logger = logging.getLogger("video_tuxedo.subtitles")

# Model cache so we don't reload weights on every request
_MODEL_CACHE: Dict[str, Any] = {}


def get_whisper_model(model_size: str = "base"):
    """
    Get or load a faster-whisper model.
    Defaults to 'base' for a good balance of speed and quality.
    Runs on CPU with int8 quantization (optimal for macOS Apple Silicon).
    """
    global _MODEL_CACHE
    valid_sizes = {"tiny", "base", "small", "medium"}
    if model_size not in valid_sizes:
        model_size = "base"

    if model_size not in _MODEL_CACHE:
        logger.info(f"Loading faster-whisper model '{model_size}'...")
        from faster_whisper import WhisperModel

        # CPU with int8 quantization is fast, lightweight, and rock-solid on macOS
        _MODEL_CACHE[model_size] = WhisperModel(
            model_size,
            device="cpu",
            compute_type="int8",
            cpu_threads=4
        )
        logger.info(f"Model '{model_size}' loaded successfully.")

    return _MODEL_CACHE[model_size]


def transcribe_media(
    file_path: str,
    model_size: str = "base",
    language: Optional[str] = None,
    task: str = "transcribe",
    word_timestamps: bool = True
) -> Dict[str, Any]:
    """
    Transcribes audio or video file at `file_path`.
    Returns structured segments, language info, duration, and DaVinci-compatible SRT.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Media file not found: {file_path}")

    start_time = time.time()
    model = get_whisper_model(model_size)

    # Transcribe options
    transcribe_kwargs = {
        "task": task,
        "beam_size": 5,
        "word_timestamps": word_timestamps,
        "vad_filter": True,  # Filter out silence for cleaner segments
        "vad_parameters": dict(min_silence_duration_ms=500),
    }

    if language and language.lower() not in ("auto", "detect", ""):
        transcribe_kwargs["language"] = language.lower()

    segments_gen, info = model.transcribe(file_path, **transcribe_kwargs)

    segments_list: List[Dict[str, Any]] = []
    full_text_parts: List[str] = []

    for idx, seg in enumerate(segments_gen, start=1):
        clean_text = seg.text.strip()
        if not clean_text:
            continue

        segment_data = {
            "id": idx,
            "start": round(seg.start, 3),
            "end": round(seg.end, 3),
            "text": clean_text,
            "words": [
                {
                    "word": w.word,
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                    "probability": round(w.probability, 2)
                }
                for w in (seg.words or [])
            ] if word_timestamps and seg.words else []
        }
        segments_list.append(segment_data)
        full_text_parts.append(clean_text)

    processing_time = round(time.time() - start_time, 2)
    srt_content = format_davinci_srt(segments_list)
    vtt_content = format_webvtt(segments_list)
    full_transcript = " ".join(full_text_parts)

    duration_val = round(info.duration, 2) if (info.duration is not None) else 0.0
    lang_prob = round(info.language_probability, 3) if (getattr(info, "language_probability", None) is not None) else 1.0

    return {
        "success": True,
        "language": getattr(info, "language", "en"),
        "language_probability": lang_prob,
        "duration": duration_val,
        "processing_time": processing_time,
        "segments_count": len(segments_list),
        "segments": segments_list,
        "full_text": full_transcript,
        "srt": srt_content,
        "vtt": vtt_content
    }
