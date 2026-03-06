import { useState, useEffect } from 'react';
import { getSongs, searchSongs, deleteSong } from '@shared/supabase/queries';
import type { Song } from '@shared/supabase/types';
import { ErrorAlert } from './ErrorAlert';
import { ConfirmModal } from './ConfirmModal';

interface SongListProps {
  onClose: () => void;
  onNewSong: () => void;
  onEditSong: (id: string) => void;
}

export function SongList({ onClose, onNewSong, onEditSong }: SongListProps) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Song | null>(null);

  async function loadSongs() {
    try {
      const list = search.trim() ? await searchSongs(search.trim()) : await getSongs();
      setSongs(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load songs');
    }
  }

  useEffect(() => { loadSongs(); }, [search]);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteSong(deleteTarget.id);
      setDeleteTarget(null);
      await loadSongs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setDeleteTarget(null);
    }
  }

  function formatTimeSig(song: Song) {
    return `${song.time_signature_top}/${song.time_signature_bottom}`;
  }

  function formatDuration(seconds: number | null) {
    if (!seconds) return null;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 className="page-title">Songs</h2>
        <div className="page-header-spacer" />
      </div>

      <div className="neu-inset" style={{ marginBottom: 8 }}>
        <input
          className="input-field"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search songs..."
        />
      </div>

      <button className="btn btn-primary btn-small btn-full" onClick={onNewSong} style={{ marginBottom: 12 }}>
        + Add Song
      </button>

      {error && <ErrorAlert message={error} compact />}

      <div className="song-list-items">
        {songs.map(song => (
          <div key={song.id} className="song-card neu-card">
            <div className="song-card-info" onClick={() => onEditSong(song.id)} style={{ cursor: 'pointer' }}>
              <span className="song-card-name">{song.name}</span>
              {song.artist && <span className="song-card-artist">{song.artist}</span>}
              <div className="song-card-meta">
                <span className="song-meta-tag">{song.bpm} BPM</span>
                <span className="song-meta-tag">{formatTimeSig(song)}</span>
                {song.key && <span className="song-meta-tag">Key: {song.key}</span>}
                {song.duration_seconds && <span className="song-meta-tag">{formatDuration(song.duration_seconds)}</span>}
              </div>
            </div>
            <div className="song-card-actions">
              <button className="btn btn-small btn-tangerine" onClick={() => onEditSong(song.id)}>Edit</button>
              <button className="btn btn-small btn-danger" onClick={() => setDeleteTarget(song)}>Del</button>
            </div>
          </div>
        ))}
        {songs.length === 0 && (
          <p className="empty-text">{search ? 'No matching songs' : 'No songs yet'}</p>
        )}
      </div>

      {deleteTarget && (
        <ConfirmModal
          message={`Delete "${deleteTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}
    </div>
  );
}
