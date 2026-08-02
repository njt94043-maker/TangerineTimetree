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
        if not kick:
            print(f"[{take}] SKIP - no kick track"); continue

        # Reference preference: overheads (best whole-kit picture), then EAD.
        # A DEAD mic must fall through to the next candidate, not abort the take -
        # the 60th-party gig had silent overheads and a perfect EAD, and an earlier
        # version of this skipped the whole gig rather than using it.
        ref = None
        for cand in ("15-15 OH L", "16-16 OH R", "08-08 EAD L", "09-09 EAD R"):
            p = pick(wavs, take, cand)
            if not p:
                continue
            y, _ = librosa.load(p, sr=SR, mono=True)
            peak_db = 20 * np.log10(max(float(np.max(np.abs(y))), 1e-9))
            if peak_db < -40:
                print(f"[{take}] {cand} is silent ({peak_db:.0f} dB) - trying next")
                continue
            ref, y_ref = p, y
            break
        if ref is None:
            print(f"[{take}] SKIP - no usable full-kit reference (all candidates missing or silent)")
            continue

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

    md = os.path.join(args.gig_dir, "DRUMMING-REVIEW.md")
    write_review(results, os.path.basename(args.gig_dir.rstrip("/\\")), md)
    print(f"-> {md}")


def write_review(results, gig, path):
    """Human-readable review. The JSON is for the PWA; this is for Nathan."""
    rows = [r for take in results.values() for r in take]
    if not rows:
        open(path, "w", encoding="utf-8").write(f"# Drumming Review — {gig}\n\nNo analysable songs.\n")
        return
    sp = np.array([r["spread_ms"] for r in rows]); of = np.array([r["offset_ms"] for r in rows])
    bpm = np.array([r["bpm"] for r in rows]); kicks = sum(r["kicks"] for r in rows)
    slow, fast = bpm < 120, bpm >= 150
    worst = rows[int(np.argmax(sp))]; best = rows[int(np.argmin(sp))]

    L = [f"# Drumming Review — {gig}", "",
         f"**{len(rows)} songs · ~{kicks:,} kick hits measured**  ",
         "Isolated kick measured against a beat-tracked pulse from the full-kit mic.  ",
         "Generated by `tools/post-prod/analyse-drumming.py`", "", "---", "",
         "## Placement", "",
         f"Mean offset **{of.mean():+.1f} ms** — "
         + ("neither rushing nor dragging." if abs(of.mean()) < 5 else
            ("consistently ahead of the beat." if of.mean() < 0 else "consistently behind the beat.")),
         "", "## Consistency", "",
         f"Mean spread **{sp.mean():.1f} ms** (best {sp.min():.1f}, worst {sp.max():.1f}).  ",
         "Under 10 ms is very tight · 10–20 solid · over 30 loose.", ""]

    if slow.sum() >= 2 and fast.sum() >= 2:
        L += ["## Tempo", "",
              f"| | Spread |", "|---|---|",
              f"| Slow (<120 bpm, {slow.sum()} songs) | {sp[slow].mean():.1f} ms |",
              f"| Fast (≥150 bpm, {fast.sum()} songs) | {sp[fast].mean():.1f} ms |", ""]
        if sp[slow].mean() > sp[fast].mean() * 1.15:
            L += ["**Looser at slow tempos.** More space between hits means more room for the "
                  "internal clock to wander. Practise at 80–90 bpm subdividing internally, or with "
                  "the click on the *and* rather than the beat.", ""]

    L += ["## Best and worst", "",
          f"- **Tightest:** {best['bpm']:.0f} bpm — {best['spread_ms']} ms spread",
          f"- **Loosest:** {worst['bpm']:.0f} bpm — {worst['spread_ms']} ms spread, "
          f"offset {worst['offset_ms']:+.1f} ms", "",
          "## Per song", "",
          "| Take | # | Length | Tempo | Offset | Spread | Kicks |", "|---|---|---|---|---|---|---|"]
    for take, rs in results.items():
        for r in rs:
            L.append(f"| {take} | {r['n']} | {r['len_s']/60:.1f} min | {r['bpm']:.1f} | "
                     f"{r['offset_ms']:+.1f} ms | {r['spread_ms']:.1f} ms | {r['kicks']} |")
    L += ["", "---", "",
          "## What this cannot measure", "",
          "- **Kick only** — nothing here covers limb independence, backbeat placement or ghost notes.",
          "- The reference is a beat-tracker with its own jitter. **Comparisons between songs are "
          "trustworthy; absolute spread includes measurement noise.**",
          "- Song boundaries are gap-detected, not from markers — approximate and unnamed.", ""]
    open(path, "w", encoding="utf-8").write("\n".join(L))


if __name__ == "__main__":
    main()
