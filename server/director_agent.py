from __future__ import annotations

import os
import json
import logging
from typing import List, Literal, Optional, Dict, Any
from pydantic import BaseModel, Field

logger = logging.getLogger("video_tuxedo.director_agent")


class VisualCue(BaseModel):
    id: str = Field(description="Unique ID like 'cue_1'")
    startTime: float = Field(description="Start timestamp in seconds matching the exact word trigger")
    endTime: float = Field(description="End timestamp in seconds (keep snappy: 1.5s to 3.0s duration)")
    layer: Literal["behind_subject", "in_front_of_subject"] = Field(
        description="Use 'behind_subject' for massive 1-2 word impact titles behind the speaker; use 'in_front_of_subject' for comedic popups"
    )
    component: Literal[
        "KineticTitleBehind",
        "PunchlinePopup",
        "FloatingEmojiCluster",
        "ComicAlertBanner"
    ] = Field(description="Remotion visual component name")
    headlineText: str = Field(description="1 to 3 words MAX. Capture the irony, exaggeration, or subtext—do NOT just repeat the subtitles!")
    subText: Optional[str] = Field(default="", description="Optional small secondary label")
    emojiOrIcon: str = Field(description="Single expressive emoji matching the comedic beat")
    accentColor: Literal["#FACC15", "#38BDF8", "#F43F5E", "#4ADE80", "#A855F7"] = Field(
        default="#FACC15", description="Vibrant punchy brand accent color"
    )
    position: Literal["top", "center", "bottom-left", "bottom-right"] = Field(
        default="bottom-right", description="Screen anchor position"
    )
    sfxFile: Literal["whoosh.mp3", "pop.mp3", "vine_boom.mp3", "ding.mp3", "none"] = Field(
        default="pop.mp3", description="Accompanying sound effect"
    )


class DirectorPlanOutput(BaseModel):
    story_hook: str = Field(description="1-sentence description of the story hook or narrative angle")
    cues: List[VisualCue] = Field(description="Curated list of visual cues spaced every 3.5 to 6 seconds")


def generate_local_fallback_director_plan(
    words_list: List[Dict[str, Any]],
    video_file_name: str = "chopped_video.mp4",
    mask_video_file_name: Optional[str] = "subject_cutout.webm",
    render_mode: str = "full_composite",
) -> Dict[str, Any]:
    """
    Offline local heuristic director that selects comedic storytelling beats
    every 3.5 to 6.0 seconds when Gemini API is unavailable or unconfigured.
    """
    if not words_list:
        return {
            "videoFileName": video_file_name,
            "maskVideoFileName": mask_video_file_name,
            "renderMode": render_mode,
            "cues": [],
            "words": [],
        }

    total_duration = words_list[-1].get("end", 10.0) if words_list else 10.0
    cues: List[Dict[str, Any]] = []

    # Preset comedic palettes and archetypes
    accents = ["#FACC15", "#38BDF8", "#F43F5E", "#4ADE80", "#A855F7"]
    sfx_choices = ["pop.mp3", "whoosh.mp3", "ding.mp3", "vine_boom.mp3"]

    # 1. Opening Behind-Subject Kinetic Hook
    cues.append({
        "id": "cue_hook",
        "startTime": round(max(0.2, words_list[0].get("start", 0.2)), 2),
        "endTime": round(min(total_duration, words_list[0].get("start", 0.2) + 2.4), 2),
        "layer": "behind_subject",
        "component": "KineticTitleBehind",
        "headlineText": "WAIT FOR IT",
        "subText": "",
        "emojiOrIcon": "👀",
        "accentColor": "#FACC15",
        "position": "top",
        "sfxFile": "whoosh.mp3",
    })

    # 2. Iterate through words and trigger comedic beats every ~4.0 seconds
    last_cue_time = 2.4
    cue_idx = 1

    for i, w in enumerate(words_list):
        w_start = float(w.get("start", 0.0))
        w_end = float(w.get("end", w_start + 0.3))
        w_text = w.get("word", "").strip()

        if w_start - last_cue_time >= 4.0 and (w_start + 2.0) <= total_duration:
            cue_idx += 1
            is_behind = (cue_idx % 3 == 0)
            accent = accents[cue_idx % len(accents)]
            sfx = sfx_choices[cue_idx % len(sfx_choices)]

            if is_behind:
                comp = "KineticTitleBehind"
                layer = "behind_subject"
                pos = "top"
                headline = w_text.upper() if len(w_text) <= 10 else "BIG MOOD"
                emoji = "🔥"
            else:
                comp = "PunchlinePopup" if cue_idx % 2 == 0 else "ComicAlertBanner"
                layer = "in_front_of_subject"
                pos = "bottom-right" if cue_idx % 2 == 0 else "bottom-left"
                headline = f"NO WAY 💀" if cue_idx % 2 == 0 else f"{w_text.upper()}!"
                emoji = "💀" if cue_idx % 2 == 0 else "🚨"

            cues.append({
                "id": f"cue_{cue_idx}",
                "startTime": round(w_start, 2),
                "endTime": round(min(total_duration, w_start + 2.2), 2),
                "layer": layer,
                "component": comp,
                "headlineText": headline,
                "subText": "",
                "emojiOrIcon": emoji,
                "accentColor": accent,
                "position": pos,
                "sfxFile": sfx,
            })
            last_cue_time = w_start + 2.2

    return {
        "videoFileName": video_file_name,
        "maskVideoFileName": mask_video_file_name,
        "renderMode": render_mode,
        "cues": cues,
        "words": [
            {
                "word": w.get("word", ""),
                "start": float(w.get("start", 0.0)),
                "end": float(w.get("end", 0.0)),
            }
            for w in words_list
        ],
    }


