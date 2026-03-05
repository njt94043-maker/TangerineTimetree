-- Fix: Drop dependent RLS policy before dropping is_public column

-- Drop the RLS policy that references is_public
DROP POLICY IF EXISTS "anon_read_public_gigs" ON gigs;

-- Add visibility column + migrate data
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'hidden';
UPDATE gigs SET visibility = CASE WHEN is_public THEN 'public' ELSE 'hidden' END WHERE visibility = 'hidden';

-- Now safe to drop is_public
ALTER TABLE gigs DROP COLUMN IF EXISTS is_public;

-- Add check constraint
ALTER TABLE gigs ADD CONSTRAINT gigs_visibility_check CHECK (visibility IN ('public', 'private', 'hidden'));

-- Recreate public gig read policy using visibility
CREATE POLICY "anon_read_public_gigs" ON gigs
  FOR SELECT USING (visibility IN ('public', 'private'));
