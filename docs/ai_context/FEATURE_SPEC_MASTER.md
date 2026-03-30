# TGT Feature Spec Master — Every Detail Ever Specified

> Compiled 2026-03-10 from: 158 ADRs, 108 session logs, 45 sprints, 11 mockups,
> all SOT docs, all memory files, all roadmaps, full git history.
> Covers: Web (Tangerine Timetree) + Android (GigBooks).

---

## TABLE OF CONTENTS

1. [Design System & Visual Language](#1-design-system--visual-language)
2. [Typography](#2-typography)
3. [Navigation & App Structure](#3-navigation--app-structure)
4. [Authentication](#4-authentication)
5. [Calendar](#5-calendar)
6. [Day Detail & Booking](#6-day-detail--booking)
7. [Booking Wizard](#7-booking-wizard)
8. [Gig Management](#8-gig-management)
9. [Venues](#9-venues)
10. [Clients](#10-clients)
11. [Library (Songs & Setlists)](#11-library-songs--setlists)
12. [Song Form & Song Management](#12-song-form--song-management)
13. [Categories System](#13-categories-system)
14. [Sharing System](#14-sharing-system)
15. [Setlists](#15-setlists)
16. [Player — General (Shared Chrome)](#16-player--general-shared-chrome)
17. [Player — Live Mode](#17-player--live-mode)
18. [Player — Practice Mode](#18-player--practice-mode)
19. [Player — View Mode](#19-player--view-mode)
20. [Recording & Takes](#20-recording--takes)
21. [Audio Engine — Android (C++/Oboe)](#21-audio-engine--android-coboe)
22. [Audio Engine — Web (Web Audio API)](#22-audio-engine--web-web-audio-api)
23. [Beat Detection & Cloud Run Pipeline](#23-beat-detection--cloud-run-pipeline)
24. [Stem Separation (Demucs)](#24-stem-separation-demucs)
25. [Invoicing](#25-invoicing)
26. [Receipts](#26-receipts)
27. [Quoting System](#27-quoting-system)
28. [Formal Invoicing](#28-formal-invoicing)
29. [Dashboard](#29-dashboard)
30. [PDF Generation](#30-pdf-generation)
31. [Settings](#31-settings)
32. [Public Website](#32-public-website)
33. [Stage Prompter](#33-stage-prompter)
34. [Offline & Sync](#34-offline--sync)
35. [Import Pipeline (Capture → Web)](#35-import-pipeline-capture--web)
36. [Splash Screen](#36-splash-screen)
37. [Skeleton Loaders](#37-skeleton-loaders)
38. [Gig Attachments](#38-gig-attachments)
39. [App Guide / Tutorial](#39-app-guide--tutorial)
40. [Capture Integration Points](#40-capture-integration-points)
41. [ClickTrack Integration Points (Future)](#41-clicktrack-integration-points-future)
42. [Business Rules & Constraints](#42-business-rules--constraints)

---

## 1. Design System & Visual Language

**Theme**: Dark neumorphic across ALL apps (D-008, D-055, D-156)

### Color Palette (Locked — v4-mirror-target.html canonical)
- `--bg-primary`: `#08080c` (main background, near-black)
- `--bg-card`: `#111118` (card background, gunmetal)
- `--bg-card-light`: `#1a1a24` (lighter card variant)
- `--bg-inset`: `#0a0a10` (inset/well background)
- `--color-green` / primary: `#00e676` (bright green — gigs, primary actions)
- `--color-tangerine` / secondary: `#f39c12` (tangerine orange — brand, away dates, branding accents)
- `--color-purple`: `#bb86fc` (practice sessions)
- `--color-teal`: `#1abc9c` (TGT brand identity, used in PDFs)
- `--color-red`: `#ff5252` (away dates, destructive actions, recording)
- `--color-blue`: `#64b5f6` (info states)
- `--color-text-primary`: `#e8e8e8`
- `--color-text-dim`: `#a0a0b0`
- `--color-text-muted`: `#4a4a60`
- `--color-border`: `rgba(255,255,255,0.06)`

### Category Badge Colors
- TGT Cover: green (#00e676)
- TGT Original: tangerine (#f39c12)
- Personal Cover: purple (#bb86fc)
- Personal Original: blue (#64b5f6)

### Gig Type Colors
- Gig: green (#00e676)
- Practice: purple (#bb86fc)
- Away: tangerine/red (#f39c12 / #ff5252)

### Neumorphic System
- **NeuCard** (raised): `box-shadow: 6px 6px 12px rgba(0,0,0,0.7), -2px -2px 8px rgba(255,255,255,0.04)` with `border: 1px solid rgba(255,255,255,0.06)`, `border-radius: 14px`
- **NeuWell** (inset): `box-shadow: inset 3px 3px 6px rgba(0,0,0,0.6), inset -2px -2px 4px rgba(255,255,255,0.03)`
- Android uses `NeuCard` and `NeuWell` composables
- Web uses `neuRaisedStyle()` and `neuInsetStyle()` CSS helpers
- Both MUST use identical shadow values (D-156, v4-mirror-target.html)

### Spacing & Radius
- Card border-radius: `14px`
- Button border-radius: `20px` (pill)
- Card padding: `16px`
- Section gap: `12px`
- Screen padding: `16px`

### Animations
- Beat glow: card-level inset glow, NOT full-screen (D-119)
- Beat glow CSS: `box-shadow: inset 0 0 40px 10px` with green color
- Transitions: 200ms ease for interactive states
- Splash: Juice Drop entrance ~1s, exit 0.6s fade-up

### Dark Mode
- `color-scheme: dark only` (web)
- No light theme option — dark neumorphic is the ONLY theme
- All apps match this scheme

---

## 2. Typography

### Font Stack (D-009, locked)
- **Body**: Karla (weights: 400 regular, 600 semi-bold, 700 bold)
- **Monospace**: JetBrains Mono (BPM displays, metadata tags, technical info, code)
- Loaded via Google Fonts CDN (web) and bundled (Android)

### Size Scale (v4-mirror-target.html)
- Screen title: 20px, Karla 700
- Section header: 14px, Karla 600, uppercase, letter-spacing 1px, text-muted color
- Card title: 16px, Karla 600
- Body text: 14px, Karla 400
- Small/tag text: 12px, Karla 600
- Metadata: 12px, JetBrains Mono
- BPM display: 24-32px, JetBrains Mono 700
- Minimum font size: 11px (WCAG)

---

## 3. Navigation & App Structure

### Web Navigation (D-110, S19)
- **Collapsible drawer** (left side)
- Drawer items: Calendar (home), Library, GigHub, Invoices, Quotes, Dashboard, Settings, Public Site
- ViewContext state machine (no router library) — manages view stack
- History API integration for hardware back button (PWA)
- State-in-stack history with `replaceView` and proper back-button path retracing
- Dynamic header title changes with current view
- Band logo at top of drawer
- User avatar in drawer

### Android Navigation (S19, S35)
- **Compose ModalNavigationDrawer** with 3 items: Calendar, Library, Settings
- Drawer simplified in S35 — no separate Live/Practice destinations
- Library is the launchpad for Live/Practice/View modes (D-110)
- Player screens accessed via Library song/setlist launch buttons

### Shared Navigation Rules
- Calendar is HOME (default screen on both platforms)
- Library is the launchpad — browse songs/setlists, then launch into player mode
- No separate Live/Practice nav destinations in drawer — launched from Library (D-110)
- Hardware back button works on both platforms (web via History API, Android native)

---

## 4. Authentication

### Auth System
- Supabase Auth on both platforms
- Android: Supabase Kotlin SDK session management
- Web: localStorage-based session
- AuthContext refreshes session on mount (D-073) — calls `refreshSession()` to validate + extend TTL
- Login gate — app requires authentication before any content
- 4 user accounts (one per band member)
- `profiles` table linked to auth.users

### Login Screen
- Dark neumorphic styling
- Email + password fields
- Password visibility toggle
- "Forgot Password" link (S36 — sends reset email via Supabase)
- Android: neumorphic input fields needed (S45 gap)
- Web: LoginModal overlay option for public site visitors (D-063)

---

## 5. Calendar

### Shared Calendar Features (both platforms)
- Monthly grid view
- Colored dots for gig types: green = gig, purple = practice, red/tangerine = away
- Multiple dots per day when multiple events exist
- "Today" button to jump to current date
- Tap day to open Day Detail
- Real Supabase data (gigs + away dates)

### Web Calendar Specifics
- Dark inset calendar cells (neumorphic well)
- Swipe left/right to change months (S21)
- Arrow buttons for month navigation
- Realtime subscription updates (gig changes appear instantly)
- Day status computation: `computeDayStatus()` / `computeDayDisplay()`

### Android Calendar Specifics (S29A, Visual Alignment)
- CalendarScreen with real Supabase gig/away data
- Gig.kt + AwayDate.kt models, GigRepository, AppViewModel calendar state
- Colored cell backgrounds per gig type (Visual Alignment session)
- Swipe month navigation MISSING (S45 gap — needs building)
- Uses GigColors for type-based coloring

---

## 6. Day Detail & Booking

### Day Detail (both platforms)
- Shows all events for selected date (gigs, practices, away dates)
- Gig cards with: venue, time, fee, status badge, type indicator
- Separate buttons: "Add Gig" (green, full width), "Add Practice" (purple, half), "I'm Away" (tangerine, half) (D-056)
- Type determined by button press, NOT a toggle in the form
- Swipe left/right navigation between days (S21)
- "Create Invoice" shortcut button on confirmed gigs (D-082)
- "Invoiced" badge on gigs that have linked invoices
- Navigate button opens venue in map app (S23C)

### Gig Form Fields
- Venue (EntityPicker with search + inline "Add New")
- Client (EntityPicker with search + inline "Add New")
- Date, time (start + end)
- Fee
- Payment type
- Status: Enquiry → Confirmed (D-removed: "Pencilled" status removed in S-session)
- gig_type: 'gig' | 'practice' (D-053)
- gig_subtype (added Visual Alignment)
- Notes
- "Show on Website" toggle (D-064) — only for gig type, default unchecked
- is_public boolean (controls public website visibility)
- Load-in time (hidden for practice type)
- Client/fee/payment fields hidden for practice type (D-053)

### Away Dates
- "I'm Away" button on day detail
- Date range (start + end)
- Reason (text)
- Any member away = band unavailable (D-054)
- away_date_changelog tracks create/delete for change summary (D-058)

---

## 7. Booking Wizard

### Web Booking Wizard (BookingWizard.tsx)
- Quick booking + full booking flow
- **Intentionally comprehensive** — trains band to capture all data Nathan needs for invoicing
- DO NOT simplify it (business requirement, noted in CLAUDE.md)
- EntityPicker components for venue/client selection
- Venue history for autocomplete
- Feeds into GigHub pipeline

---

## 8. Gig Management

### GigHub (web only)
- Gig pipeline view: quote → invoice generation flow
- Gig list with filters
- Status tracking: Enquiry → Confirmed → Invoiced → Paid
- Removed "Pencilled" status (simplified to Enquiry → Confirmed)

### Gig List
- Sortable, searchable
- Filter by status, type
- NeuSelect dropdown components for filters
- Visibility toggle (show/hide past gigs)
- Back navigation fix (S25B)
- 12-hour time format display (S25B)
- Gig count indicator per day on calendar

---

## 9. Venues

### Venue Management (S23, web only)
- Independent list (not tied to clients) (D-074)
- VenueList + VenueDetail screens
- Star rating system (StarRating component)
- Venue photos with upload to venue-photos bucket
- Contact fields: email, phone, contact_name (D-079) — for direct invoicing
- Address field
- Notes
- Navigate button → opens map app (map preference in Settings)
- EntityPicker with search + inline "Add New"
- 65 venues seeded from gig history

### Venue Schema
- venues: id, name, address, phone, email, contact_name, city, county, postcode, star_rating, notes, created_by, created_at
- venue_photos: id, venue_id (FK), url, caption, sort_order, created_by, created_at
- venue_id FK chain: gig → invoice → quote → formal_invoice (all carry venue_id)

---

## 10. Clients

### Client Management (S23, web only)
- Independent list (not tied to venues) (D-074)
- ClientList screen
- Fields: name, email, phone, address, notes, created_by
- EntityPicker with search + inline "Add New"
- 29 clients seeded from gig history

### Bill-To Flexibility (S24, D-078)
- Invoices/quotes can target venue OR client (at least one required)
- CHECK constraint: at least one of client_id/venue_id must be set
- Real-world: pubs pay directly (invoice venue), agencies book venues (invoice client)
- `resolveBillTo()` function returns {name, contact, address, email} from whichever entity
- "Client is the venue" toggle REMOVED (D-080) — replaced by explicit bill-to choice

---

## 11. Library (Songs & Setlists)

### Library Screen — Shared Spec (D-110, S35, S36, S40)
- **Tabbed interface**: Songs tab + Setlists tab (tab underline style)
- **Two filter dropdowns** replacing pills (D-128, "less scruffy"):
  - **Scope**: All Songs / TGT / My Songs / Shared With Me
  - **Type**: All / Covers / Originals
- **Search bar** alongside dropdowns
- **Library is the launchpad** — no separate Live/Practice nav destinations

### Song Cards in Library
- Song title (Karla 600)
- Artist name (dim text)
- BPM badge (JetBrains Mono, if set)
- Category badge (colored: green=TGT Cover, tangerine=TGT Original, purple=Personal Cover, blue=Personal Original)
- "TRACK" badge (if practice track uploaded)
- Stems count indicator
- Owner tag (for personal songs)
- Lock icon (for shared songs you can't edit)
- Left color border matching category (Android Visual Alignment)
- **Inline launch buttons**: Live + Practice (both platforms)
- **View launch button** (S42)

### Setlist Cards in Library
- Setlist name
- Song count + total duration
- Setlist type badge (tange / other_band)
- Band name (if other_band)
- Inline Live + Practice launch buttons
- Drag-to-reorder within setlist

### Android Library Specifics (S35, S40)
- LibraryScreen with FilterDropdown components
- Same scope + type filters as web
- Category badges, owner tags, lock icons
- Shimmer skeleton loading animation (Visual Alignment)
- Left color borders per category
- "New Idea" button + NewIdeaDialog (S41)

### Web Library Specifics (S36, S40)
- Library.tsx with Songs/Setlists tabs
- Filter pills replaced by dropdowns in S40
- Category badges, sharing UI
- Import panel for Capture tracks (S44)

---

## 12. Song Form & Song Management

### Song Schema (26 columns on songs table)
- id, title, artist, bpm, time_signature, key_signature
- subdivision, accent_pattern, swing_amount, click_sound, count_in_bars
- lyrics, chords, notes, drum_notation
- category (CHECK: tgt_cover, tgt_original, personal_cover, personal_original)
- owner_id (FK to profiles, NULL for TGT songs)
- practice_track_url, duration_seconds, beat_offset_ms
- created_by, created_at, updated_at

### Song Form — Both Platforms (S34, S40, S44)
- **Role-based form** (D-094):
  - Nathan (band_role=Drums): sees full metronome settings (subdivision, swing, accent, click sound, count-in)
  - Other members: simplified form (name, artist, BPM, time sig, key, chords, lyrics, notes, practice track)
  - BPM and time signature visible to ALL
- Category dropdown (4 options)
- Title, artist
- BPM (manual entry + auto-detected from track)
- Time signature
- Key signature
- Lyrics (text area, supports ChordPro notation)
- Chords (text area)
- Notes (text area)
- Drum notation field (D-noted in S33 mockup)
- Practice track upload
- Duration (auto-detected)

### Song Form — Web Specifics
- Sharing section (for personal originals): add/remove members
- Processing status display with polling
- "Re-analyse" button (D-151) — triggers server re-analysis of mixed master
- Import from Capture section (S44)

### Song Form — Android Specifics (S44)
- SongFormScreen.kt — full song edit form
- Save via SongRepository
- Cloud Run trigger for processing
- Processing status banner
- Re-analyse trigger

### New Song Idea Flow (D-138, S41)
- Create new song with minimal metadata: working title + personal_original category
- Immediately enter record mode
- First recording becomes first stem
- No existing stems required — supports songwriting/jamming workflow

---

## 13. Categories System

### Song Categories (D-124, supersedes D-107)
- 4 categories: `tgt_cover`, `tgt_original`, `personal_cover`, `personal_original`
- Renamed from `tange_cover`/`tange_original`/`personal` in S39 migration
- TGT songs = band songs, all members can edit
- Personal songs = individual uploads, split by cover vs original
- DB: `songs.category TEXT` with CHECK constraint
- owner_id UUID FK to profiles (NULL for TGT songs)

### Category Visibility Rules
- TGT covers: visible to all authenticated members
- TGT originals: visible to all authenticated members
- Personal covers: visible to all members (D-125 — "good to know what everybody knows")
- Personal originals: private by default, require explicit sharing (D-126)
- `can_access_song()` SQL SECURITY DEFINER function enforces these rules (D-129)

### Setlist Types (D-108, D-127)
- 2 types: `tange`, `other_band` (kept as "tange", NOT renamed to "tgt")
- `band_name TEXT` defaults to 'The Green Tangerine'
- Other band setlists for dep/standing-in gigs
- Personal songs unrestricted — can go in any setlist (D-109)

---

## 14. Sharing System

### Song Sharing (D-126, D-135, S39-S40)
- Personal originals require explicit opt-in sharing
- `song_shares` table: song_id, shared_with (profile FK), shared_by (profile FK)
- UNIQUE constraint on (song_id, shared_with)
- Owner selectively shares with specific members
- Shared users can: play song, add their own stems
- Shared users CANNOT: edit/delete song, edit/delete other members' stems
- Owner can delete shared users' stems (cleanup authority) (D-136)
- RLS enforces: select=all auth, insert=song owner only, delete=owner OR shared_with user (remove self)

### Sharing UI (web, S40)
- Sharing section in SongForm for personal originals
- Add/remove member checkboxes
- Lock icon on shared songs in Library (read-only indicator)

---

## 15. Setlists

### Setlist Schema
- setlists: id, name, setlist_type (tange/other_band), band_name, description, created_by, created_at, updated_at
- setlist_songs: id, setlist_id (FK), song_id (FK), position (integer), created_at

### Setlist Features (S25, both platforms)
- Create/edit setlists
- Drag-to-reorder songs within setlist
- Song count + total duration display
- Setlist type badge
- Setlist PDF sharing with band-themed template (D-088)
- 1 setlist = 1 gig; if 2 sets, make 2 setlists (D-114)

---

## 16. Player — General (Shared Chrome)

### Player Architecture (D-111)
- **One player screen/composable with mode flag** (Live / Practice / View)
- 3 tabs always visible: Live / Practice / View (D-150)
- Record button in transport bar, NOT a permanent 4th tab (D-150)
- Same visual hero area, transport controls, queue overlay across modes

### Player Layout (V4 Target — v4-mirror-target.html, S38)
1. **Header**: song title, artist, BPM display, mode badge, queue icon
2. **Visual Hero**: spectrum/rings/particle visualizers OR camera feed (View Mode)
3. **Text Panel**: lyrics/chords/notes display (toggleable)
4. **Transport**: play/pause, prev/next, speed controls, mode-specific buttons
5. **Drawer pull-up**: bottom sheet with settings, mixer, display toggles

### Display Toggles (D-118, in bottom sheet drawer)
- Vis (visualizer on/off)
- Chords (on/off)
- Lyrics (on/off)
- Notes (on/off)
- Drums (drum notation on/off)
- Placed in bottom sheet drawer under "Display" section — keeps main player clean
- Layout auto-redistributes with CSS flex when cards toggled
- Per-user preferences stored in user_settings (D-116)

### Player Preferences (D-116, 7 boolean columns on user_settings)
- player_click_enabled
- player_flash_enabled
- player_lyrics_enabled
- player_chords_enabled
- player_notes_enabled
- player_drums_enabled
- player_vis_enabled
- Each member configures their own experience

### Queue Overlay (player-queue.html mockup)
- Dimmed player behind, queue sheet slides up
- Current song highlighted
- Drag-to-reorder available during performance (D-115)
- Tap to jump to any song
- "Reorder" button toggles drag mode
- Between Songs: waiting screen with next song preview, "Go" button (D-114)
- Set Complete: celebration screen with restart/pick setlist options (D-114)
- Player does NOT auto-advance — waits on "Next Up" until user taps Go

### Beat Glow (D-119, confirmed after 7 mockup iterations)
- **Card-level beat glow** (NOT full-screen)
- `.beat-glow` + `.screen-flash` inside visual area
- `box-shadow: inset 0 0 40px 10px` with green color
- Triggers on each beat from beat map
- A/B test toggle was built (v7) — card glow confirmed as winner

### Wake Lock
- Screen stays on during Live and Practice modes
- Web: Wake Lock API
- Android: FLAG_KEEP_SCREEN_ON

### Speed Safety Modal (S35, Live Mode)
- Detects BPM mismatch between song metadata and loaded track
- Warning dialog before playing at wrong tempo

---

## 17. Player — Live Mode

### Live Mode Spec (D-085, D-111, S26B, S35, S36)
- Song-driven read-only metronome — loads BPM/time sig/subdivisions from song data
- No manual BPM controls in Live Mode
- High-quality visual beat display (beat dots/LED)
- Setlist navigation (prev/next arrows)
- Click track plays through headphones/IEM
- Count-in before first beat (configurable bars: 0/1/2/4) (D-142)
- Swing slider
- Song metadata display
- Count-in banner
- Beat LED indicator

### Live Mode — Android Specifics (S26B, S35)
- Full-screen stage view composable
- Setlist selector
- Song nav arrows
- Beat LED (visual flash on each beat)
- Transport controls
- Queue overlay with set complete celebration
- Speed safety modal (detects BPM mismatches)

### Live Mode — Web Specifics (S36, S37)
- Player.tsx with mode="live"
- Transport with beat dots
- Lyrics/chords display below visual hero
- Stage prompter merged into Live Mode (D-113)
- Speed control (BPM ±5/±1)
- Wake lock
- Beat glow polish
- Set complete + between-songs screens
- Waveform visualiser

---

## 18. Player — Practice Mode

### Practice Mode Spec (D-086, D-111, S27A, S36, practice-redesign.html)
- Same click engine as Live Mode
- PLUS: MP3 backing tracks, time-stretch, A-B looping, speed trainer
- Inspired by Yamaha Rec'n'Share (reference app)

### Practice Mode Features
- **Speed control**: 50-150% pitch-preserved time-stretch (SoundTouch)
  - Speed slider with ±5% buttons
  - Speed change adjusts both SoundTouch rate AND metronome BPM proportionally (D-103)
- **A-B loop**: Set A point, Set B point, loop continuously, Clear (tap again to exit)
  - Visual markers on waveform
  - Only during playback
- **Waveform seekbar**: 600-point amplitude envelope (Android), canvas-based (web)
  - Loop markers visible on waveform
  - Progress indicator
- **Stem mixer** (bottom sheet / drawer):
  - Per-stem volume sliders
  - Mute/Solo per stem
  - Up to 6 stems: click, track, drums, bass, vocals, other
  - Vertical fader layout (practice-redesign.html)
- **Count-in**: configurable 0/1/2/4 bars (D-142), uses song's start BPM
- **Beat nudge**: shift metronome phase relative to track position (D-093)
  - Saves as beat_offset_ms on Song
  - Inspired by Yamaha Rec'n'Share
- **Beat LED**: visual flash on each beat
- **Volume mix**: track vs click balance
- **Song picker**: browse and select from Library
- **Subdivision selector** (in drawer)

### Practice Mode — Android (S27A, S28C, S38)
- PracticeScreen.kt rebuilt to V4 layout (S38)
- Song picker, MP3 download + decode, progress bar
- A-B loop markers on waveform
- Speed slider
- Beat LED
- Transport controls
- Volume sliders
- Count-in selector
- Beat nudge controls
- BPM display
- WaveformSeekBar (Canvas, 600-point envelope) (S28C)
- StemsCard with per-stem volume sliders (S28C)

### Practice Mode — Web (S36, S37)
- Player.tsx with mode="practice"
- Full audio stack: AudioEngine, ClickScheduler, TrackPlayer (SoundTouchJS), StemMixer
- useAudioEngine React hook
- Transport with speed controls
- A-B loop controls
- Stem mixer in drawer
- Waveform visualiser
- Beat glow
- Player prefs UI (7 toggles)

---

## 19. Player — View Mode

### View Mode Spec (D-137, D-146, S42)
- 3rd player tab (Live / Practice / **View**)
- Plays user's local best-take video in hero area (16:9 ratio)
- All audio stems from Supabase play alongside
- Stem mixer in drawer (same as Live/Practice)
- YOU only see YOUR local video angle — multi-cam is offline post-production
- Video is local-only per D-132
- **No-video fallback** (D-146): when no local video exists, hero shows neumorphic input level visualiser (same style as Recording Video-OFF)
- Record button available in View Mode for layering new takes (D-144)

### View Mode — Android (S42)
- ViewScreen.kt
- Teal visualiser in hero area (no-video fallback)
- Transport controls
- Mixer in drawer
- LibraryScreen View launch buttons

### View Mode — Web (S42)
- Player.tsx with mode="view"
- Video hero with local video sync
- Teal visualiser fallback
- Record from View Mode
- Stem mixer in drawer

---

## 20. Recording & Takes

### Recording Spec (D-130, D-132, D-138-D-150, S41)

#### Takes Model
- Takes = song_stems rows with `source='recorded'` + `is_best_take` flag (D-130)
- Multiple takes per user per song
- One best take per user per song
- Best take promoted to normal stem list visible to all members (D-131)
- Non-best takes private to owner
- Take numbering: auto-increment per user per song (D-143)

#### Recording UI (D-147)
- Uses same player shell as Live/Practice/View
- "Record" tab highlighted **red** during active recording (D-150)
- Record button in transport bar (replaces play button)
- Video OFF = neumorphic visualiser fills hero
- Video ON = camera feed in hero + input level bar underneath
- Settings in drawer: input device, camera toggle, click, count-in, overdub mix
- Transport has red stop button; seek/skip disabled during recording

#### Selfie Recording (D-132)
- Web: getUserMedia() captures camera + mic
- Video saved to user's device (File System Access API on Chrome, download fallback on Safari/Firefox)
- Audio extracted and uploaded as stem (source='recorded')
- NO video on cloud — video stays local
- Multi-camera post-production via local file collection + audio waveform sync

#### USB Audio Interface Support (D-133)
- getUserMedia() enumerateDevices() lists all audio inputs including USB interfaces (Focusrite, etc.)
- Device picker dropdown
- setSinkId() for output routing
- Direct monitoring on interface for zero-latency playback; browser records input only

#### Hardware Context (D-134)
- EAD-10 USB = practice mode input (monitor + record via native)
- XR18 USB = live mode input (click to drum IEM via headphone out)
- Different interfaces for different modes

#### Overdub Playback (D-140)
- Stems play back during recording
- User controls which stems they hear via mixer drawer (M/S/gain per stem)
- Mixer stays active during recording
- getUserMedia captures mic/USB on separate stream — no interference with playback

#### Click During Recording (D-141)
- ClickScheduler stays active
- Click goes to headphones only, doesn't bleed into mic recording (separate audio streams)
- Toggle on/off via mixer drawer

#### Post-Recording Options (D-139, 4 choices)
1. **Discard & Re-take** — bin it, go again immediately
2. **Save as Take** — keep in takes list, return to takes view
3. **Save & Preview** — keep it, play back immediately for review
4. **Save & Re-take** — save AND immediately start fresh recording (most common workflow)

#### Take Storage (D-145)
- Only best take per user per song uploaded to Supabase storage
- Non-best takes stored locally (IndexedDB on web, local storage on Android)
- When best changes: old best deleted from cloud, new best uploaded
- ~4MB MP3 each, ~200 best takes before 1GB free tier

#### Take Deletion (D-149)
- Manual delete from takes list
- Deleting best take: removes from Supabase + song_stems row
- NO auto-promote — no best take until user explicitly marks another
- Local takes (IndexedDB) deleted immediately

### Recording — Android (S41)
- LocalTakesStore for local take management
- AudioRecorder
- TakesSection in SongForm
- RecordingBanner
- PostRecordingDialog (4 options)
- "New Idea" button + NewIdeaDialog in Library

### Recording — Web (S41)
- IndexedDB for local takes
- useRecording hook
- SongForm "My Takes" section
- Player recording mode (red tab)
- Post-recording dialog

---

## 21. Audio Engine — Android (C++/Oboe)

### Architecture (D-084, D-090, D-099, S26A)
- C++ AudioEngine singleton via JNI bridge
- Package: `com.thegreentangerine.gigbooks.audio`
- Oboe 1.9.3 for low-latency audio output
- Single Oboe stream for ALL audio (metronome + track player) (D-090) — zero drift
- Ported from ClickTrack (stripped: no poly/sample/loop/midi)

### Components
- `audio_engine.h/cpp`: AudioEngine singleton, Oboe stream management
- `metronome.*`: Click track scheduling (5 click sounds, beat map support, swing)
- `track_player.*`: MP3/stem playback (PCM buffer, A-B loop, SoundTouch time-stretch)
- `mixer.*`: Gain mixing, stem channels, master gain
- SoundTouch vendored source (not prebuilt) (D-101), float-only mode
- MAX_STEMS = 6 stem players (S28B)

### JNI Bridge
- `AudioEngineBridge.kt` → C++ AudioEngine
- Kotlin `object` with `@JvmStatic external` functions
- Key functions: nativeSetBpm, nativeSetBeatOffsetMs, nativeApplyExternalBeatMap, nativeLoadTrack, nativeSetSpeed, etc.

### MP3 Decode (D-102)
- Android MediaCodec (MediaExtractor + MediaCodec)
- Decode MP3 to 16-bit PCM on background thread
- Convert to float [-1,1], pass to C++ via JNI
- Download from URL to cache, decode, delete cache file

### Audio Rendering (D-103)
- onAudioReady(): clear buffer → render metronome (ch0 gain) → render track_player additively (ch1 gain) → apply master gain
- Track speed change via SoundTouch automatically adjusts metronome BPM proportionally (baseBpm_ x speed ratio)

### Build Config
- CMakeLists.txt in `android/app/src/main/cpp/`
- SoundTouch vendored in third_party/soundtouch/
- Oboe 1.9.3 (not 1.9.2 — version matters for compatibility)
- NDK 27.1.12297006, CMake 3.22.1

---

## 22. Audio Engine — Web (Web Audio API)

### Architecture (D-112, S36)
- Web Audio API + SoundTouchJS for pitch-preserved playback
- Latency ~20-50ms — fine for practice, Nathan uses native for stage

### Components
- `AudioEngine.ts`: Singleton — AudioContext + master gain + tick loop
- `ClickScheduler.ts`: Frame-accurate metronome (5 sounds, beat map support, swing)
- `TrackPlayer.ts`: SoundTouchJS pitch-preserved playback + A-B loop
- `StemMixer.ts`: Per-stem TrackPlayer instances + gain/mute/solo
- `soundtouchjs.d.ts`: Type declarations for SoundTouchJS library
- `useAudioEngine.ts`: React hook bridging audio engine to UI state

### Features (S36, S37)
- Click scheduling with beat map support
- 5 click sounds
- Pitch-preserved speed control (SoundTouchJS)
- A-B section looping
- Per-stem volume/mute/solo
- Waveform visualiser
- Beat glow animation triggered from beat map
- Wake lock integration

---

## 23. Beat Detection & Cloud Run Pipeline

### Architecture (D-104, D-105, S31)
- Server-side madmom for beat detection (replaces client-side BTrack)
- Hosted on Google Cloud Run (Python + madmom)
- Free tier: 2M req/mo, 360K vCPU-sec — covers band scale at zero cost
- Triggered after practice track upload
- Async — not instant but acceptable

### Why madmom (D-104)
- BTrack has architectural limits:
  - 41-element tempo transition matrix caps changes at ~5%/beat
  - Onset-based detection can't distinguish beats from syncopated accents
  - Fails on: War Pigs (140→110 BPM), Cissy Strut (syncopation)
- madmom uses RNN (learned beat concept from spectrograms) + DBN (Viterbi decode with tempo as hidden state)
- Best MIREX accuracy, handles syncopation + tempo changes

### Cloud Run Service
- Project: `tangerine-time-tree` (GCP)
- Region: europe-west1
- Python 3.10, madmom 0.16.1, Demucs 4.0.1
- 8Gi RAM, 4 CPU, 900s timeout
- Current revision: beat-analysis-00009-th7
- Cold start: ~90s (hidden by Cloud Tasks async pattern)
- CORS enabled for thegreentangerine.com

### Beat Maps
- `beat_maps` table: id, song_id (FK), beats (JSONB array of timestamps), bpm (float), time_signature, status (pending/processing/ready/failed), created_at, updated_at
- Beat map = array of beat timestamps (seconds)
- C++ engine reads timestamps instead of running local analysis
- Android: `nativeApplyExternalBeatMap()`
- Web: ClickScheduler loads beat map timestamps

### Processing Pipeline (D-148)
- **Full mix upload** (practice track): madmom beats + Demucs stems (full pipeline)
- **First take on new song** (solo instrument): madmom beats only, skip Demucs (D-148 `skip_stems` flag)
- **Subsequent takes**: no pipeline, just save as stem
- **Re-analyse** (D-151): user-triggered madmom on server-mixed master of all best takes (better beat detection with more instruments)
- Manual BPM field on Song remains as click fallback

### Re-analyse Endpoint (D-151, S43)
- "Re-analyse" button on SongForm
- Server mixes all current best takes into temporary master
- Sends to Cloud Run for madmom-only analysis
- Replaces existing beat map
- Demucs NOT run — individual stems already exist as takes

---

## 24. Stem Separation (Demucs)

### Architecture (S32A)
- Demucs 4.0.1 on Cloud Run (via Cloud Tasks queue)
- Splits full-mix practice tracks into 4 stems: drums, bass, vocals, other
- MP3 encoded stems uploaded to `song-stems` Supabase storage bucket
- song_stems table rows created (source='auto')

### song_stems Schema
- id, song_id (FK), label (drums/bass/vocals/other/click/recorded), url, source (auto/manual/recorded), is_best_take (boolean), created_by, created_at

### Stem Labels
- Auto stems from Demucs: drums, bass, vocals, other
- Manual uploads: user-labeled
- Recorded takes: source='recorded', created_by = recording user

---

## 25. Invoicing

### Invoice System (S10-S13, web only)
- 3-step invoice wizard (D-014): client selection → gig details → preview & generate
- Full-screen HTML preview with style carousel (D-028)
- InvoiceList with search, sort, filter (S14)
- InvoiceDetail with preview, share, regenerate
- Invoice number format: INV-001 (auto-incremented) (D-013)
- Sequential via RPC `next_invoice_number()` (D-033 atomic transaction)

### Invoice Schema (17 columns)
- id, invoice_number, client_id (nullable), venue_id (nullable), gig_id (nullable FK)
- date, due_date, amount, status (draft/sent/paid)
- payment_type, notes, style
- gig_date, gig_time, gig_description
- created_by, created_at

### Invoice Rules
- No invoice editing — duplicate only ("Create Similar") (D-016)
- Invoice deletion allowed for test invoices and cancelled gigs (D-032)
- Share auto-marks invoice as "sent" (D-044) — only upgrades from draft, never downgrades from paid
- Paid auto-generates receipts via atomic transaction (D-045)
- Invoice creation allowed for ANY gig (removed payment_type gate)
- gig_id FK enables "Create Invoice" shortcut from day view (D-082)
- "Invoiced" badge on gigs with linked invoices

### Invoice Styles (D-021, D-049)
- 7 styles: classic, premium, clean, bold, christmas, halloween, valentine
- Style picker in wizard Step 2 (not a new step) (D-022)
- Template dispatcher pattern: `getInvoiceHtml()` (D-023)
- Pre-render all style HTMLs at Step 3 entry (D-030)
- Seasonal themed templates with SVG decorations (D-049)

---

## 26. Receipts

### Receipt System (web only)
- Generated when invoice marked as paid (D-045)
- Equal split: invoice.amount / 4 members (D-011)
- **3 receipts only** — Nathan doesn't need proof of paying himself (D-012, D-121)
- First receipt gets rounding remainder
- Receipts match invoice style (D-048 supersedes D-024)
- 7 receipt templates mirror 7 invoice templates
- `createReceipts()` wrapped in atomic transaction (D-072)
- Idempotent — returns existing if already generated (D-034)
- Receipt button label adapts: "View Receipts" vs "Generate Receipts" (D-046)

---

## 27. Quoting System

### Quote System (S15-S17, web only)
- 6 new Supabase tables for quotes
- Service catalogue for line items
- 4-step quote wizard (QuoteForm)
- QuoteList with search/sort
- QuoteDetail with 6-stage lifecycle
- Multi-page quote preview (QuotePreview)
- Quote number format via RPC `next_quote_number()`

### Quote Schema (20 columns)
- id, quote_number, client_id (nullable), venue_id (nullable)
- date, valid_until, status (draft/sent/accepted/declined/expired/invoiced)
- subtotal, discount_percent, total
- notes, terms, style
- PLI details (from band_settings)
- created_by, created_at

### Quote Lifecycle (S17)
- Draft → Sent → Accepted → formal invoice auto-generated → Paid
- OR: Draft → Sent → Declined/Expired
- Accept flow generates formal_invoice automatically
- Calendar integration (accepted quotes appear as gigs)

### Quote Line Items
- quote_line_items: id, quote_id (FK), description, quantity, unit_price, total, created_at
- Populated from service_catalogue or manual entry

---

## 28. Formal Invoicing

### Formal Invoice System (S15, S17, web only)
- Auto-generated when quote is accepted
- formal_invoices table (16 columns) mirrors invoice structure
- formal_invoice_line_items for itemised billing
- formal_receipts for payment tracking
- 7 formal invoice PDF templates (same styles as regular invoices)
- Full lifecycle: generated → sent → paid → receipts

---

## 29. Dashboard

### Dashboard (S14, web only)
- Stats overview: total invoiced, total paid, outstanding, gig count
- Pull-to-refresh (D-037)
- CSV export for all invoices (D-017)
- Invoice search/sort

---

## 30. PDF Generation

### PDF System (D-007, D-050, S12)
- HTML templates rendered on-demand — NO PDFs stored in cloud
- 28 total templates: 7 invoice + 7 receipt + 7 quote + 7 formal invoice
- Templates live in `shared/templates/`
- Inline CSS only (no external stylesheets in PDF) (gotcha)
- HTML escape all template data (D-035) — `htmlEscape()` utility
- Google Fonts loaded via link tag in HTML (D-025)
- Real TGT logo as circular-cropped base64 PNG (D-031)
- Preview via iframe (web)
- Viewport width=800 for A4 proportions (D-043)
- HTML-first prototyping workflow (D-050): prototype in browser, convert to .ts template functions

### Setlist PDF (D-088, S25B)
- Professional setlist document from any setlist
- Band-themed template (Tangerine branding)
- Shareable with clients/venues

---

## 31. Settings

### User Settings (user_settings table, 15 columns)
- Personal: name, email, phone, bank_sort_code, bank_account, bank_name, payment_terms
- Player preferences (D-116): 7 boolean columns
  - player_click_enabled, player_flash_enabled, player_lyrics_enabled
  - player_chords_enabled, player_notes_enabled, player_drums_enabled, player_vis_enabled
- Map preference (for venue navigation) (S23C)

### Band Settings (band_settings table, 13 columns)
- trading_as, business_type, address, phone, email
- PLI details (provider, policy_number, expiry)
- Default terms & conditions
- next_invoice_number, next_quote_number (RPC-managed)

### Settings Screen — Web (S13, S36, S37)
- Full settings with personal info, bank details, payment terms
- Band settings section
- Player preferences UI (7 toggles) (S37)
- Map app preference (Google Maps / Apple Maps / Waze)
- Service catalogue management

### Settings Screen — Android (S35, S38)
- Player-only settings currently
- Click sound picker MISSING (S45 gap)
- Processing status polling MISSING (S45 gap)

---

## 32. Public Website

### Public Website (S4-S6, D-063-D-068, PLAN_PUBLIC_SITE.md)
- Built INTO the web/ app — single Vite app, two experiences (D-063)
- Unauthenticated visitors see public site
- Authenticated members see calendar/management tools
- Domain: thegreentangerine.com (IONOS DNS → Vercel) (D-068)

### Public Site Sections
- **Sticky header**: nav links + "Band Login" button
- **Hero**: full-viewport background, band name, tagline, social links, CTAs
- **Upcoming Gigs**: dynamic from `getPublicGigs()` (only gigs with is_public=true)
- **About**: band description, social proof
- **For Venues**: 6 benefit cards, equipment details, testimonials
- **Pricing**: 5 tiers:
  - Pub Gig: £400-600
  - Private Party: £600-800
  - Wedding: £800-1200
  - Corporate: £1000-1500
  - Festival: £1000+
- **Gallery**: dynamic photos/videos from `getPublicMedia()`, lightbox, YouTube embed
- **Contact**: email, location, social links
- **Footer**: band name, tagline, areas covered, social, copyright
- **Reviews**: Facebook reviews display (S22), reviews manager
- **Photo gallery**: background image picker (S22)
- **Editable content**: hero images, content sections (S22)

### Public Site Schema
- `is_public` boolean on gigs (D-064)
- `band_role` text on profiles (D-065)
- `public_media` table: 12 columns (media_type, url, title, description, thumbnail_url, video_embed_url, sort_order, visible flag) (D-066)
- `contact_submissions` table: 10 columns (for future contact form)
- RLS: anonymous read for public gigs + visible media, authenticated management

### Styling
- Dark theme, green + orange brand colors
- Glass-morphism cards, gradient CTAs
- Karla + Impact fonts
- Mobile-first responsive

### SEO (S5)
- Meta tags, Open Graph tags
- Schema.org JSON-LD (MusicGroup + LocalBusiness)

### Login Modal (S5)
- Overlay triggered by "Band Login" button
- Replaces plain login page for visitors

---

## 33. Stage Prompter

### Stage Prompter (S27C, D-096, D-113)
- **Merged into Live Mode** (D-113) — no longer separate screen
- Originally standalone web component (S27C)
- Full-screen lyrics/chords display for stage

### Features
- Setlist picker + navigation (prev/next)
- Song info bar (title, key, BPM)
- Lyrics display (ChordPro rendering: `[Am]lyrics[F]here`)
- Chords display
- Per-song notes
- Fullscreen mode
- Auto-scroll option
- Keyboard navigation (left/right arrows)
- Sidebar with song list
- Back/close buttons

---

## 34. Offline & Sync

### Offline Support (D-060, D-061, D-062, S-Phase 4+5)
- **Web**: NetworkFirst service worker for Supabase API (Workbox) — 10s timeout, 24h cache
- **Web**: Google Fonts CacheFirst with 1-year cache
- **Web**: localStorage offline mutation queue — auto-replay on reconnect
- **Android**: offline capability via native storage
- **Both**: useOfflineQueue hook / offlineQueue pattern
- **Both**: isNetworkError detection + queueMutation utility
- Realtime subscriptions on gigs + away_dates tables
- Change summary on app open (D-057): fetch changes since `last_opened_at`
  - Web: dismissible banner
  - Native: Alert.alert
  - Updates `last_opened_at` on dismiss

### Realtime Sync
- Supabase Realtime enabled on gigs and away_dates tables
- Web subscribes to changes — calendar updates instantly
- gig_changelog + away_date_changelog tables track mutations

---

## 35. Import Pipeline (Capture → Web)

### Import Pipeline (D-123, D-158, S44)
- **Entry point**: TGT Capture records audio → BPM/key analysis → tags metadata
- **Web ImportPanel.tsx**: browse Capture tracks from localhost:9123
- **Metadata mapping**: user maps Capture fields to Supabase Song fields
  - title, artist, category (user picks from 4 options)
  - BPM, key (auto-detected by Capture)
  - Sharing options
- **Upload**: MP3 uploaded to `practice-tracks` Supabase storage bucket
- **Processing trigger**: Cloud Run madmom beats + optional Demucs stems
- **Result**: Song appears in both web + Android (same Supabase)
- **Bulk import UX**: NOT YET BUILT (todo item)
- **Capture history view**: NOT YET BUILT (todo item)

---

## 36. Splash Screen

### Splash Screen (S19+/S20, concept-pack)
- **Web**: SplashScreen React component
  - "Juice Drop" entrance animation (~1s)
  - Minimum display time: 1800ms
  - Exit: 0.6s fade-up animation
  - Props: `ready` (boolean), `onComplete` (callback), `minDisplayMs` (1800)
  - Shows band logo
- **Android**: SplashScreen.kt (Visual Alignment session)
  - Animated splash matching web design
  - Logo animation
- **iOS PWA**: `<link rel="apple-touch-startup-image" href="/logo-512.png" />`

---

## 37. Skeleton Loaders

### Skeleton Loading (S19+/S20, concept-pack)
- 4 variants:
  - **PageLoader**: full-page centered (replaces LoadingSpinner)
  - **CardSkeleton**: neumorphic card placeholder for gigs/invoices
  - **InlineSkeleton**: list row placeholders
  - **DotLoader**: minimal inline indicator
- CSS shimmer animation
- Respects `prefers-reduced-motion`
- Uses design system custom properties with fallbacks
- Android: shimmer skeleton loading in LibraryScreen (Visual Alignment)

---

## 38. Gig Attachments

### Gig Attachments (S21-era)
- `gig_attachments` table
- 3-way visibility toggle (private / band / public)
- Compressed image uploads
- Attached to individual gigs

---

## 39. App Guide / Tutorial

### App Guide (S-noted)
- Animated interactive tutorial
- Platform-aware content (shows different instructions for web vs mobile)
- Onboarding flow for new band members

---

## 40. Capture Integration Points

### What Capture Must Carry (D-154, ecosystem-rules.md)
- Song `category`: tgt_cover, tgt_original, personal_cover, personal_original
- `practice_category`: technique, covers, originals, theory, ear_training, groove, fills (for ClickTrack)
- `instrument_focus`: drums, bass, guitar, vocals, keys, full_band
- `difficulty`: easy, medium, hard, expert (for ClickTrack)
- BPM (librosa-detected)
- Key (librosa-detected)
- Duration
- Waveform data (800-point amplitude + PNG thumbnail)

### Capture → Web Import Rules (ecosystem-rules.md)
- Import takes ALL Capture fields
- Web import maps `category` to Song.category (user picks if not set)
- Web import IGNORES `practice_category`, `instrument_focus`, `difficulty` (TGT doesn't need them)
- Each consumer takes what it needs, ignores the rest
- Capture is the SUPERSET of metadata

---

## 41. ClickTrack Integration Points (Future)

### ClickTrack (D-155, D-097)
- Personal practice app for Nathan
- Techniques, sticking patterns, fills, polyrhythms, limb independence
- Refactored from existing C++ engine base
- Will consume from Capture: `practice_category`, `instrument_focus`, `difficulty`, BPM, key
- Separate import pipeline from Capture (different from TGT import)
- NOT built yet — but integration points designed into Capture now
- GigBooks absorbed ClickTrack's metronome/live/practice features (D-097)
- ClickTrack pivots to hand-foot coordination, rudiments, sticking patterns

---

## 42. Business Rules & Constraints

### Band Membership (D-010, D-120)
- 4 fixed band members (count fixed, names editable)
- Nathan (drums), Neil (bass), James (lead vocals), Adam (guitar & backing vocals)
- ALL 4 members are admin (`is_admin = true`) (D-120)
- NO role distinction for business features — everyone gets full access
- DO NOT add role-based UI filtering or feature gating

### Invoicing Business Rules
- Nathan handles ~90% of invoicing (his bank account, his name)
- James invoices some gigs into his own bank
- Adam messages venues/clients with invoices in Nathan's name
- Equal payment splits only (D-011): invoice.amount / total_members
- No custom percentages

### Receipt Business Rules (D-012, D-121)
- Receipts for other 3 members only (Nathan pays himself)
- `is_self` flag on profiles excludes Nathan from receipts
- First receipt gets rounding remainder
- This is correct by design — NOT a bug

### Invoice Number Sequence
- Sequential: INV-001, INV-002, etc.
- Auto-incremented from band_settings.next_invoice_number
- Atomic transaction ensures no gaps (D-033)

### Infrastructure Constraints
- All free tiers: Supabase, GCP, Vercel
- No Google Play developer account — APK sideloaded only
- No production user data yet (all seed data)
- Legacy JWT keys DISABLED — use `sb_publishable_*` / `sb_secret_*`

### Cross-App Rules (D-156, D-157)
- Every field/schema change evaluated against ALL apps
- Sprint-scoped decisions expire after that sprint
- Never cut scope without explicit user approval
- All apps are one family — same theme, fonts, visual language

---

## APPENDIX A: Web-Only Features (NOT on Android)

These features exist ONLY on the web app:
1. Invoicing (InvoiceList, InvoiceForm, InvoiceDetail, InvoicePreview)
2. Receipts (generation, viewing, PDF)
3. Quoting (QuoteList, QuoteForm, QuoteDetail, QuotePreview)
4. Formal Invoicing (auto-generated from accepted quotes)
5. Dashboard (stats, CSV export)
6. PDF generation (28 templates)
7. Clients management (ClientList)
8. Venues management (VenueList, VenueDetail, photos, ratings)
9. Public website (hero, gigs, about, pricing, gallery, contact)
10. GigHub (gig pipeline view)
11. Booking Wizard (quick + full booking)
12. Service catalogue
13. Stage Prompter (merged into Live Mode)
14. Import Pipeline (Capture → Web)
15. Contact form / enquiry inbox

## APPENDIX B: Android-Only Features

These features exist ONLY on Android:
1. C++ Oboe audio engine (sub-ms latency for live stage)
2. JNI bridge layer
3. SoundTouch vendored C++ build
4. Native MP3 decode (MediaCodec)
5. Debug APK sideloading (no Play Store)

## APPENDIX C: S45 Known Gaps (Android needs these to match Web)

From SPRINT_PROMPTS.md S45 audit:
1. Song sharing UI
2. Click sound picker in Settings
3. Processing status polling
4. Take playback
5. Swipe month navigation on Calendar
6. Neumorphic login inputs
7. Drawer visual parity
8. Visual alignment checklist: background colors, text sizes/weights, spacing, borders, loading states, empty states, error states, transitions, icons, interactive states

## APPENDIX D: Unbuilt / Deferred Features

1. Capture → Web bulk import UX
2. Capture history view in web app
3. Capture diagnostics (real-world quality test, armed mode e2e, FFmpeg encoding audit, concurrent load test)
4. Capture extension UX improvements (level meter, recording timer, error handling, device selector)
5. Capture backend robustness (graceful shutdown, session recovery, logging)
6. FreeAgent API integration (D-047 — needs planning)
7. Dep gig calendar feature (D-117 — diagonal split colour for member-away + dep-gig days)
8. Offline queue conflict detection (deferred)
9. Android release keystore / signing
10. More songs needed (only 4 exist: Sultans, Cissy Strut, War Pigs, + 1)

## APPENDIX E: All 158 Architecture Decision Records (Summary)

| # | Decision | Sprint/Date |
|---|----------|-------------|
| D-001 | Expo SDK 55 + React Native 0.83 | Pre |
| D-002 | expo-router file-based navigation | Pre |
| D-003 | expo-sqlite WAL mode | Pre |
| D-004 | No ORM, raw SQL | Pre |
| D-005 | Settings singleton (id='default') | Pre |
| D-006 | genId() = Date.now base36 + random | Pre |
| D-007 | HTML templates for PDF | Pre |
| D-008 | Dark neumorphic UI | Pre |
| D-009 | Karla + JetBrains Mono fonts | Pre |
| D-010 | 4 fixed band members | Pre |
| D-011 | Equal payment splits only | Pre |
| D-012 | Receipts for other members only | Pre |
| D-013 | Invoice number format INV-001 | Pre |
| D-014 | 3-step invoice wizard | Pre |
| D-015 | No cloud / no Supabase (later overridden by D-051) | Pre |
| D-016 | No invoice editing (duplicate only) | Pre |
| D-017 | CSV export for all invoices | Pre |
| D-018 | useFocusEffect for data refresh | Pre |
| D-019 | Brand colours: teal #1abc9c + orange #f39c12 | Pre |
| D-020 | PDF saved to Documents/pdfs/ | Pre |
| D-021 | Multiple invoice styles (7 total) | S-early |
| D-022 | Style picker in wizard Step 2 | S-early |
| D-023 | Template dispatcher pattern | S-early |
| D-024 | Receipts stay single-style (SUPERSEDED by D-048) | S-early |
| D-025 | Google Fonts via link tag in PDF HTML | S-early |
| D-026 | Venues tied to clients (SUPERSEDED by D-074) | S-early |
| D-027 | invoices.venue stays TEXT (not FK) | S-early |
| D-028 | Full-screen HTML preview | S-early |
| D-029 | react-native-webview for preview | S-early |
| D-030 | Pre-render all style HTMLs at Step 3 | S-early |
| D-031 | Real TGT logo base64 PNG | S-early |
| D-032 | Invoice deletion allowed | S-early |
| D-033 | Atomic createInvoice (exclusive transaction) | S-early |
| D-034 | Idempotent createReceipts | S-early |
| D-035 | HTML escape all PDF template data | S-early |
| D-036 | Invoices tab in tab bar | S-early |
| D-037 | Dashboard pull-to-refresh | S-early |
| D-038 | Backdrop dismiss on modals | S-early |
| D-039 | Save Before Share | S-early |
| D-040 | PanResponder for calendar swipe | S-early |
| D-041 | Full-screen preview shows saved style only | S-early |
| D-042 | nestedScrollEnabled={false} on WebView | S-early |
| D-043 | Preview viewport width=800 for A4 | S-early |
| D-044 | Share auto-marks sent | S-early |
| D-045 | Paid auto-generates receipts (atomic) | S-early |
| D-046 | Receipt button label adapts to state | S-early |
| D-047 | FreeAgent API integration (DEFERRED) | S-early |
| D-048 | Receipts match invoice style (supersedes D-024) | S-early |
| D-049 | 3 seasonal themed templates | S-early |
| D-050 | HTML-first template prototyping | S-early |
| D-051 | Supabase for shared calendar (exception to D-015) | S1 |
| D-052 | Tangerine Timetree as separate PWA | S1 |
| D-053 | gig_type column (gig/practice) | S1 |
| D-054 | Any member away = band unavailable | S1 |
| D-055 | Dark neon theme for Timetree | S1 |
| D-056 | Separate Add Gig / Add Practice buttons | S1 |
| D-057 | In-app change summary on open | Phase 4 |
| D-058 | away_date_changelog table | Phase 4 |
| D-059 | profiles.last_opened_at | Phase 4 |
| D-060 | NetworkFirst service worker | Phase 5 |
| D-061 | Offline mutation queue (both apps) | Phase 5 |
| D-062 | Native AsyncStorage calendar cache | Phase 5 |
| D-063 | Public website built into web/ app | S4 |
| D-064 | is_public flag on gigs | S4 |
| D-065 | band_role column on profiles | S4 |
| D-066 | public_media table | S4 |
| D-067 | No merch shop | S4 |
| D-068 | Domain: IONOS DNS → Vercel | S4 |
| D-069 | STATUS.md as instant-context document | S-SOT |
| D-070 | Sprint roadmap S2-S8 | S-SOT |
| D-071 | Session protocol — STATUS.md first | S-SOT |
| D-072 | createReceipts atomic transaction | S-audit |
| D-073 | AuthContext refreshes session on mount | S-audit |
| D-074 | Venues and clients are independent lists | S23 |
| D-075 | Clean DB restructure, no backwards-compat | S23 |
| D-076 | S22 deferred for S23 | S23 |
| D-077 | Legacy JWT keys disabled | S23 |
| D-078 | Invoices target venue OR client | S24 |
| D-079 | Venues gain contact fields | S24 |
| D-080 | "Client is the venue" toggle removed | S24 |
| D-081 | BillTo resolved at render time | S24 |
| D-082 | gig_id FK on invoices | S24 |
| D-083 | Songs & setlists in Supabase | S25 |
| D-084 | C++ Oboe audio engine | S26 |
| D-085 | Live Mode = song-driven metronome | S26 |
| D-086 | Practice Mode = metronome + MP3 + training | S26 |
| D-087 | practice-tracks storage bucket | S25 |
| D-088 | Setlist PDF sharing | S25 |
| D-089 | Recording/video capture (deferred, later built S41) | S26 |
| D-090 | Single Oboe stream for all audio | S26 |
| D-091 | aubio for beat detection (SUPERSEDED by D-100 then D-104) | S26 |
| D-092 | SoundTouch for time-stretch | S26 |
| D-093 | Beat step/nudge for alignment | S26 |
| D-094 | Role-based song edit form | S26 |
| D-095 | Lyrics + chords fields on Song | S26 |
| D-096 | Web stage prompter (later merged into Live via D-113) | S27 |
| D-097 | ClickTrack evolves into sticking/rudiment app | S26 |
| D-098 | Practice MP3: upload whatever, app handles alignment | S26 |
| D-099 | Expo Native Module pattern | S26 |
| D-100 | Custom beat detector (SUPERSEDED by D-104) | S26 |
| D-101 | SoundTouch vendored source | S26 |
| D-102 | MP3 decode via MediaCodec | S26 |
| D-103 | Track player renders additively alongside metronome | S26 |
| D-104 | Server-side madmom (replaces BTrack) | S30 |
| D-105 | Beat analysis on Cloud Run | S30 |
| D-106 | GigBooks stays native for live latency | S30 |
| D-107 | Song categories (3 types, SUPERSEDED by D-124) | S33 |
| D-108 | Setlist types: tange, other_band | S33 |
| D-109 | Personal songs unrestricted in setlists | S33 |
| D-110 | Library as launchpad | S33 |
| D-111 | Shared player with mode flag | S33 |
| D-112 | Web gets Live + Practice modes | S33 |
| D-113 | Stage prompter merges into Live Mode | S33 |
| D-114 | 1 setlist = 1 gig, player waits between songs | S33 |
| D-115 | Live reorder — queue editable mid-performance | S33 |
| D-116 | Per-user player preferences (7 booleans) | S33 |
| D-117 | Dep gig calendar feature (DEFERRED) | S33 |
| D-118 | Display toggles in bottom sheet drawer | S33 |
| D-119 | Card-level beat glow (not full-screen) | S33 |
| D-120 | All band members are admin | S33 |
| D-121 | Receipt split /4 = 3 receipts is correct | S33 |
| D-122 | Lyrics/chords = static, NO auto-scroll sync | S37 |
| D-123 | Song import from capture tool needed | S37 |
| D-124 | Song categories: 4 types (supersedes D-107) | S39 |
| D-125 | Personal covers visible to all | S39 |
| D-126 | Personal originals require explicit sharing | S39 |
| D-127 | Setlist types stay as tange/other_band | S39 |
| D-128 | Library: 2 dropdowns replace pills | S39 |
| D-129 | can_access_song() SQL helper | S39 |
| D-130 | Takes = stems with source=recorded | S39 |
| D-131 | Best take promotes to stem list | S39 |
| D-132 | Selfie: video local, audio uploaded | S39 |
| D-133 | USB audio interface support | S39 |
| D-134 | EAD-10 = practice, XR18 = live | S39 |
| D-135 | song_shares table | S39 |
| D-136 | Stem ownership: created_by boundary | S39 |
| D-137 | View Mode: 3rd player tab | S39 |
| D-138 | New song idea flow | S39 |
| D-139 | Post-recording: 4 options | S39 |
| D-140 | Overdub: user controls via mixer | S39 |
| D-141 | Click track during recording | S39 |
| D-142 | Count-in: user-defined length | S39 |
| D-143 | Take numbering: auto-increment | S39 |
| D-144 | View Mode has record button | S39 |
| D-145 | Best-only upload to cloud | S39 |
| D-146 | View Mode no-video fallback: visualiser | S39 |
| D-147 | Recording UI: unified player chrome | S39 |
| D-148 | Cloud Run: context-dependent processing | S39 |
| D-149 | Take deletion: manual, no auto-promote | S39 |
| D-150 | Record button in transport, not permanent tab | S39 |
| D-151 | Re-analyse beats from mixed master | S39 |
| D-152 | Capture unchanged for S39 (SPRINT-SCOPED, expired) | S39 |
| D-153 | Web + Android are mirror apps | S39 |
| D-154 | Capture carries ALL categories | S43 |
| D-155 | ClickTrack considered now, built later | S43 |
| D-156 | All apps are one family | S43 |
| D-157 | Sprint-scoped decisions expire | S43 |
| D-158 | Import pipeline is overdue | S43 |

---

*End of master feature spec. Every detail from 158 decisions, 108 sessions, 45 sprints, 11 mockups, and all SOT docs.*
