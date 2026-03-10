import { useState, useEffect, useRef } from 'react';
import { getTrack, updateTrack, deleteTrack, getWaveform, trackFileUrl, playTrack } from '../api';
import type { Track } from '../types';

interface Props {
  trackId: string;
  onBack: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function TrackDetail({ trackId, onBack }: Props) {
  const [track, setTrack] = useState<Track | null>(null);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  useEffect(() => {
    getTrack(trackId).then(t => {
      setTrack(t);
      setForm({
        title: t.title, artist: t.artist, album: t.album, genre: t.genre,
        category: t.category,
        instrument_focus: t.instrument_focus, difficulty: t.difficulty,
        practice_category: t.practice_category, personal_notes: t.personal_notes,
      });
    });
    getWaveform(trackId).then(setWaveform).catch(() => {});
  }, [trackId]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveform.length === 0) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);
    const mid = h / 2;
    const barW = w / waveform.length;
    const progress = duration > 0 ? currentTime / duration : 0;

    waveform.forEach((amp, i) => {
      const x = i * barW;
      const barH = amp * mid * 0.9;
      const isPast = i / waveform.length < progress;
      ctx.fillStyle = isPast ? '#00e676' : '#f39c12';
      ctx.fillRect(x, mid - barH, Math.max(barW - 0.5, 1), barH * 2);
    });
  }, [waveform, currentTime, duration]);

  // Audio time update
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrent(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration);
    const onEnded = () => setPlaying(false);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnded);
    };
  }, [trackId]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
      playTrack(trackId);
    }
    setPlaying(!playing);
  };

  const seekWaveform = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * duration;
  };

  const seekProgress = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    audio.currentTime = pct * duration;
  };

  const saveForm = async () => {
    await updateTrack(trackId, form);
    setTrack(prev => prev ? { ...prev, ...form } : prev);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this track permanently?')) return;
    await deleteTrack(trackId);
    onBack();
  };

  if (!track) return <p className="empty-text">Loading...</p>;

  return (
    <div className="form-wrap form-top">
      {/* Page header — matches web app pattern */}
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={onBack}>{'\u25C0'} Back</button>
        <h2 className="page-title">{track.title || 'Untitled'}</h2>
        <div className="page-header-spacer" />
      </div>

      {/* Waveform */}
      <canvas
        ref={canvasRef}
        className="waveform-canvas"
        onClick={seekWaveform}
      />

      {/* Player */}
      <audio ref={audioRef} src={trackFileUrl(trackId)} preload="metadata" />
      <div className="neu-card player" style={{ marginTop: 12, marginBottom: 20 }}>
        <button className="btn btn-primary play-btn" onClick={togglePlay}>
          {playing ? '\u275A\u275A' : '\u25B6'}
        </button>
        <div className="progress-bar" onClick={seekProgress}>
          <div
            className="progress-fill"
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>
        <span className="time">{formatTime(currentTime)} / {formatTime(duration)}</span>
      </div>

      {/* Metadata */}
      <div className="neu-card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3>Metadata</h3>
          {editing ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-small btn-primary" onClick={saveForm}>Save</button>
              <button className="btn btn-small" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn-small btn-tangerine" onClick={() => setEditing(true)}>Edit</button>
          )}
        </div>

        <div className="detail-grid">
          {(['title', 'artist', 'album', 'genre'] as const).map(field => (
            <div key={field} className="field">
              <label className="label">{field}</label>
              {editing ? (
                <div className="neu-inset">
                  <input
                    className="input-field"
                    value={form[field] || ''}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  />
                </div>
              ) : (
                <span>{track[field] || '\u2014'}</span>
              )}
            </div>
          ))}

          <div className="field">
            <label className="label">BPM</label>
            <span className="badge badge-bpm">{track.bpm ? Math.round(track.bpm) : '\u2014'}</span>
          </div>
          <div className="field">
            <label className="label">Key</label>
            <span className="badge badge-key">{track.key || '\u2014'}</span>
          </div>

          <div className="field">
            <label className="label">category</label>
            {editing ? (
              <div className="neu-inset">
                <select
                  className="input-field"
                  value={form.category || ''}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  <option value="">{'\u2014'}</option>
                  {['tgt_cover', 'tgt_original', 'personal_cover', 'personal_original'].map(o =>
                    <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
                  )}
                </select>
              </div>
            ) : (
              <span>{track.category ? <span className={`badge ${track.category.startsWith('personal') ? 'badge-personal' : 'badge-tgt'}`}>{track.category.replace(/_/g, ' ')}</span> : '\u2014'}</span>
            )}
          </div>

          {(['instrument_focus', 'difficulty', 'practice_category'] as const).map(field => (
            <div key={field} className="field">
              <label className="label">{field.replace(/_/g, ' ')}</label>
              {editing ? (
                <div className="neu-inset">
                  <select
                    className="input-field"
                    value={form[field] || ''}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  >
                    <option value="">{'\u2014'}</option>
                    {field === 'instrument_focus' && ['drums', 'bass', 'guitar', 'vocals', 'keys', 'full_band'].map(o =>
                      <option key={o} value={o}>{o}</option>
                    )}
                    {field === 'difficulty' && ['easy', 'medium', 'hard', 'expert'].map(o =>
                      <option key={o} value={o}>{o}</option>
                    )}
                    {field === 'practice_category' && ['technique', 'covers', 'originals', 'theory', 'ear_training', 'groove', 'fills'].map(o =>
                      <option key={o} value={o}>{o}</option>
                    )}
                  </select>
                </div>
              ) : (
                <span>{track[field] || '\u2014'}</span>
              )}
            </div>
          ))}

          <div className="field full-width">
            <label className="label">Notes</label>
            {editing ? (
              <div className="neu-inset">
                <textarea
                  className="input-field"
                  rows={3}
                  value={form.personal_notes || ''}
                  onChange={e => setForm(f => ({ ...f, personal_notes: e.target.value }))}
                />
              </div>
            ) : (
              <span>{track.personal_notes || '\u2014'}</span>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="neu-card" style={{ padding: 16, marginBottom: 12 }}>
        <h3 style={{ marginBottom: 8 }}>Info</h3>
        <div className="detail-grid">
          <div className="field">
            <label className="label">Source</label>
            <span style={{ fontSize: 12 }}>{track.source_type}</span>
          </div>
          <div className="field">
            <label className="label">Captured</label>
            <span style={{ fontSize: 12 }}>{new Date(track.capture_date).toLocaleString()}</span>
          </div>
          <div className="field">
            <label className="label">Play Count</label>
            <span>{track.play_count}</span>
          </div>
          <div className="field">
            <label className="label">File Size</label>
            <span>{(track.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span>
          </div>
          {track.source_url && (
            <div className="field full-width">
              <label className="label">Source URL</label>
              <span style={{ fontSize: 11, wordBreak: 'break-all', color: 'var(--color-text-dim)' }}>
                {track.source_url}
              </span>
            </div>
          )}
        </div>
      </div>

      <button className="btn btn-small btn-danger" onClick={handleDelete} style={{ marginTop: 8 }}>
        Delete Track
      </button>
    </div>
  );
}
