/**
 * useAudioEngine — React hook bridging the audio engine to UI.
 *
 * Loads song data (beat map, stems, metadata), player prefs,
 * and provides reactive state for the Player component.
 *
 * Supports two modes:
 *   - 'live': Click only + lyrics/chords. No track/stems.
 *   - 'practice': Click + track + stems + speed + A-B loop.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioEngine, type EngineState, type BeatEvent } from '../audio/AudioEngine';
import { ClickScheduler, type ClickConfig } from '../audio/ClickScheduler';
import { TrackPlayer, type LoopRegion } from '../audio/TrackPlayer';
import { StemMixer, type StemLabel } from '../audio/StemMixer';
import { getSong, getBeatMap, getSongStems, getPlayerPrefs, updatePlayerPrefs } from '@shared/supabase/queries';
import type { Song, BeatMap, SongStem } from '@shared/supabase/types';
import type { PlayerPrefs } from '@shared/supabase/queries';

export type PlayerMode = 'live' | 'practice' | 'view';

/** Downsample an AudioBuffer to N amplitude peaks (0–1). */
function generateWaveform(buffer: AudioBuffer, numBins = 200): Float32Array {
  const channel = buffer.getChannelData(0);
  const samplesPerBin = Math.floor(channel.length / numBins);
  const peaks = new Float32Array(numBins);
  for (let i = 0; i < numBins; i++) {
    let max = 0;
    const start = i * samplesPerBin;
    const end = Math.min(start + samplesPerBin, channel.length);
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channel[j]);
      if (abs > max) max = abs;
    }
    peaks[i] = max;
  }
  return peaks;
}

export interface AudioEngineState {
  // Loading
  loading: boolean;
  error: string | null;

  // Song data
  song: Song | null;
  beatMap: BeatMap | null;
  stems: SongStem[];
  prefs: PlayerPrefs | null;

  // Transport
  engineState: EngineState;
  currentTime: number;
  duration: number;
  speed: number;
  loop: LoopRegion | null;

  // Beat
  currentBeat: number;
  currentBar: number;
  beatFlash: boolean;

  // Click settings (live-adjustable)
  subdivision: number;
  countInBars: number;
  nudgeOffsetMs: number;

  // Song completion (track ended naturally, not user stop)
  songComplete: boolean;

  // Waveform data (downsampled amplitude peaks, 0-1 range)
  waveformData: Float32Array | null;

  // Stem mixer state
  stemChannels: ReadonlyArray<{
    label: StemLabel;
    gain: number;
    muted: boolean;
    solo: boolean;
  }>;

  // Mixer gain state for click + track channels
  clickGain: number;
  clickMuted: boolean;
  trackGain: number;
  trackMuted: boolean;

  // FFT frequency data for visualiser (32 bins, 0-255 each)
  fftData: Uint8Array | null;

  // Beat-driven metronome visualiser (quick attack, slow release)
  beatIntensity: number;    // 0-1, snaps to 1 on beat, decays each frame
  barTargets: Float32Array; // 16 random bar heights, regenerated each beat
}

export interface AudioEngineActions {
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  setLoop: (region: LoopRegion | null) => void;
  setStemGain: (label: StemLabel, gain: number) => void;
  toggleStemMute: (label: StemLabel) => void;
  toggleStemSolo: (label: StemLabel) => void;
  toggleClick: () => void;
  setClickGain: (gain: number) => void;
  setTrackGain: (gain: number) => void;
  toggleTrackMute: () => void;
  setSubdivision: (sub: number) => void;
  setCountIn: (bars: number) => void;
  nudge: (direction: -1 | 1) => void;
  resetNudge: () => void;
}

