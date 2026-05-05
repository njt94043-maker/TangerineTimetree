#!/usr/bin/env python3
"""Wrap one OR multiple per-set Reaper projects (from pull-gig.py) into a
post-prod project.

Single-set mode (one input):
    python build-postprod-rpp.py D:/Gigs/2026-05-03/set-260503_2013.RPP
    -> writes set-260503_2013-postprod.RPP next to source

Whole-gig mode (multiple inputs, given in chronological order):
    python build-postprod-rpp.py \
        D:/Gigs/2026-05-03/set-260503_1814.RPP \
        D:/Gigs/2026-05-03/set-260503_1916.RPP \
        D:/Gigs/2026-05-03/set-260503_2013.RPP
    -> writes 2026-05-03-whole-gig-postprod.RPP in the parent dir
       Each source's items are concatenated in time, with a MARKER at
       each set boundary ("Set 1", "Set 2", "Encore", "Set 4", ...).

Folder-mode shortcut (whole-gig, auto-detect 3+ longest sets):
    python build-postprod-rpp.py D:/Gigs/2026-05-03 --whole-gig

What it adds either way:
  - 6 instrument-group folder buses (Music / Vox / Guitar / Bass / Drums / Practice)
  - MAINSEND=0 on every bus child (so audio flows ONLY through the bus, not
    double-routed to master); MAINSEND=1 retained on bus parents and standalone tracks
  - Render preset writing to `mixdowns\\$project-$region.wav` at 24-bit / 48kHz
  - NOTES block describing the post-prod workflow
"""
from __future__ import annotations
import argparse
import re
import sys
import uuid
from pathlib import Path

CH_BUS = {
    1: "Music", 2: "Music",
    3: "Vox",   4: "Vox",
    5: None,            # Adam Guitar — standalone (single-ch bus is pointless)
    6: None,            # Neil Bass — standalone
    7: None,            # Spare
    8: "EAD",   9: "EAD",                              # Yamaha EAD — own bus
    10: "Drums", 11: "Drums", 12: "Drums", 13: "Drums",
    14: "Drums", 15: "Drums", 16: "Drums",             # acoustic kit only
    17: "Practice", 18: "Practice",
}

# None-group (ch 5, 6, 7) sits between Vox and EAD in display order
BUS_ORDER = ["Music", "Vox", None, "EAD", "Drums", "Practice"]

BUS_COLOR = {
    "Music":    0x9CBC1A,   # teal
    "Vox":      0xF39C12,   # orange
    "EAD":      0xC080FF,   # purple (e-drums)
    "Drums":    0xFF80AA,   # pink (acoustic kit)
    "Practice": 0x404040,   # dark grey (muted)
}

# How many longest sets to combine in --whole-gig auto-detect mode
WHOLE_GIG_MIN_SETS = 1
WHOLE_GIG_MIN_LENGTH_SECONDS = 60.0  # ignore <60s sets (test/sound-check recordings)


def guid() -> str:
    return "{" + str(uuid.uuid4()).upper() + "}"


# ----------------------------------------------------------------------------
# RPP parsing helpers
# ----------------------------------------------------------------------------
def split_header_and_tracks(rpp_text: str) -> tuple[str, list[str], str]:
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
        raise ValueError("No <TRACK> blocks found in source RPP")

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


def channel_of(track_block: str) -> int | None:
    m = re.search(r'NAME\s+"(\d+)\s', track_block)
    if m:
        return int(m.group(1))
    return None


def set_isbus(track_block: str, isbus_line: str) -> str:
    return re.sub(r"^( *)ISBUS [^\n]*$",
                  lambda m: f"{m.group(1)}{isbus_line}",
                  track_block, count=1, flags=re.MULTILINE)


def set_mute(track_block: str, muted: bool) -> str:
    flag = 1 if muted else 0
    return re.sub(r"^( *)MUTESOLO [^\n]*$",
                  lambda m: f"{m.group(1)}MUTESOLO {flag} 0 0",
                  track_block, count=1, flags=re.MULTILINE)


def set_mainsend(track_block: str, enabled: bool) -> str:
    """Set MAINSEND first arg (0=disabled, 1=enabled). Preserves channel offset."""
    flag = 1 if enabled else 0
    return re.sub(r"^( *)MAINSEND \d+ (\d+)$",
                  lambda m: f"{m.group(1)}MAINSEND {flag} {m.group(2)}",
                  track_block, count=1, flags=re.MULTILINE)


