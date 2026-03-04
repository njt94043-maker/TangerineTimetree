import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const OFFLINE_QUEUE_KEY = 'offline_bookings_queue';
const OFFLINE_CACHE_KEY = 'offline_bookings_cache';

export const useOfflineManager = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      toast.success('Back online! Syncing data...');
      await syncOfflineQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline. Changes will be saved locally and synced when back online.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Sync on mount if online
    if (navigator.onLine) {
      syncOfflineQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncOfflineQueue = async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    toast.info(`Syncing ${queue.length} offline changes...`);
    
    const failedItems = [];
    
    for (const item of queue) {
      try {
        if (item.type === 'create') {
          await base44.entities.Booking.create(item.data);
        } else if (item.type === 'update') {
          await base44.entities.Booking.update(item.id, item.data);
        } else if (item.type === 'delete') {
          await base44.entities.Booking.delete(item.id);
        }
      } catch (error) {
        console.error('Failed to sync item:', error);
        failedItems.push(item);
      }
    }

    if (failedItems.length === 0) {
      clearOfflineQueue();
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('All changes synced successfully!');
    } else {
      saveOfflineQueue(failedItems);
      toast.error(`${failedItems.length} changes failed to sync. Will retry later.`);
    }
  };

  const addToOfflineQueue = (operation) => {
    const queue = getOfflineQueue();
    queue.push({
      ...operation,
      timestamp: new Date().toISOString(),
      id: operation.id || `offline_${Date.now()}`
    });
    saveOfflineQueue(queue);
  };

  const getOfflineQueue = () => {
    try {
      const queue = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch {
      return [];
    }
  };

  const saveOfflineQueue = (queue) => {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  };

  const clearOfflineQueue = () => {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  };

  const cacheBookings = (bookings) => {
    try {
      localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify({
        bookings,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Failed to cache bookings:', error);
    }
  };

  const getCachedBookings = () => {
    try {
      const cached = localStorage.getItem(OFFLINE_CACHE_KEY);
      if (cached) {
        const { bookings, timestamp } = JSON.parse(cached);
        // Return cached data if less than 24 hours old
        const cacheAge = Date.now() - new Date(timestamp).getTime();
        if (cacheAge < 24 * 60 * 60 * 1000) {
          return bookings;
        }
      }
    } catch (error) {
      console.error('Failed to get cached bookings:', error);
    }
    return null;
  };

  return {
    isOnline,
    addToOfflineQueue,
    cacheBookings,
    getCachedBookings,
    syncOfflineQueue,
    queueLength: getOfflineQueue().length
  };
};

export default useOfflineManager;