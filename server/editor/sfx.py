"""
DaVinci Resolve SFX Library Manager & Sound Engine for Video Tuxedo.
Indexes, categorizes, and streams 290+ high-fidelity sound effects from
the local DaVinci Resolve Course Material library for Remotion motion graphics.
"""

from __future__ import annotations

import os
import urllib.parse
from pathlib import Path
from typing import Any, Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parent.parent.parent
MOTION_PUBLIC_DIR = BASE_DIR / "motion-studio" / "public"
SFX_DIR = MOTION_PUBLIC_DIR / "sfx"
DAVINCI_SYMLINK = SFX_DIR / "davinci"

DEFAULT_DAVINCI_DIR = Path("/Users/alexisgonzalez/Movies/Davinci Resolve Course Material/Video and Audio SFX/Audio")

# Audio formats supported by browsers & Remotion
SUPPORTED_EXTS = {".wav", ".mp3", ".aif", ".aiff", ".mp4", ".m4a"}

_CACHED_CATALOG: Optional[Dict[str, Any]] = None
_CACHED_MTIME: float = 0.0


def ensure_davinci_symlink(source_dir: Optional[Path] = None) -> Path:
    """Ensures motion-studio/public/sfx/davinci symlink points to the source directory."""
    target_dir = source_dir or DEFAULT_DAVINCI_DIR
    SFX_DIR.mkdir(parents=True, exist_ok=True)
    if target_dir.exists():
        try:
            if DAVINCI_SYMLINK.is_symlink() or DAVINCI_SYMLINK.exists():
                if DAVINCI_SYMLINK.resolve() != target_dir.resolve():
                    DAVINCI_SYMLINK.unlink()
                    DAVINCI_SYMLINK.symlink_to(target_dir, target_is_directory=True)
            else:
                DAVINCI_SYMLINK.symlink_to(target_dir, target_is_directory=True)
        except Exception as e:
            print(f"⚠️ Could not maintain DaVinci SFX symlink: {e}")
    return target_dir


def categorize_sfx(rel_path_str: str) -> str:
    """Categorizes sound effects based on folder path and filename."""
    lower = rel_path_str.lower()
    if "whoosh" in lower or "reverse whoos" in lower or "whooshes" in lower:
        return "Whooshes & Swishes"
    if "impact" in lower:
        return "Impacts & Hits"
    if "punch" in lower:
        return "Punches & Thuds"
    if "twirl" in lower:
        return "Twirls & Movement"
    if "keyboard" in lower or "typing" in lower:
        return "Keyboard & Typing"
    if "ambience" in lower or "forest" in lower or "city" in lower or "ocean" in lower or "traffic" in lower:
        return "Ambience & Atmosphere"
    if "ding" in lower or "pop" in lower or "bell" in lower or "bleep" in lower:
        return "UI, Dings & Alerts"
    if "camera" in lower or "photo" in lower or "shutter" in lower:
        return "Camera & Optics"
    return "Miscellaneous"


