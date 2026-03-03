-- ============================================================
-- Tangerine Timetree / GigBooks Shared Calendar
-- Supabase Migration Script
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Gigs table
CREATE TABLE gigs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  venue TEXT DEFAULT '',
  client_name TEXT DEFAULT '',
  fee NUMERIC(10,2),
  payment_type TEXT CHECK (payment_type IN ('cash', 'invoice', '')),
  load_time TIME,
  start_time TIME,
  end_time TIME,
  notes TEXT DEFAULT '',
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Away dates table
CREATE TABLE away_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- 4. Gig changelog table
CREATE TABLE gig_changelog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id UUID NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  field_changed TEXT DEFAULT '',
  old_value TEXT DEFAULT '',
  new_value TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Indexes
CREATE INDEX idx_gigs_date ON gigs(date);
CREATE INDEX idx_away_dates_user ON away_dates(user_id);
CREATE INDEX idx_away_dates_range ON away_dates(start_date, end_date);
CREATE INDEX idx_changelog_gig ON gig_changelog(gig_id);

-- ============================================================
-- Row-Level Security
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gigs ENABLE ROW LEVEL SECURITY;
ALTER TABLE away_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE gig_changelog ENABLE ROW LEVEL SECURITY;

-- Profiles: all authenticated can read, own profile editable
CREATE POLICY "Profiles viewable by authenticated"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Gigs: all authenticated can read + create + update + delete
CREATE POLICY "Gigs viewable by authenticated"
  ON gigs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create gigs"
  ON gigs FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "Authenticated can update any gig"
  ON gigs FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete any gig"
  ON gigs FOR DELETE TO authenticated USING (true);

-- Away dates: all can read, own dates manageable
CREATE POLICY "Away dates viewable by authenticated"
  ON away_dates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create own away dates"
  ON away_dates FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own away dates"
  ON away_dates FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can delete own away dates"
  ON away_dates FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Changelog: all can read, insert via own user_id
CREATE POLICY "Changelog viewable by authenticated"
  ON gig_changelog FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert changelog"
  ON gig_changelog FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Auto-create profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, is_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'is_admin')::boolean, FALSE)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Auto-update updated_at on gigs
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_gig_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_gig_updated
  BEFORE UPDATE ON gigs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_gig_timestamp();

-- ============================================================
-- Enable Realtime (also enable via Dashboard > Database > Replication)
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE gigs;
ALTER PUBLICATION supabase_realtime ADD TABLE away_dates;
