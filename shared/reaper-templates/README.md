# TGT Shared Reaper Templates

*S192 / batch A G1 — what lives in this folder and where to look for the OTHER reaper templates.*

This folder is for **rig-side / shared-across-projects** Reaper templates only. It is **NOT** the home of the post-prod templates — those live elsewhere (see below).

## Contents

| File | Purpose | Used by |
|---|---|---|
| `tgt-recording-base.RPP` | 18-channel XR18 USB recording template; sync-tone bookend protocol; APK record-trigger OSC notes | E6330 rig (continuous-take gig recording). Runtime copy at `~/.config/REAPER/ProjectTemplates/` on E6330 |
| `TGT_Default_7.ReaperThemeZip` | TGT-branded Reaper theme (teal/orange) | Installed once on each Reaper machine (laptop + OptiPlex) |
| `tgt_splash.png` | TGT splash image baked into the theme | Reaper splash setting |

## What you might be looking for, but is NOT here

### Post-prod template

The **post-production project template** is **not in this folder**. It lives at:

→ [`C:/Apps/TGT/tools/post-prod/templates/whole-gig-template-v1.RPP`](../../tools/post-prod/templates/whole-gig-template-v1.RPP)

The earlier setup spec ([`specs/tgt/reaper-postprod-setup.md`](../../../Dev%20Team/specs/tgt/reaper-postprod-setup.md) §4) used to call for a 3-file layout in this folder (`gig-postprod-master.RPP` + `cover-mixdown.RPP` + `social-clip.RPP`). That layout was **never built** — the spec was reconciled S192 to point at the single live template above. See the spec's §4 "Future enhancement: derived templates" subsection for the open decisions.

### Render presets

Render presets live in `%APPDATA%/REAPER/reaper-render.ini` (Reaper's per-user config), not in any `.RPP` file. The Nathan-side setup checklist for the 4 named presets (gig-mixdown / cover-mixdown / social-clip / stem-prep) is at:

→ [`C:/Apps/TGT/tools/post-prod/TEMPLATE-MANUAL-SETUP.md`](../../tools/post-prod/TEMPLATE-MANUAL-SETUP.md)

### Rig deployment

`tgt-recording-base.RPP` runs on the E6330 rig. Deployment scripts:

- `C:/Apps/TGT/tools/e6330/install.sh` — copies this template to the E6330's `~/.config/REAPER/ProjectTemplates/` (S140)
- Channel map + sync-tone protocol documented inside the RPP's NOTES block (open in any text editor — Reaper `.RPP` files are plain text).

## See also

- [`C:/Apps/TGT/tools/post-prod/README.md`](../../tools/post-prod/README.md) — full post-prod pipeline overview
- [`C:/Apps/Dev Team/specs/tgt/reaper-postprod-setup.md`](../../../Dev%20Team/specs/tgt/reaper-postprod-setup.md) — Reaper setup spec (plugins, theme, master template)
