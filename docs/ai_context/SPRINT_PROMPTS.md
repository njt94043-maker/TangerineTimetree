# TGT — Sprint Pickup Prompts

> Copy-paste the next sprint's prompt to start a fresh session.
> Each prompt gives the AI full context to pick up where we left off.
> At session end, AI provides the prompt for the next sprint.
> SOT docs are at `docs/ai_context/` (project root). CLAUDE.md is at project root.

---

## Sprint S38 — Visual Unification: Tokens + Player Rebuild (DONE)

```
Read docs/ai_context/STATUS.md, docs/ai_context/SPRINT_PROMPTS.md, and docs/ai_context/decisions_log.md (D-118, D-119, D-153). This is Sprint S38.

CONTEXT:
- Design audit COMPLETE. V4 player design LOCKED. S39 features LOCKED. Sprint plan revised for cross-platform parity.
- V4 mirror target mockup: mockups/v4-mirror-target.html (17 screens with canonical design tokens + annotations)
- 4-way comparison: mockups/four-way-comparison.html (V1/V2/V3/V4 — V4 column is the target)
- Both players currently diverge from V4: Android = NeuCard vertical scroll, Web = flat single-component
- Android GigColors has 5 WRONG color values that need correcting to match web canonical tokens
- This sprint is VISUAL ONLY — no new features, no schema changes

GOALS (S38 — visual unification, must complete before any feature work):
1. **Android GigColors token correction** (5 values):
   - bg: #0a0a10 → #08080c
   - text: #e0e0e0 → #d0d0dc
   - dim: #888899 → #7a7a94
   - muted: #555566 → #4a4a60
   - teal: #4dd0e1 → #1abc9c
   - Accent colors already match (green #00e676, orange #f39c12, purple #bb86fc, red #ff5252)

2. **Android player rebuild to V4 target** (LiveScreen.kt + PracticeScreen.kt):
   - Layout: Header → Visual Hero (beat glow, waveform vis, album art placeholder) → Text Panel (scrollable lyrics/chords/notes/drums) → Transport (play/stop, speed, prev/next) → Drawer pull-up
   - Live Mode drawer: Display toggles (Visuals/Chords/Lyrics/Notes/Drums) + Settings (subdiv/count-in/nudge)
   - Practice Mode drawer: Display toggles + Mixer (vertical faders: Click/Track/Drums/Bass/Vox/Other) + Settings (subdiv/count-in/nudge)
   - Both drawers save Display toggles to user_settings (auto-save)
   - Refer to V4 column in four-way-comparison.html for exact layout
   - Beat glow = card-level (D-119), NOT full-screen

3. **Web player rebuild to V4 target** (Player.tsx):
   - Same layout structure as Android (header → hero → text panel → transport → drawer)
   - Live Mode drawer: Display toggles + Settings
   - Practice Mode drawer: Display toggles + Mixer + Settings
   - Match V4 mockup styling exactly (neumorphic cards, shadows, spacing)

4. **Shadow unification**:
   - Canonical raised: 4px 4px 12px rgba(0,0,0,0.8), -1px -1px 1px rgba(40,40,60,0.12)
   - Canonical inset: inset 2px 2px 6px rgba(0,0,0,0.7), inset -1px -1px 1px rgba(40,40,60,0.08)
   - Web: update CSS variables if different
   - Android: update NeuCard/NeuWell composables to match

5. **Verify**:
   - cd web && npx tsc -b && npx vite build (must pass clean)
   - cd android && ./gradlew assembleRelease (must pass clean)

6. **Update SOT docs** and provide S39 sprint prompt.

KEY DECISIONS:
- D-118: Display toggles in bottom sheet drawer (not main screen)
- D-119: Card-level beat glow (not full-screen)
- D-153: Web + Android are mirror apps — same UX, different tech

DO NOT add new features or change schema. Visual alignment only.
```

---

