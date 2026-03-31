-- S38: Add missing UPDATE policies on storage.objects for practice-tracks and song-stems.
-- Without these, upsert (re-upload) fails with "new row violates row-level security policy".

-- practice-tracks: allow authenticated users to UPDATE (needed for upsert: true)
CREATE POLICY "practice_tracks_update_authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'practice-tracks')
  WITH CHECK (bucket_id = 'practice-tracks');

-- song-stems: add full storage policies (bucket was created manually, policies were missing)
CREATE POLICY "song_stems_read_all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'song-stems');

CREATE POLICY "song_stems_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'song-stems');

CREATE POLICY "song_stems_update_authenticated"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'song-stems')
  WITH CHECK (bucket_id = 'song-stems');

CREATE POLICY "song_stems_delete_authenticated"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'song-stems');
