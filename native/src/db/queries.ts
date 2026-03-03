import { getDb } from './database';
import { formatInvoiceNumber } from '../utils/invoiceNumber';
import { addDays, todayISO } from '../utils/formatDate';
import { InvoiceStyle } from '../pdf/invoiceStyles';

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── Settings ───────────────────────────────────────────

export interface GigBooksSettings {
  your_name: string;
  trading_as: string;
  business_type: string;
  website: string;
  email: string;
  phone: string;
  bank_account_name: string;
  bank_name: string;
  bank_sort_code: string;
  bank_account_number: string;
  payment_terms_days: number;
  next_invoice_number: number;
}

export async function getSettings(): Promise<GigBooksSettings> {
  const db = await getDb();
  const row = await db.getFirstAsync<GigBooksSettings>(
    'SELECT your_name, trading_as, business_type, website, email, phone, bank_account_name, bank_name, bank_sort_code, bank_account_number, payment_terms_days, next_invoice_number FROM settings WHERE id = ?',
    ['default']
  );
  return row!;
}

export async function updateSettings(updates: Partial<GigBooksSettings>): Promise<void> {
  const db = await getDb();
  const keys = Object.keys(updates) as (keyof GigBooksSettings)[];
  if (keys.length === 0) return;
  const setClauses = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => updates[k]!);
  await db.runAsync(`UPDATE settings SET ${setClauses} WHERE id = ?`, [...values, 'default']);
}

// ─── Clients ────────────────────────────────────────────

export interface Client {
  id: string;
  company_name: string;
  contact_name: string;
  address: string;
  email: string;
  phone: string;
  created_at: string;
}

export async function getClients(): Promise<Client[]> {
  const db = await getDb();
  return db.getAllAsync<Client>('SELECT * FROM clients ORDER BY company_name ASC');
}

export async function getClient(id: string): Promise<Client | null> {
  const db = await getDb();
  return db.getFirstAsync<Client>('SELECT * FROM clients WHERE id = ?', [id]);
}

export async function addClient(client: Omit<Client, 'id' | 'created_at'>): Promise<string> {
  const db = await getDb();
  const id = genId();
  await db.runAsync(
    'INSERT INTO clients (id, company_name, contact_name, address, email, phone) VALUES (?, ?, ?, ?, ?, ?)',
    [id, client.company_name, client.contact_name, client.address, client.email, client.phone]
  );
  return id;
}

export async function updateClient(id: string, updates: Partial<Omit<Client, 'id' | 'created_at'>>): Promise<void> {
  const db = await getDb();
  const keys = Object.keys(updates) as (keyof typeof updates)[];
  if (keys.length === 0) return;
  const setClauses = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => updates[k]!);
  await db.runAsync(`UPDATE clients SET ${setClauses} WHERE id = ?`, [...values, id]);
}

export async function deleteClient(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM clients WHERE id = ?', [id]);
}

export async function searchClients(query: string): Promise<Client[]> {
  const db = await getDb();
  const pattern = `%${query}%`;
  return db.getAllAsync<Client>(
    'SELECT * FROM clients WHERE company_name LIKE ? OR contact_name LIKE ? ORDER BY company_name ASC',
    [pattern, pattern]
  );
}

// ─── Venues ────────────────────────────────────────────

export interface Venue {
  id: string;
  client_id: string;
  venue_name: string;
  created_at: string;
}

export async function getVenuesForClient(clientId: string): Promise<Venue[]> {
  const db = await getDb();
  return db.getAllAsync<Venue>(
    'SELECT * FROM venues WHERE client_id = ? ORDER BY venue_name ASC',
    [clientId]
  );
}

export async function addVenue(clientId: string, venueName: string): Promise<Venue> {
  const db = await getDb();
  const id = genId();
  await db.runAsync(
    'INSERT INTO venues (id, client_id, venue_name) VALUES (?, ?, ?)',
    [id, clientId, venueName]
  );
  return {
    id,
    client_id: clientId,
    venue_name: venueName,
    created_at: new Date().toISOString(),
  };
}

export async function deleteVenue(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM venues WHERE id = ?', [id]);
}

// ─── Band Members ───────────────────────────────────────

export interface BandMember {
  id: string;
  name: string;
  sort_order: number;
  is_self: number;
}

export async function getBandMembers(): Promise<BandMember[]> {
  const db = await getDb();
  return db.getAllAsync<BandMember>('SELECT * FROM band_members ORDER BY sort_order ASC');
}

export async function getOtherBandMembers(): Promise<BandMember[]> {
  const db = await getDb();
  return db.getAllAsync<BandMember>('SELECT * FROM band_members WHERE is_self = 0 ORDER BY sort_order ASC');
}

export async function updateBandMember(id: string, name: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE band_members SET name = ? WHERE id = ?', [name, id]);
}

