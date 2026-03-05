-- Sprint S22: Gig attachments + visibility toggle

-- 1. Create gig_attachments table
CREATE TABLE IF NOT EXISTS gig_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id UUID NOT NULL REFERENCES gigs(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE gig_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_attachments" ON gig_attachments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_insert_attachments" ON gig_attachments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "auth_delete_own_attachments" ON gig_attachments
  FOR DELETE USING (uploaded_by = auth.uid());

-- 2. Create gig-attachments storage bucket (private — band members only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gig-attachments',
  'gig-attachments',
  false,
  5242880, -- 5MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated can read/upload/delete
CREATE POLICY "auth_read_gig_attachments" ON storage.objects
  FOR SELECT USING (bucket_id = 'gig-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "auth_upload_gig_attachments" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'gig-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "auth_delete_gig_attachments" ON storage.objects
  FOR DELETE USING (bucket_id = 'gig-attachments' AND auth.uid() IS NOT NULL);

-- 3. Replace is_public boolean with visibility enum
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'hidden';
UPDATE gigs SET visibility = CASE WHEN is_public THEN 'public' ELSE 'hidden' END WHERE visibility = 'hidden';
ALTER TABLE gigs DROP COLUMN IF EXISTS is_public;
ALTER TABLE gigs ADD CONSTRAINT gigs_visibility_check CHECK (visibility IN ('public', 'private', 'hidden'));
