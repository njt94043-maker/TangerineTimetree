#!/usr/bin/env python3
"""Pull a gig's recordings from E6330 to D:\\Gigs\\<date>\\ on OptiPlex.

Run after any gig (or any Reaper recording session) on the E6330 — gathers the
WAVs, builds Windows-path .RPPs, and leaves you a folder you can open in Reaper
on this PC for post-production.

Usage:
    python pull-gig.py [DATE]
    python pull-gig.py                  # default: today's date
    python pull-gig.py 2026-05-15       # specific date

What it does (in order):
    1. SSHs to E6330 (tries Tailscale first, falls back to crossover)
    2. SCPs every WAV in `~/Documents/REAPER Media/` matching that date
       to `D:\\Gigs\\<date>\\audio\\`
    3. Groups WAVs by recording-session timestamp (the `_HHMM` suffix in filename)
    4. Writes one .RPP per session to `D:\\Gigs\\<date>\\` (using paths relative
       to `audio/`, so the project is portable)
    5. Prints the dest dir and the runtimes per session so you know which is the gig
"""
import argparse
import datetime
import re
import subprocess
import sys
import uuid
import wave
from pathlib import Path

# Try Tailscale first (over home WiFi or anywhere), fall back to crossover.
SSH_CANDIDATES = [
    "tangerine@e6330",            # MagicDNS over Tailscale
    "tangerine@100.114.170.70",   # Tailscale IP
    "tangerine@192.168.1.222",    # home WiFi (BT-22ACQ7)
    "tangerine@192.168.15.1",     # crossover
]

DEFAULT_DEST = Path(r"D:\Gigs")
REMOTE_MEDIA = "/home/tangerine/Documents/REAPER Media"


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("date", nargs="?", default=datetime.date.today().isoformat(),
                   help="YYYY-MM-DD (default: today)")
    p.add_argument("--dest", default=str(DEFAULT_DEST), help="dest root (default D:\\Gigs)")
    p.add_argument("--gig-name", default=None,
                   help="Specific rig gig dir to pull (~/Reaper/Gigs/<name>/). "
                        "Required when multiple gigs share the same date — the "
                        "default mtime+largest-RPP heuristic picks the wrong one. "
                        "When given, dest dir is named after the gig instead of "
                        "the date so a date with multiple gigs doesn't collide.")
    return p.parse_args()


