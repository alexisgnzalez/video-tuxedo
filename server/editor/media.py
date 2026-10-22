"""
Media inspection, short-GOP web proxy creation, and waveform peaks generation for Tuxedo Editor.
Implements Rule 3 (short GOP proxy for browser EDL seeking) and Rule 2 (waveform peaks generation).
"""

from __future__ import annotations

import json
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List

import av
import imageio_ffmpeg
import numpy as np

from server.silence_cutter import get_video_rotation, _get_ffmpeg_exe


def probe_media(file_path: Path | str) -> Dict[str, Any]:
    """Inspects video and audio streams, accounting for phone display rotation."""
    file_path = Path(file_path).resolve()
    if not file_path.exists():
        raise FileNotFoundError(f"Media file not found: {file_path}")

    container = av.open(str(file_path))
    v_stream = container.streams.video[0] if container.streams.video else None
    a_stream = container.streams.audio[0] if container.streams.audio else None

    props = {
        "has_video": v_stream is not None,
        "has_audio": a_stream is not None,
        "duration": 0.0,
        "width": 1080,
        "height": 1920,
        "fps": 30.0,
        "rotation": 0,
        "video_codec": "",
        "audio_codec": "",
        "audio_rate": 48000,
        "audio_channels": 2,
    }

    if v_stream:
        w = v_stream.width
        h = v_stream.height
        rot = get_video_rotation(file_path)
        if abs(rot) in (90, 270):
            w, h = h, w
        props["width"] = w
        props["height"] = h
        props["rotation"] = rot
        props["video_codec"] = getattr(v_stream.codec_context, "name", "")
        if v_stream.average_rate:
            props["fps"] = float(v_stream.average_rate)
        if v_stream.duration and v_stream.time_base:
            props["duration"] = float(v_stream.duration * v_stream.time_base)

    if a_stream:
        props["audio_codec"] = getattr(a_stream.codec_context, "name", "")
        props["audio_rate"] = a_stream.rate
        props["audio_channels"] = a_stream.channels
        if not props["duration"] and a_stream.duration and a_stream.time_base:
            props["duration"] = float(a_stream.duration * a_stream.time_base)

    if not props["duration"] and container.duration:
        props["duration"] = float(container.duration) / float(av.time_base)

    container.close()
    return props


def create_web_proxy(
    src_path: Path | str,
    output_path: Path | str,
    force_rebuild: bool = False,
    progress_cb: Any = None,
) -> Path:
    """
    Creates an H.264/AAC short-GOP web proxy MP4 (-g 15 / keyframe every 0.5s at 30fps).
    This ensures Chromium's video decoder can seek instantaneously across 40+ EDL cuts
    in the Remotion Player with zero stutter or decoder crash.
    """
    src_path = Path(src_path).resolve()
    output_path = Path(output_path).resolve()

    if output_path.exists() and not force_rebuild:
        if output_path.stat().st_mtime >= src_path.stat().st_mtime:
            return output_path

    ffmpeg_exe = _get_ffmpeg_exe()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Use ultrafast preset with -g 15 (short GOP) and AAC audio
    cmd = [
        ffmpeg_exe, "-y",
        "-i", str(src_path),
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "20",
        "-pix_fmt", "yuv420p",
        "-g", "15",              # Keyframe every 15 frames (~0.5s) for instant seeking
        "-keyint_min", "15",
        "-r", "30",
        "-vsync", "cfr",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        str(output_path),
    ]

    t0 = time.time()
    proc = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if proc.returncode != 0:
        raise RuntimeError("Failed to generate short-GOP web proxy MP4")
    print(f"⚡ Generated short-GOP web proxy in {round(time.time() - t0, 2)}s: {output_path.name}")
    return output_path


def generate_waveform_peaks(
    media_path: Path | str,
    output_json_path: Path | str,
    samples_per_sec: int = 100,
) -> List[float]:
    """
    Decodes audio to mono 16kHz float array and computes normalized RMS peaks
    (default 100 points per second). Saves to peaks.json for the viewport-sized canvas.
    """
    media_path = Path(media_path).resolve()
    output_json_path = Path(output_json_path).resolve()

    if output_json_path.exists():
        try:
            with open(output_json_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    container = av.open(str(media_path))
    if not container.streams.audio:
        container.close()
        # No audio; return zero-amplitude waveform
        peaks = [0.0] * 10
        with open(output_json_path, "w", encoding="utf-8") as f:
            json.dump(peaks, f)
        return peaks

    resampler = av.AudioResampler(format="s16", layout="mono", rate=16000)
    audio_frames = []

    for frame in container.decode(audio=0):
        for resampled in resampler.resample(frame):
            audio_frames.append(resampled.to_ndarray())

    for resampled in resampler.resample(None):
        audio_frames.append(resampled.to_ndarray())

    container.close()

    if not audio_frames:
        peaks = [0.0] * 10
        with open(output_json_path, "w", encoding="utf-8") as f:
            json.dump(peaks, f)
        return peaks

    raw_audio = np.concatenate(audio_frames, axis=1).squeeze().astype(np.float32) / 32768.0
    total_samples = len(raw_audio)
    chunk_size = max(1, int(16000 / samples_per_sec))
    num_chunks = int(np.ceil(total_samples / chunk_size))

    peaks: List[float] = []
    for i in range(num_chunks):
        chunk = raw_audio[i * chunk_size : (i + 1) * chunk_size]
        if len(chunk) > 0:
            rms = float(np.sqrt(np.mean(chunk**2)))
            # Boost dynamics slightly for clean visual peaks
            val = min(1.0, rms * 3.2)
            peaks.append(round(val, 3))
        else:
            peaks.append(0.0)

    output_json_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(peaks, f)

    return peaks