# Match each <ITEM ...> block at depth 1 within a track
ITEM_RE = re.compile(
    r"(?P<indent>^ {4})<ITEM\n(?P<body>(?:.*?\n)*?\1>\n)",
    re.MULTILINE,
)


def get_items(track_block: str) -> list[str]:
    return [m.group(0) for m in ITEM_RE.finditer(track_block)]


def replace_items(track_block: str, new_items: list[str]) -> str:
    """Drop existing <ITEM> blocks, insert new_items just before the closing track >."""
    stripped = ITEM_RE.sub("", track_block)
    # Insert before the final closing `>` of the track block
    lines = stripped.splitlines(keepends=True)
    insert_at = len(lines) - 1
    while insert_at >= 0 and lines[insert_at].strip() != ">":
        insert_at -= 1
    if insert_at < 0:
        raise ValueError("Track block has no closing >")
    return "".join(lines[:insert_at]) + "".join(new_items) + "".join(lines[insert_at:])


def shift_item_position(item_block: str, delta: float) -> str:
    return re.sub(
        r"^(\s*)POSITION\s+([\d.]+)$",
        lambda m: f"{m.group(1)}POSITION {float(m.group(2)) + delta:.6f}",
        item_block, count=1, flags=re.MULTILINE,
    )


def reset_item_iid(item_block: str, new_iid: int) -> str:
    return re.sub(
        r"^(\s*)IID\s+\d+$",
        lambda m: f"{m.group(1)}IID {new_iid}",
        item_block, count=1, flags=re.MULTILINE,
    )


def reset_item_guids(item_block: str) -> str:
    """Replace IGUID and GUID lines with fresh UUIDs (so concatenated items don't collide)."""
    item_block = re.sub(r"^(\s*)IGUID\s+\{[^}]+\}",
                        lambda m: f"{m.group(1)}IGUID {guid()}",
                        item_block, count=1, flags=re.MULTILINE)
    item_block = re.sub(r"^(\s*)GUID\s+\{[^}]+\}",
                        lambda m: f"{m.group(1)}GUID {guid()}",
                        item_block, count=1, flags=re.MULTILINE)
    return item_block


def max_item_length(track_blocks: list[str]) -> float:
    """Largest LENGTH across all items in all tracks (= timeline length of this set)."""
    max_len = 0.0
    for tb in track_blocks:
        for item in get_items(tb):
            m = re.search(r"^\s*LENGTH\s+([\d.]+)", item, re.MULTILINE)
            if m:
                max_len = max(max_len, float(m.group(1)))
    return max_len


def reset_track_guid(track_block: str) -> str:
    """Generate a new GUID for the track (used when copying base track to whole-gig)."""
    new_g = guid()
    return re.sub(r"\{[0-9A-Fa-f-]{36}\}", new_g, track_block, count=2)
    # ^ replaces both <TRACK {GUID} and TRACKID {GUID}


# ----------------------------------------------------------------------------
# Bus folder + render preset wrappers
# ----------------------------------------------------------------------------
def make_bus_parent(bus_name: str) -> str:
    g = guid()
    color = BUS_COLOR.get(bus_name, 0x808080)
    return (
        f"  <TRACK {g}\n"
        f'    NAME "{bus_name.upper()} BUS"\n'
        f"    PEAKCOL {color}\n"
        f"    BEAT -1\n"
        f"    AUTOMODE 0\n"
        f"    VOLPAN 1 0 -1 -1 1\n"
        f"    MUTESOLO 0 0 0\n"
        f"    IPHASE 0\n"
        f"    PLAYOFFS 0 1\n"
        f"    ISBUS 1 1\n"
        f"    BUSCOMP 0 0 0 0 0\n"
        f"    SHOWINMIX 1 0.6667 0.5 1 0.5 -1 -1 -1 0\n"
        f"    LANEREC -1 -1 -1 0\n"
        f"    SEL 0\n"
        f"    REC 0 0 0 0 0 0 0 0\n"
        f"    VU 2\n"
        f"    TRACKHEIGHT 0 0 0 0 0 0 0\n"
        f"    INQ 0 0 0 0.5 100 0 0 100\n"
        f"    NCHAN 2\n"
        f"    FX 1\n"
        f"    TRACKID {g}\n"
        f"    PERF 0\n"
        f"    MIDIOUT -1\n"
        f"    MAINSEND 1 0\n"
        f"  >\n"
    )


