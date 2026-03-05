// ─── Supabase Shared Types ──────────────────────────────
// Used by both GigBooks (native) and Tangerine Timetree (web)

export interface Profile {
  id: string;
  name: string;
  is_admin: boolean;
  avatar_url: string;
  band_role: string;
  created_at: string;
  last_opened_at: string;
}

export interface ChangeSummaryItem {
  type: 'gig' | 'away';
  action: string;
  user_name: string;
  description: string;
  created_at: string;
}

export type GigType = 'gig' | 'practice';
export type GigVisibility = 'public' | 'private' | 'hidden';

export interface Gig {
  id: string;
  date: string;            // YYYY-MM-DD
  gig_type: GigType;
  venue: string;
  client_name: string;
  fee: number | null;
  payment_type: 'cash' | 'invoice' | '';
  load_time: string | null; // HH:MM
  start_time: string | null;
  end_time: string | null;
  notes: string;
  visibility: GigVisibility;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GigAttachment {
  id: string;
  gig_id: string;
  file_url: string;
  storage_path: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

export interface GigWithCreator extends Gig {
  creator_name: string;
}

export interface AwayDate {
  id: string;
  user_id: string;
  start_date: string;      // YYYY-MM-DD
  end_date: string;
  reason: string;
  created_at: string;
}

export interface AwayDateWithUser extends AwayDate {
  user_name: string;
}

export interface GigChangelogEntry {
  id: string;
  gig_id: string;
  user_id: string;
  action: 'created' | 'updated' | 'deleted';
  field_changed: string;
  old_value: string;
  new_value: string;
  created_at: string;
}

export interface GigChangelogWithUser extends GigChangelogEntry {
  user_name: string;
}

// Calendar day status for coloring
export type DayStatus = 'available' | 'gig' | 'practice' | 'unavailable' | 'past';

// Gig completeness check — flags gigs missing key details
// Practice sessions only need venue + start_time
export function isGigIncomplete(gig: Gig): boolean {
  if (gig.gig_type === 'practice') {
    return !gig.venue || !gig.start_time;
  }
  return !gig.venue || !gig.client_name || gig.fee == null || !gig.start_time;
}

// Compute calendar day status
export function computeDayStatus(
  date: string,
  today: string,
  gigs: Gig[],
  awayDates: AwayDate[],
): DayStatus {
  if (date < today) return 'past';

  const dateGigs = gigs.filter(g => g.date === date);
  const hasGig = dateGigs.some(g => g.gig_type !== 'practice');
  const hasPractice = dateGigs.some(g => g.gig_type === 'practice');
  if (hasGig) return 'gig';
  if (hasPractice) return 'practice';

  const awayUserIds = new Set(
    awayDates
      .filter(a => date >= a.start_date && date <= a.end_date)
      .map(a => a.user_id),
  );

  if (awayUserIds.size > 0) return 'unavailable';
  return 'available';
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  event_type: string;
  preferred_date: string | null;
  message: string;
  read: boolean;
  archived: boolean;
  notes: string;
  created_at: string;
}

export interface PublicMedia {
  id: string;
  media_type: 'photo' | 'video';
  url: string;
  title: string;
  description: string;
  thumbnail_url: string;
  video_embed_url: string;
  date_taken: string | null;
  location: string;
  sort_order: number;
  visible: boolean;
  created_by: string;
  created_at: string;
}

// ─── Invoicing Types ─────────────────────────────────────

export type InvoiceStatus = 'draft' | 'sent' | 'paid';
export type InvoiceStyle = 'classic' | 'premium' | 'clean' | 'bold' | 'christmas' | 'halloween' | 'valentine';

export interface Client {
  id: string;
  company_name: string;
  contact_name: string;
  address: string;
  email: string;
  phone: string;
  created_by: string;
  created_at: string;
}

export interface Venue {
  id: string;
  client_id: string;
  venue_name: string;
  address: string;
  created_by: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  venue: string;
  gig_date: string;        // YYYY-MM-DD
  amount: number;
  description: string;
  issue_date: string;       // YYYY-MM-DD
  due_date: string;         // YYYY-MM-DD
  status: InvoiceStatus;
  paid_date: string | null;
  style: InvoiceStyle;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceWithClient extends Invoice {
  client_company_name: string;
  client_contact_name: string;
  client_address: string;
  client_email: string;
}

export interface Receipt {
  id: string;
  invoice_id: string;
  member_id: string;
  amount: number;
  date: string;             // YYYY-MM-DD
  created_at: string;
}

export interface ReceiptWithMember extends Receipt {
  member_name: string;
}

export interface UserSettings {
  id: string;
  your_name: string;
  email: string;
  phone: string;
  bank_account_name: string;
  bank_name: string;
  bank_sort_code: string;
  bank_account_number: string;
  updated_at: string;
}

export interface BandSettings {
  id: string;
  trading_as: string;
  business_type: string;
  website: string;
  payment_terms_days: number;
  next_invoice_number: number;
  // PLI fields
  pli_insurer: string;
  pli_policy_number: string;
  pli_cover_amount: string;
  pli_expiry_date: string | null;
  // Quote fields
  default_terms_and_conditions: string;
  default_quote_validity_days: number;
  next_quote_number: number;
  updated_at: string;
}

export interface DashboardStats {
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  invoiceCount: number;
  recentInvoices: InvoiceWithClient[];
}

// ─── Quoting & Formal Invoicing Types ────────────────────

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
export type EventType = 'wedding' | 'corporate' | 'private' | 'festival' | 'other';
export type PLIOption = 'certificate' | 'details' | 'none';

export interface ServiceCatalogueItem {
  id: string;
  name: string;
  description: string;
  default_price: number;
  unit_label: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Quote {
  id: string;
  quote_number: string;
  client_id: string;
  created_by: string;
  event_type: EventType;
  event_date: string;        // YYYY-MM-DD
  venue_name: string;
  venue_address: string;
  subtotal: number;
  discount_amount: number;
  total: number;
  pli_option: PLIOption;
  terms_and_conditions: string;
  validity_days: number;
  notes: string;
  status: QuoteStatus;
  style: InvoiceStyle;
  created_at: string;
  sent_at: string | null;
  responded_at: string | null;
  updated_at: string;
}

export interface QuoteWithClient extends Quote {
  client_company_name: string;
  client_contact_name: string;
  client_address: string;
  client_email: string;
  client_phone: string;
}

export interface QuoteLineItem {
  id: string;
  quote_id: string;
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sort_order: number;
}

export interface FormalInvoice {
  id: string;
  invoice_number: string;
  quote_id: string;
  client_id: string;
  created_by: string;
  venue_name: string;
  event_date: string;        // YYYY-MM-DD
  subtotal: number;
  discount_amount: number;
  total: number;
  issue_date: string;        // YYYY-MM-DD
  due_date: string;          // YYYY-MM-DD
  status: InvoiceStatus;
  paid_date: string | null;
  notes: string;
  style: InvoiceStyle;
  created_at: string;
  updated_at: string;
}

export interface FormalInvoiceWithClient extends FormalInvoice {
  client_company_name: string;
  client_contact_name: string;
  client_address: string;
  client_email: string;
}

export interface FormalInvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sort_order: number;
}

export interface FormalReceipt {
  id: string;
  invoice_id: string;
  member_id: string;
  amount: number;
  date: string;             // YYYY-MM-DD
  created_at: string;
}

export interface FormalReceiptWithMember extends FormalReceipt {
  member_name: string;
}

// ─── Public Website Content ─────────────────────────────

export interface SiteContent {
  id: string;
  key: string;
  value: string;
  updated_at: string;
  updated_by: string | null;
}

export interface SiteReview {
  id: string;
  author_name: string;
  review_text: string;
  rating: number;
  source: string;
  review_date: string | null;
  visible: boolean;
  sort_order: number;
  created_at: string;
  created_by: string | null;
}
