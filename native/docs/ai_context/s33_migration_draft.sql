-- S33: Songs/Setlists/Live/Practice Big-Picture Redesign
-- DRAFT migration — do NOT apply until implementation sprint (S34)

-- ══════════════════════════════════════════════
-- 1. Song Categories
-- ══════════════════════════════════════════════

-- Add category column (tange_cover, tange_original, personal)
ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'tange_cover';

ALTER TABLE songs
  ADD CONSTRAINT songs_category_check
  CHECK (category IN ('tange_cover', 'tange_original', 'personal'));

-- Add owner_id for personal songs (NULL for band songs)
ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id);

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_songs_category ON songs(category);
CREATE INDEX IF NOT EXISTS idx_songs_owner ON songs(owner_id) WHERE owner_id IS NOT NULL;

-- Backfill existing songs as tange covers (Cissy Strut, Sultans, War Pigs)
-- UPDATE songs SET category = 'tange_cover' WHERE category = 'tange_cover'; -- already default


-- ══════════════════════════════════════════════
-- 2. Setlist Types
-- ══════════════════════════════════════════════

-- Add setlist_type and band_name
ALTER TABLE setlists
  ADD COLUMN IF NOT EXISTS setlist_type TEXT NOT NULL DEFAULT 'tange';

ALTER TABLE setlists
  ADD CONSTRAINT setlists_type_check
  CHECK (setlist_type IN ('tange', 'other_band'));

ALTER TABLE setlists
  ADD COLUMN IF NOT EXISTS band_name TEXT NOT NULL DEFAULT 'The Green Tangerine';

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_setlists_type ON setlists(setlist_type);


-- ══════════════════════════════════════════════
-- 3. Player Preferences (per-user)
-- ══════════════════════════════════════════════

-- Add player preference columns to user_settings
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS player_click_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS player_flash_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS player_lyrics_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS player_chords_enabled BOOLEAN NOT NULL DEFAULT true;
