# TGT Post-Prod Plugin Manifest

*S145 — what plugins our post-prod actually needs, what's installed, what's recommended, what's missing. **Authoritative source of truth** for Reaper-side and DaVinci-side chains. The setup spec ([`specs/tgt/reaper-postprod-setup.md`](../../../../Apps/Dev%20Team/specs/tgt/reaper-postprod-setup.md) §2) mirrors this file — if they disagree, THIS WINS and the spec gets updated. (Reconciled S192 / batch A G6.)*

*Audit performed against `tools/post-prod/templates/whole-gig-template-v1.RPP` (extracted from 2026-05-03 hand-mixed gig). All plugin-presence checks against `C:/Program Files/Common Files/VST3/`.*

---

## TL;DR

**Reaper side: complete.** The template references 16 plugins (12 third-party install + 4 Cockos stock bundled with Reaper); all 16 are installed on OptiPlex. James 3-stage chain works, mastering chain works, vocal de-essing works (via TDR Nova dynamic EQ).

**DaVinci side: greenfield.** Decision: **install Free Resolve 20 now; upgrade to Studio (£295 one-off) when budget allows.** Free covers everything for the immediate workflow (multicam edit + colour + render); Studio's three workflow-relevant adds (Voice Isolation for crowd noise, VST-in-Fairlight for single-app workflow, H.265 hardware encoding) become real upgrades once £295 is spare. Architecture works on either; Studio just unlocks the optional features.

---

## Reaper side

### Per-track FX coverage (whole-gig-template-v1.RPP)

| Track | Chain | Coverage role |
|---|---|---|
| 01-02 TD-4 L/R | ReaEQ → ReaComp → ReaEQ | Roland TD-4 stereo e-kit — HPF + tone-shape + glue comp |
| TD-4 BUS | DC1A3 | Light bus glue on pre-summed Roland module output |
| MUSIC BUS / 17-18 | (no FX) | All music (backing / practice / venue break) — pre-mastered |
| VOX BUS | DC1A3 → ValhallaSupermassive → MJUCjr | Glue + reverb insert + final vocal-bus leveler |
| 03 James Vox | ReaEQ → ReaGate → ReaComp → **MJUCjr** → TDR Nova → ReaEQ | The 3-stage chain (track ReaComp + track MJUCjr + bus DC1A3+MJUCjr); TDR Nova as de-esser |
| 04 Adam BV | ReaEQ → ReaGate → ReaComp → TDR Nova → ReaEQ | Standard chain + de-esser |
| 05 Adam Guitar | ReaEQ → ReaComp → ReaEQ | Surgical EQ + tame |
| 06 Neil Bass | ReaEQ → ReaComp → ReaXcomp → IVGI2 | EQ → glue → multiband → saturation |
| 07 Spare | (no FX) | Often unused channel |
| EAD BUS | ReaComp | Bus glue on Yamaha EAD pre-mix |
| 08-09 EAD L/R | ReaEQ → ReaComp | Light shape |
| DRUMS BUS | DC1A3 → TENSjr | Glue + transient enhancement on the kit |
| 10 Kick | ReaEQ → ReaGate → ReaComp → ReaEQ | Two-EQ tone-shape |
| 11 Snare | ReaEQ → ReaGate → ReaComp → TDR Nova | Dynamic EQ on resonance |
| 12-14 Toms 1/2/3 | ReaEQ → ReaGate → ReaComp | Standard kit chain |
| 15-16 OH L/R | ReaEQ → ReaComp → TDR Nova | Cymbal sibilance control via Nova |
| **MASTER** | SPAN → TDR SlickEQ → TDR Nova → TDR Kotelnikov → LoudMax → Youlean | Analyzer + mastering EQ → mastering dynEQ → vari-mu mastering comp → limiter + LUFS meter |

### Plugins installed on OptiPlex (all 16 ✓)

All template-referenced plugins are present at `C:/Program Files/Common Files/VST3/` (or Reaper-bundled).

