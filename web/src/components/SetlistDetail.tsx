import { useState, useEffect } from 'react';
import {
  getSetlistWithSongs, updateSetlist, getSongs, setSetlistSongs,
  removeSongFromSetlist,
} from '@shared/supabase/queries';
import type { SetlistWithSongs, SetlistSongWithDetails, Song } from '@shared/supabase/types';
import { getSetlistHtml } from '@shared/templates';
import { ErrorAlert } from './ErrorAlert';
import { ConfirmModal } from './ConfirmModal';

interface SetlistDetailProps {
  setlistId: string;
  onClose: () => void;
}

export function SetlistDetail({ setlistId, onClose }: SetlistDetailProps) {
  const [setlist, setSetlist] = useState<SetlistWithSongs | null>(null);
  const [error, setError] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  // Add song picker
  const [showAddSong, setShowAddSong] = useState(false);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [songSearch, setSongSearch] = useState('');

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Remove confirmation
  const [removeTarget, setRemoveTarget] = useState<SetlistSongWithDetails | null>(null);

  async function load() {
    try {
      const data = await getSetlistWithSongs(setlistId);
      if (!data) { setError('Setlist not found'); return; }
      setSetlist(data);
      setName(data.name);
      setDescription(data.description);
      setNotes(data.notes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    }
  }

  useEffect(() => { load(); }, [setlistId]);

  async function handleSaveMeta() {
    if (!name.trim()) { setError('Name is required'); return; }
    try {
      await updateSetlist(setlistId, { name: name.trim(), description: description.trim(), notes: notes.trim() });
      setEditingName(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  async function handleAddSong(song: Song) {
    if (!setlist) return;
    const newPosition = setlist.songs.length;
    const newSongs = [
      ...setlist.songs.map((s, i) => ({ song_id: s.song_id, position: i, notes: s.notes })),
      { song_id: song.id, position: newPosition, notes: '' },
    ];
    try {
      await setSetlistSongs(setlistId, newSongs);
      setShowAddSong(false);
      setSongSearch('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add song');
    }
  }

  async function handleRemoveSong() {
    if (!removeTarget) return;
    try {
      await removeSongFromSetlist(setlistId, removeTarget.id);
      setRemoveTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
      setRemoveTarget(null);
    }
  }

  async function handleReorder(fromIdx: number, toIdx: number) {
    if (!setlist || fromIdx === toIdx) return;
    const songs = [...setlist.songs];
    const [moved] = songs.splice(fromIdx, 1);
    songs.splice(toIdx, 0, moved);
    const reordered = songs.map((s, i) => ({ song_id: s.song_id, position: i, notes: s.notes }));
    // Optimistic update
    setSetlist({ ...setlist, songs: songs.map((s, i) => ({ ...s, position: i })), song_count: songs.length });
    try {
      await setSetlistSongs(setlistId, reordered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder');
      await load();
    }
  }

  function onDragStart(idx: number) {
    setDragIdx(idx);
  }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }

  function onDrop(idx: number) {
    if (dragIdx !== null && dragIdx !== idx) {
      handleReorder(dragIdx, idx);
    }
    setDragIdx(null);
    setDragOverIdx(null);
  }

  function onDragEnd() {
    setDragIdx(null);
    setDragOverIdx(null);
  }

  // Move with buttons (for mobile)
  function moveUp(idx: number) {
    if (idx > 0) handleReorder(idx, idx - 1);
  }

  function moveDown(idx: number) {
    if (setlist && idx < setlist.songs.length - 1) handleReorder(idx, idx + 1);
  }

  function formatDuration(seconds: number | null) {
    if (!seconds) return null;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function formatTotalDuration(seconds: number | null) {
    if (!seconds) return null;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  async function openAddSong() {
    setShowAddSong(true);
    setSongSearch('');
    try {
      setAllSongs(await getSongs());
    } catch { /* ignore */ }
  }

  const filteredSongs = allSongs.filter(s => {
    if (!songSearch.trim()) return true;
    const q = songSearch.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q);
  });

  // Exclude songs already in setlist
  const existingSongIds = new Set(setlist?.songs.map(s => s.song_id) ?? []);
  const availableSongs = filteredSongs.filter(s => !existingSongIds.has(s.id));

  function handleSharePdf() {
    if (!setlist) return;
    const html = getSetlistHtml({
      setlistName: setlist.name,
      description: setlist.description || undefined,
      songs: setlist.songs.map(s => ({
        position: s.position + 1,
        name: s.song_name,
        artist: s.song_artist,
        duration: formatDuration(s.song_duration_seconds),
      })),
      totalDuration: formatTotalDuration(setlist.total_duration_seconds),
      bandName: 'The Green Tangerine',
      contactEmail: 'bookings@thegreentangerine.com',
      website: 'www.thegreentangerine.com',
      generatedDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    });
    // Open in new window for print/save
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  if (!setlist) return <div className="form-wrap form-top"><p className="empty-text">Loading...</p></div>;

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 className="page-title">{setlist.name}</h2>
        <button className="btn btn-small btn-teal" onClick={handleSharePdf}>Share PDF</button>
      </div>

      {error && <ErrorAlert message={error} compact />}

      {/* Setlist info */}
      <div className="neu-card" style={{ marginBottom: 12 }}>
        {editingName ? (
          <>
            <label className="label">SETLIST NAME *</label>
            <div className="neu-inset">
              <input className="input-field" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <label className="label">DESCRIPTION</label>
            <div className="neu-inset">
              <input className="input-field" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional" />
            </div>
            <label className="label">NOTES</label>
            <div className="neu-inset">
              <textarea className="input-field input-textarea" value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
            <div className="form-actions" style={{ marginTop: 8 }}>
              <button className="btn btn-primary btn-small" onClick={handleSaveMeta}>Save</button>
              <button className="btn btn-outline btn-small" onClick={() => setEditingName(false)}>Cancel</button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              {setlist.description && <p style={{ color: 'var(--text-dim)', margin: '0 0 4px' }}>{setlist.description}</p>}
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.85rem' }}>
                {setlist.song_count} song{setlist.song_count !== 1 ? 's' : ''}
                {setlist.total_duration_seconds ? ` \u2022 ${formatTotalDuration(setlist.total_duration_seconds)}` : ''}
              </p>
            </div>
            <button className="btn btn-small btn-tangerine" onClick={() => setEditingName(true)}>Edit</button>
          </div>
        )}
      </div>

      {/* Song list with drag reorder */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ color: 'var(--text)', margin: 0, fontSize: '1rem' }}>Songs</h3>
        <button className="btn btn-primary btn-small" onClick={openAddSong}>+ Add Song</button>
      </div>

      <div className="setlist-songs">
        {setlist.songs.map((song, idx) => (
          <div
            key={song.id}
            className={`setlist-song-row neu-card ${dragOverIdx === idx ? 'drag-over' : ''} ${dragIdx === idx ? 'dragging' : ''}`}
            draggable
            onDragStart={() => onDragStart(idx)}
            onDragOver={(e) => onDragOver(e, idx)}
            onDrop={() => onDrop(idx)}
            onDragEnd={onDragEnd}
          >
            <span className="setlist-song-pos">{idx + 1}</span>
            <div className="setlist-song-info">
              <span className="setlist-song-name">{song.song_name}</span>
              <span className="setlist-song-meta">
                {song.song_artist && `${song.song_artist} \u2022 `}
                {song.song_bpm} BPM
                {song.song_duration_seconds ? ` \u2022 ${formatDuration(song.song_duration_seconds)}` : ''}
              </span>
            </div>
            <div className="setlist-song-controls">
              <button className="btn-icon" onClick={() => moveUp(idx)} disabled={idx === 0} title="Move up">{'\u25B2'}</button>
              <button className="btn-icon" onClick={() => moveDown(idx)} disabled={idx === setlist.songs.length - 1} title="Move down">{'\u25BC'}</button>
              <button className="btn-icon btn-icon-danger" onClick={() => setRemoveTarget(song)} title="Remove">{'\u2715'}</button>
            </div>
          </div>
        ))}
        {setlist.songs.length === 0 && (
          <p className="empty-text">No songs in this setlist. Add some!</p>
        )}
      </div>

      {/* Add Song Picker */}
      {showAddSong && (
        <div className="overlay" onClick={() => setShowAddSong(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Add Song to Setlist</h3>
            <div className="neu-inset" style={{ marginBottom: 8 }}>
              <input
                className="input-field"
                value={songSearch}
                onChange={e => setSongSearch(e.target.value)}
                placeholder="Search songs..."
                autoFocus
              />
            </div>
            <div className="song-picker-list">
              {availableSongs.map(song => (
                <div key={song.id} className="song-picker-item" onClick={() => handleAddSong(song)}>
                  <span className="song-picker-name">{song.name}</span>
                  <span className="song-picker-meta">{song.artist ? `${song.artist} \u2022 ` : ''}{song.bpm} BPM</span>
                </div>
              ))}
              {availableSongs.length === 0 && (
                <p className="empty-text">{allSongs.length === 0 ? 'No songs in library' : 'No matching songs'}</p>
              )}
            </div>
            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => setShowAddSong(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Song Confirmation */}
      {removeTarget && (
        <ConfirmModal
          message={`Remove "${removeTarget.song_name}" from this setlist?`}
          confirmLabel="Remove"
          onConfirm={handleRemoveSong}
          onCancel={() => setRemoveTarget(null)}
          danger
        />
      )}
    </div>
  );
}
