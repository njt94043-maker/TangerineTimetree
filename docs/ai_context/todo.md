# TGT — Todo

> Current tasks, priorities, and backlog.
> Update after every task completion. See STATUS.md for instant context.

---

## NEXT: Timetree reliability → 2026 UI (hub S244 programme)
> Master spec: `C:\apps\Dev Team\specs\tgt\s244-timetree-function-audit.md`. Order LOCKED by Nathan:
> verify/prune FIRST, humanise UI SECOND. Management features are NEVER removed — improved only.
- [x] Removal slice (web v1.6.1, S244): XR18 camera surface, AppTutorial, offline queue (5 flows now fail-loud), S41 orphans, QR upload CTA hidden
- [ ] Authed prod drive: every tab + More item routes, day-peek opens, FAB on Calendar only + offline negative test (booking/away save → visible error) — now on v1.7.0 tab-bar shell; run hub smoke.js v2
- [ ] Nathan device test (from S243): lock-screen push on Samsung + Home-Screen iPhone
- [ ] Phase 1: function-by-function live pass on prod, mobile viewport (audit spec table A) — booking flow first (its error paths just changed)
- [~] Phase 2 — calendar-first nav: **slice A SHIPPED (s258, v1.7.0)** — bottom tab bar + FAB + day-peek replace the drawer (D-173). Remaining: slice B quick-add booking sheet · slice C per-member main-calendar layouts (month / weekends-with-linked-weekdays / free-dates; available = no member away) · slice D cell-density pass

## HOT: Gig Rig (remaining)
- [ ] Test actual `Start gig` capture fanout when Nathan explicitly wants Reaper/camera recording started
- [ ] Add peer-camera manual/QR direct-connect fallback; current peer path is mDNS-only
- [x] Pause/resume overwrite — CONFIRMED FIXED (S222 3-set rig test; md5-verified no overwrite). Left ticked pending nothing; if it ever recurs, suspect the S211 connection-drop/reconnect, NOT the record cursor.

## Gig Mode — production-quality template upgrade (deferred · fold in AFTER the take-mode per-instrument templates land)
> Bring the gig recording template to the same free pro-spec as the take-mode chains (s221/s212 pattern), tuned for LIVE.
- [ ] Per-instrument LIVE chains + bus routing on the gig template (kit · vox · guitar · bass · keys → instrument bus → live mix bus → finishing master)
- [ ] Selectable / strip-back drum kit per gig (arm-only / on-demand mics) — belongs to GIG mode, NOT take mode
- [ ] Phone audio as ambiance / room (ties to Gig Clip Capture audio + video spine)
- Guiding principle (Nathan, verbatim intent): "retain genuine live sound as much as possible"
- Sequence: gated on take-mode per-instrument templates (s221). See s212 · Gig Clip Capture lane · `proj-tgt--gig-recording-rig`.

## Existing Backlog
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
**S244 note:** Nathan expanded the fan-capture idea — ties into the studio recorder with its own lightweight
APK+PWA; Timetree's QR landing page stays, and when its upload is wired the videos MUST land in the SAME
place as this pipeline (one bucket/routing — see hub memory `proj-tgt--auto-video-ingestion`).

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
- [ ] **Dependency:** MS pause/resume overwrite — **CLEAR** (S220 repro + S222 3-set rig confirm); re-confirm after Nathan's real-gig test, but this no longer blocks the backend lane.

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

---

## PRUNED (hub S244 doc purge, 2026-07-03)
Removed as obsolete — they tracked the web Player/StagePrompter/SongList/SetlistList components deleted in
the S118 pivot (web playback UI killed; practice lives in `web/src/practice/` PracticeMixer): S61 web-click
drift correction + FFT evaluation, web set-complete modal, web waveform strip, between-songs screen check,
S63 "Gig Day UX tweaks" header (shipped), PDF-templates section (fully DONE), calendar-cell-shadow mockup
check (S60-era). History in git if ever needed.