| Plugin | Vendor | Type | Role | Free/Paid |
|---|---|---|---|---|
| ReaComp / ReaEQ / ReaGate / ReaXcomp | Cockos | VST | Stock dynamics + EQ | Bundled with Reaper |
| DC1A3 | Klanghelm | VST | Bus glue compressor | Free |
| IVGI2 | Klanghelm | VST | Tape/console saturation | Free |
| MJUCjr | Klanghelm | VST | Vari-mu vocal leveler (the secret sauce of James's chain) | Free |
| TENSjr | Klanghelm | VST3 | Transient designer (kit punch) | Free |
| TDR Nova | TDL | VST | Dynamic EQ (used for de-essing + kit resonance) | Free |
| TDR Kotelnikov | TDL | VST | Mastering compressor | Free |
| TDR VOS SlickEQ | TDL | VST3 | Mastering EQ | Free |
| LoudMax | Thomas Mundt | VST3 | Final limiter | Free |
| SPAN | Voxengo | VST3 | Spectrum analyzer | Free |
| Youlean Loudness Meter 2 | Youlean | VST3 | LUFS / loudness target metering | Free |
| ValhallaSupermassive | Valhalla DSP | VST3 | Vocal-bus reverb/delay | Free |

**Cost of the entire Reaper-side post-prod stack: £0.** All free or Reaper-bundled.

### Already installed but NOT yet in the template (available for future use)

These showed up in `C:/Program Files/Common Files/VST3/` but aren't currently routed in v1:

- **Airwindows** suite (with BaconPaul / Surge Synth Team) — large free DSP collection (saturation, console, EQ, dynamics)
- **MeldaProduction** — large suite (some free, some paid)
- **ValhallaSpaceModulator** — modulation FX
- **iZotope** — likely a trial or RX Elements

If later versions of the template need vocal pitch correction, drum sample augmentation, etc., the Airwindows + Melda libraries are the first place to look before installing anything new.

### Reaper-side gaps worth flagging (none blocking)

- **No drum sample replacement / reinforcement** (Slate Trigger / SSD5 / Drumagog). Live recordings often benefit from kick/snare reinforcement. Currently NOT in scope; flag for v2 of the template if mixes need more punch.
- **No pitch correction** (Auto-tune / Reaper's ReaTune / GSnap). James / Adam haven't needed it yet; flag if it ever comes up.
- **No multiband sidechain compression / ducking** (TrackSpacer / Wavesfactory etc.). The Music BUS is muted in live mixdowns so kick→bass ducking isn't a need today.

These are nice-to-haves, not coverage gaps. The current chain is professional-grade.

---

## DaVinci side

### Status

**Not installed.** `C:/Program Files/Blackmagic Design/` does not exist on this OptiPlex; DaVinci is not in the Start menu manifest. Planned use: final video editing per Nathan's brain-dump B-D5 (chosen video editor).

### Free vs Studio decision

| Capability | Free Resolve 19 | Resolve 19 Studio (£295 one-off) |
|---|---|---|
| Multicam (up to 4 angles — we have 3 phones max) | ✓ | ✓ |
| Color grading + Color page | ✓ | ✓ + advanced features |
| Cuts / transitions / effects (Edit page) | ✓ | ✓ |
| Fusion compositing | ✓ | ✓ + GPU acceleration |
| Render up to 4K | ✓ | ✓ + 8K + HDR |
| **Fairlight audio editing (built-in effects only)** | ✓ | ✓ |
| **VST / AU plugin support in Fairlight** | ✗ | ✓ |
| **OFX plugin support** | Many free OFXs work; some Studio-gated | ✓ all |
| Voice Isolation (AI noise removal — useful for crowd) | ✗ | ✓ |
| H.265 hardware encoding | ✗ | ✓ |
| Multi-user collaboration | ✗ | ✓ |
| Magic Mask / AI features | ✗ | ✓ |

### Decision: Free now, Studio upgrade when budget allows

**Install DaVinci Resolve 20 Free now.** It covers the immediate workflow:
- Video assembly + multicam edit (up to 4 angles — we have 3 phones max)
- Colour grading (full Color page)
- Cuts / transitions / Fusion compositing
- Fairlight built-in audio effects
- Render up to 4K

What Free can't do (and what Studio (£295 one-off perpetual licence) adds when you upgrade):

1. **Voice Isolation** — AI noise removal for crowd noise / room ambience on vocal mics. Live-pub recordings benefit; no equivalent in the Reaper chain. Single-feature value.
2. **VST plugin support in Fairlight** — your existing 16-plugin Klanghelm/TDR/Valhalla setup would load inside DaVinci. Unblocks single-app workflow (mix audio + assemble video without leaving Resolve).
3. **H.265 hardware encoding** — 3-4× faster renders. Felt on every video bounce.
4. Voice Isolation, VST, H.265 hardware encoding — all upgrade-when-£295-spare items.

Decision rationale: tight cashflow this month; workflow with Free is fine for tonight + next few gigs. £295 is one-off and doesn't go away — it'll still be there to spend later. Re-evaluate after first 1-2 DaVinci-finished gigs surface what's actually missed.

**Use the v20 stable line (not v21 Public Beta)** for production work either way.

### DaVinci OFX plugin recommendations (none mandatory)

DaVinci's stock toolkit covers basically all live-concert post-prod needs out of the box. The OFX ecosystem is large but mostly aimed at film/commercial work — not directly relevant. **Defer all OFX install decisions until you've used DaVinci on 1-2 gigs and noticed an actual gap.**

For reference, these are the categories of OFX plugins worth considering only if a specific need surfaces:

| Need | Plugin | Cost | When to consider |
|---|---|---|---|
| Film looks / LUTs (vibe colour grade) | FilmConvert Nitrate | $149 | If band wants a specific cinematic look |
| Glow / lens flare / advanced transitions | Boris BCC / Sapphire | £hundreds | If you outgrow stock transitions |
| 3D titles | Red Giant Universe | $299/yr | Probably never for live gigs |
| Stabilization beyond stock | NeatVideo / Mocha | $100s | If a phone shake is unfixable in stock stabilizer |

Stock Resolve stabilizer + colour wheels + transitions handle live-gig multicam fine. Don't pay for OFX upfront.

### DaVinci project template plan (write-only at this point — DaVinci not installed)

Once DaVinci is installed, we'll create a **TGT Live Gig Template (.drp)** seeded with:

**Fairlight track layout** matching our 18-channel XR18 USB map (so an exported Reaper stem set drops in 1:1):

```
Track 1-2   TD-4 L/R        (stereo — Roland TD-4 e-kit, silent on acoustic days)
Track 3     James Vox       (mono)
Track 4     Adam BV         (mono)
Track 5     Adam Guitar     (mono)
Track 6     Neil Bass       (mono)
Track 7     Spare           (mono, often empty)
Track 8-9   EAD L/R         (stereo bus)
Track 10-16 Drums acoustic  (mono each — kick, snare, toms, OH; silent on TD-4 days)
Track 17-18 Music L/R       (stereo — all music: backing / practice / venue break)
Bus 1       TD-4 BUS        (1-2 → bus)
Bus 2       VOX BUS         (3-4 → bus)
Bus 3       EAD BUS         (8-9 → bus)
Bus 4       DRUMS BUS       (10-16 → bus)
Bus 5       MUSIC BUS       (17-18 → bus)
Master      Final stereo bus
```

Plus alternative **stem-import layout** if mixing in Reaper and only importing to DaVinci:

```
Track A     Vocals stereo bounce
Track B     Drums stereo bounce
Track C     Music/Backing stereo bounce
Track D     Master stereo (final mix from Reaper)
```

**Multicam timeline template**:

- 3 video tracks (V1 S23 selfie/drummer / V2 Honor / V3 S9), aligned via S139 bookend tone
- 1 audio track for sync reference (single mic from any phone, used for clap/tone alignment)
- Render preset: 1080p H.264 (Free Resolve), 4-8 Mbps target for YouTube/Instagram

**Render presets** to seed:
- *YouTube 1080p Final* (.drp render preset) — H.264, 8 Mbps, AAC stereo at 320 Kbps, 25 fps
- *Instagram 9:16 Crop* — 1080×1920 vertical, H.264, 6 Mbps
- *Archival Master* — ProRes 422 HQ, full 1080p, 5.1 audio if available

The .drp file itself can't be created without DaVinci installed. Once installed, build the template once, save as `tools/post-prod/davinci/tgt-live-gig-template.drp`, and version-control it here alongside the Reaper templates.

---

## Action items

| # | Task | Status | Blocker |
|---|---|---|---|
| 1 | Verify all 16 Reaper VSTs installed on OptiPlex | ✓ done (this audit) | — |
| 2 | Extract whole-gig-template-v1.RPP from 2026-05-03 | ✓ done (S145 task 1) | — |
| 3 | Decide: DaVinci Resolve 20 (Free now, Studio upgrade later) | ✓ done — Free now, Studio upgrade when £295 spare |
| 4 | Install DaVinci Resolve 20 Free | **pending Nathan** (download + install ~15 min) | — |
| 5 | Build `tools/post-prod/davinci/tgt-live-gig-template.drp` (Fairlight 18-track XR18 layout + 3-cam multicam timeline + render presets) | not started | depends on (4) |
| 6 | Future: upgrade to Studio when budget allows; document VST loading in Fairlight | future | budget-gated |

---

## Cross-references

- [README.md](README.md) — pipeline overview + scripts
- [tools/post-prod/templates/whole-gig-template-v1.RPP](templates/whole-gig-template-v1.RPP) — Reaper post-prod template
- [setup-postprod-fx.lua](setup-postprod-fx.lua) — ReaScript that installs FX chains on a fresh build-postprod-rpp.py output (alternative to opening from template)
- Brain dump 060526 (B-D5) — chosen video editor decision
