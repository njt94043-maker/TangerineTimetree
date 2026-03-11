import { useState, useEffect, useRef } from 'react';
import { getSong, createSong, updateSong, uploadPracticeTrack, deletePracticeTrack, getSongStems, uploadStem, deleteStem, getBeatMap, upsertBeatMap, getProfiles, getSongShares, shareSong, unshareSong, getUserRecordedTakes, deleteRecordedTake, setBestTake, clearBestTake } from '@shared/supabase/queries';
import type { ClickSound, SongStem, StemLabel, BeatMapStatus, SongCategory, Profile, SongShareWithProfile } from '@shared/supabase/types';
import { isPersonalSong } from '@shared/supabase/types';
import { ErrorAlert } from './ErrorAlert';
import { getUserTakesLocal, deleteTakeLocally, type LocalTake } from '../storage/takesDb';

const BEAT_ANALYSIS_URL = import.meta.env.VITE_BEAT_ANALYSIS_URL as string | undefined;

const STEM_LABELS: { value: StemLabel; label: string }[] = [
  { value: 'backing',  label: 'Backing (full band minus you)' },
  { value: 'drums',   label: 'Drums' },
  { value: 'bass',    label: 'Bass' },
  { value: 'vocals',  label: 'Vocals' },
  { value: 'guitar',  label: 'Guitar' },
  { value: 'keys',    label: 'Keys' },
  { value: 'other',   label: 'Other' },
];

const SONG_CATEGORIES: { value: SongCategory; label: string }[] = [
  { value: 'tgt_cover', label: 'TGT Cover' },
  { value: 'tgt_original', label: 'TGT Original' },
  { value: 'personal_cover', label: 'Personal Cover' },
  { value: 'personal_original', label: 'Personal Original' },
];

const CLICK_SOUNDS: ClickSound[] = ['default', 'high', 'low', 'wood', 'rim'];
const TIME_SIG_TOPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
const TIME_SIG_BOTTOMS = [2, 4, 8, 16];

interface SongFormProps {
  songId: string | null;
  onClose: () => void;
  onSaved: () => void;
  bandRole?: string;
  userId?: string;
}

