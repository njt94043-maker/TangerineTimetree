// Read-only chord ribbon for the practice mixer (S190 Batch C). Mirrors the
// locked mockup's `.ctx-ribbon` row:
//
//   ▮ Chorus      now <b>A</b> · E F#m D                   Key A
//
// We currently don't have section data (chord-detect / section-detect aren't
// wired yet — that's a Batch B / future-MS-host job). When section is null
// we render just the chord cluster + key. The chord source is the entry's
// `chord_text` field (D-batchC-chord-1, already editable from Library
// SongDetail). Transposition reuses ./transpose.ts so the ribbon stays in
// sync with the key stepper.

import { useMemo } from 'react'
import type { SetlistEntry } from '@shared/supabase/types'
import { parseChordText, buildChordTimeline, currentAndNext } from './chordTimeline'
import { transpose, formatSemitones } from './transpose'
import './ChordRibbon.css'

interface Props {
  entry: SetlistEntry
  /** Current playback position in seconds. */
  currentTime: number
  /** Total song duration in seconds (drives timeline distribution). */
  duration: number
  /** Semitone offset from the key stepper — every chord + key transposes by this much. */
  semitones: number
  /** Optional section label (e.g. "Chorus"). Future-wired via section detect; null today. */
  sectionLabel?: string | null
  /** How many upcoming chords to surface in the ribbon. Default 3 (mockup parity). */
  upcomingCount?: number
}

export default function ChordRibbon({
  entry, currentTime, duration, semitones, sectionLabel, upcomingCount = 3,
}: Props) {
  // Parse + build the timeline once per chord_text/duration change.
  const timeline = useMemo(() => {
    const events = parseChordText(entry.chord_text)
    return buildChordTimeline(events, duration)
  }, [entry.chord_text, duration])

  // Resolve current + next at the current playback position. Cheap to recompute
  // every render — small array walk.
  const { current, next } = currentAndNext(timeline, currentTime, upcomingCount)

  // Base key for the right-aligned "Key X" pill. Pulled from the same notes
  // regex PracticeMixer uses for the key-stepper default (kept duplicated to
  // avoid coupling the ribbon to the parent — easy to lift to a shared helper
  // when a second consumer appears).
  const baseKey = entry.notes?.match(/\bkey\s*[:=]?\s*([A-G][#b]?m?)/i)?.[1] ?? null

  // If we have no chord data AND no key, render nothing — keep the ribbon out
  // of the layout instead of showing a useless empty strip.
  if (!current && next.length === 0 && !baseKey) return null

  const transposedCurrent = current ? transpose(current, semitones) : null
  const transposedNext = next.map(c => transpose(c, semitones))
  const transposedKey = baseKey ? transpose(baseKey, semitones) : null

  return (
    <div className="pm-ctx-ribbon" role="status" aria-live="polite">
      {sectionLabel && (
        <span className="pm-ctx-section">▮ {sectionLabel}</span>
      )}
      <span className="pm-ctx-chord">
        {transposedCurrent ? (
          <>
            now <b>{transposedCurrent}</b>
            {transposedNext.length > 0 && <> · {transposedNext.join(' ')}</>}
          </>
        ) : transposedNext.length > 0 ? (
          <>up next · {transposedNext.join(' ')}</>
        ) : (
          <span className="pm-ctx-empty">no chord chart — add one in setlist detail</span>
        )}
      </span>
      {transposedKey && (
        <span className="pm-ctx-key">
          Key {transposedKey}
          {semitones !== 0 && <span className="pm-ctx-key-shift"> {formatSemitones(semitones)}</span>}
        </span>
      )}
    </div>
  )
}
