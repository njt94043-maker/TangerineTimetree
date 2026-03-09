import { useState, useEffect } from 'react';
import { getGigWithLinkedDocs, updateGig, deleteGig, getGigChangelog } from '@shared/supabase/queries';
import type { GigWithCreator, GigChangelogWithUser, Quote, Invoice, FormalInvoice, BookingStatus } from '@shared/supabase/types';
import { isNetworkError, queueMutation } from '../hooks/useOfflineQueue';
import { ErrorAlert } from './ErrorAlert';
import { ConfirmModal } from './ConfirmModal';

interface GigHubProps {
  gigId: string;
  onClose: () => void;
  onEdit: (gigId: string) => void;
  onViewQuote?: (quoteId: string) => void;
  onViewInvoice?: (invoiceId: string) => void;
  onCreateInvoice?: (gig: GigWithCreator) => void;
  onGenerateQuote?: (gig: GigWithCreator) => void;
  onGigUpdated: () => void;
}

const PIPELINE_STAGES = ['Enquiry', 'Confirmed', 'Quote', 'Invoice', 'Paid'] as const;

const STATUS_OPTIONS: { value: BookingStatus; label: string }[] = [
  { value: 'enquiry', label: 'Enquiry' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

function statusIndex(s: BookingStatus): number {
  return s === 'enquiry' || s === 'pencilled' ? 0 : s === 'confirmed' ? 1 : -1;
}

export function GigHub({
  gigId,
  onClose,
  onEdit,
  onViewQuote,
  onViewInvoice,
  onCreateInvoice,
  onGenerateQuote,
  onGigUpdated,
}: GigHubProps) {
  const [gig, setGig] = useState<GigWithCreator | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [formalInvoice, setFormalInvoice] = useState<FormalInvoice | null>(null);
  const [changelog, setChangelog] = useState<GigChangelogWithUser[]>([]);
  const [showChangelog, setShowChangelog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<BookingStatus | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    loadGig();
  }, [gigId]);

  async function loadGig() {
    setLoading(true);
    try {
      const result = await getGigWithLinkedDocs(gigId);
      setGig(result);
      setQuote(result.quote);
      setInvoice(result.invoice);
      setFormalInvoice(result.formalInvoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gig');
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: BookingStatus) {
    if (!gig) return;
    const currentIdx = statusIndex(gig.status);
    const newIdx = statusIndex(newStatus);

    // Backward transitions or reopen need confirmation
    if (newStatus === 'cancelled' || (currentIdx >= 0 && newIdx >= 0 && newIdx < currentIdx)) {
      setConfirmStatus(newStatus);
      return;
    }

    await applyStatus(newStatus);
  }

  async function applyStatus(newStatus: BookingStatus) {
    if (!gig) return;
    try {
      await updateGig(gigId, { status: newStatus });

      // Cancelling with draft invoice → auto-cancel
      if (newStatus === 'cancelled' && invoice?.status === 'draft') {
        try {
          const { updateInvoiceStatus } = await import('@shared/supabase/queries');
          await updateInvoiceStatus(invoice.id, 'draft');
        } catch { /* best effort */ }
      }

      setGig({ ...gig, status: newStatus });
      setShowStatusPicker(false);
      setConfirmStatus(null);
      onGigUpdated();
    } catch (err) {
      if (isNetworkError(err)) {
        queueMutation('updateGig', { id: gigId, updates: { status: newStatus } });
        setGig({ ...gig, status: newStatus });
        setShowStatusPicker(false);
        setConfirmStatus(null);
        onGigUpdated();
        return;
      }
      setError('Failed to update status');
    }
  }

  async function handleDelete() {
    try {
      await deleteGig(gigId);
      onGigUpdated();
      onClose();
    } catch (err) {
      if (isNetworkError(err)) {
        queueMutation('deleteGig', { id: gigId });
        onGigUpdated();
        onClose();
        return;
      }
      setError('Failed to delete');
    }
  }

  async function toggleChangelog() {
    if (showChangelog) { setShowChangelog(false); return; }
    if (changelog.length === 0) {
      try {
        const entries = await getGigChangelog(gigId);
        setChangelog(entries);
      } catch { /* ignore */ }
    }
    setShowChangelog(true);
  }

  if (loading) return <div className="bw-wrap"><div className="bw-header"><button className="bw-back" onClick={onClose}>{'\u25C0'}</button><div className="bw-title">Loading...</div></div></div>;
  if (!gig) return <div className="bw-wrap"><div className="bw-header"><button className="bw-back" onClick={onClose}>{'\u25C0'}</button><div className="bw-title">Gig not found</div></div></div>;

  const isClient = gig.gig_subtype === 'client';
  const sIdx = statusIndex(gig.status);
  const statusBadgeClass = gig.status === 'cancelled' ? 'badge-danger' : isClient ? 'badge-tangerine' : 'badge-green';

  return (
    <div className="bw-wrap">
      {/* Header */}
      <div className="bw-header">
        <button className="bw-back" onClick={onClose}>{'\u25C0'}</button>
        <div className="bw-title">Gig Details</div>
        <span className={`badge ${statusBadgeClass}`}>{gig.status}</span>
      </div>

      {error && <div style={{ padding: '0 20px' }}><ErrorAlert message={error} compact /></div>}

      {/* Hero */}
      <div className="hub-hero">
        <div>
          <div className="hub-venue">{gig.venue || 'No venue'}</div>
          {isClient && gig.client_name && (
            <div className="hub-client">
              <span className="badge badge-tangerine" style={{ marginRight: 4 }}>Client</span>
              {gig.client_name}
            </div>
          )}
          {!isClient && <div className="hub-client">Direct booking</div>}
        </div>
        <div className="hub-fee mono">{gig.fee != null ? `\u00A3${gig.fee.toLocaleString()}` : '—'}</div>
      </div>

      {/* Pipeline tracker */}
      {isClient && (
        <div className="bw-pipeline">
          {PIPELINE_STAGES.map((stage, i) => (
            <span key={stage}>
              {i > 0 && <span className={`bw-pl${i <= sIdx ? ' ok' : ''}`} />}
              <span className="bw-pn">
                <span className={`bw-pd${i < sIdx ? ' pg' : i === sIdx ? ' pt' : ' ph'}`} />
                <span className={`bw-pnl${i < sIdx ? ' ok' : i === sIdx ? ' on' : ''}`}>{stage}</span>
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Info tiles */}
      <div className="hub-info">
        <div className="hub-tile">
          <div className="hub-tile-label">Date</div>
          <div className="hub-tile-value">{formatDate(gig.date)}</div>
        </div>
        <div className="hub-tile">
          <div className="hub-tile-label">Time</div>
          <div className="hub-tile-value mono">{gig.start_time?.slice(0, 5) || '—'}</div>
        </div>
        <div className="hub-tile">
          <div className="hub-tile-label">Load-in</div>
          <div className="hub-tile-value mono" style={{ opacity: 0.6 }}>{gig.load_time?.slice(0, 5) || '—'}</div>
        </div>
        <div className="hub-tile">
          <div className="hub-tile-label">End</div>
          <div className="hub-tile-value mono">{gig.end_time?.slice(0, 5) || '—'}</div>
        </div>
      </div>

      {/* Deposit tracker (client gigs only) */}
      {isClient && gig.deposit_amount != null && gig.deposit_amount > 0 && (
        <>
          <div className="bw-section-label">Deposit</div>
          <div className="hub-deposit-card">
            <div className="hub-dep-row">
              <span className="hub-dep-label">Required</span>
              <span className="hub-dep-value mono" style={{ color: 'var(--color-tangerine)' }}>{'\u00A3'}{gig.deposit_amount}</span>
            </div>
            <div className="hub-dep-bar">
              <div className="hub-dep-fill" style={{ width: gig.deposit_paid ? '100%' : '0%' }} />
            </div>
            <div className="hub-dep-row">
              <span className={`hub-dep-status ${gig.deposit_paid ? 'paid' : 'pending'}`}>
                {gig.deposit_paid ? '\u2713 Received' : '\u23F3 Pending'}
              </span>
              {gig.deposit_paid && (
                <button className="hub-dep-toggle" onClick={async () => {
                  await updateGig(gigId, { deposit_paid: false });
                  setGig({ ...gig, deposit_paid: false });
                  onGigUpdated();
                }}>Mark Unpaid</button>
              )}
              {!gig.deposit_paid && (
                <button className="hub-dep-toggle" onClick={async () => {
                  await updateGig(gigId, { deposit_paid: true });
                  setGig({ ...gig, deposit_paid: true });
                  onGigUpdated();
                }}>Mark Paid</button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Linked documents */}
      {isClient && (
        <>
          <div className="bw-section-label">Documents</div>
          <div className="hub-docs-card">
            <button
              className="hub-link"
              onClick={() => quote && onViewQuote?.(quote.id)}
              disabled={!quote}
              style={!quote ? { opacity: 0.4 } : undefined}
            >
              <div className="hub-link-icon" style={{ background: 'rgba(243,156,18,0.1)', borderColor: 'rgba(243,156,18,0.15)' }}>{'\u{1F4C4}'}</div>
              <div className="hub-link-info">
                <div className="hub-link-title" style={{ color: 'var(--color-tangerine)' }}>
                  {quote ? `Quote ${quote.quote_number}` : 'Quote'}
                </div>
                <div className="hub-link-sub">
                  {quote ? (
                    <><span className={`badge badge-${quote.status === 'accepted' ? 'green' : 'tangerine'}`}>{quote.status}</span> {'\u00B7'} {'\u00A3'}{quote.total}</>
                  ) : 'Not yet created'}
                </div>
              </div>
              <span className="hub-link-arrow">{'\u25B6'}</span>
            </button>

            <div className="hub-link-sep" />

            <button
              className="hub-link"
              onClick={() => {
                if (invoice) onViewInvoice?.(invoice.id);
                else if (formalInvoice) onViewInvoice?.(formalInvoice.id);
              }}
              disabled={!invoice && !formalInvoice}
              style={!invoice && !formalInvoice ? { opacity: 0.4 } : undefined}
            >
              <div className="hub-link-icon" style={{ background: 'rgba(0,230,118,0.1)', borderColor: 'rgba(0,230,118,0.15)' }}>{'\u{1F4B3}'}</div>
              <div className="hub-link-info">
                <div className="hub-link-title" style={{ color: 'var(--color-gig)' }}>
                  {invoice ? `Invoice ${invoice.invoice_number}` : formalInvoice ? `Invoice ${formalInvoice.invoice_number}` : 'Invoice'}
                </div>
                <div className="hub-link-sub">
                  {invoice ? (
                    <><span className={`badge badge-${invoice.status === 'paid' ? 'green' : 'tangerine'}`}>{invoice.status}</span> {'\u00B7'} Due {invoice.due_date}</>
                  ) : formalInvoice ? (
                    <><span className={`badge badge-${formalInvoice.status === 'paid' ? 'green' : 'tangerine'}`}>{formalInvoice.status}</span></>
                  ) : 'Pending'}
                </div>
              </div>
              <span className="hub-link-arrow">{'\u25B6'}</span>
            </button>
          </div>
        </>
      )}

      {/* Notes */}
      {gig.notes && (
        <div className="hub-notes">
          {gig.notes}
        </div>
      )}

      {/* Actions */}
      <div className="bw-actions">
        <button className={`btn ${isClient ? 'btn-tangerine' : 'btn-primary'}`} onClick={() => onEdit(gigId)}>Edit Booking</button>

        <button className="btn btn-outline" style={{ color: 'var(--color-gig)' }} onClick={() => setShowStatusPicker(true)}>Change Status</button>

        {isClient && !quote && onGenerateQuote && (
          <button className="btn btn-outline" style={{ color: 'var(--color-tangerine)' }} onClick={() => onGenerateQuote(gig)}>Generate Quote</button>
        )}

        {!invoice && !formalInvoice && onCreateInvoice && (
          <button className="btn btn-outline" style={{ color: 'var(--color-gig)' }} onClick={() => onCreateInvoice(gig)}>Create Invoice</button>
        )}

        <button className="btn btn-outline" onClick={toggleChangelog}>
          {showChangelog ? 'Hide History' : 'History'}
        </button>

        <button className="btn btn-outline btn-danger-text" onClick={() => setConfirmDelete(true)}>Delete</button>
      </div>

      {/* Changelog */}
      {showChangelog && changelog.length > 0 && (
        <div className="hub-changelog">
          {changelog.map(entry => (
            <div key={entry.id} className="hub-changelog-entry">
              <div className="hub-changelog-action">
                {entry.user_name} {entry.action}
                {entry.field_changed ? ` ${entry.field_changed}` : ''}
              </div>
              {entry.old_value && entry.new_value && (
                <div className="hub-changelog-values">
                  <span className="hub-changelog-old">{entry.old_value}</span>
                  {' \u2192 '}
                  <span className="hub-changelog-new">{entry.new_value}</span>
                </div>
              )}
              <div className="hub-changelog-time">
                {new Date(entry.created_at).toLocaleDateString()} {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status picker modal */}
      {showStatusPicker && (
        <div className="overlay" onClick={() => setShowStatusPicker(false)}>
          <div className="hub-status-picker" onClick={e => e.stopPropagation()}>
            <div className="hub-status-picker-title">Change Status</div>
            {STATUS_OPTIONS.map(s => (
              <button
                key={s.value}
                className={`hub-status-option${gig.status === s.value ? ' current' : ''}`}
                onClick={() => handleStatusChange(s.value)}
                disabled={gig.status === s.value}
              >
                {s.label}
                {gig.status === s.value && <span className="hub-status-current-badge">Current</span>}
              </button>
            ))}
            <button className="btn btn-outline" onClick={() => setShowStatusPicker(false)} style={{ marginTop: 8 }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Confirm status change */}
      {confirmStatus && (
        <ConfirmModal
          message={
            confirmStatus === 'cancelled'
              ? `Cancel this booking?${invoice && invoice.status !== 'draft' ? '\n\nWarning: This gig has a sent/paid invoice.' : invoice?.status === 'draft' ? '\n\nThe draft invoice will also be cancelled.' : ''}`
              : `Change status from "${gig.status}" back to "${confirmStatus}"?`
          }
          confirmLabel={confirmStatus === 'cancelled' ? 'Cancel Booking' : 'Change Status'}
          danger={confirmStatus === 'cancelled'}
          onConfirm={() => applyStatus(confirmStatus)}
          onCancel={() => setConfirmStatus(null)}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <ConfirmModal
          message="Delete this gig permanently?"
          confirmLabel="Delete"
          danger
          onConfirm={() => { setConfirmDelete(false); handleDelete(); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
