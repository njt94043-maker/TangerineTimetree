import { useState, useCallback } from 'react';
import { isNetworkError, queueMutation } from './useOfflineQueue';
import type { QueuedMutation } from './useOfflineQueue';

interface MutationOptions {
  /** The async operation to attempt */
  operation: () => Promise<void>;
  /** Queue type + args for offline fallback */
  queueAs?: { type: QueuedMutation['type']; args: unknown };
  /** Called on success (including offline-queued) */
  onSuccess?: () => void;
  /** Called on non-network error */
  onError?: (msg: string) => void;
}

/**
 * Hook that encapsulates the try/catch/isNetworkError/queueMutation pattern.
 * Returns { mutate, saving, error }.
 */
export function useMutationWithQueue() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const mutate = useCallback(async (opts: MutationOptions) => {
    setSaving(true);
    setError('');
    try {
      await opts.operation();
      opts.onSuccess?.();
    } catch (err) {
      if (isNetworkError(err) && opts.queueAs) {
        queueMutation(opts.queueAs.type, opts.queueAs.args);
        opts.onSuccess?.(); // Treat as success — will sync when online
        return;
      }
      const msg = err instanceof Error ? err.message : 'Operation failed';
      setError(msg);
      opts.onError?.(msg);
    } finally {
      setSaving(false);
    }
  }, []);

  return { mutate, saving, error, setError };
}
