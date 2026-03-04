import { getSupabase, handleAuthError } from './clientRef';
import type {
  Profile,
  Gig,
  GigType,
  GigWithCreator,
  AwayDate,
  AwayDateWithUser,
  GigChangelogEntry,
  GigChangelogWithUser,
  ChangeSummaryItem,
  PublicMedia,
  ContactSubmission,
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
  is_public?: boolean;
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
      is_public: gig.is_public ?? false,
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
    .eq('is_public', true)
    .gte('date', todayISO)
    .order('date');

  if (error) throw error;
  return data ?? [];
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
