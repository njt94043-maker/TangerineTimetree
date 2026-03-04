# The Green Tangerine - Complete Site Reference

> Extracted from base44 export `green-tangerine-hub-e58b6a1a.zip` (Oct 2025)

---

## BRAND IDENTITY

- **Band Name:** The Green Tangerine
- **Tagline:** "Keep It Green"
- **Slogan:** "We don't just play - we display!"
- **Type:** South Wales Function Band (4-piece)
- **Genre:** Classic Rock, Rock, Indie
- **Location:** Rhondda Cynon Taf, South Wales, GB
- **Areas Served:** Cardiff, Swansea, Bridgend, Neath, Pontypridd, Merthyr Tydfil, Port Talbot, Rhondda
- **Email:** thegreentangerine01@gmail.com
- **Facebook:** https://www.facebook.com/profile.php?id=61559549376238
- **TikTok:** https://www.tiktok.com/@thegreentangerine01
- **OG Image:** https://scontent-lhr6-2.xx.fbcdn.net/v/t39.30808-6/567666137_122196871748318312_2444974931149722809_n.jpg
- **Schema.org:** Dual type `["MusicGroup", "LocalBusiness"]`

### Band Description
"The Green Tangerine is a tribute to classic rock, bringing you revamped high energy rock classics guaranteed to get the hips swinging. From Led Zeppelin to The Rolling Stones, from Pink Floyd to The Red Hot Chilli Peppers, we cover all the legends with authenticity and passion."

"Based in the Rhondda, performing at venues across South Wales including Cardiff, Swansea, Bridgend, Neath, Pontypridd, and beyond. Whether it's a pub gig, wedding, corporate event, or festival, we deliver unforgettable performances."

---

## COLOR PALETTE & DESIGN SYSTEM

### Brand Colors (Tailwind)
| Color | Hex | Usage |
|-------|-----|-------|
| Green-500 | `#10b981` | Primary brand, headers, active states, success |
| Orange-500 | `#f97316` | Secondary brand, CTAs, dashboard, booking |
| Blue-500 | -- | Invoices, trust indicators |
| Purple-500 | -- | Expenses, venues |
| Yellow-500 | -- | Testimonial stars, warnings |
| Pink-500 | -- | TikTok, wedding |

### CSS Custom Properties
```css
--color-green: #10b981
--color-tangerine: #f97316
--color-dark: #111827
```

### Design Patterns
- **Glass-morphism cards:** `bg-white/5 backdrop-blur-sm border-{color}/20`
- **Gradient buttons:** `bg-gradient-to-r from-{color}-500 to-{color}-600`
- **Page backgrounds:** `bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900`
- **Form inputs:** `bg-white/5 border-white/10 text-white`
- **Text hierarchy:** white (headings), gray-300 (body), gray-400 (secondary), gray-500 (muted)
- **Header/Footer:** `bg-black/30 backdrop-blur-md border-green-500/20`
- **Touch targets:** `min-h-[44px] min-w-[44px]`

### UI Component Library
- shadcn/ui (Card, Input, Label, Textarea, Button, Select, Dialog, etc.)
- Radix UI primitives
- lucide-react icons
- framer-motion animations
- recharts for charts
- sonner for toasts
- react-day-picker for calendars

---

## SITE STRUCTURE (26 routes)

### Public Pages (no auth required)
| Route | Page | Purpose |
|-------|------|---------|
| `/` or `/Home` | Home | Landing page with hero, upcoming gigs, about, CTAs |
| `/Photos` | Photos | Public photo gallery with lightbox |
| `/Videos` | Videos | Public video gallery with YouTube embeds |
| `/ForVenues` | ForVenues | Venue booking pitch page |
| `/Pricing` | Pricing | Pricing tiers and packages |
| `/Contact` | Contact | Contact form + info |
| `/MerchShop` | MerchShop | Shopify redirect for merch |

### Hub Pages (auth required)
| Route | Page | Purpose |
|-------|------|---------|
| `/Dashboard` | Dashboard | Central management hub |
| `/Bookings` | Bookings | CRUD bookings + calendar + invoices |
| `/Availability` | Availability | Member unavailability tracking |
| `/SetList` | SetList | Song repertoire management |
| `/SongMixer` | SongMixer | Multi-track audio mixer |
| `/Expenses` | Expenses | Personal expense + mileage tracking |
| `/BandFinances` | BandFinances | Band-level income/expenses by tax year |
| `/BandInvoices` | BandInvoices | Invoice PDFs for tax filing (manager only) |
| `/BandManagement` | BandManagement | Member profiles + data tools |
| `/ManagePhotos` | ManagePhotos | Upload/manage gallery photos |
| `/ManageVideos` | ManageVideos | Upload/manage gallery videos |
| `/ManageMerch` | ManageMerch | Product management + InkThreadable sync |
| `/ManageUsers` | ManageUsers | User account management |
| `/Analytics` | Analytics | Charts and performance metrics |
| `/CustomizeApp` | CustomizeApp | Background image + logo settings |
| `/Profile` | Profile | Personal profile + address |
| `/ActivityLog` | ActivityLog | Audit trail of all changes |
| `/Files` | Files | Centralized file storage browser |