export function useAudioEngine(
  songId: string | null,
  mode: PlayerMode,
): [AudioEngineState, AudioEngineActions] {
  // Refs for audio objects (not reactive — they're mutable singletons)
  const clickRef = useRef(new ClickScheduler());
  const trackRef = useRef(new TrackPlayer());
  const mixerRef = useRef(new StemMixer());
  const clickEnabledRef = useRef(true);

  // Reactive state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [song, setSong] = useState<Song | null>(null);
  const [beatMap, setBeatMap] = useState<BeatMap | null>(null);
  const [stems, setStems] = useState<SongStem[]>([]);
  const [prefs, setPrefs] = useState<PlayerPrefs | null>(null);
  const [engineState, setEngineState] = useState<EngineState>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeedState] = useState(1.0);
  const [loop, setLoopState] = useState<LoopRegion | null>(null);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [currentBar, setCurrentBar] = useState(0);
  const [beatFlash, setBeatFlash] = useState(false);
  const [stemChannels, setStemChannels] = useState<AudioEngineState['stemChannels']>([]);
  const [songComplete, setSongComplete] = useState(false);
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);
  const fftDataRef = useRef<Uint8Array | null>(null);
  const beatIntensityRef = useRef(0);
  const barTargetsRef = useRef(new Float32Array(16));
  const [subdivision, setSubdivisionState] = useState(1);
  const [clickGain, setClickGainState] = useState(0.8);
  const [clickMuted, setClickMuted] = useState(false);
  const [trackGain, setTrackGainState] = useState(1.0);
  const [trackMuted, setTrackMuted] = useState(false);
  const [countInBars, setCountInBarsState] = useState(0);
  const [nudgeOffsetMs, setNudgeOffsetMs] = useState(0);

  // Load song data
  useEffect(() => {
    if (!songId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSong() {
      setLoading(true);
      setError(null);

      try {
        // Load all data in parallel
        const [songData, beatMapData, stemsData, prefsData] = await Promise.all([
          getSong(songId!),
          getBeatMap(songId!),
          getSongStems(songId!),
          getPlayerPrefs(),
        ]);

        if (cancelled) return;

        if (!songData) {
          setError('Song not found');
          setLoading(false);
          return;
        }

        setSong(songData);
        setBeatMap(beatMapData);
        setStems(stemsData);
        setPrefs(prefsData);

        // Configure click scheduler from song metadata
        const accentPattern = songData.accent_pattern
          ? songData.accent_pattern.split(',').map(Number)
          : [];

        const clickConfig: Partial<ClickConfig> = {
          bpm: songData.bpm || 120, // fallback to 120 if 0/null/undefined
          timeSignatureTop: songData.time_signature_top || 4,
          timeSignatureBottom: songData.time_signature_bottom || 4,
          subdivision: songData.subdivision ?? 1,
          swingPercent: songData.swing_percent ?? 50,
          accentPattern,
          clickSound: songData.click_sound || 'default',
          countInBars: songData.count_in_bars ?? 0,
          beatOffsetMs: songData.beat_offset_ms ?? 0,
        };
        clickRef.current.configure(clickConfig);

        // Load beat map if available and status is ready
        if (beatMapData && beatMapData.status === 'ready' && beatMapData.beats.length > 0) {
          clickRef.current.loadBeatMap(beatMapData.beats);
        }

        clickEnabledRef.current = prefsData.player_click_enabled;
        setClickMuted(!prefsData.player_click_enabled); // Sync UI with DB pref
        console.log('[TGT-CLICK-DEBUG] Prefs loaded', {
          player_click_enabled: prefsData.player_click_enabled,
          clickEnabledRef: clickEnabledRef.current,
          songBpm: songData.bpm,
          songTimeSig: `${songData.time_signature_top}/${songData.time_signature_bottom}`,
        });
        setSubdivisionState(songData.subdivision ?? 1);
        setCountInBarsState(songData.count_in_bars ?? 0);

        // In practice mode, load track or stems
        if (mode === 'practice' || mode === 'view') {
          if (stemsData.length > 0) {
            // Load stems
            await mixerRef.current.loadStems(
              stemsData.map(s => ({ label: s.label as StemLabel, url: s.audio_url }))
            );
            setDuration(mixerRef.current.getDuration());

            // Auto-mute drums if pref disabled
            if (!prefsData.player_drums_enabled) {
              mixerRef.current.setMuted('drums', true);
            }

            updateStemChannels();

            // Generate waveform from first stem
            const buf = mixerRef.current.getBuffer();
            if (buf) setWaveformData(generateWaveform(buf));
          } else if (songData.audio_url) {
            // Load single practice track
            await trackRef.current.load(songData.audio_url);
            setDuration(trackRef.current.getDuration());

            // Generate waveform
            const buf = trackRef.current.getBuffer();
            if (buf) setWaveformData(generateWaveform(buf));
          }
        }

        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load song');
          setLoading(false);
        }
      }
    }

    loadSong();

    return () => {
      cancelled = true;
      clickRef.current.stop();
      trackRef.current.stop();
      mixerRef.current.stop();
      AudioEngine.reset();
    };
  }, [songId, mode]);

  // Beat event listener
  useEffect(() => {
    const removeListener = AudioEngine.addListener({
      onBeat(event: BeatEvent) {
        setCurrentBeat(event.beat);
        setCurrentBar(event.bar);
        // Beat intensity for metronome visualiser — quick attack
        beatIntensityRef.current = 1.0;
        // EQ-shaped bar heights — bell curve (center tall, edges short) + slight variation
        for (let i = 0; i < 16; i++) {
          const dist = Math.abs(i - 7.5) / 7.5;
          const base = 0.45 + 0.55 * (1 - dist * dist);
          barTargetsRef.current[i] = base * (0.85 + Math.random() * 0.15);
        }
        if (prefs?.player_flash_enabled) {
          setBeatFlash(true);
          setTimeout(() => setBeatFlash(false), 80);
        }
      },
      onStateChange(state: EngineState) {
        setEngineState(state);
      },
      onSongComplete() {
        // Track/stems finished — stop everything
        clickRef.current.stop();
        AudioEngine.setState('idle');
        setCurrentTime(0);
        setSongComplete(true);
      },
    });

    return removeListener;
  }, [prefs?.player_flash_enabled]);

  function updateStemChannels() {
    setStemChannels(
      mixerRef.current.getChannels().map(ch => ({
        label: ch.label,
        gain: ch.gain,
        muted: ch.muted,
        solo: ch.solo,
      }))
    );
  }

  // Determine which audio source is active
  const hasStems = stems.length > 0 && mixerRef.current.isLoaded();
  const hasTrack = trackRef.current.isLoaded();

  // --- Actions ---

  const play = useCallback(async () => {
    setSongComplete(false);
    await AudioEngine.resume();

    const ctx = AudioEngine.getContext();
    const mg = AudioEngine.getMasterGain();
    console.log('[TGT-CLICK-DEBUG] play() called', {
      clickEnabled: clickEnabledRef.current,
      audioCtxState: ctx.state,
      masterGainValue: mg.gain.value,
      clickConfig: clickRef.current.getConfig(),
      mode,
    });

    if (clickEnabledRef.current) {
      clickRef.current.start();
      console.log('[TGT-CLICK-DEBUG] ClickScheduler.start() called, isActive:', clickRef.current.isActive());
    } else {
      console.warn('[TGT-CLICK-DEBUG] CLICK DISABLED — clickEnabledRef.current is false. Check player_click_enabled in user_settings.');
    }

    if ((mode === 'practice' || mode === 'view') && hasStems) {
      mixerRef.current.play();
    } else if ((mode === 'practice' || mode === 'view') && hasTrack) {
      trackRef.current.play();
    }

    AudioEngine.setState('playing');

    // S56: Last confirmed working state = step 2c (pollBeats + position + setCurrentTime).
    // AnalyserNode moved to parallel branch in AudioEngine.ts (S56 fix).
    // resyncToPosition, FFT, beat intensity NOT included — need isolated testing next session.
    AudioEngine.startTick(() => {
      AudioEngine.pollBeats();

      let pos = 0;
      if (hasStems) {
        pos = mixerRef.current.getPosition();
        mixerRef.current.checkLoop();
      } else if (hasTrack) {
        pos = trackRef.current.getPosition();
        trackRef.current.checkLoop();
      }

      setCurrentTime(pos);
      AudioEngine.emitTimeUpdate(pos, duration);
    });
  }, [mode, hasStems, hasTrack, duration]);

  const pause = useCallback(() => {
    clickRef.current.stop();
    if (hasStems) mixerRef.current.pause();
    else if (hasTrack) trackRef.current.pause();
    AudioEngine.stopTick();
    AudioEngine.setState('paused');
  }, [hasStems, hasTrack]);

  const stop = useCallback(() => {
    clickRef.current.stop();
    if (hasStems) mixerRef.current.stop();
    else if (hasTrack) trackRef.current.stop();
    AudioEngine.stopTick();
    AudioEngine.setState('idle');
    setCurrentTime(0);
    setCurrentBeat(0);
    setCurrentBar(0);
  }, [hasStems, hasTrack]);

  const seek = useCallback((time: number) => {
    if (hasStems) mixerRef.current.seek(time);
    else if (hasTrack) trackRef.current.seek(time);
    setCurrentTime(time);
  }, [hasStems, hasTrack]);

  const setSpeed = useCallback((newSpeed: number) => {
    const clamped = Math.max(0.25, Math.min(2.0, newSpeed));
    setSpeedState(clamped);

    // Update click BPM proportionally + set speed for beat map scaling
    if (song) {
      clickRef.current.configure({ bpm: song.bpm * clamped });
    }
    clickRef.current.setSpeed(clamped);

    if (hasStems) mixerRef.current.setSpeed(clamped);
    else if (hasTrack) trackRef.current.setSpeed(clamped);
  }, [song, hasStems, hasTrack]);

  const setLoop = useCallback((region: LoopRegion | null) => {
    setLoopState(region);
    if (hasStems) mixerRef.current.setLoop(region);
    else if (hasTrack) trackRef.current.setLoop(region);
  }, [hasStems, hasTrack]);

  const setStemGain = useCallback((label: StemLabel, gain: number) => {
    mixerRef.current.setStemGain(label, gain);
    updateStemChannels();
  }, []);

  const toggleStemMute = useCallback((label: StemLabel) => {
    mixerRef.current.toggleMute(label);
    updateStemChannels();
  }, []);

  const toggleStemSolo = useCallback((label: StemLabel) => {
    mixerRef.current.toggleSolo(label);
    updateStemChannels();
  }, []);

  const toggleClick = useCallback(() => {
    clickEnabledRef.current = !clickEnabledRef.current;
    setClickMuted(!clickEnabledRef.current);
    // Persist to DB so drawer choice sticks across sessions (D-171)
    updatePlayerPrefs({ player_click_enabled: clickEnabledRef.current });
    if (engineState === 'playing') {
      if (clickEnabledRef.current) {
        clickRef.current.start();
      } else {
        clickRef.current.stop();
      }
    }
  }, [engineState]);

  const setClickGain = useCallback((gain: number) => {
    const clamped = Math.max(0, Math.min(1, gain));
    setClickGainState(clamped);
    clickRef.current.configure({ gain: clamped });
  }, []);

  const setTrackGain = useCallback((gain: number) => {
    const clamped = Math.max(0, Math.min(1, gain));
    setTrackGainState(clamped);
    if (mixerRef.current.isLoaded()) {
      // When stems are loaded, set master gain on mixer
      // Each stem has individual gain via setStemGain
    } else {
      trackRef.current.setGain(clamped);
    }
  }, []);

  const toggleTrackMute = useCallback(() => {
    setTrackMuted(prev => {
      const willMute = !prev;
      if (mixerRef.current.isLoaded()) {
        // no-op: stems have individual mutes
      } else {
        trackRef.current.setGain(willMute ? 0 : trackGain);
      }
      return willMute;
    });
  }, [trackGain]);

  const state: AudioEngineState = {
    loading,
    error,
    song,
    beatMap,
    stems,
    prefs,
    engineState,
    currentTime,
    duration,
    speed,
    loop,
    currentBeat,
    currentBar,
    beatFlash,
    songComplete,
    waveformData,
    stemChannels,
    subdivision,
    countInBars,
    nudgeOffsetMs,
    clickGain,
    clickMuted,
    trackGain,
    trackMuted,
    fftData: fftDataRef.current,
    beatIntensity: beatIntensityRef.current,
    barTargets: barTargetsRef.current,
  };

  const actions: AudioEngineActions = {
    play,
    pause,
    stop,
    seek,
    setSpeed,
    setLoop,
    setStemGain,
    toggleStemMute,
    toggleStemSolo,
    toggleClick,
    setClickGain,
    setTrackGain,
    toggleTrackMute,
    setSubdivision: (sub: number) => {
      setSubdivisionState(sub);
      clickRef.current.configure({ subdivision: sub });
    },
    setCountIn: (bars: number) => {
      setCountInBarsState(bars);
      clickRef.current.configure({ countInBars: bars });
    },
    nudge: (direction: -1 | 1) => {
      const step = direction * 5; // 5ms per nudge
      setNudgeOffsetMs(prev => {
        const next = prev + step;
        clickRef.current.configure({ beatOffsetMs: (song?.beat_offset_ms ?? 0) + next });
        return next;
      });
    },
    resetNudge: () => {
      setNudgeOffsetMs(0);
      clickRef.current.configure({ beatOffsetMs: song?.beat_offset_ms ?? 0 });
    },
  };

  return [state, actions];
}
