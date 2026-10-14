"""
Video Tuxedo - FastAPI Backend Server
"""

import os
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


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "app": "Video Tuxedo",
        "version": "0.1.0",
        "features": {
            "subtitles_davinci": True,
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
            "description": "Transcribe speech with local Whisper AI into clean, timecode-accurate .SRT subtitles ready for DaVinci Resolve Free.",
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
async def transcribe_uploaded_file(
    file: UploadFile = File(...),
    model_size: str = Form("base"),
    language: Optional[str] = Form(None),
    task: str = Form("transcribe")
):
    """
    Upload a media file and transcribe it to subtitles.
    """
    safe_filename = Path(file.filename or "media_input.mp4").name
    temp_target = UPLOAD_DIR / f"upload_{safe_filename}"

    try:
        with open(temp_target, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        result = transcribe_media(
            file_path=str(temp_target),
            model_size=model_size,
            language=language,
            task=task
        )
        result["filename"] = safe_filename
        result["media_url"] = f"/api/media/{safe_filename}"
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/subtitles/transcribe-path")
def transcribe_local_path(req: LocalFileTranscribeRequest):
    """
    Transcribe a video or audio file directly from a local directory path on the Mac.
    """
    path = os.path.expanduser(req.file_path.strip())
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"File not found on system: {path}")

    try:
        result = transcribe_media(
            file_path=path,
            model_size=req.model_size or "base",
            language=req.language,
            task=req.task or "transcribe"
        )
        result["filename"] = os.path.basename(path)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/media/{filename}")
def stream_temp_media(filename: str):
    """Streams uploaded media back for the in-browser video/audio player."""
    target = UPLOAD_DIR / f"upload_{filename}"
    if not target.exists():
        raise HTTPException(status_code=404, detail="Media file not found")
    return FileResponse(path=str(target))


@app.post("/api/subtitles/export-srt")
def export_srt(payload: SegmentsExportRequest):
    """Export segments as downloadable .srt for DaVinci Resolve Free."""
    srt_content = format_davinci_srt(payload.segments)
    filename = f"{payload.filename or 'subtitles'}.srt"
    return PlainTextResponse(
        content=srt_content,
        media_type="application/x-subrip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@app.post("/api/subtitles/export-vtt")
def export_vtt(payload: SegmentsExportRequest):
    """Export segments as downloadable .vtt."""
    vtt_content = format_webvtt(payload.segments)
    filename = f"{payload.filename or 'subtitles'}.vtt"
    return PlainTextResponse(
        content=vtt_content,
        media_type="text/vtt",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@app.get("/")
def serve_index():
    index_file = STATIC_DIR / "index.html"
    return FileResponse(str(index_file))
