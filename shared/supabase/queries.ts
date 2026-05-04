import { getSupabase, handleAuthError } from './clientRef';
import type {
  Profile,
  Gig,
  GigType,
  GigSubtype,
  BookingStatus,
  GigVisibility,
  GigWithCreator,
  GigAttachment,
  AwayDate,
  AwayDateWithUser,
  GigChangelogEntry,
  GigChangelogWithUser,
  ChangeSummaryItem,
  PublicMedia,
  ContactSubmission,
  Client,
  Venue,
  VenuePhoto,
  Invoice,
  InvoiceWithClient,
  InvoiceStatus,
  InvoiceStyle,
  ReceiptWithMember,
  UserSettings,
  BandSettings,
  DashboardStats,
  ServiceCatalogueItem,
  Quote,
  QuoteWithClient,
  QuoteLineItem,
  QuoteStatus,
  EventType,
  PLIOption,
  FormalInvoice,
  FormalInvoiceWithClient,
  FormalInvoiceLineItem,
  FormalReceiptWithMember,
  BillTo,
  SiteContent,
  SiteReview,
  Song,
  SongCategory,
  ClickSound,
  SongStem,
  StemLabel,
  BeatMap,
  Setlist,
  SetlistType,
  SetlistSong,
  SetlistSongWithDetails,
  SetlistWithSongs,
  SongShare,
  SongShareWithProfile,
  GigPerformanceLogWithSong,
  SongPlayStats,
  SetlistEntry,
  SetlistListId,
  SetlistChangelogEntry,
  SetlistPendingEdit,
  GigLockState,
  EditSurface,
  SetlistAction,
} from './types';

// Row shapes returned by Supabase joins (avoids `any` casts)
interface GigWithProfileJoin extends Gig {
  profiles: { name: string } | null;
}

interface AwayDateWithProfileJoin extends AwayDate {
  profiles: { name: string } | null;
}

interface GigChangelogWithProfileJoin extends GigChangelogEntry {
  profiles: { name: string } | null;
}

interface GigChangelogWithGigJoin extends GigChangelogEntry {
  profiles: { name: string } | null;
  gigs: { date: string; venue: string } | null;
}

interface AwayDateChangelogRow {
  id: string;
  away_date_id: string;
  user_id: string;
  action: string;
  date_range: string;
  reason: string;
  created_at: string;
  profiles: { name: string } | null;
}

function checkAuthError(error: any): void {
  if (!error) return;
  const code = error?.code ?? '';
  const msg = (error?.message ?? '').toLowerCase();
  if (code === 'PGRST301' || code === '401' || msg.includes('jwt expired') || msg.includes('not authenticated')) {
    handleAuthError();
  }
}

// ─── Profiles ───────────────────────────────────────────

export async function getProfiles(): Promise<Profile[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('name');
  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  if (error) { checkAuthError(error); throw error; }
  return data;
}

// ─── Gigs ───────────────────────────────────────────────

export async function getGigsForMonth(year: number, month: number): Promise<GigWithCreator[]> {
  const supabase = getSupabase();
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('gigs')
    .select('*, profiles!gigs_created_by_fkey(name)')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');

  if (error) { checkAuthError(error); throw error; }

  return (data ?? []).map((row: GigWithProfileJoin) => ({
    ...row,
    creator_name: row.profiles?.name ?? 'Unknown',
    profiles: undefined,
  }));
}

export async function getGigsByDate(date: string): Promise<GigWithCreator[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('gigs')
    .select('*, profiles!gigs_created_by_fkey(name)')
    .eq('date', date)
    .order('start_time');

  if (error) { checkAuthError(error); throw error; }

  return (data ?? []).map((row: GigWithProfileJoin) => ({
    ...row,
    creator_name: row.profiles?.name ?? 'Unknown',
    profiles: undefined,
  }));
}

export async function createGig(gig: {
  date: string;
  gig_type?: GigType;
  gig_subtype?: GigSubtype;
  status?: BookingStatus;
  venue?: string;
  client_name?: string;
  venue_id?: string | null;
  client_id?: string | null;
  fee?: number | null;
  payment_type?: 'cash' | 'invoice' | '';
  load_time?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  notes?: string;
  visibility?: GigVisibility;
  deposit_amount?: number | null;
  deposit_paid?: boolean;
  quote_id?: string | null;
  formal_invoice_id?: string | null;
}): Promise<Gig> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('gigs')
    .insert({
      date: gig.date,
      gig_type: gig.gig_type ?? 'gig',
      gig_subtype: gig.gig_subtype ?? 'pub',
      status: gig.status ?? 'confirmed',
      venue: gig.venue ?? '',
      client_name: gig.client_name ?? '',
      venue_id: gig.venue_id ?? null,
      client_id: gig.client_id ?? null,
      fee: gig.fee ?? null,
      payment_type: gig.payment_type ?? '',
      load_time: gig.load_time ?? null,
      start_time: gig.start_time ?? null,
      end_time: gig.end_time ?? null,
      notes: gig.notes ?? '',
      visibility: gig.visibility ?? 'hidden',
      deposit_amount: gig.deposit_amount ?? null,
      deposit_paid: gig.deposit_paid ?? false,
      quote_id: gig.quote_id ?? null,
      formal_invoice_id: gig.formal_invoice_id ?? null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) { checkAuthError(error); throw error; }

  // Log creation (non-critical — don't fail the mutation)
  try {
    await supabase.from('gig_changelog').insert({
      gig_id: data.id,
      user_id: user.id,
      action: 'created',
    });
  } catch { /* changelog is best-effort */ }

  return data;
}

export async function updateGig(
  id: string,
  updates: Partial<Omit<Gig, 'id' | 'created_by' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch current values for changelog
  const { data: current } = await supabase.from('gigs').select('*').eq('id', id).single();

  const { error } = await supabase.from('gigs').update(updates).eq('id', id);
  if (error) { checkAuthError(error); throw error; }

  // Log each changed field
  if (current) {
    const currentRecord = current as Record<string, unknown>;
    const changelogEntries = Object.entries(updates)
      .filter(([key, val]) => {
        const oldVal = currentRecord[key];
        return String(val ?? '') !== String(oldVal ?? '');
      })
      .map(([key, val]) => ({
        gig_id: id,
        user_id: user.id,
        action: 'updated' as const,
        field_changed: key,
        old_value: String(currentRecord[key] ?? ''),
        new_value: String(val ?? ''),
      }));

    if (changelogEntries.length > 0) {
      try {
        await supabase.from('gig_changelog').insert(changelogEntries);
      } catch { /* changelog is best-effort */ }
    }
  }
}

export async function deleteGig(id: string): Promise<void> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch gig info for changelog before deleting
  const { data: current } = await supabase.from('gigs').select('venue, date').eq('id', id).single();

  // Log deletion (before delete, since CASCADE will remove changelog too)
  try {
    await supabase.from('gig_changelog').insert({
      gig_id: id,
      user_id: user.id,
      action: 'deleted',
      field_changed: '',
      old_value: current ? `${current.venue} on ${current.date}` : '',
      new_value: '',
    });
  } catch { /* changelog is best-effort */ }

  const { error } = await supabase.from('gigs').delete().eq('id', id);
  if (error) { checkAuthError(error); throw error; }
}

// ─── Upcoming Gigs (list view) ──────────────────────────

export async function getUpcomingGigs(limit = 50): Promise<GigWithCreator[]> {
  const supabase = getSupabase();
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('gigs')
    .select('*, profiles!gigs_created_by_fkey(name)')
    .gte('date', todayISO)
    .order('date')
    .order('start_time')
    .limit(limit);
  if (error) { checkAuthError(error); throw error; }

  return (data ?? []).map((row: GigWithProfileJoin) => ({
    ...row,
    creator_name: row.profiles?.name ?? 'Unknown',
    profiles: undefined,
  }));
}

// ─── Away Dates ─────────────────────────────────────────

export async function getAwayDatesForMonth(year: number, month: number): Promise<AwayDateWithUser[]> {
  const supabase = getSupabase();
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('away_dates')
    .select('*, profiles!away_dates_user_id_fkey(name)')
    .lte('start_date', endDate)
    .gte('end_date', startDate);

  if (error) { checkAuthError(error); throw error; }

  return (data ?? []).map((row: AwayDateWithProfileJoin) => ({
    ...row,
    user_name: row.profiles?.name ?? 'Unknown',
    profiles: undefined,
  }));
}

export async function getMyAwayDates(): Promise<AwayDate[]> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('away_dates')
    .select('*')
    .eq('user_id', user.id)
    .order('start_date');

  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function createAwayDate(params: {
  start_date: string;
  end_date: string;
  reason?: string;
}): Promise<AwayDate> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('away_dates')
    .insert({
      user_id: user.id,
      start_date: params.start_date,
      end_date: params.end_date,
      reason: params.reason ?? '',
    })
    .select()
    .single();

  if (error) { checkAuthError(error); throw error; }

  // Log to away_date_changelog
  const range = params.start_date === params.end_date
    ? params.start_date
    : `${params.start_date} to ${params.end_date}`;
  try {
    await supabase.from('away_date_changelog').insert({
      away_date_id: data.id,
      user_id: user.id,
      action: 'created',
      date_range: range,
      reason: params.reason ?? '',
    });
  } catch { /* changelog is best-effort */ }

  return data;
}

export async function deleteAwayDate(id: string): Promise<void> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch away date info for changelog before deleting
  const { data: current } = await supabase.from('away_dates').select('start_date, end_date, reason').eq('id', id).single();

  // Log deletion before delete
  if (current) {
    const range = current.start_date === current.end_date
      ? current.start_date
      : `${current.start_date} to ${current.end_date}`;
    try {
      await supabase.from('away_date_changelog').insert({
        away_date_id: id,
        user_id: user.id,
        action: 'deleted',
        date_range: range,
        reason: current.reason ?? '',
      });
    } catch { /* changelog is best-effort */ }
  }

  const { error } = await supabase.from('away_dates').delete().eq('id', id);
  if (error) { checkAuthError(error); throw error; }
}