### Navigation Structure
**Public nav (always visible):** Home, For Venues, Photos, Videos
**Auth nav:** Band Dashboard (orange gradient button), Manage Users (admin only), My Profile

---

## DATA MODEL (14 Entities)

### Booking
| Field | Type | Notes |
|-------|------|-------|
| venue_name | string | Required, autocomplete from history |
| client_name | string | Defaults to venue_name |
| client_email | string | |
| client_phone | string | |
| event_date | date | Required |
| event_time | time | Smart defaults: Sun=17:00, Fri/Sat=21:00, weekday=20:30 |
| venue_address | string | Used for mileage calculation |
| event_type | enum | wedding, corporate, pub_gig, festival, private_party, other |
| fee | number | GBP, default £300 |
| deposit_paid | number | Default 0 |
| balance_due | number | Computed: fee - deposit_paid |
| payment_method | enum | invoice, cash |
| payment_status | enum | unpaid, payment_pending, deposit_paid, paid_in_full (auto-calculated) |
| status | enum | pending, confirmed, completed, cancelled |
| notes | text | |
| invoice_generated | boolean | Set by InvoiceGenerator |

### Invoice
| Field | Type | Notes |
|-------|------|-------|
| invoice_number | string | Auto: `INV-{timestamp}-{random}` |
| booking_id | reference | Links to Booking |
| client_name | string | |
| client_email | string | |
| issue_date | date | |
| due_date | date | Default: issue + 30 days |
| amount | number | Smart calculation based on deposit/balance |
| tax_year | string | UK format: `YYYY/YYYY+1` |
| items | array | Line items with descriptions |
| pdf_url | string | Generated by backend function |
| paid | boolean | |

### Song
| Field | Type | Notes |
|-------|------|-------|
| title | string | |
| artist | string | |
| category | enum | main, popular_mainstream, classic_rock_muso |
| order | number | Display order |
| key | string | Musical key |
| tempo | string | BPM |
| duration | string | |
| notes | text | Performance notes |
| vocal_track_url | string | Audio stem URL |
| guitar_track_url | string | Audio stem URL |
| bass_track_url | string | Audio stem URL |
| drums_track_url | string | Audio stem URL |
| keys_track_url | string | Audio stem URL |

### Photo
| Field | Type | Notes |
|-------|------|-------|
| image_url | string | |
| title | string | |
| date_taken | date | |
| location | string | |
| visible_to_public | boolean | Default true |

### Video
| Field | Type | Notes |
|-------|------|-------|
| video_url | string | YouTube/direct URL |
| title | string | |
| description | text | |
| thumbnail_url | string | |
| date_performed | date | |
| venue | string | |
| visible_to_public | boolean | Default true |

### Gig
| Field | Type | Notes |
|-------|------|-------|
| title | string | |
| venue | string | |
| date | date | |
| time | string | |
| address | string | |
| visible_to_public | boolean | |

### Expense
| Field | Type | Notes |
|-------|------|-------|
| expense_date | date | |
| category | enum | equipment, instruments, maintenance, fuel, accommodation, food, transport, rehearsal_space, recording, marketing, session_payment, other |
| description | string | |
| amount | number | GBP |
| receipt_url | string | File upload |
| notes | text | |
| expense_type | enum | personal, band |
| member_email | string | Auto-set from current user |
| member_name | string | Auto-set from current user |
| tax_year | string | UK format: `YYYY-YYYY+1` |
| invoice_id | reference | Optional link to receipt invoice |

### IncomeRecord
| Field | Type | Notes |
|-------|------|-------|
| income_date | date | |
| amount | number | |
| record_type | enum | band_total |
| member_email | string | "band" for band-level records |
| venue_name | string | |
| client_name | string | |
| invoice | reference | Link to Invoice |

### SessionPayment
| Field | Type | Notes |
|-------|------|-------|
| amount | number | Invoice total / member count |
| paid | boolean | |
| member_email | string | |
| tax_year | string | |

### MileageRecord
| Field | Type | Notes |
|-------|------|-------|
| event_date | date | |
| member_email | string | |
| total_claim | number | |

### Unavailability
| Field | Type | Notes |
|-------|------|-------|
| start_date | date | |
| member_name | string | |
| created_by | string | |

