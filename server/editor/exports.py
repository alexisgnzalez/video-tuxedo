"""
Export Engine for Tuxedo Editor.
Generates H.264 vertical video, Apple ProRes 4444 / 422, SRT / VTT subtitles, and project ZIP bundles.
"""

import os
import json
import shutil
import zipfile
import subprocess
import logging
from pathlib import Path
from typing import Dict, Any, Optional

from server.editor.paths import get_project_dir, link_project_for_remotion, EXPORTS_DIR
from server.editor.project import load_project, Project
from server.editor.tasks import Task
from server.davinci import format_davinci_srt, format_webvtt

logger = logging.getLogger("video_tuxedo.editor.exports")


def export_srt(slug: str) -> Path:
    """Exports project captions as standard .srt."""
    project = load_project(slug)
    project_dir = get_project_dir(slug)
    out_file = project_dir / "captions.srt"

    cues_data = [
        {
            "id": i + 1,
            "start": c.start,
            "end": c.end,
            "text": c.text,
        }
        for i, c in enumerate(project.captions.cues)
    ]
    srt_content = format_davinci_srt(cues_data)
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(srt_content)

    return out_file


def export_vtt(slug: str) -> Path:
    """Exports project captions as .vtt."""
    project = load_project(slug)
    project_dir = get_project_dir(slug)
    out_file = project_dir / "captions.vtt"

    cues_data = [
        {
            "id": i + 1,
            "start": c.start,
            "end": c.end,
            "text": c.text,
        }
        for i, c in enumerate(project.captions.cues)
    ]
    vtt_content = format_webvtt(cues_data)
    with open(out_file, "w", encoding="utf-8") as f:
        f.write(vtt_content)

    return out_file


def export_project_zip(slug: str) -> Path:
    """Packs project.json, subtitles, and EDL metadata into a downloadable ZIP."""
    project_dir = get_project_dir(slug)
    export_srt(slug)
    export_vtt(slug)

    zip_filename = f"{slug}_bundle.zip"
    zip_path = EXPORTS_DIR / zip_filename

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        # Add project.json
        proj_json = project_dir / "project.json"
        if proj_json.exists():
            zf.write(proj_json, arcname="project.json")

        # Add captions
        for name in ("captions.srt", "captions.vtt", "peaks.json"):
            fpath = project_dir / name
            if fpath.exists():
                zf.write(fpath, arcname=name)

    return zip_path


