// Band Practice Stem Mixer — page mounted at /practice/:setlistEntryId.
// Reads setlist_entries row → resolves practice_audio_ref +
// practice_stems_refs.demucs URLs → loads them through the existing
// StemMixer audio engine. UI = mockup parity from
// Dev Team/mockups/tgt-web--band-practice-stem-mixer.html.

import { useEffect, useMemo, useReducer, useRef, useState, useCallback } from 'react';
import { supabase } from '../supabase/client';
import type { SetlistEntry, SetlistListId } from '@shared/supabase/types';
import { SETLIST_LIST_LABELS } from '@shared/supabase/types';
import { StemMixer, type StemLabel } from '../audio/StemMixer';
import { AudioEngine } from '../audio/AudioEngine';
import { ClickScheduler } from '../audio/ClickScheduler';
import {
  GRADES, PRESETS, type Grade, type MemberId,
  applyPreset, defaultPresetIdFor, effectiveMuted,
  emptyMixState, findPreset, type MixState, type Preset,
} from './presets';
import { faderToGain, formatDb } from './fader';
import { transpose, formatSemitones } from './transpose';
import ChordRibbon from './ChordRibbon';
import { fetchBeatmap, sectionColor, type Beatmap, type BeatmapSection } from './beatmap';
import './PracticeMixer.css';

const MEMBER_STORAGE_KEY = 'tgt.practice.member';

// Shape we expect for setlist_entries.practice_stems_refs JSON. S191 batch B:
// `beatmap` is the URL to the .beats.json sidecar uploaded by the MS host
// publish flow (StemPublishService → R2 → setlist_entries.practice_stems_refs.beatmap).
// `multitrack` is the per-stem URL set for the 6-stem grade (D-batchB-schema-1
// canonical layout: drums / bass / guitar / lead / bv / other).
interface StemRefs {
  demucs?: Partial<Record<'vocals' | 'drums' | 'bass' | 'other', string>>;
  multitrack?: Partial<Record<'drums' | 'bass' | 'guitar' | 'lead' | 'bv' | 'other', string>>;
  beatmap?: string;
}

function parseStemRefs(value: unknown): StemRefs | null {
  if (!value || typeof value !== 'object') return null;
  return value as StemRefs;
}

function loadMember(): MemberId {
  if (typeof window === 'undefined') return 'neil';
  const stored = window.localStorage.getItem(MEMBER_STORAGE_KEY);
  if (stored === 'james' || stored === 'adam' || stored === 'neil') return stored;
  return 'neil';
}

