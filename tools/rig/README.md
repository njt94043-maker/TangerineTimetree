# Gig Rig Launcher

## How to start the rig
**Double-click `Start Gig Rig.bat`.** That's it.

It will:
1. Assert the Reaper audio + OSC config in `REAPER.ini` (with Reaper **closed**) to the
   verified-correct values — X-AIR ASIO Driver, 48000 Hz, 18 inputs, and the `TGT-OSC`
   control surface on UDP 8000.
2. Launch Reaper.
3. Start the Tangerine Media Server host (TCP 9200) if it isn't already running.
4. Print a readiness summary (Reaper up? UDP 8000 bound? TCP 9200 listening?).

If the rig is **already live** (Reaper running and UDP 8000 bound), double-clicking again
is safe — it detects the running rig and exits without touching anything.

## The golden rule (why this exists)
> **Only ever edit `REAPER.ini` while Reaper is CLOSED.**

A clean single-instance Reaper exit saves the config correctly. But if `REAPER.ini` is
edited while a `reaper.exe` instance is open, Reaper overwrites the file with its in-memory
config when it exits — silently discarding your edit. The launcher honours this: on a cold
start it fully closes Reaper (graceful, then forced) and confirms it's gone *before* writing
the ini, then launches Reaper afterwards. Never hand-edit `REAPER.ini` with Reaper open.

## Files
- `start-gig-rig.ps1` — the launcher (built-in PowerShell only, no dependencies).
- `Start Gig Rig.bat` — double-clickable wrapper (Nathan doesn't use a terminal).
- `README.md` — this file.

## Backup
The first run backs up the original ini to `REAPER.ini.rigbak` (next to `REAPER.ini` in
`C:\Users\njt94\AppData\Roaming\REAPER\`). It is written once and never overwritten by the
launcher.

## Verified-correct config (what the launcher asserts)
- `[audioconfig]`: `mode=3`, `asio_driver_name="X-AIR ASIO Driver"`, `asio_srate=48000`,
  `asio_srate_use=1`, `asio_input0=0`, `asio_input1=17`  → 18 ASIO inputs @ 48 kHz
- `[reaper]`: `csurf_cnt=1`, `csurf_0=OSC "TGT-OSC" 5 8000 9000 0 "" "Default.ReaperOSC"`
  → OSC control surface receiving on UDP 8000

The launcher edits **section-aware and idempotently**: it only changes keys that are wrong,
keeps exactly one `csurf_0` line (collapsing any duplicates), and preserves every other line
and the file's CRLF line endings.

## Next step (future)
This launcher is the seed for **auto-start-on-login**: point a Startup-folder shortcut or a
Task Scheduler "at logon" task at `Start Gig Rig.bat` so the rig comes up correctly on every
boot with no double-click required.
