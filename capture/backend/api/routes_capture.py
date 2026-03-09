"""Capture API routes — start/stop/status for WASAPI and tab capture sessions."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from capture.wasapi_capture import WasapiCapture
from db import database as db

router = APIRouter(prefix="/api", tags=["capture"])

# Active capture sessions (in-memory)
_active_captures: dict[str, WasapiCapture] = {}


class CaptureStartRequest(BaseModel):
    source_type: str = "tab"
    source_url: str = ""
    tab_title: str = ""


class WasapiStartRequest(BaseModel):
    device_index: int | None = None
    tab_title: str = ""
    source_url: str = ""
    armed: bool = True  # Default: wait for audio before recording
    threshold: float = 0.005  # Peak level (0-1) to trigger recording


# ---------- Generic capture session (used by Chrome extension) ----------

@router.post("/capture/start")
def start_capture(body: CaptureStartRequest):
    """Create a new capture session (for Chrome extension tab capture)."""
    session = db.create_session(
        source_type=body.source_type,
        source_url=body.source_url,
        tab_title=body.tab_title,
    )
    return session


@router.post("/capture/stop/{session_id}")
def stop_capture(session_id: str):
    """Signal that capture has stopped. Triggers encoding pipeline."""
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    db.update_session(session_id, status="encoding")
    return {"status": "encoding", "session_id": session_id}


@router.post("/capture/cancel/{session_id}")
def cancel_capture(session_id: str):
    """Cancel an active capture session."""
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    # Clean up WASAPI capture if active
    capture = _active_captures.pop(session_id, None)
    if capture:
        capture.cleanup()

    from storage.file_manager import cleanup_recording
    cleanup_recording(session_id)
    db.update_session(session_id, status="cancelled")
    return {"status": "cancelled"}


@router.get("/capture/status/{session_id}")
def capture_status(session_id: str):
    """Get the current status of a capture session."""
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    result = {
        "session_id": session_id,
        "status": session["status"],
        "source_type": session["source_type"],
        "tab_title": session["tab_title"],
        "error_message": session["error_message"],
        "paused": bool(session.get("paused", 0)),
    }

    # Add live data if WASAPI capture is active (armed or recording)
    capture = _active_captures.get(session_id)
    if capture and capture.is_listening:
        result["level"] = round(capture.peak_level, 3)
        if capture.is_armed:
            result["status"] = "armed"
            result["duration_seconds"] = 0.0
        elif capture.is_recording:
            result["status"] = "recording"
            result["duration_seconds"] = round(capture.duration, 1)
            result["paused"] = capture.is_paused

    return result


@router.post("/capture/pause/{session_id}")
def pause_capture(session_id: str):
    """Pause an active capture (ad skip)."""
    capture = _active_captures.get(session_id)
    if capture and capture.is_recording:
        capture.pause()
        db.update_session(session_id, paused=1)
        return {"status": "paused"}
    raise HTTPException(400, "No active capture to pause")


@router.post("/capture/resume/{session_id}")
def resume_capture(session_id: str):
    """Resume a paused capture."""
    capture = _active_captures.get(session_id)
    if capture and capture.is_recording:
        capture.resume()
        db.update_session(session_id, paused=0)
        return {"status": "recording"}
    raise HTTPException(400, "No active capture to resume")


# ---------- Chrome tab info relay ----------
# Extension POSTs current tab, UI GETs it for auto-fill

_current_tab: dict[str, str] = {"title": "", "url": ""}


class TabInfoRequest(BaseModel):
    title: str = ""
    url: str = ""


@router.post("/capture/tab-info")
def set_tab_info(body: TabInfoRequest):
    """Called by Chrome extension to report current tab."""
    _current_tab["title"] = body.title
    _current_tab["url"] = body.url
    return {"status": "ok"}


@router.get("/capture/tab-info")
def get_tab_info():
    """Get the last reported Chrome tab info."""
    return _current_tab


# ---------- WASAPI ----------

@router.get("/wasapi/devices")
def list_wasapi_devices():
    """List available WASAPI loopback devices."""
    return WasapiCapture.list_devices()


@router.post("/wasapi/start")
def start_wasapi(body: WasapiStartRequest):
    """Start WASAPI loopback capture."""
    session = db.create_session(
        source_type="wasapi",
        source_url=body.source_url,
        tab_title=body.tab_title,
    )
    session_id = session["id"]

    try:
        capture = WasapiCapture(session_id, device_index=body.device_index)
        capture.start(armed=body.armed, threshold=body.threshold)
        _active_captures[session_id] = capture
        db.update_session(session_id, raw_file_path=str(capture.output_path))
        status = "armed" if body.armed else "recording"
        return {"session_id": session_id, "status": status}
    except Exception as e:
        db.update_session(session_id, status="failed", error_message=str(e))
        raise HTTPException(500, str(e))


@router.post("/wasapi/stop/{session_id}")
def stop_wasapi(session_id: str):
    """Stop WASAPI capture — goes to 'review' state for user confirmation."""
    capture = _active_captures.pop(session_id, None)
    if not capture:
        raise HTTPException(404, "No active WASAPI capture for this session")

    was_armed_only = capture.is_armed and not capture.is_recording
    wav_path = capture.stop()
    duration = capture.duration

    # If stopped while still armed (no audio detected), cancel instead of review
    if was_armed_only or duration < 0.5:
        from storage.file_manager import cleanup_recording
        cleanup_recording(session_id)
        db.update_session(session_id, status="cancelled")
        return {"session_id": session_id, "status": "cancelled", "duration_seconds": 0.0}

    db.update_session(session_id, status="review", ended_at=db.now_iso(), raw_file_path=str(wav_path))

    return {
        "session_id": session_id,
        "status": "review",
        "duration_seconds": round(duration, 1),
        "raw_file_path": str(wav_path),
    }


@router.post("/wasapi/confirm/{session_id}")
def confirm_wasapi(session_id: str):
    """User confirms save — triggers encoding pipeline."""
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if session["status"] != "review":
        raise HTTPException(400, f"Session not in review state (current: {session['status']})")

    raw_path = session.get("raw_file_path", "")
    if not raw_path:
        raise HTTPException(400, "No raw recording file found")

    db.update_session(session_id, status="encoding")

    import threading
    thread = threading.Thread(
        target=_encode_pipeline,
        args=(session_id, raw_path),
        daemon=True,
    )
    thread.start()

    return {"session_id": session_id, "status": "encoding"}


@router.post("/wasapi/discard/{session_id}")
def discard_wasapi(session_id: str):
    """User discards recording — delete raw file and mark cancelled."""
    session = db.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    from storage.file_manager import cleanup_recording
    cleanup_recording(session_id)
    db.update_session(session_id, status="cancelled")

    return {"session_id": session_id, "status": "cancelled"}


def _encode_pipeline(session_id: str, input_path):
    """Encoding pipeline: WAV/WebM → MP3 + analysis + waveform + ID3 tags."""
    from pathlib import Path
    from capture.encoder import encode_to_mp3
    from metadata.analyzer import analyze_audio
    from metadata.tagger import write_tags
    from metadata.waveform import generate_waveform
    from storage.file_manager import (
        get_library_path, relative_path, get_file_size,
        cleanup_recording, parse_youtube_title,
    )

    try:
        session = db.get_session(session_id)
        tab_title = session.get("tab_title", "") if session else ""

        # Parse title/artist from tab title
        title, artist = parse_youtube_title(tab_title) if tab_title else ("Untitled", "")

        # Encode to MP3
        lib_path = get_library_path(title or "untitled")
        lib_path.parent.mkdir(parents=True, exist_ok=True)
        encode_to_mp3(Path(input_path), lib_path)

        # Analyze
        analysis = analyze_audio(lib_path)

        # Generate waveform
        track_id = db.new_id()
        waveform_path, thumbnail_path = generate_waveform(track_id, lib_path)

        # Write ID3 tags
        write_tags(
            lib_path,
            title=title,
            artist=artist,
            bpm=analysis.get("bpm"),
            key=analysis.get("key", ""),
            capture_date=db.now_iso(),
            source_url=session.get("source_url", "") if session else "",
        )

        # Insert track
        db.insert_track({
            "id": track_id,
            "title": title,
            "artist": artist,
            "source_type": session["source_type"] if session else "wasapi",
            "source_url": session.get("source_url", "") if session else "",
            "file_path": relative_path(lib_path),
            "file_size_bytes": get_file_size(lib_path),
            "duration_seconds": analysis.get("duration_seconds"),
            "bpm": analysis.get("bpm"),
            "key": analysis.get("key", ""),
            "waveform_path": relative_path(waveform_path),
            "thumbnail_path": relative_path(thumbnail_path),
        })

        # Update session
        db.update_session(session_id, status="complete", track_id=track_id)

        # Cleanup temp files
        cleanup_recording(session_id)

    except Exception as e:
        db.update_session(session_id, status="failed", error_message=str(e))
