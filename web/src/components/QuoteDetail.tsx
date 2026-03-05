import { useState, useEffect } from 'react';
import {
  getQuote, getQuoteLineItems, deleteQuote,
  sendQuote, acceptQuote, declineQuote, expireQuote,
  getFormalInvoiceByQuote, getFormalInvoiceLineItems,
  sendFormalInvoice, markFormalInvoicePaid, getFormalReceipts,
} from '@shared/supabase/queries';
import type {
  QuoteWithClient, QuoteLineItem,
  FormalInvoiceWithClient, FormalInvoiceLineItem, FormalReceiptWithMember,
} from '@shared/supabase/types';
import { INVOICE_STYLES } from '@shared/templates';
import { formatDateLong, formatGBP, addDaysISO } from '../utils/format';
import { ErrorAlert } from './ErrorAlert';
import { ConfirmModal } from './ConfirmModal';
import { LoadingSpinner } from './LoadingSpinner';

type Stage = 'draft' | 'sent' | 'accepted' | 'invoice-sent' | 'paid' | 'declined' | 'expired';

const STAGE_LABELS: Record<Stage, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  'invoice-sent': 'Invoice Sent',
  paid: 'Paid',
  declined: 'Declined',
  expired: 'Expired',
};

const STAGE_COLORS: Record<Stage, string> = {
  draft: 'var(--color-text-dim)',
  sent: 'var(--color-tangerine)',
  accepted: 'var(--color-green)',
  'invoice-sent': 'var(--color-tangerine)',
  paid: 'var(--color-green)',
  declined: 'var(--color-danger)',
  expired: 'var(--color-text-muted)',
};

const PROGRESS_STAGES: Stage[] = ['draft', 'sent', 'accepted', 'invoice-sent', 'paid'];

interface QuoteDetailProps {
  quoteId: string;
  onClose: () => void;
  onPreview: (id: string) => void;
  onEdit: (id: string) => void;
  onDeleted: () => void;
  onAddGig: (date: string, venue: string, fee: number) => void;
}

