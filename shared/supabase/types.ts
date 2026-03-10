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

// ─── Songs & Setlists ────────────────────────────────────

export type SongCategory = 'tgt_cover' | 'tgt_original' | 'personal_cover' | 'personal_original';

export function isPersonalSong(cat: SongCategory): boolean {
  return cat === 'personal_cover' || cat === 'personal_original';
}

export function isTgtSong(cat: SongCategory): boolean {
  return cat === 'tgt_cover' || cat === 'tgt_original';
}
export type SetlistType = 'tange' | 'other_band';
export type ClickSound = 'default' | 'high' | 'low' | 'wood' | 'rim';
export type StemLabel = 'drums' | 'bass' | 'vocals' | 'guitar' | 'keys' | 'backing' | 'other';
export type BeatMapStatus = 'pending' | 'analysing' | 'separating' | 'ready' | 'failed';

export interface BeatMap {
  id: string;
  song_id: string;
  beats: number[];         // seconds: [0.45, 0.92, 1.38, ...]
  bpm: number;
  status: BeatMapStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SongStem {
  id: string;
  song_id: string;
  label: StemLabel;
  audio_url: string;
  storage_path: string;
  source: 'auto' | 'manual';
  created_by: string;
  created_at: string;
}

export interface SongShare {
  id: string;
  song_id: string;
  shared_with: string;
  shared_by: string;
  created_at: string;
}

export interface SongShareWithProfile extends SongShare {
  shared_with_name: string;
}

export interface Song {
  id: string;
  name: string;
  artist: string;
  category: SongCategory;       // tgt_cover | tgt_original | personal_cover | personal_original
  owner_id: string | null;      // profile id for personal songs (null for TGT songs)
  bpm: number;
  time_signature_top: number;
  time_signature_bottom: number;
  subdivision: number;          // 1=off, 2=8ths, 3=triplets, 4=16ths, 5=quintuplets, 6=sextuplets
  swing_percent: number;        // 50=straight, 67=triplet swing, 75=hard shuffle
  accent_pattern: string | null; // CSV e.g. "3,1,1,1"
  click_sound: ClickSound;
  count_in_bars: number;
  duration_seconds: number | null;
  key: string;
  notes: string;
  lyrics: string;               // Lyrics text (for stage prompter)
  chords: string;               // Chords text (for stage prompter)
  drum_notation: string;        // Drum notation (Nathan-only field)
  beat_offset_ms: number;       // Manual click-to-track alignment offset
  audio_url: string | null;     // Supabase Storage URL for practice MP3
  audio_storage_path: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Setlist {
  id: string;
  name: string;
  description: string;
  notes: string;
  setlist_type: SetlistType;    // tange | other_band
  band_name: string;            // default 'The Green Tangerine'
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SetlistSong {
  id: string;
  setlist_id: string;
  song_id: string;
  position: number;
  notes: string;
}

export interface SetlistSongWithDetails extends SetlistSong {
  song_name: string;
  song_artist: string;
  song_category: SongCategory;
  song_bpm: number;
  song_time_signature_top: number;
  song_time_signature_bottom: number;
  song_subdivision: number;
  song_swing_percent: number;
  song_accent_pattern: string | null;
  song_click_sound: ClickSound;
  song_count_in_bars: number;
  song_duration_seconds: number | null;
  song_key: string;
  song_notes: string;
  song_lyrics: string;
  song_chords: string;
  song_drum_notation: string;
  song_audio_url: string | null;
}

export interface SetlistWithSongs extends Setlist {
  songs: SetlistSongWithDetails[];
  total_duration_seconds: number | null;
  song_count: number;
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
