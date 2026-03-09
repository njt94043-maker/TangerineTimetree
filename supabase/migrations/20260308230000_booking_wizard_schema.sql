-- Booking Wizard Schema: gig subtypes, statuses, deposits, calendar colours, cancellation threshold

-- ─── Gigs table: new columns ───────────────────────────────

ALTER TABLE gigs ADD COLUMN IF NOT EXISTS gig_subtype TEXT DEFAULT 'pub' CHECK (gig_subtype IN ('pub', 'client'));
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'confirmed' CHECK (status IN ('enquiry', 'pencilled', 'confirmed', 'cancelled'));
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2);
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN DEFAULT false;
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL;
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS formal_invoice_id UUID REFERENCES formal_invoices(id) ON DELETE SET NULL;

-- ─── Band settings: cancellation threshold ─────────────────

ALTER TABLE band_settings ADD COLUMN IF NOT EXISTS cancellation_threshold_days INTEGER DEFAULT 14;

-- ─── User settings: per-user calendar colours ──────────────

ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS calendar_colour_pub TEXT DEFAULT '#00e676';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS calendar_colour_client TEXT DEFAULT '#f39c12';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS calendar_colour_practice TEXT DEFAULT '#bb86fc';

-- ─── Data migration: set defaults for existing gigs ────────

UPDATE gigs SET gig_subtype = 'pub' WHERE gig_type = 'gig' AND (gig_subtype IS NULL OR gig_subtype = 'pub');
UPDATE gigs SET status = 'confirmed' WHERE status IS NULL;
