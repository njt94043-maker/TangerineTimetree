#!/usr/bin/env python3
"""Measure cross-phone timing via audio cross-correlation (GCC-PHAT).

S170 successor to measure-bookend-sync.py. The bookend *tone* approach gave
~200 ms cross-phone deviation on real Beddau-RFC footage (verdict "bad"): tone
onset detection is unreliable in a reverberant room with the phones at different
distances from each speaker. This tool instead correlates the *music itself* —
every phone's mic records the same performance, so the true inter-camera delay
is the lag that best aligns their audio.

Method — Generalized Cross-Correlation with Phase Transform (GCC-PHAT):
    Standard time-delay-of-arrival estimator. Whitens the cross-spectrum
    (divide by magnitude) so the correlation peak depends on *phase* (timing)
    not spectral content — robust to per-mic EQ, level, and reverberation.

Usage:
    python measure-xcorr-sync.py <gig-dir> [--window-sec 180] [--rate 8000] [--skip-sec 0]

What it does:
    1. Walks <gig-dir>/video/<device>/*.mp4. Per device, picks the LARGEST mp4
       (the main set recording, not the short pre-gig test clips that tripped
       up measure-bookend-sync's "first file" heuristic).
    2. Extracts <window-sec> of mono audio at <rate> Hz from each (ffmpeg).
    3. GCC-PHAT each device against the first device -> inter-camera lag (ms).
    4. Reports lag + a confidence (peak-to-sidelobe ratio). Writes
       <gig-dir>/xcorr-timing-report.json.

Confidence (peak / mean-abs-correlation):
    >= 8   strong    — sharp unambiguous peak, trust the offset
    >= 4   ok        — usable, eyeball-verify in the grid
    <  4   weak      — ambiguous; rely on manual nudge

This produces the *auto-seed* offset for the multi-cam grid; the grid layers a
manual per-camera nudge on top (S170 decision: auto-seed + manual safety net).

PROGRESS line format (read by MS host RunPythonScriptAsync):
    PROGRESS: <0..1> <message>
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy as np


def progress(pct: float, msg: str) -> None:
    pct = max(0.0, min(1.0, pct))
    print(f"PROGRESS: {pct:.3f} {msg}", flush=True)


def extract_audio(mp4: Path, rate: int, window_sec: float, skip_sec: float) -> np.ndarray:
    """Decode mono PCM from mp4 via ffmpeg: skip_sec in, window_sec long."""
    cmd = [
        "ffmpeg", "-v", "error",
        "-ss", str(skip_sec),
        "-t", str(window_sec),
        "-i", str(mp4),
        "-vn", "-ac", "1", "-ar", str(rate),
        "-f", "s16le", "-",
    ]
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg failed for {mp4}: {r.stderr.decode(errors='replace')[:300]}")
    return np.frombuffer(r.stdout, dtype="<i2").astype(np.float64)


def gcc_phat(sig: np.ndarray, ref: np.ndarray, rate: int) -> tuple[float, float]:
    """Return (lag_seconds, confidence) aligning sig to ref via GCC-PHAT.

    Positive lag => sig is delayed relative to ref (sig started later).
    Confidence = peak / mean(|correlation|): how sharp/unambiguous the peak is.
    """
    n = sig.size + ref.size
    SIG = np.fft.rfft(sig, n)
    REF = np.fft.rfft(ref, n)
    R = SIG * np.conj(REF)
    denom = np.abs(R)
    denom[denom < 1e-12] = 1e-12          # avoid /0 on silent bins
    cc = np.fft.irfft(R / denom, n)        # PHAT-whitened cross-correlation
    cc = np.concatenate((cc[-(ref.size - 1):], cc[: sig.size]))  # negative..positive lags
    peak_idx = int(np.argmax(np.abs(cc)))
    lag_samples = peak_idx - (ref.size - 1)
    peak = float(np.abs(cc[peak_idx]))
    confidence = peak / float(np.mean(np.abs(cc))) if np.mean(np.abs(cc)) > 0 else 0.0
    return lag_samples / rate, confidence


def conf_label(c: float) -> str:
    if c >= 8:
        return "strong"
    if c >= 4:
        return "ok"
    return "weak"


def largest_mp4(dev_dir: Path) -> Path | None:
    mp4s = [m for m in dev_dir.glob("*.mp4")]
    return max(mp4s, key=lambda m: m.stat().st_size) if mp4s else None


def measure(gig_dir: Path, rate: int, window_sec: float, skip_sec: float) -> dict:
    progress(0.02, "starting cross-correlation analysis")
    video_root = gig_dir / "video"
    if not video_root.is_dir():
        raise SystemExit(f"ERROR: no video/ dir under {gig_dir}")

    device_dirs = sorted(d for d in video_root.iterdir() if d.is_dir() and d.name != "peaks")
    if len(device_dirs) < 2:
        raise SystemExit(f"ERROR: need >=2 device folders, found {len(device_dirs)}")

    progress(0.05, f"found {len(device_dirs)} device dir(s)")
    sources: list[tuple[str, Path, np.ndarray]] = []
    for i, dev in enumerate(device_dirs):
        mp4 = largest_mp4(dev)
        if mp4 is None:
            continue
        progress(0.10 + 0.50 * (i / len(device_dirs)), f"extracting {dev.name}/{mp4.name}")
        sources.append((dev.name, mp4, extract_audio(mp4, rate, window_sec, skip_sec)))

    if len(sources) < 2:
        raise SystemExit("ERROR: <2 devices had usable mp4s")

    ref_name, ref_path, ref_audio = sources[0]
    devices = [{"device": ref_name, "mp4": ref_path.name, "offset_ms": 0, "confidence": None,
                "note": "reference"}]
    for i, (name, path, audio) in enumerate(sources[1:], start=1):
        progress(0.60 + 0.35 * (i / len(sources)), f"correlating {name} vs {ref_name}")
        lag_s, conf = gcc_phat(audio, ref_audio, rate)
        devices.append({
            "device": name, "mp4": path.name,
            "offset_ms": int(round(lag_s * 1000)),
            "confidence": round(conf, 2),
            "quality": conf_label(conf),
        })

    report = {
        "method": "gcc-phat",
        "gig_dir": str(gig_dir),
        "reference": ref_name,
        "params": {"rate_hz": rate, "window_sec": window_sec, "skip_sec": skip_sec},
        "devices": devices,
    }
    out = gig_dir / "xcorr-timing-report.json"
    out.write_text(json.dumps(report, indent=2))
    progress(1.0, f"wrote {out}")
    return report


def main() -> None:
    ap = argparse.ArgumentParser(description="Cross-phone sync via GCC-PHAT audio correlation.")
    ap.add_argument("gig_dir", type=Path)
    ap.add_argument("--rate", type=int, default=8000, help="resample rate Hz (default 8000)")
    ap.add_argument("--window-sec", type=float, default=180.0, help="audio window length")
    ap.add_argument("--skip-sec", type=float, default=0.0, help="skip into the file before sampling")
    args = ap.parse_args()

    report = measure(args.gig_dir, args.rate, args.window_sec, args.skip_sec)

    print()
    print(f"GIG: {report['gig_dir']}  (method: GCC-PHAT, ref: {report['reference']})")
    print("Per device (offset = lag to align to reference):")
    for d in report["devices"]:
        if d.get("note") == "reference":
            print(f"  {d['device']}: reference (0 ms)")
        else:
            print(f"  {d['device']}: offset={d['offset_ms']:>6} ms  "
                  f"confidence={d['confidence']} ({d['quality']})")


if __name__ == "__main__":
    main()