def get_sfx_catalog(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Returns full categorized catalog of all SFX audio files.
    Cached in memory for instant API queries.
    """
    global _CACHED_CATALOG, _CACHED_MTIME

    source_dir = ensure_davinci_symlink()
    if not source_dir.exists():
        return {
            "source_directory": str(source_dir),
            "exists": False,
            "total_count": 0,
            "categories": [],
        }

    current_mtime = source_dir.stat().st_mtime
    if not force_refresh and _CACHED_CATALOG is not None and abs(current_mtime - _CACHED_MTIME) < 0.1:
        return _CACHED_CATALOG

    items_by_cat: Dict[str, List[Dict[str, Any]]] = {}
    total = 0

    # Scan recursive files
    for root, _, files in os.walk(source_dir):
        for f in sorted(files):
            if f.startswith("."):
                continue
            ext = os.path.splitext(f)[1].lower()
            if ext in SUPPORTED_EXTS:
                full_path = Path(root) / f
                rel_path = full_path.relative_to(source_dir)
                rel_str = str(rel_path).replace("\\", "/")
                cat = categorize_sfx(rel_str)

                clean_name = os.path.splitext(f)[0]
                # Format url for FastAPI /sfx mount
                encoded_rel = "/".join(urllib.parse.quote(part) for part in rel_str.split("/"))
                audio_url = f"/sfx/davinci/{encoded_rel}"
                sfx_id = f"davinci/{rel_str}"

                item = {
                    "id": sfx_id,
                    "name": clean_name,
                    "filename": f,
                    "category": cat,
                    "url": audio_url,
                    "format": ext.lstrip("."),
                    "size_bytes": full_path.stat().st_size,
                    "relative_path": rel_str,
                }

                items_by_cat.setdefault(cat, []).append(item)
                total += 1

    # Order categories logically
    category_order = [
        "Whooshes & Swishes",
        "Impacts & Hits",
        "Punches & Thuds",
        "Twirls & Movement",
        "UI, Dings & Alerts",
        "Camera & Optics",
        "Keyboard & Typing",
        "Miscellaneous",
        "Ambience & Atmosphere",
    ]

    categories = []
    for cat_name in category_order:
        if cat_name in items_by_cat:
            categories.append({
                "name": cat_name,
                "count": len(items_by_cat[cat_name]),
                "items": items_by_cat[cat_name],
            })

    # Include any remaining categories
    for cat_name, items in items_by_cat.items():
        if cat_name not in category_order:
            categories.append({
                "name": cat_name,
                "count": len(items),
                "items": items,
            })

    # Curated recommendations for Remotion components
    recommendations = {
        "KineticTitleBehind": [
            "davinci/WHOOSHES/Whoosh 17 (fast).wav",
            "davinci/WHOOSHES/Whoosh 26 (whip).wav",
            "davinci/2. Transition Noises/1. Whooshes/Whoosh 8 (favorite).wav",
            "davinci/2. Transition Noises/1. Whooshes/Whoosh 10 (full).wav",
        ],
        "KineticHeader": [
            "davinci/WHOOSHES/Whoosh 17 (fast).wav",
            "davinci/WHOOSHES/Whoosh 48.wav",
            "davinci/2. Transition Noises/1. Whooshes/Whoosh 1.wav",
        ],
        "PunchlinePopup": [
            "davinci/2. Transition Noises/2. Impacts/Impact 4 (good bite).wav",
            "davinci/2. Transition Noises/3. Punches/Punch 10 (clean).wav",
            "davinci/5. Miscellaneous/Camera sound effects.mp3",
            "davinci/5. Miscellaneous/Ding Sound Effect.mp3",
            "davinci/2. Transition Noises/2. Impacts/Impact 7.wav",
        ],
        "ComicAlertBanner": [
            "davinci/2. Transition Noises/2. Impacts/Impact 1 (fear).wav",
            "davinci/2. Transition Noises/3. Punches/Punch 8.wav",
            "davinci/5. Miscellaneous/Camera sound effects.mp3",
        ],
        "EditorialLowerThird": [
            "davinci/Whoosh-pass by/MA_Amenteramco_Whoosh_Pass-By_1.wav",
            "davinci/2. Transition Noises/4. Twirls/Twirl 1.wav",
            "davinci/5. Miscellaneous/Menu Selection Sounds Sound Effect.mp3",
        ],
        "SubtlePill": [
            "davinci/5. Miscellaneous/Ding Sound Effect.mp3",
            "davinci/2. Transition Noises/4. Twirls/Twirl 3.wav",
            "davinci/Whoosh-pass by/MA_Amenteramco_Whoosh_Pass-By_5.wav",
        ],
        "ModernistPlate": [
            "davinci/2. Transition Noises/4. Twirls/Twirl 8.wav",
            "davinci/2. Transition Noises/1. Whooshes/Whoosh 4.wav",
            "davinci/5. Miscellaneous/Menu Selection Sounds Sound Effect.mp3",
        ],
    }

    _CACHED_CATALOG = {
        "source_directory": str(source_dir),
        "exists": True,
        "total_count": total,
        "categories": categories,
        "recommendations": recommendations,
    }
    _CACHED_MTIME = current_mtime
    return _CACHED_CATALOG
