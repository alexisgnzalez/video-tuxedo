from __future__ import annotations

import os
import re
import json
import time
import shutil
import tempfile
import urllib.parse
import uuid
from threading import Thread
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from server.davinci import format_davinci_srt, format_webvtt, DAVINCI_IMPORT_GUIDE, DAVINCI_MAGIC_MASK_GUIDE
from server.subtitles import transcribe_media
from server.silence_cutter import (
    detect_silence_and_speech,
    render_single_cut_video,
    render_multipart_takes,
    export_davinci_edl,
    export_davinci_fcpxml,
    export_davinci_xmeml,
    remap_subtitles_to_cut_timeline,
    get_media_properties,
)
from server.magic_mask import (
    extract_frame_at_timestamp,
    segment_frame_preview,
    rotoscope_and_render_video,
    get_video_info,
)
from server.motion_graphics import (
    parse_srt_file,
    track_subject_motion,
    draft_scene_plan_from_srt,
    run_remotion_render,
    stage_media_for_remotion,
    REGISTRY_JSON_PATH,
    PLANS_DIR,
    _MOTION_TASKS,
)
from server.director_agent import generate_director_plan


app = FastAPI(
    title="Video Tuxedo",
    description="Video editing productivity tools suite",
    version="0.4.0"
)


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
UPLOAD_DIR = BASE_DIR / "temp_media"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MOTION_PUBLIC_DIR = BASE_DIR / "motion-studio" / "public"
MOTION_PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
SFX_DIR = MOTION_PUBLIC_DIR / "sfx"
SFX_DIR.mkdir(parents=True, exist_ok=True)

# Auto-load .env into environment
env_file = BASE_DIR / ".env"
if env_file.exists():
    try:
        with open(env_file, "r", encoding="utf-8") as ef:
            for line in ef:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ[k.strip()] = v.strip().strip('"').strip("'")
    except Exception as e:
        print(f"⚠️ Error loading .env: {e}")

# Mount static and public files
app.mount("/static", StaticFiles(directory=str(STATIC_DIR), follow_symlink=True), name="static")
app.mount("/public", StaticFiles(directory=str(MOTION_PUBLIC_DIR), follow_symlink=True), name="public")
app.mount("/sfx", StaticFiles(directory=str(SFX_DIR), follow_symlink=True), name="sfx")
app.mount("/temp_media", StaticFiles(directory=str(UPLOAD_DIR), follow_symlink=True), name="temp_media")



class SegmentsExportRequest(BaseModel):
    segments: List[Dict[str, Any]]
    filename: Optional[str] = "video_tuxedo_subtitles"


class LocalFileTranscribeRequest(BaseModel):
    file_path: str
    model_size: Optional[str] = "base"
    language: Optional[str] = None
    task: Optional[str] = "transcribe"
    pacing: Optional[str] = "natural"


class ResegmentRequest(BaseModel):
    words: List[Dict[str, Any]]
    pacing: Optional[str] = "natural"
    max_words: Optional[int] = None
    max_duration: Optional[float] = None
    max_silence: Optional[float] = None


class SilenceDetectPathRequest(BaseModel):
    file_path: str
    min_silence_duration: Optional[float] = 0.45
    speech_padding: Optional[float] = 0.12
    vad_threshold: Optional[float] = 0.5


class SilenceRenderSingleRequest(BaseModel):
    media_path: str
    speech_segments: List[Dict[str, Any]]
    filename: Optional[str] = None


class SilenceRenderMultipartRequest(BaseModel):
    media_path: str
    speech_segments: List[Dict[str, Any]]
    folder_name: Optional[str] = None


class SilenceExportTimelineRequest(BaseModel):
    media_path: str
    speech_segments: List[Dict[str, Any]]
    export_type: Optional[str] = "both"  # "xml", "fcpxml", "edl", or "both"
    filename: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None


class SilenceSyncSubtitlesRequest(BaseModel):
    media_path: str
    speech_segments: List[Dict[str, Any]]
    subtitle_cues: Optional[List[Dict[str, Any]]] = None
    filename: Optional[str] = None


class MagicMaskExtractFrameRequest(BaseModel):
    media_path: str
    timestamp_s: Optional[float] = 0.0


class MagicMaskPreviewRequest(BaseModel):
    media_path: str
    timestamp_s: float
    points: Optional[List[List[float]]] = None
    labels: Optional[List[int]] = None
    bbox: Optional[List[float]] = None
    feather: Optional[int] = 3
    expand: Optional[int] = 0
    invert: Optional[bool] = False
    target_type: Optional[str] = "person"


class MagicMaskTrackRenderRequest(BaseModel):
    media_path: str
    points: Optional[List[List[float]]] = None
    labels: Optional[List[int]] = None
    bbox: Optional[List[float]] = None
    export_mode: Optional[str] = "prores_alpha"
    feather: Optional[int] = 3
    expand: Optional[int] = 0
    invert: Optional[bool] = False
    target_type: Optional[str] = "person"
    start_time: Optional[float] = 0.0
    end_time: Optional[float] = None
    filename: Optional[str] = None


