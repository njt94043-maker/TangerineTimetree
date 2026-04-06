/**
 * S41: Active gig session discovery hook.
 * Subscribes to Supabase Realtime on `active_gig_sessions` table to detect
 * when a Studio phone server is running. Used to show "Join Gig" banner on Calendar.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase/client';

export interface ActiveGigSession {
  id: string;
  gig_id: string | null;
  studio_ip: string;
  ws_port: number;
  pairing_secret: string;
  started_at: string;
  ended_at: string | null;
  created_by: string | null;
}

export function useGigSession() {
  const [activeGig, setActiveGig] = useState<ActiveGigSession | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchActive = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('active_gig_sessions')
        .select('*')
        .is('ended_at', null)
        .order('started_at', { ascending: false })
        .limit(1);

      if (error) {
        console.warn('useGigSession: fetch error', error);
        setActiveGig(null);
      } else {
        setActiveGig(data && data.length > 0 ? data[0] as ActiveGigSession : null);
      }
    } catch {
      setActiveGig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => { fetchActive(); }, [fetchActive]);

  // Realtime subscription — detect when a gig session starts or ends
  useEffect(() => {
    const channel = supabase
      .channel('gig-session-discovery')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_gig_sessions' }, () => fetchActive())
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Gig session realtime error', status, err);
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [fetchActive]);

  return { activeGig, loading, refresh: fetchActive };
}
