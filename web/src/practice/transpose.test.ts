import { describe, it, expect } from 'vitest';
import { transpose, formatSemitones } from './transpose';

describe('transpose', () => {
  it('A up 2 semitones = B', () => {
    expect(transpose('A', 2)).toBe('B');
  });

  it('A down 2 semitones = G', () => {
    expect(transpose('A', -2)).toBe('G');
  });

  it('wraps around the octave (A -1 = G#)', () => {
    expect(transpose('A', -1)).toBe('G#');
  });

  it('wraps around the octave (G# +1 = A)', () => {
    expect(transpose('G#', 1)).toBe('A');
  });

  it('preserves minor / 7 / sus suffixes', () => {
    expect(transpose('Am', 3)).toBe('Cm');
    expect(transpose('F#m7', 1)).toBe('Gm7');
    expect(transpose('Dsus4', 5)).toBe('Gsus4');
  });

  it('normalises flats to sharps (Bb up 1 = B)', () => {
    expect(transpose('Bb', 1)).toBe('B');
  });

  it('passes through unknown / non-note tokens', () => {
    expect(transpose('N.C.', 4)).toBe('N.C.');
    expect(transpose('(rest)', 1)).toBe('(rest)');
  });

  it('zero shift is identity', () => {
    for (const c of ['A', 'C', 'F#', 'Bbmaj7', 'Em7']) {
      expect(transpose(c, 0)).toBe(c === 'Bbmaj7' ? 'A#maj7' : c);
    }
  });

  it('handles large positive shifts via modulo', () => {
    expect(transpose('A', 12)).toBe('A');
    expect(transpose('A', 14)).toBe('B');
  });

  it('handles large negative shifts via modulo', () => {
    expect(transpose('A', -12)).toBe('A');
    expect(transpose('A', -14)).toBe('G');
  });
});

describe('formatSemitones', () => {
  it('positives get a +', () => {
    expect(formatSemitones(2)).toBe('+2');
    expect(formatSemitones(6)).toBe('+6');
  });
  it('zero is "0"', () => {
    expect(formatSemitones(0)).toBe('0');
  });
  it('negatives keep the -', () => {
    expect(formatSemitones(-3)).toBe('-3');
  });
});
