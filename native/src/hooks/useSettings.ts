import { useState, useEffect, useCallback } from 'react';
import { getSettings, updateSettings, GigBooksSettings } from '../db';

export function useSettings() {
  const [settings, setSettings] = useState<GigBooksSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const s = await getSettings();
    setSettings(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback(async (updates: Partial<GigBooksSettings>) => {
    await updateSettings(updates);
    setSettings(prev => prev ? { ...prev, ...updates } : prev);
  }, []);

  return { settings, loading, update, reload: load };
}
