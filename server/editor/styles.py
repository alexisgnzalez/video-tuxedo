"""
Style Registry for Tuxedo Editor Step 5 (Graphics & Overlays).
Provides pluggable visual themes for motion graphics, b-roll layouts, and captions.
"""

from typing import Dict, Any, List, Optional


STYLES: Dict[str, Dict[str, Any]] = {
    "story_tuxedo": {
        "id": "story_tuxedo",
        "name": "Comedic Storytelling",
        "badge": "Retro Punch",
        "description": "Bold playful typography, energetic punchline stickers, pop sound effects, and behind-subject 3-layer sandwich graphics.",
        "fontFamily": "Impact, system-ui, sans-serif",
        "palette": {
            "primary": "#FFE600",
            "secondary": "#FFFFFF",
            "accent": "#FF3366",
            "dark": "#111111",
        },
        "components": [
            {
                "id": "sandwich_text",
                "name": "Behind-Subject Headline",
                "layer": "behind",
                "defaultPlacement": {"position": "top", "offsetY": 280},
                "defaultProps": {
                    "headlineText": "NARRATIVE HOOK",
                    "subText": "",
                    "color": "#FFE600",
                    "fontSize": 96,
                },
                "allowedSfx": ["whoosh.mp3", "pop.mp3", "vine_boom.mp3", "none"],
                "defaultSfx": "whoosh.mp3",
            },
            {
                "id": "punchline_card",
                "name": "Punchline Card",
                "layer": "front",
                "defaultPlacement": {"position": "bottom-right", "offsetX": 60, "offsetY": 400},
                "defaultProps": {
                    "headlineText": "TRÁGAME TIERRA 💀",
                    "subText": "momento humilde",
                    "color": "#FF3366",
                    "fontSize": 64,
                },
                "allowedSfx": ["pop.mp3", "ding.mp3", "vine_boom.mp3", "none"],
                "defaultSfx": "pop.mp3",
            },
            {
                "id": "status_badge",
                "name": "Status Badge",
                "layer": "front",
                "defaultPlacement": {"position": "top-left", "offsetX": 60, "offsetY": 200},
                "defaultProps": {
                    "headlineText": "MODO POETA",
                    "subText": "100% real",
                    "color": "#FFFFFF",
                    "fontSize": 48,
                },
                "allowedSfx": ["pop.mp3", "none"],
                "defaultSfx": "pop.mp3",
            },
        ],
        "defaultSettings": {
            "uppercase": True,
            "strokeWidth": 6,
            "strokeColor": "#000000",
            "shadowBlur": 16,
        },
    },
    "caracas": {
        "id": "caracas",
        "name": "Caracas Mid-Century Kinetic",
        "badge": "1957 Modernist",
        "description": "Inspired by Carlos Raúl Villanueva, Carlos Cruz-Diez cinetismo, and Swiss typography with earth-and-terracotta tones.",
        "fontFamily": "Federo, Josefin Sans, sans-serif",
        "palette": {
            "primary": "#E2725B",      # Terracotta
            "secondary": "#FAF9F5",    # Warm ivory
            "accent": "#2B4C7E",       # Avila Navy
            "dark": "#141413",         # Charcoal
        },
        "components": [
            {
                "id": "kinetic_header",
                "name": "Kinetic Kinetic Bar",
                "layer": "behind",
                "defaultPlacement": {"position": "top", "offsetY": 240},
                "defaultProps": {
                    "headlineText": "EL ÁVILA",
                    "subText": "CINETISMO MODERNO",
                    "color": "#FAF9F5",
                    "fontSize": 88,
                },
                "allowedSfx": ["whoosh.mp3", "none"],
                "defaultSfx": "whoosh.mp3",
            },
            {
                "id": "modernist_plate",
                "name": "Modernist Plate",
                "layer": "front",
                "defaultPlacement": {"position": "bottom-left", "offsetX": 60, "offsetY": 360},
                "defaultProps": {
                    "headlineText": "AURA Y RITMO",
                    "subText": "CARACAS 1957",
                    "color": "#E2725B",
                    "fontSize": 56,
                },
                "allowedSfx": ["pop.mp3", "none"],
                "defaultSfx": "none",
            },
        ],
        "defaultSettings": {
            "uppercase": True,
            "strokeWidth": 0,
            "strokeColor": "transparent",
            "letterSpacing": "0.15em",
        },
    },
    "clean_minimal": {
        "id": "clean_minimal",
        "name": "Clean Editorial Minimal",
        "badge": "Sleek",
        "description": "Minimalist lower-thirds, elegant typography, sans-serif clarity, and clean monochrome accents for professional speaking videos.",
        "fontFamily": "Inter, -apple-system, sans-serif",
        "palette": {
            "primary": "#FFFFFF",
            "secondary": "#999999",
            "accent": "#D97757",
            "dark": "#0A0A0A",
        },
        "components": [
            {
                "id": "lower_third",
                "name": "Editorial Lower Third",
                "layer": "front",
                "defaultPlacement": {"position": "bottom", "offsetY": 320},
                "defaultProps": {
                    "headlineText": "Alexis González",
                    "subText": "Software Architect",
                    "color": "#FFFFFF",
                    "fontSize": 52,
                },
                "allowedSfx": ["none"],
                "defaultSfx": "none",
            },
            {
                "id": "subtle_pill",
                "name": "Subtle Pill",
                "layer": "front",
                "defaultPlacement": {"position": "top-right", "offsetX": 60, "offsetY": 220},
                "defaultProps": {
                    "headlineText": "CHAPTER 01",
                    "subText": "",
                    "color": "#D97757",
                    "fontSize": 40,
                },
                "allowedSfx": ["none"],
                "defaultSfx": "none",
            },
        ],
        "defaultSettings": {
            "uppercase": False,
            "strokeWidth": 0,
            "strokeColor": "transparent",
            "borderRadius": 8,
        },
    },
}


