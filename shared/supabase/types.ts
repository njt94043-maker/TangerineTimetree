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
export type GigSubtype = 'pub' | 'client';
export type BookingStatus = 'enquiry' | 'pencilled' | 'confirmed' | 'cancelled';
export type GigVisibility = 'public' | 'private' | 'hidden';

export interface Gig {
  id: string;
  date: string;            // YYYY-MM-DD
  gig_type: GigType;
  venue: string;
  client_name: string;
  venue_id: string | null;
  client_id: string | null;
  fee: number | null;
  payment_type: 'cash' | 'invoice' | '';
  load_time: string | null; // HH:MM
  start_time: string | null;
  end_time: string | null;
  notes: string;
  visibility: GigVisibility;
  gig_subtype: GigSubtype;
  status: BookingStatus;
  deposit_amount: number | null;
  deposit_paid: boolean;
  quote_id: string | null;
  formal_invoice_id: string | null;
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
export type DayDisplay = 'available' | 'pub' | 'client' | 'enquiry' | 'practice' | 'unavailable' | 'past';

// Gig completeness check — flags gigs missing key details
// Practice sessions only need venue + start_time
export function isGigIncomplete(gig: Gig): boolean {
  if (gig.gig_type === 'practice') {
    return !gig.venue || !gig.start_time;
  }
  return !gig.venue || gig.fee == null || !gig.start_time;
}

// Legacy: Compute calendar day status (kept for backward compat)
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

// Compute calendar day display with pub/client/enquiry distinction
export function computeDayDisplay(
  date: string,
  today: string,
  gigs: Gig[],
  awayDates: AwayDate[],
): DayDisplay {
  if (date < today) return 'past';

  const dateGigs = gigs.filter(g => g.date === date && g.status !== 'cancelled');
  const clientGigs = dateGigs.filter(g => g.gig_type === 'gig' && g.gig_subtype === 'client');
  const pubGigs = dateGigs.filter(g => g.gig_type === 'gig' && g.gig_subtype === 'pub');
  const hasPractice = dateGigs.some(g => g.gig_type === 'practice');

  // Client gigs take priority over pub gigs in display
  if (clientGigs.length > 0) {
    // If no client gig is confirmed yet, show as enquiry
    const hasConfirmed = clientGigs.some(g => g.status === 'confirmed');
    if (!hasConfirmed) return 'enquiry';
    return 'client';
  }
  if (pubGigs.length > 0) return 'pub';
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

// In-app notification (S242 slice 1a). Rows are written only by the
// notify_on_enquiry() SECURITY DEFINER trigger; clients read/mark-read their own.
export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  event_type: string | null;
  title: string;
  body: string | null;
  related_table: string | null;
  related_id: string | null;
  read: boolean;
  created_at: string;
}

// Web Push subscription (S243 slice 2). One row per device/browser that opted in.
// Own-row RLS (user_id = auth.uid()); the notify-push edge fn reads ALL rows via
// the service role to fan out push. `endpoint` is UNIQUE (the upsert key).
export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
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
  venue_name: string;
  address: string;
  postcode: string;
  email: string;
  phone: string;
  contact_name: string;
  rating_atmosphere: number | null;  // 1-5
  rating_crowd: number | null;       // 1-5
  rating_stage: number | null;       // 1-5
  rating_parking: number | null;     // 1-5
  notes: string;
  created_by: string;
  created_at: string;
}

export interface VenuePhoto {
  id: string;
  venue_id: string;
  file_url: string;
  storage_path: string;
  caption: string;
  created_by: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string | null;
  venue_id: string | null;
  gig_id: string | null;
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
  venue_name: string;
  venue_address: string;
  venue_email: string;
  venue_phone: string;
  venue_contact_name: string;
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
  calendar_colour_pub: string;
  calendar_colour_client: string;
  calendar_colour_practice: string;
  // Player preferences (per-user)
  player_click_enabled: boolean;
  player_flash_enabled: boolean;
  player_lyrics_enabled: boolean;
  player_chords_enabled: boolean;
  player_notes_enabled: boolean;
  player_drums_enabled: boolean;
  player_vis_enabled: boolean;
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
  // Booking wizard
  cancellation_threshold_days: number;
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
  client_id: string | null;
  venue_id: string | null;
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
  venue_email: string;
  venue_phone: string;
  venue_contact_name: string;
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
  client_id: string | null;
  venue_id: string | null;
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
  venue_email: string;
  venue_phone: string;
  venue_contact_name: string;
}

// ─── Bill-To Resolution ─────────────────────────────────

export interface BillTo {
  name: string;
  contact_name: string;
  address: string;
  email: string;
  phone: string;
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

// ─── Click / Audio shared types ──────────────────────────

export type ClickSound = 'default' | 'high' | 'low' | 'wood' | 'rim';

// ─── Setlist Entries (S118/S121: self-contained rows, 3 master lists) ───
// Replaces songs + setlists + setlist_songs. Lists are fixed: Staples/Party/Classic Rock.

export type SetlistListId = 'staples' | 'party' | 'classic_rock';

export const SETLIST_LIST_ORDER: SetlistListId[] = ['staples', 'party', 'classic_rock'];

export const SETLIST_LIST_LABELS: Record<SetlistListId, string> = {
  staples: 'Staples',
  party: 'Party',
  classic_rock: 'Classic Rock',
};

export interface SetlistEntry {
  id: string;
  list_id: SetlistListId;
  position: number;
  title: string;
  artist: string | null;
  bpm: number | null;
  beats_per_bar: number;
  click_y_n: boolean;
  click_config: unknown | null;
  led_visual: string | null;
  backdrop_url: string | null;
  notes: string | null;
  chord_text: string | null;
  lyric_text: string | null;
  drum_text: string | null;
  practice_audio_ref: string | null;        // MS asset reference
  practice_stems_refs: unknown | null;      // MS stem references (jsonb)
  created_at: string;
  updated_at: string;
}

// ─── Setlist Authoring (S125 — cross-surface direct edit) ──────────────
// All 3 surfaces (MS PWA / Web / APK) write directly to setlist_entries.
// Editorial control = rollback-from-changelog. Gig-lock queues edits to
// setlist_pending_edits which auto-apply on gig-end.
//
// See: specs/tgt/apps/setlist-authoring--build-brief.md, S125 migration.

export type EditSurface = 'ms_pwa' | 'web' | 'apk' | 'studio_v2';
export type SetlistAction = 'created' | 'updated' | 'deleted' | 'reordered' | 'moved';

export interface SetlistChangelogEntry {
  id: string;
  list_id: SetlistListId;
  entry_id: string | null;
  actor_id: string | null;
  actor_name: string;
  surface: EditSurface;
  action: SetlistAction;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export interface SetlistPendingEdit {
  id: string;
  list_id: SetlistListId;
  entry_id: string | null;
  actor_id: string | null;
  actor_name: string;
  surface: EditSurface;
  action: SetlistAction;
  payload: unknown;          // jsonb — shape depends on action
  created_at: string;
  applied_at: string | null;
  apply_error: string | null;
}

export interface GigLockState {
  id: 1;
  is_locked: boolean;
  locked_by_surface: EditSurface | null;
  locked_at: string | null;
  gig_label: string | null;
  updated_at: string;
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
  source_url: string | null;
  review_date: string | null;
  visible: boolean;
  sort_order: number;
  created_at: string;
  created_by: string | null;
}
