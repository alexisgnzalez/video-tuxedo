from __future__ import annotations

import os
import re
import json
import time
import uuid
import shutil
import unicodedata
import subprocess
from pathlib import Path
from typing import Optional, List, Dict, Any, Callable, Tuple

import cv2
import numpy as np

from server.magic_mask import get_yolo_seg_model, get_torch_device
from server.silence_cutter import get_media_properties, get_video_rotation
from server.subtitles import transcribe_media

BASE_DIR = Path(__file__).resolve().parent.parent
MOTION_STUDIO_DIR = BASE_DIR / "motion-studio"
REGISTRY_JSON_PATH = MOTION_STUDIO_DIR / "src" / "assets" / "registry.json"
PLANS_DIR = MOTION_STUDIO_DIR / "src" / "videos"
PLANS_DIR.mkdir(parents=True, exist_ok=True)
DOWNLOADS_DIR = Path.home() / "Downloads"

# In-memory background rendering tasks
_MOTION_TASKS: Dict[str, Dict[str, Any]] = {}


def normalize_text_for_matching(text: str) -> str:
    """Removes accents, punctuation, and converts to uppercase for robust keyword matching."""
    nfkd = unicodedata.normalize("NFKD", text)
    no_accents = "".join([c for c in nfkd if not unicodedata.combining(c)])
    clean = re.sub(r"[^\w\s]", " ", no_accents)
    return " " + clean.upper() + " "


# ==========================================
# 1. SRT Parser
# ==========================================

def srt_time_to_seconds(time_str: str) -> float:
    """Parses SRT timecode '00:01:23,456' to float seconds."""
    parts = time_str.strip().replace(",", ".").split(":")
    if len(parts) == 3:
        h = float(parts[0])
        m = float(parts[1])
        s = float(parts[2])
        return h * 3600.0 + m * 60.0 + s
    return 0.0


def parse_srt_file(srt_content: str, fps: float = 30.0) -> List[Dict[str, Any]]:
    """Converts SRT text into structured cue list with frame timings."""
    normalized = srt_content.replace("\r\n", "\n").replace("\r", "\n")
    blocks = re.split(r"\n\s*\n", normalized.strip())
    cues: List[Dict[str, Any]] = []

    for i, block in enumerate(blocks):
        lines = block.strip().split("\n")
        if len(lines) < 2:
            continue

        time_line_idx = 1
        try:
            cue_id = int(lines[0].strip())
        except ValueError:
            time_line_idx = 0
            cue_id = i + 1

        time_line = lines[time_line_idx] if time_line_idx < len(lines) else ""
        if "-->" not in time_line:
            continue

        start_str, end_str = time_line.split("-->")
        start_s = srt_time_to_seconds(start_str)
        end_s = srt_time_to_seconds(end_str)

        text_lines = lines[time_line_idx + 1 :]
        clean_text = re.sub(r"<[^>]+>", "", " ".join(text_lines)).strip()

        start_frame = int(round(start_s * fps))
        end_frame = max(start_frame + 1, int(round(end_s * fps)))

        # Approximate word timing
        raw_words = clean_text.split()
        cue_dur = max(0.1, end_s - start_s)
        word_dur = cue_dur / max(1, len(raw_words))

        words = [
            {
                "text": w,
                "start": round(start_s + w_idx * word_dur, 3),
                "end": round(start_s + (w_idx + 1) * word_dur, 3),
            }
            for w_idx, w in enumerate(raw_words)
        ]

        cues.append({
            "id": cue_id,
            "start": round(start_s, 3),
            "end": round(end_s, 3),
            "startFrame": start_frame,
            "endFrame": end_frame,
            "durationInFrames": end_frame - start_frame,
            "text": clean_text,
            "words": words,
        })

    return cues


# ==========================================
# 2. Keyframed Subject Tracking (YOLOv8-seg)
# ==========================================

