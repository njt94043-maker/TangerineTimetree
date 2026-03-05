import type { InvoiceWithClient } from '@shared/supabase/types';

/** Escape a CSV field value (double quotes, commas, newlines) */
function csvEscape(val: string): string {
  if (val.includes('"') || val.includes(',') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/** Download a string as a file in the browser */
function downloadBlob(content: string, filename: string, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export invoices to CSV and trigger browser download.
 * @param invoices Array of invoices to export
 * @param filename Base filename (without .csv extension)
 */
export function exportInvoicesCSV(invoices: InvoiceWithClient[], filename = 'invoices'): void {
  const headers = [
    'Invoice Number', 'Status', 'Client', 'Contact', 'Venue',
    'Gig Date', 'Amount', 'Issue Date', 'Due Date', 'Paid Date',
    'Description', 'Style',
  ];

  const rows = invoices.map(inv => [
    inv.invoice_number,
    inv.status,
    inv.client_company_name,
    inv.client_contact_name,
    inv.venue,
    inv.gig_date,
    inv.amount.toFixed(2),
    inv.issue_date,
    inv.due_date,
    inv.paid_date ?? '',
    inv.description,
    inv.style,
  ]);

  const csv = [
    headers.map(csvEscape).join(','),
    ...rows.map(row => row.map(csvEscape).join(',')),
  ].join('\n');

  downloadBlob(csv, `${filename}.csv`);
}

/**
 * Filter invoices by UK tax year (April to March).
 * @param invoices All invoices
 * @param taxYearStart Year the tax year starts (e.g. 2025 for 2025/26)
 */
export function filterByTaxYear(invoices: InvoiceWithClient[], taxYearStart: number): InvoiceWithClient[] {
  const start = `${taxYearStart}-04-01`;
  const end = `${taxYearStart + 1}-03-31`;
  return invoices.filter(i => i.gig_date >= start && i.gig_date <= end);
}
