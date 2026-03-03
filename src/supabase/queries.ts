import { supabase } from './client';
import type {
  Profile, Gig, GigWithCreator, AwayDate, AwayDateWithUser,
  GigChangelogWithUser,
} from './types';

// ─── Profiles ───────────────────────────────────────────

export async function getProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (error) throw error;
  return data;
}

// ─── Gigs ───────────────────────────────────────────────

export async function getGigsForMonth(year: number, month: number): Promise<GigWithCreator[]> {
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('gigs')
    .select('*, profiles!gigs_created_by_fkey(name)')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    creator_name: row.profiles?.name ?? 'Unknown',
    profiles: undefined,
  }));
}

export async function getGigsByDate(date: string): Promise<GigWithCreator[]> {
  const { data, error } = await supabase
    .from('gigs')
    .select('*, profiles!gigs_created_by_fkey(name)')
    .eq('date', date)
    .order('start_time');
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    creator_name: row.profiles?.name ?? 'Unknown',
    profiles: undefined,
  }));
}

export async function createGig(gig: {
  date: string;
  venue?: string;
  client_name?: string;
  fee?: number | null;
  payment_type?: 'cash' | 'invoice' | '';
  load_time?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  notes?: string;
}): Promise<Gig> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('gigs')
    .insert({
      date: gig.date,
      venue: gig.venue ?? '',
      client_name: gig.client_name ?? '',
      fee: gig.fee ?? null,
      payment_type: gig.payment_type ?? '',
      load_time: gig.load_time ?? null,
      start_time: gig.start_time ?? null,
      end_time: gig.end_time ?? null,
      notes: gig.notes ?? '',
      created_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;

  await supabase.from('gig_changelog').insert({
    gig_id: data.id,
    user_id: user.id,
    action: 'created',
  });

  return data;
}

export async function updateGig(
  id: string,
  updates: Partial<Omit<Gig, 'id' | 'created_by' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: current } = await supabase.from('gigs').select('*').eq('id', id).single();
  const { error } = await supabase.from('gigs').update(updates).eq('id', id);
  if (error) throw error;

  if (current) {
    const entries = Object.entries(updates)
      .filter(([key, val]) => String(val ?? '') !== String((current as any)[key] ?? ''))
      .map(([key, val]) => ({
        gig_id: id,
        user_id: user.id,
        action: 'updated' as const,
        field_changed: key,
        old_value: String((current as any)[key] ?? ''),
        new_value: String(val ?? ''),
      }));
    if (entries.length > 0) {
      await supabase.from('gig_changelog').insert(entries);
    }
  }
}

export async function deleteGig(id: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: current } = await supabase.from('gigs').select('venue, date').eq('id', id).single();
  await supabase.from('gig_changelog').insert({
    gig_id: id,
    user_id: user.id,
    action: 'deleted',
    old_value: current ? `${current.venue} on ${current.date}` : '',
  });

  const { error } = await supabase.from('gigs').delete().eq('id', id);
  if (error) throw error;
}

// ─── Away Dates ─────────────────────────────────────────

export async function getAwayDatesForMonth(year: number, month: number): Promise<AwayDateWithUser[]> {
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('away_dates')
    .select('*, profiles!away_dates_user_id_fkey(name)')
    .lte('start_date', endDate)
    .gte('end_date', startDate);
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    user_name: row.profiles?.name ?? 'Unknown',
    profiles: undefined,
  }));
}

export async function getMyAwayDates(): Promise<AwayDate[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('away_dates')
    .select('*')
    .eq('user_id', user.id)
    .order('start_date');
  if (error) throw error;
  return data ?? [];
}

export async function createAwayDate(params: {
  start_date: string;
  end_date: string;
  reason?: string;
}): Promise<AwayDate> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('away_dates')
    .insert({ user_id: user.id, start_date: params.start_date, end_date: params.end_date, reason: params.reason ?? '' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteAwayDate(id: string): Promise<void> {
  const { error } = await supabase.from('away_dates').delete().eq('id', id);
  if (error) throw error;
}

// ─── Changelog ──────────────────────────────────────────

export async function getGigChangelog(gigId: string): Promise<GigChangelogWithUser[]> {
  const { data, error } = await supabase
    .from('gig_changelog')
    .select('*, profiles!gig_changelog_user_id_fkey(name)')
    .eq('gig_id', gigId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    user_name: row.profiles?.name ?? 'Unknown',
    profiles: undefined,
  }));
}
