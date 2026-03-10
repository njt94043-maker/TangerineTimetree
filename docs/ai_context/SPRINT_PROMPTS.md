# TGT — Sprint Pickup Prompts

> Copy-paste the next sprint's prompt to start a fresh session.
> Each prompt gives the AI full context to pick up where we left off.
> At session end, AI provides the prompt for the next sprint.

---

## Sprint S39 — Foundation: Migration + Shared + Cloud Run (NEXT)

```
Read native/docs/ai_context/STATUS.md, native/docs/ai_context/SPRINT_PROMPTS.md, and native/docs/ai_context/decisions_log.md (D-124 onwards). This is Sprint S39.

CONTEXT:
- S39–S45 design is COMPLETE. 15-screen mockup approved at mockups/s39-categories-sharing-mockup.html. 30 decisions locked (D-124–D-153).
- This is a 7-sprint build sequence (S39–S45). No user testing until ALL sprints complete + cross-platform audit passes.
- Web + Android are mirror apps (D-153). Web = iOS users (Neil/James/Adam). Android = Nathan. Full feature parity required.
- Migration SQL partially written at supabase/migrations/20260310000000_s39_song_categories_sharing.sql (NEEDS UPDATE — see below).
- shared/supabase/types.ts partially updated (SongCategory changed, SongShare added, helpers added).
- shared/supabase/queries.ts has imports added but sharing CRUD functions NOT yet written.

GOALS (S39 — foundation layer, both platforms depend on this):
1. **Update migration SQL**:
   - Category rename: tange_cover→tgt_cover, tange_original→tgt_original, personal→personal_cover (D-124)
   - New CHECK constraint: ('tgt_cover','tgt_original','personal_cover','personal_original')
   - song_shares table (D-135): id, song_id FK→songs CASCADE, shared_with FK→profiles, shared_by FK→profiles, created_at, UNIQUE(song_id, shared_with)
   - is_best_take BOOLEAN DEFAULT false on song_stems (D-130)
   - can_access_song() SECURITY DEFINER helper (D-129): TGT = all auth, personal_cover = all auth, personal_original = owner OR song_shares
   - RLS rewrite: songs (SELECT/INSERT/UPDATE/DELETE per D-125/D-126), song_stems (SELECT/INSERT/UPDATE/DELETE per D-136), beat_maps, song_shares
   - Personal covers visible to ALL (D-125). Personal originals = owner + song_shares only (D-126).

2. **Complete shared/supabase/types.ts**:
   - Verify SongCategory = 'tgt_cover' | 'tgt_original' | 'personal_cover' | 'personal_original'
   - SongShare interface, SongShareWithProfile
   - isPersonalSong(), isTgtSong() helpers
   - StemSource type if needed ('uploaded' | 'auto' | 'recorded')

3. **Complete shared/supabase/queries.ts**:
   - getSongSharesWithProfiles(songId) — shares with profile names
   - shareSong(songId, sharedWithId) — creates share
   - unshareSong(songId, sharedWithId) — deletes share
   - setBestTake(stemId) — set is_best_take, clear previous best for same user+song
   - clearBestTake(stemId) — unset is_best_take

4. **Cloud Run beats-only endpoint** (D-148):
   - Add skip_stems parameter or /beats-only route to main.py
   - When skip_stems=true: run madmom only, skip Demucs. For solo instrument takes.
   - Don't redeploy yet — just update the code. Deployment in S45.

5. **Push migration**: npx supabase db push
6. **Verify**: cd web && npx tsc -b && npx vite build (must pass clean)
7. **Update SOT docs** and provide S40 sprint prompt.

KEY DECISIONS TO FOLLOW:
- D-124: 4 categories. D-125: personal covers visible to all. D-126: personal originals opt-in.
- D-129: can_access_song() helper. D-130: is_best_take on song_stems.
- D-135: song_shares table. D-136: stem ownership via created_by.
- D-148: Cloud Run beats-only for takes (no Demucs on solo instruments).
- D-149: Take deletion is manual, no auto-promote.

DO NOT touch web UI or Android code in this sprint. Foundation only.
```

---

## Sprint S40 — Web: Library + SongForm Categories + Sharing

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/decisions_log.md (D-124 onwards). This is Sprint S40.

CONTEXT:
- S39 complete: migration pushed, shared types/queries done, Cloud Run beats-only code written.
- Mockup: mockups/s39-categories-sharing-mockup.html — screens 1-8 are relevant (Library views + SongForm views).

GOALS:
1. **Library.tsx** — replace filter pills with two dropdowns (D-128):
   - Scope: All Songs / TGT / My Songs / Shared With Me
   - Type: All / Covers / Originals
   - Category badges (teal TGT, orange personal, purple shared)
   - Owner name tag for personal songs
   - Lock icon for songs user can't edit
   - Hide Edit/Delete for non-owned personal songs

