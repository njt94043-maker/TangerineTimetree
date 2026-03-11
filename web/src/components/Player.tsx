/**
 * Player — V4 unified player screen (Live / Practice / View / Record).
 *
 * Layout: Header (mode tabs) → Visual Hero → Text Panel → Waveform →
 *         Transport → Nav Row → Drawer pull-up.
 *
 * Live mode:     Click + lyrics/chords only (no track playback).
 * Practice mode: Click + track/stems + speed + A-B loop.
 * View mode (S42, D-137): Local video playback or visualiser fallback (D-146),
 *   stem mixer in drawer, record button for layering (D-144).
 * Record mode (S41): Record button in transport (D-150), overdub (D-140),
 *   click during recording (D-141), count-in (D-142), post-recording (D-139).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioEngine, type PlayerMode } from '../hooks/useAudioEngine';
import { useRecording, type RecordingResult } from '../hooks/useRecording';
import { getSetlistWithSongs, getSong, getSongs, getSetlists, uploadRecordedTake, setBestTake } from '@shared/supabase/queries';
import { saveTakeLocally, getNextTakeNumber, makeTakeId, getBestTakeWithVideo } from '../storage/takesDb';
import type { Song, Setlist, SetlistWithSongs, SetlistSongWithDetails } from '@shared/supabase/types';
import type { StemLabel } from '../audio/StemMixer';

// ─── Wake Lock ───

function useWakeLock(active: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let cancelled = false;

    async function acquire() {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      } catch { /* user denied or not supported */ }
    }

    acquire();

    function onVisibilityChange() {
      if (!cancelled && document.visibilityState === 'visible' && !wakeLockRef.current) {
        acquire();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, [active]);
}

// ─── ChordPro parser ───

function parseChordPro(line: string): { chord?: string; text: string }[] {
  const segments: { chord?: string; text: string }[] = [];
  const regex = /\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = line.slice(lastIndex, match.index);
      if (segments.length === 0 || segments[segments.length - 1].chord) {
        segments.push({ text: textBefore });
      } else {
        segments[segments.length - 1].text += textBefore;
      }
    }
    const chordName = match[1];
    lastIndex = regex.lastIndex;
    const nextMatch = regex.exec(line);
    if (nextMatch) {
      segments.push({ chord: chordName, text: line.slice(lastIndex, nextMatch.index) });
      lastIndex = nextMatch.index;
      regex.lastIndex = nextMatch.index;
    } else {
      segments.push({ chord: chordName, text: line.slice(lastIndex) });
      lastIndex = line.length;
    }
  }

  if (lastIndex < line.length) {
    if (segments.length > 0 && !segments[segments.length - 1].chord) {
      segments[segments.length - 1].text += line.slice(lastIndex);
    } else {
      segments.push({ text: line.slice(lastIndex) });
    }
  }

  if (segments.length === 0) {
    segments.push({ text: line });
  }

  return segments;
}

function isChordProLine(text: string): boolean {
  return /\[[A-G][^\]]*\]/.test(text);
}

function ChordProLine({ line }: { line: string }) {
  const segments = parseChordPro(line);
  const hasChords = segments.some(s => s.chord);

  if (!hasChords) {
    return <div className="v4-tp-lyrics">{line}</div>;
  }

  return (
    <div className="v4-tp-chordpro">
      {segments.map((seg, i) => (
        <span key={i} className="v4-tp-chordpro-seg">
          {seg.chord && <span className="v4-tp-chord-inline">{seg.chord}</span>}
          <span>{seg.text || '\u00A0'}</span>
        </span>
      ))}
    </div>
  );
}

// ─── Helpers ───

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const STEM_COLORS: Record<string, string> = {
  click: 'var(--color-text)',
  drums: 'var(--color-tangerine)',
  bass: 'var(--color-teal)',
  vocals: '#e040fb',
  guitar: 'var(--color-green)',
  keys: 'var(--color-practice)',
  backing: '#78909c',
  other: '#78909c',
};

const STEM_LABELS: Record<string, string> = {
  click: 'CLK',
  drums: 'DRM',
  bass: 'BAS',
  vocals: 'VOX',
  guitar: 'GTR',
  keys: 'KEY',
  backing: 'OTH',
  other: 'OTH',
};

// ─── V4 Waveform ───

function V4Waveform({ data, currentTime, duration, loop }: {
  data: Float32Array;
  currentTime: number;
  duration: number;
  loop: { start: number; end: number } | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const progress = duration > 0 ? currentTime / duration : 0;
    const progressX = progress * w;
    const bins = data.length;
    const barW = w / bins;
    const mid = h / 2;

    // Loop region
    if (loop && duration > 0) {
      const lx = (loop.start / duration) * w;
      const lw = ((loop.end - loop.start) / duration) * w;
      ctx.fillStyle = 'rgba(243,156,18,0.04)';
      ctx.fillRect(lx, 0, lw, h);
      ctx.strokeStyle = 'rgba(243,156,18,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(lx, 0); ctx.lineTo(lx, h);
      ctx.moveTo(lx + lw, 0); ctx.lineTo(lx + lw, h);
      ctx.stroke();
    }

    // Bars
    for (let i = 0; i < bins; i++) {
      const x = i * barW;
      const amp = data[i];
      const barH = Math.max(1, amp * mid * 0.9);
      const isPast = x < progressX;
      ctx.fillStyle = isPast ? 'rgba(0,230,118,0.7)' : 'rgba(0,230,118,0.12)';
      ctx.fillRect(x, mid - barH, Math.max(1, barW - 0.5), barH * 2);
    }

    // Playhead
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255,255,255,0.4)';
    ctx.shadowBlur = 6;
    ctx.fillRect(progressX - 1, 0, 2, h);
    ctx.shadowBlur = 0;
  }, [data, currentTime, duration, loop]);

  return <canvas ref={canvasRef} className="v4-waveform" />;
}

