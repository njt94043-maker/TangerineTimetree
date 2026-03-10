/**
 * ImportPanel — Browse and import tracks from TGT Capture (localhost:9123).
 * Creates a Song in Supabase, uploads MP3 to practice-tracks bucket,
 * triggers Cloud Run processing (beats + stems).
 */
import { useState, useEffect, useCallback } from 'react';
import { createSong, uploadPracticeTrack } from '@shared/supabase/queries';
import type { SongCategory } from '@shared/supabase/types';
import { ErrorAlert } from './ErrorAlert';

const CAPTURE_URL = 'http://localhost:9123';
const BEAT_ANALYSIS_URL = import.meta.env.VITE_BEAT_ANALYSIS_URL as string | undefined;

interface CaptureTrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  category: string;
  bpm: number | null;
  key: string;
  duration_seconds: number | null;
  capture_date: string;
  song_id: string | null;
  favorite: number;
}

interface Props {
  onClose: () => void;
  onImported: (songId: string) => void;
}

function formatDuration(sec: number | null): string {
  if (!sec) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch { return iso; }
}

export function ImportPanel({ onClose, onImported }: Props) {
  const [tracks, setTracks] = useState<CaptureTrack[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState('');

  const fetchTracks = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '100', sort_by: 'capture_date', sort_dir: 'desc' });
      if (search) params.set('search', search);
      if (category) params.set('category', category);

      const resp = await fetch(`${CAPTURE_URL}/api/library/tracks?${params}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setTracks(data);
      setConnected(true);
      setError('');
    } catch {
      setConnected(false);
      setTracks([]);
      setError('Cannot connect to Capture server at localhost:9123. Is it running?');
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(fetchTracks, 300);
    return () => clearTimeout(timer);
  }, [fetchTracks]);

  async function importTrack(track: CaptureTrack) {
    if (importing) return;
    setImporting(track.id);
    setImportStatus('Creating song...');
    setError('');

    try {
      // 1. Map Capture metadata → Song fields
      const songCategory = (['tgt_cover', 'tgt_original', 'personal_cover', 'personal_original'].includes(track.category)
        ? track.category : 'tgt_cover') as SongCategory;

      const song = await createSong({
        name: track.title || 'Untitled Import',
        artist: track.artist || '',
        category: songCategory,
        bpm: track.bpm ?? 120,
        key: track.key || '',
        duration_seconds: track.duration_seconds,
        notes: track.genre ? `Genre: ${track.genre}` : '',
        // Defaults for click engine
        time_signature_top: 4,
        time_signature_bottom: 4,
        subdivision: 2,       // 8ths
        swing_percent: 50,    // straight
        count_in_bars: 1,
      });

      // 2. Download MP3 from Capture
      setImportStatus('Downloading audio...');
      const audioResp = await fetch(`${CAPTURE_URL}/api/library/tracks/${track.id}/file`);
      if (!audioResp.ok) throw new Error('Failed to download audio from Capture');
      const audioBuffer = await audioResp.arrayBuffer();

      // 3. Upload to Supabase practice-tracks bucket
      setImportStatus('Uploading to cloud...');
      const fileName = `import-${Date.now()}.mp3`;
      const audioUrl = await uploadPracticeTrack(song.id, fileName, audioBuffer, 'audio/mpeg');

      // 4. Trigger Cloud Run processing (full pipeline)
      if (BEAT_ANALYSIS_URL) {
        setImportStatus('Starting analysis...');
        await fetch(`${BEAT_ANALYSIS_URL}/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ song_id: song.id, audio_url: audioUrl }),
        });
      }

      // 5. Mark as imported in Capture (update song_id FK)
      setImportStatus('Marking imported...');
      await fetch(`${CAPTURE_URL}/api/library/tracks/${track.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song_id: song.id }),
      });

      // Done — refresh track list and notify parent
      setImportStatus('');
      setImporting(null);
      fetchTracks();
      onImported(song.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setImportStatus('');
      setImporting(null);
    }
  }

  const notImported = tracks.filter(t => !t.song_id);
  const alreadyImported = tracks.filter(t => !!t.song_id);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="neu-card" style={{ width: '100%', maxWidth: 600, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Import from Capture</h2>
            <span style={{ fontSize: 11, color: connected ? 'var(--color-green)' : 'var(--color-danger)' }}>
              {connected ? 'Connected to localhost:9123' : 'Disconnected'}
            </span>
          </div>
          <button className="btn btn-small" onClick={onClose}>Close</button>
        </div>

        {/* Search + filter */}
        <div style={{ padding: '12px 20px', display: 'flex', gap: 8 }}>
          <div className="neu-inset" style={{ flex: 1 }}>
            <input
              className="input-field"
              placeholder="Search tracks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ minHeight: 36, padding: '8px 12px', fontSize: 13 }}
            />
          </div>
          <div className="neu-inset" style={{ minWidth: 130 }}>
            <select
              className="input-field"
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{ minHeight: 36, padding: '8px 12px', fontSize: 13 }}
            >
              <option value="">All categories</option>
              {['tgt_cover', 'tgt_original', 'personal_cover', 'personal_original'].map(o =>
                <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>
              )}
            </select>
          </div>
        </div>

        {error && <div style={{ padding: '0 20px' }}><ErrorAlert message={error} onRetry={() => { setError(''); fetchTracks(); }} /></div>}

        {/* Import status banner */}
        {importing && importStatus && (
          <div style={{ padding: '8px 20px', background: 'rgba(26,188,156,0.1)', color: 'var(--color-teal)', fontSize: 12, fontWeight: 600 }}>
            {importStatus}
          </div>
        )}

        {/* Track list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-dim)', padding: 30 }}>Loading...</p>
          ) : !connected ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-dim)', padding: 30 }}>
              Start TGT Capture (capture/start-silent.vbs) to browse tracks
            </p>
          ) : notImported.length === 0 && alreadyImported.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--color-text-dim)', padding: 30 }}>No tracks in Capture</p>
          ) : (
            <>
              {notImported.length > 0 && (
                <>
                  <p style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, margin: '12px 0 8px' }}>
                    Available ({notImported.length})
                  </p>
                  {notImported.map(track => (
                    <div key={track.id} className="neu-card" style={{ padding: '10px 14px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{track.title || 'Untitled'}</div>
                        {track.artist && <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{track.artist}</div>}
                        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                          {track.category && <span className="badge badge-tgt" style={{ fontSize: 10 }}>{track.category.replace(/_/g, ' ')}</span>}
                          {track.bpm && <span className="badge badge-bpm" style={{ fontSize: 10 }}>{Math.round(track.bpm)} BPM</span>}
                          {track.key && <span className="badge badge-key" style={{ fontSize: 10 }}>{track.key}</span>}
                          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>{formatDuration(track.duration_seconds)}</span>
                          <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{formatDate(track.capture_date)}</span>
                        </div>
                      </div>
                      <button
                        className="btn btn-small btn-green"
                        style={{ fontSize: 11, minHeight: 32, padding: '6px 12px', whiteSpace: 'nowrap' }}
                        onClick={() => importTrack(track)}
                        disabled={!!importing}
                      >
                        {importing === track.id ? 'Importing...' : 'Import'}
                      </button>
                    </div>
                  ))}
                </>
              )}

              {alreadyImported.length > 0 && (
                <>
                  <p style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, margin: '16px 0 8px' }}>
                    Already Imported ({alreadyImported.length})
                  </p>
                  {alreadyImported.map(track => (
                    <div key={track.id} style={{ padding: '8px 14px', marginBottom: 4, opacity: 0.5, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{track.title || 'Untitled'}</div>
                        {track.artist && <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>{track.artist}</div>}
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--color-green)', fontWeight: 600 }}>Imported</span>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
