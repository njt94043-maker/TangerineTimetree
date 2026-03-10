"""SQLite database connection and CRUD operations."""

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from config import DB_PATH
from db.models import SCHEMA_SQL


def init_db():
    """Create tables if they don't exist, then run migrations."""
    with get_conn() as conn:
        conn.executescript(SCHEMA_SQL)
        _migrate(conn)


def _migrate(conn):
    """Run schema migrations for existing databases."""
    # S43: Add category column (Song category for TGT import — D-154)
    cols = {row[1] for row in conn.execute("PRAGMA table_info(tracks)").fetchall()}
    if "category" not in cols:
        conn.execute("ALTER TABLE tracks ADD COLUMN category TEXT NOT NULL DEFAULT ''")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_tracks_category ON tracks(category)")


@contextmanager
def get_conn():
    """Yield a sqlite3 connection with row_factory and WAL mode."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def new_id() -> str:
    return str(uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- capture_sessions ----------

def create_session(source_type: str, source_url: str = "", tab_title: str = "") -> dict:
    session_id = new_id()
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO capture_sessions (id, started_at, source_type, source_url, tab_title)
               VALUES (?, ?, ?, ?, ?)""",
            (session_id, now_iso(), source_type, source_url, tab_title),
        )
    return {"id": session_id}


def update_session(session_id: str, **fields):
    if not fields:
        return
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [session_id]
    with get_conn() as conn:
        conn.execute(
            f"UPDATE capture_sessions SET {set_clause} WHERE id = ?", values
        )


def get_session(session_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM capture_sessions WHERE id = ?", (session_id,)
        ).fetchone()
    return dict(row) if row else None


# ---------- tracks ----------

def insert_track(track: dict) -> str:
    track_id = track.get("id", new_id())
    track["id"] = track_id
    track.setdefault("capture_date", now_iso())
    track.setdefault("created_at", now_iso())
    track.setdefault("updated_at", now_iso())
    cols = ", ".join(track.keys())
    placeholders = ", ".join("?" for _ in track)
    with get_conn() as conn:
        conn.execute(
            f"INSERT INTO tracks ({cols}) VALUES ({placeholders})",
            list(track.values()),
        )
    return track_id


def get_track(track_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM tracks WHERE id = ?", (track_id,)).fetchone()
        if not row:
            return None
        track = dict(row)
        tags = conn.execute(
            """SELECT t.id, t.name, t.color FROM tags t
               JOIN track_tags tt ON t.id = tt.tag_id
               WHERE tt.track_id = ?""",
            (track_id,),
        ).fetchall()
        track["tags"] = [dict(t) for t in tags]
    return track


def list_tracks(
    search: str = "",
    artist: str = "",
    genre: str = "",
    category: str = "",
    practice_category: str = "",
    instrument_focus: str = "",
    tag: str = "",
    favorite: bool | None = None,
    sort_by: str = "capture_date",
    sort_dir: str = "desc",
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    conditions: list[str] = []
    params: list[Any] = []

    if search:
        conditions.append("(title LIKE ? OR artist LIKE ? OR album LIKE ? OR personal_notes LIKE ?)")
        q = f"%{search}%"
        params.extend([q, q, q, q])
    if artist:
        conditions.append("artist LIKE ?")
        params.append(f"%{artist}%")
    if genre:
        conditions.append("genre = ?")
        params.append(genre)
    if category:
        conditions.append("category = ?")
        params.append(category)
    if practice_category:
        conditions.append("practice_category = ?")
        params.append(practice_category)
    if instrument_focus:
        conditions.append("instrument_focus = ?")
        params.append(instrument_focus)
    if favorite is not None:
        conditions.append("favorite = ?")
        params.append(1 if favorite else 0)
    if tag:
        conditions.append("id IN (SELECT track_id FROM track_tags JOIN tags ON tags.id = tag_id WHERE tags.name = ?)")
        params.append(tag)

    where = "WHERE " + " AND ".join(conditions) if conditions else ""

    allowed_sorts = {"capture_date", "title", "artist", "bpm", "play_count", "duration_seconds", "created_at"}
    if sort_by not in allowed_sorts:
        sort_by = "capture_date"
    if sort_dir.lower() not in ("asc", "desc"):
        sort_dir = "desc"

    params.extend([limit, offset])

    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT * FROM tracks {where} ORDER BY {sort_by} {sort_dir} LIMIT ? OFFSET ?",
            params,
        ).fetchall()
    return [dict(r) for r in rows]


def update_track(track_id: str, **fields):
    if not fields:
        return
    fields["updated_at"] = now_iso()
    set_clause = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [track_id]
    with get_conn() as conn:
        conn.execute(f"UPDATE tracks SET {set_clause} WHERE id = ?", values)


def delete_track(track_id: str):
    with get_conn() as conn:
        # Clear FK references from capture_sessions first
        conn.execute("UPDATE capture_sessions SET track_id = NULL WHERE track_id = ?", (track_id,))
        conn.execute("DELETE FROM track_tags WHERE track_id = ?", (track_id,))
        conn.execute("DELETE FROM tracks WHERE id = ?", (track_id,))


def increment_play_count(track_id: str):
    with get_conn() as conn:
        conn.execute(
            "UPDATE tracks SET play_count = play_count + 1, last_played_at = ? WHERE id = ?",
            (now_iso(), track_id),
        )


# ---------- tags ----------

def list_tags() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT t.*, COUNT(tt.track_id) as usage_count
               FROM tags t LEFT JOIN track_tags tt ON t.id = tt.tag_id
               GROUP BY t.id ORDER BY t.name"""
        ).fetchall()
    return [dict(r) for r in rows]


def create_tag(name: str, color: str = "#f39c12") -> dict:
    tag_id = new_id()
    with get_conn() as conn:
        conn.execute("INSERT INTO tags (id, name, color) VALUES (?, ?, ?)", (tag_id, name, color))
    return {"id": tag_id, "name": name, "color": color}


def delete_tag(tag_id: str):
    with get_conn() as conn:
        conn.execute("DELETE FROM tags WHERE id = ?", (tag_id,))


def add_tag_to_track(track_id: str, tag_id: str):
    with get_conn() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO track_tags (track_id, tag_id) VALUES (?, ?)",
            (track_id, tag_id),
        )


def remove_tag_from_track(track_id: str, tag_id: str):
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM track_tags WHERE track_id = ? AND tag_id = ?",
            (track_id, tag_id),
        )


# ---------- stats ----------

def get_stats() -> dict:
    with get_conn() as conn:
        total = conn.execute("SELECT COUNT(*) FROM tracks").fetchone()[0]
        total_duration = conn.execute("SELECT COALESCE(SUM(duration_seconds), 0) FROM tracks").fetchone()[0]
        top_artists = conn.execute(
            "SELECT artist, COUNT(*) as cnt FROM tracks WHERE artist != '' GROUP BY artist ORDER BY cnt DESC LIMIT 10"
        ).fetchall()
        recent = conn.execute(
            "SELECT id, title, artist, capture_date FROM tracks ORDER BY capture_date DESC LIMIT 5"
        ).fetchall()
        categories = conn.execute(
            "SELECT practice_category, COUNT(*) as cnt FROM tracks WHERE practice_category != '' GROUP BY practice_category"
        ).fetchall()
    return {
        "total_tracks": total,
        "total_duration_seconds": total_duration,
        "top_artists": [dict(r) for r in top_artists],
        "recent_captures": [dict(r) for r in recent],
        "category_breakdown": [dict(r) for r in categories],
    }
