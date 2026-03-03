# GigBooks — Schema Map

> Source of Truth for all data models, database schema, and type definitions.
> Update on any data model change.

---

## Database Tables

### settings
Single-row config store (`id = 'default'`).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | 'default' | Singleton — never changes |
| your_name | TEXT | 'Nathan Thomas' | |
| trading_as | TEXT | 'The Green Tangerine' | |
| business_type | TEXT | 'Live Music Entertainment' | |
| website | TEXT | 'www.thegreentangerine.com' | |
| email | TEXT | '' | |
| phone | TEXT | '' | |
| bank_account_name | TEXT | '' | |
| bank_name | TEXT | '' | |
| bank_sort_code | TEXT | '' | |
| bank_account_number | TEXT | '' | |
| payment_terms_days | INTEGER | 14 | Days until due |
| next_invoice_number | INTEGER | 1 | Auto-incremented on create |
| created_at | TEXT | datetime('now') | |

### clients
Client/venue records.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | genId() | |
| company_name | TEXT NOT NULL | — | Required |
| contact_name | TEXT | '' | |
| address | TEXT | '' | |
| email | TEXT | '' | |
| phone | TEXT | '' | |
| created_at | TEXT | datetime('now') | |

**Seeded:** Gin & Juice, Young & Co's Brewery PLC, North Star Cardiff, Suave Agency, Event UK, Andrew Norton

### venues
Venues linked to clients (1:many).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | genId() | |
| client_id | TEXT NOT NULL | — | FK → clients.id (CASCADE) |
| venue_name | TEXT NOT NULL | — | |
| created_at | TEXT | datetime('now') | |

**Seeded:** Gin & Juice Mumbles, The Ship Wandsworth, The Alma Wandsworth

### band_members
Fixed 4-member roster.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | member_1..4 | Fixed IDs |
| name | TEXT NOT NULL | — | Editable |
| sort_order | INTEGER NOT NULL | 1..4 | Display order |
| is_self | INTEGER | 0 | 1 = Nathan (no receipt) |

**Seeded:** member_1 = Nathan Thomas (is_self=1), member_2-4 = placeholders

### invoices
Invoice records with FK to clients.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | genId() | |
| invoice_number | TEXT NOT NULL UNIQUE | — | Format: INV-001 |
| client_id | TEXT NOT NULL | — | FK → clients.id |
| venue | TEXT NOT NULL | — | |
| gig_date | TEXT NOT NULL | — | ISO date |
| amount | REAL NOT NULL | — | GBP |
| description | TEXT NOT NULL | — | Auto-generated, editable |
| issue_date | TEXT NOT NULL | — | ISO date |
| due_date | TEXT NOT NULL | — | issue_date + payment_terms |
| status | TEXT | 'draft' | 'draft' \| 'sent' \| 'paid' |
| paid_date | TEXT | '' | Set when status → paid |
| pdf_uri | TEXT | '' | Local file path |
| style | TEXT | 'classic' | 'classic' \| 'premium' \| 'clean' \| 'bold' |
| created_at | TEXT | datetime('now') | |

### receipts
Band member payment receipts with FKs to invoices and band_members.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | TEXT PK | genId() | |
| invoice_id | TEXT NOT NULL | — | FK → invoices.id |
| member_id | TEXT NOT NULL | — | FK → band_members.id |
| amount | REAL NOT NULL | — | invoice.amount ÷ total_members |
| date | TEXT NOT NULL | — | ISO date |
| pdf_uri | TEXT | '' | Local file path |
| created_at | TEXT | datetime('now') | |

**Rule:** Only created for members where `is_self = 0`. Amount = invoice.amount / total_member_count (rounded 2dp).

---

## TypeScript Interfaces

### GigBooksSettings
```typescript
interface GigBooksSettings {
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
```

### Client
```typescript
interface Client {
  id: string;
  company_name: string;
  contact_name: string;
  address: string;
  email: string;
  phone: string;
  created_at: string;
}
```

### Venue
```typescript
interface Venue {
  id: string;
  client_id: string;
  venue_name: string;
  created_at: string;
}
```

### BandMember
```typescript
interface BandMember {
  id: string;
  name: string;
  sort_order: number;
  is_self: number; // 0 or 1
}
```

### Invoice
```typescript
interface Invoice {
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
```

### InvoiceWithClient (JOIN)
```typescript
interface InvoiceWithClient extends Invoice {
  client_company_name: string;
  client_contact_name: string;
  client_address: string;
}
```

### Receipt
```typescript
interface Receipt {
  id: string;
  invoice_id: string;
  member_id: string;
  amount: number;
  date: string;
  pdf_uri: string;
  created_at: string;
}
```

### ReceiptWithMember (JOIN)
```typescript
interface ReceiptWithMember extends Receipt {
  member_name: string;
}
```

### DashboardStats
```typescript
interface DashboardStats {
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  invoiceCount: number;
  recentInvoices: InvoiceWithClient[];
}
```

### InvoiceTemplateData (PDF)
```typescript
interface InvoiceTemplateData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  fromName: string;
  tradingAs: string;
  businessType: string;
  website: string;
  toCompany: string;
  toContact: string;
  toAddress: string;
  description: string;
  amount: number;
  bankAccountName: string;
  bankName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  paymentTermsDays: number;
}
```

### ReceiptTemplateData (PDF)
```typescript
interface ReceiptTemplateData {
  receiptDate: string;
  paidTo: string;
  paidBy: string;
  amount: number;
  venue: string;
  gigDate: string;
  invoiceNumber: string;
  description: string;
  website: string;
}
```

---

## Entity Relationships

```
settings (singleton, id='default')
    └── Referenced by invoice wizard for business/bank details

clients
    ├── venues (1:many via client_id FK, CASCADE delete)
    └── invoices (1:many via client_id FK)
          └── receipts (1:many via invoice_id FK)

band_members
    └── receipts (1:many via member_id FK)
```

---

## CRUD Operations (src/db/queries.ts)

| Entity | Operations |
|--------|-----------|
| Settings | `getSettings()`, `updateSettings(partial)` |
| Clients | `getClients()`, `getClient(id)`, `addClient(data)`, `updateClient(id, partial)`, `deleteClient(id)`, `searchClients(query)` |
| Venues | `getVenuesForClient(clientId)`, `addVenue(clientId, name)`, `deleteVenue(id)` |
| Band Members | `getBandMembers()`, `getOtherBandMembers()`, `updateBandMember(id, name)` |
| Invoices | `getInvoices()`, `getInvoice(id)`, `createInvoice(data)`, `updateInvoiceStatus(id, status)`, `updateInvoicePdfUri(id, uri)`, `deleteInvoice(id)` |
| Receipts | `getReceiptsForInvoice(invoiceId)`, `createReceipts(invoiceId)`, `updateReceiptPdfUri(id, uri)` |
| Dashboard | `getDashboardStats()` |
