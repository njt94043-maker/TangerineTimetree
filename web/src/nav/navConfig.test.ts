import { describe, it, expect } from 'vitest';
import { TAB_ITEMS, MORE_SECTIONS, VIEW_TO_NAV, ALL_TOP_DESTINATIONS } from './navConfig';

// The guardrail as a test (s244 / D-120): exactly these 15 top-level
// destinations must remain reachable — nothing added, nothing lost when the
// drawer became the tab bar + More menu.
const EXPECTED_DESTINATIONS = [
  'calendar', 'list', 'away', 'availability', 'dashboard', 'invoices', 'quotes',
  'clients', 'venues', 'library', 'media', 'enquiries', 'website', 'profile', 'settings',
];

// Every member of useViewContext's View union, as a literal list. VIEW_TO_NAV
// must give each one a nav home (it is typed Record<View, View>, so this also
// fails at compile time — the runtime check is the human-readable backstop).
const ALL_VIEWS = [
  'dashboard', 'calendar', 'list', 'day-detail', 'gig-form', 'away',
  'profile', 'media', 'enquiries', 'website', 'notifications',
  'invoices', 'invoice-form', 'invoice-detail', 'invoice-preview',
  'quotes', 'quote-form', 'quote-detail', 'quote-preview',
  'settings', 'clients', 'venues', 'venue-detail', 'library',
  'booking-wizard', 'availability', 'more',
];

describe('navConfig — the 15-destination guardrail', () => {
  it('exposes exactly the 15 top-level destinations (nothing added, nothing lost)', () => {
    expect(new Set(ALL_TOP_DESTINATIONS)).toEqual(new Set(EXPECTED_DESTINATIONS));
    // no duplicates in the derived list
    expect(ALL_TOP_DESTINATIONS.length).toBe(EXPECTED_DESTINATIONS.length);
  });

  it('never lists a destination in both a tab and the More menu', () => {
    const tabViews = new Set<string>(TAB_ITEMS.map(t => t.view).filter(v => v !== 'more'));
    const moreViews: string[] = MORE_SECTIONS.flatMap(s => s.items.map(i => i.view));
    for (const v of moreViews) {
      expect(tabViews.has(v)).toBe(false);
    }
    // and no dupes within the More menu itself
    expect(new Set(moreViews).size).toBe(moreViews.length);
  });

  it('maps every View union member to a nav home', () => {
    const missing = ALL_VIEWS.filter(v => !(v in VIEW_TO_NAV));
    expect(missing).toEqual([]);
  });
});
