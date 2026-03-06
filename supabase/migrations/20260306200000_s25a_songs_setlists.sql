-- S25A: Songs & Setlists schema
-- Songs store metronome data (BPM, time sig, subdivisions, accent patterns)
-- Setlists are ordered collections of songs
-- practice-tracks storage bucket for MP3 backing tracks

-- ─── Clean up any stale tables from prior experiments ───

DROP TABLE IF EXISTS setlist_songs CASCADE;
DROP TABLE IF EXISTS setlists CASCADE;
DROP TABLE IF EXISTS songs CASCADE;

-- ─── Songs ──────────────────────────────────────────────

CREATE TABLE songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  artist TEXT DEFAULT '',
  bpm NUMERIC(6,2) DEFAULT 120 CHECK (bpm >= 20 AND bpm <= 400),
  time_signature_top INT DEFAULT 4 CHECK (time_signature_top >= 1 AND time_signature_top <= 16),
  time_signature_bottom INT DEFAULT 4 CHECK (time_signature_bottom IN (2, 4, 8, 16)),
  subdivision INT DEFAULT 1 CHECK (subdivision >= 1 AND subdivision <= 6),
  swing_percent NUMERIC(5,2) DEFAULT 50 CHECK (swing_percent >= 50 AND swing_percent <= 75),
  accent_pattern TEXT DEFAULT NULL,
  click_sound TEXT DEFAULT 'default',
  count_in_bars INT DEFAULT 1 CHECK (count_in_bars >= 0 AND count_in_bars <= 8),
  duration_seconds INT DEFAULT NULL,
  key TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  audio_url TEXT DEFAULT NULL,
  audio_storage_path TEXT DEFAULT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_songs_name ON songs(name);
CREATE INDEX idx_songs_created_by ON songs(created_by);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_songs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER songs_updated_at
  BEFORE UPDATE ON songs
  FOR EACH ROW EXECUTE FUNCTION update_songs_updated_at();

-- RLS
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "songs_select_authenticated"
  ON songs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "songs_insert_authenticated"
  ON songs FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "songs_update_authenticated"
  ON songs FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "songs_delete_authenticated"
  ON songs FOR DELETE TO authenticated
  USING (true);

-- ─── Setlists ───────────────────────────────────────────

CREATE TABLE setlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_setlists_created_by ON setlists(created_by);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_setlists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER setlists_updated_at
  BEFORE UPDATE ON setlists
  FOR EACH ROW EXECUTE FUNCTION update_setlists_updated_at();

-- RLS
ALTER TABLE setlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "setlists_select_authenticated"
  ON setlists FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "setlists_insert_authenticated"
  ON setlists FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "setlists_update_authenticated"
  ON setlists FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "setlists_delete_authenticated"
  ON setlists FOR DELETE TO authenticated
  USING (true);

-- ─── Setlist Songs (junction table with ordering) ───────

CREATE TABLE setlist_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id UUID NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  UNIQUE(setlist_id, position)
);

CREATE INDEX idx_setlist_songs_setlist ON setlist_songs(setlist_id);
CREATE INDEX idx_setlist_songs_song ON setlist_songs(song_id);

-- RLS
ALTER TABLE setlist_songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "setlist_songs_select_authenticated"
  ON setlist_songs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "setlist_songs_insert_authenticated"
  ON setlist_songs FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "setlist_songs_update_authenticated"
  ON setlist_songs FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "setlist_songs_delete_authenticated"
  ON setlist_songs FOR DELETE TO authenticated
  USING (true);

-- ─── Storage bucket for practice tracks ─────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('practice-tracks', 'practice-tracks', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for practice-tracks bucket
CREATE POLICY "practice_tracks_read_all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'practice-tracks');

CREATE POLICY "practice_tracks_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'practice-tracks');

CREATE POLICY "practice_tracks_delete_authenticated"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'practice-tracks');
