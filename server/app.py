"""
Video Tuxedo - FastAPI Backend Server
"""

import os
import time
import shutil
import tempfile
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from server.davinci import format_davinci_srt, format_webvtt, DAVINCI_IMPORT_GUIDE
from server.subtitles import transcribe_media

app = FastAPI(
    title="Video Tuxedo",
    description="Video editing productivity tools suite",
    version="0.1.0"
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


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": "Video Tuxedo",
        "version": "0.1.0",
        "features": {
            "subtitles_davinci": True,
            "waveform_alignment": True,
            "silence_cutter": "upcoming",
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
            "badge": "Upcoming",
            "badgeType": "neutral",
            "description": "Automatically detect silent pauses and export cut timelines (EDL / FCPXML) directly to DaVinci Resolve.",
            "icon": "scissors",
            "active": False,
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


@app.get("/")
def serve_index():
    index_file = STATIC_DIR / "index.html"
    return FileResponse(str(index_file))
