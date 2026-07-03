// Shared error-copy helper for the v1.6.1 fail-loud mutation sites (S249 F1).
//
// The shared `queries.ts` auth guards throw 'Not authenticated' when
// `supabase.auth.getUser()` can't resolve — which is also what happens when the
// device is offline. Surfacing that raw reads as a scary auth failure. Prefer a
// plain-English offline message when the browser is offline; otherwise keep the
// existing message logic. Mirrors the `!navigator.onLine` check DayDetail uses.

const OFFLINE_SAVE_MESSAGE =
  "You're offline — nothing was saved. Try again when you're back online.";

/**
 * Pick the message to show when a save/mutation fails.
 * - Offline  → the offline message (never the raw 'Not authenticated').
 * - Online   → the error's own message, or `fallback` when there isn't one
 *              (pass `undefined` for sites that always use a fixed fallback).
 */
export function saveErrorMessage(err: unknown, fallback: string): string {
  if (!navigator.onLine) return OFFLINE_SAVE_MESSAGE;
  return err instanceof Error ? err.message : fallback;
}
