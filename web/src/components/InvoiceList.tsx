import { useState, useEffect, useMemo } from 'react';
import { getDashboardStats } from '@shared/supabase/queries';
import type { InvoiceWithClient, InvoiceStatus, DashboardStats } from '@shared/supabase/types';
import { formatGBP, formatShortDate } from '../utils/format';
import { LoadingSpinner } from './LoadingSpinner';

interface InvoiceListProps {
  invoices: InvoiceWithClient[];
  loading: boolean;
  onNewInvoice: () => void;
  onInvoicePress: (id: string) => void;
  onClose: () => void;
}

type FilterTab = 'all' | InvoiceStatus;
type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'status';

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'var(--color-text-dim)',
  sent: 'var(--color-tangerine)',
  paid: 'var(--color-green)',
};

const STATUS_ORDER: Record<InvoiceStatus, number> = { sent: 0, draft: 1, paid: 2 };

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'date-desc', label: 'Newest' },
  { key: 'date-asc', label: 'Oldest' },
  { key: 'amount-desc', label: 'Highest' },
  { key: 'amount-asc', label: 'Lowest' },
  { key: 'status', label: 'Status' },
];

function sortInvoices(invoices: InvoiceWithClient[], sortKey: SortKey): InvoiceWithClient[] {
  const sorted = [...invoices];
  switch (sortKey) {
    case 'date-desc': return sorted.sort((a, b) => b.gig_date.localeCompare(a.gig_date));
    case 'date-asc': return sorted.sort((a, b) => a.gig_date.localeCompare(b.gig_date));
    case 'amount-desc': return sorted.sort((a, b) => b.amount - a.amount);
    case 'amount-asc': return sorted.sort((a, b) => a.amount - b.amount);
    case 'status': return sorted.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    default: return sorted;
  }
}

export function InvoiceList({ invoices, loading, onNewInvoice, onInvoicePress, onClose }: InvoiceListProps) {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date-desc');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    getDashboardStats().then(setStats).catch(() => {});
  }, [invoices]);

  const result = useMemo(() => {
    let list = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        i.invoice_number.toLowerCase().includes(q) ||
        i.client_company_name.toLowerCase().includes(q) ||
        i.venue.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q)
      );
    }
    return sortInvoices(list, sortKey);
  }, [invoices, filter, sortKey, search]);

  if (loading) return <div className="app app-centered"><LoadingSpinner /></div>;

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 className="page-title">Invoices</h2>
        <div className="page-header-spacer" />
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="invoice-stats-bar">
          <div className="invoice-stat">
            <span className="invoice-stat-label">Invoiced</span>
            <span className="invoice-stat-value">{formatGBP(stats.totalInvoiced)}</span>
          </div>
          <div className="invoice-stat">
            <span className="invoice-stat-label">Outstanding</span>
            <span className="invoice-stat-value invoice-stat-outstanding">{formatGBP(stats.totalOutstanding)}</span>
          </div>
          <div className="invoice-stat">
            <span className="invoice-stat-label">Paid</span>
            <span className="invoice-stat-value invoice-stat-paid">{formatGBP(stats.totalPaid)}</span>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="neu-inset" style={{ marginBottom: 8 }}>
        <input
          className="input-field"
          type="text"
          placeholder="Search invoices..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filter tabs + sort */}
      <div className="invoice-controls-row">
        <div className="invoice-filter-tabs">
          {(['all', 'draft', 'sent', 'paid'] as FilterTab[]).map(tab => (
            <button
              key={tab}
              className={`invoice-filter-tab ${filter === tab ? 'active' : ''}`}
              onClick={() => setFilter(tab)}
            >
              {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              <span className="invoice-filter-count">
                {tab === 'all' ? invoices.length : invoices.filter(i => i.status === tab).length}
              </span>
            </button>
          ))}
        </div>
        <div className="invoice-sort-wrap neu-inset">
          <select
            className="input-field invoice-sort-select"
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <button className="btn btn-primary btn-full" onClick={onNewInvoice} style={{ marginBottom: 12 }}>
        + New Invoice
      </button>

      {/* Invoice cards */}
      <div className="invoice-card-list">
        {result.map(inv => (
          <div key={inv.id} className="invoice-card neu-card" onClick={() => onInvoicePress(inv.id)}>
            <div className="invoice-card-top">
              <span className="invoice-card-number">{inv.invoice_number}</span>
              <span className="invoice-card-status" style={{ color: STATUS_COLORS[inv.status] }}>
                {inv.status.toUpperCase()}
              </span>
            </div>
            <div className="invoice-card-client">{inv.client_company_name || 'No client'}</div>
            <div className="invoice-card-bottom">
              <span className="invoice-card-amount">{formatGBP(inv.amount)}</span>
              <span className="invoice-card-date">{formatShortDate(inv.gig_date)}</span>
            </div>
          </div>
        ))}
        {result.length === 0 && (
          <p className="empty-text">
            {search ? `No invoices matching "${search}"` : filter === 'all' ? 'No invoices yet. Create your first!' : `No ${filter} invoices`}
          </p>
        )}
      </div>
    </div>
  );
}
