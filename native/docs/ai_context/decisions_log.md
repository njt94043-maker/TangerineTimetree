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

## D-072: Venues and clients are independent lists (2026-03-05)
- **Context**: Needed to handle: pubs that book themselves, companies with multiple venues, wedding couples at shared venues, festival organisers
- **Decision**: Two separate lists — Venues (physical places with ratings/photos/nav) and Clients (people/companies who pay with billing info). No forced FK between them. Gigs/quotes/invoices reference both via optional venue_id + client_id FKs.
- **Rationale**: Covers all 8 real-world booking scenarios without over-engineering. Simplest model that works.

## D-073: Clean DB restructure, not backwards-compat migration (2026-03-05)
- **Context**: App has no production data yet (only seed/test data). Migration could either add nullable columns with backwards compat or do a clean restructure.
- **Decision**: Snapshot data, clean ALTER tables, re-seed. No backwards-compat shims.
- **Rationale**: No real data to protect. Clean schema is simpler to maintain long-term.

## D-074: S22 deferred in favour of S23 (2026-03-05)
- **Context**: S22 (native visual overhaul) was next priority, but venue/client restructure (S23) affects the data model that S22 screens would display.
- **Decision**: Do S23 first (4 sessions), then S22.
- **Rationale**: No point pixel-perfecting screens that will change shape when venue/client pickers replace text fields.
