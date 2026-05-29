import { describe, it, expect } from 'vitest';
import {
  parseChordText, buildChordTimeline, currentAndNext,
} from './chordTimeline';

describe('parseChordText', () => {
  it('returns [] for null / empty', () => {
    expect(parseChordText(null)).toEqual([]);
    expect(parseChordText('')).toEqual([]);
    expect(parseChordText(undefined)).toEqual([]);
  });

  it('parses single-line single chord', () => {
    expect(parseChordText('[A] In the town')).toEqual([
      { chord: 'A', lineIdx: 0, charIdx: 0 },
    ]);
  });

  it('parses multiple chords on one line', () => {
    const ev = parseChordText('[E] Lived a man who [D] sailed to sea');
    expect(ev).toEqual([
      { chord: 'E', lineIdx: 0, charIdx: 0 },
      { chord: 'D', lineIdx: 0, charIdx: 20 },
    ]);
  });

  it('parses across multiple lines', () => {
    const text = '[A] In the town where I was born\n[E] Lived a man who [D] sailed to sea';
    const ev = parseChordText(text);
    expect(ev).toHaveLength(3);
    expect(ev[0]).toEqual({ chord: 'A', lineIdx: 0, charIdx: 0 });
    expect(ev[1].lineIdx).toBe(1);
    expect(ev[1].chord).toBe('E');
    expect(ev[2].chord).toBe('D');
  });

  it('trims whitespace inside brackets', () => {
    expect(parseChordText('[  A  ] foo')).toEqual([
      { chord: 'A', lineIdx: 0, charIdx: 0 },
    ]);
  });

  it('ignores empty brackets', () => {
    expect(parseChordText('[] foo [A] bar')).toEqual([
      { chord: 'A', lineIdx: 0, charIdx: 7 },
    ]);
  });

  it('handles complex chord names (F#m, Bb7, Cmaj7, Dsus4)', () => {
    const ev = parseChordText('[F#m] [Bb7] [Cmaj7] [Dsus4]');
    expect(ev.map(e => e.chord)).toEqual(['F#m', 'Bb7', 'Cmaj7', 'Dsus4']);
  });

  it('skips pure-lyric lines (no brackets)', () => {
    const text = '[A] Verse line\nPure lyric line with no chords\n[D] Next chord';
    const ev = parseChordText(text);
    expect(ev).toHaveLength(2);
    expect(ev.map(e => e.lineIdx)).toEqual([0, 2]);
  });
});

describe('buildChordTimeline', () => {
  it('returns [] for no events', () => {
    expect(buildChordTimeline([], 100)).toEqual([]);
  });

  it('returns [] for zero / negative duration', () => {
    const ev = parseChordText('[A] foo');
    expect(buildChordTimeline(ev, 0)).toEqual([]);
    expect(buildChordTimeline(ev, -5)).toEqual([]);
  });

  it('places single chord at start of song', () => {
    const ev = parseChordText('[A] foo');
    const tl = buildChordTimeline(ev, 100);
    expect(tl).toHaveLength(1);
    expect(tl[0].chord).toBe('A');
    expect(tl[0].startSec).toBe(0);
  });

  it('distributes chords proportionally across one line', () => {
    // line len = 21 (charIdx of last bracket + 1). A at 0, D at ~mid.
    const ev = parseChordText('[A] xxxxxxxx xxx [D]');
    const tl = buildChordTimeline(ev, 100);
    expect(tl).toHaveLength(2);
    expect(tl[0].startSec).toBe(0);
    expect(tl[1].startSec).toBeGreaterThan(50);  // [D] at charIdx 17 of 20 ≈ 85%
  });

  it('distributes across multiple chord-bearing lines', () => {
    const text = '[A] aaaa\n[B] bbbb\n[C] cccc';
    const ev = parseChordText(text);
    const tl = buildChordTimeline(ev, 120);
    expect(tl).toHaveLength(3);
    expect(tl.map(t => t.chord)).toEqual(['A', 'B', 'C']);
    expect(tl[0].startSec).toBeLessThan(tl[1].startSec);
    expect(tl[1].startSec).toBeLessThan(tl[2].startSec);
  });

  it('returns entries sorted by startSec', () => {
    const ev = parseChordText('[A] xxx [B] yyy [C] zzz');
    const tl = buildChordTimeline(ev, 60);
    for (let i = 1; i < tl.length; i++) {
      expect(tl[i].startSec).toBeGreaterThanOrEqual(tl[i - 1].startSec);
    }
  });

  it('skips pure-lyric lines entirely (no time budget allocated)', () => {
    const text = '[A] foo\npurely lyric\n[B] bar';
    const ev = parseChordText(text);
    const tl = buildChordTimeline(ev, 100);
    expect(tl).toHaveLength(2);
    // B should be ~half-way (only chord-bearing lines count toward distribution)
    expect(tl[1].startSec).toBeGreaterThan(20);
  });
});

describe('currentAndNext', () => {
  const tl = [
    { chord: 'A', startSec: 0 },
    { chord: 'E', startSec: 10 },
    { chord: 'F#m', startSec: 20 },
    { chord: 'D', startSec: 30 },
  ];

  it('returns nulls when timeline is empty', () => {
    expect(currentAndNext([], 5, 3)).toEqual({ current: null, next: [] });
  });

  it('returns null current when before first chord', () => {
    const future = [{ chord: 'A', startSec: 5 }];
    const r = currentAndNext(future, 0, 3);
    expect(r.current).toBeNull();
    expect(r.next).toEqual(['A']);
  });

  it('picks the most-recent past entry as current', () => {
    expect(currentAndNext(tl, 15, 3).current).toBe('E');
    expect(currentAndNext(tl, 25, 3).current).toBe('F#m');
  });

  it('returns next chords after current, up to count', () => {
    expect(currentAndNext(tl, 5, 3).next).toEqual(['E', 'F#m', 'D']);
    expect(currentAndNext(tl, 15, 2).next).toEqual(['F#m', 'D']);
  });

  it('returns empty next when current is the last chord', () => {
    const r = currentAndNext(tl, 35, 3);
    expect(r.current).toBe('D');
    expect(r.next).toEqual([]);
  });

  it('caps next at requested count', () => {
    expect(currentAndNext(tl, 0, 1).next).toEqual(['E']);
    expect(currentAndNext(tl, 0, 10).next).toEqual(['E', 'F#m', 'D']);
  });

  it('handles startSec exactly equal to currentSec (inclusive)', () => {
    // At exactly 10s, 'E' starts → E is current, not A.
    expect(currentAndNext(tl, 10, 1).current).toBe('E');
  });
});
