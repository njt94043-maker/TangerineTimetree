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
  is_public: boolean;
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
export type DayStatus = 'available' | 'gig' | 'practice' | 'partial' | 'unavailable' | 'past';

// Gig completeness check — flags gigs missing key details
// Practice sessions only need venue + start_time
export function isGigIncomplete(gig: Gig): boolean {
  if (gig.gig_type === 'practice') {
    return !gig.venue || !gig.start_time;
  }
  return !gig.venue || !gig.client_name || gig.fee == null || !gig.start_time || !gig.load_time;
}

// Compute calendar day status
export function computeDayStatus(
  date: string,
  today: string,
  gigs: Gig[],
  awayDates: AwayDate[],
  totalMembers: number,
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

  if (awayUserIds.size >= totalMembers) return 'unavailable';
  if (awayUserIds.size > 0) return 'partial';
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