export function SongForm({ songId, onClose, onSaved, bandRole, userId }: SongFormProps) {
  const isEdit = !!songId;
  const isDrummer = bandRole === 'Drums';
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [readOnly, setReadOnly] = useState(false);

  const [name, setName] = useState('');
  const [artist, setArtist] = useState('');
  const [category, setCategory] = useState<SongCategory>('tgt_cover');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
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
  const [lyrics, setLyrics] = useState('');
  const [chords, setChords] = useState('');
  const [drumNotation, setDrumNotation] = useState('');

  // Practice track
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioError, setAudioError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Beat analysis
  const [beatStatus, setBeatStatus] = useState<BeatMapStatus | null>(null);
  const [beatBpm, setBeatBpm] = useState<number | null>(null);
  const [beatCount, setBeatCount] = useState<number | null>(null);
  const [beatError, setBeatError] = useState('');

  // Stems
  const [stems, setStems] = useState<SongStem[]>([]);
  const [stemUploading, setStemUploading] = useState(false);
  const [stemError, setStemError] = useState('');
  const [newStemLabel, setNewStemLabel] = useState<StemLabel>('backing');
  const stemFileRef = useRef<HTMLInputElement>(null);

  // Sharing (personal_original only)
  const [shares, setShares] = useState<SongShareWithProfile[]>([]);
  const [sharingWith, setSharingWith] = useState<string>('');
  const [sharingLoading, setSharingLoading] = useState(false);

  // Takes (S41 — D-130, D-143, D-145)
  const [localTakes, setLocalTakes] = useState<LocalTake[]>([]);
  const [cloudTakes, setCloudTakes] = useState<SongStem[]>([]);
  const [takesLoading, setTakesLoading] = useState(false);
  const [takeError, setTakeError] = useState('');
  const [playingTakeId, setPlayingTakeId] = useState<string | null>(null);
  const takeAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    getProfiles().then(setProfiles).catch(() => {});
    if (!songId) return;
    getSong(songId).then(song => {
      if (!song) { setError('Song not found'); setLoading(false); return; }
      setName(song.name);
      setArtist(song.artist);
      setCategory(song.category);
      setOwnerId(song.owner_id);
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
      setLyrics(song.lyrics);
      setChords(song.chords);
      setDrumNotation(song.drum_notation);
      setAudioUrl(song.audio_url);
      // Read-only: personal songs owned by someone else
      if (isPersonalSong(song.category) && song.owner_id && song.owner_id !== userId) {
        setReadOnly(true);
      }
      setLoading(false);
      getSongStems(songId).then(setStems).catch(() => {});
      // Load shares for personal_original songs owned by current user
      if (song.category === 'personal_original' && song.owner_id === userId) {
        getSongShares(songId).then(setShares).catch(() => {});
      }
      // Load takes: local (IndexedDB) + cloud (Supabase recorded stems)
      if (userId) {
        getUserTakesLocal(songId, userId).then(setLocalTakes).catch(() => {});
        getUserRecordedTakes(songId, userId).then(setCloudTakes).catch(() => {});
      }
      // Load beat map status
      getBeatMap(songId).then(bm => {
        if (bm) {
          setBeatStatus(bm.status);
          setBeatBpm(bm.bpm || null);
          setBeatCount(bm.beats?.length ?? null);
        }
      }).catch(() => {});
    }).catch(err => {
      setError(err instanceof Error ? err.message : 'Failed to load song');
      setLoading(false);
    });
  }, [songId, userId]);

  async function handleShareAdd() {
    if (!songId || !sharingWith) return;
    setSharingLoading(true);
    try {
      await shareSong(songId, sharingWith);
      const updated = await getSongShares(songId);
      setShares(updated);
      setSharingWith('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share');
    } finally {
      setSharingLoading(false);
    }
  }

  async function handleShareRemove(sharedWithUserId: string) {
    if (!songId) return;
    setSharingLoading(true);
    try {
      await unshareSong(songId, sharedWithUserId);
      setShares(prev => prev.filter(s => s.shared_with !== sharedWithUserId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unshare');
    } finally {
      setSharingLoading(false);
    }
  }

  // Takes handlers (S41)
  function refreshTakes() {
    if (!songId || !userId) return;
    getUserTakesLocal(songId, userId).then(setLocalTakes).catch(() => {});
    getUserRecordedTakes(songId, userId).then(setCloudTakes).catch(() => {});
  }

  async function handleDeleteLocalTake(takeId: string) {
    if (!confirm('Delete this take?')) return;
    try {
      await deleteTakeLocally(takeId);
      setLocalTakes(prev => prev.filter(t => t.id !== takeId));
    } catch (err) {
      setTakeError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  async function handleDeleteCloudTake(stemId: string) {
    if (!confirm('Delete this take from cloud storage?')) return;
    try {
      await deleteRecordedTake(stemId);
      setCloudTakes(prev => prev.filter(t => t.id !== stemId));
      // Refresh stems too since best take was in stems list
      if (songId) getSongStems(songId).then(setStems).catch(() => {});
    } catch (err) {
      setTakeError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  async function handleSetBestTake(stemId: string) {
    if (!songId) return;
    setTakesLoading(true);
    try {
      await setBestTake(stemId, songId);
      refreshTakes();
      // Refresh stems since best take appears there
      getSongStems(songId).then(setStems).catch(() => {});
    } catch (err) {
      setTakeError(err instanceof Error ? err.message : 'Failed to set best');
    } finally {
      setTakesLoading(false);
    }
  }

  async function handleClearBestTake(stemId: string) {
    if (!songId) return;
    setTakesLoading(true);
    try {
      await clearBestTake(stemId);
      refreshTakes();
      if (songId) getSongStems(songId).then(setStems).catch(() => {});
    } catch (err) {
      setTakeError(err instanceof Error ? err.message : 'Failed to clear best');
    } finally {
      setTakesLoading(false);
    }
  }

  function handlePlayTake(url: string, takeId: string) {
    if (playingTakeId === takeId) {
      takeAudioRef.current?.pause();
      setPlayingTakeId(null);
      return;
    }
    if (takeAudioRef.current) takeAudioRef.current.pause();
    const audio = new Audio(url);
    audio.onended = () => setPlayingTakeId(null);
    audio.play();
    takeAudioRef.current = audio;
    setPlayingTakeId(takeId);
  }

  function handlePlayLocalTake(take: LocalTake) {
    const url = URL.createObjectURL(take.audio_blob);
    handlePlayTake(url, take.id);
  }

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
        category,
        owner_id: (category === 'personal_cover' || category === 'personal_original') ? ownerId : null,
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
        lyrics: lyrics.trim(),
        chords: chords.trim(),
        drum_notation: drumNotation.trim(),
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

  // Polling ref for processing status
  const pollRef = useRef<number | null>(null);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  function startPolling() {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      if (!songId) return;
      const bm = await getBeatMap(songId).catch(() => null);
      if (!bm) return;
      setBeatStatus(bm.status);
      setBeatBpm(bm.bpm || null);
      setBeatCount(bm.beats?.length ?? null);
      if (bm.status === 'ready' || bm.status === 'failed') {
        stopPolling();
        if (bm.status === 'ready') {
          getSongStems(songId).then(setStems).catch(() => {});
          if (bm.bpm > 0) setBpm(String(bm.bpm));
        }
        if (bm.status === 'failed') setBeatError(bm.error || 'Processing failed');
      }
    }, 3000);
  }

  // Clean up polling on unmount
  useEffect(() => () => stopPolling(), []);

  // Resume polling if we load a song that's currently processing
  useEffect(() => {
    if (beatStatus === 'pending' || beatStatus === 'analysing' || beatStatus === 'separating') {
      startPolling();
    }
  }, [beatStatus]);

  /** Trigger processing pipeline via Cloud Tasks. skip_stems=true → beats only.
   *  Retries up to 3 times to handle Cloud Run cold start (~90s wake-up on free tier). */
  async function triggerProcessing(trackUrl: string, skipStems = false) {
    if (!songId || !BEAT_ANALYSIS_URL) return;

    setBeatStatus('pending');
    setBeatError('');

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          setBeatError(`Server waking up... attempt ${attempt}/${maxRetries}`);
        }
        const resp = await fetch(`${BEAT_ANALYSIS_URL}/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ song_id: songId, audio_url: trackUrl, skip_stems: skipStems }),
        });

        if (!resp.ok) {
          const errBody = await resp.json().catch(() => ({ error: 'Failed to queue' }));
          throw new Error(errBody.error || `HTTP ${resp.status}`);
        }

        // Success — start polling for status updates
        setBeatError('');
        startPolling();
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to start processing';
        const isNetworkError = msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('503');
        if (isNetworkError && attempt < maxRetries) {
          // Wait before retry — server is likely cold-starting
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }
        setBeatStatus('failed');
        setBeatError(msg);
        await upsertBeatMap(songId, { status: 'failed', error: msg }).catch(() => {});
        return;
      }
    }
  }

  /** Re-analyse beats only (D-151) — clears old beat map, re-runs madmom.
   *  Retries up to 3 times for Cloud Run cold start. */
  async function reAnalyse() {
    if (!songId || !audioUrl || !BEAT_ANALYSIS_URL) return;

    setBeatStatus('pending');
    setBeatError('');

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          setBeatError(`Server waking up... attempt ${attempt}/${maxRetries}`);
        }
        const resp = await fetch(`${BEAT_ANALYSIS_URL}/re-analyse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ song_id: songId, audio_url: audioUrl }),
        });

        if (!resp.ok) {
          const errBody = await resp.json().catch(() => ({ error: 'Failed to queue' }));
          throw new Error(errBody.error || `HTTP ${resp.status}`);
        }

        setBeatError('');
        startPolling();
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to start re-analysis';
        const isNetworkError = msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('503');
        if (isNetworkError && attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }
        setBeatStatus('failed');
        setBeatError(msg);
        await upsertBeatMap(songId, { status: 'failed', error: msg }).catch(() => {});
        return;
      }
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !songId) return;
    setAudioUploading(true);
    setAudioError('');
    try {
      const buffer = await file.arrayBuffer();
      const url = await uploadPracticeTrack(songId, file.name, buffer, file.type || 'audio/mpeg');
      setAudioUrl(url);
      // Auto-trigger full processing (beats + stem separation)
      triggerProcessing(url);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setAudioUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleStemFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !songId) return;
    setStemUploading(true);
    setStemError('');
    try {
      const buffer = await file.arrayBuffer();
      const stem = await uploadStem(songId, newStemLabel, file.name, buffer, file.type || 'audio/mpeg');
      setStems(prev => [...prev.filter(s => s.label !== newStemLabel), stem].sort((a, b) => a.label.localeCompare(b.label)));
    } catch (err) {
      setStemError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setStemUploading(false);
      if (stemFileRef.current) stemFileRef.current.value = '';
    }
  }

  async function handleDeleteStem(stemId: string) {
    if (!confirm('Remove this stem from cloud storage?')) return;
    try {
      await deleteStem(stemId);
      setStems(prev => prev.filter(s => s.id !== stemId));
    } catch (err) {
      setStemError(err instanceof Error ? err.message : 'Failed to remove');
    }
  }

  async function handleRemoveAudio() {
    if (!songId || !confirm('Delete the practice track from cloud storage?')) return;
    try {
      await deletePracticeTrack(songId);
      setAudioUrl(null);
      setBeatStatus(null);
      setBeatBpm(null);
      setBeatCount(null);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'Failed to remove');
    }
  }

  if (loading) return <div className="form-wrap form-top"><p className="empty-text">Loading...</p></div>;

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 className="page-title">{readOnly ? 'View Song' : isEdit ? 'Edit Song' : 'New Song'}</h2>
        {!readOnly && (
          <button className="btn btn-small btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>
      {readOnly && (
        <div style={{ padding: '6px 12px', marginBottom: 8, background: 'rgba(243,156,18,0.08)', borderRadius: 8, border: '0.5px solid rgba(243,156,18,0.2)', fontSize: 12, color: 'var(--color-tangerine)' }}>
          This song is owned by another member. You can play it and add your own stems, but cannot edit its details.
        </div>
      )}

      {error && <ErrorAlert message={error} compact />}

      <div className="neu-card" style={{ marginBottom: 12 }}>
        <label className="label">SONG NAME *</label>
        <div className="neu-inset">
          <input className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sweet Child O' Mine" disabled={readOnly} />
        </div>

        <label className="label">ARTIST</label>
        <div className="neu-inset">
          <input className="input-field" value={artist} onChange={e => setArtist(e.target.value)} placeholder="e.g. Guns N' Roses" disabled={readOnly} />
        </div>

        <label className="label">CATEGORY</label>
        <div className="neu-inset">
          <select className="input-field" value={category} onChange={e => setCategory(e.target.value as SongCategory)} disabled={readOnly}>
            {SONG_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {(category === 'personal_cover' || category === 'personal_original') && (
          <>
            <label className="label">OWNER</label>
            <div className="neu-inset">
              <select className="input-field" value={ownerId ?? ''} onChange={e => setOwnerId(e.target.value || null)} disabled={readOnly}>
                <option value="">Select member...</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </>
        )}

        <label className="label">KEY</label>
        <div className="neu-inset">
          <input className="input-field" value={key} onChange={e => setKey(e.target.value)} placeholder="e.g. D major" disabled={readOnly} />
        </div>

        <label className="label">DURATION (SECONDS)</label>
        <div className="neu-inset">
          <input className="input-field" type="number" value={durationSeconds} onChange={e => setDurationSeconds(e.target.value)} placeholder="e.g. 240" disabled={readOnly} />
        </div>
      </div>

      {/* Sharing section — personal_original owned by current user */}
      {isEdit && category === 'personal_original' && ownerId === userId && !readOnly && (
        <div className="neu-card" style={{ marginBottom: 12 }}>
          <h3 className="form-section-title">Sharing</h3>
          <p style={{ color: 'var(--color-text-dim)', fontSize: 12, marginBottom: 10 }}>
            Share this original with band members so they can play it and add their own stems.
          </p>

          {shares.length > 0 && (
            <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {shares.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(187,134,252,0.06)', borderRadius: 6, border: '0.5px solid rgba(187,134,252,0.15)' }}>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text)' }}>{s.shared_with_name}</span>
                  <button
                    className="btn btn-small btn-danger"
                    onClick={() => handleShareRemove(s.shared_with)}
                    disabled={sharingLoading}
                    style={{ fontSize: 11, padding: '2px 8px' }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="neu-inset" style={{ flex: 1 }}>
              <select className="input-field" value={sharingWith} onChange={e => setSharingWith(e.target.value)}>
                <option value="">Add member...</option>
                {profiles
                  .filter(p => p.id !== userId && !shares.some(s => s.shared_with === p.id))
                  .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <button
              className="btn btn-small btn-primary"
              onClick={handleShareAdd}
              disabled={!sharingWith || sharingLoading}
            >
              Share
            </button>
          </div>
        </div>
      )}

      <div className="neu-card" style={{ marginBottom: 12 }}>
        <div className="form-row-2col">
          <div>
            <label className="label">BPM *</label>
            <div className="neu-inset">
              <input className="input-field" type="number" min="20" max="400" step="0.5" value={bpm} onChange={e => setBpm(e.target.value)} disabled={readOnly} />
            </div>
          </div>
          <div>
            <label className="label">TIME SIGNATURE</label>
            <div className="form-row-inline">
              <div className="neu-inset" style={{ flex: 1 }}>
                <select className="input-field" value={timeSigTop} onChange={e => setTimeSigTop(Number(e.target.value))} disabled={readOnly}>
                  {TIME_SIG_TOPS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <span style={{ color: 'var(--text-dim)', padding: '0 4px' }}>/</span>
              <div className="neu-inset" style={{ flex: 1 }}>
                <select className="input-field" value={timeSigBottom} onChange={e => setTimeSigBottom(Number(e.target.value))} disabled={readOnly}>
                  {TIME_SIG_BOTTOMS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isDrummer && (
        <div className="neu-card" style={{ marginBottom: 12 }}>
          <h3 className="form-section-title">Metronome</h3>

          <div className="form-row-2col">
            <div>
              <label className="label">SUBDIVISION</label>
              <div className="neu-inset">
                <select className="input-field" value={subdivision} onChange={e => setSubdivision(Number(e.target.value))} disabled={readOnly}>
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
                <input className="input-field" type="number" min="50" max="75" value={swingPercent} onChange={e => setSwingPercent(e.target.value)} disabled={readOnly} />
              </div>
            </div>
          </div>

          <div className="form-row-2col">
            <div>
              <label className="label">CLICK SOUND</label>
              <div className="neu-inset">
                <select className="input-field" value={clickSound} onChange={e => setClickSound(e.target.value as ClickSound)} disabled={readOnly}>
                  {CLICK_SOUNDS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">COUNT-IN BARS</label>
              <div className="neu-inset">
                <select className="input-field" value={countInBars} onChange={e => setCountInBars(Number(e.target.value))} disabled={readOnly}>
                  {[0, 1, 2, 4, 8].map(n => <option key={n} value={n}>{n === 0 ? 'None' : `${n} bar${n > 1 ? 's' : ''}`}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="neu-card" style={{ marginBottom: 12 }}>
        <label className="label">CHORDS</label>
        <div className="neu-inset">
          <textarea className="input-field input-textarea" value={chords} onChange={e => setChords(e.target.value)} placeholder="e.g. Am - F - C - G" rows={3} disabled={readOnly} />
        </div>

        <label className="label">LYRICS</label>
        <div className="neu-inset">
          <textarea className="input-field input-textarea" value={lyrics} onChange={e => setLyrics(e.target.value)} placeholder="Song lyrics..." rows={5} disabled={readOnly} />
        </div>
      </div>

      {isDrummer && (
        <div className="neu-card" style={{ marginBottom: 12 }}>
          <label className="label">DRUM NOTATION</label>
          <div className="neu-inset">
            <textarea className="input-field input-textarea" value={drumNotation} onChange={e => setDrumNotation(e.target.value)} placeholder="Drum notation / sticking patterns..." rows={4} disabled={readOnly} />
          </div>
        </div>
      )}

      <div className="neu-card" style={{ marginBottom: 12 }}>
        <label className="label">NOTES</label>
        <div className="neu-inset">
          <textarea className="input-field input-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Performance notes..." rows={3} disabled={readOnly} />
        </div>
      </div>

      {isEdit && (
        <div className="neu-card" style={{ marginBottom: 12 }}>
          <h3 className="form-section-title">Practice Track</h3>
          <input ref={fileRef} type="file" accept="audio/*" onChange={handleFileSelected} style={{ display: 'none' }} />
          {audioUploading ? (
            <p style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>Uploading...</p>
          ) : audioUrl ? (
            <div>
              <p style={{ color: 'var(--color-green)', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Track attached</p>
              <div className="flex-row-gap-8">
                <button className="btn btn-small btn-tangerine" onClick={() => fileRef.current?.click()}>Replace Track</button>
                <button className="btn btn-small btn-danger" onClick={handleRemoveAudio}>Remove</button>
              </div>
            </div>
          ) : (
            <button className="btn btn-small btn-green" onClick={() => fileRef.current?.click()}>+ Add MP3 / Audio</button>
          )}
          {audioError && <p style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 6 }}>{audioError}</p>}

          {/* Beat analysis status */}
          {audioUrl && (
            <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-dim)', fontWeight: 700 }}>PROCESSING</span>
                {beatStatus === 'pending' && (
                  <span style={{ fontSize: 12, color: 'var(--color-tangerine)' }}>Queued...</span>
                )}
                {beatStatus === 'analysing' && (
                  <span style={{ fontSize: 12, color: 'var(--color-tangerine)' }}>Detecting beats...</span>
                )}
                {beatStatus === 'separating' && (
                  <span style={{ fontSize: 12, color: 'var(--color-purple)' }}>Separating stems...</span>
                )}
                {beatStatus === 'ready' && (
                  <span style={{ fontSize: 12, color: 'var(--color-green)' }}>
                    Ready — {beatBpm} BPM, {beatCount} beats
                  </span>
                )}
                {beatStatus === 'failed' && (
                  <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>
                    Failed{beatError ? `: ${beatError}` : ''}
                  </span>
                )}
                {!beatStatus && !BEAT_ANALYSIS_URL && (
                  <span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>Not configured</span>
                )}
              </div>
              {(beatStatus === 'failed' || beatStatus === 'ready' || !beatStatus) && BEAT_ANALYSIS_URL && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  {beatStatus === 'ready' && (
                    <button
                      className="btn btn-small btn-teal"
                      style={{ fontSize: 11 }}
                      onClick={reAnalyse}
                    >
                      Re-analyse Beats
                    </button>
                  )}
                  <button
                    className="btn btn-small btn-teal"
                    style={{ fontSize: 11 }}
                    onClick={() => audioUrl && triggerProcessing(audioUrl)}
                  >
                    {beatStatus === 'ready' ? 'Full Re-process' : beatStatus === 'failed' ? 'Retry' : 'Process Track'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isEdit && (
        <div className="neu-card" style={{ marginBottom: 12 }}>
          <h3 className="form-section-title">Stems</h3>
          <p style={{ color: 'var(--color-text-dim)', fontSize: 12, marginBottom: 12 }}>
            Stems are auto-generated when you upload a practice track. You can also upload custom stems manually.
          </p>

          {(beatStatus === 'pending' || beatStatus === 'analysing' || beatStatus === 'separating') && stems.filter(s => s.source === 'auto').length === 0 && (
            <div style={{ padding: '10px 12px', marginBottom: 12, background: 'rgba(168,85,247,0.08)', borderRadius: 8, border: '0.5px solid rgba(168,85,247,0.2)' }}>
              <span style={{ fontSize: 12, color: 'var(--color-purple)' }}>
                {beatStatus === 'separating' ? 'Separating stems on server...' : 'Processing queued — stems will appear automatically...'}
              </span>
            </div>
          )}

          {stems.length > 0 && (
            <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {stems.map(stem => (
                <div key={stem.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--color-surface-raised, rgba(255,255,255,0.03))', borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.07)' }}>
                  <span style={{ flex: 1, color: 'var(--color-teal)', fontWeight: 700, fontSize: 13, textTransform: 'capitalize' }}>
                    {stem.label}
                    {stem.source === 'auto' && <span style={{ color: 'var(--color-purple)', fontSize: 10, fontWeight: 400, marginLeft: 6 }}>[auto]</span>}
                  </span>
                  <audio controls src={stem.audio_url} style={{ height: 28, flex: 2 }} />
                  <button className="btn btn-small btn-danger" onClick={() => handleDeleteStem(stem.id)}>Remove</button>
                </div>
              ))}
            </div>
          )}

          <input ref={stemFileRef} type="file" accept="audio/*" onChange={handleStemFileSelected} style={{ display: 'none' }} />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="neu-inset" style={{ flex: 1 }}>
              <select
                className="input-field"
                value={newStemLabel}
                onChange={e => setNewStemLabel(e.target.value as StemLabel)}
              >
                {STEM_LABELS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <button
              className="btn btn-small btn-green"
              onClick={() => stemFileRef.current?.click()}
              disabled={stemUploading}
            >
              {stemUploading ? 'Uploading...' : '+ Add Stem'}
            </button>
          </div>

          {stemError && <p style={{ color: 'var(--color-danger)', fontSize: 12, marginTop: 6 }}>{stemError}</p>}
        </div>
      )}

      {/* Takes section (S41 — D-130, D-143, D-145) */}
      {isEdit && userId && (
        <div className="neu-card" style={{ marginBottom: 12 }}>
          <h3 className="form-section-title">My Takes</h3>
          <p style={{ color: 'var(--color-text-dim)', fontSize: 12, marginBottom: 12 }}>
            Your recorded takes for this song. Mark one as "best" to add it to the stems for everyone.
          </p>

          {takeError && <p style={{ color: 'var(--color-danger)', fontSize: 12, marginBottom: 8 }}>{takeError}</p>}

          {/* Cloud takes (best takes stored in Supabase) */}
          {cloudTakes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: localTakes.length > 0 ? 12 : 0 }}>
              {cloudTakes.map((take, idx) => (
                <div
                  key={take.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                    background: take.is_best_take ? 'rgba(0,230,118,0.03)' : 'var(--color-surface-raised, rgba(255,255,255,0.03))',
                    borderRadius: 8,
                    border: take.is_best_take ? '1px solid rgba(0,230,118,0.3)' : '0.5px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700,
                    background: take.is_best_take ? 'rgba(0,230,118,0.15)' : 'var(--color-bg)',
                    color: take.is_best_take ? 'var(--color-green)' : 'var(--color-text-dim)',
                  }}>
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: take.is_best_take ? 'var(--color-green)' : 'var(--color-text)' }}>
                      Take (cloud)
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-dim)', marginLeft: 8 }}>
                      {new Date(take.created_at).toLocaleDateString()}
                    </span>
                    {take.is_best_take && (
                      <span style={{
                        display: 'inline-block', marginLeft: 6, fontSize: 9, fontWeight: 700, padding: '1px 6px',
                        background: 'rgba(0,230,118,0.15)', color: 'var(--color-green)', borderRadius: 12,
                        border: '1px solid rgba(0,230,118,0.3)',
                      }}>
                        BEST
                      </span>
                    )}
                  </div>
                  <button
                    className="btn btn-small"
                    style={{ fontSize: 11, padding: '2px 8px' }}
                    onClick={() => handlePlayTake(take.audio_url, take.id)}
                  >
                    {playingTakeId === take.id ? '\u23F8' : '\u25B6'}
                  </button>
                  {take.is_best_take ? (
                    <button
                      className="btn btn-small"
                      style={{ fontSize: 11, padding: '2px 8px', color: 'var(--color-green)' }}
                      onClick={() => handleClearBestTake(take.id)}
                      disabled={takesLoading}
                    >
                      Unset Best
                    </button>
                  ) : (
                    <button
                      className="btn btn-small"
                      style={{ fontSize: 11, padding: '2px 8px' }}
                      onClick={() => handleSetBestTake(take.id)}
                      disabled={takesLoading}
                    >
                      Set Best
                    </button>
                  )}
                  <button className="btn btn-small btn-danger" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => handleDeleteCloudTake(take.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Local takes (IndexedDB, non-best) */}
          {localTakes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {cloudTakes.length > 0 && localTakes.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>
                  Local takes (not uploaded)
                </div>
              )}
              {localTakes.map(take => (
                <div
                  key={take.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                    background: 'var(--color-surface-raised, rgba(255,255,255,0.03))',
                    borderRadius: 8, border: '0.5px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, background: 'var(--color-bg)', color: 'var(--color-text-dim)',
                  }}>
                    {take.take_number}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Take #{take.take_number}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-dim)', marginLeft: 8 }}>
                      {Math.floor(take.duration_seconds / 60)}:{String(Math.floor(take.duration_seconds % 60)).padStart(2, '0')}
                      {' \u00B7 '}
                      {new Date(take.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    className="btn btn-small"
                    style={{ fontSize: 11, padding: '2px 8px' }}
                    onClick={() => handlePlayLocalTake(take)}
                  >
                    {playingTakeId === take.id ? '\u23F8' : '\u25B6'}
                  </button>
                  <button className="btn btn-small btn-danger" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => handleDeleteLocalTake(take.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}

          {cloudTakes.length === 0 && localTakes.length === 0 && (
            <p style={{ color: 'var(--color-text-dim)', fontSize: 13, fontStyle: 'italic' }}>
              No takes yet. Record in the player to add takes.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
