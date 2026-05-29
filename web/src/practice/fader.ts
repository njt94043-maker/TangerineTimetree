// Fader-to-dB mapping — matches the mockup so the visible label tracks the
// fader exactly. 0.75 = unity (0 dB), top of fader = +10 dB, bottom = -∞.
//
// Above unity:  0.75..1.00  →  0..+10  dB  (slope = 40 per unit)
// Below unity:  0.00..0.75  →  -∞..0   dB  (slope = 80 per unit, clamped at -∞)

export function faderToDb(value: number): number | null {
  if (value <= 0.001) return null;   // -∞
  if (value >= 0.75) return (value - 0.75) * 40;
  return (value - 0.75) * 80;
}

export function formatDb(value: number): string {
  const db = faderToDb(value);
  if (db === null) return '-∞';
  if (db >= 0) return '+' + db.toFixed(1);
  return db.toFixed(1);
}

/**
 * Convert fader position 0..1 to a linear gain 0..1 for the audio graph.
 * The mockup spec maps the fader visually, but for audio we want a real dB
 * gain so a +10 dB fader sounds 10 dB louder. -∞ at 0 = silence.
 */
export function faderToGain(value: number): number {
  const db = faderToDb(value);
  if (db === null) return 0;
  return Math.pow(10, db / 20);
}
