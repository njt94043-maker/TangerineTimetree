# TGT Post-Production Pipeline

Tools for converting raw E6330 gig recordings into release-quality stereo mixdowns.

**Working copies live at `D:/Gigs/`** (alongside the gig data). This folder is the **canonical, version-controlled home** — sync your working copies from here when scripts change.

## Pipeline stages

```
E6330 (Reaper, gig recording)
       │  pull-gig.py [date]              ← Nathan's existing
       │  rewrite-rpps-for-windows.py      ← Nathan's existing
       ▼
D:/Gigs/<date>/
   ├─ audio/   (18ch WAVs per recording session)
   └─ set-XXXX.RPP  (one per Reaper recording session)

       │  build-postprod-rpp.py <set1> <set2> [...]    (whole-gig mode if 2+ inputs)
       │  build-postprod-rpp.py <single-set>           (single-set mode)
       ▼
D:/Gigs/<date>/<date>-whole-gig-postprod.RPP
       (18ch in folder buses + render presets + set-boundary markers)

       │  Open in Reaper → run setup-postprod-fx.lua via Actions menu
       ▼
Per-channel + per-bus + master FX chains installed

       │  Mark song boundaries (Insert > Region OR press hotkey
       │  bound to insert-named-marker.lua)
       ▼

       ┌─ Path A: File > Render > Region Render Matrix → per-song stereo
       │
       └─ Path B: split-into-songs.py <postprod.RPP>
              ▼
           D:/Gigs/<date>/songs/<song>.RPP (one per region, items time-windowed)
              ▼
           Open each, tweak its mix, render its stereo bounce
```

## Files

