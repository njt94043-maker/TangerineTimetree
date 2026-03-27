import { useState, useEffect, useCallback } from 'react';
import { useView } from '../hooks/useViewContext';
import { AppTutorial } from './AppTutorial';

type View = ReturnType<typeof useView>['view'];

interface NavItem {
  icon: string;
  label: string;
  view: View;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Calendar',
    items: [
      { icon: '\uD83D\uDCC5', label: 'Calendar', view: 'calendar' },
      { icon: '\uD83D\uDCCB', label: 'Gig List', view: 'list' },
      { icon: '\u2708\uFE0F', label: 'Away Dates', view: 'away' },
    ],
  },
  {
    title: 'Business',
    items: [
      { icon: '\uD83D\uDCCA', label: 'Dashboard', view: 'dashboard' },
      { icon: '\uD83D\uDCC4', label: 'Invoices', view: 'invoices' },
      { icon: '\uD83D\uDCDD', label: 'Quotes', view: 'quotes' },
      { icon: '\uD83D\uDC65', label: 'Clients', view: 'clients' },
      { icon: '\uD83C\uDFE2', label: 'Venues', view: 'venues' },
    ],
  },
  {
    title: 'Music',
    items: [
      { icon: '\uD83C\uDFB5', label: 'Library', view: 'library' },
    ],
  },
  {
    title: 'Recording',
    items: [
      { icon: '\uD83D\uDCF9', label: 'XR18 Camera', view: 'xr18-camera' },
    ],
  },
  {
    title: 'Band',
    items: [
      { icon: '\uD83D\uDDBC\uFE0F', label: 'Media', view: 'media' },
      { icon: '\uD83D\uDCEC', label: 'Enquiries', view: 'enquiries' },
      { icon: '\uD83C\uDF10', label: 'Website', view: 'website' },
    ],
  },
];

const FOOTER_ITEMS: NavItem[] = [
  { icon: '\uD83D\uDC64', label: 'Profile', view: 'profile' },
  { icon: '\u2699\uFE0F', label: 'Settings', view: 'settings' },
];

// Views that correspond to a top-level nav item (not sub-views like invoice-detail)
const VIEW_TO_NAV: Record<string, View> = {
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
  'songs': 'library',
  'song-form': 'library',
  'setlists': 'library',
  'setlist-detail': 'library',
  'library': 'library',
  'player': 'library',
  'media': 'media',
  'enquiries': 'enquiries',
  'website': 'website',
  'profile': 'profile',
  'settings': 'settings',
  'day-detail': 'calendar',
  'gig-form': 'calendar',
  'xr18-camera': 'xr18-camera',
};

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profileName: string;
}

export function Drawer({ isOpen, onClose, profileName }: DrawerProps) {
  const { view, setView, goToDashboard, goToInvoices, goToQuotes, goToSettings, goToClients, goToVenues, goToLibrary, goToXR18Camera } = useView();
  const [showTutorial, setShowTutorial] = useState(false);

  const activeNav = VIEW_TO_NAV[view] ?? 'calendar';

  const handleNav = useCallback((targetView: View) => {
    switch (targetView) {
      case 'dashboard': goToDashboard(); break;
      case 'invoices': goToInvoices(); break;
      case 'quotes': goToQuotes(); break;
      case 'settings': goToSettings(); break;
      case 'clients': goToClients(); break;
      case 'venues': goToVenues(); break;
      case 'library': goToLibrary(); break;
      case 'xr18-camera': goToXR18Camera(); break;
      default: setView(targetView);
    }
    // Close on mobile
    if (window.innerWidth < 768) onClose();
  }, [setView, goToDashboard, goToInvoices, goToQuotes, goToSettings, goToClients, goToVenues, goToLibrary, goToXR18Camera, onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Overlay (mobile only) */}
      <div
        className={`drawer-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <nav className={`drawer ${isOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <img src="/logo-512.png" alt="" className="drawer-logo-img" />
          <span className="drawer-logo">
            <span className="drawer-logo-green">Tangerine</span>{' '}
            <span className="drawer-logo-orange">Timetree</span>
          </span>
        </div>

        <div className="drawer-nav">
          {NAV_SECTIONS.map(section => (
            <div key={section.title}>
              <div className="drawer-section">{section.title}</div>
              {section.items.map(item => (
                <button
                  key={item.view}
                  className={`drawer-item ${activeNav === item.view ? 'active' : ''}`}
                  onClick={() => handleNav(item.view)}
                  title={item.label}
                >
                  <span className="drawer-icon">{item.icon}</span>
                  <span className="drawer-label">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="drawer-footer">
          <button
            className="drawer-item"
            onClick={() => { setShowTutorial(true); if (window.innerWidth < 768) onClose(); }}
            title="App Guide"
          >
            <span className="drawer-icon">{'\uD83C\uDF93'}</span>
            <span className="drawer-label">App Guide</span>
          </button>
          {FOOTER_ITEMS.map(item => (
            <button
              key={item.view}
              className={`drawer-item ${activeNav === item.view ? 'active' : ''}`}
              onClick={() => handleNav(item.view)}
              title={item.label}
            >
              <span className="drawer-icon">{item.icon}</span>
              <span className="drawer-label">{item.label}</span>
            </button>
          ))}
          <div className="drawer-user">
            <div className="drawer-avatar">{profileName?.[0] ?? 'U'}</div>
            <span className="drawer-label drawer-user-name">{profileName}</span>
          </div>
        </div>
      </nav>

      {showTutorial && <AppTutorial onClose={() => setShowTutorial(false)} />}
    </>
  );
}