def track_subject_motion(media_path: str, sample_interval_s: float = 1.0) -> List[Dict[str, Any]]:
    """
    Samples ~1 frame per second across the video using cached YOLOv8-seg.
    Detects person bounding box in 1080x1920 canvas coordinates.
    """
    if not os.path.exists(media_path):
        return []

    cap = cv2.VideoCapture(media_path)
    if not cap.isOpened():
        return []

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_s = total_frames / fps if fps > 0 else 0.0

    step_frames = max(1, int(round(sample_interval_s * fps)))
    track_samples: List[Dict[str, Any]] = []

    model = get_yolo_seg_model()
    device = get_torch_device()

    frame_idx = 0
    while frame_idx < total_frames:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame_bgr = cap.read()
        if not ret or frame_bgr is None:
            break

        orig_h, orig_w = frame_bgr.shape[:2]
        # Run person detection
        try:
            results = model.predict(
                frame_bgr,
                classes=[0],  # Person class in COCO
                device=device,
                verbose=False,
                conf=0.35,
            )

            boxes = results[0].boxes if results and len(results) > 0 else None
            if boxes is not None and len(boxes) > 0:
                # Pick largest detected person box
                best_box = None
                max_area = 0
                for box in boxes:
                    xyxy = box.xyxy[0].cpu().numpy()
                    w = xyxy[2] - xyxy[0]
                    h = xyxy[3] - xyxy[1]
                    area = w * h
                    if area > max_area:
                        max_area = area
                        best_box = xyxy

                if best_box is not None:
                    # Normalize to 1080x1920 coordinates
                    scale_x = 1080.0 / orig_w
                    scale_y = 1920.0 / orig_h
                    bx = int(round(best_box[0] * scale_x))
                    by = int(round(best_box[1] * scale_y))
                    bw = int(round((best_box[2] - best_box[0]) * scale_x))
                    bh = int(round((best_box[3] - best_box[1]) * scale_y))

                    track_samples.append({
                        "t": round(frame_idx / fps, 2),
                        "x": max(0, min(1080, bx)),
                        "y": max(0, min(1920, by)),
                        "w": max(50, min(1080, bw)),
                        "h": max(100, min(1920, bh)),
                    })
        except Exception as e:
            print(f"⚠️ Tracking sample error at frame {frame_idx}: {e}")

        frame_idx += step_frames

    cap.release()
    print(f"🎯 Subject tracking collected {len(track_samples)} keyframe samples across {duration_s:.1f}s")
    return track_samples


# ==========================================
# 3. Spanish Rule Engine & Plan Drafter
# ==========================================

# Spanish keyword regex patterns mapping to components and zones
RULE_DEFINITIONS = [
    {
        "id": "self_intro",
        "patterns": [r"\bME LLAMO\b", r"\bMI NOMBRE ES\b", r"\bSOY\b"],
        "component": "BrutalistLowerThird",
        "zone": "B",
        "durationFrames": 120,
        "sfx": [{"id": "SFX_BRUTAL_THUD", "at": 0}],
        "extractProps": lambda text, m: {
            "text": text.split(".")[0].strip()[:32] if "." in text else text[:32],
            "subtext": "VIDEO TUXEDO",
            "category": "PRESENTACIÓN",
        },
    },
    {
        "id": "numbers_stats",
        "patterns": [r"%", r"\bPOR CIENTO\b", r"\bMILLON\b", r"\bMILLONES\b", r"\bMIL\b", r"\$\d+"],
        "component": "CruzDiezBadge",
        "zone": "R",
        "durationFrames": 100,
        "sfx": [{"id": "SFX_PAPER_SNAP", "at": 0}],
        "extractProps": lambda text, m: {
            "title": m.group(0).strip(),
            "subtitle": "ESTADÍSTICA",
            "size": 280,
        },
    },
    {
        "id": "enumeration",
        "patterns": [r"\bPRIMERO\b", r"\bSEGUNDO\b", r"\bTERCERO\b", r"\bPASO\b", r"\bCONSEJO\b", r"\bPUNTO\b"],
        "component": "AvilaFacetCard",
        "zone": "T",
        "durationFrames": 150,
        "sfx": [{"id": "SFX_PAPER_SNAP", "at": 0}, {"id": "SFX_TYPE_CLACK", "at": 20}],
        "extractProps": lambda text, m: {
            "heading": "PUNTO CLAVE",
            "subheading": m.group(0).strip(),
            "bullets": [text[:55], "Fundamento esencial", "Resultado esperado"],
            "width": 540,
        },
    },
    {
        "id": "topic_transition",
        "patterns": [r"\bENTONCES\b", r"\bAHORA VAMOS\b", r"\bLO SIGUIENTE\b", r"\bPOR ULTIMO\b", r"\bEN RESUMEN\b"],
        "component": "ViaductProgress",
        "zone": "T",
        "durationFrames": 120,
        "sfx": [{"id": "SFX_WIRE_SWISH", "at": 0}],
        "extractProps": lambda text, m: {
            "progress": 0.5,
            "chapters": ["INTRO", "IDEA", "CLAVE", "CIERRE"],
            "activeChapterIndex": 1,
            "width": 940,
        },
    },
    {
        "id": "emphasis_alert",
        "patterns": [r"\bIMPORTANTE\b", r"\bCLAVE\b", r"\bNUNCA\b", r"\bSECRETO\b", r"\bOJO\b", r"\bCUIDADO\b"],
        "component": "CruzDiezWall",
        "zone": "B",
        "durationFrames": 90,
        "sfx": [{"id": "SFX_KINETIC_HUM", "at": 0}],
        "extractProps": lambda text, m: {
            "width": 640,
            "height": 160,
            "speed": 22,
        },
    },
    {
        "id": "deictic_look",
        "patterns": [r"\bMIRA\b", r"\bESTO\b", r"\bAQUI\b", r"\bFIJATE\b", r"\bOBSERVA\b"],
        "component": "GegoMeshPointer",
        "zone": "L",
        "durationFrames": 90,
        "sfx": [{"id": "SFX_WIRE_SWISH", "at": 0}],
        "extractProps": lambda text, m: {
            "start": [180, 420],
            "end": [450, 240],
            "lineCount": 12,
        },
    },
]


