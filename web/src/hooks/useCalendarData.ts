import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase/client';
import { getGigsForMonth, getAwayDatesForMonth, getProfiles } from '@shared/supabase/queries';
import type { Gig, AwayDateWithUser, Profile } from '@shared/supabase/types';

export function useCalendarData(year: number, month: number) {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [awayDates, setAwayDates] = useState<AwayDateWithUser[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [g, a, p] = await Promise.all([
        getGigsForMonth(year, month),
        getAwayDatesForMonth(year, month),
        getProfiles(),
      ]);
      setGigs(g);
      setAwayDates(a);
      setProfiles(p);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('timetree-calendar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gigs' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'away_dates' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  return { gigs, awayDates, profiles, loading, refresh: fetchData };
}
