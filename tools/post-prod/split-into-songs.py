#!/usr/bin/env python3
"""Split a post-prod .RPP into per-song derivative .RPPs (Path B).

Use AFTER you've opened a `*-postprod.RPP` in Reaper, set up your bus
chains/levels, and either reviewed the markers the APK dropped during the
gig OR dropped your own (Insert > Region per song / Insert > Marker).

For each song span, this writes a copy of the project where every audio
item is time-windowed to that span's start/end. The new RPP opens with
all 18ch + buses identical to the parent, but the timeline shows only
that one song.

How song spans are derived (in priority order):
  1. **Regions** — if the RPP has paired Region markers (legacy
     pre-S129 hand-mix workflow), each region is one song.
  2. **Point markers** — the APK Gig Mode marker pipeline
     (OrchestratorService.sendSongMarker -> song-marker-listener.lua)
     drops a single point marker per song-start, named with the song
     title. Each marker is a song-start anchor; the song ends at the
     NEXT marker's position, or project end (= max POSITION+LENGTH
     across items) for the last one.

     Markers matching `^Set \\d+$` are set-boundary delimiters per the
     APK contract (BREAK -> continueNewSet emits "Set N") — they
     hard-stop the previous song and do NOT produce their own RPP.

Output: `<source_dir>/songs/<song-name>.RPP`

Usage:
    python split-into-songs.py <source.RPP>

Notes:
  - Span names are slugified for filenames; duplicates get a numeric suffix.
  - Item bounds are clipped: a span from 30s-90s on a 60s item starting
    at POSITION=0 ends up as POSITION=0, SOFFS=30, LENGTH=60 (clamped).
"""
from __future__ import annotations
import re
import sys
from pathlib import Path

# MARKER <id> <pos> <name> <flags> <color> ...
# Reaper writes the name unquoted when it has no spaces (e.g. "Encore"); when
# the name has spaces or special chars it's wrapped in double quotes. We need
# both shapes. is_region (`flags` here) is the digit immediately after the
# name field — 1 for a region edge, 0 for a point marker.
MARKER_RE = re.compile(
    r'^\s*MARKER\s+(?P<id>\d+)\s+(?P<pos>[\d.]+)\s+'
    r'(?:"(?P<qname>[^"]*)"|(?P<bname>\S+))'
    r'\s+(?P<is_region>\d)',
    re.MULTILINE,
)

# Per OrchestratorService.kt continueNewSet: APK fires set-boundary markers
# named literally "Set 1", "Set 2", etc. These are delimiters, not songs.
SET_BOUNDARY_RE = re.compile(r'^Set \d+$')


def _marker_name(m: re.Match) -> str:
    return m.group("qname") if m.group("qname") is not None else m.group("bname")


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
        by_id.setdefault(rid, []).append((float(m.group("pos")), _marker_name(m)))

    regions: list[tuple[str, float, float]] = []
    for rid, entries in sorted(by_id.items()):
        if len(entries) != 2:
            continue
        entries.sort()  # by position
        (t1, n1), (t2, n2) = entries
        name = n1 or n2 or f"region-{rid}"
        regions.append((name, t1, t2))
    return regions


def find_point_markers(rpp_text: str) -> list[tuple[float, str]]:
    """Return [(pos, name)] for every point marker, sorted by position.

    Excludes region edges (is_region=1 lines).
    """
    out: list[tuple[float, str]] = []
    for m in MARKER_RE.finditer(rpp_text):
        if int(m.group("is_region")) == 1:
            continue
        out.append((float(m.group("pos")), _marker_name(m)))
    out.sort(key=lambda t: t[0])
    return out


# Items have POSITION + LENGTH lines somewhere in the <ITEM ...> block
ITEM_POS_LEN_RE = re.compile(
    r"^\s*POSITION\s+(?P<pos>[\d.]+).*?^\s*LENGTH\s+(?P<len>[\d.]+)",
    re.MULTILINE | re.DOTALL,
)


def infer_project_end(rpp_text: str) -> float:
    """Compute project end as max(item.POSITION + item.LENGTH) across all items.

    The RPP file format doesn't store an authoritative project length; Reaper
    derives it from item bounds. We do the same so the last song's span has
    a sensible end.
    """
    end = 0.0
    # Need to bound POSITION+LENGTH search to a single ITEM block to avoid
    # matching POSITION from one item with LENGTH from another. Walk ITEM
    # blocks one at a time using the existing ITEM_RE.
    for m in ITEM_RE.finditer(rpp_text):
        block = m.group(0)
        pos_m = re.search(r"^\s*POSITION\s+([\d.]+)", block, re.MULTILINE)
        len_m = re.search(r"^\s*LENGTH\s+([\d.]+)", block, re.MULTILINE)
        if pos_m and len_m:
            try:
                end = max(end, float(pos_m.group(1).split()[0]) + float(len_m.group(1).split()[0]))
            except ValueError:
                continue
    return end


def find_song_spans(rpp_text: str) -> tuple[str, list[tuple[str, float, float]]]:
    """Return (mode, [(name, start, end)]) for the songs to split out.

    mode is "regions" or "markers" (informational — printed by main()).

    Priority:
      1. Regions, if any (legacy hand-mix workflow).
      2. Point markers — APK Gig Mode contract. Names matching `^Set \\d+$`
         hard-stop the previous song but produce no RPP of their own.
    """
    regions = find_regions(rpp_text)
    if regions:
        return "regions", regions

    markers = find_point_markers(rpp_text)
    if not markers:
        return "markers", []

    project_end = infer_project_end(rpp_text)
    spans: list[tuple[str, float, float]] = []
    for i, (pos, name) in enumerate(markers):
        is_set_boundary = bool(SET_BOUNDARY_RE.match(name))
        # Set-boundary markers are delimiters: skip them as their own song,
        # but they still serve as the next-marker for the song before them.
        if is_set_boundary:
            continue
        # End is the NEXT marker (whichever kind), or project end.
        end = markers[i + 1][0] if i + 1 < len(markers) else project_end
        spans.append((name, pos, end))
    return "markers", spans


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
    mode, spans = find_song_spans(text)
    if not spans:
        sys.exit(
            "No song markers or regions found in source RPP.\n"
            "Either: (1) play a gig with the APK Gig Mode prompter (markers fire\n"
            "automatically per song-start via song-marker-listener.lua), or\n"
            "(2) open the RPP in Reaper and Insert > Marker / Region per song.\n"
        )

    print(f"Source: {src.name}")
    print(f"Mode:   {mode}  ({len(spans)} song{'s' if len(spans) != 1 else ''})")
    for name, s, e in spans:
        print(f"  {name:30s}  {s:7.2f}  ->  {e:7.2f}  ({e-s:.2f}s)")

    header, tracks, footer = split_blocks(text)

    out_dir = src.parent / "songs"
    out_dir.mkdir(exist_ok=True)

    for name, s, e in spans:
        out = write_song_rpp(src, header, tracks, footer, name, s, e, out_dir)
        print(f"  wrote: {out.name}")

    print(f"\nDone. Per-song RPPs at: {out_dir}")


if __name__ == "__main__":
    main()
