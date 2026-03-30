# TGT — Full App Review Document

> **How to use this document:**
> - Go through each screen section below
> - Fill in the **Status** field: `DONE` | `FUNCTIONAL` | `BROKEN` | `NOT STARTED` | `NEEDS WORK`
> - Fill in the **Notes** field with what needs changing, what's wrong, what's good
> - Mark anything you're happy with as `DONE`
> - We'll work through this section by section, ticking items off as we complete them

---

# ANDROID (GigBooks)

---

## A1. Splash Screen
**File:** `android/.../ui/screens/SplashScreen.kt`
**What it does:** Animated logo + band name reveal on app launch

**Status:**
**Notes:**


---

## A2. Login Screen
**File:** `android/.../ui/screens/LoginScreen.kt`
**What it does:** Email + password sign-in form

**Status:**
**Notes:**


---

## A3. Calendar Screen (default)
**File:** `android/.../ui/screens/CalendarScreen.kt`
**What it does:** Monthly grid, colored day cells (available/pub/client/enquiry/practice/away), day dots, venue text. Tap day to expand detail panel below calendar.

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Month grid layout | | |
| Day cell colors | | |
| Day dots (max 3) | | |
| Venue text on cells | | |
| Month navigation (arrows + swipe) | | |
| Today button | | |
| Legend (6 items) | | |
| Day detail panel (expanded) | | |
| Header (menu, title, loading) | | |

**Overall Status:**
**Notes:**


---

## A4. Library Screen
**File:** `android/.../ui/screens/LibraryScreen.kt`
**What it does:** Tabbed Songs/Setlists browser with search, filters, inline song expansion with launch buttons (Live/Practice/View/Edit)

### Songs Tab
| Sub-element | Status | Notes |
|-------------|--------|-------|
| Search bar | | |
| Scope filter (All/TGT/My/Shared) | | |
| Type filter (All/Covers/Originals) | | |
| Song cards (border color, title, artist, tags) | | |
| Meta badges (owner, shared, key, time sig, duration, TRACK, BPM) | | |
| Expanded card (Live/Practice/View/Edit buttons) | | |
| Empty state | | |

### Setlists Tab
| Sub-element | Status | Notes |
|-------------|--------|-------|
| Filter dropdown (All/TGT/Other Band) | | |
| Setlist cards (name, band, song count, duration) | | |
| Expanded setlist (song list + launch buttons) | | |
| Empty state | | |

### New Idea Dialog
| Sub-element | Status | Notes |
|-------------|--------|-------|
| Song name input | | |
| Create & Record / Cancel buttons | | |

**Overall Status:**
**Notes:**


---

## A5. Song Form Screen
**File:** `android/.../ui/screens/SongFormScreen.kt`
**What it does:** Edit song metadata — name, artist, category, BPM, key, time sig, subdivision, swing, count-in, click sound, lyrics, chords, notes, drums

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Metadata fields (name, artist, category, BPM) | | |
| Music theory (key, time sig, subdivision, swing, count-in) | | |
| Click sound selector | | |
| Content fields (notes, lyrics, chords, drums) | | |
| Save button | | |
| Beat analysis trigger | | |

**Overall Status:**
**Notes:**


---

## A6. Live Screen
**File:** `android/.../ui/screens/LiveScreen.kt`
**What it does:** Full-screen live performance mode — visualiser, text panel (chords/lyrics/notes/drums), transport, inline drawer (display/mixer/settings), queue overlay, set complete modal

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Header (song/artist/BPM, setlist position) | | |
| Mode switcher dropdown | | |
| Visualiser (hero area, green accent) | | |
| Text panel (chords/lyrics/notes/drums) | | |
| Transport (restart/play/stop) | | |
| Nav row (prev/next, queue position) | | |
| Inline drawer — Display toggles | | |
| Inline drawer — Mixer (click channel) | | |
| Inline drawer — Settings (subdivision, count-in, nudge) | | |
| Queue overlay (Queue/Songs/Setlists tabs) | | |
| Set Complete modal | | |
| Fullscreen beat glow (experimental) | | |
| Beat dots | | |
| Click audio | | |

