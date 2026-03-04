-- Sprint S6: Storage bucket + contact submissions table

-- 1. Create public-media storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public-media',
  'public-media',
  true,
  10485760, -- 10MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: anyone can read public bucket, authenticated users can upload/delete
CREATE POLICY "public_read_media_objects" ON storage.objects
  FOR SELECT USING (bucket_id = 'public-media');

CREATE POLICY "auth_upload_media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'public-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "auth_delete_media" ON storage.objects
  FOR DELETE USING (bucket_id = 'public-media' AND auth.uid() IS NOT NULL);

-- 2. Create contact_submissions table
CREATE TABLE IF NOT EXISTS contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  event_type TEXT DEFAULT '',
  preferred_date DATE,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: anon can insert, authenticated can read/update
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_submit_enquiry" ON contact_submissions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "auth_read_enquiries" ON contact_submissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "auth_update_enquiries" ON contact_submissions
  FOR UPDATE USING (auth.uid() IS NOT NULL);
