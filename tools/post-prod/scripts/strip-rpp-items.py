#!/usr/bin/env python3
"""Strip stale gig state from a Reaper RPP template/gig file:
  - <ITEM ... > blocks (audio refs)
  - top-level MARKER lines (song-name + set-boundary markers)
Preserves track structure, FX, routing, busses, project config.
Used to clean the rig template after a prior gig was saved-as-template
by mistake. S143 added items; S144 added markers."""
import sys
inp, outp = sys.argv[1], sys.argv[2]
lines = open(inp).read().splitlines()
out = []
skip = 0
items_stripped = 0
markers_stripped = 0
for line in lines:
    stripped = line.lstrip()
    if skip == 0:
        if stripped.startswith('<ITEM'):
            skip = 1
            items_stripped += 1
            continue
        if line.startswith('  MARKER '):
            markers_stripped += 1
            continue
        out.append(line)
    else:
        if stripped.startswith('<'):
            skip += 1
        elif stripped == '>':
            skip -= 1
            if skip == 0:
                continue
open(outp, 'w', newline='\n').write('\n'.join(out) + '\n')
print(f"input lines: {len(lines)}")
print(f"output lines: {len(out)}")
print(f"items stripped: {items_stripped}")
print(f"markers stripped: {markers_stripped}")
