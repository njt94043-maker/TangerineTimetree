import { useState, useEffect, useCallback } from 'react';
import { getQuotes } from '@shared/supabase/queries';
import type { QuoteWithClient } from '@shared/supabase/types';
import { getSupabase } from '@shared/supabase/clientRef';

export function useQuoteData() {
  const [quotes, setQuotes] = useState<QuoteWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getQuotes();
      setQuotes(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load quotes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime subscription on quotes table
  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel('quotes-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotes' }, () => {
        refresh();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  return { quotes, loading, error, refresh };
}
