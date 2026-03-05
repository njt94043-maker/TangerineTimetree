# Feature Spec: Package Builder & Quoting System

> **Status:** Planning (Phase 3 of v2 roadmap — see `/ROADMAP_V2.md`)
> **Location:** Both apps (Supabase backend, native + web frontends)
> **Last updated:** 2026-03-04

---

## Overview

A formal quoting and itemised invoicing flow for weddings, functions, corporate events, and any gig where the client expects a professional, detailed quote rather than a simple invoice.

This sits **alongside** the existing simple invoicing system (which remains untouched and perfect for pub gigs). It's a parallel path with more stages.

---

## Two Invoicing Paths

| | Path 1: Simple (existing) | Path 2: Formal (new) |
|---|---|---|
| **Use case** | Pub gigs, regular bookings | Weddings, functions, corporate |
| **Quote** | None | Itemised, branded PDF |
| **Invoice** | Single line, single amount | Itemised, line items from quote |
| **Receipts** | Band member split | Band member split (same logic) |
| **PLI** | Not needed | Optional - certificate or key details |
| **T&Cs** | Not needed | Included on quote |

---

## Flow

### Wizard (creates the quote)

**Step 1 - Client & Event**
- Client name / company
- Contact name
- Email
- Phone
- Event type (wedding, corporate, private function, festival, other)
- Event date
- Venue name
- Venue address
- Option to select existing client from client list, or create new

**Step 2 - Build Package**
- Select services from the service catalogue (predefined list)
- Each service shows default price, can be adjusted per quote
- Add custom line items (freeform description + price)
- Quantity support (e.g., 2x extra sets)
- Running total displayed as items are added/removed
- Optional discount line (fixed amount or percentage)
- Notes field for special requirements

**Step 3 - Extras**
- PLI inclusion toggle:
  - **Include certificate** - attaches the uploaded PLI certificate PDF to the quote
  - **Include key details only** - shows policy number, insurer, cover amount, expiry date on the quote document
  - **Don't include** - no PLI info on this quote
- Terms & conditions (pulled from settings, editable per quote)
- Quote validity period (default from settings, e.g., 14 or 30 days)
- Additional notes to client

**Step 4 - Preview**
- Choose template style (same themed approach as existing invoices)
- Full PDF preview of the quote
- Review all details
- Create / save as draft

### Transaction Detail Screen (manages the lifecycle)

After the wizard, the quote lands on a detail screen (same pattern as existing invoice detail). This is the single place to manage the entire transaction over time.

**Stages (buttons unlock progressively):**

1. **Draft** - quote created, can still edit
2. **Quote Sent** - share PDF via standard share sheet
3. **Accepted** - mark as accepted by client → generates the itemised invoice automatically (pre-filled from quote, editable before sending)
4. **Invoice Sent** - share invoice PDF
5. **Paid** - mark as paid → generates band member receipts (same split logic as existing)
6. **Complete** - all documents generated, job done

**Also available:**
- Declined - mark quote as declined (archived, no further action)
- Expired - auto-flag if validity period passes (or manual)
- View/share any document at any stage (quote PDF, invoice PDF, receipt PDFs)
- Edit quote (only while in draft)

**At a glance the screen shows:**
- Client & event summary
- Total amount
- Current stage
- All linked documents (quote, invoice, receipts)
- Timeline/history of stage changes

---

## Settings Additions

### PLI (Public Liability Insurance)

New section in GigBooks settings:

- **Insurer name** (e.g., "Insure4Music")
- **Policy number**
- **Cover amount** (e.g., "£10,000,000")
- **Expiry date**
- **Certificate PDF** - upload/replace the actual certificate file (stored locally on device)
- Visual indicator when certificate is expired or expiring soon

### Service Catalogue

Managed in settings. The list of standard services offered with default prices:

| Service | Default Price | Notes |
|---|---|---|
| Live band - 2 sets | £X | Core offering |
| Live band - 3 sets | £X | Extended |
| DJ set | £X | Between/after live sets |
| Acoustic ceremony set | £X | e.g., during ceremony/drinks reception |
| First dance song | £X | Learning a specific song |
| PA/sound system hire | £X | If not included in band fee |
| Lighting package | £X | |
| Extended playing time | £X per hour | Per-hour rate |
| Travel supplement | £X | Beyond a certain distance |

- Add/edit/remove services
- Reorder services
- Each service: name, description (optional), default price, per-unit label (optional, e.g., "per hour")
- These are defaults - prices are always adjustable per quote