// ─── Invoices ───────────────────────────────────────────

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  venue: string;
  gig_date: string;
  amount: number;
  description: string;
  issue_date: string;
  due_date: string;
  status: 'draft' | 'sent' | 'paid';
  paid_date: string;
  pdf_uri: string;
  style: InvoiceStyle;
  created_at: string;
}

export interface InvoiceWithClient extends Invoice {
  client_company_name: string;
  client_contact_name: string;
  client_address: string;
}

export async function getInvoices(): Promise<InvoiceWithClient[]> {
  const db = await getDb();
  return db.getAllAsync<InvoiceWithClient>(
    `SELECT i.*, c.company_name as client_company_name, c.contact_name as client_contact_name, c.address as client_address
     FROM invoices i JOIN clients c ON i.client_id = c.id
     ORDER BY i.created_at DESC`
  );
}

export async function getInvoice(id: string): Promise<InvoiceWithClient | null> {
  const db = await getDb();
  return db.getFirstAsync<InvoiceWithClient>(
    `SELECT i.*, c.company_name as client_company_name, c.contact_name as client_contact_name, c.address as client_address
     FROM invoices i JOIN clients c ON i.client_id = c.id
     WHERE i.id = ?`,
    [id]
  );
}

export async function createInvoice(data: {
  client_id: string;
  venue: string;
  gig_date: string;
  amount: number;
  description: string;
  style?: InvoiceStyle;
}): Promise<Invoice> {
  const db = await getDb();
  const settings = await getSettings();

  const id = genId();
  const invoiceNumber = formatInvoiceNumber(settings.next_invoice_number);
  const issueDate = todayISO();
  const dueDate = addDays(issueDate, settings.payment_terms_days);

  const style = data.style || 'classic';

  await db.withExclusiveTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO invoices (id, invoice_number, client_id, venue, gig_date, amount, description, issue_date, due_date, style)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, invoiceNumber, data.client_id, data.venue, data.gig_date, data.amount, data.description, issueDate, dueDate, style]
    );
    await db.runAsync(
      'UPDATE settings SET next_invoice_number = next_invoice_number + 1 WHERE id = ?',
      ['default']
    );
  });

  return {
    id,
    invoice_number: invoiceNumber,
    client_id: data.client_id,
    venue: data.venue,
    gig_date: data.gig_date,
    amount: data.amount,
    description: data.description,
    issue_date: issueDate,
    due_date: dueDate,
    status: 'draft',
    paid_date: '',
    pdf_uri: '',
    style: style as InvoiceStyle,
    created_at: new Date().toISOString(),
  };
}

export async function updateInvoiceStatus(id: string, status: 'draft' | 'sent' | 'paid'): Promise<void> {
  const db = await getDb();
  const paidDate = status === 'paid' ? todayISO() : '';
  await db.runAsync(
    'UPDATE invoices SET status = ?, paid_date = ? WHERE id = ?',
    [status, paidDate, id]
  );
}

export async function updateInvoicePdfUri(id: string, uri: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE invoices SET pdf_uri = ? WHERE id = ?', [uri, id]);
}

export async function updateInvoiceStyle(id: string, style: InvoiceStyle): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE invoices SET style = ? WHERE id = ?', [style, id]);
}

/**
 * Marks invoice as paid + generates receipts in a single atomic transaction.
 * Idempotent: if receipts already exist, returns them without duplicating.
 */
export async function markInvoicePaid(invoiceId: string): Promise<ReceiptWithMember[]> {
  const db = await getDb();

  // Check for existing receipts first (idempotent guard)
  const existing = await getReceiptsForInvoice(invoiceId);
  if (existing.length > 0) {
    // Just update status if not already paid
    await db.runAsync(
      'UPDATE invoices SET status = ?, paid_date = ? WHERE id = ?',
      ['paid', todayISO(), invoiceId]
    );
    return existing;
  }

  const invoice = await getInvoice(invoiceId);
  if (!invoice) throw new Error('Invoice not found');

  const allMembers = await getBandMembers();
  const otherMembers = allMembers.filter(m => !m.is_self);
  const perPerson = Math.round((invoice.amount / allMembers.length) * 100) / 100;
  const remainder = Math.round((invoice.amount - perPerson * allMembers.length) * 100) / 100;
  const today = todayISO();

  const results: ReceiptWithMember[] = [];

  await db.withExclusiveTransactionAsync(async () => {
    // 1. Mark paid
    await db.runAsync(
      'UPDATE invoices SET status = ?, paid_date = ? WHERE id = ?',
      ['paid', today, invoiceId]
    );

    // 2. Generate receipts
    for (let i = 0; i < otherMembers.length; i++) {
      const member = otherMembers[i];
      const amt = i === 0 ? perPerson + remainder : perPerson;
      const id = genId();
      await db.runAsync(
        'INSERT INTO receipts (id, invoice_id, member_id, amount, date) VALUES (?, ?, ?, ?, ?)',
        [id, invoiceId, member.id, amt, today]
      );
      results.push({
        id,
        invoice_id: invoiceId,
        member_id: member.id,
        amount: amt,
        date: today,
        pdf_uri: '',
        created_at: new Date().toISOString(),
        member_name: member.name,
      });
    }
  });

  return results;
}

