import { describe, it, expect } from 'vitest';
import { faderToDb, formatDb, faderToGain } from './fader';

describe('faderToDb', () => {
  it('returns null (-∞) at the bottom', () => {
    expect(faderToDb(0)).toBeNull();
    expect(faderToDb(0.0005)).toBeNull();
  });

  it('returns 0 dB at the unity mark (0.75)', () => {
    expect(faderToDb(0.75)).toBeCloseTo(0, 5);
  });

  it('top of fader = +10 dB', () => {
    expect(faderToDb(1.0)).toBeCloseTo(10, 5);
  });

  it('below unity uses the steeper slope', () => {
    // 0.5 -> -20 dB  (0.25 below unity × 80 = 20)
    expect(faderToDb(0.5)).toBeCloseTo(-20, 5);
  });
});

describe('formatDb', () => {
  it('-∞ formats as the unicode infinity symbol', () => {
    expect(formatDb(0)).toBe('-∞');
  });

  it('positive values get an explicit + sign', () => {
    expect(formatDb(1.0)).toBe('+10.0');
  });

  it('negative values keep the - sign', () => {
    expect(formatDb(0.5)).toBe('-20.0');
  });
});

describe('faderToGain', () => {
  it('unity = 1.0 linear gain', () => {
    expect(faderToGain(0.75)).toBeCloseTo(1, 5);
  });

  it('-∞ = 0 gain', () => {
    expect(faderToGain(0)).toBe(0);
  });

  it('+10 dB ≈ 3.16 linear gain', () => {
    expect(faderToGain(1.0)).toBeCloseTo(3.162, 2);
  });
});
