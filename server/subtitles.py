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


VENEZUELAN_SLANG_PUNCHLINES = {
    "chinazo", "tijerazo", "bigote", "chamo", "marico", "vaina", "arrecho",
    "ladilla", "pana", "cédula", "cedula", "secador", "discoteca", "discotecas",
    "empatarse", "calentar", "humilde", "trágame", "tierra", "monitores", "caracas"
}


def build_aligned_phrases(
    words: List[Any],
    max_words: int = 6,
    max_duration: float = 2.4,
    max_silence: float = 0.40,
    pacing_mode: str = "standup_hybrid",
) -> List[Dict[str, Any]]:
    """
    Groups words into short, narrative-aware subtitle cues aligned with speech waveforms.
    Implements the TikTok Subtitle Style Guide (Setup vs. Punchline Hybrid Rule):
    - Hook (first 3.2s): 1 to 3 words per card.
    - Setup: 4 to 6 words (approx 1.2s - 2.0s) split on natural spoken breath clauses.
    - Punchlines & Venezuelan slang: Split onto separate 1-to-3 word cards ("No Spoilers" rule).
    - Casing: Sentence case for setups; ALL CAPS for punchlines and slang.
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

        raw_stripped = clean_word.lower().strip(".,!?:;¿¡\"'")
        is_slang_or_punchline = raw_stripped in VENEZUELAN_SLANG_PUNCHLINES or (clean_word.isupper() and len(clean_word) > 2)

        word_obj = {
            "word": clean_word,
            "start": round(w_start, 3),
            "end": round(w_end, 3),
            "probability": round(w_prob, 2),
            "is_punchline": is_slang_or_punchline,
            "emphasis": is_slang_or_punchline,
            "highlight_type": "punchline" if is_slang_or_punchline else None,
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

        # Dynamic thresholds based on pacing mode and narrative role
        if pacing_mode in ("standup_hybrid", "natural", "standup"):
            is_hook = current_words[0]["start"] <= 3.2
            effective_max_words = 3 if is_hook else max_words
            effective_max_dur = 1.6 if is_hook else max_duration
            effective_max_silence = 0.38
        elif pacing_mode == "punchy":
            effective_max_words = 4
            effective_max_dur = 2.0
            effective_max_silence = 0.35
        elif pacing_mode == "indie_cinema":
            effective_max_words = 7
            effective_max_dur = 3.2
            effective_max_silence = 0.45
        elif pacing_mode == "pill_box":
            effective_max_words = 5
            effective_max_dur = 2.2
            effective_max_silence = 0.40
        else:
            effective_max_words = max_words
            effective_max_dur = max_duration
            effective_max_silence = max_silence

        # Split conditions
        should_split = False
        if silence_gap >= effective_max_silence:
            should_split = True
        elif phrase_duration >= effective_max_dur:
            should_split = True
        elif word_count >= effective_max_words:
            should_split = True
        elif has_strong_punct:
            should_split = True
        elif has_comma and (phrase_duration >= 1.2 or word_count >= 3):
            should_split = True
        # "No Spoilers Rule": If upcoming word is a comedic punchline or slang, don't leave it hanging on setup
        elif is_slang_or_punchline and word_count >= 2 and pacing_mode in ("standup_hybrid", "natural", "standup"):
            should_split = True

        if should_split:
            cue_text = " ".join(item["word"] for item in current_words)
            is_all_punchline = all(item.get("is_punchline") for item in current_words)
            phrases.append({
                "id": len(phrases) + 1,
                "start": round(current_words[0]["start"], 3),
                "end": round(current_words[-1]["end"], 3),
                "text": cue_text,
                "words": current_words,
                "cue_type": "punchline" if is_all_punchline else ("hook" if current_words[0]["start"] <= 3.2 else "setup"),
            })
            current_words = [word_obj]
        else:
            current_words.append(word_obj)

    if current_words:
        cue_text = " ".join(item["word"] for item in current_words)
        is_all_punchline = all(item.get("is_punchline") for item in current_words)
        phrases.append({
            "id": len(phrases) + 1,
            "start": round(current_words[0]["start"], 3),
            "end": round(current_words[-1]["end"], 3),
            "text": cue_text,
            "words": current_words,
            "cue_type": "punchline" if is_all_punchline else ("hook" if current_words[0]["start"] <= 3.2 else "setup"),
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
    pacing_mode = pacing.lower() if pacing else "standup_hybrid"
    if pacing_mode in ("standup_hybrid", "standup"):
        mw = max_words or 6
        md = max_duration or 2.4
        ms = max_silence or 0.38
    elif pacing_mode == "punchy":
        mw = max_words or 4
        md = max_duration or 2.0
        ms = max_silence or 0.35
    elif pacing_mode == "indie_cinema":
        mw = max_words or 7
        md = max_duration or 3.2
        ms = max_silence or 0.45
    elif pacing_mode == "pill_box":
        mw = max_words or 5
        md = max_duration or 2.2
        ms = max_silence or 0.40
    elif pacing_mode == "broadcast":
        mw = max_words or 10
        md = max_duration or 5.0
        ms = max_silence or 0.70
    elif pacing_mode == "raw":
        mw, md, ms = 50, 30.0, 5.0
    else:  # "natural" (default fallback)
        mw = max_words or 6
        md = max_duration or 2.6
        ms = max_silence or 0.40

    if all_words and pacing_mode != "raw":
        segments_list = build_aligned_phrases(all_words, max_words=mw, max_duration=md, max_silence=ms, pacing_mode=pacing_mode)
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
