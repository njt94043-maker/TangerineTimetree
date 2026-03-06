# TGT — Schema Map

> Source of Truth for all data models, database schema, and type definitions.
> Update on any data model change.
> All data lives in **Supabase** (no local SQLite).

---

## Supabase Project

- **Project**: `jlufqgslgjowfaqmqlds.supabase.co`
- **API keys**: Publishable (`sb_publishable_...`) + Secret (`sb_secret_...`). Legacy JWT keys **disabled** (2026-03-05).
- **RLS**: Enabled on all tables. Publishable key respects RLS; secret key bypasses it.
- **Realtime**: Enabled on `gigs` + `away_dates`.
- **Storage buckets**: `public-media`, `venue-photos`, `practice-tracks`
- **RPC functions**: `next_invoice_number()`, `next_quote_number()` — atomic auto-increment (SECURITY DEFINER)

---

## Tables (23)

### Calendar & Profiles

#### profiles
Extends `auth.users`. Auto-created on signup via `handle_new_user()` trigger.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | — | FK → auth.users(id) CASCADE |
| name | TEXT | NO | — | Display name |
| is_admin | BOOLEAN | YES | FALSE | |
| avatar_url | TEXT | YES | '' | |
| band_role | TEXT | YES | '' | e.g. "Lead Guitar & Backing Vocals" |
| last_opened_at | TIMESTAMPTZ | YES | NOW() | For change summary feature |
| created_at | TIMESTAMPTZ | YES | NOW() | |

**RLS**: SELECT all authenticated; UPDATE own only.

#### gigs
Gig and practice records. Realtime-subscribed.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | gen_random_uuid() | |
| date | DATE | NO | — | |
| gig_type | TEXT | YES | 'gig' | CHECK: 'gig', 'practice' |
| venue | TEXT | YES | '' | Free-text (display name) |
| client_name | TEXT | YES | '' | Free-text (display name) |
| venue_id | UUID | YES | NULL | FK → venues(id) SET NULL |
| client_id | UUID | YES | NULL | FK → clients(id) SET NULL |
| fee | NUMERIC(10,2) | YES | NULL | GBP |
| payment_type | TEXT | YES | — | CHECK: 'cash', 'invoice', '' |
| load_time | TIME | YES | NULL | |
| start_time | TIME | YES | NULL | |
| end_time | TIME | YES | NULL | |
| notes | TEXT | YES | '' | |
| visibility | TEXT | YES | 'private' | CHECK: 'public', 'private', 'hidden' |
| created_by | UUID | NO | — | FK → profiles(id) |
| created_at | TIMESTAMPTZ | YES | NOW() | |
| updated_at | TIMESTAMPTZ | YES | NOW() | Auto-updated by trigger |

**Index**: `idx_gigs_date` ON gigs(date).
**RLS**: SELECT/UPDATE/DELETE all authenticated; INSERT requires created_by = auth.uid(). Anon SELECT where visibility = 'public'.

#### away_dates
Band member availability. Realtime-subscribed.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | gen_random_uuid() | |
| user_id | UUID | NO | — | FK → profiles(id) CASCADE |
| start_date | DATE | NO | — | |
| end_date | DATE | NO | — | |
| reason | TEXT | YES | '' | |
| created_at | TIMESTAMPTZ | YES | NOW() | |

**Constraint**: end_date >= start_date.
**RLS**: SELECT all authenticated; INSERT/UPDATE/DELETE own only.

#### gig_changelog
Audit trail for gig CRUD.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | gen_random_uuid() | |
| gig_id | UUID | NO | — | FK → gigs(id) CASCADE |
| user_id | UUID | NO | — | FK → profiles(id) |
| action | TEXT | NO | — | CHECK: 'created', 'updated', 'deleted' |
| field_changed | TEXT | YES | '' | |
| old_value | TEXT | YES | '' | |
| new_value | TEXT | YES | '' | |
| created_at | TIMESTAMPTZ | YES | NOW() | |