class MotionLoadMediaRequest(BaseModel):
    file_path: str
    srt_path: Optional[str] = None
    director_style: Optional[str] = "story_tuxedo"
    render_mode: Optional[str] = "overlays_only_for_davinci"
    mask_video_filename: Optional[str] = None


class MotionDraftPlanRequest(BaseModel):
    media_path: Optional[str] = None
    srt_content: Optional[str] = None
    cues: Optional[List[Dict[str, Any]]] = None
    platform: Optional[str] = "tiktok_reels"
    subject_override: Optional[str] = "auto"
    seed: Optional[int] = 1957
    director_style: Optional[str] = "caracas"  # "caracas" | "story_tuxedo"
    use_gemini: Optional[bool] = False
    render_mode: Optional[str] = "full_composite"  # "full_composite" | "overlays_only_for_davinci"
    mask_video_filename: Optional[str] = None


class MotionSavePlanRequest(BaseModel):
    plan: Dict[str, Any]


class MotionRenderRequest(BaseModel):
    plan: Dict[str, Any]
    filename: Optional[str] = None
    export_format: Optional[str] = "mp4"


# In-memory tracking tasks
_MAGIC_MASK_TASKS: Dict[str, Dict[str, Any]] = {}


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": "Video Tuxedo",
        "version": "0.3.0",
        "features": {
            "subtitles_davinci": True,
            "waveform_alignment": True,
            "silence_cutter": True,
            "magic_mask_rotoscoper": True,
            "motion_graphics_studio": True,
        }
    }


@app.get("/api/tools")
def get_tools_list():
    """Returns the list of tools for the launcher grid."""
    return [
        {
            "id": "subtitles",
            "name": "Auto Subtitles for DaVinci Resolve",
            "badge": "Ready",
            "badgeType": "success",
            "description": "Transcribe speech with local Whisper AI into clean, waveform-aligned .SRT subtitles ready for DaVinci Resolve Free.",
            "icon": "subtitles",
            "active": True,
            "category": "Captions & Audio"
        },
        {
            "id": "silence-cutter",
            "name": "Silence Cutter & Jump Cuts",
            "badge": "Ready",
            "badgeType": "success",
            "description": "Cut dead air with local Silero VAD. Export single/multipart MP4s or 100% lossless DaVinci Resolve timelines with synced subtitles.",
            "icon": "scissors",
            "active": True,
            "category": "Timeline & Trimming"
        },
        {
            "id": "magic-mask",
            "name": "Magic Mask & Rotoscoping Studio",
            "badge": "Ready",
            "badgeType": "success",
            "description": "Interactive AI rotoscoping with SAM 2.1 on Apple Silicon. Stroke foreground/background to isolate subjects and export Apple ProRes 4444 with native 10-bit Alpha channel.",
            "icon": "wand",
            "active": True,
            "category": "VFX & Compositing"
        },
        {
            "id": "motion-graphics",
            "name": "Motion Graphics Studio",
            "badge": "New!",
            "badgeType": "success",
            "description": "Mid-Century Kinetic Poster motion graphics (Remotion). Procedural El Ávila mountains, Petare hills, Cruz-Diez moiré stripes and Spanish SRT triggers exported to ProRes 4444 Alpha.",
            "icon": "film",
            "active": True,
            "category": "Motion Graphics & VFX"
        }
    ]



@app.get("/api/davinci/guide")
def get_davinci_guide():
    return DAVINCI_IMPORT_GUIDE


@app.post("/api/subtitles/transcribe-upload")
def transcribe_uploaded_file(
    file: UploadFile = File(...),
    model_size: str = Form("base"),
    language: Optional[str] = Form(None),
    task: str = Form("transcribe"),
    pacing: str = Form("natural")
):
    """
    Upload a media file and transcribe it to subtitles using threadpool worker.
    """
    safe_filename = Path(file.filename or "media_input.mp4").name
    temp_target = UPLOAD_DIR / f"{int(time.time())}_{safe_filename}"

    try:
        print(f"📥 Receiving upload: {safe_filename}...")
        with open(temp_target, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        file_size_mb = os.path.getsize(temp_target) / (1024 * 1024)
        print(f"💾 Saved to {temp_target.name} ({file_size_mb:.2f} MB). Transcribing with Whisper '{model_size}' (pacing: {pacing})...")

        result = transcribe_media(
            file_path=str(temp_target),
            model_size=model_size,
            language=language,
            task=task,
            pacing=pacing
        )
        print(f"✅ Transcribed successfully: {result.get('segments_count')} waveform-aligned cues found in {result.get('processing_time')}s")
        result["filename"] = safe_filename
        result["media_url"] = f"/api/media/{temp_target.name}"
        return result
    except Exception as e:
        print(f"❌ Error transcribing upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/subtitles/transcribe-path")
def transcribe_local_path(req: LocalFileTranscribeRequest):
    """
    Transcribe a video or audio file directly from a local directory path on the Mac.
    """
    raw_path = (req.file_path or "").strip()
    if not raw_path:
        raise HTTPException(status_code=400, detail="No file path provided. Please enter an absolute path on your Mac.")

    path = os.path.expanduser(raw_path)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"File not found on system: '{path}'")

    try:
        print(f"📂 Transcribing local path: {path} with model '{req.model_size}' (pacing: {req.pacing})...")
        result = transcribe_media(
            file_path=path,
            model_size=req.model_size or "base",
            language=req.language,
            task=req.task or "transcribe",
            pacing=req.pacing or "natural"
        )
        result["filename"] = os.path.basename(path)
        return result
    except Exception as e:
        print(f"❌ Error transcribing local path: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/subtitles/resegment")
