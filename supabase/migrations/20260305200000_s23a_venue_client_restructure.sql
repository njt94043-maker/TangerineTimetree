-- ═══════════════════════════════════════════════════════════
-- S23A Migration: Venue/Client Restructure
-- Date: 2026-03-05
-- ═══════════════════════════════════════════════════════════

-- ─── 1. ALTER venues: drop client_id, add new fields ─────
-- Drop the FK constraint first, then the column
ALTER TABLE venues DROP CONSTRAINT IF EXISTS venues_client_id_fkey;
ALTER TABLE venues DROP COLUMN IF EXISTS client_id;

-- Add new venue fields
ALTER TABLE venues ADD COLUMN IF NOT EXISTS postcode TEXT DEFAULT '';
ALTER TABLE venues ADD COLUMN IF NOT EXISTS rating_atmosphere SMALLINT DEFAULT NULL;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS rating_crowd SMALLINT DEFAULT NULL;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS rating_stage SMALLINT DEFAULT NULL;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS rating_parking SMALLINT DEFAULT NULL;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- Add rating check constraints (1-5)
ALTER TABLE venues ADD CONSTRAINT venues_rating_atmosphere_check CHECK (rating_atmosphere IS NULL OR (rating_atmosphere >= 1 AND rating_atmosphere <= 5));
ALTER TABLE venues ADD CONSTRAINT venues_rating_crowd_check CHECK (rating_crowd IS NULL OR (rating_crowd >= 1 AND rating_crowd <= 5));
ALTER TABLE venues ADD CONSTRAINT venues_rating_stage_check CHECK (rating_stage IS NULL OR (rating_stage >= 1 AND rating_stage <= 5));
ALTER TABLE venues ADD CONSTRAINT venues_rating_parking_check CHECK (rating_parking IS NULL OR (rating_parking >= 1 AND rating_parking <= 5));

-- ─── 2. CREATE venue_photos ─────────────────────────────
CREATE TABLE IF NOT EXISTS venue_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL DEFAULT '',
  storage_path TEXT NOT NULL DEFAULT '',
  caption TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_photos_venue_id ON venue_photos(venue_id);

-- ─── 3. ALTER gigs: add venue_id + client_id FKs ────────
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id) ON DELETE SET NULL;
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- ─── 4. ALTER quotes: add venue_id FK ───────────────────
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id) ON DELETE SET NULL;

-- ─── 5. ALTER invoices: add venue_id FK ─────────────────
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id) ON DELETE SET NULL;

-- ─── 6. ALTER formal_invoices: add venue_id FK ──────────
ALTER TABLE formal_invoices ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id) ON DELETE SET NULL;

-- ─── 7. RLS Policies for venue_photos ───────────────────
ALTER TABLE venue_photos ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all venue photos
CREATE POLICY "venue_photos_select" ON venue_photos
  FOR SELECT TO authenticated
  USING (true);

-- Creator can insert venue photos
CREATE POLICY "venue_photos_insert" ON venue_photos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Creator can delete their own venue photos
CREATE POLICY "venue_photos_delete" ON venue_photos
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- ─── 8. Update venue RLS (remove any client_id dependency) ─
-- Drop and recreate venue policies to ensure they don't reference client_id
DROP POLICY IF EXISTS "venues_select" ON venues;
DROP POLICY IF EXISTS "venues_insert" ON venues;
DROP POLICY IF EXISTS "venues_update" ON venues;
DROP POLICY IF EXISTS "venues_delete" ON venues;
-- Also drop legacy names if present
DROP POLICY IF EXISTS "Authenticated users can read venues" ON venues;
DROP POLICY IF EXISTS "Authenticated users can insert venues" ON venues;
DROP POLICY IF EXISTS "Authenticated users can update venues" ON venues;
DROP POLICY IF EXISTS "Authenticated users can delete venues" ON venues;

CREATE POLICY "venues_select" ON venues
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "venues_insert" ON venues
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "venues_update" ON venues
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "venues_delete" ON venues
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- ─── 9. Create venue-photos Storage bucket ──────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('venue-photos', 'venue-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for venue-photos bucket
CREATE POLICY "venue_photos_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'venue-photos');

CREATE POLICY "venue_photos_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'venue-photos');

CREATE POLICY "venue_photos_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'venue-photos');