#### away_date_changelog
Audit trail for away date mutations.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | gen_random_uuid() | |
| away_date_id | UUID | YES | — | No FK (survives cascade delete) |
| user_id | UUID | NO | — | FK → profiles(id) |
| action | TEXT | NO | — | CHECK: 'created', 'deleted' |
| date_range | TEXT | YES | '' | Human-readable |
| reason | TEXT | YES | '' | |
| created_at | TIMESTAMPTZ | YES | NOW() | |

### Venues & Clients

#### venues
Independent venue records (not tied to clients). S23A restructure.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | gen_random_uuid() | |
| venue_name | TEXT | NO | — | |
| address | TEXT | YES | '' | |
| postcode | TEXT | YES | '' | |
| email | TEXT | YES | '' | S24A: for direct venue invoicing |
| phone | TEXT | YES | '' | S24A |
| contact_name | TEXT | YES | '' | S24A |
| rating_atmosphere | INT | YES | NULL | 1-5 |
| rating_crowd | INT | YES | NULL | 1-5 |
| rating_stage | INT | YES | NULL | 1-5 |
| rating_parking | INT | YES | NULL | 1-5 |
| notes | TEXT | YES | '' | |
| created_by | UUID | NO | — | FK → profiles(id) |
| created_at | TIMESTAMPTZ | YES | NOW() | |

#### venue_photos
Photos for venue detail pages. Storage bucket: `venue-photos`.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | gen_random_uuid() | |
| venue_id | UUID | NO | — | FK → venues(id) CASCADE |
| file_url | TEXT | NO | — | Public URL |
| storage_path | TEXT | NO | — | Bucket path |
| caption | TEXT | YES | '' | |
| created_by | UUID | NO | — | FK → profiles(id) |
| created_at | TIMESTAMPTZ | YES | NOW() | |

#### clients
Companies/people who pay for gigs. Independent from venues.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | gen_random_uuid() | |
| company_name | TEXT | NO | — | |
| contact_name | TEXT | YES | '' | |
| address | TEXT | YES | '' | |
| email | TEXT | YES | '' | |
| phone | TEXT | YES | '' | |
| created_by | UUID | NO | — | FK → profiles(id) |
| created_at | TIMESTAMPTZ | YES | NOW() | |

### Invoicing

#### invoices
Invoice records. Number format: `TGT-XXXX` (via RPC).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | gen_random_uuid() | |
| invoice_number | TEXT | NO | UNIQUE | TGT-XXXX |
| client_id | UUID | YES | NULL | FK → clients(id). S24A: nullable |
| venue_id | UUID | YES | NULL | FK → venues(id) SET NULL |
| gig_id | UUID | YES | NULL | FK → gigs(id) SET NULL. S24A |
| venue | TEXT | YES | '' | Free-text fallback |
| gig_date | DATE | NO | — | |
| amount | NUMERIC(10,2) | NO | — | GBP |
| description | TEXT | NO | — | |
| issue_date | DATE | NO | — | |
| due_date | DATE | NO | — | issue_date + payment_terms |
| status | TEXT | YES | 'draft' | CHECK: 'draft', 'sent', 'paid' |
| paid_date | DATE | YES | NULL | |
| style | TEXT | YES | 'classic' | 7 styles |
| created_by | UUID | NO | — | FK → profiles(id) |
| created_at | TIMESTAMPTZ | YES | NOW() | |
| updated_at | TIMESTAMPTZ | YES | NOW() | |

#### receipts
Band member payment receipts. Equal split, first member gets rounding remainder.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | gen_random_uuid() | |
| invoice_id | UUID | NO | — | FK → invoices(id) CASCADE |
| member_id | UUID | NO | — | FK → profiles(id) |
| amount | NUMERIC(10,2) | NO | — | |
| date | DATE | NO | — | |
| created_at | TIMESTAMPTZ | YES | NOW() | |

#### user_settings
Per-user settings (bank details, contact info). Keyed by user ID.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | — | FK → profiles(id) |
| your_name | TEXT | YES | '' | |
| email | TEXT | YES | '' | |
| phone | TEXT | YES | '' | |
| bank_account_name | TEXT | YES | '' | |
| bank_name | TEXT | YES | '' | |
| bank_sort_code | TEXT | YES | '' | |
| bank_account_number | TEXT | YES | '' | |
| updated_at | TIMESTAMPTZ | YES | NOW() | |

