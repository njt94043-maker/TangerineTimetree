-- S26A: Add lyrics, chords, and beat_offset_ms to songs table
ALTER TABLE songs ADD COLUMN IF NOT EXISTS lyrics TEXT DEFAULT '';
ALTER TABLE songs ADD COLUMN IF NOT EXISTS chords TEXT DEFAULT '';
ALTER TABLE songs ADD COLUMN IF NOT EXISTS beat_offset_ms INTEGER DEFAULT 0;
