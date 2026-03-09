-- S34: Song categories, setlist types, player prefs, drum notation

-- 1. Song Categories
ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'tange_cover';

ALTER TABLE songs
  ADD CONSTRAINT songs_category_check
  CHECK (category IN ('tange_cover', 'tange_original', 'personal'));

ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_songs_category ON songs(category);
CREATE INDEX IF NOT EXISTS idx_songs_owner ON songs(owner_id) WHERE owner_id IS NOT NULL;

-- 2. Setlist Types
ALTER TABLE setlists
  ADD COLUMN IF NOT EXISTS setlist_type TEXT NOT NULL DEFAULT 'tange';

ALTER TABLE setlists
  ADD CONSTRAINT setlists_type_check
  CHECK (setlist_type IN ('tange', 'other_band'));

ALTER TABLE setlists
  ADD COLUMN IF NOT EXISTS band_name TEXT NOT NULL DEFAULT 'The Green Tangerine';

CREATE INDEX IF NOT EXISTS idx_setlists_type ON setlists(setlist_type);

-- 3. Player Preferences (per-user)
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS player_click_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS player_flash_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS player_lyrics_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS player_chords_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS player_notes_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS player_drums_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS player_vis_enabled BOOLEAN NOT NULL DEFAULT true;

-- 4. Drum Notation field on songs
ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS drum_notation TEXT DEFAULT '';