def draft_scene_plan_from_srt(
    cues: List[Dict[str, Any]],
    fps: float = 30.0,
    duration_frames: int = 300,
    platform: str = "tiktok_reels",
    subject_track: Optional[List[Dict[str, Any]]] = None,
    seed: int = 1957,
) -> Dict[str, Any]:
    """
    Spanish Rule Engine: scans cues and drafts a compliant Scene Plan JSON.
    Enforces minimum scene gaps, zone collision avoidance, and duration bounds.
    """
    scenes: List[Dict[str, Any]] = []
    occupied_zones: Dict[str, int] = {}  # zone -> last end frame

    for cue in cues:
        norm_text = normalize_text_for_matching(cue["text"])
        start_frame = cue["startFrame"]

        for rule in RULE_DEFINITIONS:
            matched = False
            match_obj = None

            for pat in rule["patterns"]:
                m = re.search(pat, norm_text)
                if m:
                    matched = True
                    match_obj = m
                    break

            if matched and match_obj:
                zone = rule["zone"]
                dur = rule["durationFrames"]
                end_frame = min(duration_frames, start_frame + dur)

                # Check zone collision cooldown (at least 30 frames gap in same zone)
                last_end = occupied_zones.get(zone, -999)
                if start_frame < last_end + 30:
                    continue  # Zone is currently busy

                # Extract typed props
                props = rule["extractProps"](cue["text"], match_obj)

                # Add variant to SFX cues
                sfx_list = []
                for s in rule["sfx"]:
                    sfx_list.append({
                        "id": s["id"],
                        "at": s.get("at", 0),
                        "variant": (len(scenes) % 4) + 1,
                        "volume": 0.35,
                    })

                scene_obj = {
                    "id": f"scene_{len(scenes) + 1}",
                    "component": rule["component"],
                    "zone": zone,
                    "from": start_frame,
                    "durationInFrames": end_frame - start_frame,
                    "props": props,
                    "sfx": sfx_list,
                    "trigger": f"srt#{cue['id']}: '{match_obj.group(0).strip()}'",
                    "source": "rules",
                }

                scenes.append(scene_obj)
                occupied_zones[zone] = end_frame
                break  # Max 1 graphic trigger per subtitle cue

    # Always insert a title opening card at start if none exists
    if not any(s["component"] == "PosterTitleCard" for s in scenes):
        title_dur = min(120, int(round(fps * 3.5)))
        scenes.insert(0, {
            "id": "scene_title_intro",
            "component": "PosterTitleCard",
            "zone": "T",
            "from": 10,
            "durationInFrames": title_dur,
            "props": {
                "title": "CARACAS",
                "subtitle": "EL ÁVILA Y SU CINETISMO",
                "width": 960,
                "height": 320,
            },
            "sfx": [{"id": "SFX_PAPER_SNAP", "at": 0, "variant": 1, "volume": 0.35}],
            "trigger": "intro_opener",
            "source": "rules",
        })

    plan = {
        "version": 1,
        "slug": f"video_{int(time.time())}",
        "fps": fps,
        "width": 1080,
        "height": 1920,
        "durationInFrames": duration_frames,
        "mode": "z-foreground",
        "platform": platform,
        "seed": seed,
        "subjectTrack": subject_track or [],
        "subjectOverride": "auto",
        "scenes": scenes,
        "captions": {
            "enabled": False,
            "cues": cues,
        },
        "plate": {
            "variant": "avila",
            "title": "CARACAS",
            "subtitle": "EL ÁVILA Y SU CINETISMO",
        },
        "source": {},
    }

    return plan


