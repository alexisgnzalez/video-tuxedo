"""
Style Registry for Tuxedo Editor Step 5 (Graphics & Overlays).
Provides pluggable visual themes for motion graphics, b-roll layouts, and captions.
"""

from typing import Dict, Any, List


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
