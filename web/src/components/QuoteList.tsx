import { useState, useMemo } from 'react';
import type { QuoteWithClient, QuoteStatus } from '@shared/supabase/types';
import { formatGBP, formatShortDate } from '../utils/format';
import { PageLoader } from './SkeletonLoaders';

interface QuoteListProps {
  quotes: QuoteWithClient[];
  loading: boolean;
  onNewQuote: () => void;
  onQuotePress: (id: string) => void;
  onClose: () => void;
}

type FilterTab = 'all' | QuoteStatus;
type SortKey = 'date-desc' | 'date-asc' | 'total-desc' | 'total-asc' | 'status';

const STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: 'var(--color-text-dim)',
  sent: 'var(--color-tangerine)',
  accepted: 'var(--color-green)',
  declined: 'var(--color-danger)',
  expired: 'var(--color-text-muted)',
};

const STATUS_ORDER: Record<QuoteStatus, number> = { draft: 0, sent: 1, accepted: 2, declined: 3, expired: 4 };

const FILTER_TABS: FilterTab[] = ['all', 'draft', 'sent', 'accepted', 'declined', 'expired'];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'date-desc', label: 'Newest' },
  { key: 'date-asc', label: 'Oldest' },
  { key: 'total-desc', label: 'Highest' },
  { key: 'total-asc', label: 'Lowest' },
  { key: 'status', label: 'Status' },
];

const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: 'Wedding',
  corporate: 'Corporate',
  private: 'Private',
  festival: 'Festival',
  other: 'Other',
};

function sortQuotes(quotes: QuoteWithClient[], sortKey: SortKey): QuoteWithClient[] {
  const sorted = [...quotes];
  switch (sortKey) {
    case 'date-desc': return sorted.sort((a, b) => b.event_date.localeCompare(a.event_date));
    case 'date-asc': return sorted.sort((a, b) => a.event_date.localeCompare(b.event_date));
    case 'total-desc': return sorted.sort((a, b) => b.total - a.total);
    case 'total-asc': return sorted.sort((a, b) => a.total - b.total);
    case 'status': return sorted.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    default: return sorted;
  }
}

export function QuoteList({ quotes, loading, onNewQuote, onQuotePress, onClose }: QuoteListProps) {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sortKey, setSortKey] = useState<SortKey>('date-desc');
  const [search, setSearch] = useState('');

  const stats = useMemo(() => {
    const totalQuoted = quotes.reduce((s, q) => s + q.total, 0);
    const acceptedValue = quotes.filter(q => q.status === 'accepted').reduce((s, q) => s + q.total, 0);
    const pendingValue = quotes.filter(q => q.status === 'sent').reduce((s, q) => s + q.total, 0);
    return { totalQuoted, acceptedValue, pendingValue };
  }, [quotes]);

  const result = useMemo(() => {
    let list = filter === 'all' ? quotes : quotes.filter(q => q.status === filter);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(q =>
        q.quote_number.toLowerCase().includes(s) ||
        q.client_company_name.toLowerCase().includes(s) ||
        q.venue_name.toLowerCase().includes(s)
      );
    }
    return sortQuotes(list, sortKey);
  }, [quotes, filter, sortKey, search]);

  if (loading) return <div className="app app-centered"><PageLoader text="Loading quotes" /></div>;

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 className="page-title">Quotes</h2>
        <div className="page-header-spacer" />
      </div>

      {/* Stats bar */}
      <div className="invoice-stats-bar">
        <div className="invoice-stat">
          <span className="invoice-stat-label">Quoted</span>
          <span className="invoice-stat-value">{formatGBP(stats.totalQuoted)}</span>
        </div>
        <div className="invoice-stat">
          <span className="invoice-stat-label">Pending</span>
          <span className="invoice-stat-value invoice-stat-outstanding">{formatGBP(stats.pendingValue)}</span>
        </div>
        <div className="invoice-stat">
          <span className="invoice-stat-label">Accepted</span>
          <span className="invoice-stat-value invoice-stat-paid">{formatGBP(stats.acceptedValue)}</span>
        </div>
      </div>

      {/* Search */}
      <div className="neu-inset" style={{ marginBottom: 8 }}>
        <input
          className="input-field"
          type="text"
          placeholder="Search quotes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filter tabs + sort */}
      <div className="invoice-controls-row">
        <div className="invoice-sort-wrap neu-inset">
          <select
            className="input-field invoice-sort-select"
            value={filter}
            onChange={e => setFilter(e.target.value as FilterTab)}
          >
            {FILTER_TABS.map(tab => (
              <option key={tab} value={tab}>
                {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)} ({tab === 'all' ? quotes.length : quotes.filter(q => q.status === tab).length})
              </option>
            ))}
          </select>
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

      <button className="btn btn-primary btn-full" onClick={onNewQuote} style={{ marginBottom: 12 }}>
        + New Quote
      </button>

      {/* Quote cards */}
      <div className="invoice-card-list">
        {result.map(q => (
          <div key={q.id} className="invoice-card neu-card" onClick={() => onQuotePress(q.id)} style={{ borderLeft: `3px solid ${STATUS_COLORS[q.status]}` }}>
            <div className="invoice-card-top">
              <span className="invoice-card-number">{q.quote_number}</span>
              <span className="invoice-card-status" style={{ color: STATUS_COLORS[q.status] }}>
                {q.status.toUpperCase()}
              </span>
            </div>
            <div className="invoice-card-client">
              {q.client_company_name || 'No client'}
              {q.event_type && <span className="quote-event-type"> · {EVENT_TYPE_LABELS[q.event_type] ?? q.event_type}</span>}
            </div>
            <div className="invoice-card-bottom">
              <span className="invoice-card-amount">{formatGBP(q.total)}</span>
              <span className="invoice-card-date">
                {q.venue_name && <>{q.venue_name} · </>}
                {formatShortDate(q.event_date)}
              </span>
            </div>
          </div>
        ))}
        {result.length === 0 && (
          <p className="empty-text">
            {search ? `No quotes matching "${search}"` : filter === 'all' ? 'No quotes yet. Create your first!' : `No ${filter} quotes`}
          </p>
        )}
      </div>
    </div>
  );
}
