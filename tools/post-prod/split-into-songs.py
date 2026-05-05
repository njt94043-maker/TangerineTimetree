#!/usr/bin/env python3
"""Split a post-prod .RPP into per-song derivative .RPPs (Path B).

Use AFTER you've opened a `*-postprod.RPP` in Reaper, set up your bus
chains/levels, and dropped a Region per song (Insert > Region, give it a name).

For each Region in the source RPP, this writes a copy of the project where
every audio item is time-windowed to that region's start/end. The new RPP
opens with all 18ch + buses identical to the parent, but the timeline shows
only that one song. You can then tweak levels/FX per song without affecting
the others.

Output: `<source_dir>/songs/<region-name>.RPP`

Usage:
    python split-into-songs.py <source.RPP>
    python split-into-songs.py D:/Gigs/2026-05-03/set-260503_2013-postprod.RPP

Notes:
  - Only `<MARKER>` lines with `is_region=1` are processed (markers are ignored).
  - Region names are slugified for filenames; duplicates get a numeric suffix.
  - Item bounds are clipped: a region from 30s-90s on a 60s item starting
    at POSITION=0 ends up as POSITION=0, SOFFS=30, LENGTH=60 (clamped).
"""
from __future__ import annotations
import re
import sys
from pathlib import Path

# MARKER <id> <pos_seconds> "<name>" <is_region:0|1> ...
MARKER_RE = re.compile(
    r'^\s*MARKER\s+(?P<id>\d+)\s+(?P<pos>[\d.]+)\s+"(?P<name>[^"]*)"\s+(?P<is_region>\d)',
    re.MULTILINE,
)


def slugify(name: str) -> str:
    s = re.sub(r"[^\w\s-]", "", name).strip().lower()
    s = re.sub(r"[-\s]+", "-", s)
    return s or "song"


def find_regions(rpp_text: str) -> list[tuple[str, float, float]]:
    """Return list of (name, start, end) for each region defined in the RPP.

    Reaper writes a region as two MARKER lines with the same id: first has
    name, second has empty name (the closing edge).
    """
    by_id: dict[int, list[tuple[float, str]]] = {}
    for m in MARKER_RE.finditer(rpp_text):
        if int(m.group("is_region")) != 1:
            continue
        rid = int(m.group("id"))
        by_id.setdefault(rid, []).append((float(m.group("pos")), m.group("name")))

    regions: list[tuple[str, float, float]] = []
    for rid, entries in sorted(by_id.items()):
        if len(entries) != 2:
            continue
        entries.sort()  # by position
        (t1, n1), (t2, n2) = entries
        name = n1 or n2 or f"region-{rid}"
        regions.append((name, t1, t2))
    return regions


def split_blocks(rpp_text: str) -> tuple[str, list[str], str]:
    """Split into (header, list of top-level <TRACK> blocks, footer)."""
    lines = rpp_text.splitlines(keepends=True)
    track_starts: list[int] = []
    depth = 0
    for i, line in enumerate(lines):
        s = line.strip()
        if s.startswith("<TRACK ") and depth == 1:
            track_starts.append(i)
        if s.startswith("<"):
            depth += 1
        elif s == ">":
            depth -= 1

    if not track_starts:
        raise ValueError("No <TRACK> blocks found")

    track_ends: list[int] = []
    for start in track_starts:
        d = 0
        for j in range(start, len(lines)):
            s = lines[j].strip()
            if s.startswith("<"):
                d += 1
            elif s == ">":
                d -= 1
                if d == 0:
                    track_ends.append(j + 1)
                    break

    header = "".join(lines[: track_starts[0]])
    blocks = ["".join(lines[s:e]) for s, e in zip(track_starts, track_ends)]
    footer = "".join(lines[track_ends[-1]:])
    return header, blocks, footer


# ITEM block (single, indented under track)
ITEM_RE = re.compile(
    r"(?P<indent>^ {4})<ITEM\n(?P<body>(?:.*?\n)*?\1>\n)",
    re.MULTILINE,
)


