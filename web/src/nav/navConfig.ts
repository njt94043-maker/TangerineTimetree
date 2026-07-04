// ─── Navigation config — single source of nav truth (s258) ───
// The bottom tab bar + the "More" menu both read from here. Replaces the
// data/logic that used to live in components/Drawer.tsx (now retired).
//
// Guardrail (s244 / D-120): every one of the 15 top-level destinations stays
// reachable in <=2 taps. navConfig.test.ts enforces the exact set — nothing
// added, nothing lost. VIEW_TO_NAV is typed Record<View, View> so a new View
// union member fails `tsc` until it is given a nav home.
//
// Icons reuse the exact drawer emoji (\u-escaped, matching the old Drawer.tsx
// convention on this box).

import type { useView } from '../hooks/useViewContext';

// Derive the View union from the context (mirrors Drawer's old approach) so
// this file has no runtime dependency on useViewContext.
type View = ReturnType<typeof useView>['view'];

export interface NavItem {
  icon: string;
  label: string;
  view: View;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

// The four persistent bottom tabs.
export const TAB_ITEMS: NavItem[] = [
  { label: 'Calendar', view: 'calendar', icon: '\ud83d\udcc5' },
  { label: 'Gigs', view: 'list', icon: '\ud83d\udccb' },
  { label: 'Money', view: 'invoices', icon: '\ud83d\udcc4' },
  { label: 'More', view: 'more', icon: '\u22ef' },
];

// Everything not on a tab, grouped for the More view. This is the old
// NAV_SECTIONS + FOOTER_ITEMS MINUS the three tab'd destinations
// (calendar, list, invoices) — 12 items total.
export const MORE_SECTIONS: NavSection[] = [
  {
    title: 'Calendar',
    items: [
      { icon: '\u2708\ufe0f', label: 'Away Dates', view: 'away' },
      { icon: '\u2705', label: 'Availability', view: 'availability' },
    ],
  },
  {
    title: 'Business',
    items: [
      { icon: '\ud83d\udcca', label: 'Dashboard', view: 'dashboard' },
      { icon: '\ud83d\udcdd', label: 'Quotes', view: 'quotes' },
      { icon: '\ud83d\udc65', label: 'Clients', view: 'clients' },
      { icon: '\ud83c\udfe2', label: 'Venues', view: 'venues' },
      { icon: '\ud83d\udce5', label: 'Imports', view: 'imports' },
    ],
  },
  {
    title: 'Music',
    items: [
      { icon: '\ud83c\udfb5', label: 'Library', view: 'library' },
    ],
  },
  {
    title: 'Band',
    items: [
      { icon: '\ud83d\uddbc\ufe0f', label: 'Media', view: 'media' },
      { icon: '\ud83d\udcec', label: 'Enquiries', view: 'enquiries' },
      { icon: '\ud83c\udf10', label: 'Website', view: 'website' },
    ],
  },
  {
    title: 'Account',
    items: [
      { icon: '\ud83d\udc64', label: 'Profile', view: 'profile' },
      { icon: '\u2699\ufe0f', label: 'Settings', view: 'settings' },
    ],
  },
];

// Maps every View (incl. drill-down sub-views) to the top-level nav home used
// for tab-active state. Typed Record<View, View> — the compiler now guarantees
// completeness. Extended from Drawer's old map: booking-wizard/day-detail/
// gig-form all live under Calendar; notifications + more live under More.
export const VIEW_TO_NAV: Record<View, View> = {
  'calendar': 'calendar',
  'list': 'list',
  'away': 'away',
  'dashboard': 'dashboard',
  'invoices': 'invoices',
  'invoice-form': 'invoices',
  'invoice-detail': 'invoices',
  'invoice-preview': 'invoices',
  'quotes': 'quotes',
  'quote-form': 'quotes',
  'quote-detail': 'quotes',
  'quote-preview': 'quotes',
  'clients': 'clients',
  'venues': 'venues',
  'venue-detail': 'venues',
  'library': 'library',
  'media': 'media',
  'enquiries': 'enquiries',
  'website': 'website',
  'profile': 'profile',
  'settings': 'settings',
  'day-detail': 'calendar',
  'gig-form': 'calendar',
  'availability': 'availability',
  'booking-wizard': 'calendar',
  'notifications': 'more',
  'more': 'more',
  'imports': 'imports',
};

// The complete set of top-level destinations: tab views (minus the More hub)
// plus every destination inside the More menu. Consumed by navConfig.test.ts
// as the guardrail assertion.
export const ALL_TOP_DESTINATIONS: View[] = [
  ...TAB_ITEMS.filter(t => t.view !== 'more').map(t => t.view),
  ...MORE_SECTIONS.flatMap(s => s.items.map(i => i.view)),
];
