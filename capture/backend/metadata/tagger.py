"""ID3v2 metadata tagging using mutagen."""

from pathlib import Path

from mutagen.id3 import ID3, TALB, TBPM, TCON, TDRC, TIT2, TKEY, TPE1, TXXX
from mutagen.mp3 import MP3


def write_tags(
    file_path: Path,
    title: str = "",
    artist: str = "",
    album: str = "",
    genre: str = "",
    bpm: float | None = None,
    key: str = "",
    capture_date: str = "",
    source_url: str = "",
    category: str = "",
    instrument_focus: str = "",
    practice_category: str = "",
    difficulty: str = "",
    personal_notes: str = "",
):
    """Write ID3v2 tags to an MP3 file."""
    audio = MP3(str(file_path))
    if audio.tags is None:
        audio.add_tags()
    tags = audio.tags

    if title:
        tags.add(TIT2(encoding=3, text=title))
    if artist:
        tags.add(TPE1(encoding=3, text=artist))
    if album:
        tags.add(TALB(encoding=3, text=album))
    if genre:
        tags.add(TCON(encoding=3, text=genre))
    if bpm is not None:
        tags.add(TBPM(encoding=3, text=str(int(round(bpm)))))
    if key:
        tags.add(TKEY(encoding=3, text=key))
    if capture_date:
        tags.add(TDRC(encoding=3, text=capture_date[:10]))

    # Custom frames for metadata
    custom_fields = {
        "SOURCE_URL": source_url,
        "CATEGORY": category,
        "INSTRUMENT_FOCUS": instrument_focus,
        "PRACTICE_CATEGORY": practice_category,
        "DIFFICULTY": difficulty,
        "PERSONAL_NOTES": personal_notes,
    }
    for desc, value in custom_fields.items():
        if value:
            tags.add(TXXX(encoding=3, desc=desc, text=value))

    audio.save()


def read_tags(file_path: Path) -> dict:
    """Read ID3v2 tags from an MP3 file."""
    audio = MP3(str(file_path))
    tags = audio.tags or {}

    def get_text(frame_id: str) -> str:
        frame = tags.get(frame_id)
        if frame and frame.text:
            return str(frame.text[0])
        return ""

    def get_txxx(desc: str) -> str:
        key = f"TXXX:{desc}"
        frame = tags.get(key)
        if frame and frame.text:
            return str(frame.text[0])
        return ""

    bpm_str = get_text("TBPM")
    bpm = float(bpm_str) if bpm_str else None

    return {
        "title": get_text("TIT2"),
        "artist": get_text("TPE1"),
        "album": get_text("TALB"),
        "genre": get_text("TCON"),
        "bpm": bpm,
        "key": get_text("TKEY"),
        "source_url": get_txxx("SOURCE_URL"),
        "category": get_txxx("CATEGORY"),
        "instrument_focus": get_txxx("INSTRUMENT_FOCUS"),
        "practice_category": get_txxx("PRACTICE_CATEGORY"),
        "difficulty": get_txxx("DIFFICULTY"),
        "personal_notes": get_txxx("PERSONAL_NOTES"),
        "duration_seconds": audio.info.length,
        "bitrate": audio.info.bitrate // 1000,
        "sample_rate": audio.info.sample_rate,
    }
