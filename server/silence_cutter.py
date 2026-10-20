"""
Silence Cutter & Jump Cut Engine for Video Tuxedo.
Features:
- Silero VAD (100% local, offline, high-accuracy Voice Activity Detection).
- Apple Silicon Hardware Video Acceleration (h264_videotoolbox).
- Single Jump-Cut Video export (seamless concat).
- Multipart Takes export (individual clips + ZIP).
- DaVinci Resolve Timeline export (FCPXML & CMX 3600 EDL for 100% lossless 0-reencode editing).
- Synchronized Subtitle track generator (.srt) aligned to the cut timeline.
"""

from __future__ import annotations

import math
import os
import re
import shutil
import subprocess
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import av
import imageio_ffmpeg
import numpy as np
from faster_whisper.vad import VadOptions, get_speech_timestamps


@dataclass
class CutSegment:
    index: int
    start: float
    end: float
    duration: float
    segment_type: str  # "speech" (keep) or "silence" (cut)
    rec_start: float = 0.0  # Time offset in cut timeline
    rec_end: float = 0.0


def get_video_rotation(media_path: str | Path) -> int:
    """
    Detects video display matrix rotation (e.g. 90, 180, 270 degrees) using ffmpeg.
    Mobile phone vertical videos often store pixels horizontally with a 90° rotation tag.
    """
    try:
        exe = _get_ffmpeg_exe()
        proc = subprocess.run([exe, "-i", str(media_path)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stderr = proc.stderr.decode("utf-8", errors="replace")
        for line in stderr.splitlines():
            if "rotation of" in line:
                m = re.search(r"rotation of ([-\d.]+)", line)
                if m:
                    return int(float(m.group(1)))
            elif "rotate" in line and ":" in line:
                m = re.search(r"rotate\s*:\s*([-\d.]+)", line)
                if m:
                    return int(float(m.group(1)))
    except Exception:
        pass
    return 0


def get_media_properties(media_path: str | Path) -> Dict[str, Any]:
    """Inspects video/audio properties using PyAV, accounting for display rotation."""
    container = av.open(str(media_path))
    v_stream = container.streams.video[0] if container.streams.video else None
    a_stream = container.streams.audio[0] if container.streams.audio else None

    props = {
        "has_video": v_stream is not None,
        "has_audio": a_stream is not None,
        "duration": 0.0,
        "width": 1920,
        "height": 1080,
        "fps": 30.0,
        "audio_rate": 48000,
        "audio_channels": 2,
        "rotation": 0,
        "is_portrait": False,
    }

    if v_stream:
        w = v_stream.width
        h = v_stream.height
        rot = get_video_rotation(media_path)
        # Mobile phones store raw pixel buffer as landscape with a 90/270deg display matrix.
        # Swap width & height so timeline matches the true visible aspect ratio!
        if abs(rot) in (90, 270):
            w, h = h, w

        props["width"] = w
        props["height"] = h
        props["rotation"] = rot
        props["is_portrait"] = h > w

        if v_stream.average_rate:
            props["fps"] = float(v_stream.average_rate)
        if v_stream.duration and v_stream.time_base:
            props["duration"] = float(v_stream.duration * v_stream.time_base)

    if a_stream:
        props["audio_rate"] = a_stream.rate
        props["audio_channels"] = a_stream.channels
        if not props["duration"] and a_stream.duration and a_stream.time_base:
            props["duration"] = float(a_stream.duration * a_stream.time_base)

    if not props["duration"] and container.duration:
        props["duration"] = float(container.duration) / float(av.time_base)

    container.close()
    return props


def extract_audio_for_vad(media_path: str | Path) -> Tuple[np.ndarray, float]:
    """
    Extracts 16kHz mono audio as normalized float32 numpy array for Silero VAD.
    """
    container = av.open(str(media_path))
    if not container.streams.audio:
        container.close()
        raise ValueError("Provided media file has no audio stream to analyze.")

    resampler = av.AudioResampler(format="s16", layout="mono", rate=16000)
    audio_frames = []

    for frame in container.decode(audio=0):
        for resampled in resampler.resample(frame):
            audio_frames.append(resampled.to_ndarray())

    for resampled in resampler.resample(None):
        audio_frames.append(resampled.to_ndarray())

    container.close()

    if not audio_frames:
        raise ValueError("Could not decode audio frames from media.")

    audio_data = np.concatenate(audio_frames, axis=1).squeeze().astype(np.float32) / 32768.0
    total_duration = len(audio_data) / 16000.0
    return audio_data, total_duration


def detect_silence_and_speech(
    media_path: str | Path,
    min_silence_duration_s: float = 0.45,
    speech_padding_s: float = 0.12,
    vad_threshold: float = 0.5,
) -> Dict[str, Any]:
    """
    Analyzes audio using Silero VAD to detect speech (keep) and silence (cut) intervals.
    - min_silence_duration_s: Pauses longer than this are cut. Shorter pauses are kept as natural cadence.
    - speech_padding_s: Safety buffer added before and after speech to ensure zero syllables are clipped.
    - vad_threshold: Voice probability threshold (0.0 to 1.0).
    """
    media_path = Path(media_path).resolve()
    audio_data, total_duration = extract_audio_for_vad(media_path)

    # Configure Silero VAD
    min_silence_ms = max(100, int(min_silence_duration_s * 1000))
    pad_ms = max(0, int(speech_padding_s * 1000))

    vad_opts = VadOptions(
        threshold=float(vad_threshold),
        min_silence_duration_ms=min_silence_ms,
        speech_pad_ms=pad_ms,
        min_speech_duration_ms=100,
    )

    raw_speech = get_speech_timestamps(audio_data, vad_opts, sampling_rate=16000)

    # Convert sample indices to seconds
    speech_segments: List[Dict[str, Any]] = []
    cumulative_rec = 0.0

    for i, seg in enumerate(raw_speech):
        s = round(seg["start"] / 16000.0, 3)
        e = round(seg["end"] / 16000.0, 3)
        s = max(0.0, min(s, total_duration))
        e = max(s, min(e, total_duration))
        dur = round(e - s, 3)
        if dur > 0.05:
            speech_segments.append({
                "index": i + 1,
                "start": s,
                "end": e,
                "duration": dur,
                "rec_start": round(cumulative_rec, 3),
                "rec_end": round(cumulative_rec + dur, 3),
            })
            cumulative_rec += dur

    # Detect silences (the gaps between speech segments)
    silence_segments: List[Dict[str, Any]] = []
    current_time = 0.0

    for i, sp in enumerate(speech_segments):
        if sp["start"] > current_time:
            sil_dur = round(sp["start"] - current_time, 3)
            if sil_dur > 0.02:
                silence_segments.append({
                    "index": len(silence_segments) + 1,
                    "start": round(current_time, 3),
                    "end": sp["start"],
                    "duration": sil_dur,
                })
        current_time = sp["end"]

    if current_time < total_duration:
        trailing_sil = round(total_duration - current_time, 3)
        if trailing_sil > 0.02:
            silence_segments.append({
                "index": len(silence_segments) + 1,
                "start": round(current_time, 3),
                "end": round(total_duration, 3),
                "duration": trailing_sil,
            })

    total_speech_dur = round(sum(s["duration"] for s in speech_segments), 3)
    total_silence_dur = round(sum(s["duration"] for s in silence_segments), 3)
    silence_percent = round((total_silence_dur / max(total_duration, 0.001)) * 100.0, 1)

    # Build ordered timeline of all segments (for the interactive visualizer)
    timeline: List[Dict[str, Any]] = []
    all_segs = []
    for sp in speech_segments:
        all_segs.append({**sp, "type": "speech"})
    for sil in silence_segments:
        all_segs.append({**sil, "type": "silence"})
    all_segs.sort(key=lambda x: x["start"])

    for idx, item in enumerate(all_segs):
        item["timeline_index"] = idx + 1
        timeline.append(item)

    return {
        "media_path": str(media_path),
        "filename": media_path.name,
        "total_duration": round(total_duration, 2),
        "total_speech_duration": total_speech_dur,
        "total_silence_duration": total_silence_dur,
        "silence_percentage": silence_percent,
        "speech_segments_count": len(speech_segments),
        "silence_segments_count": len(silence_segments),
        "speech_segments": speech_segments,
        "silence_segments": silence_segments,
        "timeline": timeline,
    }


def _get_ffmpeg_exe() -> str:
    """Returns path to imageio-ffmpeg executable."""
    return imageio_ffmpeg.get_ffmpeg_exe()


def _get_best_video_encoder() -> Tuple[str, List[str]]:
    """
    Selects Apple Silicon hardware encoder (h264_videotoolbox) if available,
    otherwise falls back to libx264.
    """
    exe = _get_ffmpeg_exe()
    try:
        out = subprocess.check_output([exe, "-encoders"], stderr=subprocess.DEVNULL).decode()
        if "h264_videotoolbox" in out:
            # High quality hardware acceleration options
            return "h264_videotoolbox", ["-b:v", "6000k", "-pix_fmt", "nv12"]
    except Exception:
        pass
    return "libx264", ["-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p"]


def render_single_cut_video(
    input_path: str | Path,
    speech_segments: List[Dict[str, Any]],
    output_filename: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Concatenates all active speech segments into a single seamless jump-cut video.
    Uses hardware acceleration with near-lossless bitrate.
    Auto-saves to user's ~/Downloads/ directory.
    """
    input_path = Path(input_path).resolve()
    if not speech_segments:
        raise ValueError("No speech segments provided for rendering.")

    stem = input_path.stem
    if not output_filename:
        output_filename = f"{stem}_cut.mp4"

    downloads_dir = Path.home() / "Downloads"
    downloads_dir.mkdir(parents=True, exist_ok=True)
    out_path = downloads_dir / output_filename

    # If already exists, generate unique name
    counter = 1
    while out_path.exists():
        out_path = downloads_dir / f"{stem}_cut_{counter}.mp4"
        counter += 1

    exe = _get_ffmpeg_exe()
    v_encoder, v_opts = _get_best_video_encoder()

    # Build filter_complex with trim and concat
    filter_parts = []
    concat_inputs = []

    for i, seg in enumerate(speech_segments):
        start = seg["start"]
        end = seg["end"]
        filter_parts.append(f"[0:v]trim=start={start:.3f}:end={end:.3f},setpts=PTS-STARTPTS[v{i}]")
        filter_parts.append(f"[0:a]atrim=start={start:.3f}:end={end:.3f},asetpts=PTS-STARTPTS[a{i}]")
        concat_inputs.append(f"[v{i}][a{i}]")

    n = len(speech_segments)
    filter_str = (
        "; ".join(filter_parts)
        + "; "
        + "".join(concat_inputs)
        + f"concat=n={n}:v=1:a=1[outv][outa]"
    )

    cmd = [
        exe, "-y",
        "-i", str(input_path),
        "-filter_complex", filter_str,
        "-map", "[outv]",
        "-map", "[outa]",
        "-c:v", v_encoder,
        *v_opts,
        "-r", "30",
        "-vsync", "cfr",
        "-c:a", "aac",
        "-b:a", "192k",
        str(out_path),
    ]

    t0 = time.time()
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    t1 = time.time()

    if proc.returncode != 0:
        err = proc.stderr.decode("utf-8", errors="replace")
        raise RuntimeError(f"FFmpeg render failed: {err[-600:]}")

    # Inspect rendered output
    rendered_props = get_media_properties(out_path)

    return {
        "status": "success",
        "output_path": str(out_path),
        "filename": out_path.name,
        "file_size_mb": round(out_path.stat().st_size / (1024 * 1024), 2),
        "duration": rendered_props["duration"],
        "render_time_s": round(t1 - t0, 2),
        "encoder": v_encoder,
        "segments_joined": n,
    }


def render_multipart_takes(
    input_path: str | Path,
    speech_segments: List[Dict[str, Any]],
    output_folder_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Exports each active speech take as an individual MP4 clip in a dedicated folder in ~/Downloads/.
    Also packages all takes into a single .zip archive for 1-click sharing.
    """
    input_path = Path(input_path).resolve()
    if not speech_segments:
        raise ValueError("No speech segments provided for rendering takes.")

    stem = input_path.stem
    if not output_folder_name:
        output_folder_name = f"{stem}_takes"

    downloads_dir = Path.home() / "Downloads"
    folder_path = downloads_dir / output_folder_name
    folder_path.mkdir(parents=True, exist_ok=True)

    exe = _get_ffmpeg_exe()
    v_encoder, v_opts = _get_best_video_encoder()

    take_files: List[Dict[str, Any]] = []
    t0 = time.time()

    for seg in speech_segments:
        idx = seg["index"]
        start = seg["start"]
        end = seg["end"]
        clip_name = f"take_{idx:02d}_{start:.1f}s-{end:.1f}s.mp4"
        clip_path = folder_path / clip_name

        cmd = [
            exe, "-y",
            "-ss", f"{start:.3f}",
            "-to", f"{end:.3f}",
            "-i", str(input_path),
            "-c:v", v_encoder,
            *v_opts,
            "-r", "30",
            "-vsync", "cfr",
            "-c:a", "aac",
            "-b:a", "192k",
            "-avoid_negative_ts", "make_zero",
            str(clip_path),
        ]

        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        take_files.append({
            "index": idx,
            "filename": clip_name,
            "path": str(clip_path),
            "start": start,
            "end": end,
            "duration": seg["duration"],
            "size_mb": round(clip_path.stat().st_size / (1024 * 1024), 2),
        })

    # Create ZIP archive
    zip_path = downloads_dir / f"{output_folder_name}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for take in take_files:
            file_p = Path(take["path"])
            zipf.write(file_p, arcname=file_p.name)

    t1 = time.time()

    return {
        "status": "success",
        "folder_path": str(folder_path),
        "zip_path": str(zip_path),
        "zip_filename": zip_path.name,
        "zip_size_mb": round(zip_path.stat().st_size / (1024 * 1024), 2),
        "takes_count": len(take_files),
        "takes": take_files,
        "render_time_s": round(t1 - t0, 2),
    }


def _seconds_to_timecode(seconds: float, fps: float = 30.0) -> str:
    """Converts seconds to HH:MM:SS:FF standard SMPTE timecode."""
    total_frames = int(round(seconds * fps))
    ff = total_frames % int(round(fps))
    total_sec = total_frames // int(round(fps))
    ss = total_sec % 60
    total_min = total_sec // 60
    mm = total_min % 60
    hh = total_min // 60
    return f"{hh:02d}:{mm:02d}:{ss:02d}:{ff:02d}"


def export_davinci_edl(
    input_path: str | Path,
    speech_segments: List[Dict[str, Any]],
    output_filename: Optional[str] = None,
    fps: float = 30.0,
) -> Dict[str, Any]:
    """
    Generates a CMX 3600 EDL (Edit Decision List) for DaVinci Resolve Free.
    Allows 100% lossless, 0-reencode non-destructive editing using the raw source video.
    Auto-saves directly to ~/Downloads/.
    """
    input_path = Path(input_path).resolve()
    stem = input_path.stem
    if not output_filename:
        output_filename = f"{stem}_cuts.edl"

    downloads_dir = Path.home() / "Downloads"
    downloads_dir.mkdir(parents=True, exist_ok=True)
    edl_path = downloads_dir / output_filename

    lines = [
        f"TITLE: {stem.upper()}_CUTS",
        "FCM: NON-DROP FRAME",
        "",
    ]

    cumulative_record = 0.0

    for i, seg in enumerate(speech_segments):
        event_num = f"{i + 1:03d}"
        src_in = _seconds_to_timecode(seg["start"], fps)
        src_out = _seconds_to_timecode(seg["end"], fps)
        rec_in = _seconds_to_timecode(cumulative_record, fps)
        cumulative_record += seg["duration"]
        rec_out = _seconds_to_timecode(cumulative_record, fps)

        # Video event
        lines.append(f"{event_num}  AX       V     C        {src_in} {src_out} {rec_in} {rec_out}")
        lines.append(f"* FROM CLIP NAME: {input_path.name}")

        # Audio track 1 event
        lines.append(f"{event_num}  AX       A     C        {src_in} {src_out} {rec_in} {rec_out}")
        lines.append(f"* FROM CLIP NAME: {input_path.name}")
        lines.append("")

    edl_content = "\n".join(lines)
    edl_path.write_text(edl_content, encoding="utf-8")

    return {
        "status": "success",
        "output_path": str(edl_path),
        "filename": edl_path.name,
        "content": edl_content,
        "cuts_count": len(speech_segments),
        "total_timeline_duration": round(cumulative_record, 2),
    }


def _get_standard_timebase(fps: float) -> Tuple[int, bool, float]:
    """
    Resolves standard NLE timebase and NTSC flag from measured fps.
    Returns (timebase, is_ntsc, effective_fps).
    """
    if abs(fps - 29.97) < 0.25 or abs(fps - 29.978) < 0.25:
        return 30, True, 30000.0 / 1001.0
    elif abs(fps - 23.976) < 0.25 or abs(fps - 23.98) < 0.25:
        return 24, True, 24000.0 / 1001.0
    elif abs(fps - 59.94) < 0.25:
        return 60, True, 60000.0 / 1001.0
    elif abs(fps - 24.0) < 0.25:
        return 24, False, 24.0
    elif abs(fps - 25.0) < 0.25:
        return 25, False, 25.0
    elif abs(fps - 30.0) < 0.25:
        return 30, False, 30.0
    elif abs(fps - 60.0) < 0.25:
        return 60, False, 60.0
    else:
        tb = max(1, int(round(fps)))
        return tb, False, float(tb)


def export_davinci_xmeml(
    input_path: str | Path,
    speech_segments: List[Dict[str, Any]],
    output_filename: Optional[str] = None,
    fps: float = 30.0,
    width: int = 1080,
    height: int = 1920,
    audio_rate: int = 48000,
    total_source_duration: float = 0.0,
) -> Dict[str, Any]:
    """
    Generates a Final Cut Pro 7 XML (xmeml version 5) sequence for DaVinci Resolve.
    This is the industry-standard, rock-solid timeline interchange format.
    - Explicitly sets sequence resolution (defaults to 1080x1920 Vertical).
    - Populates Video Track 1 (V1) and a single synchronized Audio Track 1 (A1).
    - Audio and Video clips are explicitly linked together.
    - Integer frame math guarantees zero dropped clips or timecode drift.
    """
    input_path = Path(input_path).resolve()
    stem = input_path.stem
    if not output_filename:
        output_filename = f"{stem}_cuts.xml"

    downloads_dir = Path.home() / "Downloads"
    downloads_dir.mkdir(parents=True, exist_ok=True)
    xml_path = downloads_dir / output_filename

    timebase, ntsc, fps_eff = _get_standard_timebase(fps)
    ntsc_str = "TRUE" if ntsc else "FALSE"
    source_total_frames = int(round((total_source_duration or 3600.0) * fps_eff))
    file_url = f"file://localhost{input_path.as_posix()}"

    video_items = []
    audio_items = []

    rec_frame = 0

    for i, seg in enumerate(speech_segments):
        clip_idx = i + 1
        in_f = int(round(seg["start"] * fps_eff))
        out_f = int(round(seg["end"] * fps_eff))
        dur_f = max(1, out_f - in_f)
        start_f = rec_frame
        end_f = start_f + dur_f
        rec_frame = end_f

        if i == 0:
            file_block = f"""        <file id="file-1">
          <name>{input_path.name}</name>
          <pathurl>{file_url}</pathurl>
          <rate>
            <timebase>{timebase}</timebase>
            <ntsc>{ntsc_str}</ntsc>
          </rate>
          <duration>{source_total_frames}</duration>
          <timecode>
            <rate>
              <timebase>{timebase}</timebase>
              <ntsc>{ntsc_str}</ntsc>
            </rate>
            <string>00:00:00:00</string>
            <frame>0</frame>
            <displayformat>NDF</displayformat>
          </timecode>
          <media>
            <video>
              <samplecharacteristics>
                <rate>
                  <timebase>{timebase}</timebase>
                  <ntsc>{ntsc_str}</ntsc>
                </rate>
                <width>{width}</width>
                <height>{height}</height>
                <anamorphic>FALSE</anamorphic>
                <pixelaspectratio>square</pixelaspectratio>
                <fielddominance>none</fielddominance>
              </samplecharacteristics>
            </video>
            <audio>
              <samplecharacteristics>
                <depth>16</depth>
                <samplerate>{audio_rate}</samplerate>
              </samplecharacteristics>
              <channelcount>2</channelcount>
            </audio>
          </media>
        </file>"""
        else:
            file_block = '        <file id="file-1"/>'

        v_item = f"""      <clipitem id="clipitem-video-{clip_idx}">
        <masterclipid>masterclip-1</masterclipid>
        <name>Take {clip_idx} ({seg["start"]:.1f}s - {seg["end"]:.1f}s)</name>
        <enabled>TRUE</enabled>
        <duration>{dur_f}</duration>
        <rate>
          <timebase>{timebase}</timebase>
          <ntsc>{ntsc_str}</ntsc>
        </rate>
        <start>{start_f}</start>
        <end>{end_f}</end>
        <in>{in_f}</in>
        <out>{out_f}</out>
{file_block}
        <link>
          <linkclipref>clipitem-video-{clip_idx}</linkclipref>
          <mediatype>video</mediatype>
          <trackindex>1</trackindex>
          <clipindex>{clip_idx}</clipindex>
        </link>
        <link>
          <linkclipref>clipitem-audio-{clip_idx}</linkclipref>
          <mediatype>audio</mediatype>
          <trackindex>1</trackindex>
          <clipindex>{clip_idx}</clipindex>
        </link>
      </clipitem>"""
        video_items.append(v_item)

        a_item = f"""      <clipitem id="clipitem-audio-{clip_idx}">
        <masterclipid>masterclip-1</masterclipid>
        <name>Take {clip_idx} ({seg["start"]:.1f}s - {seg["end"]:.1f}s)</name>
        <enabled>TRUE</enabled>
        <duration>{dur_f}</duration>
        <rate>
          <timebase>{timebase}</timebase>
          <ntsc>{ntsc_str}</ntsc>
        </rate>
        <start>{start_f}</start>
        <end>{end_f}</end>
        <in>{in_f}</in>
        <out>{out_f}</out>
        <file id="file-1"/>
        <sourcetrack>
          <mediatype>audio</mediatype>
          <trackindex>1</trackindex>
        </sourcetrack>
        <link>
          <linkclipref>clipitem-video-{clip_idx}</linkclipref>
          <mediatype>video</mediatype>
          <trackindex>1</trackindex>
          <clipindex>{clip_idx}</clipindex>
        </link>
        <link>
          <linkclipref>clipitem-audio-{clip_idx}</linkclipref>
          <mediatype>audio</mediatype>
          <trackindex>1</trackindex>
          <clipindex>{clip_idx}</clipindex>
        </link>
      </clipitem>"""
        audio_items.append(a_item)

    total_rec_frames = rec_frame

    full_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
  <sequence id="sequence-1">
    <name>{stem}_JumpCut_Project</name>
    <duration>{total_rec_frames}</duration>
    <rate>
      <timebase>{timebase}</timebase>
      <ntsc>{ntsc_str}</ntsc>
    </rate>
    <timecode>
      <rate>
        <timebase>{timebase}</timebase>
        <ntsc>{ntsc_str}</ntsc>
      </rate>
      <string>00:00:00:00</string>
      <frame>0</frame>
      <displayformat>NDF</displayformat>
    </timecode>
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <rate>
              <timebase>{timebase}</timebase>
              <ntsc>{ntsc_str}</ntsc>
            </rate>
            <width>{width}</width>
            <height>{height}</height>
            <anamorphic>FALSE</anamorphic>
            <pixelaspectratio>square</pixelaspectratio>
            <fielddominance>none</fielddominance>
          </samplecharacteristics>
        </format>
        <track>
{chr(10).join(video_items)}
        </track>
      </video>
      <audio>
        <format>
          <samplecharacteristics>
            <depth>16</depth>
            <samplerate>{audio_rate}</samplerate>
          </samplecharacteristics>
        </format>
        <track>
{chr(10).join(audio_items)}
        </track>
      </audio>
    </media>
  </sequence>
</xmeml>
"""
    xml_path.write_text(full_xml, encoding="utf-8")

    return {
        "status": "success",
        "output_path": str(xml_path),
        "filename": xml_path.name,
        "content": full_xml,
        "cuts_count": len(speech_segments),
        "total_timeline_duration": round(total_rec_frames / fps_eff, 2),
        "width": width,
        "height": height,
    }


def export_davinci_fcpxml(
    input_path: str | Path,
    speech_segments: List[Dict[str, Any]],
    output_filename: Optional[str] = None,
    fps: float = 30.0,
    width: int = 1080,
    height: int = 1920,
    total_source_duration: float = 0.0,
) -> Dict[str, Any]:
    """
    Generates a Final Cut Pro XML (FCPXML 1.8) sequence natively importable by DaVinci Resolve.
    - Uses exact rational fractions conforming to NLE standards.
    - Wraps clips in contiguous <spine> elements without conflicting offset attributes.
    - Adds explicit <video> and <audio> sub-elements to ensure audio tracks populate.
    """
    input_path = Path(input_path).resolve()
    stem = input_path.stem
    if not output_filename:
        output_filename = f"{stem}_cuts.fcpxml"

    downloads_dir = Path.home() / "Downloads"
    downloads_dir.mkdir(parents=True, exist_ok=True)
    xml_path = downloads_dir / output_filename

    timebase, ntsc, fps_eff = _get_standard_timebase(fps)

    if ntsc:
        frame_dur = f"1001/{timebase * 1000}s"
        den = timebase * 1000
        mult = 1001
    else:
        frame_dur = f"1/{timebase}s"
        den = timebase
        mult = 1

    source_frames = int(round((total_source_duration or 3600.0) * fps_eff))
    source_dur_str = f"{source_frames * mult}/{den}s"

    clips_xml = []
    total_timeline_frames = 0

    for i, seg in enumerate(speech_segments):
        in_f = int(round(seg["start"] * fps_eff))
        out_f = int(round(seg["end"] * fps_eff))
        dur_f = max(1, out_f - in_f)
        total_timeline_frames += dur_f

        dur_s = f"{dur_f * mult}/{den}s"
        start_s = f"{in_f * mult}/{den}s"

        clip_element = f"""
                        <clip name="Take {i+1} ({seg['start']:.1f}s - {seg['end']:.1f}s)" duration="{dur_s}" start="{start_s}">
                            <video ref="r2" duration="{dur_s}" start="{start_s}"/>
                            <audio ref="r2" duration="{dur_s}" start="{start_s}" role="dialogue"/>
                        </clip>"""
        clips_xml.append(clip_element)

    seq_dur_str = f"{total_timeline_frames * mult}/{den}s"
    file_uri = input_path.as_uri()

    fcpxml_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.8">
    <resources>
        <format id="r1" name="FFVideoFormat{width}x{height}p{timebase}" frameDuration="{frame_dur}" width="{width}" height="{height}"/>
        <asset id="r2" name="{input_path.name}" src="{file_uri}" start="0s" duration="{source_dur_str}" hasVideo="1" hasAudio="1" audioSources="1" audioChannels="2"/>
    </resources>
    <library>
        <event name="Video Tuxedo Cuts">
            <project name="{stem}_JumpCut_Project">
                <sequence format="r1" duration="{seq_dur_str}" tcStart="0s" tcFormat="NDF">
                    <spine>{"".join(clips_xml)}
                    </spine>
                </sequence>
            </project>
        </event>
    </library>
</fcpxml>
"""
    xml_path.write_text(fcpxml_content, encoding="utf-8")

    return {
        "status": "success",
        "output_path": str(xml_path),
        "filename": xml_path.name,
        "content": fcpxml_content,
        "cuts_count": len(speech_segments),
        "total_timeline_duration": round(total_timeline_frames / fps_eff, 2),
        "width": width,
        "height": height,
    }


def remap_subtitles_to_cut_timeline(
    subtitle_cues: List[Dict[str, Any]],
    speech_segments: List[Dict[str, Any]],
    output_filename: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Translates original subtitle cues to the new jump-cut timeline!
    Because silences have been removed, timestamps are adjusted by subtracting
    accumulated silence durations before each speech segment.
    Guarantees ZERO dropped cues: any cue spoken before, during, or across speech takes
    is smoothly clamped to the corresponding speech segment on the cut timeline.
    Produces a 100% synchronized .srt file ready to drop into DaVinci Resolve ST1 track.
    """
    if not subtitle_cues or not speech_segments:
        return {"status": "skipped", "cues": []}

    remapped_cues: List[Dict[str, Any]] = []

    for cue in subtitle_cues:
        s = cue["start"]
        e = cue["end"]
        text = cue.get("text", "").strip()
        if not text:
            continue

        # 1. Check for overlapping speech segment(s)
        best_seg = None
        best_overlap = -1.0

        for seg in speech_segments:
            ov_s = max(s, seg["start"])
            ov_e = min(e, seg["end"])
            ov = ov_e - ov_s
            if ov > best_overlap and ov > 0:
                best_overlap = ov
                best_seg = seg

        # 2. If no strict overlap, find closest speech segment within 1.2s window
        if best_seg is None:
            min_dist = float("inf")
            for seg in speech_segments:
                if e < seg["start"]:
                    dist = seg["start"] - e
                elif s > seg["end"]:
                    dist = s - seg["end"]
                else:
                    dist = 0.0
                if dist < min_dist and dist < 1.2:
                    min_dist = dist
                    best_seg = seg

        # 3. Fallback: if cue is outside 1.2s, attach to nearest segment by midpoint
        if best_seg is None and speech_segments:
            mid = (s + e) / 2.0
            best_seg = min(speech_segments, key=lambda seg: abs((seg["start"] + seg["end"]) / 2.0 - mid))

        if best_seg is None:
            continue

        # Map to cut timeline within best_seg
        rel_s = max(0.0, min(s - best_seg["start"], best_seg["duration"]))
        rel_e = max(0.0, min(e - best_seg["start"], best_seg["duration"]))

        # Ensure legible minimum duration (at least 0.35s, up to segment duration)
        if rel_e <= rel_s or (rel_e - rel_s) < 0.35:
            rel_e = min(best_seg["duration"], rel_s + max(0.5, e - s))
            if rel_e <= rel_s:
                rel_s = max(0.0, rel_e - 0.5)

        rec_s = round(best_seg["rec_start"] + rel_s, 3)
        rec_e = round(best_seg["rec_start"] + rel_e, 3)

        remapped_cues.append({
            "id": len(remapped_cues) + 1,
            "start": rec_s,
            "end": rec_e,
            "text": text,
        })

    # Format SubRip (.srt)
    srt_lines = []
    for c in remapped_cues:
        s_srt = _format_srt_time(c["start"])
        e_srt = _format_srt_time(c["end"])
        srt_lines.append(f"{c['id']}\n{s_srt} --> {e_srt}\n{c['text']}\n")

    srt_content = "\n".join(srt_lines)

    downloads_dir = Path.home() / "Downloads"
    downloads_dir.mkdir(parents=True, exist_ok=True)
    if not output_filename:
        output_filename = "cut_timeline_subtitles.srt"
    out_srt_path = downloads_dir / output_filename
    out_srt_path.write_text(srt_content, encoding="utf-8")

    return {
        "status": "success",
        "output_path": str(out_srt_path),
        "filename": out_srt_path.name,
        "content": srt_content,
        "cues_count": len(remapped_cues),
    }


def _format_srt_time(seconds: float) -> str:
    """Formats seconds into SRT time format HH:MM:SS,mmm"""
    total_ms = int(round(seconds * 1000.0))
    ms = total_ms % 1000
    total_sec = total_ms // 1000
    s = total_sec % 60
    total_min = total_sec // 60
    m = total_min % 60
    h = total_min // 60
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
