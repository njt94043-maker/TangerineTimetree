// S191 batch B — beatmap sidecar loader for the practice mixer.
//
// Source schema = S159 P2 `.beats.json` sidecar uploaded by the MS host
// `StemPublishService` to `songs/{songId}/beatmap.json` on R2.
//
// We accept BOTH v1 and v2 shapes; v1 (just `beats`+`bpm`+`beats_per_bar` or
// `beatsPerBar`) is treated as a single-tempo single-meter beatmap with no
// downbeat offset. Unknown extras pass through.
//
// `sections?: Array<{...}>` is the per-section overlay data the practice mixer
// renders on the scrub-bar — when present, the mixer renders a thin band of
// coloured rectangles and lets the user click-to-loop a section. When absent
// (the common case today; section detection isn't generated yet), no overlay.

export interface BeatmapMeter {
  atBeatIdx: number;
  beatsPerBar: number;
}

export interface BeatmapTempo {
  atBeatIdx: number;
  bpm: number;
}

/** One section in the beatmap timeline. Both seconds-based, mixer-friendly. */
export interface BeatmapSection {
  label: string;
  startSec: number;
  endSec: number;
  kind?: string; // verse | chorus | bridge | intro | outro | break | …
}

export interface Beatmap {
  beats: number[];
  bpm: number;
  beatsPerBar: number;
  downbeatBeatIdx?: number;
  meterMap?: BeatmapMeter[];
  tempoMap?: BeatmapTempo[];
  sections?: BeatmapSection[];
  schemaVersion?: 2;
}

/**
 * Fetch + parse a beatmap from a public URL (R2). Returns null on any failure
 * (network / parse / schema) so the consumer can fall back to constant BPM —
 * the practice mixer should never fail to load because of a missing beatmap.
 */
export async function fetchBeatmap(url: string): Promise<Beatmap | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    return normaliseBeatmap(j);
  } catch {
    return null;
  }
}

/**
 * Normalise an arbitrary JSON value into a Beatmap. Returns null when the
 * input isn't shaped like a beatmap. Pure (no I/O) so it's easy to test.
 *
 * Accepts:
 * - snake_case `beats_per_bar` (Python librosa output) and camelCase `beatsPerBar`.
 * - v1 (no maps) and v2 (with maps + downbeatBeatIdx).
 * - sections[] with either {label,startSec,endSec,kind} or {label,start,end}.
 */
export function normaliseBeatmap(raw: unknown): Beatmap | null {
  if (!raw || typeof raw !== 'object') return null;
  const j = raw as Record<string, unknown>;

  if (!Array.isArray(j.beats)) return null;
  const beats = (j.beats as unknown[])
    .map(b => (typeof b === 'number' ? b : Number.NaN))
    .filter(b => Number.isFinite(b)) as number[];
  if (beats.length === 0) return null;

  const beatsPerBar = pickInt(j.beatsPerBar) ?? pickInt(j.beats_per_bar) ?? 4;
  const bpm = pickNumber(j.bpm) ?? 0;

  const out: Beatmap = { beats, bpm, beatsPerBar };

  if (typeof j.downbeatBeatIdx === 'number') out.downbeatBeatIdx = j.downbeatBeatIdx;
  if (Array.isArray(j.meterMap)) {
    out.meterMap = (j.meterMap as unknown[])
      .map(parseMeter)
      .filter((m): m is BeatmapMeter => m !== null);
  }
  if (Array.isArray(j.tempoMap)) {
    out.tempoMap = (j.tempoMap as unknown[])
      .map(parseTempo)
      .filter((t): t is BeatmapTempo => t !== null);
  }
  if (Array.isArray(j.sections)) {
    out.sections = (j.sections as unknown[])
      .map(parseSection)
      .filter((s): s is BeatmapSection => s !== null);
  }
  if (j.schemaVersion === 2) out.schemaVersion = 2;
  return out;
}

function pickInt(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) ? v : null;
}
function pickNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function parseMeter(v: unknown): BeatmapMeter | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const at = pickInt(r.atBeatIdx);
  const bpb = pickInt(r.beatsPerBar);
  if (at === null || bpb === null) return null;
  return { atBeatIdx: at, beatsPerBar: bpb };
}
function parseTempo(v: unknown): BeatmapTempo | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const at = pickInt(r.atBeatIdx);
  const bpm = pickNumber(r.bpm);
  if (at === null || bpm === null) return null;
  return { atBeatIdx: at, bpm };
}
function parseSection(v: unknown): BeatmapSection | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const label = typeof r.label === 'string' ? r.label : null;
  // Accept startSec/endSec (preferred) OR start/end (older shape).
  const startSec = pickNumber(r.startSec) ?? pickNumber(r.start);
  const endSec = pickNumber(r.endSec) ?? pickNumber(r.end);
  if (!label || startSec === null || endSec === null || endSec <= startSec) return null;
  const kind = typeof r.kind === 'string' ? r.kind : undefined;
  return { label, startSec, endSec, kind };
}

/**
 * Stable colour per section kind. Matches the locked S190 mockup palette so
 * the on-bar overlay reads at a glance.
 */
export const SECTION_COLORS: Record<string, string> = {
  intro: '#4a4a60',
  verse: '#5B8DEF',
  chorus: '#f39c12',
  bridge: '#bb86fc',
  outro: '#4a4a60',
  break: '#1abc9c',
  solo: '#00e676',
};

export function sectionColor(kind: string | undefined): string {
  if (!kind) return '#5B8DEF';
  return SECTION_COLORS[kind.toLowerCase()] ?? '#5B8DEF';
}
