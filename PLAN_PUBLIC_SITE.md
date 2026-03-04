# Plan: thegreentangerine.com — Public Website + App Enhancements

> Status: DRAFT FOR AUDIT
> Date: 2026-03-04
> Scope: Public website, profile page, gig visibility toggle, domain setup

---

## 1. Overview

### What We're Building
A public-facing website for The Green Tangerine band, built into the existing `web/` app in the TGT monorepo. Visitors see the band's website; logged-in members access the calendar/management tools.

### What We're NOT Building
- Merch shop (not used)
- Song mixer / set list viewer on website
- Admin hub / band management portal (base44 overengineered this)
- Analytics / activity log / file browser
- Expense / finance tracking on web
- AI/LLM/voice features
- Separate CMS or admin panel

### Architecture Decision
**Single app, two experiences.** The `web/` Vite app serves both:
- **Unauthenticated visitors** → see the public website (thegreentangerine.com)
- **Authenticated band members** → see the calendar/management tools (existing)

This avoids maintaining two separate deployments and shares the Supabase connection, types, and queries.

---

## 2. Current State

### What Exists (web/)
- React + Vite + TypeScript PWA
- State-based routing: `View = 'calendar' | 'list' | 'day-detail' | 'gig-form' | 'away'`
- Auth via Supabase (email/password)
- Dark neon theme (gunmetal cards, neon green/orange accents)
- Deployed on Vercel at tangerine-timetree.vercel.app
- No public pages — unauthenticated users see only a login screen

### What Exists (Supabase)
- `profiles` table: id, name, avatar_url, is_admin, created_at, last_opened_at
- `gigs` table: id, date, gig_type, venue, client_name, fee, payment_type, times, notes, created_by
- `away_dates` table: id, user_id, start/end dates, reason
- `gig_changelog` + `away_date_changelog`: audit trails
- RLS: Authenticated users can CRUD all gigs/away dates

### What Exists (Content — from base44 export)
All page copy, SEO tags, pricing, testimonials, and band descriptions have been extracted to `base44-export/SITE_REFERENCE.md`. This is our content source.

---

## 3. Supabase Schema Changes

### 3.1 New Migration

**File:** `supabase/migrations/YYYYMMDDHHMMSS_public_site_schema.sql`

#### Add `is_public` to gigs
```sql
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
```
- Purpose: Controls whether a gig appears on the public website
- Default: false (private — only visible to logged-in members)
- Only meaningful for `gig_type = 'gig'` (practices are never public)

#### Add `band_role` to profiles
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS band_role TEXT DEFAULT '';
```
- Purpose: Instrument/role display (e.g., "Lead Guitar & Backing Vocals")
- Used on profile page and potentially on the public "About" section

#### New `public_media` table
```sql
CREATE TABLE IF NOT EXISTS public_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video')),
  url TEXT NOT NULL,
  title TEXT DEFAULT '',
  description TEXT DEFAULT '',
  thumbnail_url TEXT DEFAULT '',
  video_embed_url TEXT DEFAULT '',
  date_taken DATE,
  location TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  visible BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
- Purpose: Photos and videos displayed on the public website
- Managed by band members through the web app
- Separate from gigs — these are gallery items

#### RLS Policies
```sql
-- Anyone (no auth) can read public gigs
CREATE POLICY "anon_read_public_gigs" ON gigs
  FOR SELECT USING (is_public = true);

-- Anyone can read public media
ALTER TABLE public_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_media" ON public_media
  FOR SELECT USING (visible = true);
CREATE POLICY "auth_manage_media" ON public_media
  FOR ALL USING (auth.uid() IS NOT NULL);
```

**Important:** The existing gigs RLS policy grants full access to authenticated users. The new policy adds anonymous read access ONLY for gigs marked `is_public = true`. Non-public gigs remain invisible to unauthenticated visitors.

### 3.2 Shared Types Update

**File:** `shared/supabase/types.ts`

```typescript
// Add to Gig interface:
is_public: boolean;

// Add to Profile interface:
band_role: string;

// New interface:
export interface PublicMedia {
  id: string;
  media_type: 'photo' | 'video';
  url: string;
  title: string;
  description: string;
  thumbnail_url: string;
  video_embed_url: string;
  date_taken: string | null;
  location: string;
  sort_order: number;
  visible: boolean;
  created_by: string;
  created_at: string;
}
```

### 3.3 Shared Queries Update

**File:** `shared/supabase/queries.ts`

New functions:
```typescript
// Public (no auth required) — for the website
export async function getPublicGigs(): Promise<Gig[]>
  // SELECT * FROM gigs WHERE is_public = true AND date >= today ORDER BY date ASC

export async function getPublicMedia(): Promise<PublicMedia[]>
  // SELECT * FROM public_media WHERE visible = true ORDER BY sort_order ASC, created_at DESC

// Profile management
export async function updateProfile(updates: { name?: string; band_role?: string; avatar_url?: string }): Promise<void>
  // UPDATE profiles SET ... WHERE id = auth.uid()
```

Modified functions:
- `createGig()`: Add `is_public?: boolean` parameter (default `false`)
- `updateGig()`: Handle `is_public` field (changelog auto-tracks via existing `Object.entries` loop)

