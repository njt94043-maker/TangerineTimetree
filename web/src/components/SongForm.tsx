import { useState, useEffect } from 'react';
import { getSong, createSong, updateSong } from '@shared/supabase/queries';
import type { ClickSound } from '@shared/supabase/types';
import { ErrorAlert } from './ErrorAlert';

const CLICK_SOUNDS: ClickSound[] = ['default', 'high', 'low', 'wood', 'rim'];
const TIME_SIG_TOPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
const TIME_SIG_BOTTOMS = [2, 4, 8, 16];

interface SongFormProps {
  songId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function SongForm({ songId, onClose, onSaved }: SongFormProps) {
  const isEdit = !!songId;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [artist, setArtist] = useState('');
  const [bpm, setBpm] = useState('120');
  const [timeSigTop, setTimeSigTop] = useState(4);
  const [timeSigBottom, setTimeSigBottom] = useState(4);
  const [subdivision, setSubdivision] = useState(1);
  const [swingPercent, setSwingPercent] = useState('50');
  const [clickSound, setClickSound] = useState<ClickSound>('default');
  const [countInBars, setCountInBars] = useState(1);
  const [durationSeconds, setDurationSeconds] = useState('');
  const [key, setKey] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!songId) return;
    getSong(songId).then(song => {
      if (!song) { setError('Song not found'); setLoading(false); return; }
      setName(song.name);
      setArtist(song.artist);
      setBpm(String(song.bpm));
      setTimeSigTop(song.time_signature_top);
      setTimeSigBottom(song.time_signature_bottom);
      setSubdivision(song.subdivision);
      setSwingPercent(String(song.swing_percent));
      setClickSound(song.click_sound);
      setCountInBars(song.count_in_bars);
      setDurationSeconds(song.duration_seconds ? String(song.duration_seconds) : '');
      setKey(song.key);
      setNotes(song.notes);
      setLoading(false);
    }).catch(err => {
      setError(err instanceof Error ? err.message : 'Failed to load song');
      setLoading(false);
    });
  }, [songId]);

  async function handleSave() {
    if (!name.trim()) { setError('Song name is required'); return; }
    const bpmNum = parseFloat(bpm);
    if (isNaN(bpmNum) || bpmNum < 20 || bpmNum > 400) { setError('BPM must be 20-400'); return; }

    setSaving(true);
    setError('');
    try {
      const data = {
        name: name.trim(),
        artist: artist.trim(),
        bpm: bpmNum,
        time_signature_top: timeSigTop,
        time_signature_bottom: timeSigBottom,
        subdivision,
        swing_percent: parseFloat(swingPercent) || 50,
        click_sound: clickSound,
        count_in_bars: countInBars,
        duration_seconds: durationSeconds ? parseInt(durationSeconds) : null,
        key: key.trim(),
        notes: notes.trim(),
      };

      if (isEdit && songId) {
        await updateSong(songId, data);
      } else {
        await createSong(data);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="form-wrap form-top"><p className="empty-text">Loading...</p></div>;

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 className="page-title">{isEdit ? 'Edit Song' : 'New Song'}</h2>
        <button className="btn btn-small btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {error && <ErrorAlert message={error} compact />}

      <div className="neu-card" style={{ marginBottom: 12 }}>
        <label className="label">SONG NAME *</label>
        <div className="neu-inset">
          <input className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sweet Child O' Mine" />
        </div>

        <label className="label">ARTIST</label>
        <div className="neu-inset">
          <input className="input-field" value={artist} onChange={e => setArtist(e.target.value)} placeholder="e.g. Guns N' Roses" />
        </div>

        <label className="label">KEY</label>
        <div className="neu-inset">
          <input className="input-field" value={key} onChange={e => setKey(e.target.value)} placeholder="e.g. D major" />
        </div>

        <label className="label">DURATION (SECONDS)</label>
        <div className="neu-inset">
          <input className="input-field" type="number" value={durationSeconds} onChange={e => setDurationSeconds(e.target.value)} placeholder="e.g. 240" />
        </div>
      </div>

      <div className="neu-card" style={{ marginBottom: 12 }}>
        <h3 className="form-section-title">Metronome</h3>

        <div className="form-row-2col">
          <div>
            <label className="label">BPM *</label>
            <div className="neu-inset">
              <input className="input-field" type="number" min="20" max="400" step="0.5" value={bpm} onChange={e => setBpm(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">TIME SIGNATURE</label>
            <div className="form-row-inline">
              <div className="neu-inset" style={{ flex: 1 }}>
                <select className="input-field" value={timeSigTop} onChange={e => setTimeSigTop(Number(e.target.value))}>
                  {TIME_SIG_TOPS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <span style={{ color: 'var(--text-dim)', padding: '0 4px' }}>/</span>
              <div className="neu-inset" style={{ flex: 1 }}>
                <select className="input-field" value={timeSigBottom} onChange={e => setTimeSigBottom(Number(e.target.value))}>
                  {TIME_SIG_BOTTOMS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="form-row-2col">
          <div>
            <label className="label">SUBDIVISION</label>
            <div className="neu-inset">
              <select className="input-field" value={subdivision} onChange={e => setSubdivision(Number(e.target.value))}>
                <option value={1}>Quarter notes</option>
                <option value={2}>Eighth notes</option>
                <option value={3}>Triplets</option>
                <option value={4}>Sixteenth notes</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">SWING %</label>
            <div className="neu-inset">
              <input className="input-field" type="number" min="50" max="75" value={swingPercent} onChange={e => setSwingPercent(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="form-row-2col">
          <div>
            <label className="label">CLICK SOUND</label>
            <div className="neu-inset">
              <select className="input-field" value={clickSound} onChange={e => setClickSound(e.target.value as ClickSound)}>
                {CLICK_SOUNDS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">COUNT-IN BARS</label>
            <div className="neu-inset">
              <select className="input-field" value={countInBars} onChange={e => setCountInBars(Number(e.target.value))}>
                {[0, 1, 2, 4, 8].map(n => <option key={n} value={n}>{n === 0 ? 'None' : `${n} bar${n > 1 ? 's' : ''}`}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="neu-card" style={{ marginBottom: 12 }}>
        <label className="label">NOTES</label>
        <div className="neu-inset">
          <textarea className="input-field input-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Performance notes..." rows={3} />
        </div>
      </div>
    </div>
  );
}