function saveMember(member: MemberId): void {
  try { window.localStorage.setItem(MEMBER_STORAGE_KEY, member); } catch { /* private mode */ }
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Wire a ClickScheduler to either beatmap-driven (`loadBeatMap`) or constant-BPM
 * playback. Beatmap path scales beats by setSpeed; constant path scales BPM by
 * tempoPct. Centralised so the three callers (play/tempo-change/click-toggle)
 * stay consistent — see [[feedback--build-glue-not-parity]].
 */
function configureClickEngine(
  click: ClickScheduler,
  beatmap: Beatmap | null,
  baseBpm: number,
  tempoPct: number,
): void {
  if (beatmap && beatmap.beats.length > 0) {
    click.loadBeatMap(beatmap.beats);
    click.setSpeed(tempoPct / 100);
    // Configure with the sidecar's BPM as a fallback (used when the beat map
    // is exhausted — ClickScheduler falls back to constant BPM).
    click.configure({ bpm: baseBpm * (tempoPct / 100) });
  } else {
    click.clearBeatMap();
    click.configure({ bpm: baseBpm * (tempoPct / 100) });
  }
}

/** Locate the section that contains `currentTime`. Returns null when no match. */
function findCurrentSection(
  sections: BeatmapSection[] | undefined,
  currentTime: number,
): BeatmapSection | null {
  if (!sections || sections.length === 0) return null;
  for (const s of sections) {
    if (currentTime >= s.startSec && currentTime < s.endSec) return s;
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// MixState reducer — single source of truth for fader/mute/solo
// ──────────────────────────────────────────────────────────────────────────

type MixAction =
  | { type: 'set_level'; id: string; value: number }
  | { type: 'toggle_mute'; id: string }
  | { type: 'toggle_solo'; id: string }
  | { type: 'apply_preset'; preset: Preset }
  | { type: 'reset' };

function mixReducer(state: MixState, action: MixAction): MixState {
  switch (action.type) {
    case 'set_level':
      return { ...state, level: { ...state.level, [action.id]: action.value } };
    case 'toggle_mute':
      return { ...state, mute: { ...state.mute, [action.id]: !state.mute[action.id] } };
    case 'toggle_solo':
      return { ...state, solo: { ...state.solo, [action.id]: !state.solo[action.id] } };
    case 'apply_preset':
      return applyPreset(state, action.preset);
    case 'reset':
      return emptyMixState();
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Page entry — reads the setlist entry id from the URL
// ──────────────────────────────────────────────────────────────────────────

export function PracticeMixerPage() {
  const entryId = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const m = window.location.pathname.match(/^\/practice\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : '';
  }, []);

  const [entry, setEntry] = useState<SetlistEntry | null>(null);
  const [error, setError] = useState<string | null>(() => entryId ? null : 'No setlist entry specified in URL.');
  const [loading, setLoading] = useState(() => !!entryId);

  useEffect(() => {
    if (!entryId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('setlist_entries')
        .select('*')
        .eq('id', entryId)
        .single();
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setEntry(data as SetlistEntry);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [entryId]);

  if (loading) {
    return (
      <div className="pm-root">
        <div className="pm-phone"><div className="pm-loading">Loading practice mix…</div></div>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="pm-root">
        <div className="pm-phone">
          <div className="pm-error">
            {error ?? 'Setlist entry not found.'}<br />
            <a href="/">← Back to Timetree</a>
          </div>
        </div>
      </div>
    );
  }

  const refs = parseStemRefs(entry.practice_stems_refs);
  if (!refs?.demucs && !entry.practice_audio_ref) {
    return (
      <div className="pm-root">
        <div className="pm-phone">
          <div className="pm-error">
            No practice audio published for "{entry.title}" yet.<br />
            Publish from the Media Server PWA first.<br />
            <a href="/">← Back to Timetree</a>
          </div>
        </div>
      </div>
    );
  }

  return <PracticeMixer entry={entry} refs={refs ?? {}} />;
}

// ──────────────────────────────────────────────────────────────────────────
// Mixer surface (only mounted when we have stems to play)
// ──────────────────────────────────────────────────────────────────────────

function PracticeMixer({ entry, refs }: { entry: SetlistEntry; refs: StemRefs }) {
  // S191 batch B: default to multitrack when a gig render is published, else fall
  // back to Demucs. The grade chip in the UI still lets the band switch.
  const initialGrade: Grade = refs.multitrack ? 'multitrack' : 'demucs';
  const [grade, setGrade] = useState<Grade>(initialGrade);
  const [member, setMemberState] = useState<MemberId>(loadMember);
  const [presetId, setPresetId] = useState<string>(() => defaultPresetIdFor(loadMember(), initialGrade));
  const [state, dispatch] = useReducer(mixReducer, undefined, () => {
    const start = emptyMixState();
    const preset = findPreset(initialGrade, defaultPresetIdFor(loadMember(), initialGrade));
    return preset ? applyPreset(start, preset) : start;
  });

  // Transport state
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [stemsReady, setStemsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Slice 3: practice tools — tempo (50–100%, pitch-preserved), key (±6
  // semitones, tempo-preserved), constant-BPM click, A-B loop.
  const [tempoPct, setTempoPct] = useState(100);
  const [semitones, setSemitones] = useState(0);
  const [clickOn, setClickOn] = useState(false);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [loopOn, setLoopOn] = useState(false);
  // S191 batch B: beatmap loaded from refs.beatmap (R2 .beats.json sidecar).
  // Drives ClickScheduler.loadBeatMap for the click engine; drives section
  // overlay rendering on the scrub-bar; drives current-section label in the
  // chord ribbon. Null until fetch completes or when refs.beatmap is absent.
  const [beatmap, setBeatmap] = useState<Beatmap | null>(null);

  const mixerRef = useRef<StemMixer | null>(null);
  const clickRef = useRef<ClickScheduler | null>(null);
  // Per-stem meter DOM refs — tick loop writes height directly to avoid
  // re-rendering the strip grid every frame.
  const meterRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const setMeterRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) meterRefs.current.set(id, el);
    else meterRefs.current.delete(id);
  }, []);

  // Base BPM for click + key-display chord transposition. S191 batch B: when
  // the beatmap sidecar provides a tempo (top-level bpm or first tempoMap
  // segment), use it as a fallback so click works on songs without a
  // setlist-level BPM set. entry.bpm wins when present (user override).
  const baseBpm = entry.bpm ?? (beatmap?.tempoMap?.[0]?.bpm ?? beatmap?.bpm) ?? null;
  const baseKey = entry.notes?.match(/\bkey\s*[:=]?\s*([A-G][#b]?m?)/i)?.[1] ?? 'A';

  // Build the list of stems we can actually load for the current grade.
  // S191 batch B: multitrack grade now loads when refs.multitrack is populated —
  // StemLabel was widened with 'lead' | 'bv' so all 6 stems flow through the
  // existing StemMixer + TrackPlayer surface (no parallel engine — build-glue-not-parity).
  const playableStems = useMemo(() => {
    const stems: Array<{ id: string; label: StemLabel; url: string }> = [];
    if (grade === 'multitrack') {
      const mt = refs.multitrack ?? {};
      for (const s of GRADES.multitrack.stems) {
        const url = mt[s.id as keyof typeof mt];
        if (url) stems.push({ id: s.id, label: s.id as StemLabel, url });
      }
    } else {
      const demucs = refs.demucs ?? {};
      for (const s of GRADES.demucs.stems) {
        const url = demucs[s.id as keyof typeof demucs];
        if (url) stems.push({ id: s.id, label: s.id as StemLabel, url });
      }
    }
    return stems;
  }, [grade, refs]);

  // ── Fetch beatmap sidecar from R2 when refs.beatmap is set ────────────
  // One fetch per practice session — the sidecar is tiny JSON, no need for
  // cache-busting; ClickScheduler reads from beatmap.beats on every click toggle.
  useEffect(() => {
    let cancelled = false;
    setBeatmap(null);
    if (!refs.beatmap) return;
    (async () => {
      const bm = await fetchBeatmap(refs.beatmap!);
      if (!cancelled) setBeatmap(bm);
    })();
    return () => { cancelled = true; };
  }, [refs.beatmap]);

  // ── Load stems on mount / grade change ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setStemsReady(false);
    setLoadError(null);
    setDuration(0);
    setCurrentTime(0);

    if (playableStems.length === 0) return;

    const mixer = new StemMixer();
    mixerRef.current = mixer;

    (async () => {
      try {
        await mixer.loadStems(playableStems.map(s => ({ label: s.label, url: s.url })));
        if (cancelled) { mixer.dispose(); return; }
        setDuration(mixer.getDuration());
        setStemsReady(true);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load stems');
      }
    })();

    return () => {
      cancelled = true;
      mixer.dispose();
      AudioEngine.stopTick();
      if (mixerRef.current === mixer) mixerRef.current = null;
    };
  }, [playableStems]);

  // ── Apply current MixState → StemMixer per-channel gain ────────────────
  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer || !stemsReady) return;
    for (const s of playableStems) {
      const lvl = state.level[s.id] ?? 0.75;
      const muted = effectiveMuted(s.id, state);
      mixer.setStemGain(s.label, muted ? 0 : faderToGain(lvl));
    }
  }, [state, playableStems, stemsReady]);

  // ── Tempo: drive both stem playback rate and click BPM ────────────────
  useEffect(() => {
    mixerRef.current?.setSpeed(tempoPct / 100);
    if (clickRef.current && baseBpm) {
      configureClickEngine(clickRef.current, beatmap, baseBpm, tempoPct);
    }
  }, [tempoPct, baseBpm, beatmap]);

  // ── Key: pitch shift independent of tempo ──────────────────────────────
  useEffect(() => {
    mixerRef.current?.setSemitones(semitones);
  }, [semitones]);

  // ── Loop region: feed StemMixer when the loop is engaged ──────────────
  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    if (loopOn && loopA !== null && loopB !== null && loopB > loopA) {
      mixer.setLoop({ start: loopA, end: loopB });
    } else {
      mixer.setLoop(null);
    }
  }, [loopOn, loopA, loopB]);

  // ── Transport ──────────────────────────────────────────────────────────
  const play = useCallback(async () => {
    const mixer = mixerRef.current;
    if (!mixer || !stemsReady) return;
    await AudioEngine.resume();
    mixer.play(currentTime > 0 ? currentTime : undefined);
    setPlaying(true);
    AudioEngine.setState('playing');
    // Slice 3: click ticks with transport when enabled. S191 batch B: when a
    // beatmap is loaded, the scheduler fires on the sidecar's per-beat timestamps
    // (handles tempo changes for free). Otherwise fall back to constant BPM.
    if (clickOn && clickRef.current && baseBpm) {
      configureClickEngine(clickRef.current, beatmap, baseBpm, tempoPct);
      clickRef.current.setMuted(false);
      clickRef.current.start();
    }
    AudioEngine.startTick(() => {
      const pos = mixer.getPosition();
      setCurrentTime(pos);
      // Loop wraparound — StemMixer handles seek; we keep currentTime fresh
      mixer.checkLoop();
      // Per-stem meter DOM updates (no React re-render)
      for (const s of playableStems) {
        const el = meterRefs.current.get(s.id);
        if (!el) continue;
        const db = mixer.getMeterDb(s.label);
        // Map -60..0 dB → 0..100% with a light non-linear curve so quiet
        // signals get a visible nudge without clipping at 0 dB.
        const norm = db === -Infinity ? 0 : Math.max(0, Math.min(1, (db + 60) / 60));
        el.style.height = `${Math.round(norm * 100)}%`;
      }
      if (pos >= mixer.getDuration() - 0.05 && !(loopOn && loopA !== null && loopB !== null)) {
        mixer.pause();
        clickRef.current?.stop();
        setPlaying(false);
        setCurrentTime(0);
        AudioEngine.stopTick();
        AudioEngine.setState('idle');
        // Zero meters on stop
        for (const el of meterRefs.current.values()) el.style.height = '0%';
      }
    });
  }, [stemsReady, currentTime, clickOn, baseBpm, tempoPct, loopOn, loopA, loopB, playableStems, beatmap]);

  const pause = useCallback(() => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    mixer.pause();
    clickRef.current?.stop();
    setPlaying(false);
    AudioEngine.stopTick();
    AudioEngine.setState('paused');
    for (const el of meterRefs.current.values()) el.style.height = '0%';
  }, []);

  const seek = useCallback((sec: number) => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    const clamped = Math.max(0, Math.min(sec, mixer.getDuration()));
    mixer.seek(clamped);
    setCurrentTime(clamped);
  }, []);

  const restart = useCallback(() => seek(0), [seek]);

  // ── A-B loop handlers ──────────────────────────────────────────────────
  const setMarkerA = useCallback(() => setLoopA(currentTime), [currentTime]);
  const setMarkerB = useCallback(() => setLoopB(currentTime), [currentTime]);
  const clearLoop = useCallback(() => {
    setLoopA(null);
    setLoopB(null);
    setLoopOn(false);
  }, []);
  const toggleLoop = useCallback(() => setLoopOn(v => !v), []);

  // S191 batch B: tap a section overlay → set loop to its bounds + engage.
  const loopSection = useCallback((s: BeatmapSection) => {
    setLoopA(s.startSec);
    setLoopB(s.endSec);
    setLoopOn(true);
    // Snap playhead to section start so the loop engages immediately.
    seek(s.startSec);
  }, [seek]);

  // ── Click engine lifecycle ────────────────────────────────────────────
  useEffect(() => {
    clickRef.current = new ClickScheduler();
    return () => {
      clickRef.current?.stop();
      clickRef.current = null;
    };
  }, []);

  // Toggling click mid-playback: start/stop without restarting transport
  useEffect(() => {
    const click = clickRef.current;
    if (!click || !baseBpm) return;
    if (clickOn && playing) {
      configureClickEngine(click, beatmap, baseBpm, tempoPct);
      click.setMuted(false);
      if (!click.isActive()) click.start();
    } else {
      click.setMuted(true);
      click.stop();
    }
  }, [clickOn, playing, baseBpm, tempoPct, beatmap]);

  // ── Member / preset / grade handlers ──────────────────────────────────
  const handleMember = useCallback((m: MemberId) => {
    setMemberState(m);
    saveMember(m);
    const id = defaultPresetIdFor(m, grade);
    setPresetId(id);
    const preset = findPreset(grade, id);
    if (preset) dispatch({ type: 'apply_preset', preset });
  }, [grade]);

  const handlePreset = useCallback((id: string) => {
    setPresetId(id);
    const preset = findPreset(grade, id);
    if (preset) dispatch({ type: 'apply_preset', preset });
  }, [grade]);

  // Member/preset bootstrap if grade changes. S191 batch B: multitrack now
  // ships enabled when refs.multitrack is present — this swaps the preset to a
  // grade-valid one (BV-bound presets are dropped when leaving multitrack).
  useEffect(() => {
    let next = presetId;
    if (!findPreset(grade, next)) next = 'full';
    const preset = findPreset(grade, next);
    if (preset?.bvOnly && grade !== 'multitrack') next = 'full';
    if (next !== presetId) setPresetId(next);
    const applied = findPreset(grade, next);
    if (applied) dispatch({ type: 'apply_preset', preset: applied });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="pm-root">
      <div className="pm-phone">
        <div className="pm-statusbar">
          <span>{formatTime(currentTime)}</span>
          <span><span className="pm-brand-green">Tangerine</span> <span className="pm-brand-orange">Web</span></span>
          <span>practice</span>
        </div>

        <header className="pm-header">
          <button className="pm-back-btn" onClick={() => { window.location.href = '/'; }} aria-label="Back">‹</button>
          <div className="pm-header-titles">
            <div className="pm-header-song">{entry.title}</div>
            <div className="pm-header-artist">{entry.artist ?? '—'}</div>
          </div>
          <span className="pm-setlist-pill">{SETLIST_LIST_LABELS[entry.list_id as SetlistListId]}</span>
        </header>

        <div className="pm-scroll-body">
          <div className="pm-block-label">Stem source</div>
          <div className="pm-grade-seg">
            <button
              className={`pm-grade-opt ${grade === 'multitrack' ? 'active' : ''}`}
              onClick={() => setGrade('multitrack')}
              disabled={!refs.multitrack}
              title={refs.multitrack ? '' : 'No multitrack stems published yet'}
            >
              Multitrack<small>{refs.multitrack ? 'our gig · 6 stems' : 'needs gig recording'}</small>
            </button>
            <button
              className={`pm-grade-opt ${grade === 'demucs' ? 'active' : ''}`}
              onClick={() => setGrade('demucs')}
              disabled={!refs.demucs}
            >
              Demucs<small>original · 4 stems</small>
            </button>
          </div>

          <div className="pm-block-label" style={{ marginTop: 14 }}>
            Who's practising? <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--pm-color-text-muted)' }}>· remembered on this device</span>
          </div>
          <div className="pm-member-row">
            {(['james', 'adam', 'neil'] as MemberId[]).map(m => (
              <button
                key={m}
                className={`pm-member-pill ${member === m ? 'active' : ''}`}
                onClick={() => handleMember(m)}
              >
                {m === 'james' ? 'James' : m === 'adam' ? 'Adam' : 'Neil'}
                <small>{m === 'james' ? 'lead vox' : m === 'adam' ? 'guitar · BV' : 'bass'}</small>
              </button>
            ))}
          </div>

          <div className="pm-block-label" style={{ marginTop: 14 }}>Practice preset</div>
          <PresetChips grade={grade} presetId={presetId} onSelect={handlePreset} />
          <PresetNote grade={grade} />

          <div className="pm-block-label" style={{ marginTop: 14 }}>
            Stems <span style={{ color: 'var(--pm-color-text-dim)' }}>· {GRADES[grade].stems.length} · {GRADES[grade].label}</span>
          </div>
          <div className="pm-stems-card">
            <div className="pm-strip-grid">
              {GRADES[grade].stems.map(s => (
                <StemStrip
                  key={s.id}
                  stem={s}
                  level={state.level[s.id] ?? 0.75}
                  mute={!!state.mute[s.id]}
                  solo={!!state.solo[s.id]}
                  effectivelyMuted={effectiveMuted(s.id, state)}
                  meterRef={(el) => setMeterRef(s.id, el)}
                  onLevel={(v) => {
                    dispatch({ type: 'set_level', id: s.id, value: v });
                    if (presetId !== 'custom') setPresetId('custom');
                  }}
                  onMute={() => {
                    dispatch({ type: 'toggle_mute', id: s.id });
                    if (presetId !== 'custom') setPresetId('custom');
                  }}
                  onSolo={() => {
                    dispatch({ type: 'toggle_solo', id: s.id });
                    if (presetId !== 'custom') setPresetId('custom');
                  }}
                />
              ))}
            </div>
          </div>

          <div className="pm-block-label" style={{ marginTop: 14 }}>Practice tools</div>
          <PracticeTools
            tempoPct={tempoPct}
            onTempoChange={setTempoPct}
            semitones={semitones}
            onSemitonesChange={setSemitones}
            clickOn={clickOn}
            onClickToggle={() => setClickOn(v => !v)}
            baseBpm={baseBpm}
            baseKey={baseKey}
          />

          <CloudStatus ready={stemsReady} error={loadError} />
        </div>

        <div className="pm-transport">
          {/* Batch C: read-only chord ribbon (now / next 3 + key). Hidden when entry has no chord_text and no key.
              S191 batch B: when a beatmap with sections is loaded, surface the current section name. */}
          <ChordRibbon
            entry={entry}
            currentTime={currentTime}
            duration={duration}
            semitones={semitones}
            sectionLabel={findCurrentSection(beatmap?.sections, currentTime)?.label ?? null}
          />
          <Scrubber
            currentTime={currentTime}
            duration={duration}
            loopA={loopA}
            loopB={loopB}
            loopOn={loopOn}
            onSeek={seek}
            sections={beatmap?.sections}
            onLoopSection={loopSection}
          />
          <div className="pm-transport-controls">
            <button className="pm-t-btn" onClick={restart} title="Restart" disabled={!stemsReady}>↺</button>
            <button
              className="pm-ab-btn"
              onClick={setMarkerA}
              disabled={!stemsReady}
              title="Set A marker at current position"
              aria-label="Set loop start"
            >A</button>
            <button
              className="pm-t-play"
              onClick={playing ? pause : play}
              disabled={!stemsReady}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <button
              className="pm-ab-btn"
              onClick={setMarkerB}
              disabled={!stemsReady}
              title="Set B marker at current position"
              aria-label="Set loop end"
            >B</button>
            <button
              className={`pm-t-btn loop ${loopOn ? 'on' : ''}`}
              onClick={toggleLoop}
              disabled={!stemsReady || loopA === null || loopB === null || loopB <= loopA}
              title={loopA === null || loopB === null ? 'Tap A then B to set the loop region' : (loopOn ? 'Loop on — tap to disable' : 'Loop off — tap to enable')}
            >
              <span>⟲</span><span className="pm-t-loop-label">A–B</span>
            </button>
            {(loopA !== null || loopB !== null) && (
              <button className="pm-t-btn pm-t-clear" onClick={clearLoop} title="Clear loop markers" aria-label="Clear loop">×</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────

function PresetChips({ grade, presetId, onSelect }: {
  grade: Grade;
  presetId: string;
  onSelect: (id: string) => void;
}) {
  // BV/harmony presets only ship visibly enabled on multitrack. On Demucs
  // we still surface them disabled with "needs MT" so the band sees the
  // capability exists.
  const list = useMemo(() => {
    const own = PRESETS[grade].map(p => ({ p, disabled: false }));
    if (grade === 'demucs') {
      const mtOnly = PRESETS.multitrack.filter(p => p.bvOnly).map(p => ({ p, disabled: true }));
      return [...own, ...mtOnly];
    }
    return own;
  }, [grade]);

  return (
    <div className="pm-preset-scroll">
      {list.map(({ p, disabled }) => (
        <button
          key={p.id}
          className={`pm-preset-chip ${!disabled && p.id === presetId ? 'active' : ''}`}
          disabled={disabled}
          onClick={() => onSelect(p.id)}
          title={disabled ? 'Needs the multitrack (our gig) source' : ''}
        >
          {p.label}
          {disabled && <span className="pm-mt-only"> needs MT</span>}
        </button>
      ))}
    </div>
  );
}

function PresetNote({ grade }: { grade: Grade }) {
  if (grade === 'demucs') {
    return (
      <div className="pm-preset-note">
        Demucs splits the original into 4 — vocals can't be split into lead vs BV, so{' '}
        <strong style={{ color: 'var(--pm-color-text-dim)' }}>harmony / BV presets need the multitrack (our gig) source.</strong>
      </div>
    );
  }
  return (
    <div className="pm-preset-note">
      Multitrack = our own gig recording with a separate{' '}
      <strong style={{ color: 'var(--pm-color-practice)' }}>BV</strong> channel — mute it to practise harmonies.
    </div>
  );
}

function StemStrip({
  stem, level, mute, solo, effectivelyMuted,
  meterRef, onLevel, onMute, onSolo,
}: {
  stem: { id: string; name: string; accent: string; bv?: boolean };
  level: number;
  mute: boolean;
  solo: boolean;
  effectivelyMuted: boolean;
  meterRef: (el: HTMLDivElement | null) => void;
  onLevel: (value: number) => void;
  onMute: () => void;
  onSolo: () => void;
}) {
  // Slice 3: meter height driven by the rAF tick loop via meterRef
  // (writes style.height directly to bypass React re-renders for ~60 fps
  // updates). Initial height = 0 — first tick fills it in.
  const popupRef = useRef<HTMLDivElement>(null);

  const showPopup = (clientX: number, clientY: number) => {
    const el = popupRef.current;
    if (!el) return;
    el.classList.add('visible');
    el.style.left = Math.min(clientX + 16, window.innerWidth - 110) + 'px';
    el.style.top = Math.max(clientY - 58, 8) + 'px';
    el.querySelector<HTMLElement>('.pm-fader-popup-label')!.textContent = stem.name;
    el.querySelector<HTMLElement>('.pm-fader-popup-value')!.textContent = formatDb(level) + ' dB';
  };
  const hidePopup = () => {
    popupRef.current?.classList.remove('visible');
  };

  return (
    <div
      className={`pm-stem-strip ${stem.bv ? 'bv' : ''} ${effectivelyMuted ? 'muted' : ''}`}
      style={{ ['--pm-accent' as string]: stem.accent }}
    >
      <div className="pm-stem-color-tag" />
      <div className="pm-stem-name">{stem.name}</div>
      <div className="pm-fader-meter-row">
        <div className="pm-meter">
          <div ref={meterRef} className="pm-meter-fill" style={{ height: '0%' }} />
        </div>
        <div className="pm-fader-container">
          <input
            className="pm-fader"
            type="range"
            min={0}
            max={1}
            step={0.005}
            value={level}
            onChange={(e) => onLevel(parseFloat(e.target.value))}
            onPointerDown={(e) => showPopup(e.clientX, e.clientY)}
            onPointerMove={(e) => { if (e.buttons > 0) showPopup(e.clientX, e.clientY); }}
            onPointerUp={hidePopup}
            onPointerCancel={hidePopup}
            onBlur={hidePopup}
          />
          <div ref={popupRef} className="pm-fader-popup">
            <div className="pm-fader-popup-label">—</div>
            <div className="pm-fader-popup-value">0.0 dB</div>
          </div>
        </div>
      </div>
      <div className="pm-fader-db">{formatDb(level)}</div>
      <div className="pm-stem-btns">
        <button
          className={`pm-stem-btn pm-mute-btn ${mute ? 'active' : ''}`}
          onClick={onMute}
          aria-pressed={mute}
        >M</button>
        <button
          className={`pm-stem-btn pm-solo-btn ${solo ? 'active' : ''}`}
          onClick={onSolo}
          aria-pressed={solo}
        >S</button>
      </div>
    </div>
  );
}

function CloudStatus({ ready, error }: { ready: boolean; error: string | null }) {
  if (error) {
    return (
      <div className="pm-cloud-status">
        <span className="pm-cs-dot error" /> couldn't load stems — {error}
      </div>
    );
  }
  return (
    <div className="pm-cloud-status">
      <span className={`pm-cs-dot ${ready ? '' : 'loading'}`} />
      {ready ? 'streaming from' : 'loading from'}{' '}
      <strong style={{ color: 'var(--pm-color-text-dim)', margin: '0 2px' }}>Cloudflare R2</strong>
      · no Tailscale needed
    </div>
  );
}

function Scrubber({ currentTime, duration, loopA, loopB, loopOn, onSeek, sections, onLoopSection }: {
  currentTime: number;
  duration: number;
  loopA: number | null;
  loopB: number | null;
  loopOn: boolean;
  onSeek: (sec: number) => void;
  /** S191 batch B: when present, render a thin band of coloured rects above the
   *  scrub-track. Tapping a rect calls onLoopSection(s). */
  sections?: BeatmapSection[];
  onLoopSection?: (s: BeatmapSection) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const seekFromPointer = (clientX: number) => {
    const el = ref.current;
    if (!el || duration <= 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  const loopStart = loopA !== null && duration > 0 ? Math.min(100, (loopA / duration) * 100) : null;
  const loopEnd = loopB !== null && duration > 0 ? Math.min(100, (loopB / duration) * 100) : null;
  const loopWidth = loopStart !== null && loopEnd !== null ? Math.max(0, loopEnd - loopStart) : null;

  return (
    <div className="pm-scrub-row">
      <span className="pm-t-time">{formatTime(currentTime)}</span>
      <div
        ref={ref}
        className="pm-scrub"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromPointer(e.clientX);
        }}
        onPointerMove={(e) => { if (e.buttons > 0) seekFromPointer(e.clientX); }}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={duration || 0}
        aria-valuenow={currentTime}
      >
        <div className="pm-scrub-track" />
        {sections && sections.length > 0 && duration > 0 && (
          <div className="pm-scrub-sections" aria-hidden>
            {sections.map((s, i) => {
              const left = (s.startSec / duration) * 100;
              const width = ((s.endSec - s.startSec) / duration) * 100;
              const isCurrent = currentTime >= s.startSec && currentTime < s.endSec;
              return (
                <button
                  key={`${i}-${s.label}`}
                  type="button"
                  className={`pm-scrub-seg ${isCurrent ? 'current' : ''}`}
                  style={{ left: `${left}%`, width: `${width}%`, background: sectionColor(s.kind) }}
                  title={`${s.label} — tap to loop`}
                  onClick={(e) => {
                    // Stop pointer-bubbling into the scrub track's seek handler.
                    e.stopPropagation();
                    onLoopSection?.(s);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <span className="pm-scrub-seg-label">{s.label}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="pm-scrub-fill" style={{ width: `${pct}%` }} />
        {loopStart !== null && loopWidth !== null && (
          <div
            className={`pm-scrub-loop ${loopOn ? 'on' : ''}`}
            style={{ left: `${loopStart}%`, width: `${loopWidth}%` }}
          />
        )}
        {loopStart !== null && loopWidth === null && (
          // Only A set so far — render a single marker
          <div className="pm-scrub-marker" style={{ left: `${loopStart}%` }} title="A" />
        )}
        <div className="pm-scrub-playhead" style={{ left: `${pct}%` }} />
      </div>
      <span className="pm-t-time">{formatTime(duration)}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Practice tools panel — Slice 3: tempo / key / click
// ──────────────────────────────────────────────────────────────────────────

function PracticeTools({
  tempoPct, onTempoChange,
  semitones, onSemitonesChange,
  clickOn, onClickToggle,
  baseBpm, baseKey,
}: {
  tempoPct: number;
  onTempoChange: (v: number) => void;
  semitones: number;
  onSemitonesChange: (v: number) => void;
  clickOn: boolean;
  onClickToggle: () => void;
  baseBpm: number | null;
  baseKey: string;
}) {
  const effectiveBpm = baseBpm ? Math.round(baseBpm * tempoPct / 100) : null;
  const effectiveKey = transpose(baseKey, semitones);

  return (
    <div className="pm-ptools">
      <div className="pm-ptool">
        <div className="pm-ptool-top">
          <span className="pm-ptool-name">Tempo</span>
          <span className="pm-ptool-val">{tempoPct}%{effectiveBpm ? ` · ${effectiveBpm}` : ''}</span>
        </div>
        <input
          className="pm-ptool-slider"
          type="range"
          min={50}
          max={100}
          step={1}
          value={tempoPct}
          onChange={(e) => onTempoChange(parseInt(e.target.value, 10))}
        />
      </div>
      <div className="pm-ptool">
        <div className="pm-ptool-top">
          <span className="pm-ptool-name">Key</span>
          <span className="pm-ptool-val">{effectiveKey} · {formatSemitones(semitones)}</span>
        </div>
        <div className="pm-stepper">
          <button
            onClick={() => onSemitonesChange(Math.max(-6, semitones - 1))}
            disabled={semitones <= -6}
            aria-label="Key down"
          >−</button>
          <span>{formatSemitones(semitones)} st</span>
          <button
            onClick={() => onSemitonesChange(Math.min(6, semitones + 1))}
            disabled={semitones >= 6}
            aria-label="Key up"
          >+</button>
        </div>
      </div>
      <div className="pm-ptool">
        <div className="pm-ptool-top">
          <span className="pm-ptool-name">Click</span>
          <span className="pm-ptool-val">{effectiveBpm ? `${effectiveBpm} BPM` : 'no BPM'}</span>
        </div>
        <button
          className={`pm-click-toggle ${clickOn ? 'on' : ''}`}
          onClick={onClickToggle}
          disabled={!baseBpm}
          title={baseBpm ? '' : 'Set this entry’s BPM in the setlist to enable click'}
        >
          {clickOn ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  );
}
