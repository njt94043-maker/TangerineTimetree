# GigBooks — Decisions Log

> Architecture Decision Records (ADRs). Append-only.
> Each decision is FINAL — do not revisit without explicit user approval.

---

| ID | Decision | Date | Rationale |
|----|----------|------|-----------|
| D-001 | Expo SDK 55 + React Native 0.83 | 2026 | Latest stable Expo SDK; matches other projects |
| D-002 | expo-router for navigation (file-based) | 2026 | Cleaner than React Navigation config; consistent file structure |
| D-003 | expo-sqlite (WAL mode) for storage | 2026 | Local-only, offline-first; no cloud dependency |
| D-004 | No ORM — raw SQL queries | 2026 | Simpler for 5-table schema; no abstraction overhead |
| D-005 | Settings singleton (id = 'default') | 2026 | Single-user app; no need for multi-tenant settings |
| D-006 | genId() = Date.now base36 + random | 2026 | Simple, unique enough for local-only; no UUID dependency |
| D-007 | HTML templates for PDF generation | 2026 | expo-print renders HTML to PDF; easier to style than code-generated |
| D-008 | Dark neumorphic UI | 2026 | Matches Budget app aesthetic; NeuCard/NeuWell/NeuButton components |
| D-009 | Karla + JetBrains Mono fonts | 2026 | Karla for body text, JetBrains Mono for numbers/data; same as Budget |
| D-010 | 4 fixed band members | 2026 | Business requirement — Nathan + 3 others; names editable, count fixed |
| D-011 | Equal payment splits only | 2026 | invoice.amount ÷ total_members; no custom percentages needed |
| D-012 | Receipts for other members only | 2026 | Nathan doesn't need proof of paying himself; is_self flag excludes him |
| D-013 | Invoice number format INV-001 | 2026 | Sequential, auto-incremented from settings.next_invoice_number |
| D-014 | 3-step invoice wizard | 2026 | Guided UX: client selection → gig details → preview & generate |
| D-015 | No cloud / no Supabase | 2026 | Privacy, simplicity; PDF sharing is the only network operation |
| D-016 | No invoice editing (duplicate only) | 2026 | Invoices are financial records; "Create Similar" instead of edit |
| D-017 | CSV export for all invoices | 2026 | Simple accounting export; no complex reporting needed |
| D-018 | useFocusEffect for data refresh | 2026 | Screens reload data when focused; simpler than global state |
| D-019 | Brand colours: teal #1abc9c + orange #f39c12 | 2026 | The Green Tangerine brand identity; used in both app UI and PDFs |
| D-020 | PDF saved to Documents/pdfs/ | 2026 | Persistent local storage; accessible via file manager |
| D-021 | Multiple invoice styles (classic/premium/clean/bold) | 2026-03-02 | User designs different PDFs for different venues; style stored per invoice |
| D-022 | Style picker in wizard Step 2 (not a new step) | 2026-03-02 | Keeps wizard at 3 steps; style is part of "gig details" configuration |
| D-023 | Template dispatcher pattern (getInvoiceHtml) | 2026-03-02 | Record<style, fn> lookup with fallback to classic; each template is its own file |
| D-024 | Receipts stay single-style | 2026-03-02 | Receipts are internal payment proof; no need for visual variety |
| D-025 | Google Fonts loaded via link tag in PDF HTML | 2026-03-02 | expo-print WebView has network access; fonts load at render time |
| D-026 | Venues tied to clients (not global) | 2026-03-02 | Each client has their own venue list; prevents cross-client confusion |
| D-027 | invoices.venue stays TEXT (not FK) | 2026-03-02 | Simpler migration; venue name is the meaningful value; historical invoices stay valid |
| D-028 | Full-screen HTML preview replaces StylePicker + text summary | 2026-03-02 | Users see exactly what the PDF looks like before generating; better UX than colour swatches |
| D-029 | react-native-webview for invoice preview | 2026-03-02 | Only way to render HTML in-app; expo-print can only generate PDFs, not display them |
| D-030 | Pre-render all style HTMLs at Step 3 entry | 2026-03-02 | Avoids lag during swipe; 4 string generations is cheap |
| D-031 | Real TGT logo as circular-cropped base64 PNG | 2026-03-02 | Replaces generated SVG recreation; embedded in all PDF templates via logo.ts |
| D-032 | Invoice deletion allowed | 2026-03-02 | Test invoices and cancelled gigs need cleanup; deletes receipts + PDF files |
| D-033 | Atomic createInvoice (exclusive transaction) | 2026-03-02 | INSERT + counter bump must succeed or fail together; prevents invoice number gaps |
| D-034 | Idempotent createReceipts (duplicate guard) | 2026-03-02 | Returns existing receipts if already generated; prevents double-tap duplicates |
| D-035 | HTML escape all PDF template data | 2026-03-02 | Client names with & < > " would break HTML; shared htmlEscape() utility |
| D-036 | Invoices tab in tab bar | 2026-03-02 | Full searchable invoice list as first-class tab; biggest UX gap from audit |
| D-037 | Dashboard pull-to-refresh | 2026-03-02 | Standard mobile UX; ScrollView + RefreshControl wrapping dashboard content |
| D-038 | Backdrop dismiss on modals | 2026-03-02 | VenuePicker + new client modal close on outside tap; standard mobile pattern |
| D-039 | Save Before Share (decouple generate from share) | 2026-03-02 | Wizard saves PDF without share sheet; detail screen has separate Share + Regenerate buttons; user verifies before sharing |
| D-040 | PanResponder for calendar swipe | 2026-03-02 | Horizontal swipe on day grid changes months; threshold dx>50; arrow buttons remain; refs prevent stale closures |
| D-041 | Full-screen preview shows saved style only | 2026-03-02 | Single WebView preview of the invoice's actual style; no carousel on detail preview; wizard keeps carousel for style selection |
| D-042 | nestedScrollEnabled={false} on WebView in carousels | 2026-03-02 | Prevents WebView from intercepting horizontal swipes; FlatList paging works reliably; vertical scroll still works |
| D-043 | Preview viewport width=800 for A4 proportions | 2026-03-02 | Replaces device-width with 800px in viewport meta for WebView; matches PDF rendering proportions; auto-scales to fit phone screen |
| D-044 | Share auto-marks invoice as "sent" | 2026-03-02 | Only upgrades from draft; never downgrades from paid; standard business workflow |
| D-045 | Paid auto-generates receipts (atomic transaction) | 2026-03-02 | markInvoicePaid() wraps status + receipt INSERT in withExclusiveTransactionAsync; idempotent (existing receipts returned) |
| D-046 | Receipt button label adapts to state | 2026-03-02 | Shows "View Receipts" when receipts exist, "Generate Receipts" when none; receipts screen handles PDF gen either way |
| D-047 | FreeAgent API integration (deferred) | 2026-03-02 | User interest in syncing income/expenses to FreeAgent for tax reporting; would require relaxing D-015 (no cloud); needs separate planning |
| D-048 | Receipts match invoice style (supersedes D-024) | 2026-03-02 | Each receipt uses the same visual template as its parent invoice; 4 receipt templates mirror 4 invoice templates; getReceiptHtml dispatcher matches getInvoiceHtml pattern |
| D-049 | 3 seasonal themed templates: christmas, halloween, valentine | 2026-03-02 | Themed invoice/receipt styles with SVG decorations (holly, pumpkins, hearts/roses), custom background textures, and seasonal fonts. Same dispatcher pattern as existing styles. |
| D-050 | HTML-first template prototyping workflow | 2026-03-02 | Prototype templates as standalone .html files in mockups/ folder; iterate in browser; convert to .ts template functions (backtick wrap + field interpolation). Avoids JSX→HTML conversion overhead. |
| D-051 | Supabase for shared gig calendar (exception to D-015) | 2026-03-03 | Gigs tab uses Supabase (auth + Postgres + realtime) for multi-user shared calendar. Rest of app remains local-only SQLite. Separate concern, separate data store. |
| D-052 | Tangerine Timetree as separate PWA | 2026-03-03 | Band members (iPhone) access shared calendar via installable PWA at tangerine-timetree.vercel.app. React + Vite + Supabase client. Same backend as GigBooks Gigs tab. |
| D-053 | gig_type column ('gig' \| 'practice') | 2026-03-03 | Differentiates gig bookings from practice sessions. Practice hides fee/client/payment/load-in fields. Separate "Add Practice" button in day detail. |
| D-054 | Any member away = band unavailable | 2026-03-03 | Simplified availability: if any of the 4 members is away on a date, the band is unavailable. No "partial" status. User clarification: "if one member is away, the band is unavailable." |
| D-055 | Dark neon theme for Timetree | 2026-03-03 | Near-black (#08080c) background, gunmetal cards (#111118), neon green gigs (#00e676), purple practice (#bb86fc), red away (#ff5252), tangerine orange branding. CSS glow effects. User: "gigs should be green, we need neon and glow." |
| D-056 | Separate Add Gig / Add Practice buttons | 2026-03-03 | Day detail shows "Add Gig" (green, full width) + "Add Practice" (purple, half) + "I'm Away" (tangerine, half). Type determined by button press, not a toggle in the form. User preference. |
| D-057 | In-app change summary on open | 2026-03-04 | On app open, fetch changes since last_opened_at from gig_changelog + away_date_changelog (other users' changes only). Web: dismissible banner. Native: Alert.alert. Updates last_opened_at on dismiss. |
| D-058 | away_date_changelog table | 2026-03-04 | Tracks create/delete of away dates. Columns: id, away_date_id, user_id, action, date_range, reason, created_at. RLS: authenticated read, own inserts. |
| D-059 | profiles.last_opened_at for change tracking | 2026-03-04 | Server-side timestamp tracking when user last viewed the app. Used to determine which changelog entries are "new". Updated on dismiss of change summary. |
| D-060 | Web: NetworkFirst service worker for Supabase API | 2026-03-04 | Workbox runtimeCaching: Supabase REST API uses NetworkFirst with 10s timeout and 24h cache. Google Fonts use CacheFirst with 1-year cache. Enables offline reading of cached calendar data. |
| D-061 | Offline mutation queue pattern (both apps) | 2026-03-04 | When mutations fail with network errors, queue in localStorage (web) or AsyncStorage (native). Auto-replay on reconnect. Web: useOfflineQueue hook + isNetworkError/queueMutation utilities. Native: offlineQueue.ts with NetInfo listener. |
| D-062 | Native AsyncStorage calendar cache | 2026-03-04 | After each successful fetch, cache gigs/awayDates/profiles in AsyncStorage keyed by year-month. On fetch failure, serve from cache and show "Offline" banner. |
| D-063 | Public website built into web/ app | 2026-03-04 | Single Vite app serves both public site (unauthenticated) and band tools (authenticated). Avoids two deployments. PublicSite replaces LoginPage for visitors. |
| D-064 | is_public flag on gigs | 2026-03-04 | Boolean column (default false) controls whether a gig appears on the public website. Toggle in gig form (web + native). Anonymous Supabase read via RLS policy. |
| D-065 | band_role column on profiles | 2026-03-04 | Text field for instrument/role display (e.g. "Lead Guitar & Backing Vocals"). Editable on profile page. |
| D-066 | public_media table for website gallery | 2026-03-04 | Separate table for photos/videos on the public site. RLS: anonymous read, authenticated manage. Not tied to gigs. |
| D-067 | No merch shop | 2026-03-04 | Base44 had InkThreadable/Shopify integration — not used, cut entirely. |
| D-068 | Domain: IONOS DNS → Vercel | 2026-03-04 | thegreentangerine.com pointed to Vercel via A record (76.76.21.21) + CNAME (cname.vercel-dns.com). SSL auto-provisioned by Vercel. |
| D-069 | STATUS.md as instant-context document | 2026-03-04 | 3-layer context system: Layer 1 (STATUS.md — 30s read), Layer 2 (todo.md, gotchas.md — working context), Layer 3 (SESSION_LOG.md, decisions_log.md — deep reference). Minimizes context loss between sessions. |
| D-070 | Sprint roadmap S2–S8 | 2026-03-04 | Defined sprint-sized work packages: S2 (APK fix + HIGH issues), S3 (docs + CI), S4-S6 (public website sprints 1-3), S7 (MEDIUM issues), S8 (polish). Each session wraps up with pickup prompt for next sprint. |
| D-071 | Session protocol updated — STATUS.md first | 2026-03-04 | Session start reads STATUS.md before todo.md. Deeper docs (SESSION_LOG, decisions_log, gotchas) only when needed. Reduces startup time from reading 6 files to 2. |
| D-072 | createReceipts wrapped in atomic transaction | 2026-03-04 | createReceipts() now uses withExclusiveTransactionAsync() — matches markInvoicePaid() pattern. Prevents partial receipt creation on crash. |
| D-073 | AuthContext refreshes session on mount | 2026-03-04 | getSession() returns cached JWT which may be expired. Now calls refreshSession() to validate + extend TTL. If refresh fails, clears auth state cleanly. |
| D-074 | Venues and clients are independent lists | 2026-03-05 | Two separate lists — no forced FK. Gigs/quotes/invoices reference both via optional venue_id + client_id FKs. Covers all 8 booking scenarios. |
| D-075 | Clean DB restructure, not backwards-compat migration | 2026-03-05 | No production data yet. Snapshot → clean ALTER → re-seed. No backwards-compat shims. |
| D-076 | S22 deferred in favour of S23 | 2026-03-05 | S23 (venue/client restructure) done first — changes data model S22 screens display. |
| D-077 | Legacy JWT API keys disabled | 2026-03-05 | Leaked service_role key invalidated by disabling legacy JWT-based keys. New publishable/secret keys active. |
| D-078 | Invoices/quotes can target venue OR client (at least one required) | 2026-03-05 | Real-world: pubs pay directly (invoice venue), agencies book venues (invoice client). client_id becomes nullable on invoices/quotes/formal_invoices. CHECK constraint ensures at least one of client_id/venue_id is set. Supersedes forced client_id NOT NULL. |
| D-079 | Venues gain email/phone/contact_name for direct invoicing | 2026-03-05 | When a venue is the billing target, need contact info for the invoice "Bill To" section. |
| D-080 | "Client is the venue" toggle removed | 2026-03-05 | Replaced by explicit bill-to choice on invoice/quote forms. No auto-creating ghost client records when venue pays directly. |
| D-081 | BillTo resolved at render time from whichever entity is present | 2026-03-05 | PDF templates and list views use a shared resolveBillTo() function. Returns {name, contact, address, email} from client or venue. |
| D-082 | gig_id FK on invoices for gig→invoice linking | 2026-03-05 | Enables "Create Invoice" shortcut from gig day view, "Invoiced" badge on gigs, and prevents duplicate invoices per gig. invoices.gig_id nullable UUID FK → gigs(id) SET NULL. |
| D-083 | Songs & setlists in Supabase (shared between both apps) | 2026-03-06 | Songs store metronome data (BPM, time sig, subdivisions, accent patterns, click sound) + optional practice MP3. Setlists are ordered song collections. Both apps access the same data. 3 tables: songs, setlists, setlist_songs. |
| D-084 | C++ Oboe audio engine for metronome (port from ClickTrack) | 2026-03-06 | JS metronomes can't match frame-accurate timing. Port ClickTrack's Oboe/C++ metronome into an Expo native module. JNI bridge pattern already proven in ClickTrack. |
| D-085 | Live Mode = song-driven read-only metronome (native only) | 2026-03-06 | Load a setlist, navigate songs, each feeds BPM/time sig/subdivisions to C++ click engine. High-quality visual beat display. No manual BPM controls. Screen stays on. No samples/loops yet. |
| D-086 | Practice Mode = metronome + MP3 playback + training tools | 2026-03-06 | Same click engine as live mode. Plus: MP3 backing tracks (expo-av), time-stretch (pitch-preserved speed change), A-B section looping, speed trainer (auto BPM increment). Inspired by Yamaha Rec'n'Share. |
| D-087 | practice-tracks storage bucket for MP3 backing tracks | 2026-03-06 | Supabase Storage bucket, public read, authenticated write. Audio files stored at {songId}/{filename}. Accessible from both apps. |
| D-088 | Setlist PDF sharing with band-themed template | 2026-03-06 | Generate professional setlist document from any setlist (existing or custom-tailored). Share with clients/venues. Uses existing PDF template infrastructure. Tangerine Timetree branding. |
| D-089 | Recording/video capture (front camera) deferred | 2026-03-06 | Selfie/front camera recording for practice sessions. Will spec properly later. Not in initial Songs & Setlists sprints. |
| D-090 | Single Oboe stream for all audio (metronome + track player) | 2026-03-06 | Click and MP3 backing track mixed in the same C++ audio callback. Zero drift between click and track. No separate audio pipelines. Same architecture as ClickTrack. |
| D-091 | aubio for beat detection from MP3 | 2026-03-06 | C library, analyses PCM to detect BPM + beat positions. Auto-populates Song.bpm and beat_offset_ms on track upload. GPL license — fine for personal band app. |
| D-092 | SoundTouch for pitch-preserved time-stretch | 2026-03-06 | C++ library (LGPL), proven. Speed slider adjusts both SoundTouch rate AND metronome BPM proportionally. Runs in the Oboe audio callback. |
| D-093 | Beat step/nudge for manual click-to-track alignment | 2026-03-06 | Inspired by Yamaha Rec'n'Share. If auto-detection puts click on wrong beat, tap nudge to shift it. Shifts metronome phase relative to track position. Saves as beat_offset_ms on Song. |
| D-094 | Role-based song edit form (drummer vs other members) | 2026-03-06 | Nathan (band_role=Drums) sees full metronome settings (subdivision, swing, accent, click sound, count-in). Others see simplified form (name, artist, BPM, time sig, key, chords, lyrics, notes, practice track). BPM and time sig visible to all. |
| D-095 | Lyrics + chords fields on Song | 2026-03-06 | New text fields for stage prompter use. Supports ChordPro-style inline notation ([Am]lyrics[F]here). All members can edit. Displayed on web stage prompter and native practice view. |
| D-096 | Web stage prompter (no audio) | 2026-03-06 | Read-only setlist display for tablet/phone on music stand. Shows lyrics, chords, key, BPM, song notes. Navigate through setlist. Full-screen dark mode. C++ audio engine is native-only — web gets display only. |
| D-097 | ClickTrack evolves into sticking/rudiment practice app | 2026-03-06 | GigBooks absorbs the metronome/live/practice features. ClickTrack pivots to hand-foot coordination, rudiments, sticking patterns. Separate apps, separate purposes. May share Supabase songs/setlists tables later. |
| D-098 | Practice MP3 prep: upload whatever you have, app handles alignment | 2026-03-06 | aubio detects BPM + beat 1 from any reasonable quality audio (full mix, drumless stem, 128kbps+). Beat nudge for manual correction. No requirement to pre-process in Reaper. Full mix with drums = easiest for detection (strong transients). |
| D-099 | Expo Native Module for C++ audio engine (local module pattern) | 2026-03-06 | Module lives in `modules/click-engine/`, auto-linked via expo-module.config.json. Kotlin `object` with `@JvmStatic external` for JNI bridge (cleaner than companion object). Stripped engine: metronome + mixer only (no poly/sample/loop/midi from ClickTrack). Single Oboe stream. JS gets typed wrapper + `loadSong(song)` helper. |
| D-100 | Custom beat detector instead of aubio | 2026-03-07 | Onset-strength (spectral flux) + autocorrelation BPM estimation + peak-picking for beat positions. Avoids aubio GPL dependency and complex waf build system. Same algorithm family (onset detection + tempo estimation). Simpler build: zero external dependencies, pure C++. If accuracy insufficient, can swap in aubio later with same API surface. |
| D-101 | SoundTouch vendored source (not prebuilt) | 2026-03-07 | SoundTouch source cloned into `modules/click-engine/android/third_party/soundtouch/`. Built as static lib via CMake. Float-only mode (SOUNDTOUCH_FLOAT_SAMPLES=1). LGPL license — fine for personal app. Vendoring avoids AAR dependency management and gives full build control. |
| D-102 | MP3 decode via Android MediaCodec in Kotlin | 2026-03-07 | MediaExtractor + MediaCodec decode MP3 to 16-bit PCM on background thread, convert to float [-1,1], pass to C++ via JNI. No third-party decode library needed. Supports all Android-native audio codecs (MP3, AAC, FLAC, etc.). Download from URL to cache, decode, delete cache file. |
| D-103 | Track player renders additively alongside metronome | 2026-03-07 | onAudioReady() clears buffer, renders metronome (ch0 gain), renders track_player additively (ch1 gain), applies master gain. Both use same Oboe stream = zero drift. Track speed change (SoundTouch tempo) automatically adjusts metronome BPM proportionally via baseBpm_ × speed ratio. |
| D-104 | Server-side madmom for beat detection (replace BTrack) | 2026-03-08 | BTrack has architectural limits: 41-element tempo transition matrix caps changes at ~5%/beat (fails War Pigs 140→110 BPM), onset-based detection can't distinguish beats from syncopated accents (fails Cissy Strut). madmom uses RNN (learned beat concept from spectrograms) + DBN (Viterbi decode with tempo as hidden state) = best MIREX accuracy, handles syncopation + tempo changes. Beat map (array of timestamps) stored in Supabase, C++ engine reads timestamps instead of running analysis. BTrack code becomes removable. |
| D-105 | Beat analysis hosted on Cloud Run (Python + madmom) | 2026-03-08 | Supabase Edge Functions are Deno/JS — can't run madmom (Python + numpy). Google Cloud Run free tier (2M req/mo, 360K vCPU-sec) covers band scale (5-50 songs) at zero cost. Triggered after practice track upload. Async — not instant, but acceptable. |
| D-106 | GigBooks stays native for live stage latency | 2026-03-08 | Explored consolidating everything into web app (Web Audio API can do practice playback). Confirmed native C++ still needed: sub-ms Oboe latency for live stage click, offline capability, screen wake lock. Web Audio is 5-20ms — fine for practice, not for stage IEM click. GigBooks = stage performance client. Web = everything else. |
| D-107 | Song categories: tange_cover, tange_original, personal | 2026-03-09 | Songs need categorisation for filtering. `category TEXT` column with CHECK constraint. Personal songs have `owner_id UUID` FK to profiles (NULL for band songs). |
| D-108 | Setlist types: tange, other_band | 2026-03-09 | Setlists need band context. `setlist_type TEXT` + `band_name TEXT` (defaults to 'The Green Tangerine'). Other band setlists for dep/standing-in gigs. |
| D-109 | Personal songs unrestricted — can go in any setlist | 2026-03-09 | A personal song Nathan knows can appear in both TGT and other band setlists. No foreign key constraint between song category and setlist type. |
| D-110 | Library as launchpad — Live/Practice launch from Library | 2026-03-09 | Drawer simplifies to 4 items (Calendar, Library, Settings + web-only items). No separate Live/Practice nav destinations. User browses Library, taps song/setlist, chooses Live or Practice mode → enters player with that queue. |
| D-111 | Shared player screen with mode flag | 2026-03-09 | One player composable/component with mode (Live vs Practice). Live = click + visuals + lyrics/chords, no backing tracks. Practice = full mixer + tracks + stems. Same visual hero, transport, queue overlay. |
| D-112 | Web gets Live + Practice modes (Web Audio API + SoundTouchJS) | 2026-03-09 | All 4 band members can practice from browser. Web Audio for click scheduling + track playback + stem mixing. SoundTouchJS for pitch-preserved speed control. Latency ~20-50ms — fine for practice, Nathan uses native for stage. |
| D-113 | Stage prompter merges into Live Mode | 2026-03-09 | Existing web stage prompter absorbed into Live Mode player. Lyrics/chords display below visual hero. Per-user toggles (click, flash, lyrics, chords) stored in user_settings. Neil/James/Adam disable click, keep lyrics. |
| D-114 | 1 setlist = 1 gig, player waits between songs | 2026-03-09 | No multi-set support. If gig has 2 sets, make 2 setlists. Player does NOT auto-advance — waits on "Next Up" screen until user taps Go. Set Complete screen at end of queue with restart/home options. |
| D-115 | Live reorder — queue editable mid-performance | 2026-03-09 | Song list overlay has "Reorder" button. Drag-to-reorder available during performance. Tap to jump to any song. |
| D-116 | Per-user player preferences in user_settings | 2026-03-09 | 7 boolean columns: player_click_enabled, player_flash_enabled, player_lyrics_enabled, player_chords_enabled, player_notes_enabled, player_drums_enabled, player_vis_enabled. Each member configures their own Live Mode experience. |
| D-117 | Dep gig calendar feature deferred (separate planning) | 2026-03-09 | Diagonal split colour for member-away + dep-gig days. Needs new gig type, calendar rendering changes, member availability logic. Out of scope for S33, parked for future sprint. |
| D-118 | Display toggles live in bottom sheet drawer | 2026-03-09 | Player display controls (Vis/Chords/Lyrics/Notes/Drums) placed in bottom sheet drawer under "Display" section — keeps main player screen clean. Toggles control which cards are visible; layout auto-redistributes with CSS flex. |
| D-119 | Card-level beat glow (not full-screen) | 2026-03-09 | Beat glow is per-card overlay (`.beat-glow` + `.screen-flash` inside visual area) with `box-shadow: inset 0 0 40px 10px`. Same approach as practice mockup. Full-screen edge glow was tested and rejected — card glow looks better. |
