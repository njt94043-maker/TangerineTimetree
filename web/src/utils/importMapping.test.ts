import { describe, it, expect } from 'vitest';
import {
  mapStagedToGig, mapStagedToAway, parseFee, parseTime, mapPaymentType, composeNotes, diffProposed,
} from './importMapping';
import type { ImportStagingRow } from '@shared/supabase/types';

function staged(kind: 'gig' | 'away', proposed: Record<string, unknown>, raw_notes = ''): ImportStagingRow {
  return {
    id: 'x', timetree_uid: 'u', kind, raw_title: '', raw_notes,
    proposed, match_source: '', status: 'pending',
    created_gig_id: null, created_away_id: null, staged_at: '', committed_at: null, committed_by: null,
    last_seen_at: '', missing_from_source: false, missing_acknowledged: false, source_changed: false,
    latest_from_source: null,
  };
}

describe('parseFee', () => {
  it('"550" → 550', () => expect(parseFee('550')).toBe(550));
  it('"" → null', () => expect(parseFee('')).toBeNull());
  it('null → null', () => expect(parseFee(null)).toBeNull());
  it('strips £ and commas', () => expect(parseFee('£1,250')).toBe(1250));
  it('passes numbers through', () => expect(parseFee(300)).toBe(300));
});

describe('parseTime', () => {
  it('"" → null', () => expect(parseTime('')).toBeNull());
  it('"18:30" kept', () => expect(parseTime('18:30')).toBe('18:30'));
  it('null → null', () => expect(parseTime(null)).toBeNull());
});

describe('mapPaymentType', () => {
  it('"Agency" → invoice', () => expect(mapPaymentType('Agency')).toBe('invoice'));
  it('"invoice" → invoice', () => expect(mapPaymentType('invoice')).toBe('invoice'));
  it('"cash" → cash', () => expect(mapPaymentType('cash')).toBe('cash'));
  it('unknown → ""', () => expect(mapPaymentType('paypal')).toBe(''));
  it('empty → ""', () => expect(mapPaymentType('')).toBe(''));
});

describe('mapStagedToGig', () => {
  it('is_public → visibility', () => {
    expect(mapStagedToGig(staged('gig', { is_public: true })).visibility).toBe('public');
    expect(mapStagedToGig(staged('gig', { is_public: false })).visibility).toBe('private');
  });
  it('client_name → gig_subtype', () => {
    expect(mapStagedToGig(staged('gig', { client_name: 'Acme Ltd' })).gig_subtype).toBe('client');
    expect(mapStagedToGig(staged('gig', { client_name: '' })).gig_subtype).toBe('pub');
  });
  it('status is always confirmed', () => {
    expect(mapStagedToGig(staged('gig', {})).status).toBe('confirmed');
  });
  it('parses fee + times through the mapping', () => {
    const out = mapStagedToGig(staged('gig', { fee: '550', start_time: '19:30', end_time: '' }));
    expect(out.fee).toBe(550);
    expect(out.start_time).toBe('19:30');
    expect(out.end_time).toBeNull();
  });
  it('preserves raw_notes in output when not already contained', () => {
    const out = mapStagedToGig(staged('gig', { notes: 'Load in 6pm' }, 'BYO amps; ask for Dave'));
    expect(out.notes).toContain('Load in 6pm');
    expect(out.notes).toContain('BYO amps; ask for Dave');
    expect(out.notes).toContain('[TimeTree]');
  });
  it('does not duplicate raw_notes already contained in proposed notes', () => {
    const raw = 'ask for Dave';
    const out = mapStagedToGig(staged('gig', { notes: `Load in; ${raw}` }, raw));
    expect(out.notes).toBe(`Load in; ${raw}`);
    expect((out.notes.match(/ask for Dave/g) ?? []).length).toBe(1);
  });
  it('keeps raw_notes even with empty proposed notes (no leading blank lines)', () => {
    const out = mapStagedToGig(staged('gig', { notes: '' }, 'raw only'));
    expect(out.notes).toBe('[TimeTree] raw only');
  });
});

describe('composeNotes', () => {
  it('empty raw → base unchanged', () => expect(composeNotes('mine', '')).toBe('mine'));
  it('appends [TimeTree] block when raw not contained', () =>
    expect(composeNotes('mine', 'extra')).toBe('mine\n\n[TimeTree] extra'));
});

describe('mapStagedToAway — member resolution shape', () => {
  it('carries the resolved user_id + range + reason', () => {
    const out = mapStagedToAway(staged('away', {
      member_name: 'Neil', user_id: 'u-neil', start_date: '2026-08-01', end_date: '2026-08-03', reason: 'holiday',
    }));
    expect(out).toEqual({ user_id: 'u-neil', start_date: '2026-08-01', end_date: '2026-08-03', reason: 'holiday' });
  });
  it('unresolved member → user_id null (commit must block)', () => {
    expect(mapStagedToAway(staged('away', { member_name: 'Neil' })).user_id).toBeNull();
  });
});

describe('diffProposed', () => {
  it('identical → empty', () => {
    expect(diffProposed({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toEqual({});
  });
  it('returns only changed fields with from/to', () => {
    const d = diffProposed({ a: 1, b: 'x', c: true }, { a: 1, b: 'y', c: true });
    expect(Object.keys(d)).toEqual(['b']);
    expect(d.b).toEqual({ from: 'x', to: 'y' });
  });
  it('catches added/removed keys', () => {
    expect(Object.keys(diffProposed({ a: 1 }, { a: 1, b: 2 }))).toEqual(['b']);
  });
});
