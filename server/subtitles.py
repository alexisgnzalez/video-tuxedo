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


def build_aligned_phrases(
    words: List[Any],
    max_words: int = 6,
    max_duration: float = 3.2,
    max_silence: float = 0.45
) -> List[Dict[str, Any]]:
    """
    Groups words into short, punchy subtitle cues that tightly match speech waveforms.
    Splits when:
    1. A silence/pause between words exceeds `max_silence` (default: 0.45s).
    2. Phrase duration reaches `max_duration` (default: 3.2s).
    3. Word count reaches `max_words` (default: 6 words).
    4. Punctuation boundaries (periods, question marks, commas after 3+ words).
    """
    phrases = []
    current_words = []

    for w in words:
        clean_word = (getattr(w, "word", None) or (w.get("word", "") if isinstance(w, dict) else "")).strip()
        if not clean_word:
            continue

        if hasattr(w, "start"):
            w_start = float(w.start)
            w_end = float(w.end)
            w_prob = float(getattr(w, "probability", 1.0))
        elif isinstance(w, dict):
            w_start = float(w.get("start", 0.0))
            w_end = float(w.get("end", w_start + 0.3))
            w_prob = float(w.get("probability", 1.0))
        else:
            continue

        word_obj = {
            "word": clean_word,
            "start": round(w_start, 3),
            "end": round(w_end, 3),
            "probability": round(w_prob, 2)
        }

        if not current_words:
            current_words.append(word_obj)
            continue

        last_word = current_words[-1]
        silence_gap = word_obj["start"] - last_word["end"]
        phrase_duration = word_obj["end"] - current_words[0]["start"]
        word_count = len(current_words)

        last_clean = last_word["word"]
        has_strong_punct = any(last_clean.endswith(p) for p in ('.', '?', '!', '...', '।', '。'))
        has_comma = any(last_clean.endswith(p) for p in (',', ';', ':', '、'))

        # Split conditions
        should_split = False
        if silence_gap >= max_silence:
            should_split = True
        elif phrase_duration >= max_duration:
            should_split = True
        elif word_count >= max_words:
            should_split = True
        elif has_strong_punct:
            should_split = True
        elif has_comma and (phrase_duration >= 1.5 or word_count >= 3):
            should_split = True

        if should_split:
            text = " ".join(item["word"] for item in current_words)
            phrases.append({
                "id": len(phrases) + 1,
                "start": round(current_words[0]["start"], 3),
                "end": round(current_words[-1]["end"], 3),
                "text": text,
                "words": current_words
            })
            current_words = [word_obj]
        else:
            current_words.append(word_obj)

    if current_words:
        text = " ".join(item["word"] for item in current_words)
        phrases.append({
            "id": len(phrases) + 1,
            "start": round(current_words[0]["start"], 3),
            "end": round(current_words[-1]["end"], 3),
            "text": text,
            "words": current_words
        })

    return phrases


def transcribe_media(
    file_path: str,
    model_size: str = "base",
    language: Optional[str] = None,
    task: str = "transcribe",
    word_timestamps: bool = True,
    pacing: str = "natural",
    max_words: Optional[int] = None,
    max_duration: Optional[float] = None,
    max_silence: Optional[float] = None
) -> Dict[str, Any]:
    """
    Transcribes audio or video file at `file_path`.
    Returns waveform-aligned, silence-split segments optimized for DaVinci Resolve Free.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Media file not found: {file_path}")

    start_time = time.time()
    model = get_whisper_model(model_size)

    # Transcribe options
    transcribe_kwargs = {
        "task": task,
        "beam_size": 5,
        "word_timestamps": True,
        "vad_filter": True,
        "vad_parameters": dict(min_silence_duration_ms=400),
    }

    if language and language.lower() not in ("auto", "detect", ""):
        transcribe_kwargs["language"] = language.lower()

    segments_gen, info = model.transcribe(file_path, **transcribe_kwargs)

    raw_segments: List[Dict[str, Any]] = []
    all_words: List[Dict[str, Any]] = []
    full_text_parts: List[str] = []

    for idx, seg in enumerate(segments_gen, start=1):
        clean_text = seg.text.strip()
        if not clean_text:
            continue

        raw_words = []
        if seg.words:
            for w in seg.words:
                w_obj = {
                    "word": w.word.strip(),
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                    "probability": round(w.probability, 2)
                }
                raw_words.append(w_obj)
                all_words.append(w_obj)

        raw_segments.append({
            "id": idx,
            "start": round(seg.start, 3),
            "end": round(seg.end, 3),
            "text": clean_text,
            "words": raw_words
        })
        full_text_parts.append(clean_text)

    # Apply waveform-aligned phrase pacing
    pacing_mode = pacing.lower()
    if pacing_mode == "punchy":
        mw = max_words or 4
        md = max_duration or 2.0
        ms = max_silence or 0.35
    elif pacing_mode == "broadcast":
        mw = max_words or 10
        md = max_duration or 5.0
        ms = max_silence or 0.70
    elif pacing_mode == "raw":
        mw, md, ms = 50, 30.0, 5.0
    else:  # "natural" (default)
        mw = max_words or 6
        md = max_duration or 3.2
        ms = max_silence or 0.45

    if all_words and pacing_mode != "raw":
        segments_list = build_aligned_phrases(all_words, max_words=mw, max_duration=md, max_silence=ms)
    else:
        segments_list = raw_segments

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
        "all_words": all_words,
        "full_text": full_transcript,
        "srt": srt_content,
        "vtt": vtt_content,
        "pacing": pacing_mode
    }
