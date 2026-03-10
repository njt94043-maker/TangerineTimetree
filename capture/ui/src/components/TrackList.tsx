import { useState, useEffect, useCallback } from 'react';
import { getTracks, updateTrack } from '../api';
import { TrackCard } from './TrackCard';
import type { Track } from '../types';

interface Props {
  onSelect: (id: string) => void;
}

export function TrackList({ onSelect }: Props) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (category) params.category = category;
      const data = await getTracks(params);
      setTracks(data);
    } catch {
      // Backend may be offline
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  const toggleFavorite = async (track: Track) => {
    const newFav = track.favorite ? 0 : 1;
    await updateTrack(track.id, { favorite: newFav });
    setTracks(ts => ts.map(t => t.id === track.id ? { ...t, favorite: newFav } : t));
  };

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <h2 className="page-title">Library</h2>
        <div className="page-header-spacer" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div className="neu-inset" style={{ flex: 1 }}>
          <input
            className="input-field"
            placeholder="Search tracks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="neu-inset" style={{ minWidth: 140 }}>
          <select
            className="input-field"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {['tgt_cover', 'tgt_original', 'personal_cover', 'personal_original'].map(o =>
              <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
            )}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="empty-text">Loading...</p>
      ) : tracks.length === 0 ? (
        <p className="empty-text">
          {search ? 'No matching tracks' : 'No tracks yet — capture audio to build your library'}
        </p>
      ) : (
        <div className="track-list-items">
          {tracks.map(track => (
            <TrackCard
              key={track.id}
              track={track}
              onClick={() => onSelect(track.id)}
              onToggleFavorite={() => toggleFavorite(track)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
