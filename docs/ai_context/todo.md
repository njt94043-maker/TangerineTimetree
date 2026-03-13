# TGT — Todo

> Current tasks, priorities, and backlog.
> Update after every task completion. See STATUS.md for instant context.

---

## S58 — Web Click Drift Fix (Top Priority)

### Web Click — Foreground WORKS, drift NOT fixed
- [x] S52-S56: Click foreground silence diagnosed and fixed (AnalyserNode parallel, step 2c tick loop)
- [x] S57: Tested resyncToPosition in rAF — BROKE click (reverted immediately)
- [ ] **S58: Research proper Web Audio sync patterns** — Chris Wilson lookahead article, Tone.js Transport, reference implementations. NO GUESSING.
- [ ] **S58: Present research findings + proposed approach to Nathan BEFORE coding**
- [ ] **S58: Implement research-backed drift correction**
- [ ] **S58: Restore beat intensity** (drives metronome vis per D-169)
- [ ] **S58: Evaluate FFT necessity** — D-169 says vis is beat-synced, may not need FFT at all
- [ ] **Remove debug banner + test beep + console.log** after click fixed

### Completed (S51-S54)
- [x] Mobile black screen: stale SW cache, cleared Chrome data
- [x] Visualisers: beat-synced (D-169), APK confirmed OK
- [x] PWA standalone import: orange warning (D-170)
- [x] SW auto-update: skipWaiting + clientsClaim + 5min poll
- [x] Stems/mixer: restored by reverting to S51 audio files

---

## Previously Completed (S45–S51)

### S51 Bug Fixes
- [x] APK stem mixer: mute ch1 when stems loaded, hide TRK fader
- [x] Web click alignment: speed-scaled beat map intervals + resync
- [x] Visualisers: reworked to beat-synced (S52 replaced S51 FFT approach)
- [x] PC webapp import: CORS + bind 0.0.0.0 + fallback URLs

### S45–S50
- [x] Track Loading (D-165), Player Persistence (D-166)
- [x] Android Library Header Gap, Web Library (D-163)
- [x] Web Player (S47/S48), Web Settings
- [x] Android Library Dropdowns (D-128), Android Vis Switcher
- [x] Android Mixer Rebuild (S49/S50), Web Mixer Interactive (S50)

---

## Remaining Parity Items
- [ ] Queue items: NeuCard → flat rows (Android)
- [ ] Practice transport: top row = speed (-5/100%/+5) left + A-B loop (A/B/Clear) right
- [ ] Practice: waveform strip with loop region + playhead
- [ ] Verify between-songs screen completeness
- [ ] Verify display prefs not duplicated in Settings (should be drawer-only per D-118)
- [ ] Verify calendar cell shadows match mockup

### Existing Backlog
- [ ] **S31C: On-device testing** — Test Android practice with server beat maps + stems, verify BTrack offline fallback (airplane mode), test web UI visually at thegreentangerine.com.
- [ ] Add more songs via web app (currently 4)
- [ ] User to verify 44 WhatsApp-confirmed fees, then batch-update

## Capture — Alignment + Pipeline (OVERDUE)

### Import Pipeline (S44 — DONE except bulk)
- [x] **Song import workflow** — Web ImportPanel: browse Capture tracks, map metadata, upload MP3, trigger Cloud Run, mark imported.
- [ ] **Bulk import UX** — Multiple recordings → batch import with metadata entry.
- [ ] **Capture history view** — Show previous recordings in sidepanel.

### Capture Diagnostics (flakey but functional)
- [ ] Real-world audio quality test
- [ ] Armed mode end-to-end test
- [ ] FFmpeg encoding audit
- [ ] Concurrent load test
