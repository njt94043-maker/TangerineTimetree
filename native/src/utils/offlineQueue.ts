import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createGig, updateGig, deleteGig, createAwayDate, deleteAwayDate } from '@shared/supabase/queries';

const QUEUE_KEY = 'offline-mutation-queue';

interface QueuedMutation {
  id: string;
  type: 'createGig' | 'updateGig' | 'deleteGig' | 'createAwayDate' | 'deleteAwayDate';
  args: any;
  createdAt: string;
}

async function loadQueue(): Promise<QueuedMutation[]> {
  try {
    const json = await AsyncStorage.getItem(QUEUE_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedMutation[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message.includes('fetch')) return true;
  if (err instanceof Error && (err.message.includes('network') || err.message.includes('Network request failed'))) return true;
  return false;
}

export async function queueMutation(type: QueuedMutation['type'], args: any): Promise<void> {
  const queue = await loadQueue();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    args,
    createdAt: new Date().toISOString(),
  });
  await saveQueue(queue);
}

async function replayOne(m: QueuedMutation): Promise<void> {
  switch (m.type) {
    case 'createGig':
      await createGig(m.args);
      break;
    case 'updateGig':
      await updateGig(m.args.id, m.args.updates);
      break;
    case 'deleteGig':
      await deleteGig(m.args.id);
      break;
    case 'createAwayDate':
      await createAwayDate(m.args);
      break;
    case 'deleteAwayDate':
      await deleteAwayDate(m.args.id);
      break;
  }
}

export async function replayQueue(): Promise<number> {
  const queue = await loadQueue();
  if (queue.length === 0) return 0;

  const state = await NetInfo.fetch();
  if (!state.isConnected) return queue.length;

  const remaining: QueuedMutation[] = [];
  let synced = 0;

  for (const m of queue) {
    try {
      await replayOne(m);
      synced++;
    } catch {
      remaining.push(m);
    }
  }

  await saveQueue(remaining);
  return remaining.length;
}

export async function getPendingCount(): Promise<number> {
  return (await loadQueue()).length;
}

// Subscribe to connectivity changes — replay queue when coming online
let _unsubscribe: (() => void) | null = null;

export function startOfflineQueueListener(onSynced?: () => void): () => void {
  if (_unsubscribe) _unsubscribe();

  _unsubscribe = NetInfo.addEventListener(async (state) => {
    if (state.isConnected) {
      const remaining = await replayQueue();
      if (remaining === 0) onSynced?.();
    }
  });

  return () => {
    if (_unsubscribe) {
      _unsubscribe();
      _unsubscribe = null;
    }
  };
}
