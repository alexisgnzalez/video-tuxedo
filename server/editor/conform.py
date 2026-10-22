"""
Conform video render engine for Tuxedo Editor.
Implements Rule 1: Micro audio crossfades on clip boundaries to eliminate zero-crossing audio pops.
Uses Apple Silicon Hardware Video Acceleration (h264_videotoolbox) with CFR 30fps.
"""

from __future__ import annotations

import os
import re
import subprocess
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from server.editor.paths import get_project_dir
from server.editor.project import Clip, ConformInfo, Project, edl_hash
from server.silence_cutter import _get_best_video_encoder, _get_ffmpeg_exe, get_media_properties


def render_conform(
    project: Project,
    is_cancelled: Optional[Callable[[], bool]] = None,
    progress_cb: Optional[Callable[[float, str], None]] = None,
) -> ConformInfo:
    """
    Renders the non-destructive EDL clips into a unified timeline-space conform.mp4.
    Applies 15ms audio micro-fades at clip edges to prevent audible zero-crossing pops.
    Encodes via Apple Silicon VideoToolbox (h264_videotoolbox) with CFR 30fps.
    """
    if not project.clips:
        raise ValueError("Cannot conform a project with zero active clips.")

    p_dir = get_project_dir(project.slug)
    source_file = project.source.webFile or project.source.file
    source_path = (p_dir / source_file).resolve()
    if not source_path.exists():
        source_path = (p_dir / project.source.file).resolve()
    if not source_path.exists():
        raise FileNotFoundError(f"Source media not found: {source_path}")

    current_hash = edl_hash(project.clips)
    conform_filename = "conform.mp4"
    output_path = p_dir / conform_filename

    # If conform with identical hash already exists, reuse it
    if output_path.exists() and project.conform and project.conform.hash == current_hash:
        props = get_media_properties(output_path)
        return ConformInfo(
            file=conform_filename,
            hash=current_hash,
            duration=props.get("duration", 0.0),
        )

    ffmpeg_exe = _get_ffmpeg_exe()
    v_encoder, v_opts = _get_best_video_encoder()

    clips = project.clips
    n = len(clips)
    total_expected_dur = sum(max(0.0, c.srcOut - c.srcIn) for c in clips)

    if progress_cb:
        progress_cb(5.0, "Preparing video filtergraph...")

    filter_parts = []
    concat_inputs = []

    for i, clip in enumerate(clips):
        s_in = clip.srcIn
        s_out = clip.srcOut
        dur = max(0.05, s_out - s_in)
        fade_d = min(0.015, dur / 2.0)

        # Video trim & reset PTS
        filter_parts.append(
            f"[0:v]trim=start={s_in:.3f}:end={s_out:.3f},setpts=PTS-STARTPTS[v{i}]"
        )

        # Audio trim with 15ms micro-fades in & out to eliminate pops/clicks at cut boundaries
        fade_out_start = max(0.0, dur - fade_d)
        filter_parts.append(
            f"[0:a]atrim=start={s_in:.3f}:end={s_out:.3f},asetpts=PTS-STARTPTS,"
            f"afade=t=in:ss=0:d={fade_d:.3f},"
            f"afade=t=out:st={fade_out_start:.3f}:d={fade_d:.3f}[a{i}]"
        )
        concat_inputs.append(f"[v{i}][a{i}]")

    concat_inputs_str = "".join(concat_inputs)
    filter_parts.append(f"{concat_inputs_str}concat=n={n}:v=1:a=1[outv][outa]")
    filter_complex = "; ".join(filter_parts)

    cmd = [
        ffmpeg_exe, "-y",
        "-i", str(source_path),
        "-filter_complex", filter_complex,
        "-map", "[outv]",
        "-map", "[outa]",
        "-c:v", v_encoder,
        *v_opts,
        "-r", "30",
        "-vsync", "cfr",
        "-c:a", "aac",
        "-b:a", "192k",
        "-progress", "pipe:1",
        str(output_path),
    ]

    t0 = time.time()
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
    )

    pattern = re.compile(r"out_time_ms=(\d+)")

    while True:
        if is_cancelled and is_cancelled():
            proc.kill()
            if output_path.exists():
                output_path.unlink(missing_ok=True)
            raise InterruptedError("Conform rendering cancelled by user.")

        line = proc.stdout.readline() if proc.stdout else ""
        if not line and proc.poll() is not None:
            break

        if line:
            m = pattern.search(line)
            if m and total_expected_dur > 0:
                out_ms = int(m.group(1))
                cur_sec = out_ms / 1_000_000.0
                pct = min(98.0, 5.0 + (cur_sec / total_expected_dur) * 93.0)
                if progress_cb:
                    progress_cb(pct, f"Rendering conform: {cur_sec:.1f}s / {total_expected_dur:.1f}s")

    stdout, stderr = proc.communicate()
    if proc.returncode != 0:
        err_msg = stderr[-600:] if stderr else "Unknown FFmpeg error"
        raise RuntimeError(f"Conform render failed: {err_msg}")

    # Inspect rendered media
    props = get_media_properties(output_path)
    real_duration = props.get("duration", total_expected_dur)
    elapsed = round(time.time() - t0, 2)
    print(f"🎬 Conform render completed in {elapsed}s: {output_path.name} ({real_duration:.2f}s)")

    if progress_cb:
        progress_cb(100.0, "Conform render complete.")

    return ConformInfo(
        file=conform_filename,
        hash=current_hash,
        duration=round(real_duration, 3),
    )
