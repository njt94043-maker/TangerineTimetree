-- S28A: song_stems table
-- Stores pre-separated audio stems per song (drums, bass, vocals, etc.)
-- User separates stems externally (Moises/Demucs) and uploads via web app.
-- Each stem plays as an independent mixer channel in the Android practice engine.

CREATE TABLE song_stems (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id       UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  label         TEXT NOT NULL CHECK (label IN ('drums','bass','vocals','guitar','keys','backing','other')),
  audio_url     TEXT NOT NULL,
  storage_path  TEXT NOT NULL,
  created_by    UUID NOT NULL REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_song_stems_song ON song_stems(song_id);

-- RLS
ALTER TABLE song_stems ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view stems (all band members may practice)
CREATE POLICY "Authenticated users can view stems"
  ON song_stems FOR SELECT
  TO authenticated
  USING (true);

-- Any authenticated user can insert (consistent with songs policy)
CREATE POLICY "Authenticated users can insert stems"
  ON song_stems FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Any authenticated user can delete stems (band maintains shared library)
CREATE POLICY "Authenticated users can delete stems"
  ON song_stems FOR DELETE
  TO authenticated
  USING (true);

-- NOTE: Create storage bucket 'song-stems' in Supabase dashboard:
--   Public bucket, allowed MIME types: audio/*
--   Max file size: 200MB
