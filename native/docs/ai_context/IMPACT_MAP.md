# TGT — Impact Map

> **"If you touch A, check B, C, and D."**
> Read this AFTER STATUS.md. Before making changes, scan the relevant domain below.
> Update when new coupling is discovered.

---

## How To Use This Document

Before changing any file, find its domain below. The **Ripple** column lists everything else that must be checked, updated, or tested when that domain changes. This prevents the AI from changing `z` without considering `a`, `b`, and `j`.

---

## 1. Gig Mutations (create/update/delete)

| Touch | Ripple |
|-------|--------|
| `shared/supabase/queries.ts` (createGig, updateGig, deleteGig) | Changelog logic (same file, logGigChange) — depends on fetching current values before update |
| | `web/src/hooks/useOfflineQueue.ts` — gig mutations must be in type union + replayOne switch |
| | `web/src/hooks/useCalendarData.ts` — realtime subscription refetches on any gig change |
| | `web/src/components/Calendar.tsx` — dot rendering uses computeDayStatus() from shared types |
| | `web/src/components/DayDetail.tsx` — day sheet shows gig list, incomplete badge, "Add Booking" |
| | `web/src/components/BookingWizard.tsx` — creates gigs (quick + full flow) |
| | `web/src/components/GigHub.tsx` — pipeline display, invoice/quote generation from gig |
| | `shared/supabase/types.ts` — Gig interface, isGigIncomplete(), computeDayStatus() |
| | `android/.../GigRepository.kt` — getGigsForMonth (read-only, but must match schema) |
| | `android/.../CalendarScreen.kt` — renders gig dots + day detail panel |
| | Receipt split: `queries.ts` createReceipts() divides fee among all members |

**Key gotcha**: Offline queue only covers gig + away_date mutations. Adding new mutation types requires updating BOTH `useOfflineQueue.ts` (web) AND the type union. No offline queue exists for Android.

---

## 2. Song Schema Changes

| Touch | Ripple |
|-------|--------|
| Supabase `songs` table | Migration file needed, push via `supabase db push` |
| | `shared/supabase/types.ts` — Song interface + SongCategory type + utility types |
| | `shared/supabase/queries.ts` — getSongs, createSong, updateSong, searchSongs, all filter queries |
| | `android/.../Song.kt` — Kotlin data class (ALL numeric fields must be Double, not Int) |
| | `android/.../SongRepository.kt` — getSongs, updateBeatInfo, getBeatMap |
| | `android/.../AppViewModel.kt` — song selection, engine config, analysis, stem loading |
| | `android/.../LibraryScreen.kt` — song cards, filter pills, search |
| | `web/src/components/SongForm.tsx` — category selector, owner picker, drum notation (role-based) |
| | `web/src/components/SongList.tsx` — song list display |

**Key gotcha**: Postgres `numeric` serialises as `150.00`. Kotlin models must use `Double`, not `Int`. See gotchas.md.

---

## 3. Setlist Schema Changes

| Touch | Ripple |
|-------|--------|
| Supabase `setlists` / `setlist_songs` tables | Migration file |
| | `shared/supabase/types.ts` — Setlist, SetlistSong, SetlistWithSongs, SetlistType |
| | `shared/supabase/queries.ts` — getSetlists, setSetlistSongs, getSetlistWithSongs, filter queries |
| | `android/.../Setlist.kt` — Kotlin data class |
| | `android/.../SetlistRepository.kt` — getSetlists, filters |
| | `android/.../AppViewModel.kt` — setlist selection, currentSetlistSongs, queue reorder |
| | `android/.../LibraryScreen.kt` — setlist cards, type filter pills |
| | `android/.../LiveScreen.kt` — queue overlay reads currentSetlistSongs |
| | `web/src/components/SetlistList.tsx` + `SetlistDetail.tsx` — type selector, band_name |
| | `shared/templates/setlistTemplate.ts` — PDF generation uses setlist fields |

---

## 4. Audio Engine Changes (Android C++)

| Touch | Ripple |
|-------|--------|
| `android/.../cpp/audio_engine.h/cpp` | All C++ source files (metronome, track_player, mixer, BTrack) |
| | `android/.../cpp/CMakeLists.txt` — must include ALL .cpp files (SoundTouch too) |
| | `android/.../AudioEngineBridge.kt` — JNI external declarations must match C++ signatures exactly |
| | `android/.../AppViewModel.kt` — calls bridge functions, manages engine state |
| | `android/.../LiveScreen.kt` — transport, BPM controls, beat display |
| | `android/.../PracticeScreen.kt` — speed, stems, waveform, A-B loop |

**Key gotcha**: JNI function names must match package path exactly. No bounds checking on channel indices — Kotlin must validate before calling.

---