---

## 4. Gig Form — "Show on Website" Toggle

### 4.1 Web Form
**File:** `web/src/components/GigForm.tsx`

- New toggle below the notes field, above the save button
- Only visible when `gig_type === 'gig'` (practices never shown publicly)
- Label: "Show on website"
- Sublabel: "Display this gig on thegreentangerine.com"
- Default: unchecked (false)
- Style: Matching existing toggle pattern (`.toggle-btn` / checkbox)

```
┌─────────────────────────────┐
│ Notes                       │
│ ┌─────────────────────────┐ │
│ │                         │ │
│ └─────────────────────────┘ │
│                             │
│ ☐ Show on website           │
│   Display on thegreentangerine.com │
│                             │
│ [Delete]           [Save]   │
└─────────────────────────────┘
```

### 4.2 Native Form
**File:** `native/app/gig/new.tsx`

- Same toggle using React Native `Switch` component
- Same visibility rule (gig type only)
- Same label and positioning
- Style: NeuCard section matching existing fields

---

## 5. Profile Page (Web App)

### 5.1 New Component
**File:** `web/src/components/ProfilePage.tsx`

Simple, focused profile editor:

```
┌─────────────────────────────┐
│ ← Back              Profile │
├─────────────────────────────┤
│                             │
│        ┌──────┐             │
│        │avatar│             │
│        └──────┘             │
│    [Change Photo]           │
│                             │
│  ┌─── Your Details ──────┐ │
│  │ Name      [________]  │ │
│  │ Role      [________]  │ │
│  │ Email     user@...     │ │
│  └────────────────────────┘ │
│                             │
│  [Save Changes]             │
│                             │
│  [Sign Out]                 │
└─────────────────────────────┘
```

Fields:
| Field | Type | Source | Editable |
|-------|------|--------|----------|
| Avatar | Image | `profile.avatar_url` | Yes (URL input or file upload later) |
| Name | Text | `profile.name` | Yes |
| Band Role | Text | `profile.band_role` | Yes |
| Email | Text | Supabase auth `user.email` | No (read-only) |

Save calls `updateProfile()` from shared queries.

### 5.2 App.tsx Integration
**File:** `web/src/App.tsx`

Changes:
1. Add `'profile'` to `View` type union
2. Split header user area: clickable name → profile page, separate "Sign out" link
3. Add conditional render block for profile view
4. Profile page gets `onClose` prop to return to previous view

---

## 6. Public Website

### 6.1 Architecture

**File:** `web/src/App.tsx` — modified auth flow

Current:
```
if (!user) → <LoginPage />
```

New:
```
if (!user) → <PublicSite onLogin={showLoginModal} />
```

The `PublicSite` component IS the website. It replaces the plain login page.

### 6.2 Public Site Component
**File:** `web/src/components/PublicSite.tsx`

Single-page scrolling website with these sections:

#### Header (sticky)
- Logo + "The Green Tangerine" text
- Nav links: About, For Venues, Pricing, Gallery, Contact
- "Band Login" button (opens login modal)
- Scroll-to-section on click (smooth scroll, anchor IDs)
- Mobile: hamburger menu

#### Hero Section
- Full-viewport background image (from base44 export: Facebook CDN URL, or Supabase storage later)
- H1: "The Green Tangerine"
- Subtitle: "South Wales Function Band"
- Tagline: "Live rock covers for pubs, weddings & events across Cardiff, Swansea, Bridgend, Neath & the Rhondda"
- Social links: Facebook, TikTok
- CTA buttons: "View Gallery", "Book Us"

#### Upcoming Gigs (dynamic)
- Pulls from `getPublicGigs()` — future gigs with `is_public = true`
- Shows: date, venue, time (if set)
- If no public gigs: section hidden entirely
- No auth required (anonymous Supabase read via RLS)

#### About
- Band description (hardcoded from base44 export)
- "We don't just play - we display!"
- "100% Recommended" social proof

#### For Venues
- 6 benefit cards (self-contained, quick setup, flexible sets, volume control, insured, track record)
- Equipment & performance details
- Testimonials (2 hardcoded)

#### Pricing
- 5 tier cards: Pub Gig (£400-600), Private Party (£600-800), Wedding (£800-1200), Corporate (£1000-1500), Festival (£1000+)
- Additional services list
- "Most Popular" badge on Private Party

#### Gallery (dynamic)
- Photos and videos from `getPublicMedia()`
- Photo grid with lightbox on click
- Video cards with YouTube embed support
- If no media: section hidden

#### Contact
- Email: thegreentangerine01@gmail.com (mailto link)
- Location: Rhondda, South Wales
- Social links
- Simple contact form (Phase 2 — start with mailto, add Supabase Edge Function later)

#### Footer
- Band name + tagline
- Areas covered
- Social links
- Copyright
- "Keep It Green!"

### 6.3 Login Modal
**File:** `web/src/components/LoginModal.tsx`

- Overlay/modal containing the existing `LoginPage` component logic
- Triggered by "Band Login" button in public site header
- Close button to dismiss
- On successful auth: app state switches to `MainView` (existing calendar view)