2. **SongForm.tsx** — 4 categories + sharing UI:
   - Category dropdown: TGT Cover, TGT Original, Personal Cover, Personal Original
   - owner_id set when personal (isPersonalSong helper)
   - Sharing section (personal originals only): list shared members, add/remove sharing
   - Read-only mode for shared songs user doesn't own

3. Verify: tsc -b + vite build clean
4. Update SOT docs, provide S41 prompt.

KEY DECISIONS: D-124 (4 categories), D-125 (personal covers visible to all), D-126 (originals opt-in), D-128 (dropdowns not pills).
```

---

## Sprint S41 — Web: Recording + Takes + Post-Recording

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/decisions_log.md (D-130 onwards). This is Sprint S41.

CONTEXT:
- S39 (foundation) + S40 (web Library/SongForm) complete.
- Mockup screens: 9-10 (takes views), 12a-12b (recording video off/on), 13 (post-recording options).

GOALS:
1. **Takes UI** in SongForm — takes list per user per song:
   - Auto-numbered (D-143). Show take # + date + duration.
   - Star icon for best take. Tap to set/clear best (D-130/D-131).
   - Delete takes (D-149) — manual, no auto-promote.
   - Best-only uploads to Supabase storage (D-145). Non-best in IndexedDB.

2. **Recording flow** — getUserMedia + MediaRecorder:
   - Input device picker via enumerateDevices() (D-133) — in drawer
   - Camera toggle for selfie (D-132) — in drawer. Video saved locally (File System Access API / download fallback).
   - Record button in transport bar replaces play (D-150). Tab switches to "Record" (red).
   - Overdub: StemMixer plays existing stems while recording mic input (D-140). User controls via drawer.
   - Click track active during recording (D-141). Toggle in drawer.
   - Count-in: user-defined 0/1/2/4 bars in drawer (D-142). Uses song BPM from beat map or manual field.
   - Recording UI: video OFF = neumorphic visualiser fills hero (D-147). Video ON = camera in hero + input bar underneath.

3. **Post-recording options** (D-139) — 4 buttons:
   - Discard & Re-take, Save & Re-take, Save as Take, Save & Preview
   - Mark as Best toggle (D-145) — OFF by default, ON uploads to cloud

4. **New song idea flow** (D-138):
   - Create song with minimal metadata (title + personal_original) → immediate record
   - First take triggers Cloud Run madmom-only (D-148) — no Demucs on solo instrument

5. **IndexedDB** for local take storage — key structure userId:songId:takeNumber

6. Verify: tsc -b + vite build clean. Update SOT docs, provide S42 prompt.
```

---

## Sprint S42 — Web: View Mode + Record from View Mode

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/decisions_log.md (D-137 onwards). This is Sprint S42.

CONTEXT:
- S39-S41 complete. Categories, sharing, recording, takes all working on web.
- Mockup screens: 11 (View Mode playback), 14 (View Mode recording).

GOALS:
1. **View Mode** — 3rd player tab (D-137):
   - Tab: Live / Practice / View
   - Hero: local best-take video if available, neumorphic visualiser fallback if not (D-146)
   - All audio stems play from Supabase (original mix + auto stems + best takes)
   - Stem mixer in drawer (same as Practice)
   - Transport: play/pause, seek, prev/next

2. **Record from View Mode** (D-144):
   - Record button in transport (replaces play, D-150)
   - Same recording flow as S41 — overdub, click, count-in, camera, post-recording options
   - Video hero dims during recording, REC overlay + camera PIP (screen 14)
   - Natural layering workflow: listen → hear something → hit record → play along

3. Verify: tsc -b + vite build clean. Update SOT docs, provide S43 prompt.
```

---

## Sprint S43 — Android: Categories + Sharing + Takes UI

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/decisions_log.md (D-124 onwards). This is Sprint S43.

CONTEXT:
- S39-S42 complete. Web has full categories, sharing, recording, takes, View Mode.
- Android needs to mirror web features (D-153). Same Supabase backend, same RLS.
- Android currently has old category values (tange_cover, tange_original, personal).

GOALS:
1. **Kotlin data classes** — update Song.kt:
   - SongCategory enum: TGT_COVER, TGT_ORIGINAL, PERSONAL_COVER, PERSONAL_ORIGINAL
   - Add SongShare data class
   - Add is_best_take to SongStem

2. **SongRepository** — update queries:
   - Category filter with new values
   - Sharing CRUD (getSongShares, shareSong, unshareSong)
   - setBestTake, clearBestTake

3. **LibraryScreen** — mirror web Library:
   - Two dropdowns (Scope + Type) replacing filter pills (D-128)
   - Category badges, owner tags, lock icons
   - Same filter logic as web

4. **SongForm** (if exists, or create) — mirror web SongForm:
   - 4 categories dropdown
   - Sharing section for personal originals
   - Read-only mode for shared songs

5. **Takes list** — mirror web takes view:
   - Auto-numbered takes per user per song
   - Best take star, delete, local storage for non-best

6. Verify: gradlew assembleRelease clean. Update SOT docs, provide S44 prompt.
```