def resegment_words(req: ResegmentRequest):
    """
    Re-chunks existing word timestamps into shorter or longer phrases in milliseconds.
    """
    from server.subtitles import build_aligned_phrases

    pacing_mode = (req.pacing or "natural").lower()
    if pacing_mode == "punchy":
        mw = req.max_words or 4
        md = req.max_duration or 2.0
        ms = req.max_silence or 0.35
    elif pacing_mode == "broadcast":
        mw = req.max_words or 10
        md = req.max_duration or 5.0
        ms = req.max_silence or 0.70
    else:  # "natural"
        mw = req.max_words or 6
        md = req.max_duration or 3.2
        ms = req.max_silence or 0.45

    segments = build_aligned_phrases(req.words, max_words=mw, max_duration=md, max_silence=ms)
    srt = format_davinci_srt(segments)
    vtt = format_webvtt(segments)
    return {
        "success": True,
        "segments_count": len(segments),
        "segments": segments,
        "srt": srt,
        "vtt": vtt,
        "pacing": pacing_mode
    }


@app.get("/api/media/{filename}")
def stream_temp_media(filename: str):
    """Streams uploaded media back for the in-browser video/audio player."""
    target = UPLOAD_DIR / filename
    if not target.exists():
        raise HTTPException(status_code=404, detail="Media file not found")
    return FileResponse(path=str(target))


@app.get("/api/media-stream")
def stream_local_media(path: str = Query(...)):
    """Streams any local media file to the in-browser video player."""
    decoded_path = urllib.parse.unquote(path)
    target = Path(os.path.expanduser(decoded_path))
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"Media file not found: {decoded_path}")
    return FileResponse(path=str(target))


EXPORTS_DIR = BASE_DIR / "exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)


@app.post("/api/subtitles/export-srt")
def export_srt(payload: SegmentsExportRequest):
    """Export segments as .srt, saving directly to ~/Downloads and exports/."""
    srt_content = format_davinci_srt(payload.segments)
    clean_base = (payload.filename or "subtitles").replace(".mp4", "").replace(".mov", "").replace(".srt", "")
    filename = f"{clean_base}.srt"

    # 1. Save directly to user's macOS ~/Downloads
    downloads_dir = Path.home() / "Downloads"
    saved_path_downloads = None
    try:
        dest_downloads = downloads_dir / filename
        with open(dest_downloads, "w", encoding="utf-8") as f:
            f.write(srt_content)
        saved_path_downloads = str(dest_downloads)
        print(f"📁 Auto-saved SRT to ~/Downloads: {dest_downloads}")
    except Exception as e:
        print(f"⚠️ Could not write to ~/Downloads: {e}")

    # 2. Save a backup to project exports/ folder
    dest_exports = EXPORTS_DIR / filename
    with open(dest_exports, "w", encoding="utf-8") as f:
        f.write(srt_content)

    return JSONResponse(
        content={
            "success": True,
            "filename": filename,
            "content": srt_content,
            "saved_downloads": saved_path_downloads,
            "saved_exports": str(dest_exports)
        }
    )


@app.post("/api/subtitles/export-vtt")
def export_vtt(payload: SegmentsExportRequest):
    """Export segments as .vtt, saving directly to ~/Downloads and exports/."""
    vtt_content = format_webvtt(payload.segments)
    clean_base = (payload.filename or "subtitles").replace(".mp4", "").replace(".mov", "").replace(".vtt", "")
    filename = f"{clean_base}.vtt"

    downloads_dir = Path.home() / "Downloads"
    saved_path_downloads = None
    try:
        dest_downloads = downloads_dir / filename
        with open(dest_downloads, "w", encoding="utf-8") as f:
            f.write(vtt_content)
        saved_path_downloads = str(dest_downloads)
    except Exception as e:
        print(f"⚠️ Could not write to ~/Downloads: {e}")

    dest_exports = EXPORTS_DIR / filename
    with open(dest_exports, "w", encoding="utf-8") as f:
        f.write(vtt_content)

    return JSONResponse(
        content={
            "success": True,
            "filename": filename,
            "content": vtt_content,
            "saved_downloads": saved_path_downloads,
            "saved_exports": str(dest_exports)
        }
    )


