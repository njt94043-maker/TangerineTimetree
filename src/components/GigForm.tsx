import { useState, useEffect, type FormEvent } from 'react';
import { supabase } from '../supabase/client';
import { createGig, updateGig, deleteGig } from '../supabase/queries';

interface GigFormProps {
  date: string;
  gigId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export function GigForm({ date: initialDate, gigId, onClose, onSaved }: GigFormProps) {
  const isEditing = !!gigId;

  const [date, setDate] = useState(initialDate);
  const [gigType, setGigType] = useState<'gig' | 'practice'>('gig');
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
    if (!gigId || !confirm('Delete this gig?')) return;
    try {
      await deleteGig(gigId);
      onSaved();
    } catch {
      setError('Failed to delete');
    }
  }

  const isPractice = gigType === 'practice';
  const title = isEditing
    ? `Edit ${isPractice ? 'Practice' : 'Gig'}`
    : `New ${isPractice ? 'Practice' : 'Gig'}`;

  return (
    <div className="form-wrap" style={{ paddingTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h2>
        <div style={{ width: 60 }} />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="label">TYPE</div>
        <div className="toggle-row">
          <div className={`toggle-btn neu-card ${gigType === 'gig' ? 'active' : ''}`} onClick={() => setGigType('gig')}>Gig</div>
          <div className={`toggle-btn neu-card ${gigType === 'practice' ? 'active practice' : ''}`} onClick={() => setGigType('practice')}>Practice</div>
        </div>

        <div className="label">DATE</div>
        <div className="neu-inset">
          <input className="input-field" type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </div>

        {!isPractice && (
          <>
            <div className="label">VENUE</div>
            <div className="neu-inset">
              <input className="input-field" placeholder="e.g. Gin & Juice, Mumbles" value={venue} onChange={e => setVenue(e.target.value)} />
            </div>

            <div className="label">CLIENT / BOOKER</div>
            <div className="neu-inset">
              <input className="input-field" placeholder="e.g. Suave Agency" value={clientName} onChange={e => setClientName(e.target.value)} />
            </div>

            <div className="label">FEE</div>
            <div className="neu-inset">
              <input className="input-field" placeholder="e.g. 400" type="number" step="0.01" inputMode="decimal" value={fee} onChange={e => setFee(e.target.value)} />
            </div>

            <div className="label">PAYMENT TYPE</div>
            <div className="toggle-row">
              <div className={`toggle-btn neu-card ${paymentType === 'cash' ? 'active' : ''}`} onClick={() => setPaymentType('cash')}>Cash</div>
              <div className={`toggle-btn neu-card ${paymentType === 'invoice' ? 'active' : ''}`} onClick={() => setPaymentType('invoice')}>Invoice</div>
            </div>

            <div className="label">LOAD-IN TIME</div>
            <div className="neu-inset">
              <input className="input-field" type="time" value={loadTime} onChange={e => setLoadTime(e.target.value)} />
            </div>
          </>
        )}

        <div className="label">START TIME</div>
        <div className="neu-inset">
          <input className="input-field" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
        </div>

        <div className="label">END TIME (OPTIONAL)</div>
        <div className="neu-inset">
          <input className="input-field" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
        </div>

        {isPractice && (
          <>
            <div className="label">LOCATION (OPTIONAL)</div>
            <div className="neu-inset">
              <input className="input-field" placeholder="e.g. Neil's garage" value={venue} onChange={e => setVenue(e.target.value)} />
            </div>
          </>
        )}

        <div className="label">NOTES (OPTIONAL)</div>
        <div className="neu-inset">
          <textarea
            className="input-field"
            placeholder="Any extra details..."
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ resize: 'none' }}
          />
        </div>

        {error && <p style={{ color: 'var(--color-danger)', fontSize: 12, textAlign: 'center', marginTop: 14 }}>{error}</p>}

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : isEditing ? `Update ${isPractice ? 'Practice' : 'Gig'}` : `Save ${isPractice ? 'Practice' : 'Gig'}`}
          </button>
          {isEditing && (
            <button className="btn btn-danger" type="button" onClick={handleDelete}>Delete</button>
          )}
        </div>
      </form>
    </div>
  );
}
