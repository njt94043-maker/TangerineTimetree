# TGT — Todo

> Current tasks, priorities, and backlog.
> Update after every task completion. See STATUS.md for instant context.

---

## NEXT: UX Tweaks — Gig Day View Polish
- [x] **Merge GigHub into DayDetail** — accordion cards, full-screen view, pipeline/deposit/docs inline (S63)
- [x] **Remove gig-hub view** from ViewContext + App.tsx (S63)
- [ ] **Nathan's UX tweaks** — testing deployed version, will list issues at start of next session
- [ ] **Map other multi-hop flows** — identify remaining screens with redundant navigation
- [ ] **Apply to BOTH platforms** (D-153) — Android calendar day detail doesn't have invoicing, but shared features should match

## HOT: Gig Rig Hotspot Reliability
- [x] Log Nathan's 2026-06-13 gig failure report in `NATHAN_VERBATIM.md`
- [x] Reproduce PC side on S23 hotspot: Reaper UDP 8000 and Media Server TCP 9200 are alive
- [x] Confirm direct hotspot IP path works: `10.117.252.228:9200/take/songs` returned 200
- [x] Add Android `ACCESS_NETWORK_STATE` + guard network enumeration
- [x] Build fresh APK with hotspot patch (`assembleDebug` + `assembleRelease`)
- [x] Install fresh release APK to both connected phones (`SM_S918B`, `SM_S911B`)
- [x] Confirm live failure mode: Gig Mode still targeted stale `192.168.1.90:8000`
- [x] Emergency-pin release build to `10.117.252.228`, default auto-discovery off, rebuild/install to both phones
- [x] Verify Gig Mode now shows `10.117.252.228:8000`
- [x] Verify both phones can reach `10.117.252.228:9200`
- [ ] Test actual `Start gig` capture fanout when Nathan explicitly wants Reaper/camera recording started
- [ ] POST-GIG: fix pause/resume overwrite; resume must record at true project end, never project start
- [ ] Replace emergency pinned IP with persistent/manual target storage
- [ ] Add peer-camera manual/QR direct-connect fallback; current peer path is mDNS-only

## PDF Templates — DONE
- [x] Print styles: @page margin 0, background preservation, compact spacing (all 28 templates)
- [x] BILL TO: venue name + address fallback when no client
- [x] Title tag: "Invoice TGT-0003 — The Green Tangerine" (fixes PDF filename)
- [x] Bank details: JetBrains Mono for sort code/account number — all 14 invoice + formal invoice templates
- [x] Applied to ALL 7 invoice styles + ALL 7 formal invoice styles (S63)
- [x] Receipts + quotes don't have bank details — no changes needed

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

## BACKLOG — Gig Clip Capture & Auto-Send (SPEC'D · DEFERRED · not started)
> Designer/R&D programme, **decision-locked, awaiting sequencing by the Architect** (Nathan: "won't be
> used straight away"). Spec + staged Builder prompts live in
> `C:\apps\Dev Team R&D Brainstorming Design idea development\gig-capture-and-autosend\`
> (`gig-capture-concept-spec-v2.md` = definitive · `gig-capture-builder-prompts-v1.md` = S0–S4 prompts ·
> `gig-capture-redteam-findings-v1.md` = rationale).

**What:** band's own phones **and** friends/guests at gigs capture video clips that **auto-send to the
laptop over a dedicated gig router** — resumable (pause/continue on drop), positioned on the REAPER
timeline via a **common laptop clock + xcorr**, clean 1080p/25fps multicam source. Fully offline (no cloud).
Replaces the manual post-gig `adb pull`. Lands clips in `D:/Gigs/<date>/video/<device>/` → **zero post-prod change**.

**Locked decisions:** D1 LAN→laptop (Media Server, not cloud — overrides S129's cloud design) · D2 one
engine, own-phone first · D3 iPhone PWA (one-tap QR, foreground-only) · D4 dedicated travel router AP
(fixed SSID + DHCP-reserved laptop IP + firewalled guest net) · D5 best-effort delivery (per-clip, accept
losses) · D6 guest clips = multicam source. Engine = **WorkManager** (not a `dataSync` FGS — 6h cap).

**Stages (each ships value):**
- [ ] **S0** — Resumable upload receiver + `/api/clock` + `gig-timeline-map.jsonl` logger on the Media Server (reuses its existing upload/range/atomic-write patterns; ~150 LOC)
- [ ] **S1** — Own-phone auto-send (Android WorkManager, resumable, received-ledger) — *ships "my phones auto-send"*
- [ ] **S2** — Common-clock stamp (`__lt`) + `insert-videos.lua` pre-positioning; xcorr refines
- [ ] **S3** — Router bring-up + guest onboarding (QR) + guest capture (Android APK + iPhone PWA)
- [ ] **S4** — Per-gig secret + guest firewall + transport-gated throttle + quotas + consent/takedown
- [ ] **ADRs to log on pickup:** D1 (LAN-over-cloud, retires S129 cloud design) + D4 (router)

**Dependency:** the open **MS pause/resume overwrite bug** (REAPER-side, carried S211) must be fixed first
— it corrupts the `position_sec` the S2 timeline-map relies on.

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
