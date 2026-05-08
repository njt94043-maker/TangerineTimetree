#!/usr/bin/env python3
"""Strip <ITEM ... > blocks from a Reaper RPP file. Preserves track structure,
FX, routing, busses. Used to clean the rig template's stale audio refs after
they accumulated from a prior gig that was saved-as-template by mistake."""
import sys
inp, outp = sys.argv[1], sys.argv[2]
lines = open(inp).read().splitlines()
out = []
skip = 0
items_stripped = 0
for line in lines:
    stripped = line.lstrip()
    if skip == 0:
        if stripped.startswith('<ITEM'):
            skip = 1
            items_stripped += 1
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
