#!/usr/bin/env python3
"""
S129 W3 — gig multitrack mixdown → setlist_entry_practice_tracks ingest.

Walks a Reaper post-prod folder of per-song renders (output of either Region
Render Matrix or split-into-songs.py + manual render), beat-maps each stereo
mixdown, optionally uploads to the Supabase practice-tracks bucket, and
upserts setlist_entry_practice_tracks rows so the data lights up in the APK
and Web band practice player surfaces.

# Expected input layout

The pipeline assumes a folder where each subdirectory IS a song. Folder name
is matched (fuzzy) against `setlist_entries.title`. Inside each song folder:

    <song-name>/
      stereo.wav         # the full mixdown (always required)
      full.wav           # optional — same as stereo in most cases, kept for
                         # the 7-key stems shape consistency
      drums.wav          # } the 6 isolated stems plus full.wav above gives
      guitar.wav         # } the 7-stem layout for ours_*-stems rows
      bass.wav           # }
      vox1.wav           # }
      vox2.wav           # }
      vox_bus.wav        # }

If only `stereo.wav` is present, only the `stereo`-format row is written. If
all 7 stems are present, both `stereo` and `stems` rows are written.

The PARENT folder name should be the gig's identifier, e.g.
    `2026-05-03-three-doors/`
The pipeline derives `gig_album = "<parent-folder>"` and tags every row.

# Usage

    python ingest-gig-mixdown.py <gig-folder> [--version-label ours_a]
                                              [--upload-to-supabase]
                                              [--dry-run]

If --version-label is omitted, the pipeline picks the next free slot per
setlist entry (ours_a → ours_b → ours_c). Specifying it forces a label and
will overwrite an existing row for that entry+label+format pair (idempotent
re-runs).

--upload-to-supabase enables the bucket upload step. Without it, only
ms_track_id pointers are populated (Tailscale-required Web access). Brief
W3 step 3 — opt-in.

--dry-run prints the plan without inserting / uploading.

# Configuration

Reads `C:/Apps/TGT/.env` for SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or
SUPABASE_PUBLISHABLE_KEY if service role isn't present — note: anon-key
inserts will fail for the practice_tracks RLS).

Media Server library API: see MS_API_BASE constant. The library-add step is
stubbed with a TODO comment until the MS endpoint shape is finalised — the
pipeline currently writes ms_track_id as a deterministic placeholder
("<gig_album>::<song>::<format>") so Realtime subscribers see something
non-null and the upload-from-MS step can rewrite it later.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Optional

import librosa
import requests
import soundfile as sf

# advice/04 §A item 2 — service key now lives in the DPAPI store, not .env.
sys.path.insert(0, r"C:\apps\Dev Team\scripts")
from dev_secrets import get_secret  # noqa: E402

ENV_PATH = Path(r"C:/Apps/TGT/.env")
MS_API_BASE = "https://e6330:9443/api"  # placeholder — actual MS HTTP endpoint TBD
STEM_NAMES = ["full", "drums", "guitar", "bass", "vox1", "vox2", "vox_bus"]
VERSION_ORDER = ["ours_a", "ours_b", "ours_c"]
SUPABASE_BUCKET = "practice-tracks"
TITLE_MATCH_THRESHOLD = 0.78  # SequenceMatcher ratio above this is accepted


# ── Env loading ───────────────────────────────────────────────────────────


def load_env(path: Path) -> dict[str, str]:
    if not path.exists():
        sys.exit(f"ERROR: env file missing at {path}")
    out: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


# ── Title fuzzy-match ─────────────────────────────────────────────────────


def normalise(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = s.encode("ascii", "ignore").decode("ascii").lower()
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def best_match(folder_name: str, entries: list[dict]) -> Optional[dict]:
    target = normalise(folder_name)
    best: tuple[float, Optional[dict]] = (0.0, None)
    for entry in entries:
        score = SequenceMatcher(None, target, normalise(entry["title"])).ratio()
        if score > best[0]:
            best = (score, entry)
    if best[0] >= TITLE_MATCH_THRESHOLD:
        return best[1]
    return None


# ── Beat-mapping ──────────────────────────────────────────────────────────


def beatmap(wav_path: Path) -> tuple[Optional[int], list[float]]:
    """Return (bpm, beat_times_seconds). Prefers drums.wav for tempo accuracy
    when available (the input is a 7-stem ours_* render — drum stem isolates
    transients, librosa locks tempo more reliably than on a busy full mix).
    Caller resolves the right input file and passes it in."""
    try:
        y, sr = librosa.load(str(wav_path), sr=None, mono=True)
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
        bpm = int(round(float(tempo))) if tempo else None
        beat_times = librosa.frames_to_time(beats, sr=sr).tolist()
        return bpm, beat_times
    except Exception as e:
        print(f"  beatmap failed: {e}")
        return None, []


def duration_seconds(wav_path: Path) -> Optional[int]:
    try:
        info = sf.info(str(wav_path))
        return int(round(info.duration))
    except Exception:
        return None


# ── Supabase REST ─────────────────────────────────────────────────────────


@dataclass
class Supa:
    url: str
    key: str

    def headers(self) -> dict[str, str]:
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    def list_setlist_entries(self) -> list[dict]:
        r = requests.get(
            f"{self.url}/rest/v1/setlist_entries",
            params={"select": "id,title,artist,list_id,position", "order": "list_id,position"},
            headers=self.headers(),
            timeout=30,
        )
        r.raise_for_status()
        return r.json()

    def list_existing_practice_tracks(self, entry_id: str) -> list[dict]:
        r = requests.get(
            f"{self.url}/rest/v1/setlist_entry_practice_tracks",
            params={"select": "id,version_label,format", "setlist_entry_id": f"eq.{entry_id}"},
            headers=self.headers(),
            timeout=30,
        )
        r.raise_for_status()
        return r.json()

    def upsert_practice_track(self, row: dict) -> dict:
        r = requests.post(
            f"{self.url}/rest/v1/setlist_entry_practice_tracks",
            params={"on_conflict": "setlist_entry_id,version_label,format"},
            headers={**self.headers(), "Prefer": "resolution=merge-duplicates,return=representation"},
            data=json.dumps(row),
            timeout=30,
        )
        r.raise_for_status()
        return r.json()[0]

    def upload_audio(self, local: Path, remote: str) -> None:
        r = requests.post(
            f"{self.url}/storage/v1/object/{SUPABASE_BUCKET}/{remote}",
            headers={
                "Authorization": f"Bearer {self.key}",
                "Content-Type": "audio/wav",
                "x-upsert": "true",
            },
            data=local.read_bytes(),
            timeout=300,
        )
        if r.status_code >= 400:
            raise RuntimeError(f"upload {remote} failed: {r.status_code} {r.text[:200]}")


# ── Per-song processing ───────────────────────────────────────────────────


def pick_version_label(existing: list[dict], format: str, forced: Optional[str]) -> Optional[str]:
    if forced:
        return forced
    used = {row["version_label"] for row in existing if row["format"] == format}
    for label in VERSION_ORDER:
        if label not in used:
            return label
    return None  # all 3 slots full — caller decides what to do


def process_song(
    song_dir: Path,
    gig_album: str,
    entries: list[dict],
    supa: Supa,
    forced_label: Optional[str],
    upload: bool,
    dry_run: bool,
) -> dict:
    name = song_dir.name
    print(f"\n• {name}")

    stereo = song_dir / "stereo.wav"
    if not stereo.exists():
        return {"skip": "no stereo.wav"}

    entry = best_match(name, entries)
    if not entry:
        return {"skip": "no setlist match"}
    print(f"  matched -> [{entry['list_id']}] {entry['title']} ({entry['id']})")

    # Beat-map: drums.wav if present, else stereo.wav
    drums = song_dir / "drums.wav"
    bpm_source = drums if drums.exists() else stereo
    print(f"  beatmap source: {bpm_source.name}")
    bpm, _beats = beatmap(bpm_source) if not dry_run else (None, [])
    dur = duration_seconds(stereo)

    stems_present = all((song_dir / f"{n}.wav").exists() for n in STEM_NAMES)

    existing = [] if dry_run else supa.list_existing_practice_tracks(entry["id"])

    rows_written = []

    # ── stereo row ──
    stereo_label = pick_version_label(existing, "stereo", forced_label)
    if stereo_label is None:
        print("  all stereo slots full (ours_a/b/c) — skipping")
    else:
        ms_id = f"{gig_album}::{name}::stereo"
        supa_path = None
        if upload and not dry_run:
            supa_path = f"{entry['id']}/{stereo_label}/stereo.wav"
            print(f"  uploading stereo → {supa_path}")
            supa.upload_audio(stereo, supa_path)
        row = {
            "setlist_entry_id": entry["id"],
            "version_label": stereo_label,
            "format": "stereo",
            "ms_track_id": ms_id,
            "supabase_path": supa_path,
            "gig_album": gig_album,
            "duration_seconds": dur,
            "bpm": bpm,
        }
        if dry_run:
            print(f"  DRY: would upsert stereo row label={stereo_label} bpm={bpm}")
            rows_written.append({"dry": True, **row})
        else:
            written = supa.upsert_practice_track(row)
            print(f"  wrote stereo row label={stereo_label} bpm={bpm}")
            rows_written.append(written)

    # ── stems row ──
    if stems_present:
        stems_label = forced_label or stereo_label  # keep stereo+stems aligned by default
        if stems_label is None:
            print("  no free stems slot — skipping")
        else:
            ms_stems = {n: f"{gig_album}::{name}::stems::{n}" for n in STEM_NAMES}
            supa_stems_paths = None
            if upload and not dry_run:
                supa_stems_paths = {}
                for n in STEM_NAMES:
                    rel = f"{entry['id']}/{stems_label}/stems/{n}.wav"
                    print(f"  uploading {n} → {rel}")
                    supa.upload_audio(song_dir / f"{n}.wav", rel)
                    supa_stems_paths[n] = rel
            row = {
                "setlist_entry_id": entry["id"],
                "version_label": stems_label,
                "format": "stems",
                "ms_track_id": None,
                "ms_stems_refs": ms_stems,
                "supabase_path": None,
                "supabase_stems_paths": supa_stems_paths,
                "gig_album": gig_album,
                "duration_seconds": dur,
                "bpm": bpm,
            }
            if dry_run:
                print(f"  DRY: would upsert stems row label={stems_label}")
                rows_written.append({"dry": True, **row})
            else:
                written = supa.upsert_practice_track(row)
                print(f"  wrote stems row label={stems_label}")
                rows_written.append(written)

    return {
        "title": entry["title"],
        "rows": rows_written,
        "stems_present": stems_present,
    }


# ── Main ──────────────────────────────────────────────────────────────────


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("gig_folder", help="Top-level folder; each subfolder = one song")
    ap.add_argument("--version-label", choices=VERSION_ORDER, default=None,
                    help="Force a specific label. Default: pick next free slot.")
    ap.add_argument("--upload-to-supabase", action="store_true",
                    help="Also upload audio to the practice-tracks bucket for Web access.")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv[1:])

    gig_folder = Path(args.gig_folder).resolve()
    if not gig_folder.is_dir():
        sys.exit(f"ERROR: not a directory: {gig_folder}")
    gig_album = gig_folder.name

    env = load_env(ENV_PATH)
    url = env.get("SUPABASE_URL") or "https://jlufqgslgjowfaqmqlds.supabase.co"
    # Service key from DPAPI (preferred), publishable key from .env as fallback.
    key = get_secret("SUPABASE_SERVICE_ROLE_KEY") or env.get("SUPABASE_PUBLISHABLE_KEY")
    if not key:
        sys.exit("ERROR: SUPABASE_SERVICE_ROLE_KEY (DPAPI) / "
                 "SUPABASE_PUBLISHABLE_KEY (.env) both missing")
    supa = Supa(url=url, key=key)

    print(f"Gig album: {gig_album}")
    print(f"Loading setlist_entries from Supabase...")
    entries = [] if args.dry_run else supa.list_setlist_entries()
    if not args.dry_run:
        print(f"  loaded {len(entries)} entries")

    summary: dict[str, dict] = {}
    for song_dir in sorted(p for p in gig_folder.iterdir() if p.is_dir()):
        result = process_song(
            song_dir=song_dir,
            gig_album=gig_album,
            entries=entries,
            supa=supa,
            forced_label=args.version_label,
            upload=args.upload_to_supabase,
            dry_run=args.dry_run,
        )
        summary[song_dir.name] = result

    print("\n=== SUMMARY ===")
    for name, res in summary.items():
        if "skip" in res:
            print(f"  - {name}: skipped ({res['skip']})")
        else:
            row_kinds = ", ".join(r.get("format", r.get("dry", "?")) for r in res.get("rows", []))
            print(f"  + {name} → {res.get('title')}: {len(res.get('rows', []))} rows ({row_kinds})")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
