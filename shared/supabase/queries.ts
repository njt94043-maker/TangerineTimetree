import { getSupabase, handleAuthError } from './clientRef';
import type {
  Profile,
  Gig,
  GigType,
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
  venue?: string;
  client_name?: string;
  fee?: number | null;
  payment_type?: 'cash' | 'invoice' | '';
  load_time?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  notes?: string;
  visibility?: GigVisibility;
}): Promise<Gig> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('gigs')
    .insert({
      date: gig.date,
      gig_type: gig.gig_type ?? 'gig',
      venue: gig.venue ?? '',
      client_name: gig.client_name ?? '',
      fee: gig.fee ?? null,
      payment_type: gig.payment_type ?? '',
      load_time: gig.load_time ?? null,
      start_time: gig.start_time ?? null,
      end_time: gig.end_time ?? null,
      notes: gig.notes ?? '',
      visibility: gig.visibility ?? 'hidden',
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

export async function getVenuesForClient(clientId: string): Promise<Venue[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .eq('client_id', clientId)
    .order('venue_name');
  if (error) { checkAuthError(error); throw error; }
  return data ?? [];
}

export async function createVenue(clientId: string, venueName: string, address?: string): Promise<Venue> {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('venues')
    .insert({
      client_id: clientId,
      venue_name: venueName,
      address: address ?? '',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) { checkAuthError(error); throw error; }
  return data;
}

export async function deleteVenue(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('venues').delete().eq('id', id);
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

export async function getInvoices(): Promise<InvoiceWithClient[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('invoices')
    .select('*, clients!invoices_client_id_fkey(company_name, contact_name, address, email)')
    .order('created_at', { ascending: false });

  if (error) { checkAuthError(error); throw error; }

  return (data ?? []).map((row: any) => ({
    ...row,
    client_company_name: row.clients?.company_name ?? '',
    client_contact_name: row.clients?.contact_name ?? '',
    client_address: row.clients?.address ?? '',
    client_email: row.clients?.email ?? '',
    clients: undefined,
  }));
}

export async function getInvoice(id: string): Promise<InvoiceWithClient | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('invoices')
    .select('*, clients!invoices_client_id_fkey(company_name, contact_name, address, email)')
    .eq('id', id)
    .single();

  if (error) { checkAuthError(error); throw error; }
  if (!data) return null;

  return {
    ...data,
    client_company_name: (data as any).clients?.company_name ?? '',
    client_contact_name: (data as any).clients?.contact_name ?? '',
    client_address: (data as any).clients?.address ?? '',
    client_email: (data as any).clients?.email ?? '',
    clients: undefined,
  } as InvoiceWithClient;
}

export async function createInvoice(inv: {
  client_id: string;
  venue: string;
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
      client_id: inv.client_id,
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
  updates: Partial<Pick<Invoice, 'venue' | 'gig_date' | 'amount' | 'description' | 'due_date' | 'style'>>,
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
    .select('amount, status, created_at, id, invoice_number, client_id, venue, gig_date, description, issue_date, due_date, paid_date, style, created_by, updated_at, clients!invoices_client_id_fkey(company_name, contact_name, address, email)')
    .order('created_at', { ascending: false });

  if (error) { checkAuthError(error); throw error; }

  const all = invoices ?? [];
  const totalInvoiced = all.reduce((sum: number, i: any) => sum + Number(i.amount), 0);
  const totalPaid = all.filter((i: any) => i.status === 'paid').reduce((sum: number, i: any) => sum + Number(i.amount), 0);
  const totalOutstanding = all.filter((i: any) => i.status === 'sent').reduce((sum: number, i: any) => sum + Number(i.amount), 0);

  const recentInvoices: InvoiceWithClient[] = all.slice(0, 5).map((row: any) => ({
    ...row,
    client_company_name: row.clients?.company_name ?? '',
    client_contact_name: row.clients?.contact_name ?? '',
    client_address: row.clients?.address ?? '',
    client_email: row.clients?.email ?? '',
    clients: undefined,
  }));

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

export async function getQuotes(): Promise<QuoteWithClient[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('quotes')
    .select('*, clients!quotes_client_id_fkey(company_name, contact_name, address, email, phone)')
    .order('created_at', { ascending: false });

  if (error) { checkAuthError(error); throw error; }

  return (data ?? []).map((row: any) => ({
    ...row,
    client_company_name: row.clients?.company_name ?? '',
    client_contact_name: row.clients?.contact_name ?? '',
    client_address: row.clients?.address ?? '',
    client_email: row.clients?.email ?? '',
    client_phone: row.clients?.phone ?? '',
    clients: undefined,
  }));
}

export async function getQuote(id: string): Promise<QuoteWithClient | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('quotes')
    .select('*, clients!quotes_client_id_fkey(company_name, contact_name, address, email, phone)')
    .eq('id', id)
    .single();

  if (error) { checkAuthError(error); throw error; }
  if (!data) return null;

  return {
    ...data,
    client_company_name: (data as any).clients?.company_name ?? '',
    client_contact_name: (data as any).clients?.contact_name ?? '',
    client_address: (data as any).clients?.address ?? '',
    client_email: (data as any).clients?.email ?? '',
    client_phone: (data as any).clients?.phone ?? '',
    clients: undefined,
  } as QuoteWithClient;
}

export async function createQuote(q: {
  client_id: string;
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
      client_id: q.client_id,
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
  updates: Partial<Pick<Quote, 'event_type' | 'event_date' | 'venue_name' | 'venue_address' | 'subtotal' | 'discount_amount' | 'total' | 'pli_option' | 'terms_and_conditions' | 'validity_days' | 'notes' | 'style'>>,
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

export async function getFormalInvoice(id: string): Promise<FormalInvoiceWithClient | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('formal_invoices')
    .select('*, clients!formal_invoices_client_id_fkey(company_name, contact_name, address, email)')
    .eq('id', id)
    .single();

  if (error) { checkAuthError(error); throw error; }
  if (!data) return null;

  return {
    ...data,
    client_company_name: (data as any).clients?.company_name ?? '',
    client_contact_name: (data as any).clients?.contact_name ?? '',
    client_address: (data as any).clients?.address ?? '',
    client_email: (data as any).clients?.email ?? '',
    clients: undefined,
  } as FormalInvoiceWithClient;
}

export async function getFormalInvoiceByQuote(quoteId: string): Promise<FormalInvoiceWithClient | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('formal_invoices')
    .select('*, clients!formal_invoices_client_id_fkey(company_name, contact_name, address, email)')
    .eq('quote_id', quoteId)
    .single();

  if (error?.code === 'PGRST116') return null; // No row found
  if (error) { checkAuthError(error); throw error; }
  if (!data) return null;

  return {
    ...data,
    client_company_name: (data as any).clients?.company_name ?? '',
    client_contact_name: (data as any).clients?.contact_name ?? '',
    client_address: (data as any).clients?.address ?? '',
    client_email: (data as any).clients?.email ?? '',
    clients: undefined,
  } as FormalInvoiceWithClient;
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
  updates: Partial<Pick<BandSettings, 'trading_as' | 'business_type' | 'website' | 'payment_terms_days' | 'pli_insurer' | 'pli_policy_number' | 'pli_cover_amount' | 'pli_expiry_date' | 'default_terms_and_conditions' | 'default_quote_validity_days'>>,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('band_settings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', 'default');

  if (error) { checkAuthError(error); throw error; }
}