**Overall Status:**
**Notes:**


---

## A7. Practice Screen
**File:** `android/.../ui/screens/PracticeScreen.kt`
**What it does:** Practice mode — visualiser, waveform with A-B loop, speed control, stems mixer, recording/takes, inline drawer

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Header (song/artist/BPM, mode switcher) | | |
| Visualiser (hero area, purple accent) | | |
| Waveform strip (playhead, loop region, time) | | |
| Speed controls (-5/+5, % display) | | |
| A-B loop controls (A/B/Clear pills) | | |
| Text panel (chords/lyrics/notes/drums) | | |
| Transport (restart/play/stop) | | |
| Nav row (prev/next, queue) | | |
| Inline drawer — Display toggles | | |
| Inline drawer — Mixer (click + track + stems) | | |
| Inline drawer — Record button | | |
| Inline drawer — Settings (subdivision, count-in, nudge) | | |
| Takes section (list, best take, delete) | | |
| Processing status banner | | |
| Beat alignment banner | | |
| Recording status banner (count-in, timer, level) | | |
| Post-recording dialog (4 action buttons) | | |
| Queue overlay | | |
| Fullscreen beat glow | | |
| Click audio | | |
| Track/stems audio playback | | |

**Overall Status:**
**Notes:**


---

## A8. View Screen
**File:** `android/.../ui/screens/ViewScreen.kt`
**What it does:** View mode (teal accent) — same layout as Practice but for reviewing songs without practice features

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Header (song/artist/BPM, mode switcher) | | |
| Visualiser (hero area, teal accent) | | |
| Waveform strip | | |
| Speed controls | | |
| A-B loop controls | | |
| Text panel | | |
| Transport (teal accent) | | |
| Inline drawer (display/mixer/record/settings) | | |
| Takes section | | |
| Queue overlay | | |
| Click audio | | |

**Overall Status:**
**Notes:**


---

## A9. Settings Screen
**File:** `android/.../ui/screens/SettingsScreen.kt`
**What it does:** Player settings — account info, audio engine status, click sound selector, about section, sign out

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Account section (name, role, email) | | |
| Audio Engine status | | |
| Click Sound pills (Default/High/Low/Wood/Rimshot) | | |
| About section (version, band name) | | |
| Sign Out button | | |

**Overall Status:**
**Notes:**


---

## A10. Navigation Drawer
**File:** `android/.../ui/GigBooksApp.kt`
**What it does:** 3-item side drawer (Calendar, Library, Settings)

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Drawer layout | | |
| Calendar item | | |
| Library item | | |
| Settings item | | |
| Active item highlight | | |

**Overall Status:**
**Notes:**


---

# WEB (Tangerine Timetree)

---

## W1. Splash Screen
**File:** `web/src/components/SplashScreen.tsx`
**What it does:** Loading screen with logo animation

**Status:**
**Notes:**


---

## W2. Login
**Files:** `web/src/components/LoginPage.tsx` + `LoginModal.tsx`
**What it does:** Email/password sign-in (page and modal versions)

**Status:**
**Notes:**


---

## W3. Navigation Drawer
**File:** `web/src/components/Drawer.tsx`
**What it does:** Collapsible left sidebar — all main nav items

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Collapse/expand toggle | | |
| Menu items (all destinations) | | |
| Active item highlight | | |
| Visual style (neumorphic) | | |

**Overall Status:**
**Notes:**


---

## W4. Calendar
**File:** `web/src/components/Calendar.tsx`
**What it does:** Monthly grid with colored day cells, venue text, day dots, swipe nav

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Month grid layout | | |
| Day cell colors (available/pub/client/enquiry/practice/away) | | |
| Day dots (max 3) | | |
| Venue text on cells | | |
| Month navigation (arrows + swipe) | | |
| Today button | | |
| Cell shadows | | |

