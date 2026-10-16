"""
Video Tuxedo - FastAPI Backend Server
"""

import os
import time
import shutil
import tempfile
import urllib.parse
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from server.davinci import format_davinci_srt, format_webvtt, DAVINCI_IMPORT_GUIDE
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

app = FastAPI(
    title="Video Tuxedo",
    description="Video editing productivity tools suite",
    version="0.2.0"
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

# Mount static files
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


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


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": "Video Tuxedo",
        "version": "0.2.0",
        "features": {
            "subtitles_davinci": True,
            "waveform_alignment": True,
            "silence_cutter": True,
            "background_remover": "upcoming"
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
            "id": "bg-remover",
            "name": "AI Video Background Remover",
            "badge": "Upcoming",
            "badgeType": "neutral",
            "description": "Smart rotoscoping and background separation to export transparent ProRes 4444 or alpha matte masks.",
            "icon": "wand",
            "active": False,
            "category": "VFX & Compositing"
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


@app.get("/")
def serve_index():
    index_file = STATIC_DIR / "index.html"
    return FileResponse(str(index_file))
