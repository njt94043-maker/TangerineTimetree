import { useEffect, useMemo, useRef, useState } from 'react';
import type { Client, Profile, ImportStagingRow, ImportProposedGig, ImportProposedAway } from '@shared/supabase/types';
import {
  getStagingRows, getClients, getProfiles, getGigsBrief,
  updateStagingProposed, setStagingStatus, acknowledgeStagingMissing, markStagingCommitted,
  applyStagingGigChange, ignoreStagingSourceChange,
  commitImportAway, removeImportAway, applyImportAway,
  createGig, createClient, deleteGig, updateGig,
} from '@shared/supabase/queries';
import { mapStagedToGig, diffProposed } from '../utils/importMapping';
import { useView } from '../hooks/useViewContext';
import { EntityPicker } from './EntityPicker';
import { ClientOneBox } from './ClientOneBox';
import { LoadingSpinner } from './LoadingSpinner';
import { ErrorAlert } from './ErrorAlert';

type Pill = 'pending' | 'committed' | 'skipped' | 'gone' | 'changed';
type BriefGig = { id: string; date: string; venue: string };

// A committed row whose FK links were nulled (the gig/away was deleted) is the
// undo path — treat it as pending again.
function effectiveStatus(r: ImportStagingRow): 'pending' | 'committed' | 'skipped' {
  if (r.status === 'committed' && !r.created_gig_id && !r.created_away_id) return 'pending';
  return r.status;
}
function isMatched(r: ImportStagingRow): boolean {
  const m = (r.match_source ?? '').trim().toLowerCase();
  return m !== '' && m !== 'unmatched';
}
function venueContains(a: string, b: string): boolean {
  const x = (a ?? '').trim().toLowerCase();
  const y = (b ?? '').trim().toLowerCase();
  return !!x && !!y && (x.includes(y) || y.includes(x));
}
function friendly(date: string): string {
  if (!date) return '';
  const d = new Date(date + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function ImportsReview() {
  const { goToDay } = useView();
  const [rows, setRows] = useState<ImportStagingRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [allGigs, setAllGigs] = useState<BriefGig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pill, setPill] = useState<Pill>('pending');
  const [bulkBusy, setBulkBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [r, c, p, g] = await Promise.all([getStagingRows(), getClients(), getProfiles(), getGigsBrief()]);
      setRows(r); setClients(c); setProfiles(p); setAllGigs(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load imports');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const buckets = useMemo(() => {
    const pending = rows.filter(r => effectiveStatus(r) === 'pending');
    const committed = rows.filter(r => effectiveStatus(r) === 'committed');
    const skipped = rows.filter(r => r.status === 'skipped');
    const gone = rows.filter(r => r.missing_from_source && !r.missing_acknowledged);
    const changed = rows.filter(r => r.source_changed);
    return { pending, committed, skipped, gone, changed };
  }, [rows]);

  const shown = buckets[pill] ?? [];

  // "Approve all matched": pending + matched + (gig: no dupe; away: member resolved).
  const bulkTargets = useMemo(() => buckets.pending.filter(r => {
    if (!isMatched(r)) return false;
    if (r.kind === 'away') return !!(r.proposed as unknown as ImportProposedAway).user_id;
    const p = r.proposed as unknown as ImportProposedGig;
    return !allGigs.some(g => g.date === p.date);
  }), [buckets.pending, allGigs]);

  async function commitOneGig(r: ImportStagingRow): Promise<void> {
    const p = r.proposed as unknown as ImportProposedGig;
    let clientId = p.client_id ?? null;
    const clientName = String(p.client_name ?? '').trim();
    if (!clientId && clientName) {
      const created = await createClient({ company_name: clientName });
      clientId = created.id;
    }
    const gig = await createGig(mapStagedToGig({ ...r, proposed: { ...r.proposed, client_id: clientId } }));
    await markStagingCommitted(r.id, { created_gig_id: gig.id });
  }
  async function commitOneAway(r: ImportStagingRow): Promise<void> {
    await commitImportAway(r.id); // RPC reads the already-persisted proposed.user_id
  }

  async function bulkApprove() {
    setBulkBusy(true);
    setError(null);
    try {
      for (const r of bulkTargets) {
        if (r.kind === 'away') await commitOneAway(r);
        else await commitOneGig(r);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk commit failed partway — reloaded; re-run to finish');
      await load();
    } finally {
      setBulkBusy(false);
    }
  }

  const PILLS: { key: Pill; label: string; n: number; always: boolean }[] = [
    { key: 'pending', label: 'Pending', n: buckets.pending.length, always: true },
    { key: 'committed', label: 'Committed', n: buckets.committed.length, always: true },
    { key: 'skipped', label: 'Skipped', n: buckets.skipped.length, always: true },
    { key: 'gone', label: 'Gone from TimeTree', n: buckets.gone.length, always: false },
    { key: 'changed', label: 'Changed in TimeTree', n: buckets.changed.length, always: false },
  ];

  return (
    <div className="imports-view">
      <div className="imports-intro">
        Review each TimeTree entry before it lands on the calendar. Nothing is added until you approve it.
      </div>

      <div className="imports-pills">
        {PILLS.filter(pl => pl.always || pl.n > 0).map(pl => (
          <button
            key={pl.key}
            className={`imports-pill${pill === pl.key ? ' active' : ''}${(pl.key === 'gone' || pl.key === 'changed') ? ' warn' : ''}`}
            onClick={() => setPill(pl.key)}
          >
            {pl.label} ({pl.n})
          </button>
        ))}
      </div>

      {pill === 'pending' && bulkTargets.length > 0 && (
        <BulkApprove count={bulkTargets.length} busy={bulkBusy} onConfirm={bulkApprove} />
      )}

      {loading && <LoadingSpinner />}
      {error && <ErrorAlert message={error} onRetry={load} />}

      {!loading && !error && shown.length === 0 && (
        <p className="empty-message">Nothing here. {pill === 'pending' ? 'Run the stager after a TimeTree scrape.' : ''}</p>
      )}

      {!loading && !error && shown.map(r => (
        <ImportCard
          key={r.id}
          row={r}
          clients={clients}
          profiles={profiles}
          allGigs={allGigs}
          onChanged={load}
          onViewDay={(d) => goToDay(d)}
          commitGig={commitOneGig}
          commitAway={commitOneAway}
        />
      ))}
    </div>
  );
}

function BulkApprove({ count, busy, onConfirm }: { count: number; busy: boolean; onConfirm: () => void }) {
  const [confirm, setConfirm] = useState(false);
  if (confirm) {
    return (
      <div className="imports-bulk neu-inset">
        <span>Commit all {count} matched booking{count === 1 ? '' : 's'} to the calendar?</span>
        <div className="imports-bulk-actions">
          <button className="btn btn-small btn-green" disabled={busy} onClick={onConfirm}>{busy ? 'Committing…' : 'Yes, commit'}</button>
          <button className="btn btn-small" disabled={busy} onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      </div>
    );
  }
  return (
    <button className="btn btn-tangerine imports-bulk-btn" onClick={() => setConfirm(true)}>
      Approve all matched ({count})
    </button>
  );
}

interface CardProps {
  row: ImportStagingRow;
  clients: Client[];
  profiles: Profile[];
  allGigs: BriefGig[];
  onChanged: () => void | Promise<void>;
  onViewDay: (date: string) => void;
  commitGig: (r: ImportStagingRow) => Promise<void>;
  commitAway: (r: ImportStagingRow) => Promise<void>;
}

function ImportCard({ row, clients, profiles, allGigs, onChanged, onViewDay, commitGig, commitAway }: CardProps) {
  const [proposed, setProposed] = useState<Record<string, unknown>>(row.proposed);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const firstRender = useRef(true);

  // Debounced persist of proposed edits (skip the initial render).
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const t = setTimeout(() => { updateStagingProposed(row.id, proposed).catch(() => {}); }, 600);
    return () => clearTimeout(t);
  }, [proposed, row.id]);

  const status = effectiveStatus(row);
  const patch = (patchObj: Record<string, unknown>) => setProposed(p => ({ ...p, ...patchObj }));

  async function run(fn: () => Promise<void>) {
    setBusy(true); setErr(null);
    try {
      await updateStagingProposed(row.id, proposed); // ensure DB reflects edits (RPCs read it)
      await fn();
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  const gigP = proposed as unknown as ImportProposedGig;
  const awayP = proposed as unknown as ImportProposedAway;

  // Dupe (gig, pending): another gig already on this date.
  const dupe = row.kind === 'gig' && status === 'pending'
    ? allGigs.find(g => g.date === gigP.date)
    : undefined;
  const dupeRed = dupe ? venueContains(dupe.venue, gigP.venue ?? '') : false;

  const goneUnack = row.missing_from_source && !row.missing_acknowledged;
  const changed = row.source_changed && !!row.latest_from_source;
  const awayResolved = row.kind === 'away' ? !!awayP.user_id : true;

  return (
    <div className={`import-card neu-card${goneUnack ? ' import-card-gone' : ''}`}>
      {/* Raw (read-only) */}
      <div className="import-raw">
        <div className="import-raw-head">
          <span className="import-kind">{row.kind === 'away' ? '✈️ Away' : '📅 Gig'}</span>
          <span className={`import-chip ${isMatched(row) ? 'matched' : 'unmatched'}`}>
            {isMatched(row) ? row.match_source : 'unmatched'}
          </span>
        </div>
        <div className="import-raw-title">{row.raw_title || '(no title)'}</div>
        {row.raw_notes && <div className="import-raw-notes">{row.raw_notes}</div>}
      </div>

      {goneUnack && (
        <div className="import-gone-banner">
          Gone from TimeTree — last seen {friendly(row.last_seen_at.slice(0, 10))}.
        </div>
      )}

      {/* Proposed (editable) */}
      <div className="import-proposed">
        {row.kind === 'gig' ? (
          <>
            <FieldRow label="Date">
              <input className="input-field" type="date" value={String(gigP.date ?? '')} onChange={e => patch({ date: e.target.value })} />
            </FieldRow>
            {dupe && (
              <div className={`import-dupe${dupeRed ? ' red' : ''}`}>⚠ already on this date: {dupe.venue || 'a booking'}</div>
            )}
            <FieldRow label="Type">
              <div className="import-toggle">
                <button className={`btn btn-small${gigP.gig_type !== 'practice' ? ' btn-green' : ''}`} onClick={() => patch({ gig_type: 'gig' })}>Gig</button>
                <button className={`btn btn-small${gigP.gig_type === 'practice' ? ' btn-practice' : ''}`} onClick={() => patch({ gig_type: 'practice' })}>Practice</button>
              </div>
            </FieldRow>
            <FieldRow label="Venue">
              <div className="neu-inset import-inset">
                <EntityPicker mode="venue" value={String(gigP.venue ?? '')} entityId={gigP.venue_id ?? null}
                  onChange={(text, id) => patch({ venue: text, venue_id: id })} placeholder="Venue" />
              </div>
            </FieldRow>
            <FieldRow label="Client">
              <div className="neu-inset import-inset">
                <ClientOneBox value={{ client_id: gigP.client_id ?? null, client_name: String(gigP.client_name ?? '') }}
                  clients={clients} onChange={v => patch({ client_id: v.client_id, client_name: v.client_name })} />
              </div>
            </FieldRow>
            <div className="import-field-grid">
              <FieldRow label="Fee">
                <div className="neu-inset import-inset"><input className="input-field" inputMode="decimal" value={String(gigP.fee ?? '')} onChange={e => patch({ fee: e.target.value })} placeholder="0" /></div>
              </FieldRow>
              <FieldRow label="Payment">
                <select className="input-field import-select" value={String(gigP.payment_type ?? '')} onChange={e => patch({ payment_type: e.target.value })}>
                  <option value="">—</option>
                  <option value="invoice">Invoice</option>
                  <option value="cash">Cash</option>
                </select>
              </FieldRow>
            </div>
            <div className="import-field-grid">
              <FieldRow label="Load"><div className="neu-inset import-inset"><input className="input-field" value={String(gigP.load_time ?? '')} onChange={e => patch({ load_time: e.target.value })} placeholder="hh:mm" /></div></FieldRow>
              <FieldRow label="Start"><div className="neu-inset import-inset"><input className="input-field" value={String(gigP.start_time ?? '')} onChange={e => patch({ start_time: e.target.value })} placeholder="hh:mm" /></div></FieldRow>
              <FieldRow label="End"><div className="neu-inset import-inset"><input className="input-field" value={String(gigP.end_time ?? '')} onChange={e => patch({ end_time: e.target.value })} placeholder="hh:mm" /></div></FieldRow>
            </div>
            <FieldRow label="Notes">
              <div className="neu-inset import-inset"><textarea className="input-field import-notes" value={String(gigP.notes ?? '')} onChange={e => patch({ notes: e.target.value })} rows={2} /></div>
            </FieldRow>
            <label className="import-check">
              <input type="checkbox" checked={!!gigP.is_public} onChange={e => patch({ is_public: e.target.checked })} /> Show on public site
            </label>
          </>
        ) : (
          <>
            <FieldRow label="Member">
              <select className={`input-field import-select${!awayResolved ? ' import-required' : ''}`} value={String(awayP.user_id ?? '')} onChange={e => patch({ user_id: e.target.value || null })}>
                <option value="">— pick member —</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FieldRow>
            <div className="import-field-grid">
              <FieldRow label="From"><input className="input-field" type="date" value={String(awayP.start_date ?? '')} onChange={e => patch({ start_date: e.target.value })} /></FieldRow>
              <FieldRow label="To"><input className="input-field" type="date" value={String(awayP.end_date ?? '')} onChange={e => patch({ end_date: e.target.value })} /></FieldRow>
            </div>
            <FieldRow label="Reason">
              <div className="neu-inset import-inset"><input className="input-field" value={String(awayP.reason ?? '')} onChange={e => patch({ reason: e.target.value })} placeholder="(optional)" /></div>
            </FieldRow>
          </>
        )}
      </div>

      {changed && <ChangedDiff row={row} />}
      {err && <div className="import-err">{err}</div>}

      {/* Actions per bucket */}
      <div className="import-actions">
        {status === 'pending' && (
          <>
            <button className="btn btn-green" disabled={busy || (row.kind === 'away' && !awayResolved)}
              onClick={() => run(() => (row.kind === 'away' ? commitAway({ ...row, proposed }) : commitGig({ ...row, proposed })))}>
              {busy ? '…' : 'Add to calendar'}
            </button>
            <button className="btn" disabled={busy} onClick={() => run(() => setStagingStatus(row.id, 'skipped'))}>Skip</button>
          </>
        )}
        {status === 'committed' && (
          <>
            <span className="import-in-calendar">→ in calendar</span>
            {row.kind === 'gig' && <button className="btn btn-small" onClick={() => onViewDay(String(gigP.date ?? ''))}>View day</button>}
            {goneUnack && (
              <>
                <button className="btn btn-small btn-danger" disabled={busy}
                  onClick={() => run(() => (row.kind === 'away' ? removeImportAway(row.id) : deleteGig(row.created_gig_id!)))}>Remove from calendar</button>
                <button className="btn btn-small" disabled={busy} onClick={() => run(() => acknowledgeStagingMissing(row.id))}>Keep — stop flagging</button>
              </>
            )}
            {changed && (
              <>
                <button className="btn btn-small btn-green" disabled={busy} onClick={() => run(() => applyChange(row))}>Apply changes</button>
                <button className="btn btn-small" disabled={busy} onClick={() => run(() => ignoreStagingSourceChange(row.id))}>Ignore</button>
              </>
            )}
          </>
        )}
        {status === 'skipped' && (
          <button className="btn btn-small" disabled={busy} onClick={() => run(() => setStagingStatus(row.id, 'pending'))}>Restore to pending</button>
        )}
      </div>
    </div>
  );

  // Apply a TimeTree-side change to the committed record.
  async function applyChange(r: ImportStagingRow): Promise<void> {
    const latest = r.latest_from_source ?? {};
    if (r.kind === 'away') { await applyImportAway(r.id); return; }
    // gig: update the created gig from latest, then merge latest into proposed
    const merged = { ...r.proposed, ...latest };
    await updateGig(r.created_gig_id!, mapStagedToGig({ ...r, proposed: merged }));
    await applyStagingGigChange(r.id, merged);
  }
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="import-field">
      <label className="import-field-label">{label}</label>
      {children}
    </div>
  );
}

function ChangedDiff({ row }: { row: ImportStagingRow }) {
  const latest = (row.latest_from_source ?? {}) as Record<string, unknown>;
  // Compare only the fields the source provides, so UI-resolved ids
  // (client_id/venue_id, absent from the scrape) don't show as spurious diffs.
  const subset: Record<string, unknown> = {};
  for (const k of Object.keys(latest)) subset[k] = row.proposed[k];
  const diff = diffProposed(subset, latest);
  const keys = Object.keys(diff);
  if (keys.length === 0) return null;
  return (
    <div className="import-diff neu-inset">
      <div className="import-diff-head">Changed in TimeTree:</div>
      {keys.map(k => (
        <div key={k} className="import-diff-row">
          <span className="import-diff-key">{k}</span>
          <span className="import-diff-from">{String(diff[k].from ?? '—')}</span>
          <span className="import-diff-arrow">→</span>
          <span className="import-diff-to">{String(diff[k].to ?? '—')}</span>
        </div>
      ))}
    </div>
  );
}
