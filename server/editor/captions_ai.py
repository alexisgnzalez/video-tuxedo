"""
Captions & AI Transcription Engine for Tuxedo Editor.
Combines local Faster-Whisper transcription with optional Gemini Flash proofreading.
Preserves exact audio timestamps while enriching text and punctuation.
"""

import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

from server.editor.paths import get_project_dir
from server.editor.project import (
    Project,
    CaptionCue,
    CaptionWord,
    save_project,
    map_cues_to_timeline,
)
from server.subtitles import transcribe_media

logger = logging.getLogger("video_tuxedo.editor.captions")


def transcribe_project_audio(
    project: Project,
    model_size: str = "base",
    language: Optional[str] = None,
    pacing: str = "natural",
) -> List[CaptionCue]:
    """
    Transcribes project audio using local Faster-Whisper.
    If conformed video exists, transcribes conform.mp4 directly (already in timeline time).
    Otherwise, transcribes source video and maps timestamps through the EDL clips.
    """
    project_dir = get_project_dir(project.slug)

    # Check if conform video exists
    use_conform = bool(project.conform and project.conform.exists and (project_dir / "conform.mp4").exists())
    if use_conform:
        target_media = project_dir / "conform.mp4"
    elif project.source and project.source.webFile and (project_dir / project.source.webFile).exists():
        target_media = project_dir / project.source.webFile
    elif project.source and project.source.file and (project_dir / project.source.file).exists():
        target_media = project_dir / project.source.file
    elif (project_dir / "source_web.mp4").exists():
        target_media = project_dir / "source_web.mp4"
    elif (project_dir / "source.mp4").exists():
        target_media = project_dir / "source.mp4"
    else:
        source_candidates = list(project_dir.glob("source*"))
        if source_candidates:
            target_media = source_candidates[0]
        else:
            raise FileNotFoundError(f"Media file not found for transcription in {project_dir}")

    logger.info(f"Transcribing {target_media.name} (use_conform={use_conform}, model={model_size})...")

    result = transcribe_media(
        file_path=str(target_media),
        model_size=model_size,
        language=language,
        pacing=pacing,
    )

    raw_cues = result.get("segments", []) or result.get("cues", [])

    if use_conform:
        # Timestamps are already in timeline seconds
        timeline_cues: List[CaptionCue] = []
        for i, c in enumerate(raw_cues):
            words = [
                CaptionWord(
                    id=f"w_{i}_{w_idx}",
                    text=w.get("word", w.get("text", "")).strip(),
                    start=round(float(w.get("start", 0)), 3),
                    end=round(float(w.get("end", 0)), 3),
                )
                for w_idx, w in enumerate(c.get("words", []))
            ]
            timeline_cues.append(
                CaptionCue(
                    id=f"cue_{i+1}",
                    start=round(float(c.get("start", 0)), 3),
                    end=round(float(c.get("end", 0)), 3),
                    text=c.get("text", "").strip(),
                    words=words,
                )
            )
        project.captions.cues = timeline_cues
    else:
        # Cues are in source seconds -> map through EDL clips
        source_cue_dicts = []
        for i, c in enumerate(raw_cues):
            words = []
            for w_idx, w in enumerate(c.get("words", [])):
                w_text = w.get("word", w.get("text", "")).strip()
                words.append({
                    "id": f"w_{i}_{w_idx}",
                    "word": w_text,
                    "text": w_text,
                    "start": float(w.get("start", 0)),
                    "end": float(w.get("end", 0)),
                })
            source_cue_dicts.append({
                "id": f"cue_{i+1}",
                "start": float(c.get("start", 0)),
                "end": float(c.get("end", 0)),
                "text": c.get("text", "").strip(),
                "words": words,
            })
        project.captions.cues = map_cues_to_timeline(source_cue_dicts, project.clips)

    project.captions.engine = f"whisper-{model_size}"
    project.captions.enabled = True
    save_project(project)
    return project.captions.cues


def _load_gemini_key(provided_key: Optional[str] = None) -> Optional[str]:
    if provided_key:
        return provided_key
    if os.environ.get("GEMINI_API_KEY"):
        return os.environ["GEMINI_API_KEY"]
    root_env = Path(__file__).resolve().parent.parent.parent / ".env"
    if root_env.exists():
        try:
            for line in root_env.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    if k.strip() == "GEMINI_API_KEY":
                        val = v.strip().strip("'\"")
                        os.environ["GEMINI_API_KEY"] = val
                        return val
        except Exception:
            pass
    return None


