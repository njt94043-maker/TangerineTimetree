import { useState, useEffect } from 'react';
import { getDashboardStats, getInvoices } from '@shared/supabase/queries';
import type { DashboardStats, InvoiceWithClient } from '@shared/supabase/types';
import { formatGBP, formatShortDate } from '../utils/format';
import { exportInvoicesCSV } from '../utils/export';
import { LoadingSpinner } from './LoadingSpinner';

interface DashboardProps {
  onInvoicePress: (id: string) => void;
  onNewInvoice: () => void;
  onGoToInvoices: () => void;
  onGoToCalendar: () => void;
  onGoToClients: () => void;
  onGoToSettings: () => void;
}

interface MonthlyBreakdown {
  label: string;
  invoiced: number;
  paid: number;
  count: number;
}

function getMonthlyBreakdown(invoices: InvoiceWithClient[]): MonthlyBreakdown[] {
  const months = new Map<string, MonthlyBreakdown>();

  for (const inv of invoices) {
    const d = new Date(inv.gig_date + 'T12:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

    if (!months.has(key)) {
      months.set(key, { label, invoiced: 0, paid: 0, count: 0 });
    }
    const m = months.get(key)!;
    m.invoiced += inv.amount;
    if (inv.status === 'paid') m.paid += inv.amount;
    m.count++;
  }

  return Array.from(months.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([, v]) => v)
    .slice(0, 6);
}

/** Get current UK tax year label e.g. "2025/26" */
function getCurrentTaxYear(): { label: string; start: string; end: string } {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    label: `${year}/${String(year + 1).slice(2)}`,
    start: `${year}-04-01`,
    end: `${year + 1}-03-31`,
  };
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'var(--color-text-dim)',
  sent: 'var(--color-tangerine)',
  paid: 'var(--color-green)',
};