# ==========================================
# Silence Cutter & Jump Cut API Endpoints
# ==========================================

@app.post("/api/silence/detect-upload")
def detect_silence_upload(
    file: UploadFile = File(...),
    min_silence_duration: float = Form(0.45),
    speech_padding: float = Form(0.12),
    vad_threshold: float = Form(0.5),
):
    """Upload media file and run local Silero VAD silence detection."""
    safe_filename = Path(file.filename or "media_input.mp4").name
    temp_target = UPLOAD_DIR / f"{int(time.time())}_{safe_filename}"

    try:
        print(f"📥 Receiving upload for Silence Cutter: {safe_filename}...")
        with open(temp_target, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        result = detect_silence_and_speech(
            media_path=temp_target,
            min_silence_duration_s=min_silence_duration,
            speech_padding_s=speech_padding,
            vad_threshold=vad_threshold,
        )
        result["filename"] = safe_filename
        result["media_url"] = f"/api/media/{temp_target.name}"
        result["server_media_path"] = str(temp_target)
        print(f"✅ VAD Detection complete: {result['speech_segments_count']} speech clips ({result['silence_percentage']}% silence cut)")
        return result
    except Exception as e:
        print(f"❌ Error in silence detection upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/silence/detect-path")
def detect_silence_local_path(req: SilenceDetectPathRequest):
    """Run local Silero VAD silence detection on a direct Mac file path."""
    raw_path = (req.file_path or "").strip()
    if not raw_path:
        raise HTTPException(status_code=400, detail="No file path provided.")

    path = os.path.expanduser(raw_path)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"File not found on system: '{path}'")

    try:
        print(f"📂 Analyzing local file for silences: {path}...")
        result = detect_silence_and_speech(
            media_path=path,
            min_silence_duration_s=req.min_silence_duration or 0.45,
            speech_padding_s=req.speech_padding or 0.12,
            vad_threshold=req.vad_threshold or 0.5,
        )
        result["filename"] = os.path.basename(path)
        result["server_media_path"] = path
        result["media_url"] = f"/api/media-stream?path={urllib.parse.quote(str(path))}"
        print(f"✅ Local VAD Detection complete: {result['speech_segments_count']} speech clips ({result['silence_percentage']}% silence cut)")
        return result
    except Exception as e:
        print(f"❌ Error analyzing local path: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/silence/render-single")
def render_single_cut_endpoint(req: SilenceRenderSingleRequest):
    """Renders a single seamless jump-cut video with Apple Silicon hardware acceleration."""
    media_path = os.path.expanduser(req.media_path.strip())
    if not os.path.exists(media_path):
        raise HTTPException(status_code=404, detail=f"Source media file not found: {media_path}")

    try:
        print(f"🎬 Rendering single cut video for {media_path} ({len(req.speech_segments)} clips)...")
        render_res = render_single_cut_video(
            input_path=media_path,
            speech_segments=req.speech_segments,
            output_filename=req.filename,
        )
        print(f"✅ Render finished in {render_res['render_time_s']}s -> {render_res['output_path']}")
        return render_res
    except Exception as e:
        print(f"❌ Error rendering single cut video: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/silence/render-multipart")
def render_multipart_endpoint(req: SilenceRenderMultipartRequest):
    """Renders individual takes and bundles them into a ZIP archive in ~/Downloads/."""
    media_path = os.path.expanduser(req.media_path.strip())
    if not os.path.exists(media_path):
        raise HTTPException(status_code=404, detail=f"Source media file not found: {media_path}")

    try:
        print(f"📦 Rendering multipart takes for {media_path} ({len(req.speech_segments)} takes)...")
        multipart_res = render_multipart_takes(
            input_path=media_path,
            speech_segments=req.speech_segments,
            output_folder_name=req.folder_name,
        )
        print(f"✅ Multipart takes finished in {multipart_res['render_time_s']}s -> {multipart_res['zip_path']}")
        return multipart_res
    except Exception as e:
        print(f"❌ Error rendering multipart takes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/silence/export-timeline")
