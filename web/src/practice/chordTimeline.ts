// Chord timeline helpers — pure functions for the practice-mixer chord
// ribbon (S190 Batch C). Source of truth = setlist_entries.chord_text, an
// existing Supabase field with simple inline-bracket-tag chord chart format
// (D-batchC-chord-1, D-batchC-chord-2):
//
//   [A] In the town where I was born
//   [E] Lived a man who [D] sailed to sea
//
// Lines are lyric lines; bracketed [X] tokens are chord changes. Chord
// position is approximated by lyric position — we map (lineIdx, charIdx)
// proportionally to the song duration. Better time-mapping (per-beat
// alignment) is a future enhancement once the MS host beatmap-editor lets
// Nathan time-anchor chord events explicitly (D-batchC-chord-2).

export interface ChordEvent {
  /** Raw chord token, e.g. "A", "F#m", "Bb7" — passes through transpose() unchanged when off-vocab. */
  chord: string
  /** Zero-indexed line in the chord_text. */
  lineIdx: number
  /** Character index WITHIN the line where the chord token sits. */
  charIdx: number
}

/**
 * Parse a chord_text string into a flat list of chord events with line/char
 * positions. Bracket tokens are matched as `[<chord>]` greedy-non-bracket;
 * whitespace inside brackets is trimmed. Lines without any brackets are
 * skipped silently (they're pure lyric lines).
 *
 * Empty / null input returns []; the caller renders "no chords yet" or hides
 * the ribbon entirely.
 */
export function parseChordText(text: string | null | undefined): ChordEvent[] {
  if (!text) return []
  const events: ChordEvent[] = []
  const lines = text.split(/\r?\n/)
  const re = /\[([^\]]+)\]/g
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(line)) !== null) {
      const chord = m[1].trim()
      if (chord.length === 0) continue
      events.push({ chord, lineIdx, charIdx: m.index })
    }
  }
  return events
}

export interface TimelineEntry {
  chord: string
  startSec: number
}

/**
 * Distribute parsed chord events across the song duration proportionally to
 * lyric position. Cheap approximation: each event's position is computed as
 *   (totalCharsBefore + charIdx) / totalCharsAll * duration
 * counting only chars in lines that contain chords (so verses with chords
 * spread evenly through the song; intro/outro instrumental sections that
 * have no chord_text get no chord events at all).
 *
 * Returns timeline entries sorted by startSec ascending. Adjacent identical
 * chords are NOT de-duplicated here — caller decides whether to merge them.
 */
export function buildChordTimeline(events: ChordEvent[], durationSec: number): TimelineEntry[] {
  if (events.length === 0 || durationSec <= 0) return []
  // Total chars in lines that contain at least one event.
  const lineHasChord = new Set(events.map(e => e.lineIdx))
  // Note: we don't have the original line lengths here, so we approximate
  // line length as max(charIdx)+1 per line. For chord-heavy lines this is
  // accurate; for a line with a single bracket near the start, the line gets
  // a short slot. Good enough for ribbon-level "what's next".
  const lineLen = new Map<number, number>()
  for (const e of events) {
    const cur = lineLen.get(e.lineIdx) ?? 0
    if (e.charIdx + 1 > cur) lineLen.set(e.lineIdx, e.charIdx + 1)
  }
  // Per-line offset = sum of all PRIOR chord-bearing lines' lengths.
  const sortedLines = Array.from(lineHasChord).sort((a, b) => a - b)
  const lineOffset = new Map<number, number>()
  let acc = 0
  for (const idx of sortedLines) {
    lineOffset.set(idx, acc)
    acc += lineLen.get(idx) ?? 0
  }
  const totalChars = acc
  if (totalChars === 0) return []

  return events
    .map(e => {
      const offset = lineOffset.get(e.lineIdx) ?? 0
      const globalChar = offset + e.charIdx
      const startSec = (globalChar / totalChars) * durationSec
      return { chord: e.chord, startSec }
    })
    .sort((a, b) => a.startSec - b.startSec)
}

export interface CurrentAndNext {
  /** The chord active at currentSec, or null when before the first chord. */
  current: string | null
  /** The next `count` chords after `current`. May be shorter than `count` near song end. */
  next: string[]
}

/**
 * Pick the chord active at `currentSec` plus the next `count` upcoming
 * chords. "Active" = the most-recent timeline entry whose startSec <=
 * currentSec. Repeat chords (e.g. A A A) are kept as-is so the visual count
 * matches the chord_text — the caller can de-dup if desired.
 */
export function currentAndNext(
  timeline: TimelineEntry[],
  currentSec: number,
  count: number,
): CurrentAndNext {
  if (timeline.length === 0) return { current: null, next: [] }
  // Index of the active entry = last whose startSec <= currentSec.
  let activeIdx = -1
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i].startSec <= currentSec) activeIdx = i
    else break
  }
  const current = activeIdx >= 0 ? timeline[activeIdx].chord : null
  const next: string[] = []
  for (let i = Math.max(0, activeIdx + 1); i < timeline.length && next.length < count; i++) {
    next.push(timeline[i].chord)
  }
  return { current, next }
}