## 5. Audio Engine (Web — S36/S37)

| Touch | Ripple |
|-------|--------|
| New TypeScript audio engine (S36) | `shared/supabase/queries.ts` — getBeatMap, getStemsBySongId |
| | `shared/supabase/types.ts` — BeatMap, SongStem, StemLabel |
| | Web Library screen (S36) — launch buttons feed song/setlist into engine |
| | Web Player component (S37) — transport, mixer, prefs |
| | `user_settings` player prefs — 7 toggles control what's enabled |
| | Beat map format must match: `beats` field is JSONB array of float seconds |
| | Stem URLs from `song_stems` table, audio from `song-stems` storage bucket |

---

## 6. Supabase Schema Changes (any table)

| Touch | Ripple |
|-------|--------|
| New/altered column | Migration SQL file → `supabase db push` |
| | `shared/supabase/types.ts` — update interface |
| | `shared/supabase/queries.ts` — update SELECT/INSERT/UPDATE |
| | `schema_map.md` — update table definition + migration list |
| | Android Kotlin data class (if table is used by Android) |
| | Android Repository (if table is used by Android) |
| | Web components that display/edit the field |
| | PDF templates (if field appears on invoices/quotes) |

**Checklist for new column**: types.ts → queries.ts → Kotlin model → repo → UI → schema_map.md → migration file

---

## 7. Invoice / Quote / Receipt Mutations

| Touch | Ripple |
|-------|--------|
| `queries.ts` invoice CRUD | Receipt split logic (createReceipts — divides among ALL members, first gets remainder) |
| | RPC: `next_invoice_number()` / `next_quote_number()` — separate sequences, don't manually set |
| | `web/src/hooks/useInvoiceData.ts` — realtime subscription |
| | `web/src/components/InvoiceForm.tsx` — 3-step wizard |
| | `web/src/components/InvoiceList.tsx` — filter/sort/export |
| | `web/src/components/Dashboard.tsx` — stats computed from invoices |
| | `shared/templates/` — 28 PDF templates interpolate invoice/quote fields |
| | `htmlEscape.ts` — all string fields MUST be escaped before PDF injection |
| | Bill-to logic: `resolveBillTo()` — invoice targets client OR venue (S24A) |

**Key gotcha**: Receipt split divides by `allMembers.length` (4) but creates receipts for `otherMembers` (3 non-admin). First receipt gets rounding remainder.

---

## 8. Player Preferences (user_settings)