def patch_render_block(header: str) -> str:
    header = re.sub(r'RENDER_FILE\s+"[^"]*"', 'RENDER_FILE "mixdowns"', header)
    header = re.sub(r'RENDER_PATTERN\s+"[^"]*"', 'RENDER_PATTERN "$project-$region"', header)
    header = re.sub(r'RENDER_FMT\s+\d+\s+\d+\s+\d+', 'RENDER_FMT 0 2 24', header)
    return header


_NOTES_TRACK_STRUCTURE = '''    |  TRACK STRUCTURE (folder buses + standalones):
    |    MUSIC BUS    ch 1-2   |  VOX BUS    ch 3-4
    |    05 Adam Guitar          (standalone)
    |    06 Neil Bass            (standalone)
    |    07 Spare                (standalone)
    |    EAD BUS      ch 8-9    (Yamaha EAD — pre-mixed e-drums)
    |    DRUMS BUS    ch 10-16  (acoustic kit: kick, snare, toms, OH)
    |    PRACTICE     ch 17-18  (MUTED)
    |
    |  ROUTING: folder children send to their bus parent via Reaper folder
    |  routing; bus parent sends to Master. Per-channel chains do surgical
    |  cleanup (HPF, gate, comp); bus chains do glue + colour; Master does
    |  mastering chain (TDR SlickEQ -> Nova -> Kotelnikov -> LoudMax).
    |
    |  Run setup-postprod-fx.lua to install all chains in one go.
'''

NOTES_BLOCK_SINGLE = '''  <NOTES 0 2
    |== TGT POST-PROD PROJECT ==
    |
    |  Source: per-set recording (one Reaper recording session)
    |
''' + _NOTES_TRACK_STRUCTURE + '''    |
    |  WORKFLOW:
    |    1. Run Actions > "TGT post-prod FX chain installer" to wire FX
    |    2. Mark songs: Insert > Region (named) per song
    |    3. Dial in per-channel HPF/gate/comp values per locked plan
    |    4. File > Render > Region Render Matrix -> stereo per song
    |    5. (Path B) python split-into-songs.py <this.RPP> for per-song RPPs
  >
'''

NOTES_BLOCK_WHOLE_GIG = '''  <NOTES 0 2
    |== TGT WHOLE-GIG POST-PROD PROJECT ==
    |
    |  Sources stitched in chronological order (set boundaries marked):
{set_lines}    |
''' + _NOTES_TRACK_STRUCTURE + '''    |
    |  WORKFLOW:
    |    1. Run Actions > "TGT post-prod FX chain installer" to wire FX
    |    2. Mark songs: Insert > Region (named) per song
    |    3. Dial in per-channel HPF/gate/comp values per locked plan
    |    4. File > Render > Region Render Matrix -> stereo per song
    |    5. (Path B) python split-into-songs.py <this.RPP> for per-song RPPs
  >
'''


def insert_notes(header: str, notes_block: str) -> str:
    if "<NOTES " in header:
        return header
    return re.sub(
        r"^(<REAPER_PROJECT[^\n]*\n)",
        lambda m: m.group(1) + notes_block,
        header,
        count=1,
    )


def insert_set_markers(header: str, boundaries: list[tuple[float, str]]) -> str:
    """Insert MARKER lines for set boundaries before <PROJBAY> (or near end of header)."""
    if not boundaries:
        return header
    marker_lines = ""
    for i, (pos, name) in enumerate(boundaries, start=1):
        # is_region=0 (markers, not regions). Color teal #1abc9c → BGR 0x9CBC1A.
        marker_lines += f"  MARKER {i} {pos:.6f} \"{name}\" 0 10271770 1\n"
    # Insert before "  <PROJBAY" (which is near the end of the header) — preserve indent
    if "  <PROJBAY" in header:
        return header.replace("  <PROJBAY", marker_lines + "  <PROJBAY", 1)
    return header + marker_lines


