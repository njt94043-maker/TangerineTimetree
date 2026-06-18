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
- [ ] POST-GIG: pause/resume overwrite — **S220: NOT reproducible; appears already fixed (stale todo, nobody was checking).** Live 2-set repro on the rig: fresh gig → record set1 [0→3.76s] → cursor parked at 0 (the danger condition) → `sendRecord` → **set2 appended at 3.76, length 5.94, no overwrite**; `position_sec` tracked accurately throughout (so the Clips-backend dependency below is clear too). The S119/S120 cursor-to-end (`sendRecord` = OSC bundle [40043 move-cursor-to-end + 1013 record]) does its job even from a parked-at-0 cursor. **Left open pending Nathan's real-gig test (live audio + full sets) to tick fully.** If it ever recurs, suspect the S211 connection-drop/reconnect, NOT the record cursor (a re-sent "start" is collision-guarded to `-N.rpp`, can't overwrite).
- [x] Replace emergency pinned IP with persistent/manual target storage — **DONE S211** (`RigTargetStore` persistent rig target + knock-before-trust; emergency pin removed)
- [ ] Add peer-camera manual/QR direct-connect fallback; current peer path is mDNS-only

## Gig Mode — production-quality template upgrade (NEW · deferred · fold in AFTER the take-mode per-instrument templates land)
> Gig mode is "basically working" — full-set / per-set live capture (S119), pause/resume verified (S220, see HOT above) — but its recording template (`TEMPLATE`, the gig project) is BARE next to the take-mode covers. Bring it to the SAME "best in its class" free pro-spec as the take-mode per-instrument chains (the s221 ②·4 / s212 pattern), tuned for GIG mode's own layers + bus needs. (Nathan, S220.)
- [ ] **Per-instrument LIVE chains + bus routing** on the gig template — the live XR18 channels (kit · vox · guitar · bass · keys · …) each through an appropriate chain → instrument bus → a live mix bus → finishing master. Mirror the s221 take-mode chains (TDR Nova/SlickEQ/Kotelnikov · Analog Obsession LALA/FETish · Neural Amp Modeler · Ignite SHB-1/NadIR · Valhalla Supermassive — all free), **tuned for LIVE**.
- [ ] **Selectable / strip-back drum kit per gig** — gig mode may run a smaller kit than the full home setup, so the gig kit-setup picks WHICH drum mics/channels (arm-only / on-demand). This is the strip-back idea Nathan raised, now correctly placed here: it belongs to GIG mode, NOT take mode (home/take always tracks the full kit). (S220.)
- [ ] **Phone audio as ambiance / room** — optionally fold the peer phones' captured audio into the gig mix for added ambiance + realism (ties to the **Gig Clip Capture** lane's audio + the video spine below).
- [ ] **Guiding principle (Nathan, verbatim intent): "retain genuine live sound as much as possible"** — the template ENHANCES the real live feel, never over-processes it into a sterile studio sound.
- **Sequence + cross-ref:** gated on the take-mode per-instrument templates (s221) proving the chain/bus/**on-demand-track** pattern → gig mode reuses it. See: s221 (take-mode templates) · s212 (FX-template pattern) · the Gig Clip Capture lane (phone audio) · `proj-tgt--gig-recording-rig` (the rig).

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

## ACTIVE (lightweight) — Gig Clip Capture & Auto-Send ("TGT Clips" APK + PWA)
> **Greenlit 2026-06-17. Designer (R&D branch) leads the clients; Architect owns the backend.** Won't be
> deployed at a gig straight away. **Don't cross paths:** Designer will NOT touch REAPER / Media Server /
> the laptop rig while REAPER work is live — client lane uses an isolated mock backend (:9300). Docs in
> `C:\apps\Dev Team R&D Brainstorming Design idea development\gig-capture-and-autosend\`:
> `gig-capture-api-contract-v1.md` (frozen interface) · `gig-capture-builder-prompts-client-v2.md`
> (APK/PWA) · `gig-capture-architect-backend-instructions-v1.md` (THIS laptop's backend) ·
> `gig-capture-test-plan-v1.md` · `gig-capture-concept-spec-v2.md` (design) · red-team (rationale).

**What:** a NEW lightweight standalone app (Android APK + iPhone/web PWA) for band + guests to capture clips
that **auto-send to the laptop over a dedicated gig router** — resumable, clean 1080p/25fps multicam source,
clip stamped in laptop-time for timeline placement. Fully offline (no cloud). Lands in
`D:/Gigs/<date>/video/<device>/` → **zero post-prod change**. NOT a change to the GigBooks APK.

**Locked:** D1 LAN→laptop (not cloud — overrides S129 cloud design) · D2 one engine · D3 iPhone PWA
(one-tap QR, foreground-only) · D4 travel router AP (DHCP-reserved laptop IP + firewalled guest net) · D5
best-effort delivery · D6 guest clips = multicam source. Android uploader = **WorkManager** (not `dataSync` FGS).

**CLIENT lane (Designer — build now against mock):**
- [ ] **C1** — PWA: capture (native-pick / MediaRecorder) + resumable tus upload + wake-lock + IndexedDB resume
- [ ] **C2** — Thin native APK: CameraX 1080p/25fps + WorkManager resumable uploader (= own-phone auto-send)
- [ ] **C3** — Onboarding + guest UX (optional name, consent) + APK/PWA parity
- [ ] **C4** — Client hardening (respect upload throttle, 401/413/507 handling)

**BACKEND lane (Architect — this laptop; when REAPER work frees up):**
- [ ] tus upload receiver + `/api/clock` + `/api/active-gig` + upload-status + per-gig tokens + app-QR render
- [ ] `gig-timeline-map.jsonl` logger + `insert-videos.lua` pre-positioning + router firewall doc
- [ ] **ADRs:** D1 (LAN-over-cloud, retires S129 cloud design) + D4 (router)
- [ ] **Dependency:** fix the open **MS pause/resume overwrite bug** (S211) first — it corrupts the
      `position_sec` the timeline-map relies on. **S220: this dependency looks CLEAR** — pause/resume
      didn't overwrite in a live 2-set repro and `position_sec` tracked accurately (see the HOT section
      above). Re-confirm after Nathan's real-gig test, but this likely no longer blocks the backend lane.

**Out of lane (flag):** auto-uploading GigBooks' own orchestrator recordings = a GigBooks-side follow-on
(GigBooks is being actively worked) — not in the TGT Clips client lane.

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