def export_timeline_endpoint(req: SilenceExportTimelineRequest):
    """
    Exports 100% lossless DaVinci Resolve Timeline (FCPXML and CMX 3600 EDL).
    Zero re-encoding required; links to the original raw video.
    """
    media_path = os.path.expanduser(req.media_path.strip())
    if not os.path.exists(media_path):
        raise HTTPException(status_code=404, detail=f"Source media file not found: {media_path}")

    try:
        props = get_media_properties(media_path)
        fps = props.get("fps", 30.0)
        dur = props.get("duration", 0.0)
        is_portrait = props.get("is_portrait", False)

        # Full HD 1080x1920 by default for vertical smartphone videos
        if req.width and req.height:
            width = req.width
            height = req.height
        elif is_portrait:
            width = 1080
            height = 1920
        else:
            width = 1920
            height = 1080

        xml_res = export_davinci_xmeml(
            input_path=media_path,
            speech_segments=req.speech_segments,
            fps=fps,
            width=width,
            height=height,
            audio_rate=props.get("audio_rate", 48000),
            total_source_duration=dur,
        )

        edl_res = export_davinci_edl(
            input_path=media_path,
            speech_segments=req.speech_segments,
            fps=fps,
        )

        fcpxml_res = export_davinci_fcpxml(
            input_path=media_path,
            speech_segments=req.speech_segments,
            fps=fps,
            width=width,
            height=height,
            total_source_duration=dur,
        )

        return {
            "status": "success",
            "xml": xml_res,
            "fcpxml": fcpxml_res,
            "edl": edl_res,
            "cuts_count": len(req.speech_segments),
            "source_fps": fps,
            "width": width,
            "height": height,
            "is_portrait": props.get("is_portrait", False),
        }
    except Exception as e:
        print(f"❌ Error exporting timeline: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/silence/sync-subtitles")
