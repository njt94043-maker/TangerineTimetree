"""File naming, organization, and cleanup."""

import re
from datetime import datetime, timezone
from pathlib import Path

from config import LIBRARY_DIR, RECORDINGS_DIR


def get_library_path(title: str, timestamp: datetime | None = None) -> Path:
    """Generate a library file path: library/YYYY/MM/{sanitized-title}-{timestamp}.mp3"""
    ts = timestamp or datetime.now(timezone.utc)
    year = ts.strftime("%Y")
    month = ts.strftime("%m")
    date_str = ts.strftime("%Y%m%d-%H%M%S")
    safe_title = sanitize_filename(title)
    filename = f"{safe_title}-{date_str}.mp3"
    return LIBRARY_DIR / year / month / filename


def sanitize_filename(name: str) -> str:
    """Convert a string to a safe filename slug."""
    name = name.lower().strip()
    name = re.sub(r'[^\w\s-]', '', name)
    name = re.sub(r'[\s_]+', '-', name)
    name = re.sub(r'-+', '-', name)
    name = name.strip('-')
    return name[:80] or "untitled"


def relative_path(absolute_path: Path, base: Path | None = None) -> str:
    """Convert an absolute path to relative (for DB storage)."""
    base = base or LIBRARY_DIR.parent  # storage/
    try:
        return str(absolute_path.relative_to(base))
    except ValueError:
        return str(absolute_path)


def cleanup_recording(session_id: str):
    """Delete temporary recording files for a session."""
    for ext in (".wav", ".webm"):
        path = RECORDINGS_DIR / f"{session_id}{ext}"
        if path.exists():
            path.unlink()


def get_file_size(path: Path) -> int:
    """Get file size in bytes."""
    return path.stat().st_size if path.exists() else 0


def parse_youtube_title(tab_title: str) -> tuple[str, str]:
    """Try to extract artist and title from a YouTube tab title.

    Common format: "Artist - Song Title - YouTube"

    Returns:
        (title, artist) tuple
    """
    # Strip common suffixes
    for suffix in [" - YouTube", " - YouTube Music", " | YouTube", " - Spotify"]:
        if tab_title.endswith(suffix):
            tab_title = tab_title[: -len(suffix)]
            break

    # Try "Artist - Title" pattern
    if " - " in tab_title:
        parts = tab_title.split(" - ", 1)
        return parts[1].strip(), parts[0].strip()

    return tab_title.strip(), ""
