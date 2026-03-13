# TGT — Todo

> Current tasks, priorities, and backlog.
> Update after every task completion. See STATUS.md for instant context.

---

## S53 — Web Click Fix + Mobile Black Screen

### Web Click — Rewritten to OscillatorNode
- [x] Code fix: getPlayerPrefs() null fallback to defaults (S52)
- [x] Code fix: BPM/time-sig/click-sound config fallbacks for 0/null (S52)
- [x] Code fix: ClickScheduler.getSecondsPerBeat() safety for BPM=0 (S52)
- [x] Code fix: Full ClickScheduler rewrite — OscillatorNode + gain envelope replaces AudioBuffer (S53)
- [ ] **STILL BROKEN**: OscillatorNode rewrite did not fix click. Problem is upstream of ClickScheduler. Needs DevTools debugging next session.

### Mobile Black Screen — FIXED
- [x] Root cause: stale SW cache from before skipWaiting/clientsClaim deploy
- [x] Fix: Cleared Chrome data on phone. SW auto-update prevents recurrence.

### Visualisers — Reworked (D-169)
- [x] Code fix: All 3 modes beat-synced (quick attack, slow release), NOT FFT. Both platforms.
- [x] APK confirmed "ok for now" by Nathan.
- [ ] Web vis not yet tested by user (was blocked by click/cache issue).

### PWA Standalone Import (D-170)
- [x] Standalone detection + orange warning banner.
- [x] Nathan accepts limitation — use Chrome browser for import.

### SW Auto-Update
- [x] skipWaiting + clientsClaim + cleanupOutdatedCaches
- [x] controllerchange listener auto-reloads page
- [x] 5-minute update check interval
- [x] Verified: mobile black screen was the last stale-cache user. Auto-update now active.

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
