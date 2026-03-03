import { useState, useEffect, type FormEvent } from 'react';
import { getMyAwayDates, createAwayDate, deleteAwayDate } from '../supabase/queries';
import type { AwayDate } from '../supabase/types';

interface AwayManagerProps {
  initialDate?: string;
  onClose: () => void;
}

function formatRange(start: string, end: string): string {
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (start === end) return s.toLocaleDateString('en-GB', { ...opts, year: 'numeric' });
  return `${s.toLocaleDateString('en-GB', opts)} \u2013 ${e.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`;
}

export function AwayManager({ initialDate, onClose }: AwayManagerProps) {
  const [awayDates, setAwayDates] = useState<AwayDate[]>([]);
  const [showForm, setShowForm] = useState(!!initialDate);
  const [startDate, setStartDate] = useState(initialDate ?? new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(initialDate ?? new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function fetchDates() {
    try {
      setAwayDates(await getMyAwayDates());
    } catch { /* ignore */ }
  }

  useEffect(() => { fetchDates(); }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (endDate < startDate) { setError('End date must be on or after start date'); return; }
    setSaving(true);
    setError('');
    try {
      await createAwayDate({ start_date: startDate, end_date: endDate, reason });
      setShowForm(false);
      setReason('');
      fetchDates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this away date?')) return;
    try {
      await deleteAwayDate(id);
      fetchDates();
    } catch { /* ignore */ }
  }

  return (
    <div className="form-wrap" style={{ paddingTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>My Away Dates</h2>
        <div style={{ width: 60 }} />
      </div>

      {awayDates.length === 0 && !showForm && (
        <p style={{ color: 'var(--color-text-dim)', textAlign: 'center', padding: '40px 0' }}>No away dates set</p>
      )}

      {awayDates.map(a => (
        <div key={a.id} className="away-card neu-inset">
          <div className="away-card-content">
            <div className="away-range">{formatRange(a.start_date, a.end_date)}</div>
            {a.reason && <div className="away-reason">{a.reason}</div>}
          </div>
          <span className="away-delete" onClick={() => handleDelete(a.id)}>X</span>
        </div>
      ))}

      {showForm ? (
        <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Add Away Period</h3>

          <div className="label">FROM</div>
          <div className="neu-inset">
            <input className="input-field" type="date" value={startDate} onChange={e => {
              setStartDate(e.target.value);
              if (e.target.value > endDate) setEndDate(e.target.value);
            }} />
          </div>

          <div className="label">TO</div>
          <div className="neu-inset">
            <input className="input-field" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>

          <div className="label">REASON (OPTIONAL)</div>
          <div className="neu-inset">
            <input className="input-field" placeholder="e.g. Holiday, family event" value={reason} onChange={e => setReason(e.target.value)} />
          </div>

          {error && <p style={{ color: 'var(--color-danger)', fontSize: 12, textAlign: 'center', marginTop: 10 }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
            <button className="btn btn-small" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-small btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      ) : (
        <div style={{ marginTop: 20 }}>
          <button className="btn btn-green" style={{ width: '100%' }} onClick={() => setShowForm(true)}>Add Away Date</button>
        </div>
      )}
    </div>
  );
}