| File | Purpose |
|------|---------|
| `build-postprod-rpp.py` | Wraps one or more `set-XXXX.RPP` files into a post-prod project: 18ch grouped into folder buses (TD-4 / Vox / EAD / Drums / Music + standalones for Guitar / Bass / Spare), MAINSEND routing for submix, render preset to `mixdowns/$project-$region.wav` 24-bit/48k, set-boundary markers in whole-gig mode. |
| `setup-postprod-fx.lua` | ReaScript: walks the open project, installs per-channel chains (HPF/gate/comp surgical work), bus chains (glue/colour), Master mastering chain. Idempotent. Handles James's distance/volume issue with serial 2-stage comp (ReaComp → MJUCjr leveler). |
| `split-into-songs.py` | Path B: reads regions from a post-prod RPP, emits one .RPP per region with all 18 items time-windowed to that region. Each opens with the same FX chains, lets you do a unique mix per song. |
| `insert-named-marker.lua` | Manual hotkey-driven named marker drop at play cursor. Bind to a key (e.g. M); useful during post-prod playback to mark song starts. |
| `song-marker-listener.lua` | Background defer-loop listener: polls `C:/tmp/song-markers/` (or `/tmp/song-markers/` on Linux) for marker-request `.txt` files, drops named TGT-orange markers at play cursor. APK drummer-prompter integration target — once APK is wired, prompter taps drop markers in the live recording. |
| `gig-command-listener.lua` | Background defer-loop listener for gig-state commands (`start`/`save`/`stop`) from the APK orchestrator via the gig-command-server.py daemon. S138: F2 `reaper.file_exists` template guard before `Main_openProject`; F3 auto-suffix `<name>-2.rpp`/-3/-4 on collision (cap -99). Runtime verification deferred to rig contact (see [audit/shared/S138-SPRINT-1-RESULTS.md](../../../../Apps/Dev%20Team/audit/shared/S138-SPRINT-1-RESULTS.md)). |
| `tgt-record-at-end.lua` | Manual fallback for the APK orchestrator's `/action/40043 + /action/1013` OSC bundle. Run from Reaper Action List when APK is unavailable. Belt-and-braces against set-2-overwrites-set-1 (S119 lock / S133 GD-16). |
| `tgt-gig-and-practice.RPP` | Reaper project template — 18ch USB routing layout the listener `start_project` opens via `Main_openProject("noprompt:...")`. Source-of-truth lives here; runtime location is `~/.config/REAPER/ProjectTemplates/` on E6330 (sync'd via S140 install.sh when shipped). |
| `templates/whole-gig-template-v1.RPP` | **Post-prod template (S145).** Extracted from the 2026-05-03 whole-gig-postprod RPP with items + markers stripped (via `scripts/strip-rpp-items.py`); preserves the 23-track folder-bus structure, all 17 FX chains (per-channel HPF/gate/comp + bus glue + master chain — incl. James 3-stage chain), render preset (24-bit/48k stereo), and notes block. Use as the `--from-template` input for `build-postprod-rpp.py` when starting a new post-prod project. We can improve this template over time without touching `build-postprod-rpp.py` itself. |
| `scripts/strip-rpp-items.py` | Strips `<ITEM>` blocks AND top-level MARKER lines from any RPP, preserving track/FX/bus/routing/render structure. Used to (a) clean the rig's `tgt-gig-and-practice.RPP` from prior-gig pollution (S143/S144), (b) extract a template from a finished post-prod project (S145). Usage: `python strip-rpp-items.py <input.RPP> <output.RPP>`. |
| `pull-gig.py` | Pulls a gig's recordings + RPP from E6330 over Tailscale into `D:/Gigs/<date>/`. Nathan's existing tool, version-controlled S139. |
| `rewrite-rpps-for-windows.py` | Rewrites Linux-encoded paths in `set-XXXX.RPP` files to Windows paths after `pull-gig.py`. Nathan's existing tool, version-controlled S139. |

## Deploy / install on E6330

**S140 shipped `tools/e6330/install.sh`.** From E6330 (after rsync/scp the repo there or `git pull`):

```bash
bash tools/e6330/install.sh verify    # read-only, checks runtime state vs repo
bash tools/e6330/install.sh install   # deploys repo → runtime locations (sudo for /opt/tgt + /etc/systemd)
```

`verify` exits 0 on match, non-zero on drift. `install` is idempotent. Both reload+enable `gig-command-server.service` after.

**Driving from OptiPlex:**

```bash
scp -rq /c/Apps/TGT/tools tangerine@e6330:/tmp/tgt/
ssh tangerine@e6330 'cd /tmp/tgt && bash tools/e6330/install.sh verify'
```

The runtime locations install.sh writes to are documented in the table below.

| File | Runtime location on E6330 | Install command (S140 will automate) |
|------|---------------------------|--------------------------------------|
| `gig-command-listener.lua` | `~/.config/REAPER/Scripts/` then loaded via Action List | `scp gig-command-listener.lua user@e6330.local:~/.config/REAPER/Scripts/` |
| `song-marker-listener.lua` | Same | Same |
| `tgt-record-at-end.lua` | Same | Same |
| `tgt-gig-and-practice.RPP` | `~/.config/REAPER/ProjectTemplates/tgt-gig-and-practice.RPP` | `scp tgt-gig-and-practice.RPP user@e6330.local:~/.config/REAPER/ProjectTemplates/` |
| `setup-postprod-fx.lua` | Loaded via Reaper Action List on the post-prod machine (OptiPlex) | local file ref |
| `pull-gig.py` / `rewrite-rpps-for-windows.py` | OptiPlex (or wherever post-prod runs) — `D:/Gigs/` working copy | `cp pull-gig.py D:/Gigs/` |

**Runtime location for `__startup.lua`** on E6330 is `~/.config/REAPER/Scripts/__startup.lua` — **not yet committed here** (S140 follow-up).

## Channel map (locked, matches XR18 USB inputs)

```
1-2   TD-4 L/R      Roland TD-4 e-kit (used when acoustic kit unavailable)
3     James Vox     lead vocal (dynamic mic)
4     Adam BV       backup vocal
5     Adam Guitar   electric guitar (mic on cab)
6     Neil Bass     DI
7     Spare         (often unused)
8-9   EAD L/R       Yamaha EAD pre-mixed e-drums
10    Kick          inside-kick dynamic mic
11    Snare         top snare dynamic
12-14 Tom 1/2/3
15-16 OH L/R        overhead condenser pair
17-18 Music L/R     all music: backing tracks / practice / venue break (phone/tablet → mini jack)
```

**TD-4 days:** ch 1-2 carry the e-kit; ch 8-16 (acoustic kit + EAD) are silent. **Acoustic days:** ch 1-2 silent; ch 8-16 active. Ch 17-18 always carry music feeds (mute at FOH per-song as needed).

## James (Ch 3) leveling architecture

3 stages of progressively slower compression, end-to-end:

1. **Track-level ReaComp** (fast, ratio 3:1, ~3-5 dB GR) — catches transients
2. **Track-level MJUCjr** (slow vari-mu, comp ~30%, recovery slow, ~1-2 dB GR) — **levels the macro dynamic range** caused by James moving away from the mic on loud parts (distance variation = inverse-square law swing of 6-12 dB which a single fast comp can't tame)
3. **Bus-level DC1A3 + MJUCjr** — final vocal-bus glue/warmth

Without stage 2 (MJUCjr leveler), James's loud parts come through QUIETER than his quiet parts, paradoxically — the chain handles that.

## See also

- [proj-tgt--reaper-postprod-plan.md](../../../../Users/OptiPlex/.claude/projects/C--Apps-Dev-Team/memory/proj-tgt--reaper-postprod-plan.md) — locked install + chain plan (S124)
- [proj-tgt--reaper-theme-plan.md](../../../../Users/OptiPlex/.claude/projects/C--Apps-Dev-Team/memory/proj-tgt--reaper-theme-plan.md) — theme plan (S124)
- Session 128 wrap (the session this pipeline shipped)
