-- Add gig_type column to support practice sessions
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS gig_type TEXT DEFAULT 'gig' CHECK (gig_type IN ('gig', 'practice'));