**Overall Status:**
**Notes:**


---

## W5. Day Detail
**File:** `web/src/components/DayDetail.tsx`
**What it does:** Expanded day panel — date label, away indicator, gig list with type/venue/client/time/notes

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Date label | | |
| Away indicator | | |
| Gig list (type, venue, client, time, notes) | | |
| Add booking button | | |

**Overall Status:**
**Notes:**


---

## W6. Booking Wizard
**File:** `web/src/components/BookingWizard.tsx`
**What it does:** Quick + Full booking flow (4-step wizard: date/venue/client, tech details, rate, review)

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Quick mode (essential fields) | | |
| Full mode Step 1 (date, time, venue, client, band size) | | |
| Full mode Step 2 (tech details) | | |
| Full mode Step 3 (rate, tech fee) | | |
| Full mode Step 4 (review + create) | | |
| Cancel button | | |

**Overall Status:**
**Notes:**


---

## W7. Library
**File:** `web/src/components/Library.tsx`
**What it does:** Tabbed Songs/Setlists browser — search, filters, inline expansion, launch buttons. Should match Android Library (D-163).

### Songs Tab
| Sub-element | Status | Notes |
|-------------|--------|-------|
| Search bar | | |
| Scope filter (All/TGT/My/Shared) | | |
| Type filter (All/Covers/Originals) | | |
| Song cards (border, title, artist, tags, badges) | | |
| Expanded card (Live/Practice/View/Edit) | | |
| New Song button | | |
| Import button | | |
| Empty state | | |

### Setlists Tab
| Sub-element | Status | Notes |
|-------------|--------|-------|
| Filter dropdown | | |
| Setlist cards | | |
| Expanded setlist (song list + launch) | | |
| Empty state | | |

**Overall Status:**
**Notes:**


---

## W8. Import Panel
**File:** `web/src/components/ImportPanel.tsx`
**What it does:** Import songs from TGT Capture server — browse tracks, map metadata, upload to Supabase, trigger Cloud Run

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Capture server connection | | |
| Track list from Capture | | |
| Metadata mapping form | | |
| Upload + trigger processing | | |
| Status feedback | | |

**Overall Status:**
**Notes:**


---

## W9. Song Form
**File:** `web/src/components/SongForm.tsx`
**What it does:** Create/edit song — metadata, music theory, content fields

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Name, artist, category, BPM | | |
| Key, time sig, subdivision, swing, count-in | | |
| Click sound | | |
| Notes, lyrics, chords, drums | | |
| Save / Cancel | | |

**Overall Status:**
**Notes:**


---

## W10. Player (Live Mode)
**File:** `web/src/components/Player.tsx`
**What it does:** Full-screen live performance — visualiser, text panel, transport, drawer, queue. Should match Android Live Screen.

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Header (mode tabs, song/artist/BPM, setlist pos) | | |
| Mode switcher (Live/Practice/View) | | |
| Visualiser (green accent) | | |
| Text panel (chords/lyrics/notes/drums) | | |
| Transport (restart/play/stop) | | |
| Nav row (prev/next, queue position) | | |
| Drawer — Display toggles | | |
| Drawer — Mixer (click channel) | | |
| Drawer — Settings (subdivision, count-in, nudge) | | |
| Queue overlay (3 tabs) | | |
| Beat dots | | |
| Click audio | | |
| Fullscreen beat glow | | |
| Full-screen layout (no side drawer, no header gap) | | |

**Overall Status:**
**Notes:**


---