// ─── Player Component ───

interface PlayerProps {
  songId: string | null;
  setlistId: string | null;
  mode: PlayerMode;
  onClose: () => void;
  userId?: string;
  bandRole?: string;
}

export function Player({ songId, setlistId, mode, onClose, userId, bandRole }: PlayerProps) {
  // Mode tabs — user can switch between Live/Practice/View (D-137, D-150)
  const [activeMode, setActiveMode] = useState<PlayerMode>(mode);

  // Setlist state
  const [setlist, setSetlist] = useState<SetlistWithSongs | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueTab, setQueueTab] = useState<'queue' | 'songs' | 'setlists'>('queue');
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [allSetlists, setAllSetlists] = useState<Setlist[]>([]);

  // Current song ID
  const [activeSongId, setActiveSongId] = useState<string | null>(songId);
  const [standaloneSong, setStandaloneSong] = useState<Song | null>(null);

  // A-B loop marking
  const [loopMarkA, setLoopMarkA] = useState<number | null>(null);

  // Between-songs / set complete
  const [betweenSongs, setBetweenSongs] = useState(false);
  const [setComplete, setSetComplete] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // Display toggles (local state — reads from prefs on mount)
  const [showVisuals, setShowVisuals] = useState(true);
  const [showChords, setShowChords] = useState(true);
  const [showLyrics, setShowLyrics] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [showDrums, setShowDrums] = useState(true);
  const [glowFullscreen, setGlowFullscreen] = useState(false);

  // Drawer open
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Recording state (S41)
  const recording = useRecording();
  const [isRecordMode, setIsRecordMode] = useState(false);
  const [postRecResult, setPostRecResult] = useState<RecordingResult | null>(null);
  const [takeNumber, setTakeNumber] = useState(1);
  const [markAsBest, setMarkAsBest] = useState(false);
  const [savingTake, setSavingTake] = useState(false);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);

  // View Mode state (S42 — D-137, D-146)
  const viewVideoRef = useRef<HTMLVideoElement>(null);
  const [viewVideoUrl, setViewVideoUrl] = useState<string | null>(null);

  // Audio engine — uses activeMode so tab switching changes behaviour
  const [state, actions] = useAudioEngine(activeSongId, activeMode);

  // Keep screen awake while playing
  useWakeLock(state.engineState === 'playing' || betweenSongs);

  // Load local video for View Mode (D-146)
  useEffect(() => {
    if (activeMode !== 'view' || !activeSongId || !userId) {
      if (viewVideoUrl) { URL.revokeObjectURL(viewVideoUrl); setViewVideoUrl(null); }
      return;
    }
    let cancelled = false;
    getBestTakeWithVideo(activeSongId, userId).then(take => {
      if (cancelled) return;
      if (take?.video_blob) {
        const url = URL.createObjectURL(take.video_blob);
        setViewVideoUrl(url);
      } else {
        setViewVideoUrl(null);
      }
    });
    return () => { cancelled = true; };
  }, [activeMode, activeSongId, userId]);

  // Cleanup view video URL on unmount
  useEffect(() => {
    return () => { if (viewVideoUrl) URL.revokeObjectURL(viewVideoUrl); };
  }, [viewVideoUrl]);

  // Sync view video with audio playback
  useEffect(() => {
    const vid = viewVideoRef.current;
    if (!vid || activeMode !== 'view' || !viewVideoUrl) return;
    if (state.engineState === 'playing') {
      vid.play().catch(() => { /* user gesture required */ });
    } else {
      vid.pause();
    }
  }, [state.engineState, activeMode, viewVideoUrl]);

  // Sync display toggles from prefs
  useEffect(() => {
    if (state.prefs) {
      setShowVisuals(state.prefs.player_vis_enabled ?? true);
      setShowChords(state.prefs.player_chords_enabled ?? true);
      setShowLyrics(state.prefs.player_lyrics_enabled ?? true);
      setShowNotes(state.prefs.player_notes_enabled ?? true);
      setShowDrums(state.prefs.player_drums_enabled ?? true);
    }
  }, [state.prefs]);

  // Handle song completion in setlist mode
  useEffect(() => {
    if (!state.songComplete || !setlist) return;
    const isLast = currentIndex >= setlist.songs.length - 1;
    if (isLast) {
      setSetComplete(true);
    } else {
      setBetweenSongs(true);
      setCountdown(5);
    }
  }, [state.songComplete, setlist, currentIndex]);

  // Load setlist
  useEffect(() => {
    if (!setlistId) return;
    getSetlistWithSongs(setlistId).then(data => {
      if (data && data.songs.length > 0) {
        setSetlist(data);
        setCurrentIndex(0);
        setActiveSongId(data.songs[0].song_id);
      }
    });
  }, [setlistId]);

  // Load standalone song
  useEffect(() => {
    if (setlistId || !songId) return;
    getSong(songId).then(s => { if (s) setStandaloneSong(s); });
  }, [songId, setlistId]);

  // Load songs/setlists for queue browse tabs (lazy — only when queue opens)
  useEffect(() => {
    if (!queueOpen) return;
    if (allSongs.length === 0) getSongs().then(s => setAllSongs(s));
    if (allSetlists.length === 0) getSetlists().then(s => setAllSetlists(s));
  }, [queueOpen]);

  // Navigate setlist
  const goToSetlistSong = useCallback((index: number) => {
    if (!setlist) return;
    actions.stop();
    setCurrentIndex(index);
    setActiveSongId(setlist.songs[index].song_id);
    setQueueOpen(false);
    setLoopMarkA(null);
    setBetweenSongs(false);
    setSetComplete(false);
  }, [setlist, actions]);

  const goToPrevSong = useCallback(() => {
    if (currentIndex > 0) goToSetlistSong(currentIndex - 1);
  }, [currentIndex, goToSetlistSong]);

  const goToNextSong = useCallback(() => {
    if (setlist && currentIndex < setlist.songs.length - 1) {
      goToSetlistSong(currentIndex + 1);
    }
  }, [setlist, currentIndex, goToSetlistSong]);

  // Pick a song from browse tab (standalone, no setlist)
  const pickSong = useCallback((id: string) => {
    actions.stop();
    setActiveSongId(id);
    setSetlist(null);
    setCurrentIndex(0);
    setQueueOpen(false);
    setLoopMarkA(null);
    setBetweenSongs(false);
    setSetComplete(false);
  }, [actions]);

  // Pick a setlist from browse tab
  const pickSetlist = useCallback((id: string) => {
    actions.stop();
    getSetlistWithSongs(id).then(data => {
      if (data && data.songs.length > 0) {
        setSetlist(data);
        setCurrentIndex(0);
        setActiveSongId(data.songs[0].song_id);
      }
    });
    setQueueOpen(false);
    setLoopMarkA(null);
    setBetweenSongs(false);
    setSetComplete(false);
  }, [actions]);

  // Countdown timer
  useEffect(() => {
    if (!betweenSongs) return;
    if (countdown <= 0) {
      setBetweenSongs(false);
      goToNextSong();
      return;
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [betweenSongs, countdown, goToNextSong]);

  // Derived display data
  const currentSetlistSong: SetlistSongWithDetails | undefined = setlist?.songs[currentIndex];
  const displaySong = state.song;

  const songName = currentSetlistSong?.song_name ?? standaloneSong?.name ?? displaySong?.name ?? '';
  const songArtist = currentSetlistSong?.song_artist ?? standaloneSong?.artist ?? displaySong?.artist ?? '';
  const songLyrics = displaySong?.lyrics ?? '';
  const songChords = displaySong?.chords ?? '';
  const songNotes = displaySong?.notes ?? '';
  const songDrums = (displaySong as any)?.drum_notation ?? '';
  const songBpm = displaySong?.bpm ?? 0;

  const isPlaying = state.engineState === 'playing';
  const isLive = activeMode === 'live';
  const isView = activeMode === 'view';

  // Setlist helpers
  const prevSongName = setlist && currentIndex > 0
    ? setlist.songs[currentIndex - 1]?.song_name ?? null : null;
  const nextSongName = setlist && currentIndex < setlist.songs.length - 1
    ? setlist.songs[currentIndex + 1]?.song_name ?? null : null;

  function handlePlayPause() {
    if (isPlaying) actions.pause();
    else actions.play();
  }

  function handleSpeedChange(delta: number) {
    actions.setSpeed(Math.round((state.speed + delta) * 100) / 100);
  }

  function handleLoopMark() {
    if (loopMarkA === null) {
      setLoopMarkA(state.currentTime);
    } else {
      const a = loopMarkA;
      const b = state.currentTime;
      if (b > a) actions.setLoop({ start: a, end: b });
      setLoopMarkA(null);
    }
  }

  function clearLoop() {
    actions.setLoop(null);
    setLoopMarkA(null);
  }

  // ── Recording handlers (S41) ──

  // Get stem label based on band role
  const recordingLabel = bandRole === 'Drums' ? 'drums'
    : bandRole === 'Bass' ? 'bass'
    : bandRole === 'Lead Vocals' ? 'vocals'
    : bandRole === 'Guitar & Backing Vocals' ? 'guitar'
    : 'other';

  async function handleStartRecording() {
    if (!activeSongId || !userId) return;
    // Get next take number
    const nextNum = await getNextTakeNumber(activeSongId, userId);
    setTakeNumber(nextNum);
    setIsRecordMode(true);
    setPostRecResult(null);

    // Enumerate devices if not done yet
    if (recording.audioDevices.length === 0) {
      await recording.enumerateDevices();
    }

    // Compute count-in duration from song BPM
    const bpmVal = displaySong?.bpm ?? 120;
    const countInBarsVal = displaySong?.count_in_bars ?? 1;
    const countInMs = countInBarsVal > 0
      ? (60000 / bpmVal) * (displaySong?.time_signature_top ?? 4) * countInBarsVal
      : 0;

    // Start overdub playback (D-140) if in practice/view mode
    if ((activeMode === 'practice' || activeMode === 'view') && state.engineState !== 'playing') {
      actions.play();
    }

    await recording.startRecording(countInMs);
  }

  function handleStopRecording() {
    recording.stopRecording();
    // Pause overdub playback
    if (state.engineState === 'playing') {
      actions.pause();
    }
  }

  // When recording finishes, show post-recording modal
  useEffect(() => {
    if (recording.state === 'done' && recording.lastResult) {
      setPostRecResult(recording.lastResult);
    }
  }, [recording.state, recording.lastResult]);

  // Connect camera stream to video element
  useEffect(() => {
    if (cameraVideoRef.current && recording.cameraStream) {
      cameraVideoRef.current.srcObject = recording.cameraStream;
    }
  }, [recording.cameraStream]);

  async function handlePostRecOption(option: 'discard' | 'save-retake' | 'save' | 'save-preview') {
    if (!postRecResult || !activeSongId || !userId) return;

    if (option === 'discard') {
      // Discard & Re-take — delete, start again
      recording.discardResult();
      setPostRecResult(null);
      handleStartRecording();
      return;
    }

    // Save the take
    setSavingTake(true);
    try {
      if (markAsBest) {
        // Upload to Supabase (D-145)
        const stem = await uploadRecordedTake(
          activeSongId,
          recordingLabel,
          takeNumber,
          postRecResult.audioBlob,
        );
        await setBestTake(stem.id, activeSongId);
      } else {
        // Save locally to IndexedDB
        await saveTakeLocally({
          id: makeTakeId(activeSongId, userId, takeNumber),
          song_id: activeSongId,
          user_id: userId,
          take_number: takeNumber,
          audio_blob: postRecResult.audioBlob,
          duration_seconds: postRecResult.durationSeconds,
          label: recordingLabel,
          created_at: new Date().toISOString(),
          video_blob: postRecResult.videoBlob,
        });
      }

      // Save video locally (D-132) if present
      if (postRecResult.videoBlob) {
        try {
          const url = URL.createObjectURL(postRecResult.videoBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `take-${takeNumber}-${songName.replace(/\s+/g, '-')}.webm`;
          a.click();
          URL.revokeObjectURL(url);
        } catch { /* download fallback, non-critical */ }
      }
    } catch (err) {
      console.error('Failed to save take:', err);
    } finally {
      setSavingTake(false);
    }

    recording.discardResult();
    setPostRecResult(null);
    setMarkAsBest(false);

    if (option === 'save-retake') {
      handleStartRecording();
    } else if (option === 'save-preview') {
      // Play back the take
      const url = URL.createObjectURL(postRecResult.audioBlob);
      const audio = new Audio(url);
      audio.play();
    } else {
      // 'save' — return to normal mode
      setIsRecordMode(false);
    }
  }

  // Loading / error
  if (state.loading) {
    return <div className="v4-player"><div className="v4-loading">Loading...</div></div>;
  }
  if (state.error) {
    return (
      <div className="v4-player">
        <div className="v4-error">
          <p>{state.error}</p>
          <button className="btn btn-green" onClick={onClose}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`v4-player ${state.beatFlash ? 'v4-flash' : ''}${state.beatFlash && glowFullscreen ? ' v4-glow-full' : ''}`}>
      {/* ── V4 Header ── */}
      <div className="v4-hdr">
        <button className="v4-hdr-back" onClick={() => { actions.stop(); onClose(); }}>
          {isLive ? '←' : '☰'}
        </button>
        <div className="v4-hdr-info">
          <span className="v4-hdr-song">{songName}</span>
          {songArtist && <span className="v4-hdr-artist">{songArtist}</span>}
          {setlist && (
            <span className="v4-hdr-pos">{currentIndex + 1} of {setlist.songs.length} — {setlist.name}</span>
          )}
        </div>
        <div className="v4-hdr-right">
          {isRecordMode ? (
            <span className="v4-mode-badge record">REC</span>
          ) : (
            <div className="v4-mode-tabs">
              <button className={`v4-mode-tab ${activeMode === 'live' ? 'active live' : ''}`} onClick={() => { actions.stop(); setActiveMode('live'); }}>Live</button>
              <button className={`v4-mode-tab ${activeMode === 'practice' ? 'active practice' : ''}`} onClick={() => { actions.stop(); setActiveMode('practice'); }}>Practice</button>
              <button className={`v4-mode-tab ${activeMode === 'view' ? 'active view' : ''}`} onClick={() => { actions.stop(); setActiveMode('view'); }}>View</button>
            </div>
          )}
          <span className="v4-bpm-val">{Math.round(songBpm * state.speed)}</span>
          <span className="v4-bpm-unit">BPM</span>
        </div>
      </div>

      {/* ── Content area — adaptive flex layout ── */}
      <div className={`v4-content${(showVisuals || isView || isRecordMode) && (showChords || showLyrics || showNotes || showDrums) && !!(songChords || songLyrics || songNotes || songDrums) ? ' both-visible' : ''}`}>
        {/* Visual Hero — normal, view mode, or recording mode */}
        {showVisuals && !isRecordMode && !isView && (
          <div className={`v4-hero ${isLive ? '' : 'practice'}`}>
            <div className="v4-hero-vis">
              <div className="v4-vis-bars">
                {[0.3, 0.5, 0.7, 0.9, 1, 0.85, 0.65, 0.8, 0.95, 0.7, 0.55, 0.4, 0.6, 0.75, 0.5, 0.35].map((h, i) => (
                  <div key={i} className="v4-vis-bar" style={{ height: `${h * 50}px` }} />
                ))}
              </div>
            </div>
            {state.beatFlash && !glowFullscreen && <div className="v4-beat-glow" />}
            <div className="v4-vis-switcher">
              <button className="v4-vis-btn on">Spectrum</button>
              <button className="v4-vis-btn">Rings</button>
              <button className="v4-vis-btn">Burst</button>
            </div>
          </div>
        )}

        {/* View Mode Hero (S42 — D-137, D-146) — local video or visualiser fallback */}
        {isView && !isRecordMode && (
          <div className="v4-hero v4-hero-view">
            {viewVideoUrl ? (
              <video
                ref={viewVideoRef}
                src={viewVideoUrl}
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div className="v4-view-visualizer">
                {Array.from({ length: 21 }, (_, i) => {
                  const h = isPlaying
                    ? Math.max(8, 30 + Math.sin(i * 0.5 + Date.now() / 300) * 25)
                    : 8 + Math.sin(i * 0.3) * 4;
                  return <div key={i} className="v4-view-bar" style={{ height: `${h}%` }} />;
                })}
              </div>
            )}
            {state.beatFlash && !glowFullscreen && <div className="v4-beat-glow" />}
            <div className="v4-view-info-tl">
              <div className="v4-rec-song">{songName}</div>
              <div className="v4-rec-artist">{songArtist} {'\u00B7'} {Math.round(songBpm)} bpm</div>
            </div>
            {state.duration > 0 && (
              <div className="v4-view-time-br">
                {formatTime(state.currentTime)} / {formatTime(state.duration)}
              </div>
            )}
          </div>
        )}

        {/* Recording Hero (S41) — input visualizer or camera feed */}
        {isRecordMode && (
          <div className="v4-hero v4-hero-rec">
            {recording.cameraEnabled && recording.cameraStream ? (
              <video
                ref={cameraVideoRef}
                autoPlay
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
              />
            ) : (
              <div className="v4-rec-visualizer">
                {Array.from({ length: 21 }, (_, i) => {
                  const base = recording.inputLevel;
                  const h = Math.max(4, base * (40 + Math.sin(i * 0.7 + Date.now() / 200) * 20));
                  return (
                    <div
                      key={i}
                      className="v4-rec-bar"
                      style={{ height: `${h}%` }}
                    />
                  );
                })}
              </div>
            )}

            {/* Song info overlay (top-left) */}
            <div className="v4-rec-info-tl">
              <div className="v4-rec-song">{songName}</div>
              <div className="v4-rec-artist">{songArtist} {'\u00B7'} {Math.round(songBpm)} bpm</div>
            </div>

            {/* REC badge (top-right) */}
            {recording.state === 'recording' && (
              <div className="v4-rec-badge">
                <div className="v4-rec-dot" />
                <span className="v4-rec-time">REC {formatTime(recording.elapsedSeconds)}</span>
              </div>
            )}
            {recording.state === 'count-in' && (
              <div className="v4-rec-badge" style={{ borderColor: 'rgba(243,156,18,0.5)', background: 'rgba(243,156,18,0.15)' }}>
                <span className="v4-rec-time" style={{ color: 'var(--color-tangerine)' }}>COUNT-IN</span>
              </div>
            )}

            {/* Take + time (bottom) */}
            <div className="v4-rec-info-bl">
              <span>Take #{takeNumber}</span>
              <span>{formatTime(recording.elapsedSeconds)} / {state.duration > 0 ? formatTime(state.duration) : '--:--'}</span>
            </div>

            {/* Input level bar (when camera is on) */}
            {recording.cameraEnabled && (
              <div className="v4-rec-level-bar">
                <span className="v4-rec-level-label">INPUT</span>
                <div className="v4-rec-level-track">
                  <div className="v4-rec-level-fill" style={{ width: `${recording.inputLevel * 100}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Text Panel */}
        {(showChords || showLyrics || showNotes || showDrums) && (
          <div className="v4-text-panel">
            {showChords && songChords && !isChordProLine(songLyrics) && (
              <>
                <div className="v4-tp-label" style={{ color: 'var(--color-tangerine)' }}>CHORDS</div>
                <div className="v4-tp-chords">{songChords}</div>
              </>
            )}
            {showLyrics && songLyrics && (
              <>
                <div className="v4-tp-label" style={{ color: 'var(--color-text)' }}>LYRICS</div>
                {isChordProLine(songLyrics) ? (
                  songLyrics.split('\n').map((line, i) => (
                    showChords ? <ChordProLine key={i} line={line} /> : (
                      <div key={i} className="v4-tp-lyrics">{line.replace(/\[[^\]]+\]/g, '')}</div>
                    )
                  ))
                ) : (
                  songLyrics.split('\n').map((line, i) => (
                    <div key={i} className="v4-tp-lyrics">{line || '\u00A0'}</div>
                  ))
                )}
              </>
            )}
            {showNotes && songNotes && (
              <>
                <div className="v4-tp-label" style={{ color: 'var(--color-teal)' }}>NOTES</div>
                <div className="v4-tp-notes">{songNotes}</div>
              </>
            )}
            {showDrums && songDrums && (
              <>
                <div className="v4-tp-label" style={{ color: '#e040fb' }}>DRUMS</div>
                <div className="v4-tp-drums">{songDrums}</div>
              </>
            )}
          </div>
        )}

        {/* Waveform (practice only) */}
        {!isLive && state.duration > 0 && state.waveformData && showVisuals && (
          <V4Waveform
            data={state.waveformData}
            currentTime={state.currentTime}
            duration={state.duration}
            loop={state.loop}
          />
        )}
        {!isLive && state.duration > 0 && (
          <div className="v4-wf-info">
            <span className="v4-wf-time"><span className="cur">{formatTime(state.currentTime)}</span> <span className="tot">/ {formatTime(state.duration)}</span></span>
            <span className="v4-wf-speed">{Math.round(state.speed * 100)}%</span>
          </div>
        )}
      </div>

      {/* ── Nav Row ── */}
      {setlist ? (
        <div className="v4-nav-row">
          <button className="v4-nav-song" onClick={goToPrevSong} disabled={currentIndex === 0}>
            ← <span className="nm">{prevSongName ?? '—'}</span>
          </button>
          <button className="v4-nav-queue" onClick={() => setQueueOpen(o => !o)}>
            {currentIndex + 1}/{setlist.songs.length}
          </button>
          <button className="v4-nav-song" onClick={goToNextSong} disabled={currentIndex === setlist.songs.length - 1}>
            <span className="nm">{nextSongName ?? '—'}</span> →
          </button>
        </div>
      ) : (
        <div className="v4-nav-row" style={{ justifyContent: 'center' }}>
          <button className="v4-nav-queue" onClick={() => { setQueueTab('songs'); setQueueOpen(true); }}>
            Browse Songs
          </button>
        </div>
      )}

      {/* ── Transport ── */}
      {isRecordMode && recording.state === 'recording' ? (
        /* Recording transport — stop button only (D-150) */
        <div className="v4-transport">
          <button className="v4-t-btn" disabled style={{ opacity: 0.3 }}>⏮</button>
          <button className="v4-t-btn" disabled style={{ opacity: 0.3 }}>-5</button>
          <button className="v4-t-rec-stop" onClick={handleStopRecording}>■</button>
          <button className="v4-t-btn" disabled style={{ opacity: 0.3 }}>+5</button>
          <button className="v4-t-btn" disabled style={{ opacity: 0.3 }}>⏭</button>
        </div>
      ) : isLive ? (
        <div className="v4-transport">
          <button className="v4-t-btn" onClick={() => { actions.stop(); actions.seek(0); }} title="Restart">
            <span style={{ fontSize: '18px' }}>⏮</span>
          </button>
          <button className={`v4-t-play ${isPlaying ? 'playing' : ''}`} onClick={handlePlayPause}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button className="v4-t-btn v4-t-stop" onClick={actions.stop}>■</button>
        </div>
      ) : (
        <div className="v4-transport stack">
          {/* Top row: speed (left) + A-B loop (right) */}
          <div className="v4-t-row v4-t-row-split">
            <div className="v4-t-speed-group">
              <button className="v4-t-spd" onClick={() => handleSpeedChange(-0.05)}>-5</button>
              <span className="v4-t-spd-val">{Math.round(state.speed * 100)}%</span>
              <button className="v4-t-spd" onClick={() => handleSpeedChange(0.05)}>+5</button>
            </div>
            {state.duration > 0 && (
              <div className="v4-t-loop-group">
                <button className={`v4-t-loop ${loopMarkA !== null ? 'marking' : ''}`} onClick={handleLoopMark}>
                  {state.loop ? 'A-B' : loopMarkA !== null ? `A: ${formatTime(loopMarkA)}` : 'A'}
                </button>
                <button className={`v4-t-loop ${state.loop ? '' : 'dim'}`} onClick={handleLoopMark} disabled={state.loop !== null && loopMarkA === null}>
                  B
                </button>
                {state.loop && <button className="v4-t-loop" onClick={clearLoop}>Clear</button>}
              </div>
            )}
          </div>
          {/* Bottom row: restart / play / stop / click / record */}
          <div className="v4-t-row">
            <button className="v4-t-btn" onClick={() => { actions.stop(); actions.seek(0); }} title="Restart">
              <span style={{ fontSize: '18px' }}>⏮</span>
            </button>
            <button className={`v4-t-play ${isPlaying ? 'playing' : ''}`} onClick={handlePlayPause}>
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button className="v4-t-btn v4-t-stop" onClick={actions.stop}>■</button>
          </div>
        </div>
      )}

      {/* ── Inline drawer — handle + expandable settings ── */}
      <div className={`v4-inline-drawer${drawerOpen ? ' open' : ''}`}>
        <div className="v4-drawer-prev" onClick={() => {
          setDrawerOpen(o => {
            const opening = !o;
            if (opening && recording.audioDevices.length === 0) {
              recording.enumerateDevices();
            }
            return opening;
          });
        }}>
          <div className="v4-drawer-handle" />
        </div>

        <div className="v4-inline-drawer-content">
          <div className="v4-drawer-label">DISPLAY</div>
          <div className="v4-tog-row">
            <TogglePill label="Visuals" active={showVisuals} color="var(--color-green)" onClick={() => setShowVisuals(v => !v)} />
            <TogglePill label="Chords" active={showChords} color="var(--color-tangerine)" onClick={() => setShowChords(v => !v)} />
            <TogglePill label="Lyrics" active={showLyrics} color="var(--color-text)" onClick={() => setShowLyrics(v => !v)} />
            <TogglePill label="Notes" active={showNotes} color="var(--color-teal)" onClick={() => setShowNotes(v => !v)} />
            <TogglePill label="Drums" active={showDrums} color="#e040fb" onClick={() => setShowDrums(v => !v)} />
            <TogglePill label={glowFullscreen ? 'Glow: Full' : 'Glow: Card'} active={glowFullscreen} color="var(--color-green)" onClick={() => setGlowFullscreen(v => !v)} />
          </div>

          {/* Mixer — all modes. Click is always a channel; stems when available */}
          <div className="v4-drawer-label" style={{ marginTop: 12 }}>MIXER</div>
          <div className="v4-mixer">
            {/* Click channel — always present */}
            <div className="v4-mx-ch">
              <span className="v4-mx-lbl" style={{ color: STEM_COLORS.click }}>CLK</span>
              <div className="v4-mx-trk">
                <div className="v4-mx-fill" style={{
                  height: state.prefs?.player_click_enabled === false ? '0%' : '80%',
                  background: STEM_COLORS.click,
                }} />
              </div>
              <span className="v4-mx-val">{state.prefs?.player_click_enabled === false ? 0 : 80}</span>
              <button
                className={`v4-mx-mute ${state.prefs?.player_click_enabled === false ? 'on' : ''}`}
                onClick={actions.toggleClick}
              >M</button>
            </div>
            {/* Track channel — practice/view only, when track loaded but no stems */}
            {!isLive && state.stemChannels.length === 0 && state.duration > 0 && (
              <div className="v4-mx-ch">
                <span className="v4-mx-lbl" style={{ color: 'var(--color-green)' }}>TRK</span>
                <div className="v4-mx-trk">
                  <div className="v4-mx-fill" style={{ height: '100%', background: 'var(--color-green)' }} />
                </div>
                <span className="v4-mx-val">100</span>
                <button className="v4-mx-mute">M</button>
              </div>
            )}
            {/* Stem channels — practice/view only (live = no backing tracks) */}
            {!isLive && state.stemChannels.map(ch => (
              <div key={ch.label} className="v4-mx-ch">
                <span className="v4-mx-lbl" style={{ color: STEM_COLORS[ch.label] ?? 'var(--color-text-muted)' }}>
                  {STEM_LABELS[ch.label] ?? ch.label.slice(0, 3).toUpperCase()}
                </span>
                <div className="v4-mx-trk">
                  <div className="v4-mx-fill" style={{
                    height: `${ch.gain * 100}%`,
                    background: STEM_COLORS[ch.label] ?? 'var(--color-text-muted)',
                  }} />
                </div>
                <span className="v4-mx-val">{Math.round(ch.gain * 100)}</span>
                <button
                  className={`v4-mx-mute ${ch.muted ? 'on' : ''}`}
                  onClick={() => actions.toggleStemMute(ch.label as StemLabel)}
                >M</button>
              </div>
            ))}
          </div>

          {/* Input/Output + Camera — always visible in drawer (D-133, D-147) */}
          <div className="v4-drawer-label" style={{ marginTop: 12 }}>INPUT / OUTPUT</div>
          <div className="v4-set-section">
            <div className="v4-set-row">
              <span className="v4-set-label">Input</span>
              <select
                className="v4-rec-select"
                value={recording.selectedDeviceId}
                onChange={e => recording.selectDevice(e.target.value)}
              >
                {recording.audioDevices.length === 0 && (
                  <option value="">Loading devices…</option>
                )}
                {recording.audioDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                ))}
              </select>
            </div>
            <div className="v4-set-row">
              <span className="v4-set-label">Camera</span>
              <button
                className={`v4-tog ${recording.cameraEnabled ? 'on' : ''}`}
                style={recording.cameraEnabled ? { borderColor: 'var(--color-green)', color: 'var(--color-green)' } : undefined}
                onClick={() => recording.toggleCamera(!recording.cameraEnabled)}
              >
                {recording.cameraEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* Record button — in drawer (D-150) */}
          {userId && (
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
              <button
                className="v4-t-rec"
                onClick={handleStartRecording}
                title="Record take"
                style={{ width: 48, height: 48, fontSize: 24 }}
              >●</button>
            </div>
          )}

          <div className="v4-drawer-label" style={{ marginTop: 12 }}>SETTINGS</div>
          <div className="v4-set-section">
            <div className="v4-set-row">
              <span className="v4-set-label">Subdiv</span>
              <div className="v4-set-pills">
                {([['Off', 1], ['8th', 2], ['Trip', 3], ['16th', 4]] as const).map(([l, v]) => (
                  <span key={l} className={`v4-set-pill ${state.subdivision === v ? 'on' : ''}`} onClick={() => actions.setSubdivision(v)}>{l}</span>
                ))}
              </div>
            </div>
            <div className="v4-set-row">
              <span className="v4-set-label">Count-in</span>
              <div className="v4-set-pills">
                {([['Off', 0], ['1', 1], ['2', 2], ['4', 4]] as const).map(([l, v]) => (
                  <span key={l} className={`v4-set-pill ${state.countInBars === v ? 'on' : ''}`} onClick={() => actions.setCountIn(v)}>{l}</span>
                ))}
              </div>
            </div>
            <div className="v4-set-row">
              <span className="v4-set-label">Nudge</span>
              <div className="v4-set-pills">
                <span className="v4-set-pill" onClick={() => actions.nudge(-1)}>&lt;&lt;</span>
                <span className="v4-nudge-val" onClick={() => actions.resetNudge()}>{state.nudgeOffsetMs >= 0 ? '+' : ''}{state.nudgeOffsetMs}ms</span>
                <span className="v4-set-pill" onClick={() => actions.nudge(1)}>&gt;&gt;</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Between songs transition ── */}
      {betweenSongs && setlist && (
        <div className="player-transition-overlay">
          <div className="player-transition-card">
            <span className="player-transition-done">Song Complete</span>
            <span className="player-transition-up">Up Next</span>
            <span className="player-transition-next">{setlist.songs[currentIndex + 1]?.song_name}</span>
            {setlist.songs[currentIndex + 1]?.song_artist && (
              <span className="player-transition-artist">{setlist.songs[currentIndex + 1]?.song_artist}</span>
            )}
            <span className="player-transition-countdown">{countdown}</span>
            <div className="player-transition-actions">
              <button className="btn btn-green btn-small" onClick={() => { setBetweenSongs(false); goToNextSong(); }}>Skip</button>
              <button className="btn btn-outline btn-small" onClick={() => setBetweenSongs(false)}>Stay</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Set complete ── */}
      {setComplete && (
        <div className="player-transition-overlay">
          <div className="player-transition-card player-set-complete">
            <span className="player-set-complete-icon">&#127881;</span>
            <span className="player-set-complete-title">Set Complete!</span>
            <span className="player-set-complete-sub">
              {setlist ? `${setlist.songs.length} songs played` : 'Great session'}
            </span>
            <div className="player-transition-actions">
              <button className="btn btn-green" onClick={() => { setSetComplete(false); onClose(); }}>Done</button>
              <button className="btn btn-outline btn-small" onClick={() => { setSetComplete(false); goToSetlistSong(0); }}>Replay Set</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Post-recording modal (D-139) ── */}
      {postRecResult && (
        <div className="player-transition-overlay">
          <div className="v4-post-rec">
            <div className="v4-post-rec-header">
              <div className="v4-post-rec-song">{songName}</div>
              <div className="v4-post-rec-artist">{songArtist} {'\u00B7'} {Math.round(songBpm)} BPM</div>
            </div>

            <div className="v4-post-rec-info">
              <div className="v4-post-rec-label">Recording Complete</div>
              <div className="v4-post-rec-take">Take #{takeNumber}</div>
              <div className="v4-post-rec-dur">Duration: {formatTime(postRecResult.durationSeconds)}</div>
            </div>

            <div className="v4-post-rec-actions">
              <button
                className="v4-post-rec-btn discard"
                onClick={() => handlePostRecOption('discard')}
                disabled={savingTake}
              >
                <span className="v4-post-rec-icon">{'\uD83D\uDDD1'}</span>
                <div>
                  <div className="v4-post-rec-btn-title">Discard & Re-take</div>
                  <div className="v4-post-rec-btn-sub">Delete this take, record again</div>
                </div>
              </button>
              <button
                className="v4-post-rec-btn save-retake"
                onClick={() => handlePostRecOption('save-retake')}
                disabled={savingTake}
              >
                <span className="v4-post-rec-icon">{'\uD83D\uDD04'}</span>
                <div>
                  <div className="v4-post-rec-btn-title">Save & Re-take</div>
                  <div className="v4-post-rec-btn-sub">Keep this take, record again</div>
                </div>
              </button>
              <button
                className="v4-post-rec-btn save"
                onClick={() => handlePostRecOption('save')}
                disabled={savingTake}
              >
                <span className="v4-post-rec-icon">{'\uD83D\uDCBE'}</span>
                <div>
                  <div className="v4-post-rec-btn-title">{savingTake ? 'Saving...' : 'Save as Take'}</div>
                  <div className="v4-post-rec-btn-sub">Keep in takes list</div>
                </div>
              </button>
              <button
                className="v4-post-rec-btn preview"
                onClick={() => handlePostRecOption('save-preview')}
                disabled={savingTake}
              >
                <span className="v4-post-rec-icon">{'\u25B6'}</span>
                <div>
                  <div className="v4-post-rec-btn-title">Save & Preview</div>
                  <div className="v4-post-rec-btn-sub">Keep it, play back to review</div>
                </div>
              </button>
            </div>

            <div className="v4-post-rec-best">
              <div>
                <div className="v4-post-rec-best-title">Mark as Best Take</div>
                <div className="v4-post-rec-best-sub">Uploads to cloud {'\u00B7'} visible to all members</div>
              </div>
              <button
                className={`v4-tog ${markAsBest ? 'on' : ''}`}
                style={markAsBest ? { borderColor: 'var(--color-green)', color: 'var(--color-green)', background: 'rgba(0,230,118,0.1)' } : undefined}
                onClick={() => setMarkAsBest(v => !v)}
              >
                {markAsBest ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Queue overlay (tabbed: Queue / Songs / Setlists) ── */}
      {queueOpen && (
        <div className="player-queue-overlay" onClick={() => setQueueOpen(false)}>
          <div className="player-queue-panel" onClick={e => e.stopPropagation()}>
            <div className="player-queue-header">
              <span className="player-queue-title">
                {queueTab === 'queue' ? 'Queue' : queueTab === 'songs' ? 'Songs' : 'Setlists'}
              </span>
              <button className="player-queue-close" onClick={() => setQueueOpen(false)}>X</button>
            </div>
            {/* Tab row */}
            <div className="player-queue-tabs">
              {(['queue', 'songs', 'setlists'] as const).map(tab => (
                <button
                  key={tab}
                  className={`player-queue-tab ${queueTab === tab ? 'active' : ''}`}
                  onClick={() => setQueueTab(tab)}
                >
                  {tab === 'queue' ? 'Queue' : tab === 'songs' ? 'Songs' : 'Setlists'}
                </button>
              ))}
            </div>
            <div className="player-queue-list">
              {/* Queue tab */}
              {queueTab === 'queue' && setlist && setlist.songs.map((song, i) => (
                <button
                  key={song.id}
                  className={`player-queue-item ${i === currentIndex ? 'active' : ''}`}
                  onClick={() => goToSetlistSong(i)}
                >
                  <span className="player-queue-pos">{i + 1}</span>
                  <span className="player-queue-name">{song.song_name}</span>
                  {song.song_artist && <span className="player-queue-artist">{song.song_artist}</span>}
                </button>
              ))}
              {queueTab === 'queue' && !setlist && (
                <div className="player-queue-empty">No active queue</div>
              )}
              {/* Songs tab */}
              {queueTab === 'songs' && allSongs.map(song => (
                <button
                  key={song.id}
                  className={`player-queue-item ${song.id === activeSongId ? 'active' : ''}`}
                  onClick={() => pickSong(song.id)}
                >
                  <span className="player-queue-name">{song.name}</span>
                  <span className="player-queue-artist">{song.artist}</span>
                  <span className="player-queue-bpm">{song.bpm}</span>
                </button>
              ))}
              {queueTab === 'songs' && allSongs.length === 0 && (
                <div className="player-queue-empty">Loading songs…</div>
              )}
              {/* Setlists tab */}
              {queueTab === 'setlists' && allSetlists.map(sl => (
                <button
                  key={sl.id}
                  className={`player-queue-item ${setlist?.id === sl.id ? 'active' : ''}`}
                  onClick={() => pickSetlist(sl.id)}
                >
                  <span className="player-queue-name">{sl.name}</span>
                  <span className="player-queue-artist">{sl.setlist_type}</span>
                </button>
              ))}
              {queueTab === 'setlists' && allSetlists.length === 0 && (
                <div className="player-queue-empty">Loading setlists…</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Toggle Pill ───

function TogglePill({ label, active, color, onClick }: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`v4-tog ${active ? 'on' : ''}`}
      style={active ? {
        borderColor: color,
        color: color,
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
      } : undefined}
      onClick={e => { e.stopPropagation(); onClick(); }}
    >
      {label}
    </button>
  );
}
