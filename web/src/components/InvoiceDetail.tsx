import { useState, useEffect, useCallback } from 'react';
import {
  getInvoice, updateInvoiceStatus, markInvoicePaid, deleteInvoice,
  getReceiptsForInvoice,
} from '@shared/supabase/queries';
import type { InvoiceWithClient, InvoiceStatus, ReceiptWithMember } from '@shared/supabase/types';
import { INVOICE_STYLES } from '@shared/templates';
import { formatDateLong, formatGBP } from '../utils/format';
import { ErrorAlert } from './ErrorAlert';
import { ConfirmModal } from './ConfirmModal';
import { LoadingSpinner } from './LoadingSpinner';

interface InvoiceDetailProps {
  invoiceId: string;
  onClose: () => void;
  onPreview: (id: string) => void;
  onDuplicate: () => void;
  onDeleted: () => void;
}

export function InvoiceDetail({ invoiceId, onClose, onPreview, onDuplicate, onDeleted }: InvoiceDetailProps) {
  const [invoice, setInvoice] = useState<InvoiceWithClient | null>(null);
  const [receipts, setReceipts] = useState<ReceiptWithMember[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const [inv, r] = await Promise.all([
        getInvoice(invoiceId),
        getReceiptsForInvoice(invoiceId),
      ]);
      setInvoice(inv);
      setReceipts(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(status: InvoiceStatus) {
    if (!invoice) return;
    setError('');
    try {
      if (status === 'paid') {
        const newReceipts = await markInvoicePaid(invoice.id);
        setReceipts(newReceipts);
      } else {
        await updateInvoiceStatus(invoice.id, status);
      }
      const updated = await getInvoice(invoice.id);
      setInvoice(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  }

  async function handleDelete() {
    if (!invoice) return;
    try {
      await deleteInvoice(invoice.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setShowDelete(false);
    }
  }

  if (loading) return <div className="app app-centered"><LoadingSpinner /></div>;
  if (!invoice) return <div className="form-wrap form-top"><ErrorAlert message="Invoice not found" /></div>;

  const styleName = INVOICE_STYLES.find(s => s.id === invoice.style)?.name || 'Classic';

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 className="page-title">{invoice.invoice_number}</h2>
        <span className={`status-badge status-${invoice.status}`}>{invoice.status.toUpperCase()}</span>
      </div>

      {error && <ErrorAlert message={error} compact />}

      {/* Details */}
      <div className="neu-card invoice-detail-card">
        <h3 className="section-title">Invoice Details</h3>
        <div className="detail-grid">
          <DetailRow label="Client" value={invoice.client_company_name} />
          <DetailRow label="Venue" value={invoice.venue} />
          <DetailRow label="Gig Date" value={formatDateLong(invoice.gig_date)} />
          <DetailRow label="Amount" value={formatGBP(invoice.amount)} highlight />
          <DetailRow label="Description" value={invoice.description} />
          <div className="detail-divider" />
          <DetailRow label="Issue Date" value={formatDateLong(invoice.issue_date)} />
          <DetailRow label="Due Date" value={formatDateLong(invoice.due_date)} />
          {invoice.paid_date && <DetailRow label="Paid Date" value={formatDateLong(invoice.paid_date)} />}
          <DetailRow label="Style" value={styleName} />
        </div>
      </div>

      {/* Status controls */}
      <div className="neu-card">
        <h3 className="section-title">Status</h3>
        <div className="status-controls">
          {(['draft', 'sent', 'paid'] as InvoiceStatus[]).map(s => (
            <button
              key={s}
              className={`btn btn-small status-btn ${invoice.status === s ? 'status-btn-active' : ''}`}
              onClick={() => handleStatusChange(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Receipts */}
      {receipts.length > 0 && (
        <div className="neu-card">
          <h3 className="section-title">Receipts ({receipts.length})</h3>
          {receipts.map(r => (
            <div key={r.id} className="receipt-row">
              <span className="receipt-name">{r.member_name}</span>
              <span className="receipt-amount">{formatGBP(r.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="invoice-actions">
        <button className="btn btn-primary btn-full" onClick={() => onPreview(invoice.id)}>
          Preview Invoice
        </button>
        <button className="btn btn-tangerine btn-full" onClick={onDuplicate}>
          Create Similar
        </button>
        <button className="btn btn-danger btn-full" onClick={() => setShowDelete(true)}>
          Delete Invoice
        </button>
      </div>

      {showDelete && (
        <ConfirmModal
          message="Delete this invoice? This will also delete any receipts. This cannot be undone."
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
          danger
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
