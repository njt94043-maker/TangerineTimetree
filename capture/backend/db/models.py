"""SQLite schema and model definitions."""

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS tracks (
    id                TEXT PRIMARY KEY,
    title             TEXT NOT NULL DEFAULT 'Untitled',
    artist            TEXT NOT NULL DEFAULT '',
    album             TEXT NOT NULL DEFAULT '',
    genre             TEXT NOT NULL DEFAULT '',

    -- Source
    source_url        TEXT NOT NULL DEFAULT '',
    source_type       TEXT NOT NULL DEFAULT 'tab',
    capture_date      TEXT NOT NULL,

    -- Audio properties
    duration_seconds  REAL,
    bpm               REAL,
    key               TEXT NOT NULL DEFAULT '',
    sample_rate       INTEGER NOT NULL DEFAULT 44100,
    bitrate           INTEGER NOT NULL DEFAULT 320,
    encoding          TEXT NOT NULL DEFAULT 'mp3',

    -- Song category (for TGT import: tgt_cover, tgt_original, personal_cover, personal_original)
    category          TEXT NOT NULL DEFAULT '',

    -- Practice metadata (for future ClickTrack import)
    instrument_focus  TEXT NOT NULL DEFAULT '',
    difficulty        TEXT NOT NULL DEFAULT '',
    practice_category TEXT NOT NULL DEFAULT '',
    personal_notes    TEXT NOT NULL DEFAULT '',

    -- Associations (optional FK to Supabase UUIDs)
    setlist_id        TEXT,
    song_id           TEXT,

    -- File paths (relative to storage root)
    file_path         TEXT NOT NULL,
    waveform_path     TEXT NOT NULL DEFAULT '',
    thumbnail_path    TEXT NOT NULL DEFAULT '',
    file_size_bytes   INTEGER NOT NULL DEFAULT 0,

    -- Usage
    play_count        INTEGER NOT NULL DEFAULT 0,
    last_played_at    TEXT,
    favorite          INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
    id    TEXT PRIMARY KEY,
    name  TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#f39c12'
);

CREATE TABLE IF NOT EXISTS track_tags (
    track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    tag_id   TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (track_id, tag_id)
);

CREATE TABLE IF NOT EXISTS capture_sessions (
    id             TEXT PRIMARY KEY,
    started_at     TEXT NOT NULL,
    ended_at       TEXT,
    source_type    TEXT NOT NULL,
    source_url     TEXT NOT NULL DEFAULT '',
    tab_title      TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'recording',
    track_id       TEXT REFERENCES tracks(id),
    error_message  TEXT NOT NULL DEFAULT '',
    raw_file_path  TEXT NOT NULL DEFAULT '',
    paused         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
CREATE INDEX IF NOT EXISTS idx_tracks_capture_date ON tracks(capture_date);
CREATE INDEX IF NOT EXISTS idx_tracks_bpm ON tracks(bpm);
CREATE INDEX IF NOT EXISTS idx_tracks_category ON tracks(category);
CREATE INDEX IF NOT EXISTS idx_tracks_practice_category ON tracks(practice_category);
CREATE INDEX IF NOT EXISTS idx_tracks_favorite ON tracks(favorite);
CREATE INDEX IF NOT EXISTS idx_tracks_song_id ON tracks(song_id);
"""