## Sprint S39 — Foundation: Migration + Shared + Cloud Run (NEXT)

```
Read docs/ai_context/STATUS.md, docs/ai_context/SPRINT_PROMPTS.md, and docs/ai_context/decisions_log.md (D-124 onwards). This is Sprint S39.

CONTEXT:
- S38 (visual unification) COMPLETE. Both players match V4 target. Tokens unified.
- S39–S43 is a 6-sprint build sequence. No user testing until ALL sprints complete + audit passes.
- Web + Android are mirror apps (D-153). Full feature parity required.
- Migration SQL partially written at supabase/migrations/20260310000000_s39_song_categories_sharing.sql (NEEDS UPDATE).
- shared/supabase/types.ts partially updated. shared/supabase/queries.ts has imports but sharing CRUD NOT yet written.

GOALS (S39 — foundation layer, both platforms depend on this):
1. **Update migration SQL**:
   - Category rename: tange_cover→tgt_cover, tange_original→tgt_original, personal→personal_cover (D-124)
   - New CHECK constraint: ('tgt_cover','tgt_original','personal_cover','personal_original')
   - song_shares table (D-135): id, song_id FK→songs CASCADE, shared_with FK→profiles, shared_by FK→profiles, created_at, UNIQUE(song_id, shared_with)
   - is_best_take BOOLEAN DEFAULT false on song_stems (D-130)
   - can_access_song() SECURITY DEFINER helper (D-129)
   - RLS rewrite: songs, song_stems, beat_maps, song_shares (per D-125/D-126/D-136)

2. **Complete shared/supabase/types.ts** — SongCategory, SongShare, SongShareWithProfile, helpers

3. **Complete shared/supabase/queries.ts** — sharing CRUD, setBestTake, clearBestTake

4. **Cloud Run beats-only endpoint** (D-148) — skip_stems flag, don't redeploy yet

5. **Push migration**: npx supabase db push
6. **Verify**: cd web && npx tsc -b && npx vite build (must pass clean)
7. **Update SOT docs** and provide S40 sprint prompt.

DO NOT touch web UI or Android code in this sprint. Foundation only.
```

---

## Sprint S40 — Library + SongForm (Both Platforms)

```
Read docs/ai_context/STATUS.md and docs/ai_context/decisions_log.md (D-124 onwards). This is Sprint S40.

CONTEXT:
- S39 complete: migration pushed, shared types/queries done, Cloud Run beats-only code written.
- Mockup: mockups/s39-categories-sharing-mockup.html — screens 1-8 (Library views + SongForm views).
- V4 target: mockups/v4-mirror-target.html — screens 5-9 (Library + SongForm).
- BOTH platforms built together this sprint.

GOALS:
1. **Web Library.tsx** — two dropdowns replacing filter pills (D-128):
   - Scope: All Songs / TGT / My Songs / Shared With Me
   - Type: All / Covers / Originals
   - Category badges (teal TGT, orange personal, purple shared)
   - Owner name tag, lock icons, hide Edit/Delete for non-owned

2. **Web SongForm.tsx** — 4 categories + sharing UI:
   - Category dropdown, owner_id for personal, sharing section for originals
   - Read-only mode for shared songs

3. **Android LibraryScreen.kt** — mirror web Library:
   - Same two dropdowns, category badges, owner tags, lock icons

4. **Android SongForm** (create or update) — mirror web SongForm:
   - 4 categories, sharing section, read-only mode

5. **Android Kotlin updates**:
   - Song.kt: SongCategory enum with new values, SongShare data class
   - SongRepository.kt: category filters, sharing CRUD

6. Verify: tsc -b + vite build clean. gradlew assembleRelease clean.
7. Update SOT docs, provide S41 prompt.

KEY DECISIONS: D-124 (4 categories), D-125 (personal covers visible to all), D-126 (originals opt-in), D-128 (dropdowns not pills).
```

---

