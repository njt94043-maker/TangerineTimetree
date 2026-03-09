"""Audio analysis — BPM detection and key estimation."""

from pathlib import Path

import librosa
import numpy as np


def analyze_audio(file_path: Path) -> dict:
    """Analyze an audio file for BPM, key, and duration.

    Returns:
        dict with keys: bpm, key, duration_seconds
    """
    y, sr = librosa.load(str(file_path), sr=22050, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)

    # BPM detection
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    bpm = float(np.round(tempo, 1)) if np.isscalar(tempo) else float(np.round(tempo[0], 1))

    # Key estimation via chroma
    key = _estimate_key(y, sr)

    return {
        "bpm": bpm,
        "key": key,
        "duration_seconds": round(duration, 2),
    }


def _estimate_key(y: np.ndarray, sr: int) -> str:
    """Estimate musical key using chroma features."""
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_avg = np.mean(chroma, axis=1)

    # Krumhansl-Schmuckler key profiles
    major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

    pitch_names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    best_corr = -1.0
    best_key = "C major"

    for i in range(12):
        shifted = np.roll(chroma_avg, -i)
        # Major
        corr = float(np.corrcoef(shifted, major_profile)[0, 1])
        if corr > best_corr:
            best_corr = corr
            best_key = f"{pitch_names[i]} major"
        # Minor
        corr = float(np.corrcoef(shifted, minor_profile)[0, 1])
        if corr > best_corr:
            best_corr = corr
            best_key = f"{pitch_names[i]} minor"

    return best_key
