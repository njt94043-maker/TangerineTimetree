import { useState, useEffect, useCallback } from 'react';
import { getUserSettings, getBandSettings } from '@shared/supabase/queries';
import type { UserSettings, BandSettings } from '@shared/supabase/types';

export interface CombinedSettings {
  // User settings
  your_name: string;
  email: string;
  phone: string;
  bank_account_name: string;
  bank_name: string;
  bank_sort_code: string;
  bank_account_number: string;
  // Band settings
  trading_as: string;
  business_type: string;
  website: string;
  payment_terms_days: number;
  next_invoice_number: number;
}

export function useSettings() {
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [bandSettings, setBandSettings] = useState<BandSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [us, bs] = await Promise.all([getUserSettings(), getBandSettings()]);
      setUserSettings(us);
      setBandSettings(bs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const combined: CombinedSettings | null = userSettings && bandSettings ? {
    your_name: userSettings.your_name,
    email: userSettings.email,
    phone: userSettings.phone,
    bank_account_name: userSettings.bank_account_name,
    bank_name: userSettings.bank_name,
    bank_sort_code: userSettings.bank_sort_code,
    bank_account_number: userSettings.bank_account_number,
    trading_as: bandSettings.trading_as,
    business_type: bandSettings.business_type,
    website: bandSettings.website,
    payment_terms_days: bandSettings.payment_terms_days,
    next_invoice_number: bandSettings.next_invoice_number,
  } : null;

  return { userSettings, bandSettings, combined, loading, error, refresh };
}
