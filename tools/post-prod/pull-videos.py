#!/usr/bin/env python3
"""Pull phone-recorded gig videos from connected Android devices via adb.

S148: video -> Reaper from PWA chain. Companion to pull-gig.py (which pulls
audio from E6330). This script runs on OptiPlex and uses adb to copy mp4s
recorded by the TGT Android APK (orchestrator + peer).

Usage:
    python pull-videos.py <gig-dir>
    python pull-videos.py D:/Gigs/Beddau-RFC-pretty-gig-test-1/
    python pull-videos.py D:/Gigs/Beddau-RFC-pretty-gig-test-1/ --since 2026-05-09

What it does:
    1. Runs `adb devices` to enumerate phones on USB / adb-over-tcp
    2. For each device, queries the model name (e.g. SM-S911B)
    3. For each device, looks in BOTH:
         /sdcard/Android/data/com.thegreentangerine.gigbooks/files/orchestrator_recordings/
         /sdcard/Android/data/com.thegreentangerine.gigbooks/files/peer_recordings/
       -- these are the externalFilesDir paths post-S148 APK update.
    4. Copies each mp4 to <gig-dir>/video/<model>/<filename>.mp4
    5. Emits PROGRESS lines on stdout so the MS host can show a progress bar.

The companion ReaScript `insert-videos.lua` then walks that <gig-dir>/video/
tree and adds VIDEO items to the open Reaper project (one track per device).

Pre-requisites:
    - adb on PATH (Android SDK platform-tools)
    - Phone connected via USB or adb-over-tcp; "USB debugging" enabled
    - Phone authorised for this PC (one-time prompt on phone)
    - APK using externalFilesDir for video output (S148 APK change). If APK
      still uses internal filesDir, this script will report "no videos found"
      and the chain doesn't work end-to-end until the APK ships.

PROGRESS line format (read by MS host RunPythonScriptAsync):
    PROGRESS: <0..1> <message>
"""
from __future__ import annotations

import argparse
import datetime
import re
import subprocess
import sys
from pathlib import Path

PACKAGE = "com.thegreentangerine.gigbooks"
REMOTE_DIRS = [
    f"/sdcard/Android/data/{PACKAGE}/files/orchestrator_recordings",
    f"/sdcard/Android/data/{PACKAGE}/files/peer_recordings",
]


def parse_args():
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("gig_dir", help="Local gig dir (e.g. D:/Gigs/<name>/)")
    p.add_argument(
        "--since", default=None,
        help="YYYY-MM-DD; only pull files modified on/after this date. "
             "Useful when a phone has older mp4s from prior gigs you don't "
             "want re-pulled. Default: pull everything.")
    p.add_argument(
        "--device", default=None,
        help="Limit pull to one adb serial (use `adb devices` to see them). "
             "Default: pull from every connected device.")
    p.add_argument(
        "--adb", default="adb",
        help="Path to adb executable. Default 'adb' (must be on PATH).")
    return p.parse_args()


def progress(pct: float, msg: str) -> None:
    pct = max(0.0, min(1.0, pct))
    print(f"PROGRESS: {pct:.3f} {msg}", flush=True)


def adb_run(adb: str, args: list[str], serial: str | None = None,
            timeout: float = 60.0) -> subprocess.CompletedProcess:
    """Run an adb command. Returns CompletedProcess (caller checks returncode)."""
    cmd = [adb]
    if serial:
        cmd += ["-s", serial]
    cmd += args
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def list_devices(adb: str) -> list[str]:
    """Return adb serials of connected, authorised devices.

    Filters out 'unauthorized' and 'offline' states -- only returns serials
    that adb sees as state 'device'. `adb devices` output looks like:
        List of devices attached
        R5CT70ABCD\tdevice
        emulator-5554\tunauthorized
    """
    r = adb_run(adb, ["devices"])
    if r.returncode != 0:
        sys.exit(f"adb devices failed:\n{r.stderr}")
    serials: list[str] = []
    for line in r.stdout.splitlines()[1:]:  # skip "List of devices attached" header
        parts = line.split("\t")
        if len(parts) == 2 and parts[1].strip() == "device":
            serials.append(parts[0].strip())
    return serials


def device_model(adb: str, serial: str) -> str:
    """Return ro.product.model (e.g. 'SM-S911B'). Sanitised for filesystem use."""
    r = adb_run(adb, ["shell", "getprop", "ro.product.model"], serial=serial,
                timeout=10.0)
    raw = r.stdout.strip() if r.returncode == 0 else serial
    # Sanitise: dir name lives at <gig>/video/<model>/. Strip anything that
    # isn't safe for a Windows path component.
    return re.sub(r"[^A-Za-z0-9._-]+", "_", raw) or serial


