-- Sprint S4: Public website schema changes
-- Adds is_public flag to gigs, band_role to profiles, and public_media table

-- 1. Add is_public to gigs
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- 2. Add band_role to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS band_role TEXT DEFAULT '';

-- 3. Create public_media table
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

-- 4. RLS policies

-- Anyone (no auth) can read public gigs
CREATE POLICY "anon_read_public_gigs" ON gigs
  FOR SELECT USING (is_public = true);

-- Enable RLS on public_media
ALTER TABLE public_media ENABLE ROW LEVEL SECURITY;

-- Anyone can read visible media
CREATE POLICY "anon_read_media" ON public_media
  FOR SELECT USING (visible = true);

-- Authenticated users can manage media
CREATE POLICY "auth_manage_media" ON public_media
  FOR ALL USING (auth.uid() IS NOT NULL);