export async function updateAwayDate(id: string, params: {
  start_date: string;
  end_date: string;
  reason?: string;
}): Promise<AwayDate> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('away_dates')
    .update({
      start_date: params.start_date,
      end_date: params.end_date,
      reason: params.reason ?? '',
    })
    .eq('id', id)
    .select()
    .single();

  if (error) { checkAuthError(error); throw error; }
  return data;
}

// ─── Changelog ──────────────────────────────────────────

export async function getGigChangelog(gigId: string): Promise<GigChangelogWithUser[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('gig_changelog')
    .select('*, profiles!gig_changelog_user_id_fkey(name)')
    .eq('gig_id', gigId)
    .order('created_at', { ascending: false });

  if (error) { checkAuthError(error); throw error; }

  return (data ?? []).map((row: GigChangelogWithProfileJoin) => ({
    ...row,
    user_name: row.profiles?.name ?? 'Unknown',
    profiles: undefined,
  }));
}

// ─── Change Summary ─────────────────────────────────────

export async function updateLastOpened(): Promise<void> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('profiles').update({ last_opened_at: new Date().toISOString() }).eq('id', user.id);
}

export async function getChangesSince(since: string): Promise<ChangeSummaryItem[]> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Fetch gig changelog entries since last opened (by other users)
  const { data: gigChanges } = await supabase
    .from('gig_changelog')
    .select('*, profiles!gig_changelog_user_id_fkey(name), gigs!gig_changelog_gig_id_fkey(date, venue)')
    .gt('created_at', since)
    .neq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  // Fetch away date changelog entries since last opened (by other users)
  const { data: awayChanges } = await supabase
    .from('away_date_changelog')
    .select('*, profiles!away_date_changelog_user_id_fkey(name)')
    .gt('created_at', since)
    .neq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  const items: ChangeSummaryItem[] = [];

  for (const c of (gigChanges ?? []) as GigChangelogWithGigJoin[]) {
    const userName = c.profiles?.name ?? 'Someone';
    const gig = c.gigs;
    let description = '';
    if (c.action === 'created') {
      description = `added a ${gig?.venue ? `gig at ${gig.venue}` : 'gig'}${gig?.date ? ` on ${formatShortDate(gig.date)}` : ''}`;
    } else if (c.action === 'deleted') {
      description = `removed a gig${c.old_value ? ` (${c.old_value})` : ''}`;
    } else if (c.action === 'updated') {
      description = `updated ${c.field_changed?.replace(/_/g, ' ')}${gig?.venue ? ` for ${gig.venue}` : ''}${c.new_value ? ` to "${c.new_value}"` : ''}`;
    }
    items.push({ type: 'gig', action: c.action, user_name: userName, description, created_at: c.created_at });
  }

  for (const c of (awayChanges ?? []) as AwayDateChangelogRow[]) {
    const userName = c.profiles?.name ?? 'Someone';
    const description = c.action === 'created'
      ? `marked away ${c.date_range}${c.reason ? ` (${c.reason})` : ''}`
      : `removed away date ${c.date_range}`;
    items.push({ type: 'away', action: c.action, user_name: userName, description, created_at: c.created_at });
  }

  // Sort by most recent first, limit to 10
  items.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return items.slice(0, 10);
}

// ─── Public Queries (no auth required) ──────────────────

export async function getPublicProfiles(): Promise<Profile[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('name');
  if (error) return []; // Graceful fallback — anon may not have read access
  return data ?? [];
}

export async function getPublicGigs(): Promise<Gig[]> {
  const supabase = getSupabase();
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('gigs')
    .select('*')
    .in('visibility', ['public', 'private'])
    .gte('date', todayISO)
    .order('date');

  if (error) throw error;
  return data ?? [];
}

// ─── Gig Field Suggestions ──────────────────────────────

export interface GigFieldSuggestions {
  venues: string[];
  clients: string[];
  fees: number[];
}

/** Fetch distinct gig field values, ordered by frequency (most used first). */
export async function getGigFieldSuggestions(): Promise<GigFieldSuggestions> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('gigs')
    .select('venue, client_name, fee');

  if (error) { handleAuthError(); throw error; }

  const venueCount = new Map<string, number>();
  const clientCount = new Map<string, number>();
  const feeCount = new Map<number, number>();

  for (const row of data ?? []) {
    if (row.venue) venueCount.set(row.venue, (venueCount.get(row.venue) ?? 0) + 1);
    if (row.client_name) clientCount.set(row.client_name, (clientCount.get(row.client_name) ?? 0) + 1);
    if (row.fee != null) feeCount.set(row.fee, (feeCount.get(row.fee) ?? 0) + 1);
  }

  const sortByFreq = <T,>(map: Map<T, number>): T[] =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);

  return {
    venues: sortByFreq(venueCount),
    clients: sortByFreq(clientCount),
    fees: sortByFreq(feeCount),
  };
}

// ─── Gig Attachments ────────────────────────────────────

export async function getGigAttachments(gigId: string): Promise<GigAttachment[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('gig_attachments')
    .select('*')
    .eq('gig_id', gigId)
    .order('created_at');

  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function createGigAttachment(
  gigId: string,
  fileUrl: string,
  storagePath: string,
  fileSize: number,
): Promise<GigAttachment> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('gig_attachments')
    .insert({ gig_id: gigId, file_url: fileUrl, storage_path: storagePath, file_size: fileSize, uploaded_by: user.id })
    .select()
    .single();

  if (error) { checkAuthError(error); throw error; }
  return data;
}

export async function deleteGigAttachment(id: string, storagePath: string): Promise<void> {
  const supabase = getSupabase();

  // Delete from storage first
  await supabase.storage.from('gig-attachments').remove([storagePath]);

  const { error } = await supabase.from('gig_attachments').delete().eq('id', id);
  if (error) { checkAuthError(error); throw error; }
}

// ─── Booking Wizard Queries ────────────────────────────────

export async function getVenueHistory(venueId: string): Promise<{ lastFee: number | null; usualStartTime: string | null }> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('gigs')
    .select('fee, start_time')
    .eq('venue_id', venueId)
    .eq('gig_type', 'gig')
    .order('date', { ascending: false })
    .limit(5);

  if (!data || data.length === 0) return { lastFee: null, usualStartTime: null };

  const lastFee = data[0].fee;
  // Most common start time across recent gigs at this venue
  const times = data.map((g: { fee: number | null; start_time: string | null }) => g.start_time).filter(Boolean) as string[];
  const timeCounts = new Map<string, number>();
  for (const t of times) timeCounts.set(t, (timeCounts.get(t) ?? 0) + 1);
  let usualStartTime: string | null = null;
  let maxCount = 0;
  for (const [t, c] of timeCounts) {
    if (c > maxCount) { maxCount = c; usualStartTime = t; }
  }

  return { lastFee, usualStartTime };
}

export async function getGigWithLinkedDocs(gigId: string): Promise<GigWithCreator & {
  quote: Quote | null;
  invoice: Invoice | null;
  formalInvoice: FormalInvoice | null;
}> {
  const supabase = getSupabase();

  // Fetch gig with creator name
  const { data: gig, error } = await supabase
    .from('gigs')
    .select('*, profiles!gigs_created_by_fkey(name)')
    .eq('id', gigId)
    .single();

  if (error) { checkAuthError(error); throw error; }

  const creator = gig.profiles as { name: string } | null;
  const gigWithCreator: GigWithCreator = { ...gig, creator_name: creator?.name ?? 'Unknown' };

  // Fetch linked quote
  let quote: Quote | null = null;
  if (gig.quote_id) {
    const { data } = await supabase.from('quotes').select('*').eq('id', gig.quote_id).single();
    quote = data;
  }

  // Fetch linked simple invoice (via invoices.gig_id)
  let invoice: Invoice | null = null;
  const { data: inv } = await supabase.from('invoices').select('*').eq('gig_id', gigId).limit(1).maybeSingle();
  invoice = inv;

  // Fetch linked formal invoice
  let formalInvoice: FormalInvoice | null = null;
  if (gig.formal_invoice_id) {
    const { data } = await supabase.from('formal_invoices').select('*').eq('id', gig.formal_invoice_id).single();
    formalInvoice = data;
  }

  return { ...gigWithCreator, quote, invoice, formalInvoice };
}

export async function getPublicMedia(): Promise<PublicMedia[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('public_media')
    .select('*')
    .eq('visible', true)
    .order('sort_order')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// ─── Media Management (auth required) ────────────────────

export async function createMediaEntry(entry: {
  media_type: 'photo' | 'video';
  url: string;
  title?: string;
  description?: string;
  thumbnail_url?: string;
  video_embed_url?: string;
  date_taken?: string | null;
  location?: string;
  sort_order?: number;
}): Promise<PublicMedia> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('public_media')
    .insert({
      media_type: entry.media_type,
      url: entry.url,
      title: entry.title ?? '',
      description: entry.description ?? '',
      thumbnail_url: entry.thumbnail_url ?? '',
      video_embed_url: entry.video_embed_url ?? '',
      date_taken: entry.date_taken ?? null,
      location: entry.location ?? '',
      sort_order: entry.sort_order ?? 0,
      visible: true,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) { checkAuthError(error); throw error; }
  return data;
}

export async function updateMediaEntry(
  id: string,
  updates: Partial<Pick<PublicMedia, 'title' | 'description' | 'visible' | 'sort_order' | 'location' | 'url' | 'thumbnail_url' | 'video_embed_url'>>,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('public_media').update(updates).eq('id', id);
  if (error) { checkAuthError(error); throw error; }
}

export async function deleteMediaEntry(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('public_media').delete().eq('id', id);
  if (error) { checkAuthError(error); throw error; }
}

export async function getAllMedia(): Promise<PublicMedia[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('public_media')
    .select('*')
    .order('sort_order')
    .order('created_at', { ascending: false });

  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

// ─── Profile Management ─────────────────────────────────

export async function updateProfile(updates: {
  name?: string;
  band_role?: string;
  avatar_url?: string;
}): Promise<void> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);

  if (error) { checkAuthError(error); throw error; }
}