### Terms & Conditions

- Default T&Cs text (used on all quotes unless overridden)
- Editable in settings
- Can be tweaked per individual quote in the wizard

### Quote Defaults

- Default validity period (e.g., 30 days)
- Default payment terms for formal invoices (may differ from simple invoice terms)

---

## Data Model (Supabase — shared cloud DB)

> **Architecture decision:** All quoting/invoicing data lives in Supabase so both
> native and web apps can access it. No SQLite. No cloud file storage — PDFs are
> generated on-demand on each device from the data + shared HTML templates.

### New Supabase Tables

**`service_catalogue`**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | gen_random_uuid() |
| name | TEXT NOT NULL | e.g., "Live band - 2 sets" |
| description | TEXT | Optional detail |
| default_price | NUMERIC(10,2) NOT NULL | Default GBP price |
| unit_label | TEXT | e.g., "per hour", null for flat rate |
| sort_order | INTEGER | Display order |
| is_active | BOOLEAN | default true |
| created_at | TIMESTAMPTZ | |

**`quotes`**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | gen_random_uuid() |
| quote_number | TEXT UNIQUE | Format: QTE-001 |
| client_id | UUID | FK → clients.id |
| created_by | UUID | FK → profiles.id (who created the quote) |
| event_type | TEXT | wedding / corporate / private / festival / other |
| event_date | DATE | |
| venue_name | TEXT NOT NULL | |
| venue_address | TEXT | |
| subtotal | NUMERIC(10,2) NOT NULL | Sum of line items |
| discount_amount | NUMERIC(10,2) | Discount applied |
| total | NUMERIC(10,2) NOT NULL | Final total after discount |
| pli_option | TEXT | 'certificate' / 'details' / 'none' |
| terms_and_conditions | TEXT | T&Cs text for this quote |
| validity_days | INTEGER | How long quote is valid |
| notes | TEXT | Additional notes to client |
| status | TEXT | 'draft' / 'sent' / 'accepted' / 'declined' / 'expired' |
| style | TEXT | Template style name |
| created_at | TIMESTAMPTZ | |
| sent_at | TIMESTAMPTZ | When quote was sent |
| responded_at | TIMESTAMPTZ | When accepted/declined |
| updated_at | TIMESTAMPTZ | Auto-updated via trigger |

**`quote_line_items`**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | gen_random_uuid() |
| quote_id | UUID | FK → quotes.id, CASCADE |
| service_id | UUID | FK → service_catalogue.id, nullable (null = custom item) |
| description | TEXT NOT NULL | Service name / custom description |
| quantity | INTEGER | Default 1 |
| unit_price | NUMERIC(10,2) NOT NULL | Price per unit |
| line_total | NUMERIC(10,2) NOT NULL | quantity * unit_price |
| sort_order | INTEGER | Display order on quote |

**`formal_invoices`**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | gen_random_uuid() |
| invoice_number | TEXT UNIQUE | Shared sequence with simple invoices (INV-XXX) |
| quote_id | UUID | FK → quotes.id |
| client_id | UUID | FK → clients.id |
| created_by | UUID | FK → profiles.id |
| venue_name | TEXT NOT NULL | |
| event_date | DATE | |
| subtotal | NUMERIC(10,2) NOT NULL | |
| discount_amount | NUMERIC(10,2) | |
| total | NUMERIC(10,2) NOT NULL | |
| issue_date | DATE | |
| due_date | DATE | issue_date + payment_terms |
| status | TEXT | 'draft' / 'sent' / 'paid' |
| paid_date | DATE | |
| notes | TEXT | |
| style | TEXT | Template style |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**`formal_invoice_line_items`**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | gen_random_uuid() |
| invoice_id | UUID | FK → formal_invoices.id, CASCADE |
| description | TEXT NOT NULL | Copied from quote line items |
| quantity | INTEGER | |
| unit_price | NUMERIC(10,2) NOT NULL | |
| line_total | NUMERIC(10,2) NOT NULL | |
| sort_order | INTEGER | |

**`formal_receipts`**
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | gen_random_uuid() |
| invoice_id | UUID | FK → formal_invoices.id |
| member_id | UUID | FK → profiles.id |
| amount | NUMERIC(10,2) | invoice.total / member_count |
| date | DATE | |
| created_at | TIMESTAMPTZ | |

### Settings (Supabase)

**Shared band settings** — new `band_settings` table (single row):