#### band_settings
Singleton — one row for the whole band.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | — | |
| trading_as | TEXT | YES | '' | |
| business_type | TEXT | YES | '' | |
| website | TEXT | YES | '' | |
| payment_terms_days | INT | YES | 14 | |
| next_invoice_number | INT | YES | 1 | Via RPC |
| pli_insurer | TEXT | YES | '' | |
| pli_policy_number | TEXT | YES | '' | |
| pli_cover_amount | TEXT | YES | '' | |
| pli_expiry_date | DATE | YES | NULL | |
| default_terms_and_conditions | TEXT | YES | '' | |
| default_quote_validity_days | INT | YES | 30 | |
| next_quote_number | INT | YES | 1 | Via RPC |
| updated_at | TIMESTAMPTZ | YES | NOW() | |

### Quoting & Formal Invoicing

#### service_catalogue
Reusable line items for quotes.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | gen_random_uuid() | |
| name | TEXT | NO | — | |
| description | TEXT | YES | '' | |
| default_price | NUMERIC(10,2) | YES | 0 | |
| unit_label | TEXT | YES | NULL | |
| sort_order | INT | YES | 0 | |
| is_active | BOOLEAN | YES | TRUE | |
| created_at | TIMESTAMPTZ | YES | NOW() | |

#### quotes
Quote records. Number format: `QTE-XXX` (via RPC).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | gen_random_uuid() | |
| quote_number | TEXT | NO | UNIQUE | QTE-XXX |
| client_id | UUID | YES | NULL | FK → clients(id). S24A: nullable |
| venue_id | UUID | YES | NULL | FK → venues(id) SET NULL |
| created_by | UUID | NO | — | FK → profiles(id) |
| event_type | TEXT | YES | 'other' | CHECK: wedding, corporate, private, festival, other |
| event_date | DATE | NO | — | |
| venue_name | TEXT | YES | '' | Free-text |
| venue_address | TEXT | YES | '' | |
| subtotal | NUMERIC(10,2) | YES | 0 | |
| discount_amount | NUMERIC(10,2) | YES | 0 | |
| total | NUMERIC(10,2) | YES | 0 | |
| pli_option | TEXT | YES | 'none' | certificate, details, none |
| terms_and_conditions | TEXT | YES | '' | |
| validity_days | INT | YES | 30 | |
| notes | TEXT | YES | '' | |
| status | TEXT | YES | 'draft' | draft, sent, accepted, declined, expired |
| style | TEXT | YES | 'classic' | 7 styles |
| sent_at | TIMESTAMPTZ | YES | NULL | |
| responded_at | TIMESTAMPTZ | YES | NULL | |
| created_at | TIMESTAMPTZ | YES | NOW() | |
| updated_at | TIMESTAMPTZ | YES | NOW() | |

#### quote_line_items

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | gen_random_uuid() | |
| quote_id | UUID | NO | — | FK → quotes(id) CASCADE |
| service_id | UUID | YES | NULL | FK → service_catalogue(id) |
| description | TEXT | NO | — | |
| quantity | NUMERIC(10,2) | YES | 1 | |
| unit_price | NUMERIC(10,2) | NO | — | |
| line_total | NUMERIC(10,2) | NO | — | |
| sort_order | INT | YES | 0 | |

#### formal_invoices
Generated when a quote is accepted.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | gen_random_uuid() | |
| invoice_number | TEXT | NO | UNIQUE | TGT-XXXX |
| quote_id | UUID | NO | — | FK → quotes(id) |
| client_id | UUID | YES | NULL | FK → clients(id). S24A: nullable |
| venue_id | UUID | YES | NULL | FK → venues(id) SET NULL |
| created_by | UUID | NO | — | FK → profiles(id) |
| venue_name | TEXT | YES | '' | |
| event_date | DATE | NO | — | |
| subtotal | NUMERIC(10,2) | YES | 0 | |
| discount_amount | NUMERIC(10,2) | YES | 0 | |
| total | NUMERIC(10,2) | YES | 0 | |
| issue_date | DATE | NO | — | |
| due_date | DATE | NO | — | |
| status | TEXT | YES | 'draft' | draft, sent, paid |
| paid_date | DATE | YES | NULL | |
| notes | TEXT | YES | '' | |
| style | TEXT | YES | 'classic' | |
| created_at | TIMESTAMPTZ | YES | NOW() | |
| updated_at | TIMESTAMPTZ | YES | NOW() | |