def windowed_item(item_block: str, region_start: float, region_end: float) -> str | None:
    """Rewrite an <ITEM ...> block to span only [region_start, region_end] of source.

    Returns None if the item doesn't overlap the region (caller should drop it).
    Assumes original POSITION=0 SOFFS=0 (true for raw-recording items).
    """
    def get(name: str, default=None) -> str | None:
        m = re.search(rf"^\s*{name}\s+(.+)$", item_block, re.MULTILINE)
        return m.group(1).strip() if m else default

    pos    = float(get("POSITION", "0").split()[0])
    length = float(get("LENGTH",   "0").split()[0])
    soffs_raw = get("SOFFS", "0")
    # SOFFS can be "<seconds>" OR "<seconds> <fraction>"
    soffs  = float(soffs_raw.split()[0])

    item_start = pos
    item_end   = pos + length

    # Compute overlap on PROJECT timeline
    new_start = max(item_start, region_start)
    new_end   = min(item_end,   region_end)
    if new_end <= new_start:
        return None

    new_position = 0.0   # song timeline starts at 0
    new_length   = new_end - new_start
    # SOFFS shifts by how much we cropped from the front
    new_soffs    = soffs + (new_start - item_start)

    # Patch the lines
    out = re.sub(
        r"^(\s*)POSITION .+$",
        lambda m: f"{m.group(1)}POSITION {new_position:.6f}",
        item_block, count=1, flags=re.MULTILINE,
    )
    out = re.sub(
        r"^(\s*)LENGTH .+$",
        lambda m: f"{m.group(1)}LENGTH {new_length:.6f}",
        out, count=1, flags=re.MULTILINE,
    )
    out = re.sub(
        r"^(\s*)SOFFS .+$",
        lambda m: f"{m.group(1)}SOFFS {new_soffs:.6f}",
        out, count=1, flags=re.MULTILINE,
    )
    return out


def window_track(track_block: str, region_start: float, region_end: float) -> str:
    """Rewrite all ITEM blocks in a track to span the given region; drop non-overlapping."""
    out_parts: list[str] = []
    cursor = 0
    for m in ITEM_RE.finditer(track_block):
        out_parts.append(track_block[cursor : m.start()])
        windowed = windowed_item(m.group(0), region_start, region_end)
        if windowed is not None:
            out_parts.append(windowed)
        cursor = m.end()
    out_parts.append(track_block[cursor:])
    return "".join(out_parts)


def write_song_rpp(
    source_path: Path,
    header: str,
    tracks: list[str],
    footer: str,
    name: str,
    start: float,
    end: float,
    out_dir: Path,
) -> Path:
    new_tracks = [window_track(t, start, end) for t in tracks]

    # Strip MARKER lines from header (per-song RPP shouldn't carry parent regions)
    new_header = re.sub(r"^\s*MARKER .+\n", "", header, flags=re.MULTILINE)
    # Annotate filename in NOTES
    new_header = re.sub(
        r"(<NOTES 0 2\n)",
        lambda m: m.group(1) + f"    |\n    |  PER-SONG SLICE: {name}  ({start:.2f}s - {end:.2f}s)\n",
        new_header, count=1,
    )

    slug = slugify(name)
    out_path = out_dir / f"{slug}.RPP"
    n = 1
    while out_path.exists():
        n += 1
        out_path = out_dir / f"{slug}-{n}.RPP"

    out_path.write_text(new_header + "".join(new_tracks) + footer, encoding="utf-8")
    return out_path


def main() -> None:
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    src = Path(sys.argv[1]).resolve()
    if not src.exists():
        sys.exit(f"ERROR: {src} not found")

    text = src.read_text(encoding="utf-8")
    regions = find_regions(text)
    if not regions:
        sys.exit(
            "No regions found in source RPP.\n"
            "Open it in Reaper, select a range and Insert > Region (or use the Region\n"
            "Marker Manager) to create one region per song. Save and re-run.\n"
        )

    print(f"Source: {src.name}")
    print(f"Regions: {len(regions)}")
    for name, s, e in regions:
        print(f"  {name:30s}  {s:7.2f}  ->  {e:7.2f}  ({e-s:.2f}s)")

    header, tracks, footer = split_blocks(text)

    out_dir = src.parent / "songs"
    out_dir.mkdir(exist_ok=True)

    for name, s, e in regions:
        out = write_song_rpp(src, header, tracks, footer, name, s, e, out_dir)
        print(f"  wrote: {out.name}")

    print(f"\nDone. Per-song RPPs at: {out_dir}")


if __name__ == "__main__":
    main()
