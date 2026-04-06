-- Session 36: Add performance tags and bucket ordering for TGT cover master list
-- These fields only apply to tgt_cover songs (enforced at app level, not DB constraint)

ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS performance_tag TEXT,
  ADD COLUMN IF NOT EXISTS set_bucket TEXT,
  ADD COLUMN IF NOT EXISTS bucket_position INTEGER;