export function Dashboard({ onInvoicePress, onNewInvoice, onGoToInvoices, onGoToCalendar, onGoToClients, onGoToSettings }: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [allInvoices, setAllInvoices] = useState<InvoiceWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [s, invs] = await Promise.all([getDashboardStats(), getInvoices()]);
        setStats(s);
        setAllInvoices(invs);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const taxYear = getCurrentTaxYear();
  const taxYearInvoices = allInvoices.filter(i => i.gig_date >= taxYear.start && i.gig_date <= taxYear.end);
  const taxYearTotal = taxYearInvoices.reduce((sum, i) => sum + i.amount, 0);
  const monthly = getMonthlyBreakdown(allInvoices);

  async function handleExportCSV() {
    setExporting(true);
    try {
      exportInvoicesCSV(allInvoices);
    } finally {
      setExporting(false);
    }
  }

  async function handleExportTaxYear() {
    setExporting(true);
    try {
      exportInvoicesCSV(taxYearInvoices, `invoices-${taxYear.label.replace('/', '-')}`);
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <div className="app app-centered"><LoadingSpinner /></div>;

  const overdue = allInvoices.filter(i => {
    if (i.status !== 'sent') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(i.due_date + 'T12:00:00') < today;
  });

  return (
    <div className="form-wrap form-top">
      <h2 className="page-title dashboard-title">Dashboard</h2>

      {/* Stats cards */}
      {stats && (
        <div className="dashboard-stats">
          <div className="dashboard-stat-card neu-card">
            <span className="dashboard-stat-label">Total Invoiced</span>
            <span className="dashboard-stat-value">{formatGBP(stats.totalInvoiced)}</span>
            <span className="dashboard-stat-sub">{stats.invoiceCount} invoice{stats.invoiceCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="dashboard-stat-card neu-card">
            <span className="dashboard-stat-label">Outstanding</span>
            <span className="dashboard-stat-value dashboard-stat-outstanding">{formatGBP(stats.totalOutstanding)}</span>
            {overdue.length > 0 && (
              <span className="dashboard-stat-sub dashboard-stat-overdue">{overdue.length} overdue</span>
            )}
          </div>
          <div className="dashboard-stat-card neu-card">
            <span className="dashboard-stat-label">Paid</span>
            <span className="dashboard-stat-value dashboard-stat-paid">{formatGBP(stats.totalPaid)}</span>
          </div>
          <div className="dashboard-stat-card neu-card">
            <span className="dashboard-stat-label">Tax Year {taxYear.label}</span>
            <span className="dashboard-stat-value">{formatGBP(taxYearTotal)}</span>
            <span className="dashboard-stat-sub">{taxYearInvoices.length} invoice{taxYearInvoices.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      {/* Overdue alerts */}
      {overdue.length > 0 && (
        <div className="dashboard-overdue-section">
          <h3 className="dashboard-section-title dashboard-section-overdue">Overdue</h3>
          {overdue.map(inv => (
            <div key={inv.id} className="invoice-card neu-card" onClick={() => onInvoicePress(inv.id)}>
              <div className="invoice-card-top">
                <span className="invoice-card-number">{inv.invoice_number}</span>
                <span className="invoice-card-status" style={{ color: 'var(--color-danger)' }}>OVERDUE</span>
              </div>
              <div className="invoice-card-client">{inv.client_company_name}</div>
              <div className="invoice-card-bottom">
                <span className="invoice-card-amount">{formatGBP(inv.amount)}</span>
                <span className="invoice-card-date">Due {formatShortDate(inv.due_date)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent invoices */}
      {stats && stats.recentInvoices.length > 0 && (
        <div className="dashboard-section">
          <div className="dashboard-section-header">
            <h3 className="dashboard-section-title">Recent Invoices</h3>
            <button className="btn btn-small btn-outline" onClick={onGoToInvoices}>View All</button>
          </div>
          {stats.recentInvoices.map(inv => (
            <div key={inv.id} className="invoice-card neu-card" onClick={() => onInvoicePress(inv.id)}>
              <div className="invoice-card-top">
                <span className="invoice-card-number">{inv.invoice_number}</span>
                <span className="invoice-card-status" style={{ color: STATUS_COLORS[inv.status] }}>
                  {inv.status.toUpperCase()}
                </span>
              </div>
              <div className="invoice-card-client">{inv.client_company_name}</div>
              <div className="invoice-card-bottom">
                <span className="invoice-card-amount">{formatGBP(inv.amount)}</span>
                <span className="invoice-card-date">{formatShortDate(inv.gig_date)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Monthly breakdown */}
      {monthly.length > 0 && (
        <div className="dashboard-section">
          <h3 className="dashboard-section-title">Monthly Breakdown</h3>
          <div className="dashboard-monthly">
            {monthly.map(m => (
              <div key={m.label} className="dashboard-month-row neu-card">
                <div className="dashboard-month-label">
                  <span className="dashboard-month-name">{m.label}</span>
                  <span className="dashboard-month-count">{m.count} inv</span>
                </div>
                <div className="dashboard-month-amounts">
                  <span className="dashboard-month-invoiced">{formatGBP(m.invoiced)}</span>
                  <span className="dashboard-month-paid">{formatGBP(m.paid)} paid</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export section */}
      <div className="dashboard-section">
        <h3 className="dashboard-section-title">Export</h3>
        <div className="dashboard-export-buttons">
          <button className="btn btn-small btn-outline btn-full" onClick={handleExportCSV} disabled={exporting}>
            Export All Invoices (CSV)
          </button>
          <button className="btn btn-small btn-outline btn-full" onClick={handleExportTaxYear} disabled={exporting}>
            Export Tax Year {taxYear.label} (CSV)
          </button>
        </div>
      </div>

      {/* Quick nav */}
      <div className="dashboard-section dashboard-nav-section">
        <button className="btn btn-primary btn-full" onClick={onNewInvoice}>+ New Invoice</button>
        <button className="btn btn-small btn-full btn-green" onClick={onGoToCalendar}>Calendar</button>
        <button className="btn btn-small btn-full btn-outline" onClick={onGoToInvoices}>Invoices</button>
        <button className="btn btn-small btn-full btn-outline" onClick={onGoToClients}>Clients</button>
        <button className="btn btn-small btn-full btn-outline" onClick={onGoToSettings}>Settings</button>
      </div>

      {/* Empty state */}
      {stats && stats.invoiceCount === 0 && (
        <div className="dashboard-empty">
          <p className="empty-text">No invoices yet. Create your first invoice to see stats here.</p>
          <button className="btn btn-primary" onClick={onNewInvoice}>Create First Invoice</button>
        </div>
      )}
    </div>
  );
}