## W11. Player (Practice Mode)
**File:** `web/src/components/Player.tsx`
**What it does:** Practice mode — waveform, speed, A-B loop, stems, recording. Should match Android Practice Screen.

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Visualiser (purple accent) | | |
| Waveform strip (playhead, loop, time, speed) | | |
| Speed controls (-5/+5) | | |
| A-B loop controls | | |
| Text panel | | |
| Transport (purple accent) | | |
| Drawer — Mixer (click + track + stems) | | |
| Drawer — Display toggles | | |
| Drawer — Settings | | |
| Takes section | | |
| Processing status banner | | |
| Beat alignment banner | | |
| Recording banner + controls | | |
| Post-recording dialog | | |
| Queue overlay | | |
| Click audio | | |
| Track/stems playback | | |
| Click drift (stays in time?) | | |

**Overall Status:**
**Notes:**


---

## W12. Player (View Mode)
**File:** `web/src/components/Player.tsx`
**What it does:** View mode (teal accent) — review songs. Should match Android View Screen.

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Visualiser (teal accent) | | |
| Waveform strip | | |
| Speed / A-B loop | | |
| Text panel | | |
| Transport (teal) | | |
| Drawer (display/mixer/settings) | | |
| Takes | | |
| Queue overlay | | |
| Click audio | | |

**Overall Status:**
**Notes:**


---

## W13. GigHub
**File:** `web/src/components/GigHub.tsx`
**What it does:** Gig pipeline view — status progression (Enquiry > Confirmed > Quote > Invoice > Paid), gig details, quote/invoice cards

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Status pipeline display | | |
| Status picker | | |
| Gig details section | | |
| Quote card (generate/view) | | |
| Invoice card (create/view) | | |
| Formal invoice card | | |
| Changelog section | | |
| Delete gig button | | |

**Overall Status:**
**Notes:**


---

## W14. Invoice List
**File:** `web/src/components/InvoiceList.tsx`
**What it does:** Invoice browser — filter pills, search, invoice rows with status badges

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Filter pills (All/Draft/Sent/Paid) | | |
| Search | | |
| Invoice rows (number, client, amount, status, date) | | |
| New invoice button | | |

**Overall Status:**
**Notes:**


---

## W15. Invoice Form
**File:** `web/src/components/InvoiceForm.tsx`
**What it does:** 3-step invoice wizard — details, line items, review/preview

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Step 1 (client, date, amount, terms) | | |
| Step 2 (line items) | | |
| Step 3 (review + preview) | | |
| Save / Send | | |

**Overall Status:**
**Notes:**


---

## W16. Invoice Detail
**File:** `web/src/components/InvoiceDetail.tsx`
**What it does:** Single invoice view — header, line items, payment details, actions

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Invoice header (number, client, date, amount) | | |
| Line items table | | |
| Payment details (bank, ref, due date) | | |
| Actions (mark paid, resend, edit, delete) | | |

**Overall Status:**
**Notes:**


---

## W17. Invoice Preview
**File:** `web/src/components/InvoicePreview.tsx`
**What it does:** PDF preview with download/print

**Status:**
**Notes:**


---

## W18. Quote List
**File:** `web/src/components/QuoteList.tsx`
**What it does:** Quote browser — filter pills, quote rows

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Filter pills (All/Draft/Sent/Accepted/Expired) | | |
| Quote rows (client, amount, status, date) | | |
| New quote button | | |

**Overall Status:**
**Notes:**


---

## W19. Quote Form
**File:** `web/src/components/QuoteForm.tsx`
**What it does:** Quote builder — client, services, amount, validity

**Status:**
**Notes:**


---

## W20. Quote Detail
**File:** `web/src/components/QuoteDetail.tsx`
**What it does:** Single quote view — header, lines, actions (accept, convert to invoice)

**Status:**
**Notes:**


---

## W21. Quote Preview
**File:** `web/src/components/QuotePreview.tsx`
**What it does:** PDF preview with download/print

**Status:**
**Notes:**


---

