import { describe, it, expect } from 'vitest';
import { clearSettingsCache } from './settingsCache';

describe('clearSettingsCache', () => {
  it('removes cached user and band settings on sign-out', () => {
    // UserSettings (cached under tgt-user-settings) holds bank_sort_code /
    // bank_account_number — these must not survive a sign-out on a shared phone.
    localStorage.setItem(
      'tgt-user-settings',
      JSON.stringify({ bank_sort_code: '00-00-00', bank_account_number: '12345678' }),
    );
    localStorage.setItem('tgt-band-settings', JSON.stringify({ trading_as: 'Test' }));

    clearSettingsCache();

    expect(localStorage.getItem('tgt-user-settings')).toBeNull();
    expect(localStorage.getItem('tgt-band-settings')).toBeNull();
  });
});
