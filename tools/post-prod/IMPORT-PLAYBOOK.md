# Post-Gig Import Playbook

*One-page operator guide for landing a fresh gig recording into a mixable Reaper project + DaVinci video timeline. Use this until the S145 PWA automation ships (charter at `specs/tgt/s145-postprod-import-flow-brief.md`).*

*Assumes: rig recorded successfully (Reaper 18ch on E6330 + phone mp4s on S23/Honor/S9). Audio path is verified solid; video path verified working as of S144.*

---

## Setup (one-time per OptiPlex)

- Reaper 7.x installed at default location
- DaVinci Resolve 20 Free installed (or Studio when upgraded)
- All 16 plugins per `PLUGIN-MANIFEST.md` present at `C:/Program Files/Common Files/VST3/`
- `D:/Gigs/` directory exists (working copy of pulled gigs)
- Tailscale connected to E6330 (or LAN reachability)
- adb installed + S23 / Honor / S9 set to "Always allow" for this OptiPlex

---

## After tonight's gig (or any future gig)

### Step 1 — Pull audio + RPPs from rig (~5-10 min)

```bash
cd C:/Apps/TGT/tools/post-prod
python pull-gig.py 2026-05-09
```

Output: `D:/Gigs/2026-05-09/` with:
- `set-260509_HHMM.RPP` (one per Reaper recording session — typically 2-3 for a gig with set breaks)
- `Media/` (raw 18-channel WAVs)
- `rpps-original/` (Linux-encoded path versions, kept for safety)

If `pull-gig.py` errors on Linux paths, run `python rewrite-rpps-for-windows.py D:/Gigs/2026-05-09/` to fix the RPP path encoding.

### Step 2 — Pull phone videos (~5-10 min, 3 phones in parallel)

```bash
# Plug each phone into OptiPlex via USB. adb sees them.
adb devices

# For each phone (S23 = RFCW81GEPWM, Honor = A5XBBB5925101040, S9 = 2ae2d58cab0b7ece):
adb -s RFCW81GEPWM shell ls -la /sdcard/DCIM/TGT/  # confirm files
adb -s RFCW81GEPWM pull /sdcard/DCIM/TGT/  D:/Gigs/2026-05-09/video/S23/
adb -s A5XBBB5925101040 pull /sdcard/DCIM/TGT/  D:/Gigs/2026-05-09/video/Honor/
adb -s 2ae2d58cab0b7ece pull /sdcard/DCIM/TGT/  D:/Gigs/2026-05-09/video/S9/
```

Adjust the device-side path if APK records to a different location (verify in APK source: `CameraGate.kt` write target).

### Step 3 — Build the post-prod Reaper project from the template (~10-30s)

```bash
cd C:/Apps/TGT
python tools/post-prod/build-postprod-rpp.py \
    --from-template tools/post-prod/templates/whole-gig-template-v1.RPP \
    D:/Gigs/2026-05-09/set-260509_*.RPP
```

(`--whole-gig D:/Gigs/2026-05-09` also works if you prefer auto-detect.)

Output: `D:/Gigs/2026-05-09/2026-05-09-whole-gig-postprod.RPP` — a fully-FX'd Reaper project with:
- 23 tracks in correct folder-bus structure (TD-4 / VOX / EAD / DRUMS / MUSIC)
- All 17 FX chains intact (per-channel HPF/gate/comp + bus glue + mastering chain incl. James 3-stage MJUCjr)
- All sets concatenated chronologically with set-boundary MARKERs (Set 1 / Set 2 / Encore)
- Render preset set to 24-bit/48k stereo writing to `D:/Gigs/2026-05-09/mixdowns/$project-$region.wav`

### Step 4 — Open in Reaper, sanity check

```bash
start D:/Gigs/2026-05-09/2026-05-09-whole-gig-postprod.RPP
```

Reaper opens. Check:
- All channels show items at the right positions (Set 1 starts at 0:00, Set 2 lines up after Set 1 ends, etc.)
- Master FX shows SPAN → SlickEQ → Nova → Kotelnikov → LoudMax → Youlean
- Hit Play — should hear a rough mix immediately based on the 2026-05-03 baseline leveling

### Step 5 — Mark song boundaries

Two paths:

**Path A (Region Render Matrix — preferred):**
- Position cursor at song start
- Insert > Region > Set name to song title (one region per song)
- Repeat for each song
- File > Render > Region Render Matrix > Master Mix → renders one stereo per region

**Path B (per-song RPPs — for songs that need unique mixes):**
```bash
python tools/post-prod/split-into-songs.py D:/Gigs/2026-05-09/2026-05-09-whole-gig-postprod.RPP
```
Output: `D:/Gigs/2026-05-09/songs/<song>.RPP` (one per region, items time-windowed). Open each, tweak its mix, render its stereo bounce.

