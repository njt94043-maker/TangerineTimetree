import { useState, useEffect, useCallback } from 'react';
import { getInvoices } from '@shared/supabase/queries';
import type { InvoiceWithClient } from '@shared/supabase/types';
import { getSupabase } from '@shared/supabase/clientRef';

export function useInvoiceData() {
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getInvoices();
      setInvoices(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime subscription on invoices table
  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel('invoices-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => {
        refresh();
      })
      .subscribe((status: string, err?: Error) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Invoice realtime error', status, err);
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  return { invoices, loading, error, refresh };
}