### Merchandise
| Field | Type | Notes |
|-------|------|-------|
| name | string | |
| description | text | |
| price | number | GBP |
| sizes | string | Comma-separated |
| image_url | string | |
| purchase_url | string | InkThreadable URL |
| order | number | Display order |
| featured | boolean | |
| available | boolean | Default true |

### AppSettings
| Field | Type | Notes |
|-------|------|-------|
| setting_key | string | 'main' or 'merch_shop' |
| background_image_url | string | Hero background (main) |
| logo_url | string | Header/invoice logo (main) |
| shop_url | string | Shopify URL (merch_shop) |

### FileStorage
| Field | Type | Notes |
|-------|------|-------|
| file_name | string | |
| description | string | |
| file_size | number | |
| file_url | string | |
| category | enum | invoices, receipts, photos, videos, audio, documents, other |
| subcategory | string | Context-dependent |
| uploaded_by_name | string | |
| uploaded_by_email | string | |
| visible_to_all | boolean | |
| tags | array | |
| created_date | date | |

### User (via auth)
| Field | Type | Notes |
|-------|------|-------|
| email | string | Read-only |
| full_name | string | |
| display_name | string | |
| band_role | string | e.g., "Lead Guitar and Backing Vocals" |
| role | enum | admin, member |
| is_band_manager | boolean | Controls access to finance/invoice pages |
| profile_picture_url | string | |
| address | object | { line1, line2, city, postcode } |

---

## INTEGRATIONS & API

### Base44 SDK
- Client: `@base44/sdk` with appId `68fb000e9fd41751e58b6a1a`
- Auth: `base44.auth` (login, me, updateMe)
- Entities: Full CRUD via `base44.entities.{Entity}`
- Integrations: `base44.integrations.Core` (InvokeLLM, SendEmail, UploadFile, GenerateImage, ExtractDataFromUploadedFile, CreateFileSignedUrl, UploadPrivateFile)
- Functions: `generateInvoicePdf`, `generateSessionInvoicePdf`

### InkThreadable
- API integration for merch sync
- Settings managed via InkThreadableSettings component
- AutoSyncManager for automatic product syncing

### External Services
- Shopify (merch shop redirect)
- YouTube (video embeds)
- Facebook & TikTok (social links)

---

## PAGE CONTENT DETAILS

### HOME PAGE
**SEO:** "The Green Tangerine | South Wales Function Band from the Rhondda"

**Hero Section:**
- H1: "The Green Tangerine" (green, Impact font, text-shadow)
- Subtitle: "South Wales Function Band" (white, Impact font)
- Tagline: "Live rock covers for pubs, weddings & events across Cardiff, Swansea, Bridgend, Neath & the Rhondda"
- "Keep It Green" badge
- CTAs: "View Photos", "Watch Videos"
- Social: Facebook, TikTok buttons
- Install PWA prompt (conditional)

**Dynamic Section:** Upcoming Gigs (from Gig entity, public + future, max 5)

**About Section:** Band description paragraphs + "100% Recommended - Based on 8 reviews"

**CTA Sections:** Pricing, Merch Shop, Contact (each with gradient card)

### FOR VENUES PAGE
**SEO:** "For Venues | The Green Tangerine - Book South Wales Function Band"

**Hero:** "Book The Green Tangerine for Your Venue" + "Reliable . Professional . Crowd-Pleasing"

**6 Benefit Cards:**
1. Fully Self-Contained - Professional P.A. and lighting included
2. Quick Setup & Soundcheck
3. Flexible Set Options - 2x45min or 1x90min
4. Volume Control
5. Fully Insured & Professional - Public liability + PAT tested
6. Proven Track Record - 100% recommended

**What We Bring:**
- Equipment: Full PA, lighting, cables, 45-min setup, efficient packdown
- Performance: 2x45min sets (or 1x90min), curated setlist, volume adaptable, background music
- Peace of Mind: Insurance, PAT tested, contracts, communication

**Where We Play:** Cardiff, Bridgend, Swansea, Rhondda

**Testimonials:**
1. "The Green Tangerine brought amazing energy to our venue..." - Cardiff Venue (5 stars)
2. "Professional setup, great communication, and an incredible live show..." - Bridgend Function Room (5 stars)

### PRICING PAGE
**SEO:** "Pricing | The Green Tangerine - South Wales Function Band Rates"

| Package | Price | Duration | Features |
|---------|-------|----------|----------|
| Pub Gig | £400-£600 | 2x45min + 15min encore | Full 4-piece, PA, lighting, flexible setlist |
| Private Party (Most Popular) | £600-£800 | 2x45min + 15min encore | + Custom setlist, MC/announcements |
| Wedding | £800-£1200 | 2x45min + 15min encore | + First dance, tailored setlist, venue coordination |
| Corporate | £1000-£1500 | 2x45min + 15min encore | + Corporate setlist, professional attire, background music |
| Festival | £1000+ | 45-90min | Festival-ready, high-energy, crowd engagement |