#### formal_invoice_line_items

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | gen_random_uuid() | |
| invoice_id | UUID | NO | — | FK → formal_invoices(id) CASCADE |
| description | TEXT | NO | — | |
| quantity | NUMERIC(10,2) | YES | 1 | |
| unit_price | NUMERIC(10,2) | NO | — | |
| line_total | NUMERIC(10,2) | NO | — | |
| sort_order | INT | YES | 0 | |

#### formal_receipts

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | gen_random_uuid() | |
| invoice_id | UUID | NO | — | FK → formal_invoices(id) CASCADE |
| member_id | UUID | NO | — | FK → profiles(id) |
| amount | NUMERIC(10,2) | NO | — | |
| date | DATE | NO | — | |
| created_at | TIMESTAMPTZ | YES | NOW() | |

### Songs & Setlists (S25A)

#### songs
Master song library with metronome data for live/practice modes.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | gen_random_uuid() | |
| name | TEXT | NO | — | |
| artist | TEXT | YES | '' | For covers |
| bpm | NUMERIC(6,2) | YES | 120 | CHECK: 20-400 |
| time_signature_top | INT | YES | 4 | CHECK: 1-16 |
| time_signature_bottom | INT | YES | 4 | CHECK: 2,4,8,16 |
| subdivision | INT | YES | 1 | 1=off, 2=8ths, 3=triplets, 4=16ths, 5=quint, 6=sext |
| swing_percent | NUMERIC(5,2) | YES | 50 | CHECK: 50-75 |
| accent_pattern | TEXT | YES | NULL | CSV e.g. "3,1,1,1" |
| click_sound | TEXT | YES | 'default' | default, high, low, wood, rim |
| count_in_bars | INT | YES | 1 | CHECK: 0-8 |
| duration_seconds | INT | YES | NULL | Song length |
| key | TEXT | YES | '' | Musical key |
| notes | TEXT | YES | '' | Arrangement notes |
| audio_url | TEXT | YES | NULL | Supabase Storage URL (practice MP3) |
| audio_storage_path | TEXT | YES | NULL | Storage bucket path |
| created_by | UUID | NO | — | FK → profiles(id) |
| created_at | TIMESTAMPTZ | YES | NOW() | |
| updated_at | TIMESTAMPTZ | YES | NOW() | Auto-updated by trigger |

**Indexes**: `idx_songs_name`, `idx_songs_created_by`.
**RLS**: SELECT/UPDATE/DELETE all authenticated; INSERT requires created_by = auth.uid().

#### setlists
Ordered collections of songs for gigs or practice.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | gen_random_uuid() | |
| name | TEXT | NO | — | |
| description | TEXT | YES | '' | |
| notes | TEXT | YES | '' | |
| created_by | UUID | NO | — | FK → profiles(id) |
| created_at | TIMESTAMPTZ | YES | NOW() | |
| updated_at | TIMESTAMPTZ | YES | NOW() | Auto-updated by trigger |

**RLS**: SELECT/UPDATE/DELETE all authenticated; INSERT requires created_by = auth.uid().

#### setlist_songs
Junction table with position ordering.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | gen_random_uuid() | |
| setlist_id | UUID | NO | — | FK → setlists(id) CASCADE |
| song_id | UUID | NO | — | FK → songs(id) CASCADE |
| position | INT | NO | 0 | UNIQUE(setlist_id, position) |
| notes | TEXT | YES | '' | Per-song notes in setlist context |

**Indexes**: `idx_setlist_songs_setlist`, `idx_setlist_songs_song`.
**RLS**: All authenticated for all operations.

### Public Website

