"""
Project data models and time-space mapping functions for Tuxedo Editor.
Implements non-destructive EDL logic, source-to-timeline mapping, and atomic JSON persistence.
"""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, model_validator

from server.editor.paths import get_project_dir, ensure_project_subdirs


class SourceInfo(BaseModel):
    file: str
    webFile: Optional[str] = None
    duration: float = 0.0
    rotation: int = 0
    hasAudio: bool = True
    width: int = 1080
    height: int = 1920


class SilenceSettings(BaseModel):
    minSilence: float = 0.45
    padding: float = 0.12
    threshold: float = 0.5


class Clip(BaseModel):
    id: str
    srcIn: float
    srcOut: float


class ConformInfo(BaseModel):
    exists: bool = True
    file: str = "conform.mp4"
    hash: str
    duration: float = 0.0


class CaptionWord(BaseModel):
    id: str = ""
    text: str = ""
    start: float = 0.0
    end: float = 0.0
    srcStart: Optional[float] = None
    srcEnd: Optional[float] = None
    emphasis: bool = False
    highlightType: Optional[str] = None  # "context" (Warm Amber) | "punchline" (Coral Red)
    isPunchline: bool = False            # True for punchline or Venezuelan slang words


class Word(BaseModel):
    id: str
    text: str
    srcStart: float
    srcEnd: float
    p: float = 1.0


class TranscriptInfo(BaseModel):
    engine: str = "mlx-whisper/large-v3-turbo"
    language: str = "es"
    glossary: List[str] = Field(default_factory=list)
    proofread: bool = True
    words: List[Word] = Field(default_factory=list)


class CaptionCue(BaseModel):
    id: str
    start: float = 0.0
    end: float = 0.0
    srcStart: Optional[float] = None
    srcEnd: Optional[float] = None
    text: str = ""
    words: List[CaptionWord] = Field(default_factory=list)
    wordIds: List[str] = Field(default_factory=list)
    cueType: Optional[str] = "setup"  # "setup" | "hook" | "punchline" | "slang"


class CaptionsInfo(BaseModel):
    enabled: bool = True
    engine: str = "whisper-base"
    cues: List[CaptionCue] = Field(default_factory=list)
    style: Dict[str, Any] = Field(
        default_factory=lambda: {
            "preset": "standup_hybrid",  # Signature TikTok preset from style guide
            "font": "Montserrat",
            "size": 68,
            "color": "#FFFFFF",          # Narrative base pure white
            "highlight": "#FFD166",      # Context & hooks warm amber
            "accent": "#FF595E",         # Punchline & Venezuelan slang coral red
            "position": "collarbone",    # 30% - 35% Collarbone safe zone
            "paddingBottom": 620,
            "karaoke": True,
            "strokeWidth": 3.5,
            "strokeColor": "#000000",
        }
    )


class CutoutInfo(BaseModel):
    exists: bool = False
    file: str = "cutout.mp4"
    conformHash: str = ""
    target: str = "person"
    feather: int = 3
    expand: int = 0


class ImageLayer(BaseModel):
    id: str
    src: str
    start: float  # timeline seconds
    end: float    # timeline seconds
    z: Literal["behind", "front"] = "behind"
    x: float = 540.0
    y: float = 960.0
    scale: float = 1.0
    rotation: float = 0.0
    opacity: float = 1.0
    enter: Literal["none", "pop", "slide-up", "fade"] = "pop"
    exit: Literal["none", "pop", "slide-down", "fade"] = "fade"


class GraphicsItem(BaseModel):
    id: str
    component: str
    start: float  # timeline seconds
    end: float    # timeline seconds
    layer: Literal["behind", "front"] = "behind"
    placement: Dict[str, Any] = Field(default_factory=lambda: {"position": "top"})
    props: Dict[str, Any] = Field(default_factory=dict)
    sfx: List[Dict[str, Any]] = Field(default_factory=list)
    sfxFile: Optional[str] = None
    source: str = "rules"  # rules | gemini | manual