## Sprint S41 — Recording + Takes (Both Platforms)

```
Read docs/ai_context/STATUS.md and docs/ai_context/decisions_log.md (D-130 onwards). This is Sprint S41.

CONTEXT:
- S39 (foundation) + S40 (Library/SongForm both) complete.
- Mockup screens: 9-10 (takes), 12a-12b (recording), 13 (post-recording).
- BOTH platforms built together.

GOALS:
1. **Web Takes UI** — takes list per user per song, auto-numbered (D-143), best take star, delete, IndexedDB for non-best

2. **Web Recording** — getUserMedia + MediaRecorder, input picker (D-133), camera toggle (D-132), overdub (D-140), click (D-141), count-in (D-142), post-recording 4 options (D-139), record button in transport (D-150)

3. **Android Takes UI** — mirror web takes (auto-numbered, best star, delete, local storage)

4. **Android Recording** — Oboe input stream or MediaRecorder, CameraX selfie (D-132), overdub via C++ engine (D-140), click during recording (D-141), count-in (D-142), post-recording options (D-139)

5. **New song idea flow** (D-138) — both platforms: create + record immediately

6. Verify: tsc -b + vite build clean. gradlew assembleRelease clean.
7. Update SOT docs, provide S42 prompt.
```

---

## Sprint S42 — View Mode (Both Platforms)

```
Read docs/ai_context/STATUS.md and docs/ai_context/decisions_log.md (D-137 onwards). This is Sprint S42.

CONTEXT:
- S39-S41 complete. Categories, sharing, recording, takes all working on BOTH platforms.
- Mockup screens: 11 (View Mode playback), 14 (View Mode recording).
- BOTH platforms built together.

GOALS:
1. **Web View Mode** — 3rd player tab (Live/Practice/View), hero shows local video or visualiser fallback (D-146), stem mixer in drawer, record button for layering (D-144)

2. **Android View Mode** — mirror web: ExoPlayer/SurfaceView for video, visualiser fallback, record from View Mode (D-144)

3. Verify: tsc -b + vite build clean. gradlew assembleRelease clean.
4. Update SOT docs, provide S43 prompt.
```

---

## Sprint S43 — Capture Alignment + Cloud Run Deploy

```
Read docs/ai_context/STATUS.md, IMPACT_MAP.md, and decisions_log.md (D-148, D-151, D-154–D-158). This is Sprint S43.

CONTEXT:
- S38-S42 ALL COMPLETE. Web + Android have unified visuals, categories, sharing, recording, takes, View Mode.
- Cloud Run beats-only code written in S39 but NOT deployed.
- Capture is MISSING Song `category` field — must be added (D-154).
- Import pipeline is OVERDUE (was S38 target, D-158). NOT built in this sprint but Capture fields must be ready for it.
- ClickTrack is future but considered now (D-155) — Capture already has practice_category/instrument_focus/difficulty for it.

GOALS:
1. **Capture category alignment** (D-154):
   - SQLite: Add `category TEXT NOT NULL DEFAULT ''` to tracks table + migration for existing DBs
   - Backend: Add `category` to TrackUpdate, list_tracks filter, ID3 tagger (write + read)
   - UI types: Add `category` to Track interface
   - TrackDetail: Add category dropdown (4 Song values)
   - TrackCard: Add category badge (teal=TGT, orange=personal)
   - TrackList: Add category filter dropdown
   - theme.css: Add --color-teal (#1abc9c) + --color-purple (#bb86fc) accent vars

2. **Cloud Run deploy** (D-148):
   - skip_stems=true code already in main.py — deploy it
   - gcloud run deploy from cloud-run/

3. **Cloud Run re-analyse endpoint** (D-151):
   - New `/re-analyse` route: accepts song_id, fetches best takes audio URLs, downloads + mixes to temp master, runs madmom, replaces beat_map
   - Deploy with the beats-only deploy

4. **Web: skip_stems + re-analyse** (D-148, D-151):
   - SongForm triggerProcessing: pass skip_stems=true for first takes
   - SongForm: separate "Re-analyse" button that calls /re-analyse endpoint

5. Verify all endpoints end-to-end.
6. Update SOT docs, provide S44 prompt.

DO NOT build the import pipeline in this sprint — that's S44. But Capture MUST have the category field ready for it.
```

