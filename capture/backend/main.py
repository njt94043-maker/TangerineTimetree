"""TGT Capture — FastAPI application."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS, HOST, PORT, FFMPEG_PATH
from db.database import init_db, get_stats
from api.routes_library import router as library_router
from api.routes_capture import router as capture_router
from api.routes_waveform import router as waveform_router
from api.ws import router as ws_router

app = FastAPI(
    title="TGT Capture",
    description="Audio capture & music management backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(library_router)
app.include_router(capture_router)
app.include_router(waveform_router)
app.include_router(ws_router)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/api/stats")
def stats():
    return get_stats()


@app.get("/api/health")
def health():
    import time
    return {
        "status": "ok",
        "service": "tgt-capture",
        "uptime": round(time.time() - _start_time, 1),
        "ffmpeg": FFMPEG_PATH,
    }


@app.post("/api/admin/restart")
def restart_server():
    """Trigger uvicorn reload by touching main.py."""
    import pathlib, os
    main_file = pathlib.Path(__file__)
    os.utime(main_file, None)
    return {"status": "restarting"}


@app.get("/api/admin/logs")
def get_logs(lines: int = 50):
    """Return recent backend log lines (from stderr capture)."""
    return {"lines": _log_buffer.get_lines(lines)}


# ── Startup time tracking ──
import time as _time_mod
_start_time = _time_mod.time()


# ── Log buffer for in-app log viewer ──
import collections as _collections
import logging as _logging

class _LogBuffer:
    def __init__(self, maxlen: int = 500):
        self._buf: _collections.deque[str] = _collections.deque(maxlen=maxlen)
    def write(self, msg: str):
        for line in msg.strip().splitlines():
            if line.strip():
                self._buf.append(line)
    def get_lines(self, n: int = 50) -> list[str]:
        return list(self._buf)[-n:]

_log_buffer = _LogBuffer()

# Hook Python logging into the buffer
class _BufferHandler(_logging.Handler):
    def emit(self, record):
        _log_buffer.write(self.format(record))

_handler = _BufferHandler()
_handler.setFormatter(_logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s", datefmt="%H:%M:%S"))
_logging.getLogger("uvicorn").addHandler(_handler)
_logging.getLogger("uvicorn.access").addHandler(_handler)
_logging.getLogger().addHandler(_handler)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
