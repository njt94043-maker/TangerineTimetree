"""Waveform API routes — serve waveform data and thumbnails."""

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse

from config import STORAGE_DIR
from db import database as db

router = APIRouter(prefix="/api/waveform", tags=["waveform"])


@router.get("/{track_id}")
def get_waveform(track_id: str):
    """Get waveform amplitude data as JSON array."""
    track = db.get_track(track_id)
    if not track:
        raise HTTPException(404, "Track not found")

    waveform_rel = track.get("waveform_path", "")
    if not waveform_rel:
        raise HTTPException(404, "No waveform data")

    waveform_path = STORAGE_DIR / waveform_rel
    if not waveform_path.exists():
        raise HTTPException(404, "Waveform file not found")

    data = json.loads(waveform_path.read_text())
    return JSONResponse(data)


@router.get("/{track_id}/thumbnail")
def get_thumbnail(track_id: str):
    """Serve waveform thumbnail PNG."""
    track = db.get_track(track_id)
    if not track:
        raise HTTPException(404, "Track not found")

    thumb_rel = track.get("thumbnail_path", "")
    if not thumb_rel:
        raise HTTPException(404, "No thumbnail")

    thumb_path = STORAGE_DIR / thumb_rel
    if not thumb_path.exists():
        raise HTTPException(404, "Thumbnail file not found")

    return FileResponse(thumb_path, media_type="image/png")