#### public_media

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | gen_random_uuid() | |
| media_type | TEXT | NO | — | photo, video |
| url | TEXT | NO | — | |
| title | TEXT | YES | '' | |
| description | TEXT | YES | '' | |
| thumbnail_url | TEXT | YES | '' | |
| video_embed_url | TEXT | YES | '' | |
| date_taken | DATE | YES | NULL | |
| location | TEXT | YES | '' | |
| sort_order | INT | YES | 0 | |
| visible | BOOLEAN | YES | TRUE | |
| created_by | UUID | YES | — | FK → profiles(id) |
| created_at | TIMESTAMPTZ | YES | NOW() | |

**RLS**: Anon SELECT where visible = true; authenticated full CRUD.

#### contact_submissions

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | UUID PK | NO | gen_random_uuid() | |
| name | TEXT | NO | — | |
| email | TEXT | NO | — | |
| event_type | TEXT | YES | '' | |
| preferred_date | DATE | YES | NULL | |
| message | TEXT | YES | '' | |
| read | BOOLEAN | YES | FALSE | |
| archived | BOOLEAN | YES | FALSE | |
| notes | TEXT | YES | '' | |
| created_at | TIMESTAMPTZ | YES | NOW() | |

---

## Entity Relationships

```
auth.users
  └── profiles (1:1, auto-created via trigger)
        ├── gigs (1:many via created_by)
        │     └── gig_changelog (1:many via gig_id, CASCADE)
        ├── away_dates (1:many via user_id, CASCADE)
        │     └── away_date_changelog (no FK — survives deletion)
        ├── venues (1:many via created_by)
        │     └── venue_photos (1:many via venue_id, CASCADE)
        ├── clients (1:many via created_by)
        ├── invoices (1:many via created_by)
        │     └── receipts (1:many via invoice_id, CASCADE)
        ├── quotes (1:many via created_by)
        │     ├── quote_line_items (1:many via quote_id, CASCADE)
        │     └── formal_invoices (1:many via quote_id)
        │           ├── formal_invoice_line_items (1:many, CASCADE)
        │           └── formal_receipts (1:many, CASCADE)
        ├── songs (1:many via created_by)
        ├── setlists (1:many via created_by)
        └── public_media (1:many via created_by)

songs (standalone)
  └── setlist_songs (1:many via song_id, CASCADE)

setlists (standalone)
  └── setlist_songs (1:many via setlist_id, CASCADE)

venues (standalone)
  ├── gigs.venue_id (SET NULL)
  ├── invoices.venue_id (SET NULL)
  ├── quotes.venue_id (SET NULL)
  └── formal_invoices.venue_id (SET NULL)

gigs (standalone)
  └── invoices.gig_id (SET NULL) — S24A

clients (standalone)
  ├── gigs.client_id (SET NULL)
  ├── invoices.client_id (S24A: nullable, CHECK: client_id OR venue_id)
  ├── quotes.client_id (S24A: nullable, CHECK: client_id OR venue_id)
  └── formal_invoices.client_id (S24A: nullable, CHECK: client_id OR venue_id)
```

---

## TypeScript Types

All types in `shared/supabase/types.ts`. Key interfaces:

| Interface | Table | Notes |
|-----------|-------|-------|
| Profile | profiles | |
| Gig | gigs | venue_id/client_id nullable |
| GigWithCreator | gigs + profiles | JOIN |
| AwayDate / AwayDateWithUser | away_dates | |
| GigChangelogEntry / WithUser | gig_changelog | |
| Venue | venues | Ratings nullable (1-5) |
| VenuePhoto | venue_photos | |
| Client | clients | |
| Invoice / InvoiceWithClient | invoices + clients + venues | JOIN. S24A: venue contact fields |
| Receipt / ReceiptWithMember | receipts + profiles | |
| UserSettings | user_settings | Per-user singleton |
| BandSettings | band_settings | Band-wide singleton |
| ServiceCatalogueItem | service_catalogue | |
| Quote / QuoteWithClient | quotes + clients | |
| QuoteLineItem | quote_line_items | |
| FormalInvoice / WithClient | formal_invoices + clients | |
| FormalInvoiceLineItem | formal_invoice_line_items | |
| FormalReceipt / WithMember | formal_receipts + profiles | |
| PublicMedia | public_media | |
| ContactSubmission | contact_submissions | |
| SiteContent | site_content | Key-value CMS |
| SiteReview | site_reviews | Customer reviews |

