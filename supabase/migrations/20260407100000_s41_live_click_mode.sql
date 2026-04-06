-- Session 41: Add live_click_mode to songs table
-- Per-song click behavior during live performance:
--   'full'     = click plays all the way through (default, preserves existing behavior)
--   'count_in' = click plays for 30 seconds then auto-stops
--   'off'      = no click for this song in live mode
ALTER TABLE songs ADD COLUMN IF NOT EXISTS live_click_mode text NOT NULL DEFAULT 'full'
  CHECK (live_click_mode IN ('full', 'count_in', 'off'));