def list_remote_mp4s(adb: str, serial: str, remote_dir: str
                     ) -> list[tuple[str, int]]:
    """Return [(remote_path, mtime_epoch), ...] for mp4s in remote_dir.

    Uses `adb shell ls -l --time-style=+%s` for a parsable mtime. Returns
    an empty list if the directory doesn't exist (a phone hasn't been used
    in either orchestrator OR peer mode -> that dir is missing, expected).
    """
    # `find` works around `ls` quirks across vendor shells; also returns full
    # paths which we can pass to `adb pull` directly. -printf gives mtime.
    cmd = [
        "shell",
        f"if [ -d \"{remote_dir}\" ]; then "
        f"  for f in \"{remote_dir}\"/*.mp4; do "
        f"    [ -f \"$f\" ] || continue; "
        f"    mt=$(stat -c %Y \"$f\" 2>/dev/null || echo 0); "
        f"    sz=$(stat -c %s \"$f\" 2>/dev/null || echo 0); "
        f"    echo \"$mt $sz $f\"; "
        f"  done; "
        f"fi"
    ]
    r = adb_run(adb, cmd, serial=serial, timeout=20.0)
    if r.returncode != 0:
        return []
    out: list[tuple[str, int]] = []
    for line in r.stdout.splitlines():
        parts = line.strip().split(None, 2)
        if len(parts) < 3:
            continue
        try:
            mt = int(parts[0])
        except ValueError:
            continue
        path = parts[2]
        out.append((path, mt))
    return out


def adb_pull(adb: str, serial: str, remote: str, local: Path) -> None:
    """SCP-like copy via adb. Raises on non-zero exit."""
    local.parent.mkdir(parents=True, exist_ok=True)
    r = adb_run(adb, ["pull", remote, str(local)], serial=serial,
                timeout=600.0)  # 10min ceiling for ~5GB files
    if r.returncode != 0:
        raise RuntimeError(f"adb pull failed for {remote}:\n{r.stderr.strip()}")


def main() -> None:
    args = parse_args()
    gig_dir = Path(args.gig_dir)
    if not gig_dir.is_dir():
        sys.exit(f"ERROR: gig dir does not exist: {gig_dir}")

    since_epoch: int | None = None
    if args.since:
        if not re.match(r"\d{4}-\d{2}-\d{2}$", args.since):
            sys.exit(f"ERROR: bad --since {args.since!r} (need YYYY-MM-DD)")
        since_epoch = int(datetime.datetime.fromisoformat(
            args.since + "T00:00:00").timestamp())

    progress(0.02, "looking for adb devices...")
    serials = list_devices(args.adb)
    if args.device:
        if args.device not in serials:
            sys.exit(f"ERROR: device {args.device!r} not connected/authorised "
                     f"(found: {serials or 'none'})")
        serials = [args.device]
    if not serials:
        sys.exit("ERROR: no adb devices connected/authorised. "
                 "Plug phones into OptiPlex via USB and accept the "
                 "'Allow USB debugging' prompt on each.")

    progress(0.05, f"found {len(serials)} device(s): {', '.join(serials)}")

    # Plan everything before pulling so we can render progress accurately.
    # plan: list of (serial, model, remote_path, local_path, size_bytes)
    plan: list[tuple[str, str, str, Path, int]] = []
    for serial in serials:
        model = device_model(args.adb, serial)
        device_dir = gig_dir / "video" / model
        for remote_dir in REMOTE_DIRS:
            for remote_path, mt in list_remote_mp4s(args.adb, serial, remote_dir):
                if since_epoch is not None and mt < since_epoch:
                    continue
                fname = remote_path.rsplit("/", 1)[-1]
                local_path = device_dir / fname
                plan.append((serial, model, remote_path, local_path, 0))

    if not plan:
        progress(1.0, "no videos to pull")
        print("DONE: 0 videos pulled (no mp4s matched on any device).")
        # Common cause: APK still writes to internal filesDir (S148 APK change
        # not yet applied). Surface that explicitly so it's not silent.
        print(f"  hint: confirm APK >= S148 (writes to "
              f"/sdcard/Android/data/{PACKAGE}/files/) -- pre-S148 APKs use "
              f"private filesDir which adb cannot read on release builds.")
        return

    progress(0.10, f"plan: {len(plan)} mp4 file(s) across {len(serials)} device(s)")

    pulled = 0
    failed: list[tuple[str, str]] = []
    for i, (serial, model, remote_path, local_path, _sz) in enumerate(plan):
        # Progress band: 0.10 -> 0.95 spread evenly across files.
        pct = 0.10 + 0.85 * (i / max(1, len(plan)))
        progress(pct, f"pulling {model}/{local_path.name} ({i + 1}/{len(plan)})")
        try:
            adb_pull(args.adb, serial, remote_path, local_path)
            pulled += 1
        except Exception as e:
            failed.append((remote_path, str(e)))

    progress(1.0, f"pulled {pulled}/{len(plan)} mp4(s)")
    if failed:
        print(f"FAILED ({len(failed)}):")
        for path, err in failed:
            print(f"  {path}: {err}")
        sys.exit(1)
    print(f"DONE: {pulled} video(s) -> {gig_dir}/video/")


if __name__ == "__main__":
    main()
