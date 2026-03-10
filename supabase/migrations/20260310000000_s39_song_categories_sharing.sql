-- S39: Song categories overhaul + selective sharing + is_best_take
-- Categories: tgt_cover, tgt_original, personal_cover, personal_original
-- Sharing: personal_original songs require explicit sharing (D-126)
-- personal_cover visible to ALL authenticated users (D-125)
-- RLS: can_access_song() includes personal_cover as visible-to-all

-- ─── Category migration ───

-- Drop old constraint
ALTER TABLE songs DROP CONSTRAINT IF EXISTS songs_category_check;

-- Migrate existing data
UPDATE songs SET category = 'tgt_cover' WHERE category = 'tange_cover';
UPDATE songs SET category = 'tgt_original' WHERE category = 'tange_original';
UPDATE songs SET category = 'personal_cover' WHERE category = 'personal';

-- Add new constraint
ALTER TABLE songs ADD CONSTRAINT songs_category_check
  CHECK (category IN ('tgt_cover', 'tgt_original', 'personal_cover', 'personal_original'));

ALTER TABLE songs ALTER COLUMN category SET DEFAULT 'tgt_cover';

-- ─── is_best_take on song_stems (D-130) ───

ALTER TABLE song_stems ADD COLUMN IF NOT EXISTS is_best_take BOOLEAN NOT NULL DEFAULT false;

-- ─── song_shares table (D-135) ───

CREATE TABLE IF NOT EXISTS song_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  shared_with UUID NOT NULL REFERENCES profiles(id),
  shared_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(song_id, shared_with)
);

CREATE INDEX IF NOT EXISTS idx_song_shares_song ON song_shares(song_id);
CREATE INDEX IF NOT EXISTS idx_song_shares_shared_with ON song_shares(shared_with);

-- ─── Helper function: can current user access this song? (D-129) ───
-- TGT songs + personal_cover = all authenticated (D-125)
-- personal_original = owner OR song_shares entry (D-126)

CREATE OR REPLACE FUNCTION can_access_song(p_song_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM songs
    WHERE id = p_song_id AND (
      category IN ('tgt_cover', 'tgt_original', 'personal_cover')
      OR created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM song_shares
        WHERE song_id = p_song_id AND shared_with = auth.uid()
      )
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─── RLS: song_shares ───

ALTER TABLE song_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "song_shares_select"
  ON song_shares FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "song_shares_insert"
  ON song_shares FOR INSERT TO authenticated
  WITH CHECK (
    shared_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM songs WHERE id = song_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "song_shares_delete"
  ON song_shares FOR DELETE TO authenticated
  USING (
    shared_with = auth.uid()
    OR EXISTS (
      SELECT 1 FROM songs WHERE id = song_id AND created_by = auth.uid()
    )
  );

-- ─── RLS: songs (replace all 4 policies) ───

DROP POLICY IF EXISTS "songs_select_authenticated" ON songs;
DROP POLICY IF EXISTS "songs_insert_authenticated" ON songs;
DROP POLICY IF EXISTS "songs_update_authenticated" ON songs;
DROP POLICY IF EXISTS "songs_delete_authenticated" ON songs;

-- SELECT: TGT + personal_cover visible to all (D-125), personal_original = owner + shared (D-126)
CREATE POLICY "songs_select"
  ON songs FOR SELECT TO authenticated
  USING (
    category IN ('tgt_cover', 'tgt_original', 'personal_cover')
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM song_shares WHERE song_id = id AND shared_with = auth.uid()
    )
  );

-- INSERT: must set created_by to self
CREATE POLICY "songs_insert"
  ON songs FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- UPDATE: TGT = any auth, personal = owner only
CREATE POLICY "songs_update"
  ON songs FOR UPDATE TO authenticated
  USING (
    category IN ('tgt_cover', 'tgt_original')
    OR created_by = auth.uid()
  );

-- DELETE: TGT = any auth, personal = owner only
CREATE POLICY "songs_delete"
  ON songs FOR DELETE TO authenticated
  USING (
    category IN ('tgt_cover', 'tgt_original')
    OR created_by = auth.uid()
  );

-- ─── RLS: song_stems (replace all 3 policies) ───

DROP POLICY IF EXISTS "Authenticated users can view stems" ON song_stems;
DROP POLICY IF EXISTS "Authenticated users can insert stems" ON song_stems;
DROP POLICY IF EXISTS "Authenticated users can delete stems" ON song_stems;

-- SELECT: follows song visibility
CREATE POLICY "song_stems_select"
  ON song_stems FOR SELECT TO authenticated
  USING (can_access_song(song_id));

-- INSERT: must be own stem + can access song
CREATE POLICY "song_stems_insert"
  ON song_stems FOR INSERT TO authenticated
  WITH CHECK (
    (created_by IS NULL OR created_by = auth.uid())
    AND can_access_song(song_id)
  );

-- UPDATE: own stems OR song owner (for is_best_take management)
CREATE POLICY "song_stems_update"
  ON song_stems FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM songs WHERE id = song_id AND songs.created_by = auth.uid()
    )
  );

-- DELETE: own stems OR song owner
CREATE POLICY "song_stems_delete"
  ON song_stems FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM songs WHERE id = song_id AND songs.created_by = auth.uid()
    )
  );

-- ─── RLS: beat_maps (replace all 4 policies) ───

DROP POLICY IF EXISTS "Authenticated users can view beat maps" ON beat_maps;
DROP POLICY IF EXISTS "Authenticated users can insert beat maps" ON beat_maps;
DROP POLICY IF EXISTS "Authenticated users can update beat maps" ON beat_maps;
DROP POLICY IF EXISTS "Authenticated users can delete beat maps" ON beat_maps;

-- SELECT: follows song visibility
CREATE POLICY "beat_maps_select"
  ON beat_maps FOR SELECT TO authenticated
  USING (can_access_song(song_id));

-- INSERT/UPDATE: any auth (Cloud Run uses service role anyway)
CREATE POLICY "beat_maps_insert"
  ON beat_maps FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "beat_maps_update"
  ON beat_maps FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- DELETE: follows song visibility
CREATE POLICY "beat_maps_delete"
  ON beat_maps FOR DELETE TO authenticated
  USING (can_access_song(song_id));
