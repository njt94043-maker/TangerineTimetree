import { useState, useEffect, useCallback } from 'react';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeNotifications,
} from '@shared/supabase/queries';
import type { AppNotification } from '@shared/supabase/types';
import { getSupabase } from '@shared/supabase/clientRef';

// Loads the member's notifications + unread count and keeps them live via the
// notifications realtime channel. Mirrors useInvoiceData's load+subscribe shape.
export function useNotifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        getNotifications(),
        getUnreadNotificationCount(),
      ]);
      setItems(list);
      setUnreadCount(count);
    } catch (err) {
      console.warn('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime — subscribe once we know the signed-in member; RLS keeps the stream
  // to their own rows. Any change (new enquiry fan-out, or a mark-read) re-loads.
  useEffect(() => {
    let channel: unknown;
    let cancelled = false;
    getSupabase().auth.getUser().then(({ data: { user } }: { data: { user: { id: string } | null } }) => {
      if (cancelled || !user) return;
      channel = subscribeNotifications(user.id, () => refresh());
    });
    return () => {
      cancelled = true;
      if (channel) getSupabase().removeChannel(channel);
    };
  }, [refresh]);

  const markRead = useCallback(async (id: string) => {
    const wasUnread = items.some(n => n.id === id && !n.read);
    setItems(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    if (wasUnread) setUnreadCount(c => Math.max(0, c - 1));
    try {
      await markNotificationRead(id);
    } catch {
      refresh();
    }
  }, [items, refresh]);

  const markAllRead = useCallback(async () => {
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      refresh();
    }
  }, [refresh]);

  return { items, unreadCount, loading, markRead, markAllRead, refresh };
}