## W22. Dashboard
**File:** `web/src/components/Dashboard.tsx`
**What it does:** Stats overview — total invoiced/paid, average rate, monthly chart, recent invoices, quick actions

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Stats cards (invoiced, paid, avg rate, gigs) | | |
| Monthly breakdown chart (6 months) | | |
| Recent invoices table | | |
| Quick action buttons | | |
| Export CSV | | |

**Overall Status:**
**Notes:**


---

## W23. Client List
**File:** `web/src/components/ClientList.tsx`
**What it does:** Client browser — search, client rows with contact info + revenue

**Status:**
**Notes:**


---

## W24. Venue List
**File:** `web/src/components/VenueList.tsx`
**What it does:** Venue browser — search, venue cards with address/contact/gig count

**Status:**
**Notes:**


---

## W25. Venue Detail
**File:** `web/src/components/VenueDetail.tsx`
**What it does:** Single venue — name, address, contact, associated gigs, edit/delete

**Status:**
**Notes:**


---

## W26. Settings
**File:** `web/src/components/Settings.tsx`
**What it does:** Full settings — account, band settings, bank details, service catalogue, public site config, reviews

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Account section | | |
| Band settings (name, members, email, phone) | | |
| Bank details | | |
| Payment terms / invoice settings | | |
| Service catalogue (add/edit/delete) | | |
| Public site settings (hero, about, gallery) | | |
| Reviews section (testimonials) | | |

**Overall Status:**
**Notes:**


---

## W27. Stage Prompter
**File:** `web/src/components/StagePrompter.tsx`
**What it does:** Full-screen lyrics/chords display for on-stage reference — large text, font size control

**Status:**
**Notes:**


---

## W28. Public Site
**File:** `web/src/components/PublicSite.tsx`
**What it does:** Public-facing website — hero, about, venues, gallery, reviews, contact form

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Hero section | | |
| About / band bio | | |
| Venues / gigs | | |
| Gallery | | |
| Reviews / testimonials | | |
| Contact form | | |
| Footer | | |

**Overall Status:**
**Notes:**


---

## W29. Away Manager
**File:** `web/src/components/AwayManager.tsx`
**What it does:** Manage away dates (calendar blocks for band unavailability)

**Status:**
**Notes:**


---

## W30. Enquiries
**File:** `web/src/components/Enquiries.tsx`
**What it does:** Dedicated enquiry view

**Status:**
**Notes:**


---

## W31. Profile Page
**File:** `web/src/components/ProfilePage.tsx`
**What it does:** User profile management

**Status:**
**Notes:**


---

## W32. Gig List
**File:** `web/src/components/GigList.tsx`
**What it does:** Alternative list view of gigs (vs calendar grid)

**Status:**
**Notes:**


---

## W33. Gig Form
**File:** `web/src/components/GigForm.tsx`
**What it does:** Gig details form (alternative to BookingWizard)

**Status:**
**Notes:**


---

## W34. App Tutorial
**File:** `web/src/components/AppTutorial.tsx`
**What it does:** First-time user onboarding tooltips/highlights

**Status:**
**Notes:**


---

## W35. Media Manager
**File:** `web/src/components/MediaManager.tsx`
**What it does:** File/media upload management (for public site images etc)

**Status:**
**Notes:**


---

## W36. Legacy — SongList
**File:** `web/src/components/SongList.tsx`
**What it does:** Legacy song library view (may be deprecated — Library.tsx replaces it)

**Status:**
**Notes:**


---

## W37. Legacy — SetlistList + SetlistDetail
**Files:** `web/src/components/SetlistList.tsx` + `SetlistDetail.tsx`
**What it does:** Legacy setlist views (may be deprecated — Library.tsx replaces them)

**Status:**
**Notes:**


---

# CAPTURE (TGT Capture)

---

## C1. Track List (Library)
**File:** `capture/ui/src/components/TrackList.tsx`
**What it does:** Track grid with search + category filter + favorites

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Search bar | | |
| Category filter dropdown | | |
| Track cards (thumbnail, title, artist, category, duration, fav) | | |
| Empty state | | |

