#!/usr/bin/env python3
"""Copy hand-tuned FX parameters from a mixed gig RPP into the template.

S155 follow-up: Nathan hand-mixed Beddau-RFC on 2026-05-09 and wants those FX
settings (compressor thresholds, EQ curves, reverb sizes, etc.) baked into the
template so EVERY future gig's auto-built post-prod RPP starts there instead
of at the 2026-05-03 defaults.

Strategy:
    For each TRACK in the source mix, find a TRACK in the template with the
    SAME NAME. Replace the template's <FXCHAIN ... > block with the source's.
    Tracks present in the template but missing from the source keep their
    existing FX. Also copies the top-level (master) <FXCHAIN> from header if
    present in the source. Track GUIDs / routing / item structure in the
    template are NOT touched — only the FXCHAIN sub-blocks.

Usage:
    python update-template-from-mix.py <source.RPP> [--template <path>] [--out <path>]
    python update-template-from-mix.py "D:/Gigs/Beddau-RFC/Beddau-RFC-whole-gig-postprod rough mix.RPP"

By default writes to templates/whole-gig-template-v1.RPP (in place).
Pass --out to write elsewhere (e.g. v2 for safety). Always writes a .bak
sibling of the target so the previous template is recoverable.
"""
from __future__ import annotations

import argparse
import re
import shutil
import sys
from pathlib import Path

# Reuse build-postprod-rpp.py's parser. Filename has a dash so we have to
# importlib it instead of doing `import build-postprod-rpp`.
import importlib.util

HERE = Path(__file__).parent


