import type { UserSettings, BandSettings } from '@shared/supabase/types';
import { getUserSettings, getBandSettings } from '@shared/supabase/queries';

const KEYS = { user: 'tgt-user-settings', band: 'tgt-band-settings' };

function readCache(): { userSettings: UserSettings | null; bandSettings: BandSettings | null } {
  try {
    const u = localStorage.getItem(KEYS.user);
    const b = localStorage.getItem(KEYS.band);
    return {
      userSettings: u ? JSON.parse(u) : null,
      bandSettings: b ? JSON.parse(b) : null,
    };
  } catch {
    return { userSettings: null, bandSettings: null };
  }
}

function writeCache(us: UserSettings | null, bs: BandSettings | null) {
  try {
    if (us) localStorage.setItem(KEYS.user, JSON.stringify(us));
    if (bs) localStorage.setItem(KEYS.band, JSON.stringify(bs));
  } catch { /* ignore */ }
}

/**
 * Load settings with cache-first strategy.
 * Returns cached values immediately if available, then fetches fresh in background.
 * Calls onUpdate when fresh data arrives.
 */
export function loadSettingsCached(
  onResult: (us: UserSettings | null, bs: BandSettings | null) => void,
  onError?: (err: unknown) => void,
): void {
  const cached = readCache();
  if (cached.userSettings || cached.bandSettings) {
    onResult(cached.userSettings, cached.bandSettings);
  }

  Promise.all([getUserSettings(), getBandSettings()])
    .then(([us, bs]) => {
      writeCache(us, bs);
      onResult(us, bs);
    })
    .catch(err => {
      if (!cached.userSettings && !cached.bandSettings) {
        onError?.(err);
      }
    });
}