export function QuoteDetail({ quoteId, onClose, onPreview, onEdit, onDeleted, onAddGig }: QuoteDetailProps) {
  const [quote, setQuote] = useState<QuoteWithClient | null>(null);
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [formalInvoice, setFormalInvoice] = useState<FormalInvoiceWithClient | null>(null);
  const [formalLineItems, setFormalLineItems] = useState<FormalInvoiceLineItem[]>([]);
  const [formalReceipts, setFormalReceipts] = useState<FormalReceiptWithMember[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [showCalendarPrompt, setShowCalendarPrompt] = useState(false);

  async function load() {
    try {
      const [q, items] = await Promise.all([
        getQuote(quoteId),
        getQuoteLineItems(quoteId),
      ]);
      setQuote(q);
      setLineItems(items);

      // Load formal invoice if quote is accepted
      if (q && (q.status === 'accepted')) {
        const fi = await getFormalInvoiceByQuote(quoteId);
        setFormalInvoice(fi);
        if (fi) {
          const [fiItems, fiReceipts] = await Promise.all([
            getFormalInvoiceLineItems(fi.id),
            getFormalReceipts(fi.id),
          ]);
          setFormalLineItems(fiItems);
          setFormalReceipts(fiReceipts);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quote');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [quoteId]);

  function deriveStage(): Stage {
    if (!quote) return 'draft';
    if (quote.status === 'declined') return 'declined';
    if (quote.status === 'expired') return 'expired';
    if (quote.status === 'draft') return 'draft';
    if (quote.status === 'sent') return 'sent';
    if (quote.status === 'accepted') {
      if (!formalInvoice) return 'accepted';
      if (formalInvoice.status === 'paid') return 'paid';
      if (formalInvoice.status === 'sent') return 'invoice-sent';
      return 'accepted';
    }
    return 'draft';
  }

  const stage = deriveStage();

  async function handleSend() {
    if (!quote) return;
    setBusy(true);
    setError('');
    try {
      await sendQuote(quote.id);
      const updated = await getQuote(quote.id);
      setQuote(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send quote');
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept() {
    if (!quote) return;
    setBusy(true);
    setError('');
    try {
      const fi = await acceptQuote(quote.id);
      const updated = await getQuote(quote.id);
      setQuote(updated);
      const fiWithClient = await getFormalInvoiceByQuote(quote.id);
      setFormalInvoice(fiWithClient);
      if (fi) {
        const fiItems = await getFormalInvoiceLineItems(fi.id);
        setFormalLineItems(fiItems);
      }
      setShowCalendarPrompt(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept quote');
    } finally {
      setBusy(false);
    }
  }

  async function handleDecline() {
    if (!quote) return;
    setBusy(true);
    setError('');
    try {
      await declineQuote(quote.id);
      const updated = await getQuote(quote.id);
      setQuote(updated);
      setShowDecline(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline quote');
    } finally {
      setBusy(false);
    }
  }

  async function handleExpire() {
    if (!quote) return;
    setBusy(true);
    setError('');
    try {
      await expireQuote(quote.id);
      const updated = await getQuote(quote.id);
      setQuote(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to expire quote');
    } finally {
      setBusy(false);
    }
  }

  async function handleSendInvoice() {
    if (!formalInvoice) return;
    setBusy(true);
    setError('');
    try {
      await sendFormalInvoice(formalInvoice.id);
      const updated = await getFormalInvoiceByQuote(quoteId);
      setFormalInvoice(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invoice');
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkPaid() {
    if (!formalInvoice) return;
    setBusy(true);
    setError('');
    try {
      const receipts = await markFormalInvoicePaid(formalInvoice.id);
      setFormalReceipts(receipts);
      const updated = await getFormalInvoiceByQuote(quoteId);
      setFormalInvoice(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark paid');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!quote) return;
    try {
      await deleteQuote(quote.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setShowDelete(false);
    }
  }

  if (loading) return <div className="app app-centered"><LoadingSpinner /></div>;
  if (!quote) return <div className="form-wrap form-top"><ErrorAlert message="Quote not found" /></div>;

  const styleName = INVOICE_STYLES.find(s => s.id === quote.style)?.name || 'Classic';
  const eventTypeLabel = quote.event_type.charAt(0).toUpperCase() + quote.event_type.slice(1);
  const validUntil = addDaysISO(quote.created_at.slice(0, 10), quote.validity_days);
  const isTerminal = stage === 'declined' || stage === 'expired';
  const progressIndex = PROGRESS_STAGES.indexOf(stage);

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 className="page-title">{quote.quote_number}</h2>
        <span
          className="status-badge"
          style={{ background: `${STAGE_COLORS[stage]}20`, color: STAGE_COLORS[stage] }}
        >
          {STAGE_LABELS[stage]}
        </span>
      </div>

      {error && <ErrorAlert message={error} compact />}

      {/* Progress tracker */}
      {!isTerminal && (
        <div className="neu-card">
          <div className="quote-progress">
            {PROGRESS_STAGES.map((s, i) => {
              const reached = progressIndex >= i;
              return (
                <div key={s} className="quote-progress-step">
                  <div
                    className={`quote-progress-dot ${reached ? 'reached' : ''}`}
                    style={reached ? { background: STAGE_COLORS[s] } : undefined}
                  />
                  <span className={`quote-progress-label ${reached ? 'reached' : ''}`}>
                    {STAGE_LABELS[s]}
                  </span>
                  {i < PROGRESS_STAGES.length - 1 && (
                    <div className={`quote-progress-line ${progressIndex > i ? 'reached' : ''}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Client & Event */}
      <div className="neu-card invoice-detail-card">
        <h3 className="section-title">Quote Details</h3>
        <div className="detail-grid">
          <DetailRow label="Client" value={quote.client_company_name} />
          {quote.client_contact_name && <DetailRow label="Contact" value={quote.client_contact_name} />}
          <DetailRow label="Event Type" value={eventTypeLabel} />
          <DetailRow label="Event Date" value={formatDateLong(quote.event_date)} />
          <DetailRow label="Venue" value={quote.venue_name} />
          {quote.venue_address && <DetailRow label="Venue Address" value={quote.venue_address} />}
          <div className="detail-divider" />
          <DetailRow label="Subtotal" value={formatGBP(quote.subtotal)} />
          {quote.discount_amount > 0 && (
            <DetailRow label="Discount" value={`-${formatGBP(quote.discount_amount)}`} />
          )}
          <DetailRow label="Total" value={formatGBP(quote.total)} highlight />
          <div className="detail-divider" />
          <DetailRow label="Valid Until" value={formatDateLong(validUntil)} />
          <DetailRow label="Style" value={styleName} />
          {quote.pli_option !== 'none' && (
            <DetailRow label="PLI" value={quote.pli_option === 'certificate' ? 'Certificate included' : 'Details provided'} />
          )}
        </div>
      </div>

      {/* Line items */}
      <div className="neu-card">
        <h3 className="section-title">Package ({lineItems.length} item{lineItems.length !== 1 ? 's' : ''})</h3>
        <div className="quote-line-items-table">
          <div className="quote-li-header">
            <span className="quote-li-desc">Item</span>
            <span className="quote-li-qty">Qty</span>
            <span className="quote-li-price">Price</span>
            <span className="quote-li-total">Total</span>
          </div>
          {lineItems.map(li => (
            <div key={li.id} className="quote-li-row">
              <span className="quote-li-desc">{li.description}</span>
              <span className="quote-li-qty">{li.quantity}</span>
              <span className="quote-li-price">{formatGBP(li.unit_price)}</span>
              <span className="quote-li-total">{formatGBP(li.line_total)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Notes & T&Cs */}
      {(quote.notes || quote.terms_and_conditions) && (
        <div className="neu-card">
          {quote.notes && (
            <>
              <h3 className="section-title">Notes</h3>
              <p className="quote-notes-text">{quote.notes}</p>
            </>
          )}
          {quote.terms_and_conditions && (
            <>
              <h3 className="section-title" style={quote.notes ? { marginTop: 16 } : undefined}>Terms & Conditions</h3>
              <p className="quote-notes-text">{quote.terms_and_conditions}</p>
            </>
          )}
        </div>
      )}

      {/* Stage history */}
      <div className="neu-card">
        <h3 className="section-title">History</h3>
        <div className="detail-grid">
          <DetailRow label="Created" value={formatDateLong(quote.created_at.slice(0, 10))} />
          {quote.sent_at && <DetailRow label="Sent" value={formatDateLong(quote.sent_at.slice(0, 10))} />}
          {quote.responded_at && (
            <DetailRow
              label={quote.status === 'accepted' ? 'Accepted' : quote.status === 'declined' ? 'Declined' : 'Responded'}
              value={formatDateLong(quote.responded_at.slice(0, 10))}
            />
          )}
        </div>
      </div>

      {/* Stage controls */}
      <div className="neu-card">
        <h3 className="section-title">Actions</h3>
        <div className="quote-stage-controls">
          {stage === 'draft' && (
            <button className="btn btn-tangerine btn-full" onClick={handleSend} disabled={busy}>
              {busy ? 'Sending...' : 'Mark as Sent'}
            </button>
          )}
          {stage === 'sent' && (
            <>
              <button className="btn btn-primary btn-full" onClick={handleAccept} disabled={busy}>
                {busy ? 'Accepting...' : 'Accept Quote'}
              </button>
              <button className="btn btn-danger btn-full" onClick={() => setShowDecline(true)} disabled={busy}>
                Decline
              </button>
              <button className="btn btn-outline btn-full" onClick={handleExpire} disabled={busy}>
                Mark Expired
              </button>
            </>
          )}
          {stage === 'accepted' && formalInvoice && (
            <button className="btn btn-tangerine btn-full" onClick={handleSendInvoice} disabled={busy}>
              {busy ? 'Sending...' : 'Send Formal Invoice'}
            </button>
          )}
          {stage === 'invoice-sent' && (
            <button className="btn btn-primary btn-full" onClick={handleMarkPaid} disabled={busy}>
              {busy ? 'Processing...' : 'Mark as Paid'}
            </button>
          )}
        </div>
      </div>

      {/* Formal Invoice section */}
      {formalInvoice && (
        <div className="neu-card">
          <h3 className="section-title">Formal Invoice</h3>
          <div className="detail-grid">
            <DetailRow label="Invoice #" value={formalInvoice.invoice_number} />
            <DetailRow label="Issue Date" value={formatDateLong(formalInvoice.issue_date)} />
            <DetailRow label="Due Date" value={formatDateLong(formalInvoice.due_date)} />
            <DetailRow label="Amount" value={formatGBP(formalInvoice.total)} highlight />
            <DetailRow
              label="Status"
              value={formalInvoice.status.charAt(0).toUpperCase() + formalInvoice.status.slice(1)}
            />
            {formalInvoice.paid_date && (
              <DetailRow label="Paid Date" value={formatDateLong(formalInvoice.paid_date)} />
            )}
          </div>

          {/* Formal invoice line items */}
          {formalLineItems.length > 0 && (
            <div className="quote-line-items-table" style={{ marginTop: 12 }}>
              <div className="quote-li-header">
                <span className="quote-li-desc">Item</span>
                <span className="quote-li-qty">Qty</span>
                <span className="quote-li-price">Price</span>
                <span className="quote-li-total">Total</span>
              </div>
              {formalLineItems.map(li => (
                <div key={li.id} className="quote-li-row">
                  <span className="quote-li-desc">{li.description}</span>
                  <span className="quote-li-qty">{li.quantity}</span>
                  <span className="quote-li-price">{formatGBP(li.unit_price)}</span>
                  <span className="quote-li-total">{formatGBP(li.line_total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Formal Receipts */}
      {formalReceipts.length > 0 && (
        <div className="neu-card">
          <h3 className="section-title">Receipts ({formalReceipts.length})</h3>
          {formalReceipts.map(r => (
            <div key={r.id} className="receipt-row">
              <span className="receipt-name">{r.member_name}</span>
              <span className="receipt-amount">{formatGBP(r.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bottom actions */}
      <div className="invoice-actions">
        <button className="btn btn-primary btn-full" onClick={() => onPreview(quote.id)}>
          Preview Documents
        </button>
        {stage === 'draft' && (
          <button className="btn btn-tangerine btn-full" onClick={() => onEdit(quote.id)}>
            Edit Quote
          </button>
        )}
        {(stage === 'draft' || stage === 'declined' || stage === 'expired') && (
          <button className="btn btn-danger btn-full" onClick={() => setShowDelete(true)}>
            Delete Quote
          </button>
        )}
      </div>

      {/* Confirm delete modal */}
      {showDelete && (
        <ConfirmModal
          message="Delete this quote? This will also delete line items and any linked formal invoice. This cannot be undone."
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
          danger
        />
      )}

      {/* Confirm decline modal */}
      {showDecline && (
        <ConfirmModal
          message="Decline this quote? The client has decided not to proceed."
          confirmLabel="Decline"
          onConfirm={handleDecline}
          onCancel={() => setShowDecline(false)}
          danger
        />
      )}

      {/* Calendar prompt */}
      {showCalendarPrompt && quote && (
        <ConfirmModal
          message={`Quote accepted! Add a gig to the calendar for ${formatDateLong(quote.event_date)} at ${quote.venue_name}?`}
          confirmLabel="Add Gig"
          onConfirm={() => {
            setShowCalendarPrompt(false);
            onAddGig(quote.event_date, quote.venue_name, quote.total);
          }}
          onCancel={() => setShowCalendarPrompt(false)}
        />
      )}
    </div>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className={`detail-value ${highlight ? 'detail-highlight' : ''}`}>{value}</span>
    </div>
  );
}