export async function deleteInvoice(id: string): Promise<string[]> {
  const db = await getDb();

  // Collect PDF URIs to clean up
  const invoice = await db.getFirstAsync<{ pdf_uri: string }>('SELECT pdf_uri FROM invoices WHERE id = ?', [id]);
  const receipts = await db.getAllAsync<{ pdf_uri: string }>('SELECT pdf_uri FROM receipts WHERE invoice_id = ?', [id]);

  const pdfUris: string[] = [];
  if (invoice?.pdf_uri) pdfUris.push(invoice.pdf_uri);
  for (const r of receipts) {
    if (r.pdf_uri) pdfUris.push(r.pdf_uri);
  }

  // Delete receipts first (no CASCADE on this FK), then invoice
  await db.runAsync('DELETE FROM receipts WHERE invoice_id = ?', [id]);
  await db.runAsync('DELETE FROM invoices WHERE id = ?', [id]);

  return pdfUris;
}

// ─── Receipts ───────────────────────────────────────────

export interface Receipt {
  id: string;
  invoice_id: string;
  member_id: string;
  amount: number;
  date: string;
  pdf_uri: string;
  created_at: string;
}

export interface ReceiptWithMember extends Receipt {
  member_name: string;
}

export async function getReceiptsForInvoice(invoiceId: string): Promise<ReceiptWithMember[]> {
  const db = await getDb();
  return db.getAllAsync<ReceiptWithMember>(
    `SELECT r.*, bm.name as member_name
     FROM receipts r JOIN band_members bm ON r.member_id = bm.id
     WHERE r.invoice_id = ?
     ORDER BY bm.sort_order ASC`,
    [invoiceId]
  );
}

export async function createReceipts(invoiceId: string): Promise<ReceiptWithMember[]> {
  // Guard: if receipts already exist, return them
  const existing = await getReceiptsForInvoice(invoiceId);
  if (existing.length > 0) return existing;

  const db = await getDb();
  const invoice = await getInvoice(invoiceId);
  if (!invoice) throw new Error('Invoice not found');

  const allMembers = await getBandMembers();
  const otherMembers = allMembers.filter(m => !m.is_self);
  const perPerson = Math.round((invoice.amount / allMembers.length) * 100) / 100;
  const remainder = Math.round((invoice.amount - perPerson * allMembers.length) * 100) / 100;
  const today = todayISO();

  const results: ReceiptWithMember[] = [];

  for (let i = 0; i < otherMembers.length; i++) {
    const member = otherMembers[i];
    const amt = i === 0 ? perPerson + remainder : perPerson;
    const id = genId();
    await db.runAsync(
      'INSERT INTO receipts (id, invoice_id, member_id, amount, date) VALUES (?, ?, ?, ?, ?)',
      [id, invoiceId, member.id, amt, today]
    );
    results.push({
      id,
      invoice_id: invoiceId,
      member_id: member.id,
      amount: amt,
      date: today,
      pdf_uri: '',
      created_at: new Date().toISOString(),
      member_name: member.name,
    });
  }

  return results;
}

export async function updateReceiptPdfUri(id: string, uri: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE receipts SET pdf_uri = ? WHERE id = ?', [uri, id]);
}

// ─── Dashboard Stats ────────────────────────────────────

export interface DashboardStats {
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  invoiceCount: number;
  recentInvoices: InvoiceWithClient[];
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = await getDb();

  const totals = await db.getFirstAsync<{ total: number; paid: number; outstanding: number; count: number }>(
    `SELECT
       COALESCE(SUM(amount), 0) as total,
       COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid,
       COALESCE(SUM(CASE WHEN status = 'sent' THEN amount ELSE 0 END), 0) as outstanding,
       COUNT(*) as count
     FROM invoices`
  );

  const recentInvoices = await db.getAllAsync<InvoiceWithClient>(
    `SELECT i.*, c.company_name as client_company_name, c.contact_name as client_contact_name, c.address as client_address
     FROM invoices i JOIN clients c ON i.client_id = c.id
     ORDER BY i.created_at DESC LIMIT 5`
  );

  return {
    totalInvoiced: totals?.total ?? 0,
    totalPaid: totals?.paid ?? 0,
    totalOutstanding: totals?.outstanding ?? 0,
    invoiceCount: totals?.count ?? 0,
    recentInvoices,
  };
}
