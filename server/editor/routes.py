"""
FastAPI route handlers for Tuxedo Editor (/api/editor/*).
Manages project lifecycle, file uploads, range-request streaming, and background task progress.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from server.editor.conform import render_conform
from server.editor.media import create_web_proxy, generate_waveform_peaks, probe_media
from server.editor.paths import (
    ensure_project_subdirs,
    generate_slug,
    get_project_dir,
    get_projects_root,
    link_project_for_remotion,
    resolve_safe_project_file,
)
from server.editor.project import (
    Clip,
    Project,
    SilenceSettings,
    SourceInfo,
    load_project,
    save_project,
)
from server.editor.tasks import tasks
from server.silence_cutter import detect_silence_and_speech
from server.editor.captions_ai import transcribe_project_audio, proofread_project_captions
from server.editor.styles import list_styles, get_style
from server.editor.exports import export_srt, export_vtt, export_project_zip, render_project_video
from server.magic_mask import rotoscope_and_render_video

router = APIRouter()


class CreateFromPathRequest(BaseModel):
    file_path: str
    name: Optional[str] = None


class RenameRequest(BaseModel):
    name: str


class SilenceDetectRequest(BaseModel):
    min_silence: Optional[float] = 0.45
    padding: Optional[float] = 0.12
    threshold: Optional[float] = 0.5


class TranscribeRequest(BaseModel):
    model_size: Optional[str] = "base"
    language: Optional[str] = None
    pacing: Optional[str] = "natural"


class ProofreadRequest(BaseModel):
    api_key: Optional[str] = None
    style: Optional[str] = "comedic"


class CutoutRequest(BaseModel):
    target_type: Optional[str] = "person"
    feather: Optional[int] = 3
    invert: Optional[bool] = False


class ExportRequest(BaseModel):
    preset: Optional[str] = "mp4_composite"


# ---------------------------------------------------------------------------
# Project listing & CRUD
# ---------------------------------------------------------------------------

@router.get("/projects")
def list_projects() -> List[Dict[str, Any]]:
    """Returns list of recent projects from ~/Movies/VideoTuxedo/ sorted by updatedAt."""
    root = get_projects_root()
    projects = []
    for item in root.iterdir():
        if item.is_dir() and (item / "project.json").exists():
            try:
                with open(item / "project.json", "r", encoding="utf-8") as f:
                    data = json.load(f)
                projects.append({
                    "slug": data.get("slug", item.name),
                    "name": data.get("name", item.name),
                    "step": data.get("step", 1),
                    "duration": data.get("source", {}).get("duration", 0.0),
                    "createdAt": data.get("createdAt", ""),
                    "updatedAt": data.get("updatedAt", ""),
                    "clipsCount": len(data.get("clips", [])),
                })
            except Exception:
                pass
    projects.sort(key=lambda p: p.get("updatedAt", ""), reverse=True)
    return projects


@router.post("/projects")
async def create_project(
    file: Optional[UploadFile] = File(None),
    file_path: Optional[str] = Form(None),
    name: Optional[str] = Form(None),
) -> Dict[str, Any]:
    """Creates a new project from uploaded file or local path."""
    project_name = (name or "").strip()
    slug = generate_slug(project_name or (file.filename if file else Path(file_path).stem if file_path else "video"))
    project_dir = get_project_dir(slug)
    ensure_project_subdirs(project_dir)

    source_filename = "source.mp4"

    if file and file.filename:
        ext = Path(file.filename).suffix.lower() or ".mp4"
        source_filename = f"source{ext}"
        target_path = project_dir / source_filename
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        if not project_name:
            project_name = Path(file.filename).stem
    elif file_path:
        local_p = Path(os.path.expanduser(file_path.strip())).resolve()
        if not local_p.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
        ext = local_p.suffix.lower() or ".mp4"
        source_filename = f"source{ext}"
        target_path = project_dir / source_filename
        # Copy or stream copy
        shutil.copyfile(local_p, target_path)
        if not project_name:
            project_name = local_p.stem
    else:
        raise HTTPException(status_code=400, detail="Either file upload or file_path is required")

    # Probe media
    props = probe_media(target_path)
    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # Build initial project model
    proj = Project(
        version=1,
        slug=slug,
        name=project_name or slug,
        createdAt=now_iso,
        updatedAt=now_iso,
        step=1,
        fps=props.get("fps", 30.0),
        width=props.get("width", 1080),
        height=props.get("height", 1920),
        source=SourceInfo(
            file=source_filename,
            webFile=None,
            duration=props.get("duration", 0.0),
            rotation=props.get("rotation", 0),
            hasAudio=props.get("hasAudio", True),
            width=props.get("width", 1080),
            height=props.get("height", 1920),
        ),
        silence=SilenceSettings(minSilence=0.45, padding=0.12, threshold=0.5),
        clips=[Clip(id="c_01", srcIn=0.0, srcOut=props.get("duration", 0.0))],
    )

    # Generate short-GOP web proxy MP4 (-g 15) for instantaneous browser seeking
    web_proxy_name = "source_web.mp4"
    web_proxy_path = project_dir / web_proxy_name
    try:
        create_web_proxy(target_path, web_proxy_path)
        proj.source.webFile = web_proxy_name
    except Exception as e:
        print(f"⚠️ Proxy creation warning: {e}")

    # Generate waveform peaks
    peaks_path = project_dir / "peaks.json"
    try:
        generate_waveform_peaks(web_proxy_path if web_proxy_path.exists() else target_path, peaks_path)
    except Exception as e:
        print(f"⚠️ Peaks generation warning: {e}")

    # Start silence detection in background cache so Step 2 opens instantly
    def _bg_silence():
        try:
            vad_res = detect_silence_and_speech(
                target_path,
                min_silence_duration_s=proj.silence.minSilence,
                speech_padding_s=proj.silence.padding,
                vad_threshold=proj.silence.threshold,
            )
            with open(project_dir / "cache" / "silence_vad.json", "w", encoding="utf-8") as f:
                json.dump(vad_res, f, indent=2)
        except Exception as e:
            print(f"⚠️ Initial silence detection warning: {e}")

    from threading import Thread
    Thread(target=_bg_silence, daemon=True).start()

    # Symlink into motion-studio/public/projects/<slug>
    try:
        link_project_for_remotion(slug)
    except Exception as e:
        print(f"⚠️ Remotion link warning: {e}")

    save_project(proj)
    return proj.model_dump()


@router.get("/projects/{slug}")
def get_project(slug: str) -> Dict[str, Any]:
    """Loads project.json and ensures Remotion symlink is active."""
    try:
        proj = load_project(slug)
        link_project_for_remotion(slug)
        return proj.model_dump()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Project not found")


@router.put("/projects/{slug}")
def update_project(slug: str, project_data: Dict[str, Any]) -> Dict[str, Any]:
    """Autosaves project.json atomically from the browser."""
    try:
        proj = Project(**project_data)
        if proj.slug != slug:
            proj.slug = slug
        save_project(proj)
        return {"status": "saved", "updatedAt": proj.updatedAt}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to save project: {e}")


@router.patch("/projects/{slug}/name")
def rename_project(slug: str, req: RenameRequest) -> Dict[str, Any]:
    """Renames project title."""
    try:
        proj = load_project(slug)
        proj.name = req.name.strip() or proj.name
        save_project(proj)
        return {"status": "renamed", "name": proj.name}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Project not found")


@router.delete("/projects/{slug}")
def delete_project(slug: str) -> Dict[str, Any]:
    """Moves project folder to Trash / deletes it safely."""
    p_dir = get_project_dir(slug)
    if not p_dir.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        shutil.rmtree(p_dir)
        return {"status": "deleted", "slug": slug}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {e}")


@router.post("/projects/{slug}/reveal")
def reveal_project_in_finder(slug: str) -> Dict[str, Any]:
    """Opens project folder in macOS Finder."""
    p_dir = get_project_dir(slug).resolve()
    if not p_dir.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    subprocess.run(["open", str(p_dir)])
    return {"status": "revealed", "path": str(p_dir)}


# ---------------------------------------------------------------------------
# Media assets, streaming, and peaks
# ---------------------------------------------------------------------------

@router.get("/projects/{slug}/peaks")
def get_peaks(slug: str) -> List[float]:
    """Returns waveform peaks for the project."""
    p_dir = get_project_dir(slug)
    peaks_file = p_dir / "peaks.json"
    if peaks_file.exists():
        with open(peaks_file, "r", encoding="utf-8") as f:
            return json.load(f)

    # Generate if missing
    proj = load_project(slug)
    src = p_dir / (proj.source.webFile or proj.source.file)
    if src.exists():
        return generate_waveform_peaks(src, peaks_path=peaks_file)
    return []


@router.get("/projects/{slug}/files/{file_path:path}")
def serve_project_file(slug: str, file_path: str):
    """Serves project media files with HTTP range requests support for video player seeking."""
    try:
        target = resolve_safe_project_file(slug, file_path)
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=403, detail=str(e))

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    ext = target.suffix.lower()
    media_types = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".json": "application/json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
    }
    media_type = media_types.get(ext, "application/octet-stream")
    return FileResponse(path=str(target), media_type=media_type)


# ---------------------------------------------------------------------------
# Silence detection & Conform
# ---------------------------------------------------------------------------

@router.post("/projects/{slug}/silence")
def detect_silence(slug: str, req: SilenceDetectRequest) -> Dict[str, Any]:
    """Runs Silero VAD on project source with customized thresholds."""
    proj = load_project(slug)
    p_dir = get_project_dir(slug)
    
    if proj.source.webFile and (p_dir / proj.source.webFile).exists():
        source_p = p_dir / proj.source.webFile
    elif proj.source.file and (p_dir / proj.source.file).exists():
        source_p = p_dir / proj.source.file
    elif (p_dir / "source_web.mp4").exists():
        source_p = p_dir / "source_web.mp4"
    elif (p_dir / "source.mp4").exists():
        source_p = p_dir / "source.mp4"
    else:
        candidates = list(p_dir.glob("source*"))
        if candidates:
            source_p = candidates[0]
        else:
            raise HTTPException(status_code=404, detail="Source media file not found")

    min_s = req.min_silence if req.min_silence is not None else proj.silence.minSilence
    pad_s = req.padding if req.padding is not None else proj.silence.padding
    th_s = req.threshold if req.threshold is not None else proj.silence.threshold

    res = detect_silence_and_speech(
        source_p,
        min_silence_duration_s=min_s,
        speech_padding_s=pad_s,
        vad_threshold=th_s,
    )

    # Normalize response keys for UI compatibility
    res["silence_count"] = res.get("silence_segments_count", len(res.get("silence_segments", [])))
    res["speech_duration"] = res.get("total_speech_duration", 0.0)
    res["time_saved_percent"] = res.get("silence_percentage", 0.0)

    # Save in cache
    with open(p_dir / "cache" / "silence_vad.json", "w", encoding="utf-8") as f:
        json.dump(res, f, indent=2)

    return res


@router.post("/projects/{slug}/conform")
def trigger_conform(slug: str) -> Dict[str, Any]:
    """Starts background task to render conform.mp4 with audio micro crossfades."""
    proj = load_project(slug)

    def _worker(task, is_cancelled, report_progress):
        report_progress(5.0, "Starting conform rendering...")
        conform_info = render_conform(proj, is_cancelled=is_cancelled, progress_cb=report_progress)
        proj.conform = conform_info
        save_project(proj)
        return conform_info.model_dump()

    task = tasks.start_task(kind="conform", target_fn=_worker, metadata={"slug": slug})
    return {"status": "started", "task_id": task.task_id}


# ---------------------------------------------------------------------------
# Background Task Status & Cancellation
# ---------------------------------------------------------------------------

@router.get("/tasks/{task_id}")
def get_task_status(task_id: str) -> Dict[str, Any]:
    task = tasks.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task.to_dict()


@router.post("/tasks/{task_id}/cancel")
def cancel_task(task_id: str) -> Dict[str, Any]:
    success = tasks.cancel_task(task_id)
    return {"status": "cancelled" if success else "not_running", "task_id": task_id}


# ---------------------------------------------------------------------------
# Styles Registry (Step 5)
# ---------------------------------------------------------------------------

@router.get("/styles")
def get_available_styles() -> List[Dict[str, Any]]:
    """Returns list of registered visual motion graphic styles."""
    return list_styles()


# ---------------------------------------------------------------------------
# Subtitles & AI Proofread (Step 3)
# ---------------------------------------------------------------------------

@router.post("/projects/{slug}/transcribe")
def trigger_transcription(slug: str, req: TranscribeRequest) -> Dict[str, Any]:
    """Runs Whisper transcription in background."""
    proj = load_project(slug)

    def _worker(task, is_cancelled, report_progress):
        report_progress(10.0, "Starting Whisper speech recognition...")
        cues = transcribe_project_audio(
            proj,
            model_size=req.model_size or "base",
            language=req.language,
            pacing=req.pacing or "natural",
        )
        report_progress(100.0, f"Transcribed {len(cues)} subtitle cues.")
        return [c.model_dump() for c in cues]

    task = tasks.start_task(kind="transcribe", target_fn=_worker, metadata={"slug": slug})
    return {"status": "started", "task_id": task.task_id}


@router.post("/projects/{slug}/proofread")
def trigger_proofread(slug: str, req: ProofreadRequest) -> Dict[str, Any]:
    """Runs Gemini Flash subtitle proofreading & comedic emphasis enrichment."""
    proj = load_project(slug)

    def _worker(task, is_cancelled, report_progress):
        report_progress(20.0, "Contacting Gemini Flash for proofreading & comedic tags...")
        cues = proofread_project_captions(
            proj,
            api_key=req.api_key,
            style=req.style or "comedic",
        )
        report_progress(100.0, f"Polished {len(cues)} cues without altering audio sync.")
        return [c.model_dump() for c in cues]

    task = tasks.start_task(kind="proofread", target_fn=_worker, metadata={"slug": slug})
    return {"status": "started", "task_id": task.task_id}


# ---------------------------------------------------------------------------
# Subject Rotoscoping / Cutout (Step 4)
# ---------------------------------------------------------------------------

@router.post("/projects/{slug}/cutout")
def trigger_cutout(slug: str, req: CutoutRequest) -> Dict[str, Any]:
    """Runs subject rotoscoping to generate cutout for 3-layer sandwich graphics."""
    proj = load_project(slug)
    project_dir = get_project_dir(slug)

    use_conform = bool(proj.conform and proj.conform.exists and (project_dir / "conform.mp4").exists())
    if use_conform:
        src_video = project_dir / "conform.mp4"
    elif proj.source and proj.source.webFile and (project_dir / proj.source.webFile).exists():
        src_video = project_dir / proj.source.webFile
    elif proj.source and proj.source.file and (project_dir / proj.source.file).exists():
        src_video = project_dir / proj.source.file
    elif (project_dir / "source_web.mp4").exists():
        src_video = project_dir / "source_web.mp4"
    elif (project_dir / "source.mp4").exists():
        src_video = project_dir / "source.mp4"
    else:
        candidates = list(project_dir.glob("source*"))
        if candidates:
            src_video = candidates[0]
        else:
            raise HTTPException(status_code=404, detail="No source media found for cutout")

    def _worker(task, is_cancelled, report_progress):
        nonlocal src_video, use_conform
        if not use_conform and proj.clips and len(proj.clips) > 1:
            report_progress(2.0, "Conforming edited clips before rotoscoping...")
            conform_info = render_conform(proj, is_cancelled=is_cancelled, progress_cb=report_progress)
            proj.conform = conform_info
            save_project(proj)
            src_video = project_dir / "conform.mp4"
            use_conform = True

        report_progress(5.0, "Initializing subject segmentation engine...")

        def _p_cb(info):
            pct = float(info.get("percent", task.percent or 5.0))
            frame = info.get("frame", 0)
            total = info.get("total_frames", 0)
            fps_val = info.get("fps", 0.0)
            report_progress(
                percent=pct,
                message=f"Rotoscoping frame {frame}/{total} ({fps_val:.1f} fps)"
            )

        rot_res = rotoscope_and_render_video(
            media_path=str(src_video),
            export_mode="webm_alpha",
            feather=req.feather or 3,
            invert=bool(req.invert),
            target_type=req.target_type or "person",
            output_filename="cutout",
            output_dir=project_dir,
            progress_callback=_p_cb,
            cancel_check=is_cancelled,
        )

        res_path_str = rot_res.get("output_path") or rot_res.get("file_path", "")
        res_path = Path(res_path_str)
        if not res_path.exists():
            raise FileNotFoundError(f"Rotoscope output file not created: {res_path_str}")

        out_file = project_dir / res_path.name
        if res_path.resolve() != out_file.resolve():
            shutil.copy2(res_path, out_file)

        conform_hash = (proj.conform.hash if proj.conform else "") or str(int(time.time()))

        proj.cutout.exists = True
        proj.cutout.file = out_file.name
        proj.cutout.conformHash = conform_hash
        proj.cutout.feather = req.feather or 3
        save_project(proj)

        report_progress(100.0, "Subject rotoscope complete.")
        return {
            "status": "complete",
            "cutout_url": f"/api/editor/projects/{slug}/files/{out_file.name}?v={conform_hash}",
            "filename": out_file.name,
        }

    task = tasks.start_task(kind="cutout", target_fn=_worker, metadata={"slug": slug})
    return {"status": "started", "task_id": task.task_id}


# ---------------------------------------------------------------------------
# Layer Assets Upload (Step 5)
# ---------------------------------------------------------------------------

@router.post("/projects/{slug}/layers/upload")
async def upload_layer_asset(
    slug: str,
    file: UploadFile = File(...),
) -> Dict[str, Any]:
    """Uploads an image asset directly into project's layers/ folder."""
    project_dir = get_project_dir(slug)
    layers_dir = project_dir / "layers"
    layers_dir.mkdir(parents=True, exist_ok=True)

    safe_name = f"{int(time.time())}_{file.filename}"
    target_path = layers_dir / safe_name

    with open(target_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    return {
        "status": "uploaded",
        "name": safe_name,
        "src": f"/api/editor/projects/{slug}/files/layers/{safe_name}",
        "size_bytes": target_path.stat().st_size,
    }


# ---------------------------------------------------------------------------
# Export Endpoints (Step 6)
# ---------------------------------------------------------------------------

@router.post("/projects/{slug}/export")
def trigger_export(slug: str, req: ExportRequest) -> Dict[str, Any]:
    """Starts background rendering for selected export preset."""
    def _worker(task, is_cancelled, report_progress):
        return render_project_video(slug, preset=req.preset or "mp4_composite", task=task)

    task = tasks.start_task(kind="export", target_fn=_worker, metadata={"slug": slug, "preset": req.preset})
    return {"status": "started", "task_id": task.task_id}


@router.get("/projects/{slug}/export/srt")
def download_srt(slug: str):
    """Downloads project captions as .srt."""
    srt_path = export_srt(slug)
    return FileResponse(path=str(srt_path), filename=f"{slug}_captions.srt", media_type="text/plain")


@router.get("/projects/{slug}/export/vtt")
def download_vtt(slug: str):
    """Downloads project captions as .vtt."""
    vtt_path = export_vtt(slug)
    return FileResponse(path=str(vtt_path), filename=f"{slug}_captions.vtt", media_type="text/vtt")


@router.get("/projects/{slug}/export/zip")
def download_zip(slug: str):
    """Downloads full project backup bundle as .zip."""
    zip_path = export_project_zip(slug)
    return FileResponse(path=str(zip_path), filename=f"{slug}_bundle.zip", media_type="application/zip")

