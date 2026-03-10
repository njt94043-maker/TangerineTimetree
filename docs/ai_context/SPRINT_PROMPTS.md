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

## Sprint S43 — Cloud Run: Deploy + Re-analyse

```
Read docs/ai_context/STATUS.md and docs/ai_context/decisions_log.md (D-148, D-151). This is Sprint S43.

CONTEXT:
- S38-S42 ALL COMPLETE. Both platforms fully built with unified visuals, categories, sharing, recording, takes, View Mode.
- Cloud Run beats-only code written in S39 but NOT deployed.

GOALS:
1. **Deploy beats-only endpoint** (D-148): skip_stems=true → madmom only
2. **Re-analyse from mixed master** (D-151): server mixes best takes → madmom → replaces beat_map. Web + Android: "Re-analyse" button on SongForm.
3. **Deploy**: gcloud run deploy
4. Verify both endpoints end-to-end.
5. Update SOT docs, provide audit prompt.
```

---

## Post-S43 — Cross-Platform Surgical Audit

```
Read docs/ai_context/STATUS.md and all SOT docs. This is the cross-platform audit before user testing.

CONTEXT:
- S38-S43 ALL COMPLETE. Both web + Android have: unified V4 visuals, categories, sharing, takes, recording, View Mode, overdub, selfie video, USB interfaces.
- Cloud Run has beats-only + re-analyse endpoints deployed.
- NO user testing has happened yet. This audit catches everything before Nathan and the boys test.

AUDIT CHECKLIST:
1. **Visual parity** — compare both apps side-by-side against V4 mockup (17 screens). Tokens, shadows, spacing, layouts match.
2. **Schema verification** — Supabase tables match schema_map.md. All RLS policies correct. can_access_song() works.
3. **Web build** — tsc -b + vite build clean.
4. **Android build** — gradlew assembleRelease clean. Install APK on device.
5. **Feature parity** — verify every feature in D-124–D-153 works on BOTH platforms.
6. **RLS testing** — TGT visible to all, personal covers visible to all (owner edits only), personal originals = owner + shared only, stem ownership.
7. **Recording flow** — test on both: overdub, click, count-in, post-recording, best take upload.
8. **Cloud Run** — beats-only + re-analyse endpoints.
9. **Edge cases** — no beat map, no stems, take deletion, best take swap.
10. Update all SOT docs. Provide user testing handoff.
```
