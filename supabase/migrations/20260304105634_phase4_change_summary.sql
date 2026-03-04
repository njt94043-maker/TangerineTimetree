-- Phase 4: In-App Change Summary
-- Add last_opened_at to profiles, create away_date_changelog table

-- Add last_opened_at to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ DEFAULT NOW();

-- Create away_date_changelog table
CREATE TABLE IF NOT EXISTS away_date_changelog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  away_date_id UUID,
  user_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL CHECK (action IN ('created', 'deleted')),
  date_range TEXT DEFAULT '',
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE away_date_changelog ENABLE ROW LEVEL SECURITY;

-- RLS policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'away_date_changelog' AND policyname = 'Authenticated read') THEN
    CREATE POLICY "Authenticated read" ON away_date_changelog FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'away_date_changelog' AND policyname = 'Own inserts') THEN
    CREATE POLICY "Own inserts" ON away_date_changelog FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