# ==========================================
# 4. Remotion CLI Render Runner
# ==========================================

def run_remotion_render(
    plan: Dict[str, Any],
    output_filename: Optional[str] = None,
    progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    cancel_check: Optional[Callable[[], bool]] = None,
) -> Dict[str, Any]:
    """
    Renders the composition via Remotion CLI with Apple ProRes 4444 and 10-bit Alpha.
    Saves automatically to ~/Downloads/.
    """
    slug = plan.get("slug") or f"motion_{int(time.time())}"
    plan_file = PLANS_DIR / f"{slug}_plan.json"
    with open(plan_file, "w", encoding="utf-8") as f:
        json.dump(plan, f, indent=2, ensure_ascii=False)

    clean_name = (output_filename or f"{slug}_prores4444.mov").replace(".mp4", ".mov")
    dest_downloads = DOWNLOADS_DIR / clean_name
    dest_exports = BASE_DIR / "exports" / clean_name

    cmd = [
        "npx",
        "remotion",
        "render",
        "src/index.ts",
        "TalkingHeadOverlay",
        str(dest_exports),
        f"--props={str(plan_file)}",
        "--codec=prores",
        "--prores-profile=4444",
        "--pixel-format=yuva444p10le",
        "--overwrite",
    ]

    print(f"🚀 Running Remotion render command in {MOTION_STUDIO_DIR}...")
    start_time = time.time()

    process = subprocess.Popen(
        cmd,
        cwd=str(MOTION_STUDIO_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    total_frames = plan.get("durationInFrames", 300)
    current_frame = 0

    if process.stdout:
        for line in process.stdout:
            if cancel_check and cancel_check():
                process.terminate()
                raise InterruptedError("Render cancelled by user")

            # Parse Remotion CLI progress output: e.g. "Rendered frame 45/300 (15%)"
            m = re.search(r"Rendered frame (\d+)/(\d+)", line)
            if m:
                current_frame = int(m.group(1))
                tot = int(m.group(2))
                pct = round((current_frame / max(1, tot)) * 100.0, 1)
                elapsed = time.time() - start_time
                fps_rate = round(current_frame / max(0.01, elapsed), 1)
                eta = round((tot - current_frame) / max(0.01, fps_rate), 1)

                if progress_callback:
                    progress_callback({
                        "frame": current_frame,
                        "total_frames": tot,
                        "percent": pct,
                        "fps": fps_rate,
                        "elapsed_s": round(elapsed, 1),
                        "eta_s": eta,
                    })

    ret_code = process.wait()
    if ret_code != 0:
        raise RuntimeError(f"Remotion render failed with exit code {ret_code}")

    # Copy to ~/Downloads
    try:
        shutil.copyfile(dest_exports, dest_downloads)
        print(f"📁 Auto-saved rendered ProRes 4444 to ~/Downloads: {dest_downloads}")
    except Exception as e:
        print(f"⚠️ Could not copy to ~/Downloads: {e}")

    render_dur = round(time.time() - start_time, 2)
    file_size_mb = (
        round(os.path.getsize(dest_exports) / (1024 * 1024), 2)
        if dest_exports.exists()
        else 0.0
    )

    return {
        "status": "success",
        "output_path": str(dest_downloads if dest_downloads.exists() else dest_exports),
        "downloads_path": str(dest_downloads),
        "exports_path": str(dest_exports),
        "filename": clean_name,
        "render_time_s": render_dur,
        "file_size_mb": file_size_mb,
        "total_frames": total_frames,
    }
