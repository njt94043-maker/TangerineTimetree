#!/usr/bin/env python3
"""Per-gig drumming performance analysis from the multitrack.

    python analyse-drumming.py C:/Gigs/<gig>
    python analyse-drumming.py C:/Gigs/<gig> --take 260801_2041

Reads the isolated kick + a full-kit reference (EAD, or overheads if present),
segments the set into songs on gaps in kit activity, and reports per song:
tempo, timing offset (rush/drag), timing spread (consistency), and dynamics.

WHY THE REFERENCE COMES FROM THE PERFORMANCE
--------------------------------------------
A gig has no click. The band drifts musically and that is not an error. Grading
against a fixed grid marks good playing as bad. So the pulse is beat-tracked
from the FULL-KIT mic (snare/hats carry it), and the kick is measured against
that live pulse.

TWO TRAPS, BOTH HIT FOR REAL DURING S286 - DO NOT REINTRODUCE
-------------------------------------------------------------
1. `onset_detect(backtrack=True)` walks each detection back to the preceding
   envelope minimum. It produced a FAKE -46 ms median offset that read as
   "the drummer rushes". With backtrack=False the true median was +0.0 ms.
   **Never backtrack for timing measurement.**
2. Snapping to a beat/half-beat grid scores legitimate offbeat kicks as late.
   Use a 16th grid and reject anything beyond half a subdivision.

WHAT THE NUMBERS ARE WORTH
--------------------------
The beat tracker has its own jitter, so ABSOLUTE spread includes measurement
noise. The RELATIVE comparisons - song vs song, slow vs fast, set 1 vs set 2 -
are the trustworthy output. Report them that way.
"""
from __future__ import annotations
import argparse, glob, json, os, sys, warnings
import numpy as np

warnings.filterwarnings("ignore")
SR = 22050


def find_tracks(media_dir: str, take: str | None):
    """Locate the kick and a full-kit reference for one take."""
    wavs = sorted(glob.glob(os.path.join(media_dir, "*.wav")))
    if not wavs:
        sys.exit(f"no WAVs in {media_dir}")
    takes = sorted({os.path.basename(w).rsplit("-", 1)[-1][:-4] for w in wavs})
    if take is None:
        return [(t, wavs) for t in takes]
    return [(take, wavs)]


def pick(wavs, take, *names):
    for n in names:
        for w in wavs:
            b = os.path.basename(w)
            if b.startswith(n) and b.endswith(f"{take}.wav"):
                return w
    return None


def segment_songs(onsets, gap=6.0, min_len=45.0):
    if len(onsets) == 0:
        return []
    out, start, prev = [], onsets[0], onsets[0]
    for t in onsets[1:]:
        if t - prev > gap:
            if prev - start >= min_len:
                out.append((start, prev))
            start = t
        prev = t
    if prev - start >= min_len:
        out.append((start, prev))
    return out


def analyse_song(ref, kick, t0, t1, librosa):
    a, b = int(t0 * SR), int(t1 * SR)
    r, k = ref[a:b], kick[a:b]
    if len(r) < SR * 10:
        return None

    tempo, beats = librosa.beat.beat_track(y=r, sr=SR, units="time", tightness=100)
    tempo = float(np.atleast_1d(tempo)[0])
    if len(beats) < 8:
        return None
    ibi = np.diff(beats)
    ibi = ibi[(ibi > 0.2) & (ibi < 2.0)]
    if len(ibi) < 4:
        return None

    # 16th grid off the live pulse (trap #2)
    step = ibi.mean() / 4.0
    grid = np.sort(np.concatenate([beats + i * step for i in range(4)]))

    # backtrack=False is load-bearing (trap #1)
    ko = librosa.onset.onset_detect(y=k, sr=SR, units="time", backtrack=False,
                                    pre_max=20, post_max=20, pre_avg=100,
                                    post_avg=100, delta=0.2, wait=10)
    if len(ko) < 10:
        return None

    i = np.clip(np.searchsorted(grid, ko), 1, len(grid) - 1)
    nearest = np.where(np.abs(ko - grid[i - 1]) < np.abs(grid[i] - ko), grid[i - 1], grid[i])
    dev = (ko - nearest) * 1000.0
    keep = np.abs(dev) < step * 1000 * 0.5
    dev, kept = dev[keep], ko[keep]
    if len(dev) < 10:
        return None

    peaks = [float(np.max(np.abs(k[int(t*SR):min(int(t*SR)+int(0.05*SR), len(k))])))
             for t in kept if int(t*SR) < len(k)]
    pdb = 20 * np.log10(np.maximum(np.array(peaks or [1.0]), 1e-6))

    return {"start": round(t0, 1), "len_s": round(t1 - t0, 1), "bpm": round(tempo, 1),
            "kicks": int(len(dev)), "offset_ms": round(float(np.mean(dev)), 1),
            "spread_ms": round(float(np.std(dev)), 1),
            "worst_ms": round(float(np.percentile(np.abs(dev), 95)), 1),
            "dyn_sd_db": round(float(np.std(pdb)), 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("gig_dir")
    ap.add_argument("--take", default=None, help="e.g. 260801_2041 (default: all takes)")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    try:
        import librosa
    except ImportError:
        sys.exit("librosa required:  pip install librosa")

    media = os.path.join(args.gig_dir, "Media")
    results = {}
    for take, wavs in find_tracks(media, args.take):
        kick = pick(wavs, take, "10-10 Kick", "10-")
        ref = (pick(wavs, take, "15-15 OH L", "16-16 OH R") or
               pick(wavs, take, "08-08 EAD L", "09-09 EAD R"))
        if not kick or not ref:
            print(f"[{take}] SKIP - need a kick and a full-kit reference"); continue
        # Guard: a dead reference mic silently produces garbage timing
        y_ref, _ = librosa.load(ref, sr=SR, mono=True)
        if 20 * np.log10(max(np.max(np.abs(y_ref)), 1e-9)) < -40:
            print(f"[{take}] SKIP - reference {os.path.basename(ref)} is silent (dead mic)"); continue
        y_k, _ = librosa.load(kick, sr=SR, mono=True)
        n = min(len(y_ref), len(y_k)); y_ref, y_k = y_ref[:n], y_k[:n]

        print(f"[{take}] ref={os.path.basename(ref)}")
        ot = librosa.onset.onset_detect(y=y_ref, sr=SR, units="time")
        songs = segment_songs(ot)
        rows = []
        for n_, (t0, t1) in enumerate(songs, 1):
            r = analyse_song(y_ref, y_k, t0, t1, librosa)
            if r:
                r["n"] = n_; rows.append(r)
                print(f"  {n_:2d}  {r['len_s']/60:4.1f}min {r['bpm']:6.1f}bpm  "
                      f"offset {r['offset_ms']:+6.1f}ms  spread {r['spread_ms']:5.1f}ms  "
                      f"kicks {r['kicks']:4d}")
        if rows:
            sp = np.array([x["spread_ms"] for x in rows])
            of = np.array([x["offset_ms"] for x in rows])
            print(f"  -- {len(rows)} songs | spread {sp.mean():.1f} ms "
                  f"(best {sp.min():.1f}, worst {sp.max():.1f}) | offset {of.mean():+.1f} ms")
        results[take] = rows

    out = args.out or os.path.join(args.gig_dir, "drumming-analysis.json")
    json.dump(results, open(out, "w"), indent=1)
    print(f"-> {out}")


if __name__ == "__main__":
    main()
