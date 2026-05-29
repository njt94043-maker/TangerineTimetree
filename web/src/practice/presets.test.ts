import { describe, it, expect } from 'vitest';
import {
  PRESETS,
  GRADES,
  MEMBER_DEFAULT,
  MEMBER_DEFAULT_DEMUCS,
  applyPreset,
  defaultPresetIdFor,
  effectiveMuted,
  emptyMixState,
  findPreset,
} from './presets';

describe('practice presets', () => {
  it('Full mix mutes nothing', () => {
    const p = findPreset('demucs', 'full')!;
    const next = applyPreset(emptyMixState(), p);
    expect(Object.values(next.mute).filter(Boolean)).toHaveLength(0);
    expect(Object.values(next.solo).filter(Boolean)).toHaveLength(0);
  });

  it('Jam bass mutes only the bass stem', () => {
    const p = findPreset('demucs', 'bass')!;
    const next = applyPreset(emptyMixState(), p);
    expect(next.mute).toEqual({ bass: true });
  });

  it('Solo vocals solos vocals on Demucs', () => {
    const p = findPreset('demucs', 'voxsolo')!;
    const next = applyPreset(emptyMixState(), p);
    expect(next.solo).toEqual({ vocals: true });
  });

  it('Custom preset preserves prior mute/solo state', () => {
    const start = { mute: { bass: true }, solo: {}, level: { vocals: 0.5 } };
    const p = findPreset('demucs', 'custom')!;
    const next = applyPreset(start, p);
    expect(next).toEqual(start);   // identity-preserving
  });

  it('preset switching preserves level (faders never reset)', () => {
    const start = { mute: {}, solo: {}, level: { vocals: 0.5 } };
    const next = applyPreset(start, findPreset('demucs', 'bass')!);
    expect(next.level).toEqual({ vocals: 0.5 });
  });

  it('multitrack-only presets carry the bvOnly flag', () => {
    const harmony = findPreset('multitrack', 'harmony')!;
    const voxsolo = findPreset('multitrack', 'voxsolo')!;
    expect(harmony.bvOnly).toBe(true);
    expect(voxsolo.bvOnly).toBe(true);
  });

  it('demucs has no guitar / harmony / BV-bound presets', () => {
    const ids = PRESETS.demucs.map(p => p.id);
    expect(ids).not.toContain('guitar');
    expect(ids).not.toContain('harmony');
  });

  it('every multitrack preset (except Custom + Full) acts on a stem in the grade', () => {
    const multitrackIds = new Set(GRADES.multitrack.stems.map(s => s.id));
    for (const p of PRESETS.multitrack) {
      if (p.custom || p.id === 'full') continue;
      const touched = [...(p.mute ?? []), ...(p.solo ?? [])];
      expect(touched.every(id => multitrackIds.has(id)),
        `preset ${p.id} references unknown stem`).toBe(true);
    }
  });
});

describe('member defaults', () => {
  it('James → Sing lead on both grades', () => {
    expect(defaultPresetIdFor('james', 'multitrack')).toBe('lead');
    expect(defaultPresetIdFor('james', 'demucs')).toBe('lead');
  });

  it('Adam (guitar/BV) falls back to Full on Demucs (no guitar preset)', () => {
    expect(MEMBER_DEFAULT.adam).toBe('guitar');
    expect(MEMBER_DEFAULT_DEMUCS.adam).toBe('full');
  });

  it('Neil (bass) → Jam bass on both grades', () => {
    expect(defaultPresetIdFor('neil', 'multitrack')).toBe('bass');
    expect(defaultPresetIdFor('neil', 'demucs')).toBe('bass');
  });
});

describe('effectiveMuted (solo-wins)', () => {
  it('un-muted, un-soloed → audible', () => {
    expect(effectiveMuted('vocals', emptyMixState())).toBe(false);
  });

  it('any stem soloed → others go silent', () => {
    const s = { mute: {}, solo: { vocals: true }, level: {} };
    expect(effectiveMuted('vocals', s)).toBe(false);
    expect(effectiveMuted('drums', s)).toBe(true);
  });

  it('muted, nothing soloed → silent', () => {
    const s = { mute: { bass: true }, solo: {}, level: {} };
    expect(effectiveMuted('bass', s)).toBe(true);
    expect(effectiveMuted('drums', s)).toBe(false);
  });
});