---

## Sprint S44 — Android: Recording + View Mode

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/decisions_log.md (D-132 onwards). This is Sprint S44.

CONTEXT:
- S39-S43 complete. Web fully built. Android has categories + sharing + takes UI.
- Android needs recording + View Mode to match web (D-153).
- C++ Oboe engine already supports audio output streams. Input stream needed for recording.

GOALS:
1. **Recording** — Oboe input stream or Android MediaRecorder:
   - USB audio interface support via Android audio routing
   - CameraX for selfie video (D-132) — video saved to local storage
   - Overdub: C++ engine plays stems while recording input (D-140)
   - Click during recording (D-141) — C++ metronome stays active
   - Count-in (D-142) — same logic as web, uses BPM from beat map
   - Record button in transport (D-150)

2. **Post-recording** (D-139) — 4 options: Discard & Re-take, Save & Re-take, Save as Take, Save & Preview
   - Mark as Best toggle (D-145)
   - Upload best to Supabase, non-best stays local (Room DB or files)

3. **View Mode** — 3rd player tab (D-137):
   - ExoPlayer or SurfaceView for local video playback
   - Visualiser fallback when no video (D-146)
   - Record from View Mode (D-144)

4. **New song idea flow** (D-138) — create + record immediately
   - First take triggers Cloud Run madmom-only (D-148)

5. Verify: gradlew assembleRelease clean. Update SOT docs, provide S45 prompt.
```

---

## Sprint S45 — Cloud Run: Re-analyse + Beats-only Deploy

```
Read native/docs/ai_context/STATUS.md and native/docs/ai_context/decisions_log.md (D-148, D-151). This is Sprint S45.

CONTEXT:
- S39-S44 complete. Web + Android fully built with categories, sharing, recording, takes, View Mode.
- Cloud Run beats-only code written in S39 but NOT deployed.

GOALS:
1. **Deploy beats-only endpoint** to Cloud Run (D-148):
   - skip_stems=true → madmom only, no Demucs
   - Test with a solo instrument audio file

2. **Re-analyse from mixed master** (D-151):
   - Server endpoint that: fetches all best-take audio files for a song → mixes into single WAV → runs madmom → replaces beat_map
   - Web UI: "Re-analyse" button on SongForm (triggers Cloud Tasks job)
   - Android: same button, same endpoint

3. **Deploy**: gcloud run deploy with updated main.py
4. **Also deploy**: error field clearing fix from main.py (pending since S38)
5. Verify both endpoints work end-to-end.
6. Update SOT docs, provide audit prompt.
```

---

## Post-S45 — Cross-Platform Surgical Audit

```
Read native/docs/ai_context/STATUS.md and all SOT docs. This is the cross-platform audit before user testing.

CONTEXT:
- S39-S45 ALL COMPLETE. Both web + Android have: categories, sharing, takes, recording, View Mode, overdub, selfie video, USB interfaces.
- Cloud Run has beats-only + re-analyse endpoints deployed.
- NO user testing has happened yet. This audit catches everything before Nathan and the boys test.

AUDIT CHECKLIST:
1. **Schema verification** — Supabase tables match schema_map.md. All RLS policies correct. can_access_song() works.
2. **Web build** — tsc -b + vite build clean. Test all 15 mockup screens against live web app.
3. **Android build** — gradlew assembleRelease clean. Install APK on device.
4. **Feature parity** — verify every feature in D-124–D-153 works on BOTH platforms.
5. **RLS testing** — create songs as different users, verify visibility rules:
   - TGT songs: all members see + edit
   - Personal covers: all members see, only owner edits
   - Personal originals: only owner + shared members see
   - Stem ownership: users can only modify their own stems
6. **Recording flow** — test on both platforms: overdub, click, count-in, post-recording options, best take upload
7. **Cloud Run** — verify beats-only + re-analyse endpoints
8. **Edge cases** — song with no beat map, song with no stems, take deletion, best take swap
9. **Big picture check** — does this serve the band management concept? Nathan on stage with click, others practicing from web, everyone recording takes, multi-cam offline workflow.
10. Update all SOT docs. Flag any issues found. Provide user testing handoff.
```
