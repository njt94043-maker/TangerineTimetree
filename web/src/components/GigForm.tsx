import { useState, useEffect, type FormEvent } from 'react';
import { supabase } from '../supabase/client';
import { createGig, updateGig, deleteGig } from '@shared/supabase/queries';
import { isGigIncomplete } from '@shared/supabase/types';
import type { Gig } from '@shared/supabase/types';

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (gigId) {
      supabase.from('gigs').select('*').eq('id', gigId).single().then(({ data }) => {
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
        }
      });
    }
  }, [gigId, initialDate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const data = {
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
      };

      // Warn if gig is incomplete but allow save
      const checkGig = { ...data, id: '', created_by: '', created_at: '', updated_at: '', fee: data.fee, payment_type: data.payment_type || '' } as Gig;
      if (isGigIncomplete(checkGig)) {
        const missing: string[] = [];
        if (!venue) missing.push('venue');
        if (gigType !== 'practice' && !clientName) missing.push('client');
        if (gigType !== 'practice' && data.fee == null) missing.push('fee');
        if (!startTime) missing.push('start time');
        if (gigType !== 'practice' && !loadTime) missing.push('load-in time');
        const ok = confirm(`This ${gigType} is missing: ${missing.join(', ')}.\n\nSave anyway? It will be marked INCOMPLETE.`);
        if (!ok) { setSaving(false); return; }
      }

      if (isEditing && gigId) {
        await updateGig(gigId, data);
      } else {
        await createGig(data);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!gigId || !confirm('Delete this?')) return;
    try {
      await deleteGig(gigId);
      onSaved();
    } catch {
      setError('Failed to delete');
    }
  }

  const isPractice = gigType === 'practice';
  const label = isPractice ? 'Practice' : 'Gig';

  return (
    <div className="form-wrap" style={{ paddingTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>{isEditing ? `Edit ${label}` : `New ${label}`}</h2>
        <div style={{ width: 60 }} />
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
            className="input-field"
            placeholder="Any extra details..."
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ resize: 'none' }}
          />
        </div>

        {error && <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 12, textAlign: 'center', marginTop: 14 }}>{error}</p>}

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : isEditing ? `Update ${label}` : `Save ${label}`}
          </button>
          {isEditing && (
            <button className="btn btn-danger" type="button" onClick={handleDelete}>Delete</button>
          )}
        </div>
      </form>
    </div>
  );
}
