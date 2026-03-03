// Shared types — mirrors GigBooks/src/supabase/types.ts

export interface Profile {
  id: string;
  name: string;
  is_admin: boolean;
  avatar_url: string;
  created_at: string;
}

export interface Gig {
  id: string;
  date: string;
  venue: string;
  client_name: string;
  fee: number | null;
  payment_type: 'cash' | 'invoice' | '';
  load_time: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GigWithCreator extends Gig {
  creator_name: string;
}

export interface AwayDate {
  id: string;
  user_id: string;
  start_date: string;
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

export type DayStatus = 'available' | 'gig' | 'partial' | 'unavailable' | 'past';

export function isGigIncomplete(gig: Gig): boolean {
  return !gig.venue || !gig.client_name || gig.fee == null || !gig.start_time || !gig.load_time;
}

export function computeDayStatus(
  date: string,
  today: string,
  gigs: Gig[],
  awayDates: AwayDate[],
  totalMembers: number,
): DayStatus {
  if (date < today) return 'past';
  const hasGig = gigs.some(g => g.date === date);
  if (hasGig) return 'gig';
  const awayUserIds = new Set(
    awayDates.filter(a => date >= a.start_date && date <= a.end_date).map(a => a.user_id),
  );
  if (awayUserIds.size >= totalMembers) return 'unavailable';
  if (awayUserIds.size > 0) return 'partial';
  return 'available';
}
