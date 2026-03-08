-- S31A: beat_maps table
-- Stores server-side beat detection results (madmom RNN+DBN).
-- One beat map per song. Android fetches this instead of running BTrack on-device.
-- beats: JSON array of float seconds [0.45, 0.92, 1.38, ...]

CREATE TABLE beat_maps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id     UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  beats       JSONB NOT NULL DEFAULT '[]',
  bpm         FLOAT NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','analysing','ready','failed')),
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_beat_maps_song UNIQUE (song_id)
);

CREATE INDEX idx_beat_maps_song ON beat_maps(song_id);

-- RLS
ALTER TABLE beat_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view beat maps"
  ON beat_maps FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert beat maps"
  ON beat_maps FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update beat maps"
  ON beat_maps FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete beat maps"
  ON beat_maps FOR DELETE
  TO authenticated
  USING (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_beat_maps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER beat_maps_updated_at
  BEFORE UPDATE ON beat_maps
  FOR EACH ROW EXECUTE FUNCTION update_beat_maps_updated_at();