**Overall Status:**
**Notes:**


---

## C2. Track Detail
**File:** `capture/ui/src/components/TrackDetail.tsx`
**What it does:** Single track — waveform canvas, audio player, metadata edit form

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Waveform canvas (playhead, seek) | | |
| Play/pause + time display | | |
| Song metadata (title, artist, album, genre) | | |
| Song category (tgt_cover/tgt_original/personal_cover/personal_original) | | |
| Practice metadata (practice_category, instrument_focus, difficulty) | | |
| Notes field | | |
| Save button | | |

**Overall Status:**
**Notes:**


---

## C3. Capture Panel
**File:** `capture/ui/src/components/CapturePanel.tsx`
**What it does:** WASAPI recording — device selector, recording controls, review, encoding

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Device selector (WASAPI dropdown) | | |
| Chrome extension auto-detect | | |
| Start / Pause / Stop buttons | | |
| Status display (idle/recording/review/encoding) | | |
| Duration timer | | |
| Review controls (preview waveform, confirm, discard) | | |
| Encoding progress | | |
| Error banner | | |
| Backend connection status | | |

**Overall Status:**
**Notes:**


---

## C4. Server Panel
**File:** `capture/ui/src/components/ServerPanel.tsx`
**What it does:** Backend status, logs, restart

**Status:**
**Notes:**


---

## C5. Navigation Drawer
**File:** `capture/ui/src/components/Drawer.tsx`
**What it does:** Library / Capture / Server nav

**Status:**
**Notes:**


---

## C6. Chrome Extension Side Panel
**File:** `capture/extension/sidepanel.html` + `sidepanel.js`
**What it does:** Recording controls in Chrome sidebar — tab detection, WASAPI source, timer, level meter, embedded React UI iframe

| Sub-element | Status | Notes |
|-------------|--------|-------|
| Connection banner (backend online/offline) | | |
| Tab name auto-detect | | |
| Record / pause / stop controls | | |
| Timer | | |
| Level meter | | |
| Embedded iframe (Capture UI) | | |
| Error handling | | |

**Overall Status:**
**Notes:**


---

# CROSS-PLATFORM PARITY CHECKS

> These items need to match between Android and Web (D-153, D-163)

| Item | Android | Web | Match? | Notes |
|------|---------|-----|--------|-------|
| Library layout (Songs tab) | | | | |
| Library layout (Setlists tab) | | | | |
| Song card design + badges | | | | |
| Expanded card (launch buttons) | | | | |
| Live mode layout | | | | |
| Practice mode layout | | | | |
| View mode layout | | | | |
| Visualiser appearance | | | | |
| Beat dots (no accent on 1) | | | | |
| Transport buttons | | | | |
| Inline drawer behavior | | | | |
| Mixer layout | | | | |
| Queue overlay | | | | |
| Set complete modal | | | | Web missing? |
| Waveform strip | | | | Web missing? |
| Click sound | | | | |
| Click timing accuracy | | | | |
| Full-screen (no header gap) | | | | |
| Font (Karla + JetBrains Mono) | | | | |
| Dark neumorphic theme | | | | |
| Mode switcher (dropdown) | | | | |

---

# KNOWN ISSUES (from STATUS.md / todo.md)

| Issue | App | Status | Notes |
|-------|-----|--------|-------|
| Click drifts after ~60s | Web | | |
| Set-complete modal missing | Web | | |
| Waveform strip with loop region missing | Web | | |
| Calendar cell shadows | Web | | |
| Capture category field alignment | Capture | | |
| Capture → Web import (bulk) | Pipeline | | |
| Capture → Web import (standalone PWA) | Pipeline | | |

---

# PRIORITY NOTES

> Use this space for anything that doesn't fit above — overall priorities, things that affect multiple screens, general feedback

**Notes:**


