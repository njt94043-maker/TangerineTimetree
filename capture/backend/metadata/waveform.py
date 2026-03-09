"""Waveform data extraction and thumbnail generation."""

import json
from pathlib import Path

import librosa
import numpy as np

from config import WAVEFORMS_DIR, THUMBNAILS_DIR, WAVEFORM_POINTS, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT


def generate_waveform(track_id: str, audio_path: Path) -> tuple[Path, Path]:
    """Generate waveform JSON data and thumbnail PNG.

    Returns:
        (waveform_json_path, thumbnail_png_path)
    """
    y, sr = librosa.load(str(audio_path), sr=22050, mono=True)

    # Compute amplitude envelope
    amplitudes = _compute_envelope(y, WAVEFORM_POINTS)

    # Save JSON
    waveform_path = WAVEFORMS_DIR / f"{track_id}.json"
    waveform_path.write_text(json.dumps(amplitudes))

    # Save thumbnail PNG
    thumbnail_path = THUMBNAILS_DIR / f"{track_id}.png"
    _render_thumbnail(amplitudes, thumbnail_path)

    return waveform_path, thumbnail_path


def _compute_envelope(y: np.ndarray, num_points: int) -> list[float]:
    """Downsample audio to amplitude envelope."""
    chunk_size = max(1, len(y) // num_points)
    envelope = []
    for i in range(num_points):
        start = i * chunk_size
        end = min(start + chunk_size, len(y))
        if start >= len(y):
            envelope.append(0.0)
        else:
            chunk = np.abs(y[start:end])
            envelope.append(float(np.max(chunk)))

    # Normalize to 0-1
    peak = max(envelope) if envelope else 1.0
    if peak > 0:
        envelope = [v / peak for v in envelope]

    return [round(v, 4) for v in envelope]


def _render_thumbnail(amplitudes: list[float], output_path: Path):
    """Render a minimal waveform thumbnail as PNG.

    Uses raw PNG encoding (no matplotlib dependency) for a simple bar waveform.
    """
    import struct
    import zlib

    w, h = THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT
    mid = h // 2

    # Create RGBA pixel buffer
    pixels = bytearray(w * h * 4)

    # Colors
    bar_color = (243, 156, 18, 255)     # tangerine #f39c12
    bg_color = (17, 17, 24, 0)          # transparent bg

    # Fill background (transparent)
    for i in range(w * h):
        pixels[i * 4: i * 4 + 4] = bytes(bg_color)

    # Draw waveform bars
    num_bars = min(len(amplitudes), w)
    step = max(1, len(amplitudes) / w)
    for x in range(w):
        idx = min(int(x * step), len(amplitudes) - 1)
        amp = amplitudes[idx]
        bar_h = max(1, int(amp * mid))
        for dy in range(-bar_h, bar_h + 1):
            y = mid + dy
            if 0 <= y < h:
                offset = (y * w + x) * 4
                pixels[offset: offset + 4] = bytes(bar_color)

    # Encode as PNG
    _write_png(output_path, w, h, pixels)


def _write_png(path: Path, width: int, height: int, rgba_data: bytearray):
    """Write raw RGBA pixel data as a PNG file."""
    import struct
    import zlib

    def make_chunk(chunk_type: bytes, data: bytes) -> bytes:
        chunk = chunk_type + data
        return struct.pack(">I", len(data)) + chunk + struct.pack(">I", zlib.crc32(chunk) & 0xFFFFFFFF)

    # PNG signature
    sig = b"\x89PNG\r\n\x1a\n"

    # IHDR
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    ihdr = make_chunk(b"IHDR", ihdr_data)

    # IDAT — filter rows with filter byte 0 (None)
    raw_rows = b""
    stride = width * 4
    for y in range(height):
        raw_rows += b"\x00"  # filter byte
        raw_rows += bytes(rgba_data[y * stride: (y + 1) * stride])
    idat = make_chunk(b"IDAT", zlib.compress(raw_rows))

    # IEND
    iend = make_chunk(b"IEND", b"")

    path.write_bytes(sig + ihdr + idat + iend)
