import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase/client';
import { createGig, updateGig, getVenueHistory } from '@shared/supabase/queries';
import { EntityPicker } from './EntityPicker';
import { isGigIncomplete } from '@shared/supabase/types';
import type { Gig, GigVisibility, AwayDateWithUser, Profile, BookingStatus, GigSubtype, EventType, BandSettings } from '@shared/supabase/types';
import { isNetworkError, queueMutation } from '../hooks/useOfflineQueue';
import { ErrorAlert } from './ErrorAlert';
import { ConfirmModal } from './ConfirmModal';
import { DigitalTimePicker } from './DigitalTimePicker';

// ─── Types ──────────────────────────────────────────────

type Flow = 'chooser' | 'quick' | 'full';

interface BookingWizardProps {
  date: string;
  gigId?: string | null;
  gigs: Gig[];
  awayDates: AwayDateWithUser[];
  profiles: Profile[];
  bandSettings?: BandSettings | null;
  onClose: () => void;
  onSaved: () => void;
  onGenerateQuote?: (gigId: string) => void;
  onCreateInvoice?: (gigId: string) => void;
}

const EVENT_TYPES: { value: EventType; label: string; icon: string }[] = [
  { value: 'wedding', label: 'Wedding', icon: '\u{1F48D}' },
  { value: 'corporate', label: 'Corporate', icon: '\u{1F3E2}' },
  { value: 'private', label: 'Private', icon: '\u{1F389}' },
  { value: 'festival', label: 'Festival', icon: '\u{1F3B6}' },
];

const STATUS_OPTIONS: { value: BookingStatus; label: string; icon: string }[] = [
  { value: 'enquiry', label: 'Enquiry', icon: '\u{1F4AC}' },
  { value: 'pencilled', label: 'Pencilled', icon: '\u270E' },
  { value: 'confirmed', label: 'Confirmed', icon: '\u2713' },
];

const VISIBILITY_OPTIONS: { value: GigVisibility; label: string }[] = [
  { value: 'hidden', label: 'Not Shared' },
  { value: 'public', label: 'Public Gig' },
  { value: 'private', label: 'Private Booking' },
];

// ─── Helpers ────────────────────────────────────────────

function subtractOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${String((h - 1 + 24) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const day = d.getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
  return `${days[d.getDay()]} ${day}${suffix} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

function daysBetween(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Component ──────────────────────────────────────────

export function BookingWizard({
  date: initialDate,
  gigId,
  gigs,
  awayDates,
  profiles,
  bandSettings,
  onClose,
  onSaved,
  onGenerateQuote,
  onCreateInvoice,
}: BookingWizardProps) {
  const isEditing = !!gigId;

  // Flow & step
  const [flow, setFlow] = useState<Flow>('chooser');
  const [quickStep, setQuickStep] = useState(1);
  const [fullStep, setFullStep] = useState(1);

  // Shared form state
  const [date, setDate] = useState(initialDate);
  const [venue, setVenue] = useState('');
  const [venueId, setVenueId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [fee, setFee] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'invoice' | ''>('cash');
  const [loadTime, setLoadTime] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [visibility, setVisibility] = useState<GigVisibility>('hidden');

  // Full booking specific
  const [, setGigSubtype] = useState<GigSubtype>('pub');
  const [status, setStatus] = useState<BookingStatus>('pencilled');
  const [eventType, setEventType] = useState<EventType>('wedding');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositPaid, setDepositPaid] = useState(false);
  const [quoteAction, setQuoteAction] = useState<'quote' | 'invoice' | 'later'>('later');

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmIncomplete, setConfirmIncomplete] = useState<string | null>(null);
  const [cancelPubGigId, setCancelPubGigId] = useState<string | null>(null);

  // Auto-fill from venue history
  const [lastFee, setLastFee] = useState<number | null>(null);
  const [usualStartTime, setUsualStartTime] = useState<string | null>(null);

  const loadTimeManual = useRef(false);
  const pendingSubmitRef = useRef<ReturnType<typeof buildGigData> | null>(null);

  // ─── Conflict & away detection ────────────────────────

  const dateGigs = gigs.filter(g => g.date === date && g.status !== 'cancelled');
  const dateAwayMembers = awayDates.filter(a => date >= a.start_date && date <= a.end_date);
  const isBandUnavailable = dateAwayMembers.length > 0;
  const existingPubGigs = dateGigs.filter(g => g.gig_type === 'gig' && g.gig_subtype === 'pub');
  const cancellationThreshold = bandSettings?.cancellation_threshold_days ?? 14;

  // ─── Edit mode: load existing gig ────────────────────

  useEffect(() => {
    if (!gigId) return;
    supabase.from('gigs').select('*').eq('id', gigId).single().then(({ data, error: err }) => {
      if (err || !data) { setError('Failed to load gig details'); return; }
      setDate(data.date ?? initialDate);
      setVenue(data.venue ?? '');
      setVenueId(data.venue_id ?? null);
      setClientName(data.client_name ?? '');
      setClientId(data.client_id ?? null);
      setFee(data.fee != null ? String(data.fee) : '');
      setPaymentType(data.payment_type ?? '');
      setLoadTime(data.load_time ? data.load_time.slice(0, 5) : '');
      if (data.load_time) loadTimeManual.current = true;
      setStartTime(data.start_time ? data.start_time.slice(0, 5) : '');
      setEndTime(data.end_time ? data.end_time.slice(0, 5) : '');
      setNotes(data.notes ?? '');
      setVisibility(data.visibility ?? 'hidden');
      setGigSubtype(data.gig_subtype ?? 'pub');
      setStatus(data.status ?? 'confirmed');
      setDepositAmount(data.deposit_amount != null ? String(data.deposit_amount) : '');
      setDepositPaid(data.deposit_paid ?? false);

      // Route to correct flow
      if (data.gig_subtype === 'client') {
        setFlow('full');
        setFullStep(3); // Jump to details for edit
      } else {
        setFlow('quick');
        setQuickStep(1);
      }
    });
  }, [gigId, initialDate]);

  // ─── Venue history auto-fill ──────────────────────────

  useEffect(() => {
    if (venueId) {
      getVenueHistory(venueId).then(h => {
        setLastFee(h.lastFee);
        setUsualStartTime(h.usualStartTime);
      }).catch(() => {});
    }
  }, [venueId]);

  // ─── Time handlers ────────────────────────────────────

  function handleStartTimeChange(val: string) {
    setStartTime(val);
    if (!loadTimeManual.current) setLoadTime(subtractOneHour(val));
  }

  function handleLoadTimeChange(val: string) {
    setLoadTime(val);
    loadTimeManual.current = true;
  }

  // ─── Build & save ─────────────────────────────────────

  function buildGigData() {
    const isClient = flow === 'full';
    return {
      date,
      gig_type: 'gig' as const,
      gig_subtype: isClient ? 'client' as GigSubtype : 'pub' as GigSubtype,
      status: isClient ? status : 'confirmed' as BookingStatus,
      venue,
      venue_id: venueId,
      client_name: isClient ? clientName : '',
      client_id: isClient ? clientId : null,
      fee: fee ? parseFloat(fee) : null,
      payment_type: paymentType,
      load_time: loadTime || null,
      start_time: startTime || null,
      end_time: endTime || null,
      notes,
      visibility,
      deposit_amount: isClient && depositAmount ? parseFloat(depositAmount) : null,
      deposit_paid: isClient ? depositPaid : false,
    };
  }

  async function doSave(data: ReturnType<typeof buildGigData>) {
    setSaving(true);
    setError('');
    try {
      let savedGig: Gig;
      if (isEditing && gigId) {
        await updateGig(gigId, data);
        savedGig = { ...data, id: gigId } as Gig;
      } else {
        savedGig = await createGig(data);
      }

      // Handle cancel pub gig if selected
      if (cancelPubGigId) {
        try {
          await updateGig(cancelPubGigId, { status: 'cancelled' });
        } catch { /* best effort */ }
      }

      // Handle quote/invoice action after save
      if (quoteAction === 'quote' && onGenerateQuote) {
        onGenerateQuote(savedGig.id);
        return;
      }
      if (quoteAction === 'invoice' && onCreateInvoice) {
        onCreateInvoice(savedGig.id);
        return;
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

  function handleSave() {
    const data = buildGigData();
    const checkGig = { ...data, id: '', created_by: '', created_at: '', updated_at: '', fee: data.fee, payment_type: data.payment_type || '' } as unknown as Gig;
    if (isGigIncomplete(checkGig)) {
      const missing: string[] = [];
      if (!venue) missing.push('venue');
      if (data.fee == null) missing.push('fee');
      if (!startTime) missing.push('start time');
      pendingSubmitRef.current = data;
      setConfirmIncomplete(`Missing: ${missing.join(', ')}.\n\nSave anyway?`);
      return;
    }
    doSave(data);
  }

  // ─── Back handler ─────────────────────────────────────

  function handleBack() {
    if (flow === 'chooser') { onClose(); return; }
    if (flow === 'quick') {
      if (quickStep <= 1) { setFlow('chooser'); return; }
      setQuickStep(s => s - 1);
      return;
    }
    if (flow === 'full') {
      if (fullStep <= 1) { setFlow('chooser'); return; }
      setFullStep(s => s - 1);
    }
  }

  // ─── Step rail component ──────────────────────────────

  function StepRail({ total, current }: { total: number; current: number }) {
    return (
      <div className="bw-rail">
        {Array.from({ length: total }, (_, i) => (
          <span key={i}>
            {i > 0 && <span className={`bw-conn${i < current ? ' ok' : ''}`} />}
            <span className={`bw-pip${i + 1 === current ? ' on' : i + 1 < current ? ' ok' : ''}`} />
          </span>
        ))}
      </div>
    );
  }

  // ─── Pipeline tracker component ───────────────────────

  function PipelineTracker() {
    const stages = ['Enquiry', 'Pencilled', 'Confirmed', 'Quote', 'Invoice', 'Paid'];
    const statusIdx = status === 'enquiry' ? 0 : status === 'pencilled' ? 1 : status === 'confirmed' ? 2 : -1;
    return (
      <div className="bw-pipeline">
        {stages.map((s, i) => (
          <span key={s}>
            {i > 0 && <span className={`bw-pl${i <= statusIdx ? ' ok' : ''}`} />}
            <span className="bw-pn">
              <span className={`bw-pd${i < statusIdx ? ' pg' : i === statusIdx ? ' pt' : ' ph'}`} />
              <span className={`bw-pnl${i < statusIdx ? ' ok' : i === statusIdx ? ' on' : ''}`}>{s}</span>
            </span>
          </span>
        ))}
      </div>
    );
  }

  // ─── Conflict card ────────────────────────────────────

  function ConflictCard({ gig }: { gig: Gig }) {
    const daysAway = daysBetween(gig.date);
    const isSafe = daysAway >= cancellationThreshold;
    return (
      <div className="bw-conflict">
        <div className="bw-conflict-hdr">{'\u26A0'} Existing booking</div>
        <div className="bw-conflict-body">
          <div className="bw-conflict-row">
            <span className="bw-conflict-vn">{gig.venue || 'No venue'}</span>
            <span className="bw-conflict-fee mono">{gig.fee != null ? `\u00A3${gig.fee}` : ''}</span>
          </div>
          <div className="bw-conflict-meta">
            Pub gig {'\u00B7'} {gig.payment_type || 'Cash'} {'\u00B7'} {gig.start_time?.slice(0, 5) || '—'}
          </div>
          <div className={`bw-conflict-safe ${isSafe ? 'safe' : 'unsafe'}`}>
            {isSafe ? '\u2713' : '\u26A0'} {daysAway > 0 ? `${Math.floor(daysAway / 7)} weeks away` : 'Today'} — {isSafe ? 'safe to cancel' : 'too late to cancel'}
          </div>
          <div className="bw-conflict-acts">
            <button className="btn btn-danger btn-sm" onClick={() => setCancelPubGigId(gig.id)}>Cancel Pub Gig</button>
            <button className="btn btn-outline btn-sm" onClick={() => setCancelPubGigId(null)}>Keep Both</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Member split preview ─────────────────────────────

  function MemberSplit() {
    const feeNum = fee ? parseFloat(fee) : 0;
    const count = profiles.length || 4;
    const share = feeNum / count;
    const colors = ['var(--color-gig)', 'var(--color-tangerine)', 'var(--color-practice)', 'var(--color-teal)'];
    return (
      <div className="bw-split">
        <div className="bw-section-label">Member Split</div>
        <div className="bw-split-card">
          {profiles.map((p, i) => (
            <div key={p.id} className="bw-split-row">
              <div className="bw-split-avatar" style={{ background: colors[i % colors.length] }}>{p.name[0]}</div>
              <div className="bw-split-name">{p.name}</div>
              <div className="bw-split-amount mono">{'\u00A3'}{share.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Ticket summary component ─────────────────────────

  function TicketSummary({ variant }: { variant: 'green' | 'tangerine' }) {
    const isClient = flow === 'full';
    return (
      <div className={`bw-ticket ${variant === 'green' ? 'bw-ticket-green' : 'bw-ticket-tangerine'}`}>
        <div className="bw-ticket-header">
          <div className="bw-ticket-top">
            <div>
              <div className="bw-ticket-venue">{venue || 'No venue'}</div>
              {isClient && clientName && (
                <div className="bw-ticket-client">
                  <span className="badge badge-tangerine" style={{ marginRight: 4 }}>{eventType}</span>
                  {clientName}
                </div>
              )}
              {!isClient && <div className="bw-ticket-client">{formatDate(date)}</div>}
            </div>
            <div className="bw-ticket-fee mono">{fee ? `\u00A3${parseFloat(fee).toLocaleString()}` : '—'}</div>
          </div>
        </div>
        <div className="bw-ticket-tear" />
        <div className="bw-ticket-body">
          {isClient && <TicketRow label="Date" value={formatDate(date)} />}
          {isClient && <TicketRow label="Status" value={<span className="badge badge-tangerine">{status}</span>} />}
          <TicketRow label="Start" value={<span className="mono">{startTime || '—'}</span>} />
          <TicketRow label="Load-in" value={<span className="mono">{loadTime || '—'}</span>} />
          <TicketRow label="End" value={<span className="mono">{endTime || '—'}</span>} />
          {!isClient && <TicketRow label="Payment" value={paymentType || '—'} />}
          {isClient && depositAmount && (
            <>
              <TicketRow label="Deposit" value={<span className="mono" style={{ color: 'var(--color-tangerine)' }}>{'\u00A3'}{depositAmount}</span>} />
              <TicketRow label="Balance" value={<span className="mono" style={{ color: 'var(--color-gig)' }}>{'\u00A3'}{(parseFloat(fee || '0') - parseFloat(depositAmount || '0')).toLocaleString()}</span>} />
            </>
          )}
          {notes && <TicketRow label="Notes" value={notes} />}
        </div>
      </div>
    );
  }

  function TicketRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div className="bw-ticket-row">
        <span className="bw-ticket-rl">{label}</span>
        <span className="bw-ticket-rv">{value}</span>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════
  //  RENDER
  // ═════════════════════════════════════════════════════

  const title = flow === 'chooser' ? 'New Booking'
    : flow === 'quick' ? 'Quick Entry'
    : 'Full Booking';

  const stepLabels = flow === 'full' ? ['Date', 'Client', 'Details', 'Status', 'Review'] : [];

  return (
    <div className="bw-wrap">
      {/* Header */}
      <div className="bw-header">
        <button className="bw-back" onClick={handleBack}>{'\u25C0'}</button>
        <div className="bw-title">{title}</div>
        {flow !== 'chooser' && (
          <span className={`badge ${flow === 'quick' ? 'badge-green' : 'badge-tangerine'}`}>
            {flow === 'full' && stepLabels[fullStep - 1]}
            {flow === 'quick' && formatDateShort(date)}
          </span>
        )}
      </div>

      {/* Step rail */}
      {flow === 'quick' && <StepRail total={2} current={quickStep} />}
      {flow === 'full' && <StepRail total={5} current={fullStep} />}

      {error && <div style={{ padding: '0 20px' }}><ErrorAlert message={error} compact /></div>}

      {/* ─── CHOOSER ─────────────────────────────────── */}
      {flow === 'chooser' && (
        <div className="bw-chooser">
          {/* Availability banner */}
          {isBandUnavailable ? (
            <div className="bw-banner bw-banner-danger">
              <span>{'\u26A0'}</span>
              <div>
                <strong>{dateAwayMembers.map(a => a.user_name).join(', ')} {dateAwayMembers.length === 1 ? 'is' : 'are'} away</strong>
                <br />Band unavailable on {formatDateShort(date)}
              </div>
            </div>
          ) : (
            <div className="bw-banner bw-banner-ok">
              <span>{'\u2713'}</span>
              <div><strong>{formatDate(date)}</strong> is available</div>
            </div>
          )}

          <div className="bw-chooser-cards">
            {/* Quick Entry */}
            <div className="bw-choose-card" onClick={() => { setFlow('quick'); setGigSubtype('pub'); }}>
              <div className="bw-choose-bg bw-choose-bg-green" />
              <div className="bw-choose-content">
                <div className="bw-choose-head">
                  <div className="bw-choose-icon bw-choose-icon-green">{'\u266A'}</div>
                  <div>
                    <div className="bw-choose-title" style={{ color: 'var(--color-gig)' }}>Quick Entry</div>
                    <div className="bw-choose-sub">Pub, festival, filler — 30 seconds</div>
                  </div>
                </div>
                <div className="bw-choose-desc">Auto-fill from venue history. Optional invoice.</div>
                <div className="bw-choose-chips">
                  <span className="bw-chip bw-chip-green">Auto-fill</span>
                  <span className="bw-chip bw-chip-green">Cash / Invoice</span>
                </div>
              </div>
            </div>

            {/* Full Booking */}
            <div className="bw-choose-card" onClick={() => { setFlow('full'); setGigSubtype('client'); }}>
              <div className="bw-choose-bg bw-choose-bg-tangerine" />
              <div className="bw-choose-content">
                <div className="bw-choose-head">
                  <div className="bw-choose-icon bw-choose-icon-tangerine">{'\u2605'}</div>
                  <div>
                    <div className="bw-choose-title" style={{ color: 'var(--color-tangerine)' }}>Full Booking</div>
                    <div className="bw-choose-sub">Client, wedding, corporate</div>
                  </div>
                </div>
                <div className="bw-choose-desc">Status tracking, conflict management, quotes, invoicing, deposits.</div>
                <div className="bw-choose-chips">
                  <span className="bw-chip bw-chip-tangerine">Status</span>
                  <span className="bw-chip bw-chip-tangerine">Quotes</span>
                  <span className="bw-chip bw-chip-tangerine">Deposits</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── QUICK ENTRY: Step 1 ─────────────────────── */}
      {flow === 'quick' && quickStep === 1 && (
        <div className="bw-step">
          <div className="bw-field">
            <div className="bw-field-label">VENUE</div>
            <EntityPicker
              mode="venue"
              value={venue}
              entityId={venueId}
              onChange={(text, id) => {
                setVenue(text);
                setVenueId(id);
                // Auto-fill start time from venue history
                if (id && usualStartTime) {
                  setStartTime(usualStartTime);
                  if (!loadTimeManual.current) setLoadTime(subtractOneHour(usualStartTime));
                }
              }}
              placeholder="Search venues..."
            />
          </div>

          <div className="bw-field">
            <div className="bw-field-label">FEE</div>
            <div className="bw-input-wrap">
              <span className="bw-input-prefix">{'\u00A3'}</span>
              <input
                className="bw-input mono"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={fee}
                onChange={e => setFee(e.target.value)}
                placeholder="0.00"
              />
            </div>
            {lastFee != null && (
              <button
                type="button"
                className="bw-fee-chip"
                onClick={() => setFee(String(lastFee))}
              >
                Last fee: <span className="mono">{'\u00A3'}{lastFee}</span>
              </button>
            )}
          </div>

          <div className="bw-time-grid">
            <div className="bw-time-tile">
              <div className="bw-time-label">Start</div>
              <DigitalTimePicker value={startTime} onChange={handleStartTimeChange} />
              {usualStartTime && <div className="bw-time-hint">usual here</div>}
            </div>
            <div className="bw-time-tile">
              <div className="bw-time-label">Load-in</div>
              <DigitalTimePicker value={loadTime} onChange={handleLoadTimeChange} />
              <div className="bw-time-hint">auto -1hr</div>
            </div>
            <div className="bw-time-tile">
              <div className="bw-time-label">Payment</div>
              <div className="bw-payment-toggle">
                <button className={`bw-pay-btn${paymentType === 'cash' ? ' active' : ''}`} onClick={() => setPaymentType('cash')}>Cash</button>
                <button className={`bw-pay-btn${paymentType === 'invoice' ? ' active' : ''}`} onClick={() => setPaymentType('invoice')}>Invoice</button>
              </div>
            </div>
            <div className="bw-time-tile">
              <div className="bw-time-label">End</div>
              <DigitalTimePicker value={endTime} onChange={setEndTime} />
            </div>
          </div>

          <div className="bw-field">
            <div className="bw-field-label">NOTES</div>
            <div className="bw-input-wrap">
              <input className="bw-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional..." />
            </div>
          </div>

          <div className="bw-actions">
            <button className="btn btn-primary" onClick={() => setQuickStep(2)}>Review & Save</button>
          </div>
        </div>
      )}

      {/* ─── QUICK ENTRY: Step 2 (Confirm) ───────────── */}
      {flow === 'quick' && quickStep === 2 && (
        <div className="bw-step">
          <TicketSummary variant="green" />
          <MemberSplit />

          <div className="bw-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Booking'}
            </button>
            <button className="btn btn-outline" onClick={() => setQuickStep(1)}>Edit</button>
          </div>
        </div>
      )}

      {/* ─── FULL BOOKING: Step 1 (Date & Conflicts) ── */}
      {flow === 'full' && fullStep === 1 && (
        <div className="bw-step">
          <div className="bw-section-label">Date & Availability</div>
          <div className="bw-date-card">
            <div className="bw-date-info">
              <div className="bw-date-label">Selected Date</div>
              <div className="bw-date-value">{formatDate(date)}</div>
            </div>
            <button className="bw-date-change" onClick={() => {/* Date picker handled by parent */ }}>Change</button>
          </div>

          {/* Conflict cards for existing pub gigs */}
          {existingPubGigs.map(g => (
            <ConflictCard key={g.id} gig={g} />
          ))}

          {/* Away warning */}
          {isBandUnavailable && (
            <div className="bw-banner bw-banner-danger">
              <span>{'\u{1F6AB}'}</span>
              <div>
                <strong>{dateAwayMembers.map(a => a.user_name).join(', ')} {dateAwayMembers.length === 1 ? 'is' : 'are'} away</strong>
                <br />Band unavailable — book anyway?
              </div>
            </div>
          )}

          <div className="bw-actions" style={{ marginTop: 6 }}>
            <button className="btn btn-tangerine" onClick={() => setFullStep(2)}>Next: Client</button>
          </div>
        </div>
      )}

      {/* ─── FULL BOOKING: Step 2 (Client & Event) ──── */}
      {flow === 'full' && fullStep === 2 && (
        <div className="bw-step">
          <div className="bw-section-label">Client / Booker</div>
          <div className="bw-field">
            <EntityPicker
              mode="client"
              value={clientName}
              entityId={clientId}
              onChange={(text, id) => { setClientName(text); setClientId(id); }}
              placeholder="Search clients..."
            />
          </div>

          <div className="bw-section-label">Event Type</div>
          <div className="bw-event-grid">
            {EVENT_TYPES.map(et => (
              <button
                key={et.value}
                className={`bw-event-tile${eventType === et.value ? ' selected' : ''}`}
                onClick={() => setEventType(et.value)}
              >
                <div className="bw-event-icon">{et.icon}</div>
                <div className="bw-event-name">{et.label}</div>
              </button>
            ))}
          </div>

          <div className="bw-actions">
            <button className="btn btn-tangerine" onClick={() => setFullStep(3)}>Next: Details</button>
            <button className="btn btn-outline" onClick={() => setFullStep(1)}>Back</button>
          </div>
        </div>
      )}

      {/* ─── FULL BOOKING: Step 3 (Details) ──────────── */}
      {flow === 'full' && fullStep === 3 && (
        <div className="bw-step">
          <div className="bw-field">
            <div className="bw-field-label">VENUE</div>
            <EntityPicker
              mode="venue"
              value={venue}
              entityId={venueId}
              onChange={(text, id) => { setVenue(text); setVenueId(id); }}
              placeholder="Search venues..."
            />
          </div>

          <div className="bw-field">
            <div className="bw-field-label">FEE</div>
            <div className="bw-input-wrap">
              <span className="bw-input-prefix">{'\u00A3'}</span>
              <input className="bw-input mono" type="number" step="0.01" inputMode="decimal" value={fee} onChange={e => setFee(e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div className="bw-field">
            <div className="bw-field-label">DEPOSIT</div>
            <div className="bw-input-wrap">
              <span className="bw-input-prefix">{'\u00A3'}</span>
              <input className="bw-input mono" type="number" step="0.01" inputMode="decimal" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="bw-hint">Optional — shown on quote & invoice</div>
          </div>

          <div className="bw-time-grid">
            <div className="bw-time-tile">
              <div className="bw-time-label">Start</div>
              <DigitalTimePicker value={startTime} onChange={handleStartTimeChange} />
            </div>
            <div className="bw-time-tile">
              <div className="bw-time-label">Load-in</div>
              <DigitalTimePicker value={loadTime} onChange={handleLoadTimeChange} />
              <div className="bw-time-hint">auto -1hr</div>
            </div>
            <div className="bw-time-tile">
              <div className="bw-time-label">End</div>
              <DigitalTimePicker value={endTime} onChange={setEndTime} />
            </div>
          </div>

          <div className="bw-field">
            <div className="bw-field-label">NOTES</div>
            <div className="bw-input-wrap">
              <input className="bw-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special requirements..." />
            </div>
          </div>

          <div className="bw-actions">
            <button className="btn btn-tangerine" onClick={() => setFullStep(4)}>Next: Status</button>
            <button className="btn btn-outline" onClick={() => setFullStep(2)}>Back</button>
          </div>
        </div>
      )}

      {/* ─── FULL BOOKING: Step 4 (Status) ───────────── */}
      {flow === 'full' && fullStep === 4 && (
        <div className="bw-step">
          <div className="bw-section-label">Booking Status</div>
          <div className="bw-status-grid">
            {STATUS_OPTIONS.map(s => (
              <button
                key={s.value}
                className={`bw-status-tile${status === s.value ? ` selected-${s.value}` : ''}`}
                onClick={() => setStatus(s.value)}
              >
                <div className="bw-status-icon">{s.icon}</div>
                <div className="bw-status-name">{s.label}</div>
              </button>
            ))}
          </div>

          <div className="bw-separator" />

          <div className="bw-section-label">Quote & Invoice</div>
          <div className="bw-action-options">
            <button className={`bw-action-option${quoteAction === 'quote' ? ' selected' : ''}`} onClick={() => setQuoteAction('quote')}>
              <div className="bw-ao-icon" style={{ background: 'rgba(243,156,18,0.1)', borderColor: 'rgba(243,156,18,0.15)' }}>{'\u{1F4C4}'}</div>
              <div className="bw-ao-content">
                <div className="bw-ao-title" style={{ color: 'var(--color-tangerine)' }}>Generate Quote</div>
                <div className="bw-ao-desc">Pre-filled from this booking</div>
              </div>
              <span className="bw-ao-arrow">{'\u25B6'}</span>
            </button>
            <button className={`bw-action-option${quoteAction === 'invoice' ? ' selected' : ''}`} onClick={() => setQuoteAction('invoice')}>
              <div className="bw-ao-icon" style={{ background: 'rgba(0,230,118,0.1)', borderColor: 'rgba(0,230,118,0.15)' }}>{'\u{1F4B3}'}</div>
              <div className="bw-ao-content">
                <div className="bw-ao-title" style={{ color: 'var(--color-gig)' }}>Create Invoice</div>
                <div className="bw-ao-desc">Skip quote — invoice directly</div>
              </div>
              <span className="bw-ao-arrow">{'\u25B6'}</span>
            </button>
            <button className={`bw-action-option${quoteAction === 'later' ? ' selected' : ''}`} onClick={() => setQuoteAction('later')} style={{ opacity: 0.6 }}>
              <div className="bw-ao-icon" style={{ background: 'rgba(255,255,255,0.04)' }}>{'\u{1F553}'}</div>
              <div className="bw-ao-content">
                <div className="bw-ao-title">Do This Later</div>
                <div className="bw-ao-desc">From gig hub anytime</div>
              </div>
              <span className="bw-ao-arrow">{'\u25B6'}</span>
            </button>
          </div>

          <div className="bw-separator" />

          <div className="bw-section-label">Website Visibility</div>
          <div className="bw-visibility-row">
            {VISIBILITY_OPTIONS.map(v => (
              <button
                key={v.value}
                className={`bw-vis-btn${visibility === v.value ? ' active' : ''}`}
                onClick={() => setVisibility(v.value)}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="bw-actions">
            <button className="btn btn-tangerine" onClick={() => setFullStep(5)}>Next: Review</button>
            <button className="btn btn-outline" onClick={() => setFullStep(3)}>Back</button>
          </div>
        </div>
      )}

      {/* ─── FULL BOOKING: Step 5 (Review) ───────────── */}
      {flow === 'full' && fullStep === 5 && (
        <div className="bw-step">
          <PipelineTracker />
          <TicketSummary variant="tangerine" />

          {cancelPubGigId && (
            <div className="bw-banner bw-banner-warning">
              <span>{'\u26A0'}</span>
              <div>
                <strong>{existingPubGigs.find(g => g.id === cancelPubGigId)?.venue || 'Pub gig'}</strong> will be cancelled
                <br /><span style={{ color: 'var(--color-gig)', fontWeight: 600 }}>
                  {daysBetween(date)} days — {daysBetween(date) >= cancellationThreshold ? 'within window' : 'below threshold'}
                </span>
              </div>
            </div>
          )}

          <div className="bw-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Booking'}
            </button>
            {quoteAction !== 'later' && (
              <button className="btn btn-tangerine" onClick={handleSave} disabled={saving}>
                Save & {quoteAction === 'quote' ? 'Generate Quote' : 'Create Invoice'}
              </button>
            )}
            <button className="btn btn-outline" onClick={() => setFullStep(4)}>Edit</button>
          </div>
        </div>
      )}

      {/* ─── Modals ──────────────────────────────────── */}
      {confirmIncomplete && (
        <ConfirmModal
          message={confirmIncomplete}
          confirmLabel="Save Anyway"
          onConfirm={() => {
            setConfirmIncomplete(null);
            if (pendingSubmitRef.current) doSave(pendingSubmitRef.current);
          }}
          onCancel={() => { setConfirmIncomplete(null); pendingSubmitRef.current = null; }}
        />
      )}
    </div>
  );
}