def find_rig_gig_dir(host: str, date: str) -> str | None:
    """Find the ~/Reaper/Gigs/<name>/ dir whose mtime is on <date>.

    The orchestrator-arm path saves the project to <name>.rpp inside this
    dir; APK-time song markers persist there. pull-gig.py uses this to
    fetch the rig RPP as a sidecar marker source.

    Returns None if 0 dirs match. Returns largest-by-RPP-size if 2+ match
    (most likely the actual gig vs sound-check dirs).
    """
    cmd = [
        "ssh", "-o", "BatchMode=yes", host,
        # for each gig dir, print mtime YYYY-MM-DD + dirname + RPP size
        f"for d in ~/Reaper/Gigs/*/; do "
        f"  rpp=\"$d$(basename $d).rpp\"; "
        f"  [ -f \"$rpp\" ] || continue; "
        f"  mt=$(date -r \"$d\" +%Y-%m-%d); "
        f"  sz=$(stat -c %s \"$rpp\"); "
        f"  echo \"$mt $(basename $d) $sz\"; "
        f"done"
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    except Exception:
        return None
    if r.returncode != 0:
        return None
    matches: list[tuple[str, int]] = []
    for line in r.stdout.splitlines():
        parts = line.strip().split(None, 2)
        if len(parts) != 3:
            continue
        mt, name, sz = parts
        if mt == date:
            try:
                matches.append((name, int(sz)))
            except ValueError:
                continue
    if not matches:
        return None
    if len(matches) > 1:
        print(f"  multiple rig gig dirs on {date}, picking largest:")
        for n, s in matches:
            print(f"    {n}  ({s} bytes)")
        matches.sort(key=lambda t: t[1], reverse=True)
    return matches[0][0]


def scp_rig_rpp(host: str, gig_name: str, dest_path: Path) -> bool:
    """SCP ~/Reaper/Gigs/<gig_name>/<gig_name>.rpp to dest_path.

    Returns True on success. Used as marker source for build-postprod-rpp.py
    (the rig project preserves APK-set song markers at their absolute rig
    timeline positions).
    """
    remote = f"{host}:~/Reaper/Gigs/{gig_name}/{gig_name}.rpp"
    r = subprocess.run(
        ["scp", "-q", remote, str(dest_path)],
        capture_output=True, text=True, timeout=30,
    )
    return r.returncode == 0


def find_host():
    print("Looking for E6330 ...")
    for cand in SSH_CANDIDATES:
        try:
            r = subprocess.run(
                ["ssh", "-o", "ConnectTimeout=4", "-o", "BatchMode=yes",
                 "-o", "StrictHostKeyChecking=accept-new", cand, "echo ok"],
                capture_output=True, text=True, timeout=8,
            )
            if r.returncode == 0 and "ok" in r.stdout:
                print(f"  reached {cand}")
                return cand
        except Exception:
            pass
    sys.exit("ERROR: no SSH route to E6330 (tried Tailscale + home WiFi + crossover).\n"
             "If Tailscale tray icon isn't connected, click it → Reconnect.")


def scp_wavs(host: str, date: str, audio_dir: Path,
             gig_name: str | None = None) -> list[Path]:
    """SCP all WAVs for this gig.

    Two paths:
      - **gig-wizard era (S129+)**: when ``gig_name`` is supplied, recordings
        live inside the gig project's Media subdir
        (``~/Reaper/Gigs/<gig_name>/Media/*.wav``). This is where Reaper
        records since the gig wizard switches the project on arm.
      - **legacy** (pre-S129 / Reaper-default workflow): WAVs land in the
        global ``~/Documents/REAPER Media/`` and are matched by the date
        in their filename. Used as a fallback when no rig gig dir matches
        the date.
    """
    audio_dir.mkdir(parents=True, exist_ok=True)
    yymd = date[2:].replace("-", "")  # "2026-05-03" -> "260503"

    if gig_name:
        # gig-wizard path. Reaper writes WAVs as `01-01 TD-4 L-260509_1432.wav`
        # etc into the project's Media subdir; just copy them all.
        glob = f"~/Reaper/Gigs/{gig_name}/Media/*.wav"
        print(f"\nCopying WAVs from rig gig {gig_name}/Media/ ...")
    else:
        glob = f"{REMOTE_MEDIA}/*-{yymd}_*.wav"
        print(f"\nCopying WAVs matching {yymd}_*.wav from {REMOTE_MEDIA}/ (legacy) ...")

    r = subprocess.run(
        ["scp", "-q", f"{host}:{glob}", str(audio_dir)],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        # scp doesn't error on empty match, so a real error is something else
        sys.exit(f"scp failed:\n{r.stderr}")

    # Match WAVs by HHMM pattern (works for both source paths)
    wavs = sorted(audio_dir.glob(f"*-{yymd}_*.wav"))
    print(f"  {len(wavs)} WAVs in {audio_dir}")
    return wavs


def wav_length_sec(path: Path) -> float:
    try:
        with wave.open(str(path), "rb") as w:
            return w.getnframes() / w.getframerate()
    except Exception:
        return path.stat().st_size / 192000.0  # 32-bit float, 48 kHz, mono fallback


def guid() -> str:
    return "{" + str(uuid.uuid4()).upper() + "}"


def build_rpp(wavs: list[Path], dst: Path):
    """Write a .RPP that references audio via `audio\\<filename>` (relative)."""
    if not wavs:
        return
    length = wav_length_sec(wavs[0])

    track_blocks = []
    for i, w in enumerate(sorted(wavs, key=lambda p: int(p.stem.split("-")[0])), start=1):
        m = re.match(r"(\d+)-(\d+ [^-]+)-\d+_\d+", w.stem)
        track_name = m.group(2).strip() if m else w.stem
        track_guid = guid()
        item_guid = guid()
        rel_path = f"audio\\{w.name}"
        track_blocks.append(f"""  <TRACK {track_guid}
    NAME "{track_name}"
    PEAKCOL 16576
    BEAT -1
    AUTOMODE 0
    VOLPAN 1 0 -1 -1 1
    MUTESOLO 0 0 0
    IPHASE 0
    PLAYOFFS 0 1
    ISBUS 0 0
    BUSCOMP 0 0 0 0 0
    SHOWINMIX 1 0.6667 0.5 1 0.5 -1 -1 -1
    FREEMODE 0
    SEL 0
    REC 0 0 0 0 0 0 0 0
    VU 2
    TRACKHEIGHT 0 0 0 0 0 0 0 0
    INQ 0 0 0 0.5 100 0 0 100
    NCHAN 2
    FX 1
    TRACKID {track_guid}
    PERF 0
    MIDIOUT -1
    MAINSEND 1 0
    <ITEM
      POSITION 0
      LENGTH {length:.6f}
      LOOP 1
      ALLTAKES 0
      FADEIN 1 0.01 0 1 0 0 0
      FADEOUT 1 0.01 0 1 0 0 0
      MUTE 0 0
      SEL 0
      IGUID {item_guid}
      IID {i}
      NAME "{w.name}"
      VOLPAN 1 0 1 -1
      SOFFS 0
      PLAYRATE 1 1 0 -1 0 0.0025
      CHANMODE 0
      GUID {guid()}
      <SOURCE WAVE
        FILE "{rel_path}"
      >
    >
  >""")

    rpp = f"""<REAPER_PROJECT 0.1 "7.71/win-x86_64" 1746409200
  RIPPLE 0
  GROUPOVERRIDE 0 0 0
  AUTOXFADE 1
  ENVATTACH 1
  POOLEDENVATTACH 0
  MIXERUIFLAGS 11 48
  PEAKGAIN 1
  FEEDBACK 0
  PANLAW 1
  PROJOFFS 0 0 0
  MAXPROJLEN 0 600
  GRID 3199 8 1 8 1 0 0 0
  TIMEMODE 1 5 -1 30 0 0 -1
  VIDEO_CONFIG 0 0 256
  PANMODE 3
  CURSOR 0
  ZOOM 100 0 0
  VZOOMEX 6 0
  USE_REC_CFG 0
  RECMODE 1
  SMPTESYNC 0 30 100 40 1000 300 0 0 1 0 0
  LOOP 0
  LOOPGRAN 0 4
  RECORD_PATH "" ""
  <RECORD_CFG
  >
  <APPLYFX_CFG
  >
  RENDER_FILE ""
  RENDER_PATTERN ""
  RENDER_FMT 0 2 0
  RENDER_1X 0
  RENDER_RANGE 1 0 0 18 1000
  RENDER_RESAMPLE 3 0 1
  RENDER_ADDTOPROJ 0
  RENDER_STEMS 0
  RENDER_DITHER 0
  TIMELOCKMODE 1
  TEMPOENVLOCKMODE 1
  ITEMMIX 1
  DEFPITCHMODE 589824 0
  TAKELANE 1
  SAMPLERATE 48000 0 0
  <RENDER_CFG
  >
  LOCK 1
  GLOBAL_AUTO -1
  TEMPO 120 4 4
  PLAYRATE 1 0 0.25 4
  SELECTION 0 0
  SELECTION2 0 0
  MASTERAUTOMODE 0
  MASTERTRACKHEIGHT 0 0
  MASTERPEAKCOL 16576
  MASTERMUTESOLO 0
  MASTERTRACKVIEW 0 0.6667 0.5 0.5 0 -1 -1 -1
  MASTERHWOUT 0 0 1 0 0 0 0 -1
  MASTER_NCH 2 2
  MASTER_VOLUME 1 0 -1 -1 1
  MASTER_FX 1
  MASTER_SEL 0
{chr(10).join(track_blocks)}
>
"""
    dst.write_text(rpp, encoding="utf-8")


def main():
    args = parse_args()
    date = args.date
    if not re.match(r"\d{4}-\d{2}-\d{2}$", date):
        sys.exit(f"ERROR: bad date {date} (need YYYY-MM-DD)")

    dest_root = Path(args.dest)
    # When pulling a specific named gig, dest dir uses the gig name so two
    # gigs on the same date don't collide. Else use the date (legacy layout
    # still expected by build-postprod-rpp.py auto-detect).
    dest = dest_root / (args.gig_name if args.gig_name else date)
    audio = dest / "audio"

    host = find_host()

    if args.gig_name:
        rig_gig = args.gig_name
        print(f"Using explicitly-named rig gig: {rig_gig}")
    else:
        print("Looking for rig gig dir matching this date ...")
        rig_gig = find_rig_gig_dir(host, date)
        if rig_gig:
            print(f"  found: {rig_gig}")
        else:
            print(f"  none — falling back to ~/Documents/REAPER Media/ (legacy)")

    wavs = scp_wavs(host, date, audio, gig_name=rig_gig)
    if not wavs:
        sys.exit(f"No WAVs matched {date} on E6330 (rig gig + legacy paths both empty).")

    # Group by HHMM session timestamp
    by_ts: dict[str, list[Path]] = {}
    for w in wavs:
        m = re.search(r"_(\d{4})\.wav$", w.name)
        if m:
            by_ts.setdefault(m.group(1), []).append(w)

    print(f"\nBuilding RPPs ...")
    for ts in sorted(by_ts.keys()):
        group = by_ts[ts]
        length = wav_length_sec(group[0])
        rpp_path = dest / f"set-{ts}.RPP"
        build_rpp(group, rpp_path)
        mins = length / 60.0
        marker = " <-- gig" if length >= 60 * 30 else ""  # 30+ min => probably the gig
        print(f"  set-{ts}.RPP  ({len(group)} tracks, {mins:.1f}min){marker}")

    # F1: fetch the rig project's .rpp as a sidecar so markers Nathan dropped
    # via APK Gig Mode survive the pull. The rig project at
    # ~/Reaper/Gigs/<name>/<name>.rpp persists the markers via the orchestrator
    # save (which song-marker-listener.lua's AddProjectMarker2 calls feed
    # into). Without this, build-postprod-rpp.py only sees set RPPs that were
    # synthesised from WAVs — zero markers.
    print("\nFetching rig project file (marker source) ...")
    if rig_gig:
        rig_dest = dest / "rig-source.rpp"
        if scp_rig_rpp(host, rig_gig, rig_dest):
            size_kb = rig_dest.stat().st_size // 1024
            print(f"  pulled rig RPP: {rig_gig}/{rig_gig}.rpp -> rig-source.rpp ({size_kb} KB)")
            print(f"  -> build-postprod-rpp.py will lift markers from it")
        else:
            print(f"  WARN: SCP failed for {rig_gig}.rpp — markers won't be available")
    else:
        print(f"  no rig gig dir for {date} — markers won't be available")
        print(f"  (post-prod set markers will be auto-named 'Set N'; no song markers)")

    print(f"\nDONE. Open from {dest}\\")
    print("All .RPPs use relative paths (audio/...), so you can move the whole folder.")


if __name__ == "__main__":
    main()
