"""
DaVinci Resolve Free Subtitle Formatter & Exporter
Handles strict SubRip (.srt) and WebVTT (.vtt) generation optimized
for importing directly into DaVinci Resolve Free's Subtitle Tracks.
"""

from typing import List, Dict, Any


def seconds_to_srt_timecode(seconds: float) -> str:
    """
    Convert seconds into DaVinci-compatible SRT timecode: HH:MM:SS,mmm
    Example: 83.42 -> 00:01:23,420
    """
    if seconds < 0:
        seconds = 0.0

    total_milliseconds = int(round(seconds * 1000))
    hours = total_milliseconds // 3600000
    remainder = total_milliseconds % 3600000
    minutes = remainder // 60000
    remainder = remainder % 60000
    secs = remainder // 1000
    millis = remainder % 1000

    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def seconds_to_vtt_timecode(seconds: float) -> str:
    """
    Convert seconds into WebVTT timecode: HH:MM:SS.mmm
    """
    if seconds < 0:
        seconds = 0.0

    total_milliseconds = int(round(seconds * 1000))
    hours = total_milliseconds // 3600000
    remainder = total_milliseconds % 3600000
    minutes = remainder // 60000
    remainder = remainder % 60000
    secs = remainder // 1000
    millis = remainder % 1000

    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def format_davinci_srt(segments: List[Dict[str, Any]]) -> str:
    """
    Generates a clean .srt file string that imports flawlessly into
    DaVinci Resolve Free without parsing errors or timecode drifts.
    """
    srt_blocks = []
    index = 1

    for seg in segments:
        text = seg.get("text", "").strip()
        if not text:
            continue

        start_time = float(seg.get("start", 0.0))
        end_time = float(seg.get("end", start_time + 1.0))

        # Ensure start is less than end
        if end_time <= start_time:
            end_time = start_time + 0.5

        start_tc = seconds_to_srt_timecode(start_time)
        end_tc = seconds_to_srt_timecode(end_time)

        block = f"{index}\n{start_tc} --> {end_tc}\n{text}\n"
        srt_blocks.append(block)
        index += 1

    return "\n".join(srt_blocks) + "\n"


def format_webvtt(segments: List[Dict[str, Any]]) -> str:
    """
    Generates WebVTT (.vtt) file string.
    """
    lines = ["WEBVTT", ""]
    index = 1

    for seg in segments:
        text = seg.get("text", "").strip()
        if not text:
            continue

        start_time = float(seg.get("start", 0.0))
        end_time = float(seg.get("end", start_time + 1.0))

        if end_time <= start_time:
            end_time = start_time + 0.5

        start_tc = seconds_to_vtt_timecode(start_time)
        end_tc = seconds_to_vtt_timecode(end_time)

        lines.append(f"{index}")
        lines.append(f"{start_tc} --> {end_tc}")
        lines.append(f"{text}")
        lines.append("")
        index += 1

    return "\n".join(lines)


DAVINCI_IMPORT_GUIDE = {
    "title": "How to Import Subtitles into DaVinci Resolve Free",
    "steps": [
        {
            "step": 1,
            "title": "Open Your Project & Go to Edit Page",
            "description": "Open your project in DaVinci Resolve and switch to the Edit tab (Shift+4)."
        },
        {
            "step": 2,
            "title": "Import the Generated .SRT File",
            "description": "Click 'File' > 'Import' > 'Subtitle...' from the top menu, OR simply drag and drop the exported .srt file from your Downloads folder straight into your Media Pool."
        },
        {
            "step": 3,
            "title": "Add to Timeline",
            "description": "Drag the subtitle clip from the Media Pool onto your timeline. DaVinci will automatically create a dedicated orange 'ST1' Subtitle Track lock-synced to your project timecode."
        },
        {
            "step": 4,
            "title": "Style in Inspector",
            "description": "Select any subtitle clip in the timeline, open the 'Inspector' tab in the top-right corner, and customize the Font, Size, Stroke, Shadow, and Background Box for all subtitles at once using 'Track Style'."
        }
    ]
}


DAVINCI_MAGIC_MASK_GUIDE = {
    "title": "Using Transparent ProRes 4444 in DaVinci Resolve Free",
    "steps": [
        {
            "step": 1,
            "title": "Drag ProRes 4444 (.mov) into Media Pool",
            "description": "Locate the exported file in your Downloads folder and drag it directly into the Media Pool in DaVinci Resolve Free."
        },
        {
            "step": 2,
            "title": "Place Background on Video Track 1 (V1)",
            "description": "Drag your background video, still image, solid color, or motion graphics onto Video Track 1 (V1)."
        },
        {
            "step": 3,
            "title": "Place ProRes 4444 on Video Track 2 (V2)",
            "description": "Drag the exported ProRes 4444 clip onto Video Track 2 (V2) directly above V1. The background is 100% transparent instantly—no green screen keying or composite mode tweaks required!"
        },
        {
            "step": 4,
            "title": "Add Effects & Text Layers Between Tracks",
            "description": "You can now place text titles, logos, or particle effects on an intermediate track (V1.5 / V2) to have them appear directly behind your person or product!"
        }
    ]
}