def list_styles() -> List[Dict[str, Any]]:
    """Returns list of registered style metadata."""
    return list(STYLES.values())


def get_style(style_id: str) -> Dict[str, Any]:
    """Returns style details or fallback to story_tuxedo."""
    return STYLES.get(style_id, STYLES["story_tuxedo"])


def auto_draft_graphics_with_ai(
    project: Any,
    style_id: str = "story_tuxedo",
    api_key: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Analyzes subtitle cues, transcript, and Gemini emphasis markers to automatically draft
    visual titles, narrative hooks, and punchline reaction cards matching the chosen visual theme.
    """
    import os
    import re
    import time
    import json
    import logging
    from server.editor.captions_ai import _load_gemini_key

    logger = logging.getLogger("video_tuxedo.editor.styles")
    style_cfg = get_style(style_id)
    cues = project.captions.cues if hasattr(project, "captions") and project.captions else []

    # 1. Check if Gemini Flash is available
    gemini_key = _load_gemini_key(api_key)
    if gemini_key and cues:
        try:
            from google import genai
            client = genai.Client(api_key=gemini_key)

            transcript_text = "\n".join(
                f"[{c.start:.1f}s - {c.end:.1f}s]: {c.text}" +
                (f" (emphasis: {', '.join(w.text for w in c.words if getattr(w, 'emphasis', False))})" if getattr(c, "words", None) else "")
                for c in cues[:75]
            )

            components_info = json.dumps([
                {"id": c["id"], "name": c["name"], "layer": c["layer"], "allowedSfx": c.get("allowedSfx", [])}
                for c in style_cfg.get("components", [])
            ], indent=2)

            prompt = f"""You are an elite short-form video art director and editor.
Analyze the following speech transcript with timestamps for a vertical video (9:16).
Design 3 to 6 high-impact motion graphic cues that hook the viewer, highlight comedic moments or key points, and emphasize punchlines.

Visual Theme: {style_cfg.get('name')} ({style_cfg.get('badge')})
Available Components:
{components_info}

Rules:
1. Always add 1 Opening Narrative Hook placed BEHIND the subject (e.g. sandwich_text or kinetic_header) at the start (from 0.0s to ~3.2s). The headline must be 2-4 punchy words in UPPERCASE summarizing the story.
2. Place 2 to 4 Punchline Cards or Badges placed in FRONT of the subject at exact humorous, dramatic, or emphatic speech timestamps. Keep text short (2-5 words).
3. Set appropriate sound effects: "whoosh.mp3" for opening titles, "pop.mp3" or "ding.mp3" for punchlines.
4. Output strictly valid JSON as an array of objects matching this exact schema:
[
  {{
    "id": "cue_ai_1",
    "component": "<component_id>",
    "name": "<display name>",
    "layer": "behind" or "front",
    "start": <float seconds>,
    "end": <float seconds>,
    "props": {{
      "headlineText": "<short punchy headline>",
      "subText": "<optional subtext>",
      "color": "{style_cfg.get('palette', {}).get('primary', '#FFE600')}"
    }},
    "sfxFile": "whoosh.mp3"
  }}
]"""
            response = None
            for m_name in ["gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-2.0-flash"]:
                try:
                    response = client.models.generate_content(
                        model=m_name,
                        contents=[{"role": "user", "parts": [{"text": prompt}, {"text": transcript_text}]}],
                    )
                    if response and response.text:
                        break
                except Exception:
                    continue

            if response and response.text:
                raw_text = response.text.strip()
                match = re.search(r"\[.*\]", raw_text, re.DOTALL)
                if match:
                    parsed = json.loads(match.group(0))
                    if isinstance(parsed, list) and len(parsed) > 0:
                        valid_items = []
                        for i, item in enumerate(parsed):
                            item_id = item.get("id") or f"cue_ai_{int(time.time())}_{i}"
                            valid_items.append({
                                "id": str(item_id),
                                "component": item.get("component") or style_cfg["components"][0]["id"],
                                "name": item.get("name") or "AI Graphic",
                                "layer": item.get("layer", "front"),
                                "start": float(item.get("start", 0.0)),
                                "end": float(item.get("end", item.get("start", 0.0) + 2.5)),
                                "props": item.get("props", {}),
                                "sfxFile": item.get("sfxFile", "pop.mp3"),
                            })
                        if valid_items:
                            return valid_items
        except Exception as e:
            logger.warning(f"Gemini auto-graphics generation failed, falling back to local extractor: {e}")

    # 2. Intelligent local extraction based on cues & emphasis
    return _extract_local_graphics(cues, style_cfg)


def _extract_local_graphics(cues: List[Any], style_cfg: Dict[str, Any]) -> List[Dict[str, Any]]:
    import time
    items = []
    comps = style_cfg.get("components", [])
    if not comps:
        return []

    behind_comp = next((c for c in comps if c.get("layer") == "behind"), comps[0])
    front_comp = next((c for c in comps if c.get("layer") == "front"), comps[-1])
    palette = style_cfg.get("palette", {})
    primary_color = palette.get("primary", "#FFE600")
    accent_color = palette.get("accent", "#FF3366")

    # 1. Opening Narrative Hook (0.0s - 3.2s)
    hook_text = "NARRATIVE HOOK"
    if cues:
        # Check first 3 cues for emphasis words or punchy words
        opening_words = []
        for c in cues[:3]:
            for w in getattr(c, "words", []):
                clean_w = w.text.strip(".,!?:;¿¡")
                if len(clean_w) >= 4 and clean_w.lower() not in {"esta", "vaina", "pero", "como", "para"}:
                    opening_words.append(clean_w.upper())
        if opening_words:
            hook_text = " ".join(opening_words[:3])
        elif cues[0].text:
            hook_text = cues[0].text.strip(".,!?:;¿¡").upper()[:24]

    items.append({
        "id": f"cue_ai_hook_{int(time.time())}",
        "component": behind_comp["id"],
        "name": behind_comp["name"],
        "layer": "behind",
        "start": 0.0,
        "end": 3.2,
        "props": {
            "headlineText": hook_text,
            "subText": "",
            "color": primary_color,
            "fontSize": 96,
        },
        "sfxFile": "whoosh.mp3",
    })

    # 2. Extract punchline cues where Gemini emphasis words or key phrases occur
    last_placed_time = 3.5
    count = 0
    for cue in cues:
        if count >= 4:
            break
        emp_words = [w.text.strip(".,!?:;¿¡").upper() for w in getattr(cue, "words", []) if getattr(w, "emphasis", False)]
        start_t = float(cue.start)
        if emp_words and (start_t - last_placed_time) >= 10.0:
            headline = " ".join(emp_words[:3])
            end_t = min(float(cue.end) + 0.8, start_t + 2.8)
            comp_to_use = front_comp or comps[0]
            items.append({
                "id": f"cue_ai_emp_{int(time.time())}_{count}",
                "component": comp_to_use["id"],
                "name": comp_to_use["name"],
                "layer": comp_to_use.get("layer", "front"),
                "start": round(start_t, 2),
                "end": round(end_t, 2),
                "props": {
                    "headlineText": f"{headline} 🔥",
                    "subText": cue.text[:30] if len(cue.text) > len(headline) else "",
                    "color": accent_color if count % 2 == 1 else primary_color,
                    "fontSize": 64,
                },
                "sfxFile": "pop.mp3",
            })
            last_placed_time = end_t
            count += 1

    return items
