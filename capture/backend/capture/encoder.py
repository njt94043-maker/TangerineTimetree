"""FFmpeg-based audio encoding (WAV/WebM → MP3)."""

import subprocess
from pathlib import Path

from config import FFMPEG_PATH, FFPROBE_PATH, MP3_QUALITY, SAMPLE_RATE


def encode_to_mp3(
    input_path: Path,
    output_path: Path,
    quality: str | None = None,
    sample_rate: int | None = None,
) -> Path:
    """Encode an audio file to MP3 using FFmpeg + LAME.

    Args:
        input_path: Source audio file (WAV, WebM, etc.)
        output_path: Destination MP3 path
        quality: "V0" for VBR ~245kbps or "320" for CBR 320kbps
        sample_rate: Target sample rate (default 44100)

    Returns:
        Path to the encoded MP3 file.
    """
    quality = quality or MP3_QUALITY
    sample_rate = sample_rate or SAMPLE_RATE

    output_path.parent.mkdir(parents=True, exist_ok=True)

    cmd = [
        FFMPEG_PATH,
        "-y",                   # overwrite
        "-i", str(input_path),  # input
        "-vn",                  # no video
        "-ar", str(sample_rate),
        "-ac", "2",             # stereo
        "-codec:a", "libmp3lame",
    ]

    if quality == "320":
        cmd.extend(["-b:a", "320k"])
    else:
        # V0 VBR — highest quality VBR, ~245kbps average
        cmd.extend(["-q:a", "0"])

    cmd.append(str(output_path))

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=300,
    )
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg encoding failed: {result.stderr}")

    return output_path


def get_duration(file_path: Path) -> float:
    """Get audio duration in seconds using ffprobe."""
    cmd = [
        FFPROBE_PATH,
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(file_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        return 0.0
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 0.0