| Touch | Ripple |
|-------|--------|
| `user_settings` table (7 player prefs columns) | `shared/supabase/types.ts` — UserSettings interface, player_*_enabled fields |
| | `shared/supabase/queries.ts` — getPlayerPrefs, updatePlayerPrefs |
| | Android SettingsScreen (NOT YET — prefs UI doesn't exist) |
| | Web Settings (NOT YET — prefs UI doesn't exist) |
| | Android LiveScreen + PracticeScreen — should read prefs to show/hide features |
| | Web Player (S37) — prefs control which features are visible |

**Status**: 7 columns exist in DB, no UI exposes them yet. Sprint not assigned.

---

## 9. Booking Wizard (web)

| Touch | Ripple |
|-------|--------|
| `BookingWizard.tsx` | `queries.ts` createGig — field mapping must match |
| | `GigHub.tsx` — post-save pipeline (quote/invoice generation) |
| | `EntityPicker.tsx` — venue/client search + inline creation |
| | `DayDetail.tsx` — entry point ("Add Booking" button) |
| | `isGigIncomplete()` in types.ts — defines which fields trigger INCOMPLETE badge |
| | Offline queue — failed saves are queued |
| | Venue history: `getVenueHistory()` auto-fills fee + start time |
| | Calendar dots: new gig triggers realtime refetch |

**Design intent**: Wizard trains band members to capture booking data Nathan needs. Quick entry (pub gigs) is the fast path. Full booking (client gigs) captures deposits, event types, generates quotes/invoices. Don't simplify the wizard — it's intentionally comprehensive.

---

## 10. Cloud Run / Processing Pipeline

| Touch | Ripple |
|-------|--------|
| `beat-analysis` Cloud Run service | `main.py` — madmom + Demucs, /process → Cloud Tasks → /process-worker |
| | Supabase `beat_maps` table — status (pending/processing/ready/failed), beats JSONB |
| | Supabase `song_stems` table — stem URLs, labels, source (auto/manual) |
| | `song-stems` storage bucket — MP3 files uploaded by worker |
| | `web/src/components/SongForm.tsx` — triggerProcessing, polling UI |
| | `android/.../AppViewModel.kt` — pollForStems, processingStatus |
| | `android/.../StemRepository.kt` — getStemsBySongId |
| | Web audio engine (S36) — must fetch stems from same URLs |

**Key gotcha**: Worker runs with service role key (no auth user). `song_stems.created_by` is nullable for this reason.

---

## 11. Navigation & Drawer

| Touch | Ripple |
|-------|--------|
| `web/src/components/Drawer.tsx` | All web view routing — drawer items map to views |
| | `web/src/App.tsx` — ViewContext controls which view renders |
| | Currently NO role-based filtering — all users see all items |
| | `android/.../GigBooksApp.kt` — Compose drawer (3 items: Calendar, Library, Settings) |

**Audit finding**: Non-admin users see business features (invoices, quotes, clients) they don't need. Band Settings is visible but errors on save for non-admin. Role-based drawer filtering is not yet implemented.

---

## 12. Auth & Profiles

| Touch | Ripple |
|-------|--------|
| `shared/supabase/config.ts` — publishable key | `android/.../SupabaseClient.kt` — hardcoded key (must match) |
| | `web/src/hooks/useAuth.ts` — session management, profile fetch |
| | `android/.../AuthRepository.kt` — signIn, signOut, currentUser |
| | `profiles` table — is_admin, band_role |
| | RLS policies — most tables use auth.uid() |

**Audit findings**: No forgot-password UI (Supabase supports it). No self-registration. No role-based UI filtering (DB enforces via RLS only).

---

## Cross-Cutting Concerns

### Adding a new Supabase table
1. Migration SQL → `supabase db push`
2. `shared/supabase/types.ts` — new interface
3. `shared/supabase/queries.ts` — CRUD functions
4. `schema_map.md` — add table + migration to list
5. Android: Kotlin data class + Repository (if needed)
6. Web: hook + component (if needed)
7. RLS policies (always)

### Adding a new field to an existing table
1. Migration SQL → `supabase db push`
2. `shared/supabase/types.ts` — update interface
3. `shared/supabase/queries.ts` — include in SELECT, handle in INSERT/UPDATE
4. `schema_map.md` — update table definition
5. Android Kotlin data class (Double for numeric!)
6. Web form/display components
7. PDF templates (if field appears on documents)

### Adding a new offline-capable mutation
1. `shared/supabase/queries.ts` — write the mutation
2. `web/src/hooks/useOfflineQueue.ts` — add to type union + replayOne switch
3. Test: disable network, perform action, re-enable, verify replay

---

## Audit Findings (2026-03-09) — Triaged

| Finding | Domain | Severity | Status |
|---------|--------|----------|--------|
| Offline queue has no conflict detection (last-write-wins) | Gig mutations | CRITICAL | **Deferred** — near-zero risk at current scale (4 users, Nathan primary editor) |
| No forgot-password UI | Auth | HIGH | **Open — S36 quick fix** (~30 min, wire Supabase `resetPasswordForEmail()`) |
| Changelog fetch in updateGig can fail | Gig mutations | HIGH | **Closed** — verified: changelog is best-effort, does NOT block gig update |
| No role-based drawer filtering | Navigation | MEDIUM | **Closed** — all 4 members are admin, everyone needs full access (see Business Model below) |
| Band Settings errors for non-admin | Settings | MEDIUM | **Closed** — all members are admin, RLS permits update |
| Receipt split divides by 4 but creates 3 receipts | Invoicing | MEDIUM | **Closed** — correct by design (Nathan pays himself, 3 receipts for others) |
| Realtime subscription failures logged silently | Calendar data | MEDIUM | **Deferred** — stable in practice, add fallback if users report stale data |
| No pagination on queries | All queries | LOW | Fine at current scale (117 gigs, 3 songs) |
| Android AppViewModel is monolithic | Android state | LOW | Works, refactor when it hurts |
| Android errors silently swallowed | Android data | LOW | **Deferred** — add toast/banner when it matters |

## Business Model — Read Before Any Audit

> **Every audit must read this section.** These are not bugs. These are intentional designs matching how the band operates.

- **All 4 members are admin** (`is_admin = true`). There are no non-admin users and never will be. Do NOT recommend role-based UI filtering.
- **Everyone needs full business features**: Nathan handles ~90% of invoicing (his bank, his name). James invoices some gigs into his own bank. Adam messages venues/clients with pre-prepared PDFs on Nathan's behalf via whatever messenger he uses — this avoids filling phones with WhatsApp PDFs.
- **The booking wizard is intentionally comprehensive** — it trains band members to capture all booking data Nathan needs for invoicing. Don't recommend simplifying it.
- **Receipt split (÷4, 3 receipts)** is correct — Nathan pays himself, so only other members get receipts. First gets rounding remainder.
- **No separate Live/Practice nav items** — Library is the launchpad (D-110). User browses, taps, chooses mode.
