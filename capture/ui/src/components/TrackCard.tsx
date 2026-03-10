import type { Track } from '../types';
import { thumbnailUrl } from '../api';

interface Props {
  track: Track;
  onClick: () => void;
  onToggleFavorite: () => void;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return iso;
  }
}

export function TrackCard({ track, onClick, onToggleFavorite }: Props) {
  return (
    <div className="track-card neu-card" onClick={onClick}>
      {track.waveform_path && (
        <img
          className="waveform-mini"
          src={thumbnailUrl(track.id)}
          alt=""
          loading="lazy"
        />
      )}
      <div className="track-card-info">
        <span className="track-card-name">{track.title || 'Untitled'}</span>
        {track.artist && <span className="track-card-artist">{track.artist}</span>}
        <div className="track-card-meta">
          {track.category && <span className={`badge ${track.category.startsWith('personal') ? 'badge-personal' : 'badge-tgt'}`}>{track.category.replace(/_/g, ' ')}</span>}
          {track.bpm && <span className="track-meta-tag">{Math.round(track.bpm)} BPM</span>}
          {track.key && <span className="track-meta-tag">Key: {track.key}</span>}
          <span className="track-meta-tag">{formatDuration(track.duration_seconds)}</span>
          {track.instrument_focus && <span className="track-meta-tag">{track.instrument_focus}</span>}
        </div>
      </div>
      {track.tags && track.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {track.tags.map(tag => (
            <span
              key={tag.id}
              className="tag-chip"
              style={{ background: `${tag.color}22`, color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
      <div className="track-card-footer">
        <span>{formatDate(track.capture_date)}</span>
        <span>{track.play_count > 0 ? `${track.play_count} plays` : ''}</span>
        <button
          className={`favorite-btn ${track.favorite ? 'active' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleFavorite(); }}
        >
          {track.favorite ? '\u2605' : '\u2606'}
        </button>
      </div>
    </div>
  );
}
