import { useState, useEffect, useRef, type FormEvent } from 'react';
import { supabase } from '../supabase/client';
import { createGig, updateGig, deleteGig } from '@shared/supabase/queries';
import { isGigIncomplete } from '@shared/supabase/types';
import type { Gig } from '@shared/supabase/types';
import { isNetworkError, queueMutation } from '../hooks/useOfflineQueue';
import { ErrorAlert } from './ErrorAlert';
import { ConfirmModal } from './ConfirmModal';

interface GigFormProps {
  date: string;
  gigId?: string | null;
  initialType?: 'gig' | 'practice';
  onClose: () => void;
  onSaved: () => void;
}

export function GigForm({ date: initialDate, gigId, initialType = 'gig', onClose, onSaved }: GigFormProps) {
  const isEditing = !!gigId;

  const [date, setDate] = useState(initialDate);
  const [gigType, setGigType] = useState<'gig' | 'practice'>(initialType);
  const [venue, setVenue] = useState('');
  const [clientName, setClientName] = useState('');
  const [fee, setFee] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'invoice' | ''>('');
  const [loadTime, setLoadTime] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmIncomplete, setConfirmIncomplete] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingSubmitRef = useRef<any>(null);

  useEffect(() => {
    if (gigId) {
      supabase.from('gigs').select('*').eq('id', gigId).single().then(({ data, error: err }) => {
        if (err) { setError('Failed to load gig details'); return; }
        if (data) {
          setDate(data.date ?? initialDate);
          setGigType(data.gig_type ?? 'gig');
          setVenue(data.venue ?? '');
          setClientName(data.client_name ?? '');
          setFee(data.fee != null ? String(data.fee) : '');
          setPaymentType(data.payment_type ?? '');
          setLoadTime(data.load_time ? data.load_time.slice(0, 5) : '');
          setStartTime(data.start_time ? data.start_time.slice(0, 5) : '');
          setEndTime(data.end_time ? data.end_time.slice(0, 5) : '');
          setNotes(data.notes ?? '');
          setIsPublic(data.is_public ?? false);
        }
      });
    }
  }, [gigId, initialDate]);

  const isPractice = gigType === 'practice';
  const label = isPractice ? 'Practice' : 'Gig';

  function buildGigData() {
    return {
      date,
      gig_type: gigType,
      venue,
      client_name: clientName,
      fee: fee ? parseFloat(fee) : null,
      payment_type: paymentType,
      load_time: loadTime || null,
      start_time: startTime || null,
      end_time: endTime || null,
      notes,
      is_public: !isPractice && isPublic,
    };
  }

  type GigData = ReturnType<typeof buildGigData>;

  async function doSave(data: GigData) {
    setSaving(true);
    setError('');
    try {
      if (isEditing && gigId) {
        await updateGig(gigId, data);
      } else {
        await createGig(data);
      }
      onSaved();
    } catch (err) {
      if (isNetworkError(err)) {
        if (isEditing && gigId) {
          queueMutation('updateGig', { id: gigId, updates: data });
        } else {
          queueMutation('createGig', data);
        }
        onSaved();
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const data = buildGigData();

    // Warn if gig is incomplete but allow save
    const checkGig = { ...data, id: '', created_by: '', created_at: '', updated_at: '', fee: data.fee, payment_type: data.payment_type || '' } as Gig;
    if (isGigIncomplete(checkGig)) {
      const missing: string[] = [];
      if (!venue) missing.push('venue');
      if (gigType !== 'practice' && !clientName) missing.push('client');
      if (gigType !== 'practice' && data.fee == null) missing.push('fee');
      if (!startTime) missing.push('start time');
      if (gigType !== 'practice' && !loadTime) missing.push('load-in time');
      pendingSubmitRef.current = data;
      setConfirmIncomplete(`This ${gigType} is missing: ${missing.join(', ')}.\n\nSave anyway? It will be marked INCOMPLETE.`);
      return;
    }

    doSave(data);
  }

  async function handleDelete() {
    if (!gigId) return;
    try {
      await deleteGig(gigId);
      onSaved();
    } catch (err) {
      if (isNetworkError(err)) {
        queueMutation('deleteGig', { id: gigId });
        onSaved();
        return;
      }
      setError('Failed to delete');
    }
  }

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 className="page-title">{isEditing ? `Edit ${label}` : `New ${label}`}</h2>
        <div className="page-header-spacer" />
      </div>

      <form onSubmit={handleSubmit}>
        <label className="label" htmlFor="gig-date">DATE</label>
        <div className="neu-inset">
          <input id="gig-date" className="input-field" type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </div>

        {!isPractice && (
          <>
            <label className="label" htmlFor="gig-venue">VENUE</label>
            <div className="neu-inset">
              <input id="gig-venue" className="input-field" placeholder="e.g. Gin & Juice, Mumbles" value={venue} onChange={e => setVenue(e.target.value)} />
            </div>

            <label className="label" htmlFor="gig-client">CLIENT / BOOKER</label>
            <div className="neu-inset">
              <input id="gig-client" className="input-field" placeholder="e.g. Suave Agency" value={clientName} onChange={e => setClientName(e.target.value)} />
            </div>

            <label className="label" htmlFor="gig-fee">FEE</label>
            <div className="neu-inset">
              <input id="gig-fee" className="input-field" placeholder="e.g. 400" type="number" step="0.01" inputMode="decimal" value={fee} onChange={e => setFee(e.target.value)} />
            </div>

            <div className="label">PAYMENT TYPE</div>
            <div className="toggle-row">
              <button type="button" className={`toggle-btn neu-card ${paymentType === 'cash' ? 'active' : ''}`} onClick={() => setPaymentType('cash')}>Cash</button>
              <button type="button" className={`toggle-btn neu-card ${paymentType === 'invoice' ? 'active' : ''}`} onClick={() => setPaymentType('invoice')}>Invoice</button>
            </div>

            <label className="label" htmlFor="gig-load">LOAD-IN TIME</label>
            <div className="neu-inset">
              <input id="gig-load" className="input-field" type="time" value={loadTime} onChange={e => setLoadTime(e.target.value)} />
            </div>
          </>
        )}

        <label className="label" htmlFor="gig-start">START TIME</label>
        <div className="neu-inset">
          <input id="gig-start" className="input-field" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
        </div>

        <label className="label" htmlFor="gig-end">END TIME (OPTIONAL)</label>
        <div className="neu-inset">
          <input id="gig-end" className="input-field" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
        </div>

        {isPractice && (
          <>
            <label className="label" htmlFor="gig-location">LOCATION (OPTIONAL)</label>
            <div className="neu-inset">
              <input id="gig-location" className="input-field" placeholder="e.g. Neil's garage" value={venue} onChange={e => setVenue(e.target.value)} />
            </div>
          </>
        )}

        <label className="label" htmlFor="gig-notes">NOTES (OPTIONAL)</label>
        <div className="neu-inset">
          <textarea
            id="gig-notes"
            className="input-field input-noresize"
            placeholder="Any extra details..."
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {!isPractice && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={e => setIsPublic(e.target.checked)}
              className="checkbox-input"
            />
            <span>
              <span className="checkbox-text-main">Show on website</span>
              <br />
              <span className="checkbox-text-sub">Display this gig on thegreentangerine.com</span>
            </span>
          </label>
        )}

        {error && <ErrorAlert message={error} compact />}

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : isEditing ? `Update ${label}` : `Save ${label}`}
          </button>
          {isEditing && (
            <button className="btn btn-danger" type="button" onClick={() => setConfirmDelete(true)}>Delete</button>
          )}
        </div>
      </form>

      {confirmDelete && (
        <ConfirmModal
          message="Delete this gig?"
          confirmLabel="Delete"
          danger
          onConfirm={() => { setConfirmDelete(false); handleDelete(); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {confirmIncomplete && (
        <ConfirmModal
          message={confirmIncomplete}
          confirmLabel="Save Anyway"
          onConfirm={() => { setConfirmIncomplete(null); if (pendingSubmitRef.current) doSave(pendingSubmitRef.current); }}
          onCancel={() => { setConfirmIncomplete(null); pendingSubmitRef.current = null; }}
        />
      )}
    </div>
  );
}
