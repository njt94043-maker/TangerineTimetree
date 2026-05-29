// Chord-name transposition for the key-stepper UI. Matches the locked
// S190 mockup's chord transposition behaviour (sharp-spelling, accidentals
// flat → sharp normalised; minor/sus/maj7/etc suffixes preserved).

const NOTES = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'] as const;

const FLAT_TO_SHARP: Record<string, string> = {
  Bb: 'A#', Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#',
};

/**
 * Transpose a chord name by `semitones`. Returns the chord with its root
 * shifted; the suffix (`m`, `7`, `maj7`, `sus4`, etc) is preserved verbatim.
 * Unknown notes pass through unchanged so e.g. "N.C." or "(rest)" doesn't
 * crash the overlay.
 */
export function transpose(chord: string, semitones: number): string {
  const m = chord.match(/^([A-G][#b]?)(.*)$/);
  if (!m) return chord;
  const root = FLAT_TO_SHARP[m[1]] ?? m[1];
  const idx = NOTES.indexOf(root as typeof NOTES[number]);
  if (idx < 0) return chord;
  const next = NOTES[((idx + semitones) % 12 + 12) % 12];
  return next + m[2];
}

/** Convenience: transpose just the key name (no suffix). */
export function transposeKey(key: string, semitones: number): string {
  return transpose(key, semitones);
}

/** Format a semitone offset as a signed string (+2, 0, -3). */
export function formatSemitones(n: number): string {
  if (n > 0) return '+' + n;
  return String(n);
}