### 6.4 Styling
**File:** `web/src/App.css` (additions)

The public site uses the same dark theme foundation but with section-specific styling:
- Green (#00e676 / #10b981) + Orange (#f39c12 / #f97316) brand colors
- Glass-morphism cards: semi-transparent backgrounds with backdrop blur
- Gradient CTAs: green-to-orange on primary buttons
- Font: Karla (body) + Impact/Arial Black (hero headings — matching base44)
- Responsive: mobile-first, sections stack vertically on small screens

### 6.5 SEO
**File:** `web/index.html`

Update meta tags:
- Title: "The Green Tangerine | South Wales Function Band from the Rhondda"
- Description: "Energetic live band from the Rhondda bringing classic rock and indie covers to pubs, weddings, and events across Cardiff, Swansea, Bridgend, Neath, and South Wales."
- OG tags (title, description, image, type)
- Schema.org JSON-LD (MusicGroup + LocalBusiness)

---

## 7. Domain Setup (IONOS → Vercel)

### 7.1 Vercel Custom Domain
1. In Vercel dashboard → Project Settings → Domains
2. Add `thegreentangerine.com` and `www.thegreentangerine.com`
3. Vercel will provide DNS records to configure

### 7.2 IONOS DNS Configuration
In IONOS DNS settings for thegreentangerine.com:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | @ | 76.76.21.21 | 3600 |
| CNAME | www | cname.vercel-dns.com | 3600 |

Remove any existing A/CNAME records pointing to base44.

### 7.3 SSL
Vercel auto-provisions SSL certificates once DNS propagates. No manual setup needed.

### 7.4 Verification Steps
1. Add domain in Vercel
2. Update DNS in IONOS
3. Wait for propagation (usually 5-30 minutes, can take up to 48 hours)
4. Verify: `curl -I https://thegreentangerine.com` returns 200
5. Verify: HTTPS works (Vercel auto-SSL)

---

## 8. Implementation Order

### Sprint 1: Foundation (Schema + Quick Wins)
1. Supabase migration (is_public, band_role, public_media table)
2. Update shared types and queries
3. Gig form toggle — web
4. Gig form toggle — native
5. Profile page — web
6. Type check both apps (`npx tsc --noEmit`)

### Sprint 2: Public Website
7. Public site component (all sections, hardcoded content)
8. Dynamic gigs section (getPublicGigs)
9. Login modal integration
10. App.tsx auth flow change (PublicSite replaces LoginPage)
11. Public site CSS/responsive
12. SEO meta tags

### Sprint 3: Media & Polish
13. Dynamic gallery (getPublicMedia + media management UI for members)
14. Contact form (start with mailto, upgrade later)
15. Domain setup (IONOS → Vercel)
16. Cross-browser testing
17. Mobile responsive testing

---

## 9. Data Flow Diagram

```
                    ┌──────────────┐
                    │   Supabase   │
                    │              │
                    │  gigs        │──── is_public flag
                    │  profiles    │──── band_role
                    │  public_media│──── photos/videos
                    │  away_dates  │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
     ┌────────▼───┐  ┌─────▼──────┐  ┌──▼──────────┐
     │  Public    │  │  Web App   │  │  Native App │
     │  Website   │  │  (auth'd)  │  │  (auth'd)   │
     │            │  │            │  │             │
     │ • Gigs     │  │ • Calendar │  │ • Calendar  │
     │   (public) │  │ • Gig CRUD │  │ • Gig CRUD  │
     │ • Gallery  │  │ • Away     │  │ • Invoices  │
     │ • Pricing  │  │ • Profile  │  │ • Settings  │
     │ • Contact  │  │            │  │             │
     └────────────┘  └────────────┘  └─────────────┘

     Anonymous read    Authenticated     Authenticated
     (RLS policy)      full access       full access
```

---

## 10. Content Source

All public website text content is sourced from `base44-export/SITE_REFERENCE.md`, which contains the complete extraction from the old base44 site including:
- Hero copy, taglines, SEO tags
- For Venues benefits, equipment lists, testimonials
- All 5 pricing tiers with features
- Contact info and form fields
- Band description and social links
- Color palette and design patterns

---

## 11. Risk Assessment

| Risk | Mitigation |
|------|-----------|
| RLS policy conflict (public gig reads vs existing auth policy) | Test with anonymous Supabase client; existing auth policy uses `auth.uid() IS NOT NULL` which won't match anon |
| PWA service worker caching public site | Configure workbox to handle public routes correctly |
| SEO for SPA (client-rendered) | Add meta tags in index.html; consider prerender plugin for Vite if Google doesn't index well |
| Domain propagation delay | Start DNS change early; keep base44 site live until verified |
| Large public site CSS bloating app | Keep public site styles scoped with `.public-` prefix |

---

## 12. Future Enhancements (Not in This Plan)
- Media upload/management UI for band members
- Contact form via Supabase Edge Function (instead of mailto)
- Photo upload to Supabase Storage
- Blog/news section
- Testimonial management (editable from app)
- SEO prerendering for better Google indexing
