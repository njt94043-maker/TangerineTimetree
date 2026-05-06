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
    return p.parse_args()


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


def scp_wavs(host: str, date: str, audio_dir: Path) -> list[Path]:
    """SCP every WAV in REAPER Media matching the date prefix."""
    audio_dir.mkdir(parents=True, exist_ok=True)
    yymd = date[2:].replace("-", "")  # "2026-05-03" -> "260503"
    glob = f"{REMOTE_MEDIA}/*-{yymd}_*.wav"
    print(f"\nCopying WAVs matching {yymd}_*.wav ...")
    r = subprocess.run(["scp", "-q", f"{host}:{glob}", str(audio_dir)], capture_output=True, text=True)
    if r.returncode != 0:
        # Empty match isn't a python error from scp, but other failures are
        sys.exit(f"scp failed:\n{r.stderr}")
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
    dest = dest_root / date
    audio = dest / "audio"

    host = find_host()
    wavs = scp_wavs(host, date, audio)
    if not wavs:
        sys.exit(f"No WAVs matched {date} on E6330 (REAPER Media empty for that date).")

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

    print(f"\nDONE. Open from {dest}\\")
    print("All .RPPs use relative paths (audio/...), so you can move the whole folder.")


if __name__ == "__main__":
    main()