def render_project_video(
    slug: str,
    preset: str = "mp4_composite",
    task: Optional[Task] = None,
) -> Dict[str, Any]:
    """
    Renders video for Tuxedo Editor using Remotion CLI or FFmpeg.
    Presets:
    - 'mp4_composite': 1080x1920 H.264 30fps full vertical video.
    - 'prores_overlay': ProRes 4444 Alpha overlay for DaVinci Resolve.
    - 'prores_master': ProRes 422 HQ master.
    """
    project = load_project(slug)
    project_dir = get_project_dir(slug)
    link_project_for_remotion(slug)

    if task:
        task.update(percent=5, message="Preparing export composition...")

    # Build Remotion input props
    project_dict = project.model_dump()
    project_dict["composition"] = "TuxedoEdit"
    project_dict["slug"] = slug
    has_conform = bool(project.conform and project.conform.exists)
    has_cutout = bool(project.cutout and project.cutout.exists)
    project_dict["mode"] = "flat" if has_conform else "edl"

    cutout_filename = (project.cutout.file if project.cutout else None) or "cutout.webm"
    source_filename = project.source.webFile or project.source.file or "source.mp4"

    project_exports_dir = project_dir / "exports"
    project_exports_dir.mkdir(parents=True, exist_ok=True)

    # Calculate full timeline duration in frames and fps.
    # When conform.mp4 exists, it is strictly 30.0 fps CFR.
    if has_conform:
        fps = 30.0
    else:
        fps = project.fps or (project.source.fps if project.source else 30.0) or 30.0

    if has_conform and project.conform.duration > 0:
        duration_sec = project.conform.duration
    elif project.clips:
        duration_sec = sum(max(0.0, c.srcOut - c.srcIn) for c in project.clips)
    elif project.source and project.source.duration:
        duration_sec = project.source.duration
    else:
        duration_sec = 10.0

    total_frames = max(30, int(round(duration_sec * fps)))
    project_dict["durationInFrames"] = total_frames
    project_dict["fps"] = fps

    # Media streaming URLs served via FastAPI /files/ endpoint
    project_dict["sourceUrl"] = f"http://127.0.0.1:8000/api/editor/projects/{slug}/files/{source_filename}"
    if has_conform:
        project_dict["conformUrl"] = f"http://127.0.0.1:8000/api/editor/projects/{slug}/files/conform.mp4?v={project.conform.hash}"
    if has_cutout:
        project_dict["cutoutUrl"] = f"http://127.0.0.1:8000/api/editor/projects/{slug}/files/{cutout_filename}?v={project.cutout.conformHash or '1'}"

    # Remap any layer image paths
    if "layers" in project_dict and isinstance(project_dict["layers"], list):
        for lyr in project_dict["layers"]:
            if lyr.get("src") and "/layers/" in lyr["src"]:
                lyr["src"] = f"projects/{slug}/layers/{Path(lyr['src']).name}"

    if not project.captions.enabled:
        project_dict["captions"]["cues"] = []

    # Ensure audio is not muted during export and graphics cues have sfxFile set
    project_dict["preview"] = {"showSafeZones": False, "muteAudio": False}
    if "graphics" in project_dict and isinstance(project_dict["graphics"], dict):
        for item in project_dict["graphics"].get("items", []):
            if not item.get("sfxFile"):
                comp = item.get("component", "")
                if "sandwich" in comp or "KineticTitle" in comp or "kinetic" in comp:
                    item["sfxFile"] = "whoosh.mp3"
                elif "punchline" in comp or "Punchline" in comp:
                    item["sfxFile"] = "pop.mp3"
                elif "pill" in comp or "badge" in comp:
                    item["sfxFile"] = "ding.mp3"
                else:
                    item["sfxFile"] = "pop.mp3"

    # Also resolve local filesystem paths for Remotion bundler
    project_dict["source"] = {
        "path": str(project_dir / "conform.mp4") if has_conform else str(project_dir / source_filename)
    }
    if has_cutout:
        project_dict["mask_video_path"] = str(project_dir / cutout_filename)

    if preset == "prores_master":
        # Direct FFmpeg ProRes 422 HQ export from conform
        if task:
            task.update(percent=30, message="Rendering ProRes 422 HQ Master...")
        src_vid = (project_dir / "conform.mp4") if has_conform else (project_dir / "source.mp4")
        out_name = f"{slug}_prores422hq.mov"
        out_path = project_exports_dir / out_name

        from server.silence_cutter import _get_ffmpeg_exe
        ffmpeg_exe = _get_ffmpeg_exe()

        cmd = [
            ffmpeg_exe, "-y",
            "-i", str(src_vid),
            "-c:v", "prores_ks",
            "-profile:v", "3",
            "-pix_fmt", "yuv422p10le",
            "-c:a", "pcm_s16le",
            str(out_path)
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if res.returncode != 0:
            raise RuntimeError(f"ProRes 422 master export failed: {res.stderr.decode('utf-8', errors='ignore')}")

        try:
            from server.paths import DOWNLOADS_DIR
            shutil.copyfile(out_path, DOWNLOADS_DIR / out_name)
        except Exception:
            pass

        if task:
            task.update(percent=100, message="ProRes 422 HQ master ready.")

        return {
            "success": True,
            "filename": out_name,
            "export_url": f"/api/editor/projects/{slug}/files/exports/{out_name}",
            "file_path": str(out_path),
            "size_bytes": out_path.stat().st_size,
        }

    # Otherwise Remotion render (mp4 or prores alpha)
    from server.motion_graphics import run_remotion_render

    def on_progress(p_data: Dict[str, Any]):
        if task:
            task.update(
                percent=p_data.get("progress", task.percent),
                message=p_data.get("message", "Rendering composition...")
            )

    export_format = "prores" if preset == "prores_overlay" else "mp4"
    out_filename = f"{slug}_{'alpha_prores4444.mov' if export_format == 'prores' else 'vertical_1080x1920.mp4'}"

    render_res = run_remotion_render(
        plan=project_dict,
        output_filename=out_filename,
        export_format=export_format,
        output_dir=project_exports_dir,
        progress_callback=on_progress,
        cancel_check=task.is_cancelled if task else None,
    )

    out_path = project_exports_dir / out_filename
    size_bytes = out_path.stat().st_size if out_path.exists() else int(render_res.get("file_size_mb", 0) * 1024 * 1024)

    if task:
        task.update(percent=100, message="Render completed successfully.")

    return {
        "success": True,
        "filename": out_filename,
        "export_url": f"/api/editor/projects/{slug}/files/exports/{out_filename}",
        "file_path": str(out_path),
        "size_bytes": size_bytes,
        "render_time_s": render_res.get("render_time_s", 0),
        "total_frames": render_res.get("total_frames", total_frames),
    }