def _apply_local_proofread(cues: List[CaptionCue]) -> None:
    """
    Offline local proofreader that capitalizes sentence starts, fixes punctuation,
    and identifies comedic punchline emphasis words across all cues.
    """
    stop_words = {
        "el", "la", "los", "las", "un", "una", "de", "del", "a", "al", "en", "con",
        "por", "para", "que", "y", "o", "no", "si", "se", "es", "me", "te", "le",
        "the", "a", "an", "in", "on", "at", "to", "for", "of", "and", "or", "is", "are"
    }

    for cue in cues:
        raw = cue.text.strip()
        if not raw:
            continue
        # Capitalize first letter
        fixed = raw[0].upper() + raw[1:] if len(raw) > 1 else raw.upper()
        if fixed and fixed[-1] not in ".?!…,:;¿¡":
            fixed += "."
        cue.text = fixed

        # Tag punchy words for emphasis
        if cue.words:
            candidates = [
                w for w in cue.words
                if w.text.lower().strip(".,!?:;¿¡") not in stop_words and len(w.text.strip(".,!?:;¿¡")) >= 4
            ]
            if candidates:
                candidates.sort(key=lambda w: len(w.text.strip(".,!?:;¿¡")), reverse=True)
                candidates[0].emphasis = True


def proofread_project_captions(
    project: Project,
    api_key: Optional[str] = None,
    style: str = "comedic",
) -> List[CaptionCue]:
    """
    Enriches and corrects subtitle cues using Gemini Flash with graceful local fallback.
    Strictly preserves audio synchronization while polishing punctuation, capitalization, and emphasis.
    """
    import re

    if not project.captions.cues:
        raise ValueError("Project has no caption cues to proofread.")

    gemini_key = _load_gemini_key(api_key)
    clean_map = {}

    if gemini_key:
        try:
            from google import genai

            client = genai.Client(api_key=gemini_key)
            model_names = [
                "gemini-2.5-flash-lite",
                "gemini-flash-latest",
                "gemini-3.1-flash-lite-preview",
                "gemini-3.5-flash-lite",
            ]

            all_cues = project.captions.cues
            batch_size = 30

            for b_idx in range(0, len(all_cues), batch_size):
                batch = all_cues[b_idx : b_idx + batch_size]
                input_payload = [{"id": cue.id, "text": cue.text} for cue in batch]

                prompt = f"""
You are an expert subtitle proofreader and comedic punchline polisher for short-form video.
Review the following subtitle cues (dialogue is Spanish or English):

Input Cues:
{json.dumps(input_payload, ensure_ascii=False, indent=2)}

INSTRUCTIONS:
1. Correct spelling errors, missing accents (tildes), correct punctuation, and casing.
2. Keep the natural spoken rhythm, colloquialisms, and humor intact. Do NOT over-formalize conversational slang.
3. For each cue, identify 1 or 2 high-impact or comedic words to place in an "emphasis" array.
4. CRITICAL: You MUST return a JSON list with the exact same number of items and matching "id" values.
5. Do NOT merge cues or delete cues.

Return JSON adhering strictly to:
[
  {{
    "id": "cue_1",
    "text": "Cleaned and punctuated text",
    "emphasis": ["word1"]
  }}
]
"""

                batch_res = None
                for m in model_names:
                    try:
                        res = client.models.generate_content(
                            model=m,
                            contents=prompt,
                        )
                        if res and res.text:
                            batch_res = res.text
                            break
                    except Exception as e:
                        logger.warning(f"Gemini model {m} call failed on batch {b_idx}: {e}")
                        break  # Don't spin retrying on overloaded server

                if not batch_res:
                    _apply_local_proofread(batch)
                    continue

                raw_text = batch_res.strip()
                raw_text = re.sub(r"^```[a-zA-Z]*\n?", "", raw_text)
                raw_text = re.sub(r"\n?```$", "", raw_text).strip()

                try:
                    parsed_items = json.loads(raw_text)
                    if isinstance(parsed_items, dict):
                        for key in ("cues", "subtitles", "items"):
                            if key in parsed_items and isinstance(parsed_items[key], list):
                                parsed_items = parsed_items[key]
                                break
                    if isinstance(parsed_items, list):
                        for item in parsed_items:
                            if isinstance(item, dict) and "id" in item:
                                clean_map[item["id"]] = item
                except Exception as parse_err:
                    logger.warning(f"Could not parse Gemini JSON response: {parse_err}")
                    _apply_local_proofread(batch)

        except Exception as exc:
            logger.warning(f"Gemini API initialization/call error: {exc}")

    for cue in project.captions.cues:
        if cue.id in clean_map:
            item = clean_map[cue.id]
            new_text = item.get("text", cue.text).strip()
            if new_text:
                cue.text = new_text

            emphasis_words = set(w.lower().strip(".,!?:;¿¡") for w in item.get("emphasis", []))
            for w in cue.words:
                clean_w = w.text.lower().strip(".,!?:;¿¡")
                if clean_w in emphasis_words:
                    w.emphasis = True
        else:
            _apply_local_proofread([cue])

    save_project(project)
    return project.captions.cues