// ─── Contact Submissions ─────────────────────────────────

export async function submitContactForm(form: {
  name: string;
  email: string;
  event_type?: string;
  preferred_date?: string;
  message: string;
}): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('contact_submissions')
    .insert({
      name: form.name,
      email: form.email,
      event_type: form.event_type ?? '',
      preferred_date: form.preferred_date || null,
      message: form.message,
    });

  if (error) throw error;
}

export async function getContactSubmissions(): Promise<ContactSubmission[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('contact_submissions')
    .select('*')
    .eq('archived', false)
    .order('created_at', { ascending: false });

  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function markSubmissionRead(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('contact_submissions')
    .update({ read: true })
    .eq('id', id);

  if (error) { checkAuthError(error); throw error; }
}

export async function archiveSubmission(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('contact_submissions')
    .update({ archived: true })
    .eq('id', id);

  if (error) { checkAuthError(error); throw error; }
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Clients ───────────────────────────────────────────

export async function getClients(): Promise<Client[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('company_name');
  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function getClient(id: string): Promise<Client | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single();
  if (error) { checkAuthError(error); throw error; }
  return data;
}

export async function createClient(client: {
  company_name: string;
  contact_name?: string;
  address?: string;
  email?: string;
  phone?: string;
}): Promise<Client> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('clients')
    .insert({
      company_name: client.company_name,
      contact_name: client.contact_name ?? '',
      address: client.address ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) { checkAuthError(error); throw error; }
  return data;
}

export async function updateClient(
  id: string,
  updates: Partial<Pick<Client, 'company_name' | 'contact_name' | 'address' | 'email' | 'phone'>>,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('clients').update(updates).eq('id', id);
  if (error) { checkAuthError(error); throw error; }
}

export async function deleteClient(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) { checkAuthError(error); throw error; }
}

export async function searchClients(query: string): Promise<Client[]> {
  const supabase = getSupabase();
  // Sanitise query to prevent PostgREST filter injection
  const safe = query.replace(/[%_(),.*]/g, '');
  if (!safe) return [];
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .or(`company_name.ilike.%${safe}%,contact_name.ilike.%${safe}%`)
    .order('company_name');
  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

// ─── Venues ────────────────────────────────────────────

export async function getVenues(): Promise<Venue[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .order('venue_name');
  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function getVenue(id: string): Promise<Venue | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .eq('id', id)
    .single();
  if (error?.code === 'PGRST116') return null;
  if (error) { checkAuthError(error); throw error; }
  return data;
}

export async function searchVenues(query: string): Promise<Venue[]> {
  const supabase = getSupabase();
  const safe = query.replace(/[%_(),.*]/g, '');
  if (!safe) return [];
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .or(`venue_name.ilike.%${safe}%,address.ilike.%${safe}%,postcode.ilike.%${safe}%`)
    .order('venue_name');
  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

/**
 * Create a venue.
 * New signature: createVenue({ venue_name, address?, postcode? })
 * Legacy compat: createVenue(ignoredClientId, venueName, address?)
 */
export async function createVenue(
  venueOrClientId: { venue_name: string; address?: string; postcode?: string; contact_name?: string; email?: string; phone?: string } | string,
  venueName?: string,
  address?: string,
): Promise<Venue> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Support legacy positional args: createVenue(clientId, name, address?)
  const name = typeof venueOrClientId === 'string' ? (venueName ?? '') : venueOrClientId.venue_name;
  const addr = typeof venueOrClientId === 'string' ? (address ?? '') : (venueOrClientId.address ?? '');
  const pc = typeof venueOrClientId === 'string' ? '' : (venueOrClientId.postcode ?? '');
  const cn = typeof venueOrClientId === 'string' ? '' : (venueOrClientId.contact_name ?? '');
  const em = typeof venueOrClientId === 'string' ? '' : (venueOrClientId.email ?? '');
  const ph = typeof venueOrClientId === 'string' ? '' : (venueOrClientId.phone ?? '');

  const { data, error } = await supabase
    .from('venues')
    .insert({
      venue_name: name,
      address: addr,
      postcode: pc,
      contact_name: cn,
      email: em,
      phone: ph,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) { checkAuthError(error); throw error; }
  return data;
}

export async function updateVenue(
  id: string,
  updates: Partial<Pick<Venue, 'venue_name' | 'address' | 'postcode' | 'email' | 'phone' | 'contact_name' | 'rating_atmosphere' | 'rating_crowd' | 'rating_stage' | 'rating_parking' | 'notes'>>,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('venues').update(updates).eq('id', id);
  if (error) { checkAuthError(error); throw error; }
}

export async function deleteVenue(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('venues').delete().eq('id', id);
  if (error) { checkAuthError(error); throw error; }
}


// ─── Venue Photos ──────────────────────────────────────

export async function getVenuePhotos(venueId: string): Promise<VenuePhoto[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('venue_photos')
    .select('*')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false });
  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function uploadVenuePhoto(venueId: string, fileUrl: string, storagePath: string, caption?: string): Promise<VenuePhoto> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('venue_photos')
    .insert({
      venue_id: venueId,
      file_url: fileUrl,
      storage_path: storagePath,
      caption: caption ?? '',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) { checkAuthError(error); throw error; }
  return data;
}

export async function deleteVenuePhoto(id: string, storagePath: string): Promise<void> {
  const supabase = getSupabase();
  // Delete from storage first
  if (storagePath) {
    await supabase.storage.from('venue-photos').remove([storagePath]);
  }
  const { error } = await supabase.from('venue_photos').delete().eq('id', id);
  if (error) { checkAuthError(error); throw error; }
}

// ─── Invoices ──────────────────────────────────────────

function formatInvoiceNumber(num: number): string {
  return `TGT-${String(num).padStart(4, '0')}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysISO(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mapInvoiceRow(row: any): InvoiceWithClient {
  return {
    ...row,
    client_company_name: row.clients?.company_name ?? '',
    client_contact_name: row.clients?.contact_name ?? '',
    client_address: row.clients?.address ?? '',
    client_email: row.clients?.email ?? '',
    venue_name: row.venues?.venue_name ?? row.venue ?? '',
    venue_address: row.venues?.address ?? '',
    venue_email: row.venues?.email ?? '',
    venue_phone: row.venues?.phone ?? '',
    venue_contact_name: row.venues?.contact_name ?? '',
    clients: undefined,
    venues: undefined,
  };
}

const INVOICE_SELECT = '*, clients!invoices_client_id_fkey(company_name, contact_name, address, email), venues!invoices_venue_id_fkey(venue_name, address, email, phone, contact_name)';

export async function getInvoices(): Promise<InvoiceWithClient[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('invoices')
    .select(INVOICE_SELECT)
    .order('created_at', { ascending: false });

  if (error) { checkAuthError(error); throw error; }

  return (data ?? []).map(mapInvoiceRow);
}

export async function getInvoice(id: string): Promise<InvoiceWithClient | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('invoices')
    .select(INVOICE_SELECT)
    .eq('id', id)
    .single();

  if (error) { checkAuthError(error); throw error; }
  if (!data) return null;

  return mapInvoiceRow(data);
}

export async function getInvoiceByGigId(gigId: string): Promise<InvoiceWithClient | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('invoices')
    .select(INVOICE_SELECT)
    .eq('gig_id', gigId)
    .maybeSingle();

  if (error) { checkAuthError(error); throw error; }
  if (!data) return null;

  return mapInvoiceRow(data);
}

export async function createInvoice(inv: {
  client_id?: string | null;
  venue: string;
  venue_id?: string | null;
  gig_id?: string | null;
  gig_date: string;
  amount: number;
  description: string;
  style?: InvoiceStyle;
}): Promise<Invoice> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Atomic invoice number via RPC
  const { data: nextNum, error: rpcError } = await supabase.rpc('next_invoice_number');
  if (rpcError) { checkAuthError(rpcError); throw rpcError; }

  const invoiceNumber = formatInvoiceNumber(nextNum);
  const issueDate = todayISO();
  const bandSettings = await getBandSettings();
  const dueDate = addDaysISO(issueDate, bandSettings?.payment_terms_days ?? 14);

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      invoice_number: invoiceNumber,
      client_id: inv.client_id ?? null,
      venue_id: inv.venue_id ?? null,
      gig_id: inv.gig_id ?? null,
      venue: inv.venue,
      gig_date: inv.gig_date,
      amount: inv.amount,
      description: inv.description,
      issue_date: issueDate,
      due_date: dueDate,
      style: inv.style ?? 'classic',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) { checkAuthError(error); throw error; }
  return data;
}

export async function updateInvoice(
  id: string,
  updates: Partial<Pick<Invoice, 'venue' | 'venue_id' | 'client_id' | 'gig_id' | 'gig_date' | 'amount' | 'description' | 'due_date' | 'style'>>,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('invoices').update(updates).eq('id', id);
  if (error) { checkAuthError(error); throw error; }
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus): Promise<void> {
  const supabase = getSupabase();
  const updates: Record<string, unknown> = { status };
  if (status === 'paid') updates.paid_date = todayISO();
  else updates.paid_date = null;

  const { error } = await supabase.from('invoices').update(updates).eq('id', id);
  if (error) { checkAuthError(error); throw error; }
}

export async function deleteInvoice(id: string): Promise<void> {
  const supabase = getSupabase();
  // Receipts cascade-delete via FK
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) { checkAuthError(error); throw error; }
}

// ─── Receipts ──────────────────────────────────────────

export async function getReceiptsForInvoice(invoiceId: string): Promise<ReceiptWithMember[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('receipts')
    .select('*, profiles!receipts_member_id_fkey(name)')
    .eq('invoice_id', invoiceId)
    .order('created_at');

  if (error) { checkAuthError(error); throw error; }

  return (data ?? []).map((row: any) => ({
    ...row,
    member_name: row.profiles?.name ?? 'Unknown',
    profiles: undefined,
  }));
}

/**
 * Mark invoice as paid and generate receipts for each non-admin band member.
 * Splits the amount equally among all profiles (band members).
 * Idempotent: returns existing receipts if already generated.
 */
export async function markInvoicePaid(invoiceId: string): Promise<ReceiptWithMember[]> {
  const supabase = getSupabase();

  // Idempotent guard
  const existing = await getReceiptsForInvoice(invoiceId);
  if (existing.length > 0) {
    await updateInvoiceStatus(invoiceId, 'paid');
    return existing;
  }

  const invoice = await getInvoice(invoiceId);
  if (!invoice) throw new Error('Invoice not found');

  const allMembers = await getProfiles();
  if (allMembers.length === 0) throw new Error('No profiles found — cannot split receipt');
  // The "self" is the admin; receipts go to non-admin members
  const otherMembers = allMembers.filter(m => !m.is_admin);
  const perPerson = Math.round((invoice.amount / allMembers.length) * 100) / 100;
  const remainder = Math.round((invoice.amount - perPerson * allMembers.length) * 100) / 100;
  const today = todayISO();

  // Mark paid first
  await updateInvoiceStatus(invoiceId, 'paid');

  // Generate receipts
  const receiptInserts = otherMembers.map((member, i) => ({
    invoice_id: invoiceId,
    member_id: member.id,
    amount: i === 0 ? perPerson + remainder : perPerson,
    date: today,
  }));

  const { data, error } = await supabase
    .from('receipts')
    .insert(receiptInserts)
    .select('*, profiles!receipts_member_id_fkey(name)');

  if (error) { checkAuthError(error); throw error; }

  return (data ?? []).map((row: any) => ({
    ...row,
    member_name: row.profiles?.name ?? 'Unknown',
    profiles: undefined,
  }));
}

// ─── User Settings ─────────────────────────────────────

export async function getUserSettings(): Promise<UserSettings | null> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error?.code === 'PGRST116') return null; // No row found
  if (error) { checkAuthError(error); throw error; }
  return data;
}

export async function upsertUserSettings(
  settings: Partial<Omit<UserSettings, 'id' | 'updated_at'>>,
): Promise<void> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('user_settings')
    .upsert({ id: user.id, ...settings, updated_at: new Date().toISOString() });

  if (error) { checkAuthError(error); throw error; }
}

// ─── Band Settings ─────────────────────────────────────

export async function getBandSettings(): Promise<BandSettings | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('band_settings')
    .select('*')
    .eq('id', 'default')
    .single();

  if (error?.code === 'PGRST116') return null;
  if (error) { checkAuthError(error); throw error; }
  return data;
}

export async function updateBandSettings(
  updates: Partial<Pick<BandSettings, 'trading_as' | 'business_type' | 'website' | 'payment_terms_days'>>,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('band_settings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', 'default');

  if (error) { checkAuthError(error); throw error; }
}

// ─── Dashboard Stats ───────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = getSupabase();

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select(INVOICE_SELECT)
    .order('created_at', { ascending: false });

  if (error) { checkAuthError(error); throw error; }

  const all = invoices ?? [];
  const totalInvoiced = all.reduce((sum: number, i: any) => sum + Number(i.amount), 0);
  const totalPaid = all.filter((i: any) => i.status === 'paid').reduce((sum: number, i: any) => sum + Number(i.amount), 0);
  const totalOutstanding = all.filter((i: any) => i.status === 'sent').reduce((sum: number, i: any) => sum + Number(i.amount), 0);

  const recentInvoices: InvoiceWithClient[] = all.slice(0, 5).map(mapInvoiceRow);

  return {
    totalInvoiced,
    totalPaid,
    totalOutstanding,
    invoiceCount: all.length,
    recentInvoices,
  };
}

// ─── Service Catalogue ──────────────────────────────────

export async function getServiceCatalogue(): Promise<ServiceCatalogueItem[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('service_catalogue')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function getAllServiceCatalogue(): Promise<ServiceCatalogueItem[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('service_catalogue')
    .select('*')
    .order('sort_order');
  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function createServiceItem(item: {
  name: string;
  description?: string;
  default_price: number;
  unit_label?: string | null;
  sort_order?: number;
}): Promise<ServiceCatalogueItem> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('service_catalogue')
    .insert({
      name: item.name,
      description: item.description ?? '',
      default_price: item.default_price,
      unit_label: item.unit_label ?? null,
      sort_order: item.sort_order ?? 0,
    })
    .select()
    .single();
  if (error) { checkAuthError(error); throw error; }
  return data;
}

export async function updateServiceItem(
  id: string,
  updates: Partial<Pick<ServiceCatalogueItem, 'name' | 'description' | 'default_price' | 'unit_label' | 'sort_order' | 'is_active'>>,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('service_catalogue').update(updates).eq('id', id);
  if (error) { checkAuthError(error); throw error; }
}

export async function deleteServiceItem(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('service_catalogue').delete().eq('id', id);
  if (error) { checkAuthError(error); throw error; }
}

// ─── Quotes ─────────────────────────────────────────────

function formatQuoteNumber(num: number): string {
  return `QTE-${String(num).padStart(3, '0')}`;
}

function mapQuoteRow(row: any): QuoteWithClient {
  return {
    ...row,
    client_company_name: row.clients?.company_name ?? '',
    client_contact_name: row.clients?.contact_name ?? '',
    client_address: row.clients?.address ?? '',
    client_email: row.clients?.email ?? '',
    client_phone: row.clients?.phone ?? '',
    venue_email: row.venues?.email ?? '',
    venue_phone: row.venues?.phone ?? '',
    venue_contact_name: row.venues?.contact_name ?? '',
    clients: undefined,
    venues: undefined,
  };
}

const QUOTE_SELECT = '*, clients!quotes_client_id_fkey(company_name, contact_name, address, email, phone), venues!quotes_venue_id_fkey(venue_name, address, email, phone, contact_name)';

export async function getQuotes(): Promise<QuoteWithClient[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('quotes')
    .select(QUOTE_SELECT)
    .order('created_at', { ascending: false });

  if (error) { checkAuthError(error); throw error; }

  return (data ?? []).map(mapQuoteRow);
}

export async function getQuote(id: string): Promise<QuoteWithClient | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('quotes')
    .select(QUOTE_SELECT)
    .eq('id', id)
    .single();

  if (error) { checkAuthError(error); throw error; }
  if (!data) return null;

  return mapQuoteRow(data);
}

export async function createQuote(q: {
  client_id?: string | null;
  venue_id?: string | null;
  event_type: EventType;
  event_date: string;
  venue_name: string;
  venue_address?: string;
  subtotal: number;
  discount_amount?: number;
  total: number;
  pli_option?: PLIOption;
  terms_and_conditions?: string;
  validity_days?: number;
  notes?: string;
  style?: InvoiceStyle;
  line_items: Array<{
    service_id?: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    sort_order?: number;
  }>;
}): Promise<Quote> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Atomic quote number via RPC
  const { data: nextNum, error: rpcError } = await supabase.rpc('next_quote_number');
  if (rpcError) { checkAuthError(rpcError); throw rpcError; }

  const quoteNumber = formatQuoteNumber(nextNum);

  const { data, error } = await supabase
    .from('quotes')
    .insert({
      quote_number: quoteNumber,
      client_id: q.client_id ?? null,
      venue_id: q.venue_id ?? null,
      created_by: user.id,
      event_type: q.event_type,
      event_date: q.event_date,
      venue_name: q.venue_name,
      venue_address: q.venue_address ?? '',
      subtotal: q.subtotal,
      discount_amount: q.discount_amount ?? 0,
      total: q.total,
      pli_option: q.pli_option ?? 'none',
      terms_and_conditions: q.terms_and_conditions ?? '',
      validity_days: q.validity_days ?? 30,
      notes: q.notes ?? '',
      style: q.style ?? 'classic',
    })
    .select()
    .single();

  if (error) { checkAuthError(error); throw error; }

  // Insert line items
  if (q.line_items.length > 0) {
    const lineInserts = q.line_items.map((li, i) => ({
      quote_id: data.id,
      service_id: li.service_id ?? null,
      description: li.description,
      quantity: li.quantity,
      unit_price: li.unit_price,
      line_total: li.line_total,
      sort_order: li.sort_order ?? i,
    }));

    const { error: liError } = await supabase
      .from('quote_line_items')
      .insert(lineInserts);

    if (liError) { checkAuthError(liError); throw liError; }
  }

  return data;
}

export async function updateQuote(
  id: string,
  updates: Partial<Pick<Quote, 'venue_id' | 'event_type' | 'event_date' | 'venue_name' | 'venue_address' | 'subtotal' | 'discount_amount' | 'total' | 'pli_option' | 'terms_and_conditions' | 'validity_days' | 'notes' | 'style'>>,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('quotes').update(updates).eq('id', id);
  if (error) { checkAuthError(error); throw error; }
}

export async function deleteQuote(id: string): Promise<void> {
  const supabase = getSupabase();
  // Line items cascade-delete via FK
  const { error } = await supabase.from('quotes').delete().eq('id', id);
  if (error) { checkAuthError(error); throw error; }
}

// ─── Quote Line Items ───────────────────────────────────

export async function getQuoteLineItems(quoteId: string): Promise<QuoteLineItem[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('quote_line_items')
    .select('*')
    .eq('quote_id', quoteId)
    .order('sort_order');
  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function replaceQuoteLineItems(
  quoteId: string,
  items: Array<{
    service_id?: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    sort_order?: number;
  }>,
): Promise<void> {
  const supabase = getSupabase();

  // Delete existing line items
  const { error: delError } = await supabase
    .from('quote_line_items')
    .delete()
    .eq('quote_id', quoteId);
  if (delError) { checkAuthError(delError); throw delError; }

  // Insert new line items
  if (items.length > 0) {
    const inserts = items.map((li, i) => ({
      quote_id: quoteId,
      service_id: li.service_id ?? null,
      description: li.description,
      quantity: li.quantity,
      unit_price: li.unit_price,
      line_total: li.line_total,
      sort_order: li.sort_order ?? i,
    }));

    const { error: insError } = await supabase
      .from('quote_line_items')
      .insert(inserts);
    if (insError) { checkAuthError(insError); throw insError; }
  }
}

// ─── Quote Lifecycle ────────────────────────────────────

export async function sendQuote(quoteId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('quotes')
    .update({ status: 'sent' as QuoteStatus, sent_at: new Date().toISOString() })
    .eq('id', quoteId);
  if (error) { checkAuthError(error); throw error; }
}

export async function acceptQuote(quoteId: string): Promise<FormalInvoice> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Mark quote as accepted
  const { error: qErr } = await supabase
    .from('quotes')
    .update({ status: 'accepted' as QuoteStatus, responded_at: new Date().toISOString() })
    .eq('id', quoteId);
  if (qErr) { checkAuthError(qErr); throw qErr; }

  // Fetch the quote
  const quote = await getQuote(quoteId);
  if (!quote) throw new Error('Quote not found');

  // Fetch quote line items
  const lineItems = await getQuoteLineItems(quoteId);

  // Generate formal invoice number (shared sequence with simple invoices)
  const { data: nextNum, error: rpcError } = await supabase.rpc('next_invoice_number');
  if (rpcError) { checkAuthError(rpcError); throw rpcError; }

  const invoiceNumber = `TGT-${String(nextNum).padStart(4, '0')}`;
  const issueDate = todayISO();
  const bandSettings = await getBandSettings();
  const dueDate = addDaysISO(issueDate, bandSettings?.payment_terms_days ?? 14);

  // Create formal invoice
  const { data: invoice, error: invError } = await supabase
    .from('formal_invoices')
    .insert({
      invoice_number: invoiceNumber,
      quote_id: quoteId,
      client_id: quote.client_id,
      venue_id: quote.venue_id ?? null,
      created_by: user.id,
      venue_name: quote.venue_name,
      event_date: quote.event_date,
      subtotal: quote.subtotal,
      discount_amount: quote.discount_amount,
      total: quote.total,
      issue_date: issueDate,
      due_date: dueDate,
      style: quote.style,
      notes: quote.notes,
    })
    .select()
    .single();

  if (invError) { checkAuthError(invError); throw invError; }

  // Copy line items to formal invoice
  if (lineItems.length > 0) {
    const formalLineItems = lineItems.map(li => ({
      invoice_id: invoice.id,
      description: li.description,
      quantity: li.quantity,
      unit_price: li.unit_price,
      line_total: li.line_total,
      sort_order: li.sort_order,
    }));

    const { error: liErr } = await supabase
      .from('formal_invoice_line_items')
      .insert(formalLineItems);
    if (liErr) { checkAuthError(liErr); throw liErr; }
  }

  return invoice;
}

export async function declineQuote(quoteId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('quotes')
    .update({ status: 'declined' as QuoteStatus, responded_at: new Date().toISOString() })
    .eq('id', quoteId);
  if (error) { checkAuthError(error); throw error; }
}

export async function expireQuote(quoteId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('quotes')
    .update({ status: 'expired' as QuoteStatus })
    .eq('id', quoteId);
  if (error) { checkAuthError(error); throw error; }
}

// ─── Formal Invoices ────────────────────────────────────

function mapFormalInvoiceRow(row: any): FormalInvoiceWithClient {
  return {
    ...row,
    client_company_name: row.clients?.company_name ?? '',
    client_contact_name: row.clients?.contact_name ?? '',
    client_address: row.clients?.address ?? '',
    client_email: row.clients?.email ?? '',
    venue_email: row.venues?.email ?? '',
    venue_phone: row.venues?.phone ?? '',
    venue_contact_name: row.venues?.contact_name ?? '',
    clients: undefined,
    venues: undefined,
  };
}

const FORMAL_INVOICE_SELECT = '*, clients!formal_invoices_client_id_fkey(company_name, contact_name, address, email), venues!formal_invoices_venue_id_fkey(venue_name, address, email, phone, contact_name)';

export async function getFormalInvoice(id: string): Promise<FormalInvoiceWithClient | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('formal_invoices')
    .select(FORMAL_INVOICE_SELECT)
    .eq('id', id)
    .single();

  if (error) { checkAuthError(error); throw error; }
  if (!data) return null;

  return mapFormalInvoiceRow(data);
}

export async function getFormalInvoiceByQuote(quoteId: string): Promise<FormalInvoiceWithClient | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('formal_invoices')
    .select(FORMAL_INVOICE_SELECT)
    .eq('quote_id', quoteId)
    .maybeSingle();

  if (error) { checkAuthError(error); throw error; }
  if (!data) return null;

  return mapFormalInvoiceRow(data);
}

export async function getFormalInvoiceLineItems(invoiceId: string): Promise<FormalInvoiceLineItem[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('formal_invoice_line_items')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('sort_order');
  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function sendFormalInvoice(invoiceId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('formal_invoices')
    .update({ status: 'sent' as InvoiceStatus })
    .eq('id', invoiceId);
  if (error) { checkAuthError(error); throw error; }
}

export async function markFormalInvoicePaid(invoiceId: string): Promise<FormalReceiptWithMember[]> {
  const supabase = getSupabase();

  // Idempotent guard
  const existing = await getFormalReceipts(invoiceId);
  if (existing.length > 0) {
    await supabase
      .from('formal_invoices')
      .update({ status: 'paid' as InvoiceStatus, paid_date: todayISO() })
      .eq('id', invoiceId);
    return existing;
  }

  const invoice = await getFormalInvoice(invoiceId);
  if (!invoice) throw new Error('Formal invoice not found');

  const allMembers = await getProfiles();
  if (allMembers.length === 0) throw new Error('No profiles found — cannot split receipt');
  const otherMembers = allMembers.filter(m => !m.is_admin);
  const perPerson = Math.round((invoice.total / allMembers.length) * 100) / 100;
  const remainder = Math.round((invoice.total - perPerson * allMembers.length) * 100) / 100;
  const today = todayISO();

  // Mark paid
  const { error: updErr } = await supabase
    .from('formal_invoices')
    .update({ status: 'paid' as InvoiceStatus, paid_date: today })
    .eq('id', invoiceId);
  if (updErr) { checkAuthError(updErr); throw updErr; }

  // Generate receipts
  const receiptInserts = otherMembers.map((member, i) => ({
    invoice_id: invoiceId,
    member_id: member.id,
    amount: i === 0 ? perPerson + remainder : perPerson,
    date: today,
  }));

  const { data, error } = await supabase
    .from('formal_receipts')
    .insert(receiptInserts)
    .select('*, profiles!formal_receipts_member_id_fkey(name)');

  if (error) { checkAuthError(error); throw error; }

  return (data ?? []).map((row: any) => ({
    ...row,
    member_name: row.profiles?.name ?? 'Unknown',
    profiles: undefined,
  }));
}

// ─── Formal Receipts ────────────────────────────────────

export async function getFormalReceipts(invoiceId: string): Promise<FormalReceiptWithMember[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('formal_receipts')
    .select('*, profiles!formal_receipts_member_id_fkey(name)')
    .eq('invoice_id', invoiceId)
    .order('created_at');

  if (error) { checkAuthError(error); throw error; }

  return (data ?? []).map((row: any) => ({
    ...row,
    member_name: row.profiles?.name ?? 'Unknown',
    profiles: undefined,
  }));
}

// ─── Band Settings (extended) ───────────────────────────

export async function updateBandSettingsExtended(
  updates: Partial<Pick<BandSettings, 'trading_as' | 'business_type' | 'website' | 'payment_terms_days' | 'pli_insurer' | 'pli_policy_number' | 'pli_cover_amount' | 'pli_expiry_date' | 'default_terms_and_conditions' | 'default_quote_validity_days' | 'cancellation_threshold_days'>>,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('band_settings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', 'default');

  if (error) { checkAuthError(error); throw error; }
}

// ─── Site Content (Editable Website Text) ───────────────

export async function getSiteContent(): Promise<SiteContent[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('site_content')
    .select('*');

  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function upsertSiteContent(key: string, value: string): Promise<void> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('site_content')
    .upsert(
      { key, value, updated_at: new Date().toISOString(), updated_by: user.id },
      { onConflict: 'key' },
    );

  if (error) { checkAuthError(error); throw error; }
}

// ─── Site Reviews ───────────────────────────────────────

export async function getPublicReviews(): Promise<SiteReview[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('site_reviews')
    .select('*')
    .eq('visible', true)
    .order('sort_order');

  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function getAllReviews(): Promise<SiteReview[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('site_reviews')
    .select('*')
    .order('sort_order');

  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function createReview(review: {
  author_name: string;
  review_text: string;
  rating: number;
  source: string;
  source_url?: string | null;
  review_date?: string | null;
  sort_order?: number;
}): Promise<void> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('site_reviews')
    .insert({ ...review, created_by: user.id });

  if (error) { checkAuthError(error); throw error; }
}

export async function updateReview(
  id: string,
  updates: Partial<Pick<SiteReview, 'author_name' | 'review_text' | 'rating' | 'source' | 'source_url' | 'review_date' | 'visible' | 'sort_order'>>,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('site_reviews')
    .update(updates)
    .eq('id', id);

  if (error) { checkAuthError(error); throw error; }
}

export async function deleteReview(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('site_reviews')
    .delete()
    .eq('id', id);

  if (error) { checkAuthError(error); throw error; }
}

// ─── Bill-To Resolution ─────────────────────────────────

/**
 * Resolve the bill-to entity from an invoice/quote/formal invoice.
 * Priority: client (if present) > venue (fallback).
 * Works with any *WithClient row that has both client and venue fields joined.
 */
export function resolveBillTo(row: {
  client_id?: string | null;
  venue_id?: string | null;
  client_company_name?: string;
  client_contact_name?: string;
  client_address?: string;
  client_email?: string;
  client_phone?: string;
  venue_name?: string;
  venue_address?: string;
  venue_email?: string;
  venue_phone?: string;
  venue_contact_name?: string;
}): BillTo {
  if (row.client_id) {
    return {
      name: row.client_company_name ?? '',
      contact_name: row.client_contact_name ?? '',
      address: row.client_address ?? '',
      email: row.client_email ?? '',
      phone: row.client_phone ?? '',
    };
  }
  return {
    name: row.venue_name ?? '',
    contact_name: row.venue_contact_name ?? '',
    address: row.venue_address ?? '',
    email: row.venue_email ?? '',
    phone: row.venue_phone ?? '',
  };
}

// ─── Songs ──────────────────────────────────────────────

export async function getSongs(): Promise<Song[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .order('name');

  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function getSong(id: string): Promise<Song | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    checkAuthError(error);
    throw error;
  }
  return data;
}

export async function searchSongs(query: string): Promise<Song[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .or(`name.ilike.%${query}%,artist.ilike.%${query}%`)
    .order('name')
    .limit(20);

  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function getSongsByCategory(category: SongCategory): Promise<Song[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .eq('category', category)
    .order('name');

  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function getSongsByOwner(ownerId: string): Promise<Song[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .eq('owner_id', ownerId)
    .order('name');

  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function createSong(song: {
  name: string;
  artist?: string;
  category?: SongCategory;
  owner_id?: string | null;
  bpm?: number;
  time_signature_top?: number;
  time_signature_bottom?: number;
  subdivision?: number;
  swing_percent?: number;
  accent_pattern?: string | null;
  click_sound?: ClickSound;
  count_in_bars?: number;
  duration_seconds?: number | null;
  key?: string;
  notes?: string;
  lyrics?: string;
  chords?: string;
  drum_notation?: string;
  beat_offset_ms?: number;
  audio_url?: string | null;
  audio_storage_path?: string | null;
  performance_tag?: string | null;
  set_bucket?: string | null;
  bucket_position?: number | null;
}): Promise<Song> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('songs')
    .insert({ ...song, created_by: user.id })
    .select()
    .single();

  if (error) { checkAuthError(error); throw error; }
  return data;
}

export async function updateSong(
  id: string,
  updates: Partial<Omit<Song, 'id' | 'created_by' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('songs')
    .update(updates)
    .eq('id', id);

  if (error) { checkAuthError(error); throw error; }
}

export async function deleteSong(id: string): Promise<void> {
  const supabase = getSupabase();

  // Delete practice track from storage if present
  const song = await getSong(id);
  if (song?.audio_storage_path) {
    await supabase.storage.from('practice-tracks').remove([song.audio_storage_path]);
  }

  // Delete all stems from storage (DB rows cascade via FK)
  const stems = await getSongStems(id);
  if (stems.length > 0) {
    await supabase.storage.from('song-stems').remove(stems.map(s => s.storage_path));
  }

  const { error } = await supabase
    .from('songs')
    .delete()
    .eq('id', id);

  if (error) { checkAuthError(error); throw error; }
}

export async function uploadPracticeTrack(
  songId: string,
  fileName: string,
  fileBody: Blob | ArrayBuffer,
  contentType: string = 'audio/mpeg',
): Promise<string> {
  const supabase = getSupabase();
  const storagePath = `${songId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('practice-tracks')
    .upload(storagePath, fileBody, { contentType, upsert: true });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('practice-tracks')
    .getPublicUrl(storagePath);

  // Update song with audio URL
  await updateSong(songId, {
    audio_url: urlData.publicUrl,
    audio_storage_path: storagePath,
  });

  return urlData.publicUrl;
}

export async function deletePracticeTrack(songId: string): Promise<void> {
  const song = await getSong(songId);
  if (!song?.audio_storage_path) return;

  const supabase = getSupabase();
  await supabase.storage.from('practice-tracks').remove([song.audio_storage_path]);
  await updateSong(songId, { audio_url: null, audio_storage_path: null });
}

// ─── Song Stems ─────────────────────────────────────────

export async function getSongStems(songId: string): Promise<SongStem[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('song_stems')
    .select('*')
    .eq('song_id', songId)
    .order('label');

  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function uploadStem(
  songId: string,
  label: StemLabel,
  fileName: string,
  fileBody: Blob | ArrayBuffer,
  contentType: string = 'audio/mpeg',
): Promise<SongStem> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const ext = fileName.split('.').pop() ?? 'mp3';
  const storagePath = `${songId}/${label}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('song-stems')
    .upload(storagePath, fileBody, { contentType, upsert: false });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('song-stems')
    .getPublicUrl(storagePath);

  const { data, error } = await supabase
    .from('song_stems')
    .insert({ song_id: songId, label, audio_url: urlData.publicUrl, storage_path: storagePath, created_by: user.id })
    .select()
    .single();

  if (error) {
    // Roll back storage upload on DB failure
    await supabase.storage.from('song-stems').remove([storagePath]);
    checkAuthError(error);
    throw error;
  }

  return data;
}

export async function deleteStem(stemId: string): Promise<void> {
  const supabase = getSupabase();

  const { data: stem } = await supabase
    .from('song_stems')
    .select('storage_path')
    .eq('id', stemId)
    .single();

  if (stem?.storage_path) {
    await supabase.storage.from('song-stems').remove([stem.storage_path]);
  }

  const { error } = await supabase
    .from('song_stems')
    .delete()
    .eq('id', stemId);

  if (error) { checkAuthError(error); throw error; }
}

// ─── Beat Maps ──────────────────────────────────────────

export async function getBeatMap(songId: string): Promise<BeatMap | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('beat_maps')
    .select('*')
    .eq('song_id', songId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    checkAuthError(error);
    throw error;
  }
  return data;
}

export async function upsertBeatMap(
  songId: string,
  update: { beats?: number[]; bpm?: number; status?: string; error?: string | null },
): Promise<BeatMap> {
  const supabase = getSupabase();

  // Try update first (most common — row already exists from 'pending' insert)
  const { data: existing } = await supabase
    .from('beat_maps')
    .select('id')
    .eq('song_id', songId)
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from('beat_maps')
      .update(update)
      .eq('song_id', songId)
      .select()
      .single();
    if (error) { checkAuthError(error); throw error; }
    return data;
  }

  // Insert new
  const { data, error } = await supabase
    .from('beat_maps')
    .insert({ song_id: songId, ...update })
    .select()
    .single();
  if (error) { checkAuthError(error); throw error; }
  return data;
}

// ─── Setlists ───────────────────────────────────────────

export async function getSetlists(): Promise<Setlist[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('setlists')
    .select('*')
    .order('name');

  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function getSetlist(id: string): Promise<Setlist | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('setlists')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    checkAuthError(error);
    throw error;
  }
  return data;
}

export async function getSetlistsByType(type: SetlistType): Promise<Setlist[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('setlists')
    .select('*')
    .eq('setlist_type', type)
    .order('name');

  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function createSetlist(setlist: {
  name: string;
  description?: string;
  notes?: string;
  setlist_type?: SetlistType;
  band_name?: string;
}): Promise<Setlist> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('setlists')
    .insert({ ...setlist, created_by: user.id })
    .select()
    .single();

  if (error) { checkAuthError(error); throw error; }
  return data;
}

export async function updateSetlist(
  id: string,
  updates: Partial<Pick<Setlist, 'name' | 'description' | 'notes' | 'setlist_type' | 'band_name'>>,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('setlists')
    .update(updates)
    .eq('id', id);

  if (error) { checkAuthError(error); throw error; }
}

export async function deleteSetlist(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('setlists')
    .delete()
    .eq('id', id);

  if (error) { checkAuthError(error); throw error; }
}

// ─── Setlist Songs ──────────────────────────────────────

interface SetlistSongJoin extends SetlistSong {
  songs: {
    name: string;
    artist: string;
    category: SongCategory;
    bpm: number;
    time_signature_top: number;
    time_signature_bottom: number;
    subdivision: number;
    swing_percent: number;
    accent_pattern: string | null;
    click_sound: ClickSound;
    count_in_bars: number;
    duration_seconds: number | null;
    key: string;
    notes: string;
    lyrics: string;
    chords: string;
    drum_notation: string;
    audio_url: string | null;
    performance_tag: string | null;
    set_bucket: string | null;
    bucket_position: number | null;
  } | null;
}

export async function getSetlistSongs(setlistId: string): Promise<SetlistSongWithDetails[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('setlist_songs')
    .select('*, songs(name, artist, category, bpm, time_signature_top, time_signature_bottom, subdivision, swing_percent, accent_pattern, click_sound, count_in_bars, duration_seconds, key, notes, lyrics, chords, drum_notation, audio_url, performance_tag, set_bucket, bucket_position)')
    .eq('setlist_id', setlistId)
    .order('position');

  if (error) { checkAuthError(error); throw error; }

  return (data ?? []).map((row: SetlistSongJoin) => ({
    ...row,
    song_name: row.songs?.name ?? '',
    song_artist: row.songs?.artist ?? '',
    song_category: (row.songs?.category ?? 'tange_cover') as SongCategory,
    song_bpm: row.songs?.bpm ?? 120,
    song_time_signature_top: row.songs?.time_signature_top ?? 4,
    song_time_signature_bottom: row.songs?.time_signature_bottom ?? 4,
    song_subdivision: row.songs?.subdivision ?? 1,
    song_swing_percent: row.songs?.swing_percent ?? 50,
    song_accent_pattern: row.songs?.accent_pattern ?? null,
    song_click_sound: (row.songs?.click_sound ?? 'default') as ClickSound,
    song_count_in_bars: row.songs?.count_in_bars ?? 1,
    song_duration_seconds: row.songs?.duration_seconds ?? null,
    song_key: row.songs?.key ?? '',
    song_notes: row.songs?.notes ?? '',
    song_lyrics: row.songs?.lyrics ?? '',
    song_chords: row.songs?.chords ?? '',
    song_drum_notation: row.songs?.drum_notation ?? '',
    song_audio_url: row.songs?.audio_url ?? null,
    song_performance_tag: row.songs?.performance_tag ?? null,
    song_set_bucket: row.songs?.set_bucket ?? null,
    song_bucket_position: row.songs?.bucket_position ?? null,
    songs: undefined,
  }));
}

export async function getSetlistWithSongs(id: string): Promise<SetlistWithSongs | null> {
  const setlist = await getSetlist(id);
  if (!setlist) return null;

  const songs = await getSetlistSongs(id);
  const totalDuration = songs.reduce((sum, s) => {
    return s.song_duration_seconds ? sum + s.song_duration_seconds : sum;
  }, 0);

  return {
    ...setlist,
    songs,
    total_duration_seconds: totalDuration > 0 ? totalDuration : null,
    song_count: songs.length,
  };
}

export async function setSetlistSongs(
  setlistId: string,
  songs: Array<{ song_id: string; position: number; notes?: string }>,
): Promise<SetlistSongWithDetails[]> {
  const supabase = getSupabase();

  // Delete existing songs for this setlist
  const { error: deleteError } = await supabase
    .from('setlist_songs')
    .delete()
    .eq('setlist_id', setlistId);

  if (deleteError) { checkAuthError(deleteError); throw deleteError; }

  if (songs.length === 0) return [];

  // Insert new songs
  const inserts = songs.map(s => ({
    setlist_id: setlistId,
    song_id: s.song_id,
    position: s.position,
    notes: s.notes ?? '',
  }));

  const { error: insertError } = await supabase
    .from('setlist_songs')
    .insert(inserts);

  if (insertError) { checkAuthError(insertError); throw insertError; }

  return getSetlistSongs(setlistId);
}

export async function addSongToSetlist(
  setlistId: string,
  songId: string,
  position: number,
  notes?: string,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('setlist_songs')
    .insert({
      setlist_id: setlistId,
      song_id: songId,
      position,
      notes: notes ?? '',
    });

  if (error) { checkAuthError(error); throw error; }
}

export async function removeSongFromSetlist(
  setlistId: string,
  setlistSongId: string,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('setlist_songs')
    .delete()
    .eq('id', setlistSongId)
    .eq('setlist_id', setlistId);

  if (error) { checkAuthError(error); throw error; }
}

// ─── Player Preferences ─────────────────────────────────

export interface PlayerPrefs {
  player_click_enabled: boolean;
  player_flash_enabled: boolean;
  player_lyrics_enabled: boolean;
  player_chords_enabled: boolean;
  player_notes_enabled: boolean;
  player_drums_enabled: boolean;
  player_vis_enabled: boolean;
}

const PLAYER_PREFS_DEFAULTS: PlayerPrefs = {
  player_click_enabled: true,
  player_flash_enabled: true,
  player_lyrics_enabled: true,
  player_chords_enabled: true,
  player_notes_enabled: true,
  player_drums_enabled: false,
  player_vis_enabled: true,
};

export async function getPlayerPrefs(): Promise<PlayerPrefs> {
  const settings = await getUserSettings();
  if (!settings) return PLAYER_PREFS_DEFAULTS;
  return {
    player_click_enabled: settings.player_click_enabled ?? PLAYER_PREFS_DEFAULTS.player_click_enabled,
    player_flash_enabled: settings.player_flash_enabled ?? PLAYER_PREFS_DEFAULTS.player_flash_enabled,
    player_lyrics_enabled: settings.player_lyrics_enabled ?? PLAYER_PREFS_DEFAULTS.player_lyrics_enabled,
    player_chords_enabled: settings.player_chords_enabled ?? PLAYER_PREFS_DEFAULTS.player_chords_enabled,
    player_notes_enabled: settings.player_notes_enabled ?? PLAYER_PREFS_DEFAULTS.player_notes_enabled,
    player_drums_enabled: settings.player_drums_enabled ?? PLAYER_PREFS_DEFAULTS.player_drums_enabled,
    player_vis_enabled: settings.player_vis_enabled ?? PLAYER_PREFS_DEFAULTS.player_vis_enabled,
  };
}

export async function updatePlayerPrefs(prefs: Partial<PlayerPrefs>): Promise<void> {
  await upsertUserSettings(prefs);
}

// ─── Song Sharing (D-135) ────────────────────────────────

export async function getSongShares(songId: string): Promise<SongShareWithProfile[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('song_shares')
    .select('*, profiles!song_shares_shared_with_fkey(name)')
    .eq('song_id', songId)
    .order('created_at');

  if (error) { checkAuthError(error); throw error; }

  return (data ?? []).map((row: SongShare & { profiles: { name: string } | null }) => ({
    id: row.id,
    song_id: row.song_id,
    shared_with: row.shared_with,
    shared_by: row.shared_by,
    created_at: row.created_at,
    shared_with_name: row.profiles?.name ?? 'Unknown',
  }));
}

export async function shareSong(
  songId: string,
  sharedWithUserId: string,
): Promise<SongShare> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('song_shares')
    .insert({
      song_id: songId,
      shared_with: sharedWithUserId,
      shared_by: user.id,
    })
    .select()
    .single();

  if (error) { checkAuthError(error); throw error; }
  return data;
}

export async function unshareSong(
  songId: string,
  sharedWithUserId: string,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('song_shares')
    .delete()
    .eq('song_id', songId)
    .eq('shared_with', sharedWithUserId);

  if (error) { checkAuthError(error); throw error; }
}

// ─── Best Take Management (D-130) ───────────────────────

export async function setBestTake(stemId: string, songId: string): Promise<void> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Clear any existing best take for this user on this song
  const { error: clearError } = await supabase
    .from('song_stems')
    .update({ is_best_take: false })
    .eq('song_id', songId)
    .eq('created_by', user.id)
    .eq('is_best_take', true);

  if (clearError) { checkAuthError(clearError); throw clearError; }

  // Set the new best take
  const { error: setError } = await supabase
    .from('song_stems')
    .update({ is_best_take: true })
    .eq('id', stemId);

  if (setError) { checkAuthError(setError); throw setError; }
}

export async function clearBestTake(stemId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('song_stems')
    .update({ is_best_take: false })
    .eq('id', stemId);

  if (error) { checkAuthError(error); throw error; }
}

// ─── Recorded Takes (S41) ────────────────────────────────

/** Get all recorded takes for a song by a specific user */
export async function getUserRecordedTakes(
  songId: string,
  userId: string,
): Promise<SongStem[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('song_stems')
    .select('*')
    .eq('song_id', songId)
    .eq('created_by', userId)
    .eq('source', 'recorded')
    .order('created_at', { ascending: true });

  if (error) { checkAuthError(error); throw error; }
  return (data ?? []) as unknown as SongStem[];
}

/** Upload a recorded take to Supabase storage + create stem row (D-145: best takes only) */
export async function uploadRecordedTake(
  songId: string,
  label: string,
  takeNumber: number,
  audioBlob: Blob,
): Promise<SongStem> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const timestamp = Date.now();
  const ext = 'webm';
  const storagePath = `${songId}/take-${label}-${user.id.slice(0, 8)}-${takeNumber}-${timestamp}.${ext}`;

  // Upload to song-stems bucket
  const { error: uploadError } = await supabase.storage
    .from('song-stems')
    .upload(storagePath, audioBlob, { contentType: 'audio/webm', upsert: false });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('song-stems')
    .getPublicUrl(storagePath);

  // Create stem row
  const { data, error: insertError } = await supabase
    .from('song_stems')
    .insert({
      song_id: songId,
      label,
      audio_url: urlData.publicUrl,
      storage_path: storagePath,
      source: 'recorded',
      is_best_take: true,
      created_by: user.id,
    })
    .select()
    .single();

  if (insertError) {
    // Rollback storage on DB failure
    await supabase.storage.from('song-stems').remove([storagePath]);
    throw insertError;
  }

  return data as unknown as SongStem;
}

/** Delete a recorded take stem (removes storage + DB row) */
export async function deleteRecordedTake(stemId: string): Promise<void> {
  const supabase = getSupabase();

  // Get storage path first
  const { data: stem, error: fetchError } = await supabase
    .from('song_stems')
    .select('storage_path')
    .eq('id', stemId)
    .single();

  if (fetchError) { checkAuthError(fetchError); throw fetchError; }

  // Delete from storage
  if (stem?.storage_path) {
    await supabase.storage.from('song-stems').remove([stem.storage_path]);
  }

  // Delete DB row
  const { error: deleteError } = await supabase
    .from('song_stems')
    .delete()
    .eq('id', stemId);

  if (deleteError) { checkAuthError(deleteError); throw deleteError; }
}

// ─── Gig Performance Log ────────────────────────────────────────────────────

/** Log a song that was loaded/played during a live gig. Fire-and-forget from Player. */
export async function logSongPlayed(
  gigId: string,
  songId: string,
  position: number,
  userId: string,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('gig_performance_log')
    .insert({ gig_id: gigId, song_id: songId, position, created_by: userId });
  if (error) { checkAuthError(error); throw error; }
}

/** Get all songs played at a specific gig, in performance order. */
export async function getGigPerformanceLog(gigId: string): Promise<GigPerformanceLogWithSong[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('gig_performance_log')
    .select('*, songs!inner(name, artist)')
    .eq('gig_id', gigId)
    .order('position', { ascending: true });
  if (error) { checkAuthError(error); throw error; }
  return (data ?? []).map((row: any) => ({
    id: row.id,
    gig_id: row.gig_id,
    song_id: row.song_id,
    position: row.position,
    played_at: row.played_at,
    created_by: row.created_by,
    song_name: row.songs.name,
    song_artist: row.songs.artist,
  }));
}

/** Get performance history for a venue — last N gigs with their played songs. */
export async function getVenuePerformanceHistory(
  venueName: string,
  limit = 3,
): Promise<{ gig_id: string; gig_date: string; songs: { name: string; artist: string; position: number }[] }[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('gig_performance_log')
    .select('*, gigs!inner(id, date, venue), songs!inner(name, artist)')
    .eq('gigs.venue', venueName)
    .order('played_at', { ascending: false });
  if (error) { checkAuthError(error); throw error; }
  if (!data || data.length === 0) return [];

  // Group by gig, keep most recent N gigs
  const byGig = new Map<string, { gig_id: string; gig_date: string; songs: { name: string; artist: string; position: number }[] }>();
  for (const row of data as any[]) {
    const gid = row.gigs.id;
    if (!byGig.has(gid)) {
      byGig.set(gid, { gig_id: gid, gig_date: row.gigs.date, songs: [] });
    }
    byGig.get(gid)!.songs.push({ name: row.songs.name, artist: row.songs.artist, position: row.position });
  }
  // Sort gigs by date descending, take limit
  const sorted = [...byGig.values()].sort((a, b) => b.gig_date.localeCompare(a.gig_date)).slice(0, limit);
  // Sort songs within each gig by position
  for (const g of sorted) g.songs.sort((a, b) => a.position - b.position);
  return sorted;
}

/** Get play stats (last played, count) for a list of song IDs. */
export async function getSongPlayStats(songIds: string[]): Promise<SongPlayStats[]> {
  if (songIds.length === 0) return [];
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('gig_performance_log')
    .select('song_id, played_at')
    .in('song_id', songIds)
    .order('played_at', { ascending: false });
  if (error) { checkAuthError(error); throw error; }
  if (!data || data.length === 0) return [];

  // Aggregate: count + most recent played_at per song
  const stats = new Map<string, SongPlayStats>();
  for (const row of data) {
    const existing = stats.get(row.song_id);
    if (existing) {
      existing.play_count++;
    } else {
      stats.set(row.song_id, { song_id: row.song_id, last_played_at: row.played_at, play_count: 1 });
    }
  }
  return [...stats.values()];
}

// ─── Setlist Entries (S118/S121 — self-contained rows, 3 master lists) ───

export async function getSetlistEntries(): Promise<SetlistEntry[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('setlist_entries')
    .select('*')
    .order('list_id')
    .order('position');

  if (error) { checkAuthError(error); throw error; }
  return (data ?? []) as SetlistEntry[];
}

export async function getSetlistEntriesByList(listId: SetlistListId): Promise<SetlistEntry[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('setlist_entries')
    .select('*')
    .eq('list_id', listId)
    .order('position');

  if (error) { checkAuthError(error); throw error; }
  return (data ?? []) as SetlistEntry[];
}

// ─── Setlist Authoring writes (S125 — cross-surface direct edit) ────────
// All writes go through these helpers so the changelog stays consistent
// across surfaces. During gig-lock, callers should route to
// queuePendingEdit() instead — those auto-apply on gig-end.

export interface SetlistEntryInput {
  list_id: SetlistListId;
  position: number;
  title: string;
  artist?: string | null;
  bpm?: number | null;
  beats_per_bar?: number;
  click_y_n?: boolean;
  click_config?: unknown | null;
  led_visual?: string | null;
  backdrop_url?: string | null;
  notes?: string | null;
  chord_text?: string | null;
  lyric_text?: string | null;
  drum_text?: string | null;
  practice_audio_ref?: string | null;
  practice_stems_refs?: unknown | null;
}

export async function createSetlistEntry(
  input: SetlistEntryInput,
  actor: { id: string; name: string },
  surface: EditSurface,
): Promise<SetlistEntry> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('setlist_entries')
    .insert(input)
    .select()
    .single();
  if (error) { checkAuthError(error); throw error; }
  await logSetlistChange({
    list_id: input.list_id,
    entry_id: data.id,
    action: 'created',
    new_value: input.title,
  }, actor, surface);
  return data as SetlistEntry;
}

export async function updateSetlistEntry(
  id: string,
  patch: Partial<SetlistEntryInput>,
  actor: { id: string; name: string },
  surface: EditSurface,
  prev?: Partial<SetlistEntry>,
): Promise<SetlistEntry> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('setlist_entries')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) { checkAuthError(error); throw error; }
  // One changelog row per changed scalar field — keeps history precise.
  for (const [field, newVal] of Object.entries(patch)) {
    const oldVal = prev?.[field as keyof SetlistEntry];
    await logSetlistChange({
      list_id: data.list_id as SetlistListId,
      entry_id: id,
      action: 'updated',
      field_changed: field,
      old_value: oldVal == null ? null : String(oldVal),
      new_value: newVal == null ? null : String(newVal),
    }, actor, surface);
  }
  return data as SetlistEntry;
}

export async function deleteSetlistEntry(
  id: string,
  actor: { id: string; name: string },
  surface: EditSurface,
  prev?: Pick<SetlistEntry, 'list_id' | 'title'>,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('setlist_entries').delete().eq('id', id);
  if (error) { checkAuthError(error); throw error; }
  if (prev) {
    await logSetlistChange({
      list_id: prev.list_id,
      entry_id: null,           // entry gone; FK set null
      action: 'deleted',
      old_value: prev.title,
    }, actor, surface);
  }
}

/** Reorder N entries within one list. Caller passes the new full ordering. */
export async function reorderSetlistEntries(
  listId: SetlistListId,
  orderedIds: string[],
  actor: { id: string; name: string },
  surface: EditSurface,
): Promise<void> {
  const supabase = getSupabase();
  // Batched update — one row per id with new position.
  const updates = orderedIds.map((id, idx) =>
    supabase.from('setlist_entries').update({ position: idx + 1 }).eq('id', id),
  );
  for (const u of updates) {
    const { error } = await u;
    if (error) { checkAuthError(error); throw error; }
  }
  await logSetlistChange({
    list_id: listId,
    entry_id: null,
    action: 'reordered',
    new_value: orderedIds.length.toString(),
  }, actor, surface);
}

/** Move an entry to a different list (carries to end of target list). */
export async function moveSetlistEntry(
  id: string,
  toList: SetlistListId,
  actor: { id: string; name: string },
  surface: EditSurface,
  prev?: Pick<SetlistEntry, 'list_id' | 'title'>,
): Promise<SetlistEntry> {
  const supabase = getSupabase();
  // Pick a position past the current max in target list.
  const tail = await getSetlistEntriesByList(toList);
  const newPos = tail.length > 0 ? Math.max(...tail.map(e => e.position)) + 1 : 1;
  const { data, error } = await supabase
    .from('setlist_entries')
    .update({ list_id: toList, position: newPos })
    .eq('id', id)
    .select()
    .single();
  if (error) { checkAuthError(error); throw error; }
  await logSetlistChange({
    list_id: toList,
    entry_id: id,
    action: 'moved',
    old_value: prev?.list_id ?? null,
    new_value: toList,
  }, actor, surface);
  return data as SetlistEntry;
}

// ─── Changelog ─────────────────────────────────────────

interface ChangeLogPayload {
  list_id: SetlistListId;
  entry_id: string | null;
  action: SetlistAction;
  field_changed?: string | null;
  old_value?: string | null;
  new_value?: string | null;
}

export async function logSetlistChange(
  payload: ChangeLogPayload,
  actor: { id: string; name: string },
  surface: EditSurface,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('setlist_changelog').insert({
    list_id: payload.list_id,
    entry_id: payload.entry_id,
    actor_id: actor.id,
    actor_name: actor.name,
    surface,
    action: payload.action,
    field_changed: payload.field_changed ?? null,
    old_value: payload.old_value ?? null,
    new_value: payload.new_value ?? null,
  });
  // Don't throw on changelog write failure — the underlying edit already
  // succeeded; losing one log row is recoverable, blocking the user isn't.
  if (error) console.warn('[setlist_changelog] insert failed:', error);
}

export async function getSetlistChangelog(
  limit = 100,
  listId?: SetlistListId,
): Promise<SetlistChangelogEntry[]> {
  const supabase = getSupabase();
  let q = supabase.from('setlist_changelog').select('*').order('created_at', { ascending: false }).limit(limit);
  if (listId) q = q.eq('list_id', listId);
  const { data, error } = await q;
  if (error) { checkAuthError(error); throw error; }
  return (data ?? []) as SetlistChangelogEntry[];
}

// ─── Pending edits (gig-lock queue) ────────────────────

export async function queuePendingEdit(
  payload: {
    list_id: SetlistListId;
    entry_id: string | null;
    action: SetlistAction;
    payload: unknown;
  },
  actor: { id: string; name: string },
  surface: EditSurface,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('setlist_pending_edits').insert({
    list_id: payload.list_id,
    entry_id: payload.entry_id,
    actor_id: actor.id,
    actor_name: actor.name,
    surface,
    action: payload.action,
    payload: payload.payload,
  });
  if (error) { checkAuthError(error); throw error; }
}

export async function getPendingEdits(): Promise<SetlistPendingEdit[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('setlist_pending_edits')
    .select('*')
    .is('applied_at', null)
    .order('created_at');
  if (error) { checkAuthError(error); throw error; }
  return (data ?? []) as SetlistPendingEdit[];
}

// ─── Gig lock state (single-row control) ───────────────

export async function getGigLockState(): Promise<GigLockState> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('gig_lock_state')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) { checkAuthError(error); throw error; }
  // Anon (RLS-blocked) callers see no rows even though the singleton exists.
  // Falling back to a stable unlocked default keeps surfaces functional in
  // read-only mode pre-sign-in.
  if (!data) {
    return {
      id: 1,
      is_locked: false,
      locked_by_surface: null,
      locked_at: null,
      gig_label: null,
      updated_at: new Date().toISOString(),
    };
  }
  return data as GigLockState;
}

export async function setGigLockState(
  isLocked: boolean,
  surface: EditSurface,
  gigLabel?: string,
): Promise<GigLockState> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('gig_lock_state')
    .update({
      is_locked: isLocked,
      locked_by_surface: isLocked ? surface : null,
      locked_at: isLocked ? new Date().toISOString() : null,
      gig_label: isLocked ? (gigLabel ?? null) : null,
    })
    .eq('id', 1)
    .select()
    .single();
  if (error) { checkAuthError(error); throw error; }
  return data as GigLockState;
}
