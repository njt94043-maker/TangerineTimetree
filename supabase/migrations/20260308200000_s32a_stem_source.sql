-- S32A: Add source column to song_stems
-- Distinguishes auto-generated stems (Demucs) from manually uploaded ones.
-- Also adds 'separating' as a valid beat_maps status for the pipeline.

ALTER TABLE song_stems ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
COMMENT ON COLUMN song_stems.source IS 'auto = server-generated via Demucs, manual = user-uploaded';

-- Update beat_maps status check to include 'separating'
ALTER TABLE beat_maps DROP CONSTRAINT IF EXISTS beat_maps_status_check;
ALTER TABLE beat_maps ADD CONSTRAINT beat_maps_status_check
  CHECK (status IN ('pending', 'analysing', 'separating', 'ready', 'failed'));
