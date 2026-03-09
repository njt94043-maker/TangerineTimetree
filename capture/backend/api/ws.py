"""WebSocket endpoint for receiving audio chunks from Chrome extension."""

from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from config import RECORDINGS_DIR
from db import database as db
from api.routes_capture import _encode_pipeline

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/capture/{session_id}")
async def capture_websocket(websocket: WebSocket, session_id: str):
    """Receive binary audio chunks from the Chrome extension offscreen document.

    Protocol:
    - Extension sends binary frames (WebM/Opus chunks)
    - Backend appends to temp file
    - On close or text message "stop", triggers encoding pipeline
    - Text message "pause" / "resume" for ad-skipping
    """
    session = db.get_session(session_id)
    if not session:
        await websocket.close(code=4004, reason="Session not found")
        return

    await websocket.accept()

    output_path = RECORDINGS_DIR / f"{session_id}.webm"
    paused = False
    bytes_received = 0

    try:
        with open(output_path, "wb") as f:
            while True:
                data = await websocket.receive()

                if "text" in data:
                    msg = data["text"]
                    if msg == "stop":
                        break
                    elif msg == "pause":
                        paused = True
                        db.update_session(session_id, paused=1)
                        await websocket.send_text('{"status":"paused"}')
                    elif msg == "resume":
                        paused = False
                        db.update_session(session_id, paused=0)
                        await websocket.send_text('{"status":"recording"}')
                    elif msg == "ping":
                        await websocket.send_text(f'{{"status":"ok","bytes":{bytes_received}}}')

                elif "bytes" in data and not paused:
                    chunk = data["bytes"]
                    f.write(chunk)
                    bytes_received += len(chunk)

    except WebSocketDisconnect:
        pass

    # Update session and trigger encoding
    db.update_session(
        session_id,
        status="encoding",
        ended_at=db.now_iso(),
        raw_file_path=str(output_path),
    )

    # Run encoding in background thread
    import threading
    thread = threading.Thread(
        target=_encode_pipeline,
        args=(session_id, output_path),
        daemon=True,
    )
    thread.start()

    try:
        await websocket.send_text('{"status":"encoding"}')
    except Exception:
        pass
