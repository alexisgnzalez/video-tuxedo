"""
Paths, project directory resolution, and Remotion symlink management for Tuxedo Editor.
All project data resides outside the repository in ~/Movies/VideoTuxedo/<slug>/
(overridable with VT_PROJECTS_DIR environment variable).
"""

from __future__ import annotations

import os
import re
import time
from pathlib import Path
from typing import Optional

BASE_DIR = Path(__file__).resolve().parent.parent.parent
MOTION_PUBLIC_DIR = BASE_DIR / "motion-studio" / "public"
MOTION_PROJECTS_LINK_DIR = MOTION_PUBLIC_DIR / "projects"
EXPORTS_DIR = BASE_DIR / "exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_PROJECTS_ROOT = Path(os.environ.get("VT_PROJECTS_DIR", "~/Movies/VideoTuxedo")).expanduser()


def get_projects_root() -> Path:
    """Returns the root directory where all projects live."""
    root = Path(os.environ.get("VT_PROJECTS_DIR", "~/Movies/VideoTuxedo")).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def slugify(text: str) -> str:
    """Generates clean filesystem-safe slug from project title."""
    s = text.strip().lower()
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'[\s_-]+', '-', s)
    return s.strip('-') or "project"


def generate_slug(title: Optional[str] = None) -> str:
    """Generates unique slug with timestamp."""
    base = slugify(title or "video")[:32]
    timestamp = int(time.time())
    return f"{base}_{timestamp}"


def get_project_dir(slug: str) -> Path:
    """Returns resolved project folder path, preventing directory traversal attacks."""
    clean_slug = os.path.basename(slug.strip())
    if not clean_slug or clean_slug in (".", ".."):
        raise ValueError("Invalid project slug")
    project_dir = get_projects_root() / clean_slug
    return project_dir


def ensure_project_subdirs(project_dir: Path) -> None:
    """Creates standard project subdirectories."""
    project_dir.mkdir(parents=True, exist_ok=True)
    (project_dir / "images").mkdir(parents=True, exist_ok=True)
    (project_dir / "cache").mkdir(parents=True, exist_ok=True)
    (project_dir / "exports").mkdir(parents=True, exist_ok=True)


def resolve_safe_project_file(slug: str, relative_path: str) -> Path:
    """Resolves a file path inside a project directory with strict path-traversal protection."""
    p_dir = get_project_dir(slug).resolve()
    target = (p_dir / relative_path).resolve()
    try:
        target.relative_to(p_dir)
    except ValueError:
        raise PermissionError(f"Access denied: path traversal detected for {relative_path}")
    return target


def link_project_for_remotion(slug: str) -> Path:
    """
    Symlinks ~/Movies/VideoTuxedo/<slug> to motion-studio/public/projects/<slug>
    so Chromium sandbox in Remotion can load assets via staticFile('projects/<slug>/...').
    Removes other project symlinks so Chromium never tracks multiple project trees at once.
    """
    project_dir = get_project_dir(slug).resolve()
    if not project_dir.exists():
        raise FileNotFoundError(f"Project directory not found: {project_dir}")

    MOTION_PROJECTS_LINK_DIR.mkdir(parents=True, exist_ok=True)
    target_link = MOTION_PROJECTS_LINK_DIR / slug

    # Remove stale symlinks for other projects to keep Remotion bundle fast
    for item in MOTION_PROJECTS_LINK_DIR.iterdir():
        if item.is_symlink() and item.name != slug:
            try:
                item.unlink()
            except Exception:
                pass

    if not target_link.exists() and not target_link.is_symlink():
        try:
            os.symlink(project_dir, target_link)
        except Exception as e:
            print(f"⚠️ Could not symlink project for Remotion ({e})")
    elif target_link.is_symlink():
        try:
            if target_link.resolve() != project_dir:
                target_link.unlink()
                os.symlink(project_dir, target_link)
        except Exception as e:
            print(f"⚠️ Could not update symlink for Remotion ({e})")

    return target_link
