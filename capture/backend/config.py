"""TGT Capture — configuration."""

import os
from pathlib import Path

# Root paths
BACKEND_DIR = Path(__file__).parent
CAPTURE_ROOT = BACKEND_DIR.parent
STORAGE_DIR = CAPTURE_ROOT / "storage"
RECORDINGS_DIR = STORAGE_DIR / "recordings"
LIBRARY_DIR = STORAGE_DIR / "library"
WAVEFORMS_DIR = STORAGE_DIR / "waveforms"
THUMBNAILS_DIR = STORAGE_DIR / "thumbnails"
DB_PATH = CAPTURE_ROOT / "capture.db"

# Server
HOST = "127.0.0.1"
PORT = 9123
CORS_ORIGINS = [
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5173",       # web app dev server
    "https://thegreentangerine.com",  # deployed PWA
    "chrome-extension://*",
]

# FFmpeg — winget installs to a long path, not on PATH by default
_WINGET_FFMPEG = (
    Path.home()
    / "AppData/Local/Microsoft/WinGet/Packages"
    / "Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
    / "ffmpeg-8.0.1-full_build/bin/ffmpeg.exe"
)
_DEFAULT_FFMPEG = str(_WINGET_FFMPEG) if _WINGET_FFMPEG.exists() else "ffmpeg"
FFMPEG_PATH = os.environ.get("FFMPEG_PATH", _DEFAULT_FFMPEG)

# Derive ffprobe from the same directory as ffmpeg
_ffmpeg_p = Path(FFMPEG_PATH)
_ffprobe_default = str(_ffmpeg_p.parent / _ffmpeg_p.name.replace("ffmpeg", "ffprobe"))
FFPROBE_PATH = os.environ.get("FFPROBE_PATH", _ffprobe_default)

# Encoding defaults
MP3_QUALITY = os.environ.get("MP3_QUALITY", "V0")  # "V0" (VBR ~245kbps) or "320" (CBR)
SAMPLE_RATE = 44100

# Waveform
WAVEFORM_POINTS = 800  # amplitude sample points for canvas rendering
THUMBNAIL_WIDTH = 400
THUMBNAIL_HEIGHT = 60

# Ensure storage dirs exist
for d in [RECORDINGS_DIR, LIBRARY_DIR, WAVEFORMS_DIR, THUMBNAILS_DIR]:
    d.mkdir(parents=True, exist_ok=True)
