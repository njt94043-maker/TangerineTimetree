import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSongs, searchSongs, deleteSong, getSetlists, createSetlist, deleteSetlist, createSong } from '@shared/supabase/queries';
import type { Song, Setlist, SongCategory, SetlistType, Profile } from '@shared/supabase/types';
import { isPersonalSong, isTgtSong } from '@shared/supabase/types';
import { ErrorAlert } from './ErrorAlert';
import { ConfirmModal } from './ConfirmModal';
import { ImportPanel } from './ImportPanel';

type Tab = 'songs' | 'setlists';
type ScopeFilter = 'all' | 'tgt' | 'mine' | 'shared';
type TypeFilter = 'all' | 'covers' | 'originals';
type SetlistFilter = 'all' | SetlistType;

interface LibraryProps {
  onNewSong: () => void;
  onEditSong: (id: string) => void;
  onSetlistPress: (id: string) => void;
  onPlaySong: (songId: string, mode: 'live' | 'practice' | 'view') => void;
  onPlaySetlist: (setlistId: string, mode: 'live' | 'practice' | 'view') => void;
  userId: string;
  profiles: Profile[];
}

const SETLIST_FILTERS: { value: SetlistFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tange', label: 'TGT' },
  { value: 'other_band', label: 'Other' },
];

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTimeSig(top: number, bottom: number): string {
  return `${top}/${bottom}`;
}