| Song | songs | Metronome data + practice track URL |
| Setlist | setlists | |
| SetlistSong | setlist_songs | Junction |
| SetlistSongWithDetails | setlist_songs + songs | JOIN |
| SetlistWithSongs | setlists + songs | Aggregate |

Utility types: `GigType`, `GigVisibility`, `InvoiceStatus`, `InvoiceStyle`, `QuoteStatus`, `EventType`, `PLIOption`, `DayStatus`, `ChangeSummaryItem`, `BillTo` (S24A), `ClickSound` (S25A).

Utility functions: `isGigIncomplete(gig)`, `computeDayStatus(date, today, gigs, awayDates)`, `resolveBillTo(row)` (S24A).

---

## CRUD Operations (shared/supabase/queries.ts)

| Entity | Key Operations |
|--------|---------------|
| Profiles | getProfiles, getProfile, updateLastOpened |
| Gigs | getGigsForMonth, getGigsByDate, getUpcomingGigs, createGig, updateGig, deleteGig |
| Away Dates | getAwayDatesForMonth, getMyAwayDates, createAwayDate, updateAwayDate, deleteAwayDate |
| Changelogs | logGigChange, logAwayDateChange, getGigChangelog, getChangesSince |
| Venues | getVenues, getVenue, searchVenues, createVenue, updateVenue, deleteVenue |
| Venue Photos | getVenuePhotos, uploadVenuePhoto, deleteVenuePhoto |
| Clients | getClients, getClient, searchClients, createClient, updateClient, deleteClient |
| Invoices | getInvoices, getInvoice, getInvoiceByGigId, createInvoice, updateInvoiceStatus, deleteInvoice |
| Receipts | getReceiptsForInvoice, createReceipts |
| Settings | getSettings, updateSettings, getBandSettings, updateBandSettings |
| Service Catalogue | getServiceCatalogue, createServiceItem, updateServiceItem, deleteServiceItem |
| Quotes | getQuotes, getQuote, createQuote, updateQuote, deleteQuote, sendQuote, acceptQuote, declineQuote |
| Quote Line Items | getQuoteLineItems, setQuoteLineItems |
| Formal Invoices | getFormalInvoice, createFormalInvoice, updateFormalInvoiceStatus |
| Formal Receipts | getFormalReceipts, createFormalReceipts |
| Public Media | getPublicMedia, createPublicMedia, updatePublicMedia, deletePublicMedia |
| Contact | submitContact, getContactSubmissions, markContactRead, archiveContact |
| Site Content | getSiteContent, updateSiteContent |
| Reviews | getSiteReviews, createSiteReview, updateSiteReview, deleteSiteReview |
| Songs | getSongs, getSong, searchSongs, createSong, updateSong, deleteSong, uploadPracticeTrack, deletePracticeTrack |
| Setlists | getSetlists, getSetlist, createSetlist, updateSetlist, deleteSetlist |
| Setlist Songs | getSetlistSongs, getSetlistWithSongs, setSetlistSongs, addSongToSetlist, removeSongFromSetlist |
| Dashboard | getDashboardStats |

---

## Migration Files

| File | Purpose |
|------|---------|
| native/docs/supabase/migration.sql | Initial schema (profiles, gigs, away_dates, changelogs) |
| native/supabase/migrations/20260303120000_add_gig_type.sql | gig_type column |
| supabase/migrations/20260304105634_phase4_change_summary.sql | Changelogs + last_opened_at |
| supabase/migrations/20260305200000_s23a_venue_client_restructure.sql | S23A: venues decoupled, ratings, venue_id FKs, venue_photos |
| supabase/migrations/20260306100000_s24a_bill_to_flexibility.sql | S24A: venue contacts, nullable client_id, gig_id FK, CHECK constraints |
| supabase/migrations/20260306200000_s25a_songs_setlists.sql | S25A: songs, setlists, setlist_songs tables + practice-tracks bucket |
| shared/supabase/types.ts | All TypeScript interfaces |
