import { describe, it, expect } from 'vitest';
import { normaliseBeatmap, sectionColor, type Beatmap } from './beatmap';

describe('normaliseBeatmap', () => {
  it('parses a minimal v1 sidecar (snake_case beats_per_bar)', () => {
    const raw = { beats: [0, 0.5, 1.0, 1.5], bpm: 120, beats_per_bar: 4 };
    const bm = normaliseBeatmap(raw)!;
    expect(bm.beats).toEqual([0, 0.5, 1.0, 1.5]);
    expect(bm.bpm).toBe(120);
    expect(bm.beatsPerBar).toBe(4);
    expect(bm.schemaVersion).toBeUndefined();
  });

  it('parses a v2 sidecar with all maps + downbeat anchor', () => {
    const raw = {
      beats: [0, 0.5, 1.0],
      bpm: 120,
      beatsPerBar: 4,
      downbeatBeatIdx: 2,
      meterMap: [
        { atBeatIdx: 0, beatsPerBar: 4 },
        { atBeatIdx: 16, beatsPerBar: 3 },
      ],
      tempoMap: [
        { atBeatIdx: 0, bpm: 74 },
        { atBeatIdx: 32, bpm: 148 },
      ],
      schemaVersion: 2,
    };
    const bm = normaliseBeatmap(raw)!;
    expect(bm.downbeatBeatIdx).toBe(2);
    expect(bm.meterMap).toEqual([
      { atBeatIdx: 0, beatsPerBar: 4 },
      { atBeatIdx: 16, beatsPerBar: 3 },
    ]);
    expect(bm.tempoMap).toEqual([
      { atBeatIdx: 0, bpm: 74 },
      { atBeatIdx: 32, bpm: 148 },
    ]);
    expect(bm.schemaVersion).toBe(2);
  });

  it('rejects when beats[] is missing or empty', () => {
    expect(normaliseBeatmap({})).toBeNull();
    expect(normaliseBeatmap({ beats: [] })).toBeNull();
    expect(normaliseBeatmap({ beats: 'nope' })).toBeNull();
    expect(normaliseBeatmap(null)).toBeNull();
    expect(normaliseBeatmap(123)).toBeNull();
  });

  it('filters non-finite beat timestamps but accepts the rest', () => {
    const bm = normaliseBeatmap({ beats: [0, 1, NaN, 2, Infinity, 3], bpm: 60, beatsPerBar: 4 })!;
    expect(bm.beats).toEqual([0, 1, 2, 3]);
  });

  it('defaults beatsPerBar to 4 when absent in either casing', () => {
    const bm = normaliseBeatmap({ beats: [0, 1], bpm: 120 })!;
    expect(bm.beatsPerBar).toBe(4);
  });

  it('parses sections with startSec/endSec', () => {
    const raw = {
      beats: [0, 1],
      bpm: 120,
      sections: [
        { label: 'Intro', startSec: 0, endSec: 4, kind: 'intro' },
        { label: 'Verse', startSec: 4, endSec: 20, kind: 'verse' },
      ],
    };
    const bm = normaliseBeatmap(raw)!;
    expect(bm.sections).toEqual([
      { label: 'Intro', startSec: 0, endSec: 4, kind: 'intro' },
      { label: 'Verse', startSec: 4, endSec: 20, kind: 'verse' },
    ]);
  });

  it('accepts the older start/end section shape too', () => {
    const raw = {
      beats: [0, 1],
      bpm: 120,
      sections: [{ label: 'Chorus', start: 8, end: 16 }],
    };
    const bm = normaliseBeatmap(raw)!;
    expect(bm.sections).toEqual([{ label: 'Chorus', startSec: 8, endSec: 16 }]);
  });

  it('drops sections with bad bounds (end <= start, missing label, missing times)', () => {
    const raw = {
      beats: [0],
      bpm: 60,
      sections: [
        { label: 'Good', startSec: 0, endSec: 4 },
        { label: 'NoEnd', startSec: 0 },
        { startSec: 0, endSec: 4 },           // no label
        { label: 'Zero', startSec: 4, endSec: 4 }, // end == start
        { label: 'Neg', startSec: 8, endSec: 5 },  // end < start
      ],
    };
    const bm = normaliseBeatmap(raw)!;
    expect(bm.sections).toEqual([{ label: 'Good', startSec: 0, endSec: 4 }]);
  });

  it('treats v1 sidecar (no maps/sections) as a single-tempo single-meter beatmap', () => {
    const bm = normaliseBeatmap({ beats: [0, 1, 2], bpm: 100, beats_per_bar: 4 })!;
    expect(bm.meterMap).toBeUndefined();
    expect(bm.tempoMap).toBeUndefined();
    expect(bm.sections).toBeUndefined();
    expect(bm.downbeatBeatIdx).toBeUndefined();
  });
});

describe('sectionColor', () => {
  it('returns a stable colour per known kind', () => {
    expect(sectionColor('verse')).toBe('#5B8DEF');
    expect(sectionColor('chorus')).toBe('#f39c12');
    expect(sectionColor('bridge')).toBe('#bb86fc');
    expect(sectionColor('intro')).toBe('#4a4a60');
    expect(sectionColor('outro')).toBe('#4a4a60');
    expect(sectionColor('break')).toBe('#1abc9c');
    expect(sectionColor('solo')).toBe('#00e676');
  });

  it('is case-insensitive', () => {
    expect(sectionColor('VERSE')).toBe(sectionColor('verse'));
    expect(sectionColor('Chorus')).toBe(sectionColor('chorus'));
  });

  it('falls back to verse-blue for unknown / undefined kinds', () => {
    expect(sectionColor(undefined)).toBe('#5B8DEF');
    expect(sectionColor('whatever')).toBe('#5B8DEF');
  });
});

describe('Beatmap type is consumable', () => {
  it('beatmap with sections passes through structural typing', () => {
    const bm: Beatmap = {
      beats: [0],
      bpm: 60,
      beatsPerBar: 4,
      sections: [{ label: 'X', startSec: 0, endSec: 1 }],
    };
    expect(bm.sections?.[0]?.label).toBe('X');
  });
});
