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

> **NOTE — derived template DECLINED (S195).** This preset is the whole solution for the cover-mixdown case. The separate `cover-mixdown.RPP` derived template (`D-batchA-derived-2`) was declined — the preset alone is enough; no parallel RPP.

---

## Step 4 — Define `social-clip` (stereo MP3 for socials)

Same source/bounds as `cover-mixdown` (or use selected time range for a clip excerpt) EXCEPT:
1. **Format:** MP3 (LAME)
2. **Bitrate:** 320 kbps CBR
3. **Sample rate:** 48000 Hz
4. **File name:** `$project_clip_$date`
5. **Save preset:** **`social-clip`**.

> **Derived template DECLINED (S195).** A separate `social-clip.RPP` focus-mix template (`D-batchA-derived-3`) was declined — the preset alone covers the social-clip case. If you ever want a true focus mix (e.g. vocal+drums+bass only), use a time selection + track solos at render time rather than a parallel template.

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

### 5c — One-time setup: `STEM-PREP DRUM SUM` tap bus (DECISION RESOLVED — DO THIS)

`D-batchA-derived-1` is **adopted** (S195). Build this tap bus once into the template so the `drums` stem renders in a single solo+render instead of the manual sum-three-files step every time. It lives inside `whole-gig-template-v1.RPP`, so every project built from the template inherits it.

**Steps (in Reaper, template open):**
1. Add a new track at the bottom of the bus area. Name it **`STEM-PREP DRUM SUM`**.
2. **Turn its Master/parent send OFF** (click the track's route button → uncheck "Master/parent send", or right-click the track → toggle it off). ⚠ This is critical — the three drum buses already feed Master, so if the sum bus ALSO fed Master you'd hear the drums doubled (+6 dB) in normal playback. With master-send off, the bus is silent during normal playback and every other render.
3. On `STEM-PREP DRUM SUM`, add three **receives** (route button → "Add new receive"), one each from **DRUMS BUS**, **EAD BUS**, **TD-4 BUS**. Leave each at unity (0 dB), post-fader.
4. Save the template.

**Then for the `drums` stem render:** solo ONLY `STEM-PREP DRUM SUM` (instead of soloing the three drum buses) and render — that single file IS `drums.wav`. On TD-4 days only TD-4 carries audio, on acoustic days only DRUMS+EAD do; the sum captures whatever is present either way. No post-render sum step.

> The original spec sketched this as "sends to Master at unity" — that was wrong (it would double the drums in playback). The correct design is master-send OFF + solo-only-for-render, as above.

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

## Open decisions — RESOLVED (S195)

- `D-batchA-derived-1` — **ADOPTED.** Build the `STEM-PREP DRUM SUM` tap bus (Step 5c above). Faster stem-prep renders outweigh the one extra (silent) track per project.
- `D-batchA-derived-2` — **DECLINED.** No derived `cover-mixdown.RPP`; the `cover-mixdown` render preset (Step 3) is enough.
- `D-batchA-derived-3` — **DECLINED.** No derived `social-clip.RPP`; the `social-clip` render preset (Step 4) is enough.

Rationale: keep the single template + named presets; the one adopted change lives inside the template, not as parallel RPP files. Also update Step 3/Step 4 NOTE callouts mentally — those derived templates are now declined, not "undecided."

---

## Gig-recording rig (Windows / Acer) — durable facts (S200)

Distinct from the post-prod presets above: this is the **live capture** rig (phone APK → Reaper + Media Server on the Acer). Recorded the hard way in S200; keep these so a rebuild doesn't relearn them:

- **Audio device:** ASIO driver `X-AIR ASIO Driver` @ **48000 Hz**. In `REAPER.ini` `[audioconfig]`: `mode=3`, `asio_driver_name=X-AIR ASIO Driver`, `asio_srate=48000`, `asio_srate_use=1`, `asio_input0=0`, **`asio_input1=17`**. The `asio_input1` value is the catch: it's the *last* input channel index, so `17` = channels 0–17 = the **18** XR18 inputs. A leftover 2-channel default (`asio_input1=1`) silently caps capture at 2 inputs even though the driver loads fine.
- **OSC (phone RECORD/STOP):** in `REAPER.ini` `[reaper]`: `csurf_cnt=1` and `csurf_0=OSC "TGT-OSC" 5 8000 9000 0 "" "Default.ReaperOSC"` — receives on **UDP 8000**, pattern `Default.ReaperOSC`. Flag `5` = receive-enabled (proven). RECORD = OSC bundle `/action 40043` + `/action 1013`; stop = `/stop`.
- **⚠️ Edit `REAPER.ini` only while Reaper is CLOSED.** Reaper rewrites the ini from memory on exit, so any edit made while it's running is silently overwritten on quit. Kill `reaper.exe`, edit, relaunch; quit via File→Quit (it persists config on a clean exit, not on a force-kill).
- **Recordings land in `C:\Gigs`** (the recorder's local working drive, backed up separately). **`D:` is backup-only** — do *not* point the listener at `D:\Gigs`. Set in `gig-command-listener.lua` `gigs_dir_path()`.
- **Listeners:** `gig-command-listener.lua` + `song-marker-listener.lua` in `%APPDATA%\REAPER\Scripts\TGT\`, auto-launched by `%APPDATA%\REAPER\Scripts\__startup.lua`. Template at `%APPDATA%\REAPER\ProjectTemplates\tgt-gig-and-practice.RPP` (18 record-armed tracks).
- **Media Server host** (HTTP bridge on `:9200`, routes `POST /gig` + `/song-marker` → the `C:\tmp\gig-commands` / `C:\tmp\song-markers` drop dirs): canonical install is `C:\Apps\windows\TangerineMediaServer\` (autostarted via the HKCU `Run\TangerineMediaServer` key). Must be a **current** build containing `GigCommandBridgeEndpoints`, published **self-contained** (`dotnet publish -c Release -r win-x64 --self-contained true`) — framework-dependent breaks the apphost. `deploy-mediaserver.ps1` only refreshes the PWA `wwwroot`, **not** the host binary; rebuild + copy the publish output into the install tree separately.
- **Firewall:** inbound rules `TGT Reaper OSC` (UDP 8000) and `TGT Gig Bridge` (TCP 9200), scoped to `LocalSubnet`, so the phone on the LAN can reach the rig.

---

## See also

- [README.md](README.md) — pipeline overview + script roles
- [IMPORT-PLAYBOOK.md](IMPORT-PLAYBOOK.md) — one-page operator guide that uses these presets
- [PLUGIN-MANIFEST.md](PLUGIN-MANIFEST.md) — what plugins back each preset's FX chains
- [setup-postprod-fx.lua](setup-postprod-fx.lua) — bootstrap script for from-scratch projects (header documents when/why)
- [Setup spec §4](../../../../Apps/Dev%20Team/specs/tgt/reaper-postprod-setup.md) — the source spec these presets satisfy
- [PracticeMixer (TGT Web)](../../web/src/practice/PracticeMixer.tsx) — what consumes the `stem-prep` output