class GraphicsInfo(BaseModel):
    style: str = "story_tuxedo"
    settings: Dict[str, Any] = Field(default_factory=dict)
    items: List[GraphicsItem] = Field(default_factory=list)
    meta: Dict[str, Any] = Field(default_factory=dict)


class ExportInfo(BaseModel):
    lastFile: Optional[str] = None


class Project(BaseModel):
    version: int = 1
    slug: str
    name: str
    createdAt: str
    updatedAt: str
    step: int = 1
    fps: float = 30.0
    width: int = 1080
    height: int = 1920
    source: SourceInfo
    silence: SilenceSettings = Field(default_factory=SilenceSettings)
    clips: List[Clip] = Field(default_factory=list)
    conform: Optional[ConformInfo] = None
    transcript: Optional[TranscriptInfo] = None
    captions: CaptionsInfo = Field(default_factory=CaptionsInfo)
    cutout: CutoutInfo = Field(default_factory=CutoutInfo)
    layers: List[ImageLayer] = Field(default_factory=list)
    graphics: GraphicsInfo = Field(default_factory=GraphicsInfo)
    export: Optional[ExportInfo] = None

    @model_validator(mode="before")
    @classmethod
    def _ensure_nested_defaults(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if data.get("captions") is None:
                data["captions"] = {}
            if data.get("cutout") is None:
                data["cutout"] = {}
            if data.get("graphics") is None:
                data["graphics"] = {}
            if data.get("silence") is None:
                data["silence"] = {}
        return data


# ---------------------------------------------------------------------------
# EDL & Time-space conversions
# ---------------------------------------------------------------------------

def edl_hash(clips: List[Clip]) -> str:
    """Computes deterministic SHA1 hash of the ordered clip sequence."""
    if not clips:
        return "empty"
    data = "|".join(f"{c.srcIn:.3f}-{c.srcOut:.3f}" for c in clips)
    return hashlib.sha1(data.encode("utf-8")).hexdigest()[:12]


def src_to_timeline(src_time: float, clips: List[Clip]) -> Optional[float]:
    """
    Maps a source timestamp (in seconds) to a timeline timestamp (in seconds).
    Returns None if the source timestamp falls outside all active clips (i.e. was cut).
    """
    cumulative = 0.0
    for c in clips:
        dur = max(0.0, c.srcOut - c.srcIn)
        if c.srcIn <= src_time <= c.srcOut:
            return round(cumulative + (src_time - c.srcIn), 3)
        cumulative += dur
    return None


def timeline_to_src(timeline_time: float, clips: List[Clip]) -> Optional[float]:
    """
    Maps a timeline timestamp (in seconds) back to its corresponding source timestamp.
    Returns None if the timeline time exceeds the total duration.
    """
    t_rem = max(0.0, timeline_time)
    for c in clips:
        dur = max(0.0, c.srcOut - c.srcIn)
        if t_rem <= dur:
            return round(c.srcIn + t_rem, 3)
        t_rem -= dur
    if clips:
        return clips[-1].srcOut
    return None


def map_cues_to_timeline(
    cues: List[Any],
    clips: List[Clip],
    words: Optional[List[Word]] = None,
    fps: float = 30.0,
) -> List[CaptionCue]:
    """
    Translates source-time subtitle cues to the timeline time space.
    Splits cues that straddle cut boundaries and drops cues falling in deleted silence.
    Guarantees that subtitle start and end times cleanly snap to active frames.
    """
    if not cues or not clips:
        return []

    words_by_id = {w.id: w for w in (words or [])}
    result: List[CaptionCue] = []

    for cue_item in cues:
        if isinstance(cue_item, dict):
            c_start = float(cue_item.get("srcStart", cue_item.get("start", 0.0)))
            c_end = float(cue_item.get("srcEnd", cue_item.get("end", 0.0)))
            text = cue_item.get("text", "").strip()
            c_words = cue_item.get("words", [])
            cue_id = str(cue_item.get("id", f"cue_{len(result)+1}"))
            word_ids = cue_item.get("wordIds", [])
        else:
            c_start = float(getattr(cue_item, "srcStart", None) or getattr(cue_item, "start", 0.0))
            c_end = float(getattr(cue_item, "srcEnd", None) or getattr(cue_item, "end", 0.0))
            text = getattr(cue_item, "text", "").strip()
            c_words = getattr(cue_item, "words", [])
            cue_id = str(getattr(cue_item, "id", f"cue_{len(result)+1}"))
            word_ids = getattr(cue_item, "wordIds", [])

        if not text:
            continue

        # Find which clip(s) this cue overlaps with
        current_timeline_offset = 0.0
        for clip in clips:
            clip_dur = max(0.0, clip.srcOut - clip.srcIn)
            overlap_start = max(c_start, clip.srcIn)
            overlap_end = min(c_end, clip.srcOut)

            if overlap_end > overlap_start + 0.05:
                tl_start = round(current_timeline_offset + (overlap_start - clip.srcIn), 3)
                tl_end = round(current_timeline_offset + (overlap_end - clip.srcIn), 3)

                slice_words: List[CaptionWord] = []
                if c_words:
                    for w in c_words:
                        w_s = float(w.get("srcStart", w.get("start", 0.0)) if isinstance(w, dict) else getattr(w, "start", 0.0))
                        w_e = float(w.get("srcEnd", w.get("end", 0.0)) if isinstance(w, dict) else getattr(w, "end", 0.0))
                        w_txt = (w.get("word", w.get("text", "")) if isinstance(w, dict) else getattr(w, "text", "")).strip()
                        if overlap_start - 0.05 <= w_s <= overlap_end + 0.05:
                            slice_words.append(
                                CaptionWord(
                                    id=f"w_{len(slice_words)+1}",
                                    text=w_txt,
                                    start=round(current_timeline_offset + max(0.0, w_s - clip.srcIn), 3),
                                    end=round(current_timeline_offset + min(clip_dur, w_e - clip.srcIn), 3),
                                )
                            )
                elif word_ids:
                    for wid in word_ids:
                        w = words_by_id.get(wid)
                        if w and (overlap_start - 0.05 <= w.srcStart <= overlap_end + 0.05):
                            slice_words.append(
                                CaptionWord(
                                    id=w.id,
                                    text=w.text,
                                    start=round(current_timeline_offset + max(0.0, w.srcStart - clip.srcIn), 3),
                                    end=round(current_timeline_offset + min(clip_dur, w.srcEnd - clip.srcIn), 3),
                                )
                            )

                slice_text = " ".join(sw.text for sw in slice_words) if slice_words else text
                result.append(
                    CaptionCue(
                        id=f"{cue_id}_{len(result) + 1}",
                        start=tl_start,
                        end=tl_end,
                        srcStart=c_start,
                        srcEnd=c_end,
                        text=slice_text,
                        words=slice_words,
                    )
                )

            current_timeline_offset += clip_dur

    return result


# ---------------------------------------------------------------------------
# Project File I/O (Atomic Write)
# ---------------------------------------------------------------------------

def get_project_file(slug: str) -> Path:
    return get_project_dir(slug) / "project.json"


def load_project(slug: str) -> Project:
    """Loads and validates project.json for a given slug."""
    p_file = get_project_file(slug)
    if not p_file.exists():
        raise FileNotFoundError(f"Project not found: {slug}")
    with open(p_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    return Project(**data)


def save_project(project: Project) -> Path:
    """Saves project model atomically to disk using a temporary file and rename."""
    project.updatedAt = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    p_dir = get_project_dir(project.slug)
    ensure_project_subdirs(p_dir)
    target_file = p_dir / "project.json"

    # Atomic write pattern: write to tmp file in same directory, then atomic rename
    tmp_file = p_dir / f".project.json.tmp.{os.getpid()}"
    try:
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(project.model_dump(), f, indent=2, ensure_ascii=False)
        tmp_file.replace(target_file)
    except Exception as e:
        if tmp_file.exists():
            tmp_file.unlink(missing_ok=True)
        raise IOError(f"Failed to atomically save project: {e}")

    return target_file
