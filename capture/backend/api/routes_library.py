"""Library API routes — browse, search, edit, delete tracks."""

from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel

from config import STORAGE_DIR
from db import database as db
from metadata.tagger import write_tags, read_tags
from metadata.analyzer import analyze_audio
from metadata.waveform import generate_waveform
from storage.file_manager import get_library_path, relative_path, get_file_size, sanitize_filename

router = APIRouter(prefix="/api/library", tags=["library"])


class TrackUpdate(BaseModel):
    title: str | None = None
    artist: str | None = None
    album: str | None = None
    genre: str | None = None
    bpm: float | None = None
    key: str | None = None
    instrument_focus: str | None = None
    difficulty: str | None = None
    practice_category: str | None = None
    personal_notes: str | None = None
    setlist_id: str | None = None
    song_id: str | None = None
    favorite: int | None = None


class TagCreate(BaseModel):
    name: str
    color: str = "#f39c12"


class TagAssign(BaseModel):
    tag_id: str


# ---------- Tracks ----------

@router.get("/tracks")
def list_tracks(
    search: str = "",
    artist: str = "",
    genre: str = "",
    practice_category: str = "",
    instrument_focus: str = "",
    tag: str = "",
    favorite: bool | None = None,
    sort_by: str = "capture_date",
    sort_dir: str = "desc",
    limit: int = 50,
    offset: int = 0,
):
    return db.list_tracks(
        search=search, artist=artist, genre=genre,
        practice_category=practice_category,
        instrument_focus=instrument_focus,
        tag=tag, favorite=favorite,
        sort_by=sort_by, sort_dir=sort_dir,
        limit=limit, offset=offset,
    )


@router.get("/tracks/{track_id}")
def get_track(track_id: str):
    track = db.get_track(track_id)
    if not track:
        raise HTTPException(404, "Track not found")
    return track


@router.patch("/tracks/{track_id}")
def update_track(track_id: str, body: TrackUpdate):
    track = db.get_track(track_id)
    if not track:
        raise HTTPException(404, "Track not found")

    fields = body.model_dump(exclude_none=True)
    if not fields:
        return {"ok": True}

    db.update_track(track_id, **fields)

    # Also update ID3 tags in the MP3 file
    file_path = STORAGE_DIR / track["file_path"]
    if file_path.exists() and file_path.suffix == ".mp3":
        merged = {**track, **fields}
        write_tags(
            file_path,
            title=merged.get("title", ""),
            artist=merged.get("artist", ""),
            album=merged.get("album", ""),
            genre=merged.get("genre", ""),
            bpm=merged.get("bpm"),
            key=merged.get("key", ""),
            instrument_focus=merged.get("instrument_focus", ""),
            practice_category=merged.get("practice_category", ""),
            difficulty=merged.get("difficulty", ""),
            personal_notes=merged.get("personal_notes", ""),
        )

    return {"ok": True}


@router.delete("/tracks/{track_id}")
def delete_track(track_id: str):
    track = db.get_track(track_id)
    if not track:
        raise HTTPException(404, "Track not found")

    # Delete files
    for key in ("file_path", "waveform_path", "thumbnail_path"):
        rel = track.get(key, "")
        if rel:
            path = STORAGE_DIR / rel
            if path.exists():
                path.unlink()

    db.delete_track(track_id)
    return {"ok": True}


@router.post("/tracks/{track_id}/play")
def play_track(track_id: str):
    track = db.get_track(track_id)
    if not track:
        raise HTTPException(404, "Track not found")
    db.increment_play_count(track_id)
    return {"ok": True}


@router.post("/tracks/{track_id}/analyze")
def analyze_track(track_id: str):
    """Re-run BPM/key analysis on a track."""
    track = db.get_track(track_id)
    if not track:
        raise HTTPException(404, "Track not found")

    file_path = STORAGE_DIR / track["file_path"]
    if not file_path.exists():
        raise HTTPException(404, "Audio file not found")

    analysis = analyze_audio(file_path)
    waveform_path, thumbnail_path = generate_waveform(track_id, file_path)

    db.update_track(
        track_id,
        bpm=analysis["bpm"],
        key=analysis["key"],
        duration_seconds=analysis["duration_seconds"],
        waveform_path=relative_path(waveform_path),
        thumbnail_path=relative_path(thumbnail_path),
    )

    return analysis


@router.get("/tracks/{track_id}/file")
def serve_track_file(track_id: str):
    """Serve the MP3 file for playback."""
    track = db.get_track(track_id)
    if not track:
        raise HTTPException(404, "Track not found")

    file_path = STORAGE_DIR / track["file_path"]
    if not file_path.exists():
        raise HTTPException(404, "Audio file not found")

    return FileResponse(
        file_path,
        media_type="audio/mpeg",
        headers={"Accept-Ranges": "bytes"},
    )


@router.post("/import")
async def import_file(file: UploadFile = File(...), title: str = Form("")):
    """Import an existing audio file into the library."""
    if not file.filename:
        raise HTTPException(400, "No filename")

    # Save uploaded file to temp location
    from config import RECORDINGS_DIR
    temp_path = RECORDINGS_DIR / f"import-{file.filename}"
    content = await file.read()
    temp_path.write_bytes(content)

    try:
        # If not MP3, encode it
        if not file.filename.lower().endswith(".mp3"):
            from capture.encoder import encode_to_mp3
            mp3_temp = temp_path.with_suffix(".mp3")
            encode_to_mp3(temp_path, mp3_temp)
            temp_path.unlink()
            temp_path = mp3_temp

        # Analyze
        analysis = analyze_audio(temp_path)

        # Determine title
        final_title = title or Path(file.filename).stem
        lib_path = get_library_path(final_title)
        lib_path.parent.mkdir(parents=True, exist_ok=True)

        # Move to library
        temp_path.rename(lib_path)

        # Generate waveform
        track_id = db.new_id()
        waveform_path, thumbnail_path = generate_waveform(track_id, lib_path)

        # Write ID3 tags
        write_tags(lib_path, title=final_title, bpm=analysis.get("bpm"), key=analysis.get("key", ""))

        # Insert into DB
        db.insert_track({
            "id": track_id,
            "title": final_title,
            "source_type": "file_import",
            "file_path": relative_path(lib_path),
            "file_size_bytes": get_file_size(lib_path),
            "duration_seconds": analysis.get("duration_seconds"),
            "bpm": analysis.get("bpm"),
            "key": analysis.get("key", ""),
            "waveform_path": relative_path(waveform_path),
            "thumbnail_path": relative_path(thumbnail_path),
        })

        return {"id": track_id, "title": final_title, **analysis}

    except Exception as e:
        if temp_path.exists():
            temp_path.unlink()
        raise HTTPException(500, str(e))


# ---------- Tags ----------

@router.get("/tags")
def list_tags():
    return db.list_tags()


@router.post("/tags")
def create_tag(body: TagCreate):
    return db.create_tag(body.name, body.color)


@router.delete("/tags/{tag_id}")
def delete_tag(tag_id: str):
    db.delete_tag(tag_id)
    return {"ok": True}


@router.post("/tracks/{track_id}/tags")
def add_tag(track_id: str, body: TagAssign):
    db.add_tag_to_track(track_id, body.tag_id)
    return {"ok": True}


@router.delete("/tracks/{track_id}/tags/{tag_id}")
def remove_tag(track_id: str, tag_id: str):
    db.remove_tag_from_track(track_id, tag_id)
    return {"ok": True}
