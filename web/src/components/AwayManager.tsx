import { useState, useEffect, type FormEvent } from 'react';
import { getMyAwayDates, createAwayDate, deleteAwayDate, updateAwayDate } from '@shared/supabase/queries';
import type { AwayDate } from '@shared/supabase/types';
import { isNetworkError, queueMutation } from '../hooks/useOfflineQueue';
import { formatRange } from '../utils/format';
import { ErrorAlert } from './ErrorAlert';
import { ConfirmModal } from './ConfirmModal';

interface AwayManagerProps {
  initialDate?: string;
  onClose: () => void;
}

export function AwayManager({ initialDate, onClose }: AwayManagerProps) {
  const [awayDates, setAwayDates] = useState<AwayDate[]>([]);
  const [showForm, setShowForm] = useState(!!initialDate);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(initialDate ?? new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(initialDate ?? new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function fetchDates() {
    try {
      setAwayDates(await getMyAwayDates());
    } catch { /* ignore */ }
  }

  useEffect(() => { fetchDates(); }, []);

  function startEdit(a: AwayDate) {
    setEditingId(a.id);
    setStartDate(a.start_date);
    setEndDate(a.end_date);
    setReason(a.reason ?? '');
    setShowForm(true);
    setError('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (endDate < startDate) { setError('End date must be on or after start date'); return; }
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await updateAwayDate(editingId, { start_date: startDate, end_date: endDate, reason });
      } else {
        await createAwayDate({ start_date: startDate, end_date: endDate, reason });
      }
      setShowForm(false);
      setEditingId(null);
      setReason('');
      fetchDates();
    } catch (err) {
      if (isNetworkError(err)) {
        if (!editingId) {
          queueMutation('createAwayDate', { start_date: startDate, end_date: endDate, reason });
        }
        setShowForm(false);
        setEditingId(null);
        setReason('');
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteAwayDate(id);
      fetchDates();
    } catch (err) {
      if (isNetworkError(err)) {
        queueMutation('deleteAwayDate', { id });
        setAwayDates(prev => prev.filter(a => a.id !== id));
      }
    }
  }

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 className="page-title">My Away Dates</h2>
        <div className="page-header-spacer" />
      </div>

      {awayDates.length === 0 && !showForm && (
        <p className="empty-message empty-message-lg">No away dates set</p>
      )}

      {awayDates.map(a => (
        <div key={a.id} className="away-card neu-inset">
          <div className="away-card-content away-card-clickable" onClick={() => startEdit(a)}>
            <div className="away-range">{formatRange(a.start_date, a.end_date)}</div>
            {a.reason && <div className="away-reason">{a.reason}</div>}
          </div>
          <button className="away-delete" aria-label="Delete away date" onClick={() => setConfirmDeleteId(a.id)}>X</button>
        </div>
      ))}

      {showForm ? (
        <form onSubmit={handleSubmit} className="away-form">
          <h3 className="away-form-title">{editingId ? 'Edit Away Period' : 'Add Away Period'}</h3>

          <label className="label" htmlFor="away-from">FROM</label>
          <div className="neu-inset">
            <input id="away-from" className="input-field" type="date" value={startDate} onChange={e => {
              setStartDate(e.target.value);
              if (e.target.value > endDate) setEndDate(e.target.value);
            }} />
          </div>

          <label className="label" htmlFor="away-to">TO</label>
          <div className="neu-inset">
            <input id="away-to" className="input-field" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>

          <label className="label" htmlFor="away-reason">REASON (OPTIONAL)</label>
          <div className="neu-inset">
            <input id="away-reason" className="input-field" placeholder="e.g. Holiday, family event" value={reason} onChange={e => setReason(e.target.value)} />
          </div>

          {error && <ErrorAlert message={error} compact />}

          <div className="form-submit-row">
            <button className="btn btn-small" type="button" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</button>
            <button className="btn btn-small btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      ) : (
        <div className="away-add-wrap">
          <button className="btn btn-green btn-full" onClick={() => setShowForm(true)}>Add Away Date</button>
        </div>
      )}
      {confirmDeleteId && (
        <ConfirmModal
          message="Remove this away date?"
          confirmLabel="Remove"
          danger
          onConfirm={() => { handleDelete(confirmDeleteId); setConfirmDeleteId(null); }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}
