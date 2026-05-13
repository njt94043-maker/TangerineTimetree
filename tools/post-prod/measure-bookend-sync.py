#!/usr/bin/env python3
"""Measure cross-phone timing precision via the S139 bookend tone.

F2 (S155): the bookend tone (BookendTonePlayer.kt) plays a 1 kHz, 250 ms,
-12 dBFS burst from each phone's media speaker at set-start. Every phone's
microphone hears every phone's speaker — including its own. We detect the
tone onset in each mp4's audio and report relative offsets across devices.

Why it matters: if cross-phone offsets are within a few tens of ms, the
bookend-tone-based auto-align plan for post-prod is viable. If they're
50+ ms or unstable, multi-cam edits need a different sync strategy (clap
slate, NTP-disciplined phone clocks, or hardware genlock).

Usage:
    python measure-bookend-sync.py <gig-dir>
    python measure-bookend-sync.py D:/Gigs/jam3/

What it does:
    1. Walks <gig-dir>/video/<device>/*.mp4 (per the pull-videos.py layout).
    2. For each mp4, extracts the first 15 s of audio (ffmpeg mono 48 kHz int16).
    3. Sliding 50 ms window over the first 8 s — measures 1 kHz band energy
       via a short FFT. First window whose 1 kHz energy clears
       (median + 6 * MAD) of the noise floor is the tone onset.
    4. Reports per-device onset_ms, computes median, and flags max deviation.
    5. Writes <gig-dir>/timing-report.json + prints a summary table.

Verdict thresholds (relative to median):
    <= 20 ms   excellent   — phones agree within one video frame
    <= 50 ms   good        — visible only on close inspection
    <= 100 ms  concerning  — viewer notices lip-sync drift
    > 100 ms   bad         — bookend strategy isn't delivering

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


SAMPLE_RATE = 48000          # Hz; matches BookendTonePlayer's AudioTrack rate
PROBE_SECONDS = 15.0         # how much of each file to scan
SEARCH_SECONDS = 8.0         # how far into the file the first burst should be
WINDOW_MS = 50               # sliding window length
TONE_FREQ_HZ = 1000          # bookend tone frequency
TONE_FREQ_TOLERANCE = 40     # Hz half-width around 1 kHz for the FFT bin selection
ONSET_K_MAD = 6.0            # threshold = median + K * MAD over the noise floor


def progress(pct: float, msg: str) -> None:
    pct = max(0.0, min(1.0, pct))
    print(f"PROGRESS: {pct:.3f} {msg}", flush=True)


def extract_audio_pcm(mp4_path: Path, seconds: float) -> "np.ndarray":
    """Use ffmpeg to extract the first `seconds` of audio as mono 48 kHz int16,
    returned as a 1-D numpy array. Raises if ffmpeg fails."""
    cmd = [
        "ffmpeg", "-loglevel", "error",
        "-ss", "0", "-t", str(seconds),
        "-i", str(mp4_path),
        "-ac", "1", "-ar", str(SAMPLE_RATE),
        "-f", "s16le", "-",
    ]
    r = subprocess.run(cmd, capture_output=True, timeout=60)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg failed for {mp4_path}: {r.stderr.decode(errors='replace')[:300]}")
    return np.frombuffer(r.stdout, dtype=np.int16).astype(np.float32) / 32768.0


def detect_tone_onset_ms(samples: "np.ndarray") -> tuple[int | None, dict]:
    """Find the first sliding window where 1 kHz band energy exceeds the
    (median + K*MAD) noise floor. Returns (onset_ms, diagnostics) — onset_ms
    is None if no tone was detected within SEARCH_SECONDS."""
    win_samples = int(SAMPLE_RATE * WINDOW_MS / 1000)
    if len(samples) < win_samples * 4:
        return None, {"error": "audio too short"}

    # Restrict the search window so a tone at e.g. 6 s doesn't get masked by
    # the noise floor of a 15 s file's median.
    search_samples = int(SAMPLE_RATE * SEARCH_SECONDS)
    work = samples[:min(len(samples), search_samples)]

    # Window-by-window 1 kHz energy via rfft + integration of bins near 1 kHz.
    # FFT bin spacing for an N-sample window at fs=48k: fs/N Hz/bin.
    n_windows = (len(work) - win_samples) // (win_samples // 2) + 1   # 50% overlap
    if n_windows < 8:
        return None, {"error": "too few windows"}

    bin_lo = int((TONE_FREQ_HZ - TONE_FREQ_TOLERANCE) * win_samples / SAMPLE_RATE)
    bin_hi = int((TONE_FREQ_HZ + TONE_FREQ_TOLERANCE) * win_samples / SAMPLE_RATE) + 1
    bin_lo = max(1, bin_lo)
    bin_hi = max(bin_lo + 1, bin_hi)

    energies = np.zeros(n_windows, dtype=np.float32)
    hann = np.hanning(win_samples).astype(np.float32)
    step = win_samples // 2
    for i in range(n_windows):
        a = i * step
        b = a + win_samples
        if b > len(work):
            energies = energies[:i]
            break
        w = work[a:b] * hann
        spec = np.fft.rfft(w)
        energies[i] = float(np.abs(spec[bin_lo:bin_hi]).max())

    # Noise floor: use the first 30% of the windows (assumes the tone arrives
    # later — true because BookendTonePlayer fires AFTER recording begins).
    n_floor = max(4, len(energies) // 3)
    floor = energies[:n_floor]
    med = float(np.median(floor))
    mad = float(np.median(np.abs(floor - med))) + 1e-6
    threshold = med + ONSET_K_MAD * mad

    crossings = np.where(energies > threshold)[0]
    if len(crossings) == 0:
        return None, {
            "median_floor": med,
            "mad": mad,
            "threshold": threshold,
            "peak_energy": float(energies.max()),
            "peak_index": int(energies.argmax()),
        }

    onset_window = int(crossings[0])
    onset_samples = onset_window * step
    onset_ms = int(round(onset_samples * 1000.0 / SAMPLE_RATE))
    return onset_ms, {
        "median_floor": med,
        "mad": mad,
        "threshold": threshold,
        "energy_at_onset": float(energies[onset_window]),
    }


def measure_gig(gig_dir: Path) -> dict:
    """Walk <gig_dir>/video/<device>/, measure tone onset in each device's
    FIRST mp4 (sorted by name = chronological). Returns the report dict."""
    video_root = gig_dir / "video"
    if not video_root.is_dir():
        raise SystemExit(f"ERROR: no video/ subdir under {gig_dir}")

    device_dirs = sorted([d for d in video_root.iterdir() if d.is_dir() and d.name != "peaks"])
    if not device_dirs:
        raise SystemExit(f"ERROR: no device folders under {video_root}")

    progress(0.05, f"found {len(device_dirs)} device dir(s)")
    devices: list[dict] = []
    for i, dev in enumerate(device_dirs):
        mp4s = sorted(dev.glob("*.mp4"))
        if not mp4s:
            devices.append({"device": dev.name, "onset_ms": None, "note": "no mp4s"})
            continue
        first = mp4s[0]
        pct = 0.10 + 0.80 * (i / len(device_dirs))
        progress(pct, f"analysing {dev.name}/{first.name}")
        try:
            samples = extract_audio_pcm(first, PROBE_SECONDS)
            onset_ms, diag = detect_tone_onset_ms(samples)
            devices.append({
                "device": dev.name,
                "mp4": first.name,
                "onset_ms": onset_ms,
                "diagnostics": {k: round(v, 4) if isinstance(v, float) else v for k, v in diag.items()},
            })
        except Exception as e:
            devices.append({"device": dev.name, "mp4": first.name, "onset_ms": None, "error": str(e)})

    # Compute relative offsets vs median of detected onsets.
    detected = [d for d in devices if d.get("onset_ms") is not None]
    if not detected:
        verdict = "no_tone_detected"
        median_ms = None
        max_dev_ms = None
    else:
        onsets = [d["onset_ms"] for d in detected]
        median_ms = int(round(float(np.median(onsets))))
        for d in detected:
            d["offset_from_median_ms"] = d["onset_ms"] - median_ms
        max_dev_ms = int(max(abs(d["offset_from_median_ms"]) for d in detected))
        if max_dev_ms <= 20:
            verdict = "excellent"
        elif max_dev_ms <= 50:
            verdict = "good"
        elif max_dev_ms <= 100:
            verdict = "concerning"
        else:
            verdict = "bad"

    return {
        "gig_path": str(gig_dir).replace("\\", "/"),
        "devices": devices,
        "median_onset_ms": median_ms,
        "max_deviation_ms": max_dev_ms,
        "verdict": verdict,
    }


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("gig_dir", help="Local gig dir (e.g. D:/Gigs/jam3/)")
    p.add_argument("--out", default=None, help="Path to write report JSON. "
                                                "Default: <gig_dir>/timing-report.json")
    args = p.parse_args()

    gig_dir = Path(args.gig_dir)
    if not gig_dir.is_dir():
        sys.exit(f"ERROR: gig dir does not exist: {gig_dir}")

    progress(0.02, "starting timing analysis")
    report = measure_gig(gig_dir)

    out_path = Path(args.out) if args.out else gig_dir / "timing-report.json"
    out_path.write_text(json.dumps(report, indent=2))
    progress(1.0, f"wrote {out_path}")

    # Human-readable summary on stdout (for MS host task message + terminal use).
    print()
    print(f"GIG: {report['gig_path']}")
    print(f"Verdict: {report['verdict']}")
    if report["median_onset_ms"] is not None:
        print(f"Median tone onset: {report['median_onset_ms']} ms")
        print(f"Max deviation: {report['max_deviation_ms']} ms")
    print("Per device:")
    for d in report["devices"]:
        if d.get("onset_ms") is None:
            note = d.get("error") or d.get("note") or "no tone detected"
            print(f"  {d['device']}: NO ONSET ({note})")
        else:
            off = d.get("offset_from_median_ms", 0)
            sign = "+" if off >= 0 else ""
            print(f"  {d['device']}: onset={d['onset_ms']:>5} ms  ({sign}{off} ms vs median)")


if __name__ == "__main__":
    main()
