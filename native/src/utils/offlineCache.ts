import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Gig, AwayDateWithUser, Profile, UserSettings, BandSettings } from '@shared/supabase/types';

const CACHE_KEYS = {
  gigs: (y: number, m: number) => `cache-gigs-${y}-${m}`,
  awayDates: (y: number, m: number) => `cache-away-${y}-${m}`,
  profiles: 'cache-profiles',
  userSettings: 'cache-user-settings',
  bandSettings: 'cache-band-settings',
  clients: 'cache-clients',
};

export async function cacheCalendarData(
  year: number,
  month: number,
  gigs: Gig[],
  awayDates: AwayDateWithUser[],
  profiles: Profile[],
): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.setItem(CACHE_KEYS.gigs(year, month), JSON.stringify(gigs)),
      AsyncStorage.setItem(CACHE_KEYS.awayDates(year, month), JSON.stringify(awayDates)),
      AsyncStorage.setItem(CACHE_KEYS.profiles, JSON.stringify(profiles)),
    ]);
  } catch { /* ignore cache write errors */ }
}

export async function getCachedCalendarData(
  year: number,
  month: number,
): Promise<{ gigs: Gig[]; awayDates: AwayDateWithUser[]; profiles: Profile[] } | null> {
  try {
    const [gigsJson, awayJson, profilesJson] = await Promise.all([
      AsyncStorage.getItem(CACHE_KEYS.gigs(year, month)),
      AsyncStorage.getItem(CACHE_KEYS.awayDates(year, month)),
      AsyncStorage.getItem(CACHE_KEYS.profiles),
    ]);
    if (!gigsJson || !profilesJson) return null;
    return {
      gigs: JSON.parse(gigsJson),
      awayDates: awayJson ? JSON.parse(awayJson) : [],
      profiles: JSON.parse(profilesJson),
    };
  } catch {
    return null;
  }
}

// ─── Settings Cache ─────────────────────────────────────

export async function cacheSettings(
  userSettings: UserSettings | null,
  bandSettings: BandSettings | null,
): Promise<void> {
  try {
    await Promise.all([
      userSettings
        ? AsyncStorage.setItem(CACHE_KEYS.userSettings, JSON.stringify(userSettings))
        : Promise.resolve(),
      bandSettings
        ? AsyncStorage.setItem(CACHE_KEYS.bandSettings, JSON.stringify(bandSettings))
        : Promise.resolve(),
    ]);
  } catch { /* ignore */ }
}

export async function getCachedSettings(): Promise<{
  userSettings: UserSettings | null;
  bandSettings: BandSettings | null;
} | null> {
  try {
    const [uJson, bJson] = await Promise.all([
      AsyncStorage.getItem(CACHE_KEYS.userSettings),
      AsyncStorage.getItem(CACHE_KEYS.bandSettings),
    ]);
    if (!uJson && !bJson) return null;
    return {
      userSettings: uJson ? JSON.parse(uJson) : null,
      bandSettings: bJson ? JSON.parse(bJson) : null,
    };
  } catch {
    return null;
  }
}
