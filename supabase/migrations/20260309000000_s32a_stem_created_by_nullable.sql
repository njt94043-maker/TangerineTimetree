-- S32A: Make created_by nullable on song_stems for server-generated stems.
-- Auto stems from Demucs have no user context (created by Cloud Run service).
ALTER TABLE song_stems ALTER COLUMN created_by DROP NOT NULL;