def regroup_into_buses(track_blocks: list[str]) -> list[str]:
    """Reorder tracks by bus, wrap in folder structure, set MAINSEND on children."""
    ch_to_track: dict[int, str] = {}
    unmatched: list[str] = []
    for tb in track_blocks:
        ch = channel_of(tb)
        if ch is not None and ch in CH_BUS:
            ch_to_track[ch] = tb
        else:
            unmatched.append(tb)

    if not ch_to_track:
        raise ValueError("Could not match any tracks to channel map.")

    grouped: dict[str | None, list[tuple[int, str]]] = {b: [] for b in BUS_ORDER}
    for ch, tb in sorted(ch_to_track.items()):
        bus = CH_BUS.get(ch)
        grouped.setdefault(bus, []).append((ch, tb))

    new_tracks: list[str] = []
    for bus_name in BUS_ORDER:
        members = grouped.get(bus_name) or []
        if not members:
            continue
        if bus_name is None:
            for ch, tb in members:
                tb = set_isbus(tb, "ISBUS 0 0")
                # Standalone tracks keep MAINSEND=1 (route directly to master)
                tb = set_mainsend(tb, True)
                new_tracks.append(tb)
        else:
            new_tracks.append(make_bus_parent(bus_name))
            for i, (ch, tb) in enumerate(members):
                is_last = (i == len(members) - 1)
                isbus = "ISBUS 2 -1" if is_last else "ISBUS 0 0"
                tb = set_isbus(tb, isbus)
                # MAINSEND=1 on a folder child sends to the folder PARENT (the bus),
                # not to master directly. The bus parent then sends to master via its
                # own MAINSEND=1. So leave MAINSEND=1 on children — disabling it
                # silences the audio path entirely. (Reaper's folder routing replaces
                # the meaning of MAINSEND for tracks inside folders.)
                tb = set_mainsend(tb, True)
                if bus_name == "Practice":
                    tb = set_mute(tb, True)
                new_tracks.append(tb)

    for tb in unmatched:
        new_tracks.append(set_isbus(tb, "ISBUS 0 0"))

    return new_tracks


# ----------------------------------------------------------------------------
# Build modes
# ----------------------------------------------------------------------------
def build_single(src: Path) -> Path:
    text = src.read_text(encoding="utf-8")
    header, tracks, footer = split_header_and_tracks(text)

    new_tracks = regroup_into_buses(tracks)

    new_header = patch_render_block(header)
    new_header = insert_notes(new_header, NOTES_BLOCK_SINGLE)

    out_path = src.with_name(src.stem + "-postprod.RPP")
    out_path.write_text(new_header + "".join(new_tracks) + footer, encoding="utf-8")
    (src.parent / "mixdowns").mkdir(exist_ok=True)

    print(f"Generated: {out_path}")
    print(f"  Tracks: {len(new_tracks)} (incl. bus parents)")
    return out_path


def label_for_index(i: int, n: int) -> str:
    """Auto-name: 'Set 1', 'Set 2', ..., 'Encore' if last and n>=3 and short."""
    return f"Set {i + 1}"