def generate_director_plan(
    words_list: List[Dict[str, Any]],
    style_guide_md: Optional[str] = None,
    video_file_name: str = "chopped_video.mp4",
    mask_video_file_name: Optional[str] = "subject_cutout.webm",
    render_mode: str = "full_composite",
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Calls Gemini 2.5 Flash Free Tier using Structured Outputs (JSON Schema)
    to draft a comedic story plan matching MainVideoSchema.
    Falls back gracefully to the offline heuristic director if API key is not set or call fails.
    """
    gemini_key = api_key or os.environ.get("GEMINI_API_KEY")

    if not gemini_key:
        logger.info("ℹ️ No GEMINI_API_KEY detected in environment; using offline local heuristic director.")
        return generate_local_fallback_director_plan(
            words_list=words_list,
            video_file_name=video_file_name,
            mask_video_file_name=mask_video_file_name,
            render_mode=render_mode,
        )

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=gemini_key)

        guide_context = style_guide_md or (
            "Viral short-form vertical 9:16 talking-head video. "
            "Pacing: 1 cue every 3.5 to 6 seconds max. "
            "Never repeat subtitles verbatim; capture comedic subtext, ironic contrast, or metaphors."
        )

        prompt = f"""
You are the Lead Editor and Comedic Art Director for Alexis's storytelling TikTok (@alexisgnzlz).
Read his personal style guide and word-level timestamps below.

EDITORIAL RULES:
1. DO NOT spam graphics. Place a cue every 3.5 to 6 seconds ONLY on comedic beats, plot twists, self-deprecating jokes, or key metaphors.
2. NEVER repeat the spoken words verbatim if a funnier visual label exists (e.g., if Alexis says "I walked in confident and immediately tripped", the popup should say "AURA: -9999" with 💀).
3. Alternate between 'behind_subject' (huge bold text behind his shoulders) and 'in_front_of_subject' (snappy lower-left/right Neo-Brutalist cards).
4. Align 'startTime' to the exact timestamp of the trigger word. Snappy duration: 1.5s to 2.8s.
5. Choose appropriate sound effects from ['whoosh.mp3', 'pop.mp3', 'vine_boom.mp3', 'ding.mp3', 'none'].

STYLE GUIDE:
{guide_context}

WORD-LEVEL TIMESTAMPS:
{json.dumps(words_list, ensure_ascii=False)}
"""

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=DirectorPlanOutput,
                temperature=0.45,
            ),
        )

        plan = json.loads(response.text)
        return {
            "videoFileName": video_file_name,
            "maskVideoFileName": mask_video_file_name,
            "renderMode": render_mode,
            "cues": plan.get("cues", []),
            "words": [
                {
                    "word": w.get("word", ""),
                    "start": float(w.get("start", 0.0)),
                    "end": float(w.get("end", 0.0)),
                }
                for w in words_list
            ],
            "story_hook": plan.get("story_hook", ""),
        }

    except Exception as e:
        logger.warning(f"⚠️ Gemini director call failed ({e}); falling back to local heuristic director.")
        return generate_local_fallback_director_plan(
            words_list=words_list,
            video_file_name=video_file_name,
            mask_video_file_name=mask_video_file_name,
            render_mode=render_mode,
        )