---

## Sprint S44 — Import Pipeline + Android SongForm

```
Read docs/ai_context/STATUS.md, IMPACT_MAP.md, and decisions_log.md (D-154, D-158). This is Sprint S44.

CONTEXT:
- S43 done: Capture has category field, Cloud Run deployed (beats-only + re-analyse), web has skip_stems + re-analyse UI.
- Import pipeline is OVERDUE (was S38 target, D-158). This sprint builds it.
- Android has NO SongForm — can't edit songs, trigger processing, or re-analyse.

GOALS:
1. **Import pipeline** (Capture → Web):
   - Web: import UI that connects to localhost:9123/api/library/tracks
   - Browse Capture tracks, preview, select for import
   - Map metadata: track.title→song.name, track.artist→song.artist, track.category→song.category, track.bpm→song.bpm, track.key→song.key
   - Set Song defaults for unmapped fields (4/4, 8ths, straight, 1 bar count-in, default click)
   - Upload MP3 from Capture → Supabase practice-tracks bucket
   - Set created_by to importing user
   - Trigger Cloud Run processing (full pipeline for imports)
   - Mark track as imported in Capture (update song_id FK)

2. **Android SongForm**:
   - Song edit form (category, sharing, notes, lyrics, chords, drum notation)
   - Trigger processing button (calls Cloud Run /process)
   - Re-analyse button (calls Cloud Run /re-analyse)
   - Mirror web SongForm field set

3. Verify: tsc -b + vite build clean. gradlew assembleRelease clean.
4. Update SOT docs, provide audit prompt.
```

---

## Post-S44 — Cross-Platform + Cross-App Surgical Audit

```
Read docs/ai_context/STATUS.md and ALL SOT docs. This is the full audit before user testing.

CONTEXT:
- S38-S44 ALL COMPLETE. All 3 apps aligned:
  - Web + Android: unified V4 visuals, categories, sharing, takes, recording, View Mode, SongForm, processing, re-analyse
  - Capture: category field, badges, filters, theme alignment
  - Cloud Run: beats-only, re-analyse, full pipeline — all deployed
  - Import pipeline: Capture → Web → Cloud Run → both apps
- NO user testing has happened yet. This audit catches everything.

AUDIT CHECKLIST:
1. **Visual parity (3 apps)** — Web, Android, Capture all use same tokens (colours, fonts, shadows). Category badges match across apps.
2. **Schema verification** — Supabase tables match schema_map.md. Capture SQLite tracks table has category field. All RLS policies correct.
3. **Web build** — tsc -b + vite build clean.
4. **Android build** — gradlew assembleRelease clean. Install APK on device.
5. **Feature parity (web ↔ Android)** — verify every feature in D-124–D-158 works on BOTH platforms.
6. **Capture alignment** — category dropdown works, badges display, filters work, ID3 tags written.
7. **Import pipeline** — capture track → web import → Supabase song → Cloud Run → appears on both apps.
8. **Cloud Run** — beats-only, re-analyse, full pipeline — all endpoints verified.
9. **RLS testing** — TGT visible to all, personal covers visible (owner edits only), personal originals = owner + shared only.
10. **Recording flow** — test on web + Android: overdub, click, count-in, post-recording, best take upload.
11. **Edge cases** — no beat map, no stems, take deletion, best take swap, re-analyse with 0 takes.
12. **ClickTrack readiness** — Capture's practice_category/instrument_focus/difficulty fields present and functional.
13. Update all SOT docs. Provide user testing handoff.
```