def build_whole_gig(sources: list[Path], labels: list[str] | None = None) -> Path:
    if len(sources) < 2:
        raise ValueError("whole-gig mode requires 2+ source RPPs")

    # Parse each source: track-block list + per-set length
    set_data: list[tuple[float, dict[int, str]]] = []
    for src in sources:
        text = src.read_text(encoding="utf-8")
        header, tracks, footer = split_header_and_tracks(text)
        slen = max_item_length(tracks)
        ch_to_track = {channel_of(tb): tb for tb in tracks if channel_of(tb) is not None}
        set_data.append((slen, ch_to_track))
        # Stash header/footer of FIRST source — we'll reuse it
        if len(set_data) == 1:
            first_header = header
            first_footer = footer

    # Cumulative offsets + boundaries
    offsets: list[float] = [0.0]
    for length, _ in set_data[:-1]:
        offsets.append(offsets[-1] + length)

    if labels is None:
        labels = [label_for_index(i, len(sources)) for i in range(len(sources))]
        # Heuristic: if last set is short relative to others, label it "Encore"
        if (len(sources) >= 3
                and set_data[-1][0] < 0.5 * max(s[0] for s in set_data[:-1])):
            labels[-1] = "Encore"

    boundaries = list(zip(offsets, labels))

    # Build combined track list (one track per channel, items concatenated)
    all_channels = sorted({ch for _, m in set_data for ch in m})
    iid_counter = 1
    combined_tracks: list[str] = []

    for ch in all_channels:
        # Use first source's track block for this channel as the base
        base_tb = None
        for _, ch_map in set_data:
            if ch in ch_map:
                base_tb = ch_map[ch]
                break
        if base_tb is None:
            continue

        # Reset track GUID so we don't collide with anything (single channel = single new track)
        base_tb = reset_track_guid(base_tb)

        # Collect items from each set, shift POSITION
        new_items: list[str] = []
        for (slen, ch_map), offset in zip(set_data, offsets):
            tb = ch_map.get(ch)
            if not tb:
                continue
            for item in get_items(tb):
                shifted = shift_item_position(item, offset)
                shifted = reset_item_iid(shifted, iid_counter)
                shifted = reset_item_guids(shifted)
                iid_counter += 1
                new_items.append(shifted)
        combined_tracks.append(replace_items(base_tb, new_items))

    new_tracks = regroup_into_buses(combined_tracks)

    # Header tweaks: render preset, NOTES, set markers
    set_lines = "".join(
        f"    |    {lbl}: {sources[i].name}  ({set_data[i][0]/60:.1f} min)\n"
        for i, lbl in enumerate(labels)
    )
    notes_block = NOTES_BLOCK_WHOLE_GIG.format(set_lines=set_lines)
    new_header = patch_render_block(first_header)
    new_header = insert_notes(new_header, notes_block)
    new_header = insert_set_markers(new_header, boundaries)

    # Output to <date>/<date>-whole-gig-postprod.RPP
    date_dir = sources[0].parent
    out_path = date_dir / f"{date_dir.name}-whole-gig-postprod.RPP"
    out_path.write_text(new_header + "".join(new_tracks) + first_footer, encoding="utf-8")
    (date_dir / "mixdowns").mkdir(exist_ok=True)

    total_min = (offsets[-1] + set_data[-1][0]) / 60
    print(f"Generated: {out_path}")
    print(f"  Sources stitched: {len(sources)}")
    for i, (lbl, off) in enumerate(zip(labels, offsets)):
        slen_min = set_data[i][0] / 60
        print(f"    {lbl:8s} @ {off/60:6.2f} min  (length {slen_min:.2f} min)  <- {sources[i].name}")
    print(f"  Total length: {total_min:.1f} min")
    print(f"  Tracks: {len(new_tracks)} (incl. bus parents)")
    return out_path


def auto_detect_sets(date_dir: Path) -> list[Path]:
    """Find all set-*.RPP in dir over WHOLE_GIG_MIN_LENGTH_SECONDS, sorted chronologically."""
    candidates: list[tuple[Path, float]] = []
    for p in sorted(date_dir.glob("set-*.RPP")):
        if "postprod" in p.name:
            continue
        try:
            text = p.read_text(encoding="utf-8")
            _, tracks, _ = split_header_and_tracks(text)
            slen = max_item_length(tracks)
        except Exception:
            continue
        if slen >= WHOLE_GIG_MIN_LENGTH_SECONDS:
            candidates.append((p, slen))
    return [p for p, _ in candidates]


# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("sources", nargs="+",
                        help="One or more set-*.RPP files. With one source: single-set mode. "
                             "With multiple: whole-gig stitch mode.")
    parser.add_argument("--whole-gig", action="store_true",
                        help="Auto-detect: pass a directory; combine all set-*.RPP > 60s.")
    parser.add_argument("--label", action="append", default=None,
                        help="Override auto-labels in whole-gig mode (repeat per source). "
                             "Default: 'Set 1', 'Set 2', ..., 'Encore' (heuristic on last).")
    args = parser.parse_args()

    if args.whole_gig:
        if len(args.sources) != 1 or not Path(args.sources[0]).is_dir():
            parser.error("--whole-gig expects exactly one directory argument")
        sources = auto_detect_sets(Path(args.sources[0]).resolve())
        if len(sources) < 2:
            parser.error(f"Auto-detect found {len(sources)} set(s) > {WHOLE_GIG_MIN_LENGTH_SECONDS}s "
                         f"in {args.sources[0]} — need 2+ for whole-gig.")
        print(f"Auto-detected {len(sources)} set(s):")
        for p in sources:
            print(f"  {p.name}")
        build_whole_gig(sources, args.label)
        return

    sources = [Path(s).resolve() for s in args.sources]
    for s in sources:
        if not s.exists():
            parser.error(f"Source not found: {s}")

    if len(sources) == 1:
        build_single(sources[0])
    else:
        build_whole_gig(sources, args.label)


if __name__ == "__main__":
    main()
