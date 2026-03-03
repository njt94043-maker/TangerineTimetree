import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { InvoiceWithClient } from '../db/queries';

export async function exportInvoicesCsv(invoices: InvoiceWithClient[]): Promise<void> {
  const header = 'Invoice Number,Client,Venue,Gig Date,Amount,Status,Paid Date,Issue Date,Due Date';
  const rows = invoices.map(inv => {
    const fields = [
      inv.invoice_number,
      `"${inv.client_company_name.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`,
      `"${inv.venue.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`,
      inv.gig_date,
      inv.amount.toFixed(2),
      inv.status,
      inv.paid_date || '',
      inv.issue_date,
      inv.due_date,
    ];
    return fields.join(',');
  });

  const csv = [header, ...rows].join('\n');
  const csvFile = new File(Paths.document, 'gigbooks-invoices.csv');
  csvFile.write(csv);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(csvFile.uri, {
      mimeType: 'text/csv',
      dialogTitle: 'Export Invoices',
    });
  }
}