def _import_builder():
    spec = importlib.util.spec_from_file_location(
        "_builder", HERE / "build-postprod-rpp.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def track_name(track_block: str) -> str | None:
    """Pull the NAME "..." string from a track block. Returns the literal text
    inside the quotes (e.g. 'MUSIC BUS' or '03 James Vox')."""
    m = re.search(r'^\s*NAME\s+"([^"]+)"', track_block, re.MULTILINE)
    return m.group(1) if m else None


def extract_fxchain_block(track_block: str) -> str | None:
    """Find the `<FXCHAIN ... >` sub-block inside a TRACK block. Returns the
    full sub-block text (including the opening `<FXCHAIN` line and closing
    `>` line) or None if the track has no FXCHAIN.

    Uses depth-counting from the FXCHAIN line forward so nested blocks (e.g.
    <VST ... > inside the chain) don't break the match.
    """
    lines = track_block.splitlines(keepends=True)
    start = None
    for i, line in enumerate(lines):
        if line.lstrip().startswith("<FXCHAIN"):
            start = i
            break
    if start is None:
        return None
    depth = 0
    for j in range(start, len(lines)):
        s = lines[j].strip()
        if s.startswith("<"):
            depth += 1
        elif s == ">":
            depth -= 1
            if depth == 0:
                return "".join(lines[start:j + 1])
    return None


def replace_fxchain_in_track(track_block: str, new_fxchain: str) -> str:
    """Replace the track's existing FXCHAIN block with `new_fxchain`. If the
    track has no FXCHAIN, append the new one just before the closing `>`.
    Preserves indentation of the original FXCHAIN line."""
    existing = extract_fxchain_block(track_block)
    if existing is not None:
        # Match indent of the existing FXCHAIN line so we don't disturb it.
        first_line = existing.splitlines()[0]
        indent = first_line[: len(first_line) - len(first_line.lstrip())]
        # The new FXCHAIN block is being lifted from another track. Re-indent
        # so its lines line up with `indent`.
        new_lines = new_fxchain.splitlines(keepends=True)
        if new_lines:
            src_first = new_lines[0]
            src_indent = src_first[: len(src_first) - len(src_first.lstrip())]
            if src_indent != indent:
                rebased = []
                for ln in new_lines:
                    if ln.startswith(src_indent):
                        rebased.append(indent + ln[len(src_indent):])
                    else:
                        rebased.append(ln)
                new_fxchain = "".join(rebased)
        return track_block.replace(existing, new_fxchain, 1)

    # No existing FXCHAIN — splice in just before the track's closing ">".
    lines = track_block.splitlines(keepends=True)
    for k in range(len(lines) - 1, -1, -1):
        if lines[k].strip() == ">":
            # Use the indent of the closing > + 2 spaces for the inserted chain.
            close_indent = lines[k][: len(lines[k]) - len(lines[k].lstrip())]
            child_indent = close_indent + "  "
            src_lines = new_fxchain.splitlines(keepends=True)
            if src_lines:
                src_first = src_lines[0]
                src_indent = src_first[: len(src_first) - len(src_first.lstrip())]
                if src_indent != child_indent:
                    rebased = []
                    for ln in src_lines:
                        if ln.startswith(src_indent):
                            rebased.append(child_indent + ln[len(src_indent):])
                        else:
                            rebased.append(ln)
                    new_fxchain = "".join(rebased)
            return "".join(lines[:k]) + new_fxchain + "".join(lines[k:])
    return track_block


def extract_master_fxchain_from_header(header: str) -> str | None:
    """The MASTER track's FX live at top-level in the header (before any TRACK).
    Find that FXCHAIN if present and return it, else None."""
    lines = header.splitlines(keepends=True)
    for i, line in enumerate(lines):
        # Master FXCHAIN sits inside the project at depth 1 — indent 2 spaces.
        if line.startswith("  <FXCHAIN"):
            depth = 0
            for j in range(i, len(lines)):
                s = lines[j].strip()
                if s.startswith("<"):
                    depth += 1
                elif s == ">":
                    depth -= 1
                    if depth == 0:
                        return "".join(lines[i:j + 1])
    return None


def replace_master_fxchain_in_header(header: str, new_fxchain: str) -> str:
    existing = extract_master_fxchain_from_header(header)
    if existing is None:
        return header  # template has no master chain; leave alone
    return header.replace(existing, new_fxchain, 1)


def main() -> None:
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("source", help="Hand-mixed source RPP (e.g. a -whole-gig-postprod.RPP)")
    p.add_argument("--template", default=str(HERE / "templates" / "whole-gig-template-v1.RPP"),
                   help="Template RPP to update (default: templates/whole-gig-template-v1.RPP)")
    p.add_argument("--out", default=None,
                   help="Write result here. Default: overwrite --template (with .bak backup).")
    p.add_argument("--dry-run", action="store_true",
                   help="Print which tracks would change but don't write.")
    args = p.parse_args()

    src_path = Path(args.source)
    if not src_path.is_file():
        sys.exit(f"ERROR: source RPP not found: {src_path}")
    tmpl_path = Path(args.template)
    if not tmpl_path.is_file():
        sys.exit(f"ERROR: template RPP not found: {tmpl_path}")

    builder = _import_builder()

    src_text = src_path.read_text(encoding="utf-8", errors="replace")
    tmpl_text = tmpl_path.read_text(encoding="utf-8", errors="replace")

    src_header, src_tracks, _ = builder.split_header_and_tracks(src_text)
    tmpl_header, tmpl_tracks, tmpl_footer = builder.split_header_and_tracks(tmpl_text)

    src_fxchains_by_name: dict[str, str] = {}
    for tb in src_tracks:
        n = track_name(tb)
        if not n:
            continue
        fx = extract_fxchain_block(tb)
        if fx is not None:
            src_fxchains_by_name[n] = fx

    print(f"Source: {src_path}")
    print(f"  {len(src_tracks)} tracks, {len(src_fxchains_by_name)} with FXCHAIN")
    print(f"Template: {tmpl_path}")
    print(f"  {len(tmpl_tracks)} tracks")

    # Apply per-track FXCHAIN replacements.
    updated = 0
    skipped: list[str] = []
    new_tmpl_tracks = []
    for tb in tmpl_tracks:
        n = track_name(tb) or "?"
        if n in src_fxchains_by_name:
            new_block = replace_fxchain_in_track(tb, src_fxchains_by_name[n])
            new_tmpl_tracks.append(new_block)
            print(f"  [UPDATE] {n}")
            updated += 1
        else:
            new_tmpl_tracks.append(tb)
            skipped.append(n)

    # Apply master FXCHAIN if source has one.
    src_master = extract_master_fxchain_from_header(src_header)
    new_header = tmpl_header
    if src_master is not None:
        new_header = replace_master_fxchain_in_header(tmpl_header, src_master)
        print(f"  [UPDATE] (master FX chain from header)")
        updated += 1
    else:
        print(f"  (no master FXCHAIN in source header — template's master chain preserved)")

    if skipped:
        print(f"  Tracks unchanged (no match in source): {', '.join(skipped)}")
    print(f"\nTotal updates: {updated}")

    if args.dry_run:
        print("Dry run — no file written.")
        return

    target = Path(args.out) if args.out else tmpl_path
    if target == tmpl_path:
        bak = tmpl_path.with_suffix(tmpl_path.suffix + ".bak")
        shutil.copy2(tmpl_path, bak)
        print(f"Backed up template -> {bak}")

    new_text = new_header + "".join(new_tmpl_tracks) + tmpl_footer
    target.write_text(new_text, encoding="utf-8", newline="")
    print(f"Wrote {target} ({len(new_text)} bytes)")


if __name__ == "__main__":
    main()
