#!/usr/bin/env python3
"""Rewrite Linux-path .RPP files for opening on Windows (this OptiPlex).

Takes the .RPPs originally built on E6330 (with `/home/tangerine/Documents/REAPER Media/...`
paths) and writes new versions with paths relative to the Windows project location, so
Reaper on Windows can find the audio without "missing media" prompts.

Layout assumed:
    <ROOT>/<date>/
      audio/                       <-- WAVs synced from E6330
      rpps-original/               <-- original .RPPs from E6330 (linux paths)
      *.RPP                        <-- output: rewritten, audio/<wav> relative paths

Usage:
    python rewrite-rpps-for-windows.py [--date YYYY-MM-DD] [--root D:/Gigs]

Default date = newest dated subdir under <root>.
"""
import argparse
import re
import sys
from pathlib import Path


# Match: FILE "/home/tangerine/Documents/REAPER Media/<filename>"
LINUX_PATH_PATTERN = re.compile(r'FILE\s+"/home/tangerine/Documents/REAPER Media/([^"]+)"')


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--date", default=None, help="YYYY-MM-DD; default = newest dir under --root")
    p.add_argument("--root", default="D:/Gigs", help="Gigs root (default D:/Gigs)")
    return p.parse_args()


def newest_date_dir(root: Path) -> str:
    candidates = [d.name for d in root.iterdir() if d.is_dir() and re.match(r"\d{4}-\d{2}-\d{2}$", d.name)]
    if not candidates:
        sys.exit(f"ERROR: no YYYY-MM-DD dirs under {root}")
    return sorted(candidates)[-1]


def rewrite(src: Path, dst: Path, audio_dir_name: str = "audio") -> int:
    """Read src .RPP, replace linux paths with `<audio>/<filename>` relative, write dst.
    Returns count of paths rewritten."""
    text = src.read_text(encoding="utf-8")
    count = 0

    def replace(m):
        nonlocal count
        count += 1
        # Reaper accepts forward slashes on Windows too, but use backslashes to be safe.
        return f'FILE "{audio_dir_name}\\{m.group(1)}"'

    new_text = LINUX_PATH_PATTERN.sub(replace, text)
    dst.write_text(new_text, encoding="utf-8")
    return count


def main():
    args = parse_args()
    root = Path(args.root)
    if not root.exists():
        sys.exit(f"ERROR: --root {root} does not exist")
    date = args.date or newest_date_dir(root)
    base = root / date
    print(f"Rewriting RPPs for {base}")

    src_dir = base / "rpps-original"
    if not src_dir.exists():
        sys.exit(f"ERROR: {src_dir} not found (run the sync first)")

    audio_dir = base / "audio"
    if not audio_dir.exists():
        sys.exit(f"ERROR: {audio_dir} not found (audio sync incomplete)")

    rpps = sorted(src_dir.glob("*.RPP"))
    if not rpps:
        sys.exit(f"ERROR: no .RPP files in {src_dir}")

    for src in rpps:
        # Drop the long timestamp from filename for readability
        # gig-2026-05-03-set-260503_1814.RPP  ->  set-260503_1814.RPP
        stem = src.stem
        clean = re.sub(r"^gig-\d{4}-\d{2}-\d{2}-", "", stem)
        dst = base / f"{clean}.RPP"
        n = rewrite(src, dst, "audio")
        print(f"  {dst.name}  ({n} audio paths rewritten)")

    print(f"\nDONE. Open from {base}\\")
    print("Reaper looks for audio in `audio\\` relative to the .RPP — both must be at the same level.")


if __name__ == "__main__":
    main()
