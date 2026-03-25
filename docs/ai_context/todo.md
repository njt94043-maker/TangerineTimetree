# TGT — Todo

> Current tasks, priorities, and backlog.
> Update after every task completion. See STATUS.md for instant context.

---

## NEXT: UX Simplification — Screen/Flow Consolidation
- [ ] **Audit gig day navigation** — too many hops (DayDetail → GigHub → Invoice). Consolidate into one "do all" screen. NO features removed.
- [ ] **Map all multi-hop flows** across the app — identify other screens with redundant landing pages
- [ ] **Apply to BOTH platforms** (D-153)

## PDF Templates — Fixed
- [x] Print styles: @page margin 0, background preservation, compact spacing
- [x] BILL TO: venue name + address fallback when no client
- [x] Title tag: "Invoice TGT-0003 — The Green Tangerine" (fixes PDF filename)
- [x] Bank details: JetBrains Mono for sort code/account number, brighter, larger
- [ ] Apply same fixes to ALL 7 styles (currently only Premium Dark fully updated)
- [ ] Apply to receipt, quote, formal invoice templates

## S61 — Drift Correction + Remaining Items

### Web Click — Working but drifts after ~60s
- [x] S52-S56: Click foreground silence diagnosed and fixed (AnalyserNode parallel, step 2c tick loop)
- [x] S57: Tested resyncToPosition in rAF — BROKE click (reverted immediately)
- [x] S58: Research (Chris Wilson + Tone.js) — root cause: race condition between rAF and setInterval
- [x] S58: Moved resyncToPosition into ClickScheduler's 25ms schedule() timer
- [x] S59: Fixed click not starting — scheduler was gated behind DB pref. Now always runs, mute = audibility only.
- [x] S60: Found root cause of total click silence — resyncToPosition pushed nextBeatTime past lookahead window due to SoundTouch ~93ms position latency. Disabled resync, natural scheduling works.
- [x] S60: Removed debug UI (banner, test beep, console.logs, __BUILD_TIME__)
- [x] S60: Pruned SOT docs, created WEB_AUDIO_REFERENCE.md
- [ ] **S61: Re-enable resyncToPosition with latency compensation** — subtract ~93ms from SoundTouch position
- [ ] **S61: Test 3+ minutes** — verify click stays in time after drift fix
- [ ] **S61: Evaluate FFT necessity** — D-169 says vis is beat-synced, may not need FFT at all

### Completed (S51-S54)
- [x] Mobile black screen: stale SW cache, cleared Chrome data
- [x] Visualisers: beat-synced (D-169), APK confirmed OK
- [x] PWA standalone import: orange warning (D-170)
- [x] SW auto-update: skipWaiting + clientsClaim + 5min poll
- [x] Stems/mixer: restored by reverting to S51 audio files

---

## Remaining Parity Items
- [x] Queue items: NeuCard → flat rows (Android) — already done per S60 audit
- [x] Practice transport: speed + A-B loop — already done both platforms per S60 audit
- [x] Display prefs not duplicated in Settings — confirmed correct per D-171
- [ ] Web set-complete modal (Android has it at LiveScreen.kt:691-775, web doesn't)
- [ ] Web waveform strip with loop region + playhead (Android has it)
- [ ] Verify between-songs screen completeness
- [ ] Verify calendar cell shadows match mockup

### Existing Backlog
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