### Step 6 — Tweak per-channel chains (as needed)

The 2026-05-03 leveling is the *starting* point, not the *finished* point. For tonight's gig:
- Listen through Set 1 with Master meter open
- If overall LUFS (Youlean) is wrong, adjust LoudMax ceiling + Kotelnikov threshold
- Per-channel: tweak ReaComp threshold / EQ if a channel sounds wrong (James gets quieter mid-set → adjust MJUCjr threshold; Adam Guitar harsh → adjust ReaEQ)

Save edits to template once you're happy: `python tools/post-prod/scripts/strip-rpp-items.py <this-gig-rpp> <new-template>` to capture improvements as v2 of the template.

### Step 7 — Render audio mixdowns

File > Render > Region Render Matrix → all songs to `D:/Gigs/2026-05-09/mixdowns/`. 18-channel × 107-min gig takes 5-10 min on OptiPlex i7-3770 (no GPU bottleneck — Reaper is CPU-bound).

### Step 8 — Open DaVinci, build the gig timeline

Open DaVinci Resolve 20. Once `tools/post-prod/davinci/tgt-live-gig-template.drp` ships (S149), this becomes:
```bash
start D:/Gigs/2026-05-09/<davinci-project>.drp  # opens in DaVinci with the template structure pre-loaded
```

Until then, manual:
1. New project → name "TGT 2026-05-09 Gig"
2. Edit page → Media Pool → import the 3 phone mp4s from `D:/Gigs/2026-05-09/video/`
3. Import mastered stereo audio bounce (or per-song bounces) from `D:/Gigs/2026-05-09/mixdowns/`
4. Drag mp4s onto V1 / V2 / V3 (one per phone)
5. Drag stereo audio onto A1
6. Sync videos to audio: Edit page → select all video clips → right-click → "Auto Align Clips" → "Based on Waveforms" (this uses each phone's own audio track to lock to the master). Works well if the room mic on each phone picked up enough of the FOH sound.
7. **If auto-align doesn't lock cleanly:** find the loudest transient at gig start (drum count-in, clap, whatever you've got) and manually align.
8. Color page → tweak each angle for white balance / exposure consistency
9. Edit page → cut between angles per song
10. Deliver page → render to YouTube 1080p preset (or whatever target)

When `tgt-live-gig-template.drp` ships (S149), steps 1-5 collapse into "open template, drop files in".

---

## What can go wrong + how to recover

| Problem | Diagnosis | Recovery |
|---|---|---|
| `pull-gig.py` fails to connect | E6330 unreachable on hotspot | Switch laptop/desktop to S23 hotspot; or use Tailscale fallback |
| `build-postprod-rpp.py` says "no items found" | Source RPP has Linux paths Reaper can't resolve | Run `rewrite-rpps-for-windows.py` first |
| Reaper opens project but tracks are silent | FX chain references missing plugin | Check `PLUGIN-MANIFEST.md` — all 16 should be installed; reinstall any missing |
| Items at wrong positions (set 2 plays over set 1) | Source RPP `LENGTH` field misread | Open each set-XXX.RPP in Reaper individually, note actual length, pass `--label "Set 1" --label "Set 2"` etc explicitly. The auto-stitch uses `LENGTH` of longest item per set. |
| DaVinci video doesn't sync to audio | Phone mic didn't pick up enough sound for waveform align | Manual sync via clap or visible-cue (drumstick click); or play a pre-recorded sync tone at set-start (S139 bookend tone, when shipped) |
| Voice / vocals harsh in master bounce | Mastering chain pushing too hard | Pull LoudMax ceiling back 1-2 dB; check Kotelnikov GR — should be 1-3dB max on master |

---

## Files referenced

- [PLUGIN-MANIFEST.md](PLUGIN-MANIFEST.md) — what plugins are needed + DaVinci recommendation
- [README.md](README.md) — pipeline overview, channel map, James chain rationale
- [build-postprod-rpp.py](build-postprod-rpp.py) — the wrapper script (`--from-template` is the S145 way)
- [templates/whole-gig-template-v1.RPP](templates/whole-gig-template-v1.RPP) — the structural template
- [scripts/strip-rpp-items.py](scripts/strip-rpp-items.py) — extract a new template from a finished post-prod RPP
- [pull-gig.py](pull-gig.py) — rig audio pull
- [split-into-songs.py](split-into-songs.py) — per-song RPPs (Path B)
- [s145-postprod-import-flow-brief.md](../../../../Apps/Dev%20Team/specs/tgt/s145-postprod-import-flow-brief.md) — multi-session brief that automates this playbook into the MS PWA
