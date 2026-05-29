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
import {
  GRADES, PRESETS, type Grade, type MemberId,
  applyPreset, defaultPresetIdFor, effectiveMuted,
  emptyMixState, findPreset, type MixState, type Preset,
} from './presets';
import { faderToGain, formatDb } from './fader';
import './PracticeMixer.css';

const MEMBER_STORAGE_KEY = 'tgt.practice.member';

// Shape we expect for setlist_entries.practice_stems_refs JSON.
interface StemRefs {
  demucs?: Partial<Record<'vocals' | 'drums' | 'bass' | 'other', string>>;
  multitrack?: Partial<Record<'drums' | 'bass' | 'guitar' | 'lead' | 'bv' | 'other', string>>;
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
  // Demucs is the only grade with real audio in Slice 2. Multitrack chip is
  // shown disabled with "needs MT" badging per the locked spec.
  const [grade, setGrade] = useState<Grade>('demucs');
  const [member, setMemberState] = useState<MemberId>(loadMember);
  const [presetId, setPresetId] = useState<string>(() => defaultPresetIdFor(loadMember(), 'demucs'));
  const [state, dispatch] = useReducer(mixReducer, undefined, () => {
    const start = emptyMixState();
    const preset = findPreset('demucs', defaultPresetIdFor(loadMember(), 'demucs'));
    return preset ? applyPreset(start, preset) : start;
  });

  // Transport state
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [stemsReady, setStemsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const mixerRef = useRef<StemMixer | null>(null);

  // Build the list of stems we can actually load for the current grade.
  const playableStems = useMemo(() => {
    if (grade !== 'demucs') return [];
    const demucs = refs.demucs ?? {};
    const stems: Array<{ id: string; label: StemLabel; url: string }> = [];
    for (const s of GRADES.demucs.stems) {
      const url = demucs[s.id as keyof typeof demucs];
      if (url) stems.push({ id: s.id, label: s.id as StemLabel, url });
    }
    return stems;
  }, [grade, refs]);

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

  // ── Transport ──────────────────────────────────────────────────────────
  const play = useCallback(async () => {
    const mixer = mixerRef.current;
    if (!mixer || !stemsReady) return;
    await AudioEngine.resume();
    mixer.play(currentTime > 0 ? currentTime : undefined);
    setPlaying(true);
    AudioEngine.setState('playing');
    AudioEngine.startTick(() => {
      const pos = mixer.getPosition();
      setCurrentTime(pos);
      if (pos >= mixer.getDuration() - 0.05) {
        mixer.pause();
        setPlaying(false);
        setCurrentTime(0);
        AudioEngine.stopTick();
        AudioEngine.setState('idle');
      }
    });
  }, [stemsReady, currentTime]);

  const pause = useCallback(() => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    mixer.pause();
    setPlaying(false);
    AudioEngine.stopTick();
    AudioEngine.setState('paused');
  }, []);

  const seek = useCallback((sec: number) => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    const clamped = Math.max(0, Math.min(sec, mixer.getDuration()));
    mixer.seek(clamped);
    setCurrentTime(clamped);
  }, []);

  const restart = useCallback(() => seek(0), [seek]);

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

  // Member/preset bootstrap if grade changes (Slice 2: multitrack is locked
  // so this only runs if a future Slice opens it).
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
                  playing={playing}
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

          <CloudStatus ready={stemsReady} error={loadError} />
        </div>

        <div className="pm-transport">
          <Scrubber
            currentTime={currentTime}
            duration={duration}
            onSeek={seek}
          />
          <div className="pm-transport-controls">
            <button className="pm-t-btn" onClick={restart} title="Restart" disabled={!stemsReady}>↺</button>
            <button
              className="pm-t-play"
              onClick={playing ? pause : play}
              disabled={!stemsReady}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <button className="pm-t-btn loop" disabled title="A–B loop ships in Slice 3">
              <span>⟲</span><span className="pm-t-loop-label">A–B</span>
            </button>
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
  stem, level, mute, solo, effectivelyMuted, playing,
  onLevel, onMute, onSolo,
}: {
  stem: { id: string; name: string; accent: string; bv?: boolean };
  level: number;
  mute: boolean;
  solo: boolean;
  effectivelyMuted: boolean;
  playing: boolean;
  onLevel: (value: number) => void;
  onMute: () => void;
  onSolo: () => void;
}) {
  // Slice 2 punts on per-stem analyser meters — show the fader value as a
  // static meter bar while playing so the visual stays alive without faking
  // audio levels. Real meters land with Slice 3 (per S190 brief).
  const meterHeight = effectivelyMuted || !playing ? 0 : Math.round(level * 78);
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
          <div className="pm-meter-fill" style={{ height: `${meterHeight}%` }} />
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

function Scrubber({ currentTime, duration, onSeek }: {
  currentTime: number;
  duration: number;
  onSeek: (sec: number) => void;
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
        <div className="pm-scrub-fill" style={{ width: `${pct}%` }} />
        <div className="pm-scrub-playhead" style={{ left: `${pct}%` }} />
      </div>
      <span className="pm-t-time">{formatTime(duration)}</span>
    </div>
  );
}