**Additional Services:**
- Travel within 50 miles included
- Additional travel: £0.50/mile
- Extra sets: £100-£200/hour
- Custom song requests (advance notice)
- PA hire for speeches: £150

### CONTACT PAGE
**SEO:** "Contact Us | Book The Green Tangerine - South Wales Function Band"

**Contact Info:**
- Email: thegreentangerine01@gmail.com
- Phone: Available on request
- Based In: Rhondda, South Wales (Covering all South Wales)

**Form Fields:**
1. Your Name * (placeholder: "John Smith")
2. Email Address * (placeholder: "john@example.com")
3. Phone Number (placeholder: "07123 456789")
4. Venue / Location (placeholder: "e.g., Cardiff, Swansea, Bridgend...")
5. Event Type (placeholder: "Wedding, Party, Pub Gig...")
6. Event Date (date picker)
7. Your Message * (textarea)

**Submit sends email to:** thegreentangerine01@gmail.com
**Success message:** "Thanks for Getting in Touch! We've received your enquiry and will respond within 24 hours."

### PHOTOS PAGE
- Title: "Photo Gallery" / "Moments captured from our journey"
- Grid: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`
- Lightbox on click with title, date, location
- Data: Photo entity, filtered to public, sorted by date

### VIDEOS PAGE
- Title: "Video Gallery" / "Watch our live performances"
- Grid: `md:grid-cols-2 lg:grid-cols-3`
- YouTube embed support + direct video + thumbnail fallback
- Data: Video entity, filtered to public, sorted by date

### MERCH SHOP PAGE
- Title: "Band Merchandise" / "Show your support with exclusive Green Tangerine gear"
- Redirects to Shopify store URL from AppSettings
- Features: Official Merch, Fast Shipping, Quality Products
- "Secure checkout powered by Shopify"

---

## BUSINESS LOGIC

### Payment Status Auto-Calculation
```
balance_due = fee - deposit_paid
if balance_due <= 0 && fee > 0 -> 'paid_in_full'
if deposit_paid > 0 && balance_due > 0 -> 'deposit_paid'
if deposit_paid === 0 -> 'unpaid'
```

### Invoice Generation Flow
1. Create/update Invoice entity
2. Call `generateInvoicePdf` backend function
3. Update invoice with PDF URL
4. Create FileStorage record (category: invoices)
5. Update Booking (invoice_generated: true)
6. Calculate UK tax year (April 6 boundary)
7. Create IncomeRecord (type: band_total)
8. Create SessionPayment per band member (amount = total / member count)

### UK Tax Year Logic
```
if current date >= April 6 of current year:
  tax year = "YYYY-YYYY+1"
else:
  tax year = "YYYY-1-YYYY"
```

### Dashboard Metrics
- **Upcoming Gigs:** Count of future-dated bookings
- **Total Revenue:** Sum of band income record amounts
- **Total Expenses:** Sum of band expense amounts
- **Band Net:** Revenue - Expenses - Outstanding Session Payments
- **Pending:** Sum of (fee - deposit) for past-date unpaid invoice bookings
- **Media:** Photo + video count

### Smart Booking Defaults
- Venue learning from localStorage (last 20)
- Client auto-fill from previous bookings
- Fee defaults to average of venue's past fees
- Time defaults: Sunday=17:00, Fri/Sat=21:00, weekday=20:30
- Venue name heuristics: hotel/hall/manor -> wedding type

### File Categories & Subcategories
| Category | Subcategories |
|----------|---------------|
| invoices | Client Invoices, Session Musician Invoices, Other |
| receipts | Expense Receipts, Purchase Receipts, Other |
| photos | Live Performance, Promotional, Backstage, Other |
| videos | Live Performance, Promotional, Rehearsal, Other |
| audio | Song Stems, Backing Tracks, Recordings, Other |
| documents | Contracts, Agreements, Setlists, Other |
| other | Miscellaneous |

---

## TECH STACK (base44 version)

### Frontend
- React 18 + Vite 6
- React Router DOM 7
- Tailwind CSS 3 + tailwindcss-animate
- shadcn/ui components (Radix primitives)
- framer-motion for animations
- recharts for charts
- lucide-react for icons
- date-fns for date formatting
- react-hook-form + zod for forms
- sonner for toasts
- embla-carousel-react

### Backend (base44 managed)
- @base44/sdk for all CRUD, auth, file upload, email, LLM
- Server-side functions: generateInvoicePdf, generateSessionInvoicePdf
- Auth: base44 auth system with roles (admin, member) and band_manager flag

### Features
- PWA install prompt
- Offline support (optimistic updates with queue)
- Schema.org structured data
- SEO meta tags per page
- Responsive (mobile-first with md: breakpoint)
- Dark theme throughout
