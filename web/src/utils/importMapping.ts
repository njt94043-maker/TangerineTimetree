// Pure mapping helpers for the TimeTree import landing ground (s260).
// No side effects, no Supabase — just staged-row → commit-input transforms.
// Commit orchestration (auto-create client, createGig, RPC) lives in the
// ImportsReview component / queries.ts; this file stays testable in isolation.

import type {
  GigType, GigSubtype, GigVisibility,
  ImportStagingRow, ImportProposedGig, ImportProposedAway,
} from '@shared/supabase/types';

// Matches the object createGig() accepts (subset — extra optional fields omitted).
export interface CreateGigInput {
  date: string;
  gig_type: GigType;
  gig_subtype: GigSubtype;
  status: 'confirmed';
  venue: string;
  venue_id?: string | null;
  client_name: string;
  client_id?: string | null;
  fee: number | null;
  payment_type: '' | 'cash' | 'invoice';
  load_time: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string;
  visibility: GigVisibility;
}

export interface CommitAwayInput {
  user_id: string | null;
  start_date: string;
  end_date: string;
  reason: string;
}

// "550" → 550, "£1,250" → 1250, "" / null → null.
export function parseFee(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[£,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// "" → null (unset); "18:30" kept.
export function parseTime(v: unknown): string | null {
  const s = (v === null || v === undefined ? '' : String(v)).trim();
  return s === '' ? null : s;
}

// xlsx payment values → the gig enum. "Agency" (agency booking) → 'invoice'.
export function mapPaymentType(v: unknown): '' | 'cash' | 'invoice' {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'cash') return 'cash';
  if (s === 'invoice' || s === 'agency') return 'invoice';
  return '';
}

// notes = proposed.notes + the raw TimeTree notes (unless already contained).
// Nothing is ever lost; never duplicated.
export function composeNotes(proposedNotes: string, rawNotes: string): string {
  const base = proposedNotes ?? '';
  const raw = (rawNotes ?? '').trim();
  if (!raw) return base;
  if (base.includes(raw)) return base;
  return `${base}\n\n[TimeTree] ${raw}`.trimStart();
}

export function mapStagedToGig(row: ImportStagingRow): CreateGigInput {
  const p = row.proposed as unknown as ImportProposedGig;
  const clientName = String(p.client_name ?? '').trim();
  return {
    date: String(p.date ?? ''),
    gig_type: (p.gig_type === 'practice' ? 'practice' : 'gig') as GigType,
    gig_subtype: (clientName ? 'client' : 'pub') as GigSubtype,
    status: 'confirmed',
    venue: String(p.venue ?? ''),
    venue_id: p.venue_id ?? null,
    client_name: clientName,
    client_id: p.client_id ?? null,
    fee: parseFee(p.fee),
    payment_type: mapPaymentType(p.payment_type),
    load_time: parseTime(p.load_time),
    start_time: parseTime(p.start_time),
    end_time: parseTime(p.end_time),
    notes: composeNotes(String(p.notes ?? ''), row.raw_notes),
    visibility: (p.is_public ? 'public' : 'private') as GigVisibility,
  };
}

// The away commit runs server-side via the commit_import_away RPC (which reads
// `proposed` directly); this shape is used by the UI to validate readiness
// (user_id resolved) and to preview the commit.
export function mapStagedToAway(row: ImportStagingRow): CommitAwayInput {
  const p = row.proposed as unknown as ImportProposedAway;
  return {
    user_id: p.user_id ?? null,
    start_date: String(p.start_date ?? ''),
    end_date: String(p.end_date ?? ''),
    reason: String(p.reason ?? ''),
  };
}

// Returns only the fields that differ between two proposed maps (identical → {}).
// Used for the "Changed in TimeTree" side-by-side diff.
export function diffProposed(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const k of keys) {
    const av = a?.[k];
    const bv = b?.[k];
    if (JSON.stringify(av) !== JSON.stringify(bv)) out[k] = { from: av, to: bv };
  }
  return out;
}
