/**
 * Player — Shared Live/Practice player screen.
 *
 * Live mode:  Click + lyrics/chords only (no track playback).
 * Practice mode: Click + track/stems + speed + A-B loop.
 *
 * When launched with a setlistId, loads the full setlist and provides
 * queue navigation (prev/next/song list overlay).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioEngine, type PlayerMode } from '../hooks/useAudioEngine';
import { getSetlistWithSongs, getSong } from '@shared/supabase/queries';
import type { Song, SetlistWithSongs, SetlistSongWithDetails } from '@shared/supabase/types';
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

    // Re-acquire on visibility change (tab switch releases it)
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

// ─── ChordPro parser (shared with StagePrompter) ───

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
    return <div className="player-lyrics-line">{line}</div>;
  }

  return (
    <div className="player-chordpro-line">
      {segments.map((seg, i) => (
        <span key={i} className="player-chordpro-segment">
          {seg.chord && <span className="player-chord-inline">{seg.chord}</span>}
          <span className="player-chord-text">{seg.text || '\u00A0'}</span>
        </span>
      ))}
    </div>
  );
}

function LyricsPanel({ lyrics, chords, showLyrics, showChords }: {
  lyrics: string;
  chords: string;
  showLyrics: boolean;
  showChords: boolean;
}) {
  if (!showLyrics && !showChords) return null;

  // ChordPro inline: lyrics field contains [Am]text notation
  if (showLyrics && lyrics && isChordProLine(lyrics)) {
    return (
      <div className="player-lyrics">
        {lyrics.split('\n').map((line, i) => (
          showChords ? <ChordProLine key={i} line={line} /> : (
            <div key={i} className="player-lyrics-line">
              {line.replace(/\[[^\]]+\]/g, '')}
            </div>
          )
        ))}
      </div>
    );
  }

  // Separate chords block + lyrics
  return (
    <div className="player-lyrics">
      {showChords && chords && (
        <div className="player-chords-block">
          {chords.split('\n').map((line, i) => (
            <div key={i} className="player-chord-line">{line}</div>
          ))}
        </div>
      )}
      {showChords && chords && showLyrics && lyrics && <div className="player-section-divider" />}
      {showLyrics && lyrics && lyrics.split('\n').map((line, i) => (
        <div key={i} className={`player-lyrics-line ${line.trim() === '' ? 'player-lyrics-blank' : ''}`}>
          {line || '\u00A0'}
        </div>
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

const STEM_ICONS: Record<string, string> = {
  drums: 'DR',
  bass: 'BA',
  vocals: 'VO',
  guitar: 'GT',
  keys: 'KY',
  backing: 'BK',
  other: 'OT',
};

// ─── Waveform visualiser ───

function Waveform({ data, currentTime, duration, loop }: {
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

    // Loop region highlight
    if (loop && duration > 0) {
      const lx = (loop.start / duration) * w;
      const lw = ((loop.end - loop.start) / duration) * w;
      ctx.fillStyle = 'rgba(243,156,18,0.08)';
      ctx.fillRect(lx, 0, lw, h);
    }

    for (let i = 0; i < bins; i++) {
      const x = i * barW;
      const amp = data[i];
      const barH = Math.max(1, amp * mid * 0.9);
      const isPast = x < progressX;
      ctx.fillStyle = isPast ? 'rgba(0,230,118,0.6)' : 'rgba(255,255,255,0.15)';
      ctx.fillRect(x, mid - barH, Math.max(1, barW - 0.5), barH * 2);
    }

    // Playhead
    ctx.fillStyle = 'var(--color-tangerine)';
    ctx.fillRect(progressX - 1, 0, 2, h);
  }, [data, currentTime, duration, loop]);

  return <canvas ref={canvasRef} className="player-waveform" />;
}

// ─── Player Component ───

interface PlayerProps {
  songId: string | null;
  setlistId: string | null;
  mode: PlayerMode;
  onClose: () => void;
}

export function Player({ songId, setlistId, mode, onClose }: PlayerProps) {
  // Setlist state
  const [setlist, setSetlist] = useState<SetlistWithSongs | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [queueOpen, setQueueOpen] = useState(false);

  // Current song ID (either direct or from setlist)
  const [activeSongId, setActiveSongId] = useState<string | null>(songId);

  // Standalone song data (when no setlist)
  const [standaloneSong, setStandaloneSong] = useState<Song | null>(null);

  // A-B loop marking state
  const [loopMarkA, setLoopMarkA] = useState<number | null>(null);

  // Between-songs / set complete
  const [betweenSongs, setBetweenSongs] = useState(false);
  const [setComplete, setSetComplete] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const lyricsRef = useRef<HTMLDivElement>(null);

  // Audio engine
  const [state, actions] = useAudioEngine(activeSongId, mode);

  // Keep screen awake while playing
  useWakeLock(state.engineState === 'playing' || betweenSongs);

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

  // Load setlist if provided
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

  // Load standalone song name if no setlist and no songId in engine yet
  useEffect(() => {
    if (setlistId || !songId) return;
    getSong(songId).then(s => { if (s) setStandaloneSong(s); });
  }, [songId, setlistId]);

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
    if (lyricsRef.current) lyricsRef.current.scrollTop = 0;
  }, [setlist, actions]);

  const goToPrevSong = useCallback(() => {
    if (currentIndex > 0) goToSetlistSong(currentIndex - 1);
  }, [currentIndex, goToSetlistSong]);

  const goToNextSong = useCallback(() => {
    if (setlist && currentIndex < setlist.songs.length - 1) {
      goToSetlistSong(currentIndex + 1);
    }
  }, [setlist, currentIndex, goToSetlistSong]);

  // Countdown timer for between-songs auto-advance
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

  // Current song details
  const currentSetlistSong: SetlistSongWithDetails | undefined = setlist?.songs[currentIndex];
  const displaySong = state.song;

  // Derive display data
  const songName = currentSetlistSong?.song_name ?? standaloneSong?.name ?? displaySong?.name ?? '';
  const songArtist = currentSetlistSong?.song_artist ?? standaloneSong?.artist ?? displaySong?.artist ?? '';
  const songLyrics = displaySong?.lyrics ?? '';
  const songChords = displaySong?.chords ?? '';
  const songNotes = displaySong?.notes ?? '';
  const songKey = displaySong?.key ?? '';
  const songBpm = displaySong?.bpm ?? 0;

  // Prefs
  const showLyrics = state.prefs?.player_lyrics_enabled ?? true;
  const showChords = state.prefs?.player_chords_enabled ?? true;
  const showNotes = state.prefs?.player_notes_enabled ?? true;

  // Transport
  const isPlaying = state.engineState === 'playing';
  const isPaused = state.engineState === 'paused';

  function handlePlayPause() {
    if (isPlaying) actions.pause();
    else actions.play();
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    actions.seek(Number(e.target.value));
  }

  function handleSpeedChange(delta: number) {
    actions.setSpeed(state.speed + delta);
  }

  // A-B loop
  function handleLoopMark() {
    if (loopMarkA === null) {
      // Mark A
      setLoopMarkA(state.currentTime);
    } else {
      // Mark B — set loop
      const a = loopMarkA;
      const b = state.currentTime;
      if (b > a) {
        actions.setLoop({ start: a, end: b });
      }
      setLoopMarkA(null);
    }
  }

  function clearLoop() {
    actions.setLoop(null);
    setLoopMarkA(null);
  }

  // Loading / error
  if (state.loading) {
    return (
      <div className="player-wrap">
        <div className="player-loading">Loading...</div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="player-wrap">
        <div className="player-error">
          <p>{state.error}</p>
          <button className="btn btn-green" onClick={onClose}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`player-wrap ${state.beatFlash ? 'player-flash' : ''}`}>
      {/* ── Top bar ── */}
      <div className="player-topbar">
        <button className="btn btn-small btn-green" onClick={() => { actions.stop(); onClose(); }}>
          {'\u25C0'} Back
        </button>
        <div className="player-topbar-info">
          <span className="player-song-name">{songName}</span>
          {songArtist && <span className="player-song-artist">{songArtist}</span>}
        </div>
        <span className="player-mode-badge">{mode}</span>
      </div>

      {/* ── Info tags ── */}
      <div className="player-info-tags">
        {songKey && <span className="player-info-tag">{songKey}</span>}
        {songBpm > 0 && <span className="player-info-tag">{Math.round(songBpm * state.speed)} BPM</span>}
        {state.speed !== 1.0 && <span className="player-info-tag player-speed-tag">{Math.round(state.speed * 100)}%</span>}
      </div>

      {/* ── Beat counter ── */}
      <div className="player-beat-counter">
        <span className="player-bar-num">Bar {state.currentBar + 1}</span>
        <div className="player-beat-dots">
          {Array.from({ length: displaySong?.time_signature_top ?? 4 }, (_, i) => (
            <span
              key={i}
              className={`player-beat-dot ${i === state.currentBeat && isPlaying ? 'active' : ''} ${i === 0 ? 'downbeat' : ''}`}
            />
          ))}
        </div>
      </div>

      {/* ── Lyrics/Chords ── */}
      <div className="player-lyrics-area" ref={lyricsRef}>
        <LyricsPanel
          lyrics={songLyrics}
          chords={songChords}
          showLyrics={showLyrics}
          showChords={showChords}
        />
        {showNotes && songNotes && (
          <div className="player-notes">
            <span className="player-notes-label">Notes</span>
            <span className="player-notes-text">{songNotes}</span>
          </div>
        )}
      </div>

      {/* ── Waveform + Transport (practice mode) ── */}
      {mode === 'practice' && state.duration > 0 && (
        <>
          {state.waveformData && (state.prefs?.player_vis_enabled ?? true) && (
            <Waveform
              data={state.waveformData}
              currentTime={state.currentTime}
              duration={state.duration}
              loop={state.loop}
            />
          )}
          <div className="player-transport">
            <span className="player-time">{formatTime(state.currentTime)}</span>
            <input
              type="range"
              className="player-seek-bar"
              min={0}
              max={state.duration}
              step={0.1}
              value={state.currentTime}
              onChange={handleSeek}
            />
            <span className="player-time">{formatTime(state.duration)}</span>
          </div>
        </>
      )}

      {/* ── Controls ── */}
      <div className="player-controls">
        <button
          className={`player-ctrl-btn ${isPlaying ? 'playing' : ''}`}
          onClick={handlePlayPause}
        >
          {isPlaying ? 'Pause' : isPaused ? 'Resume' : 'Play'}
        </button>
        <button className="player-ctrl-btn" onClick={actions.stop}>Stop</button>
        <button
          className="player-ctrl-btn player-ctrl-click"
          onClick={actions.toggleClick}
          title="Toggle click"
        >
          Click
        </button>
      </div>

      {/* ── Speed controls (practice mode) ── */}
      {mode === 'practice' && (
        <div className="player-speed-controls">
          <button className="player-speed-btn" onClick={() => handleSpeedChange(-0.05)}>-5%</button>
          <span className="player-speed-display">{Math.round(state.speed * 100)}%</span>
          <button className="player-speed-btn" onClick={() => handleSpeedChange(0.05)}>+5%</button>
          <button className="player-speed-btn" onClick={() => actions.setSpeed(1.0)}>Reset</button>
        </div>
      )}

      {/* ── A-B Loop (practice mode) ── */}
      {mode === 'practice' && state.duration > 0 && (
        <div className="player-loop-controls">
          <button
            className={`player-loop-btn ${loopMarkA !== null ? 'marking' : ''} ${state.loop ? 'active' : ''}`}
            onClick={handleLoopMark}
          >
            {state.loop ? 'A-B' : loopMarkA !== null ? `A: ${formatTime(loopMarkA)} → B?` : 'Set A-B'}
          </button>
          {state.loop && (
            <button className="player-loop-btn" onClick={clearLoop}>Clear Loop</button>
          )}
        </div>
      )}

      {/* ── Stem mixer (practice mode with stems) ── */}
      {mode === 'practice' && state.stemChannels.length > 0 && (
        <div className="player-stems">
          <div className="player-stems-label">Stems</div>
          <div className="player-stems-grid">
            {state.stemChannels.map(ch => (
              <div key={ch.label} className={`player-stem ${ch.muted ? 'muted' : ''} ${ch.solo ? 'solo' : ''}`}>
                <span className="player-stem-icon">{STEM_ICONS[ch.label] ?? ch.label.slice(0, 2).toUpperCase()}</span>
                <input
                  type="range"
                  className="player-stem-gain"
                  min={0}
                  max={1}
                  step={0.01}
                  value={ch.gain}
                  onChange={e => actions.setStemGain(ch.label as StemLabel, Number(e.target.value))}
                />
                <div className="player-stem-btns">
                  <button
                    className={`player-stem-btn ${ch.muted ? 'active' : ''}`}
                    onClick={() => actions.toggleStemMute(ch.label as StemLabel)}
                  >M</button>
                  <button
                    className={`player-stem-btn ${ch.solo ? 'active' : ''}`}
                    onClick={() => actions.toggleStemSolo(ch.label as StemLabel)}
                  >S</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Setlist queue nav ── */}
      {setlist && (
        <div className="player-queue-nav">
          <button className="player-queue-btn" onClick={goToPrevSong} disabled={currentIndex === 0}>
            Prev
          </button>
          <button className="player-queue-toggle" onClick={() => setQueueOpen(o => !o)}>
            {currentIndex + 1} / {setlist.songs.length}
          </button>
          <button className="player-queue-btn" onClick={goToNextSong} disabled={currentIndex === setlist.songs.length - 1}>
            Next
          </button>
        </div>
      )}

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
              <button className="btn btn-green btn-small" onClick={() => { setBetweenSongs(false); goToNextSong(); }}>
                Skip
              </button>
              <button className="btn btn-outline btn-small" onClick={() => setBetweenSongs(false)}>
                Stay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Set complete celebration ── */}
      {setComplete && (
        <div className="player-transition-overlay">
          <div className="player-transition-card player-set-complete">
            <span className="player-set-complete-icon">&#127881;</span>
            <span className="player-set-complete-title">Set Complete!</span>
            <span className="player-set-complete-sub">
              {setlist ? `${setlist.songs.length} songs played` : 'Great session'}
            </span>
            <div className="player-transition-actions">
              <button className="btn btn-green" onClick={() => { setSetComplete(false); onClose(); }}>
                Done
              </button>
              <button className="btn btn-outline btn-small" onClick={() => { setSetComplete(false); goToSetlistSong(0); }}>
                Replay Set
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Queue overlay ── */}
      {queueOpen && setlist && (
        <div className="player-queue-overlay" onClick={() => setQueueOpen(false)}>
          <div className="player-queue-panel" onClick={e => e.stopPropagation()}>
            <div className="player-queue-header">
              <span className="player-queue-title">{setlist.name}</span>
              <button className="player-queue-close" onClick={() => setQueueOpen(false)}>X</button>
            </div>
            <div className="player-queue-list">
              {setlist.songs.map((song, i) => (
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
