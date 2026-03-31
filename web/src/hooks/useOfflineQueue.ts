import { useState, useEffect, useCallback } from 'react';
import { createGig, updateGig, deleteGig, createAwayDate, updateAwayDate, deleteAwayDate } from '@shared/supabase/queries';
import { getSupabase } from '@shared/supabase/clientRef';

const QUEUE_KEY = 'timetree-offline-queue';

export interface QueuedMutation {
  id: string;
  type: 'createGig' | 'updateGig' | 'deleteGig' | 'createAwayDate' | 'updateAwayDate' | 'deleteAwayDate';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any;
  createdAt: string;
}

function loadQueue(): QueuedMutation[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedMutation[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function isNetworkError(err: unknown): boolean {
  if (!navigator.onLine) return true;
  if (err instanceof TypeError && err.message.includes('fetch')) return true;
  if (err instanceof Error && (err.message.includes('network') || err.message.includes('Failed to fetch'))) return true;
  return false;
}

export function queueMutation(type: QueuedMutation['type'], args: Record<string, unknown>): void {
  const queue = loadQueue();
  queue.push({
    id: crypto.randomUUID(),
    type,
    args,
    createdAt: new Date().toISOString(),
  });
  saveQueue(queue);
}

/** Check if an entity still exists before replaying an update/delete */
async function entityExists(table: string, id: string): Promise<boolean> {
  const { data } = await getSupabase().from(table).select('id').eq('id', id).single();
  return data != null;
}

async function replayOne(m: QueuedMutation): Promise<void> {
  switch (m.type) {
    case 'createGig':
      await createGig(m.args);
      break;
    case 'updateGig':
      if (!await entityExists('gigs', m.args.id)) return; // entity deleted while offline
      await updateGig(m.args.id, m.args.updates);
      break;
    case 'deleteGig':
      if (!await entityExists('gigs', m.args.id)) return;
      await deleteGig(m.args.id);
      break;
    case 'createAwayDate':
      await createAwayDate(m.args);
      break;
    case 'updateAwayDate':
      if (!await entityExists('away_dates', m.args.id)) return;
      await updateAwayDate(m.args.id, m.args.updates);
      break;
    case 'deleteAwayDate':
      if (!await entityExists('away_dates', m.args.id)) return;
      await deleteAwayDate(m.args.id);
      break;
  }
}

export function useOfflineQueue(onSynced?: () => void) {
  const [pendingCount, setPendingCount] = useState(loadQueue().length);
  const [syncing, setSyncing] = useState(false);

  const replayQueue = useCallback(async () => {
    const queue = loadQueue();
    if (queue.length === 0 || !navigator.onLine) return;

    setSyncing(true);
    const remaining: QueuedMutation[] = [];

    for (const m of queue) {
      try {
        await replayOne(m);
      } catch {
        // Keep failed items in queue (might still be offline or conflict)
        remaining.push(m);
      }
    }

    saveQueue(remaining);
    setPendingCount(remaining.length);
    setSyncing(false);
    if (remaining.length < queue.length) onSynced?.();
  }, [onSynced]);

  // Replay when coming back online
  useEffect(() => {
    const handleOnline = () => replayQueue();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [replayQueue]);

  // Refresh count when queue changes
  const refreshCount = useCallback(() => {
    setPendingCount(loadQueue().length);
  }, []);

  return { pendingCount, syncing, replayQueue, refreshCount };
}