def sync_subtitles_endpoint(req: SilenceSyncSubtitlesRequest):
    """
    Generates timecode-synchronized subtitles (.srt) aligned to the cut timeline!
    """
    media_path = os.path.expanduser(req.media_path.strip())
    if not os.path.exists(media_path):
        raise HTTPException(status_code=404, detail=f"Source media file not found: {media_path}")

    try:
        cues = req.subtitle_cues
        # If no cues provided, transcribe first using local Whisper
        if not cues:
            print("🎙️ No subtitle cues provided, generating transcription with Whisper...")
            tx_res = transcribe_media(file_path=media_path, model_size="base", pacing="natural")
            cues = tx_res.get("segments", [])

        stem = Path(media_path).stem
        out_name = req.filename or f"{stem}_cut_subtitles.srt"

        res = remap_subtitles_to_cut_timeline(
            subtitle_cues=cues,
            speech_segments=req.speech_segments,
            output_filename=out_name,
        )
        return res
    except Exception as e:
        print(f"❌ Error syncing subtitles: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==========================================
# MAGIC MASK & ROTOSCOPING STUDIO ENDPOINTS
# ==========================================

@app.get("/api/magic-mask/guide")
def get_magic_mask_guide():
    return DAVINCI_MAGIC_MASK_GUIDE


@app.post("/api/magic-mask/upload")
def upload_magic_mask_media(file: UploadFile = File(...)):
    """Uploads a video to temp_media specifically for Magic Mask rotoscoping."""
    safe_filename = Path(file.filename or "media_input.mp4").name
    temp_target = UPLOAD_DIR / f"{int(time.time())}_{safe_filename}"
    try:
        with open(temp_target, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        info = get_video_info(str(temp_target))
        return {
            "status": "success",
            "media_path": str(temp_target),
            "media_url": f"/api/media/{temp_target.name}",
            "filename": safe_filename,
            **info
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/magic-mask/info")
def get_media_info_endpoint(req: MagicMaskExtractFrameRequest):
    """Returns video dimensions, framerate, and duration."""
    path = os.path.expanduser(req.media_path.strip())
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"File not found: {path}")
    try:
        info = get_video_info(path)
        return {
            "status": "success",
            "media_path": path,
            "filename": Path(path).name,
            **info
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/magic-mask/extract-frame")
def extract_frame_endpoint(req: MagicMaskExtractFrameRequest):
    """Extracts a video frame at timestamp in seconds."""
    path = os.path.expanduser(req.media_path.strip())
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"File not found: {path}")
    try:
        res = extract_frame_at_timestamp(path, req.timestamp_s or 0.0)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/magic-mask/segment-preview")
def segment_preview_endpoint(req: MagicMaskPreviewRequest):
    """Runs instant SAM 2.1 inference on user stroke points."""
    path = os.path.expanduser(req.media_path.strip())
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"File not found: {path}")
    try:
        res = segment_frame_preview(
            media_path=path,
            timestamp_s=req.timestamp_s,
            points=req.points,
            labels=req.labels,
            bbox=req.bbox,
            feather=req.feather or 3,
            expand=req.expand or 0,
            invert=req.invert or False,
            target_type=req.target_type or "person",
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/magic-mask/track-and-render")
def track_and_render_endpoint(req: MagicMaskTrackRenderRequest):
    """Spawns background rotoscoping and encoding task."""
    path = os.path.expanduser(req.media_path.strip())
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"File not found: {path}")

    task_id = str(uuid.uuid4())[:8]
    _MAGIC_MASK_TASKS[task_id] = {
        "task_id": task_id,
        "status": "starting",
        "percent": 0.0,
        "frame": 0,
        "total_frames": 0,
        "fps": 0.0,
        "eta_s": 0.0,
        "elapsed_s": 0.0,
        "result": None,
        "error": None,
    }

    def _worker():
        try:
            def _on_prog(p):
                _MAGIC_MASK_TASKS[task_id].update({
                    "status": "tracking",
                    "percent": p.get("percent", 0.0),
                    "frame": p.get("frame", 0),
                    "total_frames": p.get("total_frames", 0),
                    "fps": p.get("fps", 0.0),
                    "eta_s": p.get("eta_s", 0.0),
                    "elapsed_s": p.get("elapsed_s", 0.0),
                })

            result = rotoscope_and_render_video(
                media_path=path,
                points=req.points,
                labels=req.labels,
                bbox=req.bbox,
                export_mode=req.export_mode or "prores_alpha",
                feather=req.feather or 3,
                expand=req.expand or 0,
                invert=req.invert or False,
                target_type=req.target_type or "person",
                start_time=req.start_time or 0.0,
                end_time=req.end_time,
                output_filename=req.filename,
                progress_callback=_on_prog,
                cancel_check=lambda: _MAGIC_MASK_TASKS.get(task_id, {}).get("cancelled", False),
            )
            _MAGIC_MASK_TASKS[task_id].update({
                "status": "completed",
                "percent": 100.0,
                "result": result,
            })
        except InterruptedError:
            _MAGIC_MASK_TASKS[task_id].update({
                "status": "cancelled",
                "error": "Tracking cancelled by user",
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            _MAGIC_MASK_TASKS[task_id].update({
                "status": "error",
                "error": str(e),
            })

    t = Thread(target=_worker, daemon=True)
    t.start()

    return {
        "status": "accepted",
        "task_id": task_id,
        "export_mode": req.export_mode or "prores_alpha"
    }


@app.get("/api/magic-mask/progress/{task_id}")
def get_task_progress(task_id: str):
    """Returns current progress of video tracking task."""
    task = _MAGIC_MASK_TASKS.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.post("/api/magic-mask/cancel/{task_id}")
def cancel_task_endpoint(task_id: str):
    """Cancels an in-progress video tracking task."""
    task = _MAGIC_MASK_TASKS.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task["cancelled"] = True
    return {"status": "cancelling", "task_id": task_id}


# ==========================================
# MOTION GRAPHICS STUDIO ENDPOINTS
# ==========================================

@app.get("/api/motion/registry")
def get_motion_registry():
    """Returns visual components and sound effects registry schema."""
    if not REGISTRY_JSON_PATH.exists():
        raise HTTPException(status_code=404, detail="Registry json not found")
    with open(REGISTRY_JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data


@app.post("/api/motion/load-path")
def load_motion_media_path(req: MotionLoadMediaRequest):
    """Loads a media file by macOS path, inspects fps/duration, and tracks subject."""
    path = os.path.expanduser(req.file_path.strip())
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"File not found: {path}")

    props = get_media_properties(path)
    fps = props.get("fps", 30.0)
    duration = props.get("duration", 0.0)
    total_frames = int(round(duration * fps))

    # Check disk cache for transcription & tracking
    path_obj = Path(path)
    clean_stem = re.sub(r'^\d+_', '', path_obj.stem)
    cache_tx_file = path_obj.parent / f"{clean_stem}_transcription.json"
    cache_track_file = path_obj.parent / f"{clean_stem}_tracking.json"

    # Optional SRT loading
    cues = []
    if req.srt_path:
        srt_p = os.path.expanduser(req.srt_path.strip())
        if os.path.exists(srt_p):
            with open(srt_p, "r", encoding="utf-8", errors="replace") as sf:
                cues = parse_srt_file(sf.read(), fps=fps)

    # If no SRT provided, check cache or run Whisper transcription
    if not cues and cache_tx_file.exists():
        try:
            with open(cache_tx_file, "r", encoding="utf-8") as f:
                cues = json.load(f)
            print(f"⚡ Loaded {len(cues)} cached subtitle cues for {clean_stem}")
        except Exception:
            pass

    if not cues:
        try:
            print("🎙️ No SRT supplied for Motion Studio, running local Whisper transcription...")
            tx = transcribe_media(file_path=path, model_size="base", pacing="natural")
            cues = tx.get("segments", [])
            for c in cues:
                c["startFrame"] = int(round(c["start"] * fps))
                c["endFrame"] = max(c["startFrame"] + 1, int(round(c["end"] * fps)))
                c["durationInFrames"] = c["endFrame"] - c["startFrame"]
            try:
                with open(cache_tx_file, "w", encoding="utf-8") as f:
                    json.dump(cues, f, indent=2, ensure_ascii=False)
            except Exception:
                pass
        except Exception as e:
            print(f"⚠️ Auto transcription warning: {e}")

    # Track subject boxes across video duration (with caching)
    subject_track = []
    if cache_track_file.exists():
        try:
            with open(cache_track_file, "r", encoding="utf-8") as f:
                subject_track = json.load(f)
            print(f"⚡ Loaded {len(subject_track)} cached subject track samples for {clean_stem}")
        except Exception:
            pass

    if not subject_track:
        subject_track = track_subject_motion(path, sample_interval_s=1.0)
        try:
            with open(cache_track_file, "w", encoding="utf-8") as f:
                json.dump(subject_track, f, indent=2)
        except Exception:
            pass

    # Stage video media for Remotion preview & rendering
    v_name = stage_media_for_remotion(path)

    # Draft initial scene plan
    if req.director_style == "story_tuxedo":
        words_list = []
        if cues:
            for c in cues:
                for w in c.get("words", []):
                    words_list.append({
                        "word": w.get("text", w.get("word", "")),
                        "start": w.get("start", 0.0),
                        "end": w.get("end", 0.0),
                    })
        draft_plan = generate_director_plan(
            words_list=words_list,
            video_file_name=v_name,
            mask_video_file_name=req.mask_video_filename or "",
            render_mode=req.render_mode or "overlays_only_for_davinci",
        )
        draft_plan["slug"] = f"story_{int(time.time())}"
        draft_plan["fps"] = fps
        draft_plan["durationInFrames"] = total_frames
        draft_plan["composition"] = "StoryTuxedo"
        draft_plan["directorStyle"] = "story_tuxedo"
    else:
        draft_plan = draft_scene_plan_from_srt(
            cues=cues,
            fps=fps,
            duration_frames=total_frames,
            platform="tiktok_reels",
            subject_track=subject_track,
        )
        draft_plan["directorStyle"] = "caracas"
        draft_plan["composition"] = "TalkingHeadOverlay"

    draft_plan["videoFileName"] = v_name
    draft_plan["source"] = {
        "path": path,
        "filename": v_name,
        "url": f"/public/{v_name}",
    }
    draft_plan["preview"] = {
        "showSourceVideo": True,
        "showSafeZones": True,
        "muteSource": False,
    }

    return {
        "status": "success",
        "media_path": path,
        "filename": v_name,
        "fps": fps,
        "duration": duration,
        "total_frames": total_frames,
        "cues_count": len(cues),
        "cues": cues,
        "subject_samples": len(subject_track),
        "plan": draft_plan,
    }


@app.post("/api/motion/draft-plan")
def draft_plan_endpoint(req: MotionDraftPlanRequest):
    """Drafts a fresh scene plan from provided SRT content or edited cues."""
    media_path = os.path.expanduser((req.media_path or "").strip()) if req.media_path else None
    fps = 30.0
    duration_frames = 300
    subject_track = []

    if media_path and os.path.exists(media_path):
        props = get_media_properties(media_path)
        fps = props.get("fps", 30.0)
        dur = props.get("duration", 0.0)
        duration_frames = int(round(dur * fps))
        subject_track = track_subject_motion(media_path, sample_interval_s=1.0)

    cues = []
    if req.cues:
        cues = req.cues
    elif req.srt_content:
        cues = parse_srt_file(req.srt_content, fps=fps)

    v_name = "chopped_video.mp4"
    if media_path and os.path.exists(media_path):
        v_name = stage_media_for_remotion(media_path)

    # Branch between StoryTuxedo 3-layer comedic director and Caracas Kinetic poster suite
    if req.director_style == "story_tuxedo":
        words_list = []
        if cues:
            for c in cues:
                clean_text = c.get("text", "").strip()
                existing_words = c.get("words", [])
                
                # Check if words match current text; if not, re-align proportionally
                words_text = " ".join(w.get("text", w.get("word", "")) for w in existing_words)
                if not existing_words or words_text != clean_text:
                    raw_words = clean_text.split()
                    c_start = float(c.get("start", 0.0))
                    c_end = float(c.get("end", c_start + 1.5))
                    c_dur = max(0.1, c_end - c_start)
                    w_dur = c_dur / max(1, len(raw_words))
                    existing_words = [
                        {
                            "word": rw,
                            "start": round(c_start + w_idx * w_dur, 3),
                            "end": round(c_start + (w_idx + 1) * w_dur, 3),
                        }
                        for w_idx, rw in enumerate(raw_words)
                    ]

                for w in existing_words:
                    words_list.append({
                        "word": w.get("text", w.get("word", "")),
                        "start": float(w.get("start", 0.0)),
                        "end": float(w.get("end", 0.0)),
                    })
        elif media_path and os.path.exists(media_path):
            try:
                tx = transcribe_media(file_path=media_path, model_size="base")
                words_list = tx.get("all_words", [])
            except Exception as e:
                print(f"⚠️ Auto-transcription for StoryTuxedo error: {e}")

        plan = generate_director_plan(
            words_list=words_list,
            video_file_name=v_name,
            mask_video_file_name=req.mask_video_filename or "",
            render_mode=req.render_mode or "full_composite",
        )
        plan["slug"] = f"story_{int(time.time())}"
        plan["fps"] = fps
        plan["durationInFrames"] = duration_frames
        plan["composition"] = "StoryTuxedo"
        plan["directorStyle"] = "story_tuxedo"
    else:
        plan = draft_scene_plan_from_srt(
            cues=cues,
            fps=fps,
            duration_frames=duration_frames,
            platform=req.platform or "tiktok_reels",
            subject_track=subject_track,
            seed=req.seed or 1957,
        )
        plan["directorStyle"] = "caracas"
        plan["composition"] = "TalkingHeadOverlay"

    if media_path:
        plan["videoFileName"] = v_name
        plan["source"] = {
            "path": media_path,
            "filename": v_name,
            "url": f"/public/{v_name}",
        }
        plan["preview"] = {
            "showSourceVideo": True,
            "showSafeZones": True,
            "muteSource": False,
        }

    return {"status": "success", "plan": plan}



@app.get("/api/motion/plan/{slug}")
def get_saved_plan(slug: str):
    """Retrieves saved plan JSON for a video project."""
    plan_file = PLANS_DIR / f"{slug}_plan.json"
    if not plan_file.exists():
        raise HTTPException(status_code=404, detail="Plan not found")
    with open(plan_file, "r", encoding="utf-8") as f:
        return json.load(f)


@app.post("/api/motion/plan/{slug}")
def save_plan_endpoint(slug: str, req: MotionSavePlanRequest):
    """Saves updated plan JSON from the in-browser timeline editor."""
    plan_file = PLANS_DIR / f"{slug}_plan.json"
    with open(plan_file, "w", encoding="utf-8") as f:
        json.dump(req.plan, f, indent=2, ensure_ascii=False)
    return {"status": "success", "saved_path": str(plan_file)}


@app.post("/api/motion/render")
def render_motion_endpoint(req: MotionRenderRequest):
    """Spawns background Remotion render task with progress tracking."""
    task_id = str(uuid.uuid4())[:8]
    _MOTION_TASKS[task_id] = {
        "task_id": task_id,
        "status": "starting",
        "percent": 0.0,
        "frame": 0,
        "total_frames": req.plan.get("durationInFrames", 300),
        "fps": 0.0,
        "eta_s": 0.0,
        "elapsed_s": 0.0,
        "result": None,
        "error": None,
    }

    def _worker():
        try:
            def _on_prog(p):
                _MOTION_TASKS[task_id].update({
                    "status": "rendering",
                    "percent": p.get("percent", 0.0),
                    "frame": p.get("frame", 0),
                    "total_frames": p.get("total_frames", 0),
                    "fps": p.get("fps", 0.0),
                    "eta_s": p.get("eta_s", 0.0),
                    "elapsed_s": p.get("elapsed_s", 0.0),
                })

            result = run_remotion_render(
                plan=req.plan,
                output_filename=req.filename,
                export_format=req.export_format or "mp4",
                progress_callback=_on_prog,
                cancel_check=lambda: _MOTION_TASKS.get(task_id, {}).get("cancelled", False),
            )
            _MOTION_TASKS[task_id].update({
                "status": "completed",
                "percent": 100.0,
                "result": result,
            })
        except InterruptedError:
            _MOTION_TASKS[task_id].update({
                "status": "cancelled",
                "error": "Render cancelled by user",
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            _MOTION_TASKS[task_id].update({
                "status": "error",
                "error": str(e),
            })

    t = Thread(target=_worker, daemon=True)
    t.start()

    return {
        "status": "accepted",
        "task_id": task_id,
        "plan_slug": req.plan.get("slug"),
        "export_format": req.export_format or "mp4",
    }


@app.get("/api/motion/progress/{task_id}")
def get_motion_progress(task_id: str):
    """Returns current progress of background motion graphics render task."""
    task = _MOTION_TASKS.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.post("/api/motion/cancel/{task_id}")
def cancel_motion_task(task_id: str):
    """Cancels an in-progress motion graphics render task."""
    task = _MOTION_TASKS.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task["cancelled"] = True
    return {"status": "cancelling", "task_id": task_id}


@app.get("/api/motion/download/{filename}")
def download_motion_video(filename: str):
    """Downloads an exported motion video from exports/ or ~/Downloads/."""
    clean = os.path.basename(filename)
    path = BASE_DIR / "exports" / clean
    if not path.exists():
        path = DOWNLOADS_DIR / clean
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    media_type = "video/mp4" if clean.endswith(".mp4") else "video/quicktime"
    return FileResponse(path=str(path), media_type=media_type, filename=clean)



@app.get("/")
def serve_index():
    index_file = STATIC_DIR / "index.html"
    return FileResponse(str(index_file))


@app.get("/{file_name:path}")
def serve_root_public_fallback(file_name: str):
    """Fallback to serve staged files in motion-studio/public if accessed at root without /public prefix."""
    target = MOTION_PUBLIC_DIR / file_name
    if target.exists() and target.is_file():
        return FileResponse(str(target))
    raise HTTPException(status_code=404, detail="Not Found")