export function Library({ onNewSong, onEditSong, onSetlistPress, onPlaySong, onPlaySetlist, userId, profiles }: LibraryProps) {
  const [tab, setTab] = useState<Tab>('songs');
  const [error, setError] = useState('');
  const [showImport, setShowImport] = useState(false);

  // Songs state
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [sharedSongIds, setSharedSongIds] = useState<Set<string>>(new Set());
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [deleteSongTarget, setDeleteSongTarget] = useState<Song | null>(null);
  const [expandedSongId, setExpandedSongId] = useState<string | null>(null);

  // Setlists state
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [setlistFilter, setSetlistFilter] = useState<SetlistFilter>('all');
  const [deleteSetlistTarget, setDeleteSetlistTarget] = useState<Setlist | null>(null);
  const [expandedSetlistId, setExpandedSetlistId] = useState<string | null>(null);

  // New setlist modal
  const [showNewSetlist, setShowNewSetlist] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<SetlistType>('tange');
  const [newBandName, setNewBandName] = useState('The Green Tangerine');
  const [saving, setSaving] = useState(false);

  // Profile lookup helper
  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    profiles.forEach(p => map.set(p.id, p.name));
    return map;
  }, [profiles]);

  const loadSongs = useCallback(async () => {
    try {
      const list = search.trim() ? await searchSongs(search.trim()) : await getSongs();
      setAllSongs(list);

      // Load shared song IDs for "Shared With Me" filter
      // personal_original songs shared with current user
      const sharedIds = new Set<string>();
      for (const song of list) {
        if (song.category === 'personal_original' && song.owner_id && song.owner_id !== userId) {
          sharedIds.add(song.id);
        }
      }
      setSharedSongIds(sharedIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load songs');
    }
  }, [search, userId]);

  const loadSetlists = useCallback(async () => {
    try {
      const list = await getSetlists();
      const filtered = setlistFilter === 'all' ? list : list.filter(s => s.setlist_type === setlistFilter);
      setSetlists(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load setlists');
    }
  }, [setlistFilter]);

  // Client-side filtering: scope + type + search
  const songs = useMemo(() => {
    return allSongs.filter(song => {
      // Scope filter
      if (scopeFilter === 'tgt' && !isTgtSong(song.category)) return false;
      if (scopeFilter === 'mine' && song.owner_id !== userId) return false;
      if (scopeFilter === 'shared' && !sharedSongIds.has(song.id)) return false;
      // Type filter
      if (typeFilter === 'covers' && song.category !== 'tgt_cover' && song.category !== 'personal_cover') return false;
      if (typeFilter === 'originals' && song.category !== 'tgt_original' && song.category !== 'personal_original') return false;
      return true;
    });
  }, [allSongs, scopeFilter, typeFilter, sharedSongIds, userId]);

  /** Can the current user edit/delete this song? */
  function canEditSong(song: Song): boolean {
    if (isTgtSong(song.category)) return true; // All members edit TGT songs
    return song.owner_id === userId; // Personal songs: owner only
  }

  useEffect(() => { if (tab === 'songs') loadSongs(); }, [tab, loadSongs]);
  useEffect(() => { if (tab === 'setlists') loadSetlists(); }, [tab, loadSetlists]);

  async function handleDeleteSong() {
    if (!deleteSongTarget) return;
    try {
      await deleteSong(deleteSongTarget.id);
      setDeleteSongTarget(null);
      await loadSongs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setDeleteSongTarget(null);
    }
  }

  async function handleDeleteSetlist() {
    if (!deleteSetlistTarget) return;
    try {
      await deleteSetlist(deleteSetlistTarget.id);
      setDeleteSetlistTarget(null);
      await loadSetlists();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setDeleteSetlistTarget(null);
    }
  }

  async function handleCreateSetlist() {
    if (!newName.trim()) { setError('Setlist name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const created = await createSetlist({
        name: newName.trim(),
        description: newDesc.trim(),
        setlist_type: newType,
        band_name: newType === 'other_band' ? newBandName.trim() : 'The Green Tangerine',
      });
      setShowNewSetlist(false);
      setNewName('');
      setNewDesc('');
      setNewType('tange');
      setNewBandName('The Green Tangerine');
      onSetlistPress(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="form-wrap form-top">
      {/* Tab bar */}
      <div className="library-tabs">
        <button
          className={`library-tab songs-tab ${tab === 'songs' ? 'active' : ''}`}
          onClick={() => setTab('songs')}
        >
          Songs
        </button>
        <button
          className={`library-tab setlists-tab ${tab === 'setlists' ? 'active' : ''}`}
          onClick={() => setTab('setlists')}
        >
          Setlists
        </button>
      </div>

      {error && <ErrorAlert message={error} compact />}

      {/* ─── Songs Tab ─── */}
      {tab === 'songs' && (
        <>
          {/* Search + filter dropdowns with labels */}
          <div className="library-filter-bar">
            <div className="neu-inset" style={{ flex: 1 }}>
              <input
                className="input-field"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search songs..."
              />
            </div>
            <div className="library-filter-group">
              <label className="library-filter-label">Scope</label>
              <div className="neu-inset library-dropdown">
                <select className="input-field" value={scopeFilter} onChange={e => setScopeFilter(e.target.value as ScopeFilter)}>
                  <option value="all">All Songs</option>
                  <option value="tgt">TGT</option>
                  <option value="mine">My Songs</option>
                  <option value="shared">Shared With Me</option>
                </select>
              </div>
            </div>
            <div className="library-filter-group">
              <label className="library-filter-label">Type</label>
              <div className="neu-inset library-dropdown">
                <select className="input-field" value={typeFilter} onChange={e => setTypeFilter(e.target.value as TypeFilter)}>
                  <option value="all">All Types</option>
                  <option value="covers">Covers</option>
                  <option value="originals">Originals</option>
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span className="song-count">{songs.length} song{songs.length !== 1 ? 's' : ''}</span>
            <span style={{ flex: 1 }} />
            <button className="lib-action-btn" onClick={onNewSong} style={{ '--btn-accent': 'var(--color-green)' } as React.CSSProperties}>
              + New Song
            </button>
            <button
              className="lib-action-btn"
              style={{ '--btn-accent': '#ff4646' } as React.CSSProperties}
              onClick={async () => {
                const name = prompt('Name your song idea:');
                if (!name?.trim()) return;
                try {
                  const song = await createSong({ name: name.trim(), category: 'personal_original' });
                  onPlaySong(song.id, 'practice');
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : 'Failed to create song');
                }
              }}
            >New Idea</button>
            <button className="lib-action-btn" onClick={() => setShowImport(true)} style={{ '--btn-accent': 'var(--color-teal)' } as React.CSSProperties}>
              Import
            </button>
          </div>

          <div className="song-list-items">
            {songs.map(song => {
              const editable = canEditSong(song);
              const ownerName = isPersonalSong(song.category) && song.owner_id ? profileMap.get(song.owner_id) : null;
              const isShared = sharedSongIds.has(song.id);
              const expanded = expandedSongId === song.id;
              const isTgt = isTgtSong(song.category);
              const dur = formatDuration(song.duration_seconds);

              return (
                <div
                  key={song.id}
                  className={`song-card neu-card${expanded ? ' expanded' : ''}`}
                  onClick={() => setExpandedSongId(expanded ? null : song.id)}
                >
                  <div className="song-card-body">
                    {/* Left accent border */}
                    <div className={`song-card-accent ${isTgt ? 'tgt' : 'personal'}`} />

                    {/* Info column */}
                    <div className="song-card-info">
                      <div className="song-card-title-row">
                        <span className="song-card-name">{song.name}</span>
                        {!editable && <span className="song-lock-icon" title="Read-only">{'\uD83D\uDD12'}</span>}
                      </div>
                      {song.artist && <span className="song-card-artist">{song.artist}</span>}
                      <div className="song-card-meta">
                        <SongCategoryBadge category={song.category} />
                        {ownerName && <span className="song-owner-tag">{ownerName}</span>}
                        {isShared && <span className="song-meta-tag badge-shared">Shared</span>}
                        {song.key && <span className="song-meta-tag badge-tgt">{song.key}</span>}
                        <span className="song-meta-tag">{formatTimeSig(song.time_signature_top, song.time_signature_bottom)}</span>
                        {dur && <span className="song-meta-tag">{dur}</span>}
                        {song.audio_url && <span className="song-meta-tag badge-track">TRACK</span>}
                      </div>
                    </div>

                    {/* BPM right-aligned */}
                    <div className="song-card-bpm">
                      <span className="song-card-bpm-val">{Math.round(song.bpm)}</span>
                      <span className="song-card-bpm-unit">BPM</span>
                    </div>
                  </div>

                  {/* Expanded: launch buttons */}
                  {expanded && (
                    <div className="song-card-expanded">
                      <div className="song-card-launch">
                        <button className="lib-launch-btn live" onClick={e => { e.stopPropagation(); onPlaySong(song.id, 'live'); }}>
                          <span className="lib-launch-icon">&#9654;</span> Live
                        </button>
                        <button className="lib-launch-btn practice" onClick={e => { e.stopPropagation(); onPlaySong(song.id, 'practice'); }}>
                          <span className="lib-launch-icon">&#127911;</span> Practice
                        </button>
                        <button className="lib-launch-btn view" onClick={e => { e.stopPropagation(); onPlaySong(song.id, 'view'); }}>
                          <span className="lib-launch-icon">&#127909;</span> View
                        </button>
                      </div>
                      {editable && (
                        <button className="lib-launch-btn edit" onClick={e => { e.stopPropagation(); onEditSong(song.id); }}>
                          <span className="lib-launch-icon">&#9998;</span> Edit Song
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {songs.length === 0 && (
              <p className="empty-text">{search ? 'No matching songs' : 'No songs yet'}</p>
            )}
          </div>
        </>
      )}

      {/* ─── Setlists Tab ─── */}
      {tab === 'setlists' && (
        <>
          {/* Filter dropdown (D-128) */}
          <div className="library-filter-bar">
            <div className="neu-inset library-dropdown">
              <select className="input-field" value={setlistFilter} onChange={e => setSetlistFilter(e.target.value as SetlistFilter)}>
                {SETLIST_FILTERS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span className="song-count">{setlists.length} setlist{setlists.length !== 1 ? 's' : ''}</span>
            <span style={{ flex: 1 }} />
            <button
              className="btn-icon"
              title="New Setlist"
              onClick={() => { setNewName(''); setNewDesc(''); setNewType('tange'); setNewBandName('The Green Tangerine'); setShowNewSetlist(true); }}
              style={{ color: 'var(--color-green)', borderColor: 'rgba(0,230,118,0.3)' }}
            >+</button>
          </div>

          <div className="setlist-list-items">
            {setlists.map(sl => {
              const expanded = expandedSetlistId === sl.id;
              return (
                <div
                  key={sl.id}
                  className={`setlist-card neu-card${expanded ? ' expanded' : ''}`}
                  onClick={() => setExpandedSetlistId(expanded ? null : sl.id)}
                >
                  <div className="setlist-card-body">
                    {/* Left accent border (orange) */}
                    <div className="song-card-accent personal" />

                    <div className="setlist-card-info">
                      <span className="setlist-card-name">{sl.name}</span>
                      <div className="setlist-card-meta">
                        <span className={`song-meta-tag ${sl.setlist_type === 'tange' ? 'badge-tgt' : 'badge-personal'}`}>
                          {sl.setlist_type === 'tange' ? 'TGT' : sl.band_name}
                        </span>
                        {sl.description && (
                          <span className="setlist-card-desc">{sl.description}</span>
                        )}
                      </div>
                    </div>

                    {/* Expand chevron */}
                    <span className="setlist-card-chevron">{expanded ? '\u25B2' : '\u25BC'}</span>
                  </div>

                  {/* Expanded: launch buttons */}
                  {expanded && (
                    <div className="song-card-expanded">
                      <div className="song-card-launch">
                        <button className="lib-launch-btn live" onClick={e => { e.stopPropagation(); onPlaySetlist(sl.id, 'live'); }}>
                          <span className="lib-launch-icon">&#9654;</span> Live
                        </button>
                        <button className="lib-launch-btn practice" onClick={e => { e.stopPropagation(); onPlaySetlist(sl.id, 'practice'); }}>
                          <span className="lib-launch-icon">&#127911;</span> Practice
                        </button>
                        <button className="lib-launch-btn view" onClick={e => { e.stopPropagation(); onPlaySetlist(sl.id, 'view'); }}>
                          <span className="lib-launch-icon">&#127909;</span> View
                        </button>
                      </div>
                      <button className="lib-launch-btn edit" onClick={e => { e.stopPropagation(); onSetlistPress(sl.id); }}>
                        <span className="lib-launch-icon">&#9998;</span> Edit Setlist
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {setlists.length === 0 && (
              <p className="empty-text">No setlists yet</p>
            )}
          </div>
        </>
      )}

      {/* New Setlist Modal */}
      {showNewSetlist && (
        <div className="overlay" onClick={() => setShowNewSetlist(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">New Setlist</h3>

            <label className="label">SETLIST NAME *</label>
            <div className="neu-inset">
              <input className="input-field" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Friday Night Set" />
            </div>

            <label className="label">DESCRIPTION</label>
            <div className="neu-inset">
              <input className="input-field" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional" />
            </div>

            <label className="label">TYPE</label>
            <div className="neu-inset">
              <select className="input-field" value={newType} onChange={e => { setNewType(e.target.value as SetlistType); if (e.target.value === 'tange') setNewBandName('The Green Tangerine'); }}>
                <option value="tange">The Green Tangerine</option>
                <option value="other_band">Other Band</option>
              </select>
            </div>

            {newType === 'other_band' && (
              <>
                <label className="label">BAND NAME</label>
                <div className="neu-inset">
                  <input className="input-field" value={newBandName} onChange={e => setNewBandName(e.target.value)} placeholder="e.g. My Other Project" />
                </div>
              </>
            )}

            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleCreateSetlist} disabled={saving}>
                {saving ? 'Creating...' : 'Create'}
              </button>
              <button className="btn btn-outline" onClick={() => setShowNewSetlist(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmations */}
      {deleteSongTarget && (
        <ConfirmModal
          message={`Delete "${deleteSongTarget.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDeleteSong}
          onCancel={() => setDeleteSongTarget(null)}
          danger
        />
      )}

      {deleteSetlistTarget && (
        <ConfirmModal
          message={`Delete "${deleteSetlistTarget.name}"? All songs in this setlist will be unlinked.`}
          confirmLabel="Delete"
          onConfirm={handleDeleteSetlist}
          onCancel={() => setDeleteSetlistTarget(null)}
          danger
        />
      )}

      {showImport && (
        <ImportPanel
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); loadSongs(); }}
        />
      )}
    </div>
  );
}

/** Separate scope + type badges */
function SongCategoryBadge({ category }: { category: SongCategory }) {
  const isTgt = category === 'tgt_cover' || category === 'tgt_original';
  const isCover = category === 'tgt_cover' || category === 'personal_cover';
  return (
    <>
      <span className={`song-meta-tag ${isTgt ? 'badge-tgt' : 'badge-personal'}`}>
        {isTgt ? 'TGT' : 'Personal'}
      </span>
      <span className={`song-meta-tag ${isCover ? 'badge-cover' : 'badge-original'}`}>
        {isCover ? 'Cover' : 'Original'}
      </span>
    </>
  );
}