| Column | Type | Default |
|---|---|---|
| id | UUID PK | |
| trading_as | TEXT | 'The Green Tangerine' |
| business_type | TEXT | 'Live Music Entertainment' |
| website | TEXT | '' |
| pli_insurer | TEXT | '' |
| pli_policy_number | TEXT | '' |
| pli_cover_amount | TEXT | '' |
| pli_expiry_date | DATE | |
| default_terms_and_conditions | TEXT | '' |
| default_quote_validity_days | INTEGER | 30 |
| next_invoice_number | INTEGER | 1 |
| next_quote_number | INTEGER | 1 |

**Personal user settings** — new `user_settings` table (one row per member):

| Column | Type | Default |
|---|---|---|
| id | UUID PK | |
| user_id | UUID | FK → profiles.id, UNIQUE |
| email | TEXT | '' |
| phone | TEXT | '' |
| bank_account_name | TEXT | '' |
| bank_name | TEXT | '' |
| bank_sort_code | TEXT | '' |
| bank_account_number | TEXT | '' |
| payment_terms_days | INTEGER | 14 |

**PLI certificate** — stored locally on each device that needs it (not in Supabase).
Key details (insurer, policy number, cover, expiry) stored in `band_settings` so they
can be rendered on quote PDFs from any device. The actual certificate PDF file is
uploaded/stored on Nathan's device for attaching to quotes when needed.

---

## PDF Templates

> **Strategy:** No PDFs stored in the cloud. HTML/CSS templates live in `shared/templates/`.
> Each device generates PDFs on-demand from Supabase data + templates.
> Users can preview, download, or share — and bulk-export by tax year.

### Quote PDF
- Branded header (trading name, logo, contact details)
- Quote number and date
- Client and event details
- Itemised services table (description, qty, unit price, line total)
- Subtotal, discount (if any), total
- PLI section (if selected):
  - **Certificate mode**: key details on PDF + certificate attached as second page (native only — certificate file is local)
  - **Details only mode**: policy number, insurer, cover amount, expiry shown on PDF (works on both platforms)
- Terms & conditions
- Quote validity statement ("This quote is valid for 30 days from date of issue")
- Uses same themed template system as existing invoices

### Formal Invoice PDF
- Same branded header
- Invoice number and dates (issue, due)
- Client details
- Itemised table (same line items as quote)
- Subtotal, discount, total
- Payment details (bank info from creator's personal settings)
- Payment terms

### Formal Receipts PDF
- Same as existing receipts but linked to formal invoice
- Same band member split logic

### Rendering

| Platform | Preview | Generate/Share |
|---|---|---|
| Native (Android) | WebView rendering HTML template | Expo share sheet |
| Web (browser/iOS) | iframe or DOM rendering | Browser download / Web Share API |

### Bulk Export

- Select tax year (e.g., 2025/26)
- App queries all receipts/invoices for that period
- Generates PDFs on-device, one at a time or as a batch
- Save to device or share

---

## Navigation / UI Placement

### Dashboard
- Existing dashboard shows simple invoice stats
- Add a section or tab for formal quotes/transactions
- Active quotes count, pending invoices, recent activity

### Entry Point
- New option when creating: "Simple Invoice" vs "Formal Quote"
- Or a separate tab/section for "Quotes & Packages"

### Transaction List
- List of all formal transactions
- Filterable by status (active, completed, declined)
- Shows: client, event, date, total, current stage
- Tap → transaction detail screen

---

## Calendar Integration

- When a quote is **accepted**, prompt to add as a gig on the shared Supabase calendar
- Pre-fills: date, venue, client name, fee (total from quote)
- Standard gig entry - the band sees it like any other booking
- The formal quote/invoice system is Nathan's business tool; the calendar is the band's shared view

---

## Out of Scope (for now)

- Client portal / online acceptance
- Email sending from within the app (uses device share sheet / browser share API)
- Deposit / staged payment tracking
- Multiple currency support
- Tax / VAT calculations (sole trader below VAT threshold)

---

## Implementation Notes

- **Supabase-first**: all data in Supabase, no SQLite for new features
- **Cross-platform**: build on native first, then replicate on web
- PDF generation via shared HTML templates in `shared/templates/`
- Reuses existing: profiles table (band members), receipt split logic, template styling system
- Shared invoice number sequence across simple and formal invoices
- Queries and types in `shared/supabase/` — reused by both frontends
- See `/ROADMAP_V2.md` for the full migration and phasing plan
