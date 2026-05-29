# Template manual setup — Nathan-side render presets

*S192 / batch A — G5. Companion to [`templates/whole-gig-template-v1.RPP`](templates/whole-gig-template-v1.RPP) and [`PLUGIN-MANIFEST.md`](PLUGIN-MANIFEST.md). Read once, do the checklist below the first time you open the template in Reaper after a fresh laptop / OptiPlex setup. Saves the presets into your Reaper user profile so all future post-prod projects opened from this template can pick them from the Render dialog.*

---

## Why this exists (the short version)

The setup spec ([`specs/tgt/reaper-postprod-setup.md`](../../../../Apps/Dev%20Team/specs/tgt/reaper-postprod-setup.md) §4) calls for **4 named render presets**:

| Preset | Purpose |
|---|---|
| `gig-mixdown` | Per-song stereo bounces (Region Render Matrix flow) |
| `cover-mixdown` | Single stereo for drum-cover or solo-cover deliverables |
| `social-clip` | Stereo MP3 for short social posts |
| **`stem-prep`** | **6 grouped stems for the Band Practice Mixer (Flow 3) — drums / bass / guitar / lead / bv / other** |

**Reality check on the template** (S192 audit): `whole-gig-template-v1.RPP` carries only ONE `<RENDER_CFG>` block (the project's last-saved render config — 24-bit/48k stereo from the 2026-05-03 source gig). It does **NOT** carry named, dropdown-selectable render presets — those live in Reaper's user profile (`%APPDATA%/REAPER/reaper-render.ini`), not in `.RPP` files. So the template can't ship them; YOU have to define them in Reaper once on the laptop, and they stick across every project.

That's what this checklist is. ~10–15 minutes. Do once.

---

## Before you start

- Reaper 7.x open
- `whole-gig-template-v1.RPP` open in front of you (so the channel-name autocomplete in the render dialog works)
- All 12 third-party plugins from [`PLUGIN-MANIFEST.md`](PLUGIN-MANIFEST.md) installed (so render-time FX-bypass options are populated)

---

## Step 1 — Open the render dialog

`File → Render…` (Ctrl+Alt+R). Leave it open across all 4 preset definitions. The "Presets" dropdown at the very top is where each preset gets saved.

---

## Step 2 — Define `gig-mixdown` (per-song stereo)

1. **Source:** Project regions (selected regions) — this is the Region Render Matrix flow per [`IMPORT-PLAYBOOK.md`](IMPORT-PLAYBOOK.md) Step 5 Path A.
2. **Bounds:** Project regions.
3. **Output directory:** leave macro path → `$project\mixdowns` (resolves to e.g. `D:/Gigs/2026-05-09/mixdowns/`).
4. **File name:** `$project_gig_$region`
5. **Sample rate:** 48000 Hz
6. **Channels:** Stereo
7. **Format:** WAV
8. **Bit depth:** 24-bit PCM
9. **Resample mode:** "Better (192pt Sinc)" or higher
10. **Tail:** 1000 ms (to catch reverb tails)
11. **Normalize / brickwall:** OFF (mastering chain on Master already handles ceiling via LoudMax)
12. **Save preset:** click "Presets" → "Save preset…" → name it **`gig-mixdown`** → OK.

---

## Step 3 — Define `cover-mixdown` (full stereo of one song / one cover)

Same as `gig-mixdown` EXCEPT:
1. **Source:** Master mix (entire project — single bounce; you'd use this when the whole project IS the cover, not a multi-song gig).
2. **Bounds:** Entire project.
3. **File name:** `$project_drumcover_$date` (or `$project_cover_$date` — pick one and be consistent).
4. **Save preset:** "Save preset…" → **`cover-mixdown`**.

> **NOTE — derived template undecided.** This preset is fine for the rendering case. The spec also mentions a *separate* `cover-mixdown.RPP` derived template (a stripped-down version of the master). **NOT BUILT YET.** Tracked as open decision `D-batchA-derived-2` in the setup spec — needs Nathan input on whether a derived RPP is wanted or whether the preset alone is enough.

---

## Step 4 — Define `social-clip` (stereo MP3 for socials)

Same source/bounds as `cover-mixdown` (or use selected time range for a clip excerpt) EXCEPT:
1. **Format:** MP3 (LAME)
2. **Bitrate:** 320 kbps CBR
3. **Sample rate:** 48000 Hz
4. **File name:** `$project_clip_$date`
5. **Save preset:** **`social-clip`**.

> **Same derived-template caveat as Step 3.** A separate `social-clip.RPP` template would let you build a focus mix (just vocal + drums + bass for a short cut, for example). NOT BUILT YET. Open decision `D-batchA-derived-3`.

---

## Step 5 — Define `stem-prep` (6 grouped stems for Band Practice Mixer)

**THIS IS THE IMPORTANT ONE.** Flow 3 (gig recording → band practice tools) needs the template to render exactly the 6 stems the [PracticeMixer S190 mockup](../../web/src/practice/PracticeMixer.tsx) expects: **`drums`, `bass`, `guitar`, `lead`, `bv`, `other`**. This is the new locked layout — the older 7-stem layout in [`ingest-gig-mixdown.py`](ingest-gig-mixdown.py) (`full/drums/guitar/bass/vox1/vox2/vox_bus`) is **superseded** and should be retired (Batch B's call).

### 5a — Set up render-time bus routing

Reaper renders "Tracks (selected only)" with `Tracks (stems)` for the source. The 6 stems map to the template's existing bus tracks like this — **VERIFY this matches the live template's NAMEs** (S192 audit confirms current names):

| Stem | Source track in template | Notes |
|---|---|---|
| `drums` | `DRUMS BUS` (folder ch 10-16: kick/snare/toms/OH) **plus** `EAD BUS` (ch 8-9) **plus** `TD-4 BUS` (ch 1-2) summed | All kits funnel to one "drums" stem. On TD-4 days only TD-4 has audio; on acoustic days only DRUMS BUS + EAD; either way render the sum. Easiest: solo all three buses, render once, label `drums`. |
| `bass` | `06 Neil Bass` (standalone) | Single channel, mono-summed to stereo if needed. |
| `guitar` | `05 Adam Guitar` (standalone) | Single channel. |
| `lead` | `03 James Vox` only (NOT the whole VOX BUS) | Mockup splits lead and BV into separate stems. `VOX BUS` contains both James + Adam BV summed; for stem-prep, render `03 James Vox` BEFORE the VOX BUS sums it. **Pre-bus-FX**: take the per-channel chain (HPF/gate/ReaComp/MJUCjr/Nova/EQ) but NOT the bus glue/reverb. |
| `bv` | `04 Adam BV` only | Same logic — per-channel chain ON, VOX BUS chain OFF. |
| `other` | `MUSIC BUS` (ch 17-18: backing tracks / practice / venue break) **plus** `07 Spare` if it has audio | "Other" = anything not in the 5 above. Backing-track audio + spare lands here. |

### 5b — Render-dialog settings for `stem-prep`

1. **Source:** Tracks (stems) — selected tracks via SOLO. Reaper renders each soloed track or bus as its own file.

   - **Easiest workflow per render:** select the 6 source paths above by clicking each (NOT inside Render dialog — in the TCP), then in Render dialog choose `Source: Selected tracks (stems)`.
   - Reaper produces ONE file per selected track. For the `drums` stem you'll need to render the THREE drum buses to separate files THEN sum them in a post-step (or, simpler: route DRUMS BUS + EAD BUS + TD-4 BUS sends to a temporary `DRUM SUM` folder bus for `stem-prep` runs only — see optional one-time setup below).
2. **Output directory:** `$project\stems`
3. **File name:** `$project_$track_$date` → Reaper will write e.g. `2026-05-09_03 James Vox_260509.wav`. **You'll rename to `drums.wav` / `bass.wav` / `guitar.wav` / `lead.wav` / `bv.wav` / `other.wav` after rendering** (or pre-rename the source tracks to those short names before rendering — your call).
4. **Sample rate:** 48000 Hz
5. **Channels:** Stereo (mono sources will get duplicated to L+R automatically)
6. **Format:** WAV
7. **Bit depth:** 24-bit PCM
8. **Render Master FX:** **OFF** — stems should be clean of the master mastering chain (the PracticeMixer applies its own faders and the mockup expects pre-master-bus audio).
9. **Render per-track FX:** **ON** — keeps the per-channel HPF/gate/comp/MJUCjr work the band's used to.
10. **Render bus FX:** **DEPENDS** — for `drums` / `other` you WANT the bus glue (DC1A3, TENSjr) baked in. For `lead` / `bv` you do NOT want the VOX BUS reverb baked in (PracticeMixer adds its own ambient if wanted). So either render in two passes (vocals first with bus FX off, then the rest with bus FX on) or use track-level snapshots to bypass VOX BUS chain before the vocal pass.
11. **Save preset:** **`stem-prep`**.

### 5c — Optional one-time setup that makes stem-prep faster

Create a hidden helper folder bus in the template called `STEM-PREP DRUM SUM` that receives sends from DRUMS BUS / EAD BUS / TD-4 BUS at unity, sends to Master at unity (so normal playback is unchanged), and is the SINGLE source you solo for the `drums` stem render. Saves you the sum-three-files post-step every render.

**Don't add this blindly** — it adds a track to every post-prod project derived from the template. Decide first whether you'd rather do the post-render sum OR live with the extra bus. Logged as open decision `D-batchA-derived-1` in the setup spec.

---

## Step 6 — Verify all 4 presets are saved

`File → Render…` → click the "Presets" dropdown at the top. You should see:

- `gig-mixdown`
- `cover-mixdown`
- `social-clip`
- `stem-prep`

They're stored in `%APPDATA%/REAPER/reaper-render.ini` and persist across Reaper restarts. Back up that file alongside your Reaper config when you migrate laptops.

---

## Step 7 — Smoke test (~5 min)

1. Open `whole-gig-template-v1.RPP` (or a real `D:/Gigs/<date>/...-postprod.RPP` made via `build-postprod-rpp.py --from-template`).
2. `File → Render…` → pick `gig-mixdown` from Presets → verify the form populates with your saved settings (sample rate / format / file name template all correct).
3. **DO NOT click Render** unless you actually want the output — just confirm the dropdown remembers the settings. Cancel the dialog.
4. Repeat for the other 3 presets.

If any preset is missing values: re-save it (Presets → Save preset → same name → overwrites).

---

## Open decisions (need Nathan, blocking nothing today)

- `D-batchA-derived-1` — build the `STEM-PREP DRUM SUM` helper bus into the template? (yes = faster stem-prep renders, extra track in every project; no = manual post-render sum of 3 drum files).
- `D-batchA-derived-2` — build a derived `cover-mixdown.RPP` template (stripped subset of master), or is the render-preset enough?
- `D-batchA-derived-3` — build a derived `social-clip.RPP` template (focus mix), or is the render-preset enough?

Defaults if Nathan doesn't decide: leave as-is. Render presets alone cover both the cover and social-clip cases for the foreseeable workflow.

---

## See also

- [README.md](README.md) — pipeline overview + script roles
- [IMPORT-PLAYBOOK.md](IMPORT-PLAYBOOK.md) — one-page operator guide that uses these presets
- [PLUGIN-MANIFEST.md](PLUGIN-MANIFEST.md) — what plugins back each preset's FX chains
- [setup-postprod-fx.lua](setup-postprod-fx.lua) — bootstrap script for from-scratch projects (header documents when/why)
- [Setup spec §4](../../../../Apps/Dev%20Team/specs/tgt/reaper-postprod-setup.md) — the source spec these presets satisfy
- [PracticeMixer (TGT Web)](../../web/src/practice/PracticeMixer.tsx) — what consumes the `stem-prep` output
