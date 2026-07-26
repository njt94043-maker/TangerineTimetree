import { describe, it, expect } from 'vitest';
import { clearSettingsCache } from './settingsCache';

describe('clearSettingsCache', () => {
  it('removes cached user and band settings on sign-out', () => {
    // BandSettings holds bank_sort_code / bank_account_number — these must not
    // survive a sign-out on a shared/band phone.
    localStorage.setItem('tgt-user-settings', JSON.stringify({ id: 'u1' }));
    localStorage.setItem(
      'tgt-band-settings',
      JSON.stringify({ bank_sort_code: '00-00-00', bank_account_number: '12345678' }),
    );

    clearSettingsCache();

    expect(localStorage.getItem('tgt-user-settings')).toBeNull();
    expect(localStorage.getItem('tgt-band-settings')).toBeNull();
  });
});
