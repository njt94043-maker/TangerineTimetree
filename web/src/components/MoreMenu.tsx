import { useView } from '../hooks/useViewContext';
import { MORE_SECTIONS, type NavItem } from '../nav/navConfig';

// The "More" view — the overflow home for every destination not on a tab
// (s258). Rendered as view === 'more' in App's main switch. Grouped list from
// MORE_SECTIONS; row class `more-item` is asserted by the prod smoke.
export function MoreMenu() {
  const {
    setView, goToDashboard, goToQuotes, goToSettings,
    goToClients, goToVenues, goToLibrary,
  } = useView();

  // Same mapping the old Drawer.handleNav used, minus the tab'd destinations:
  // dashboard/quotes/settings/clients/venues/library route via their goTo*
  // helpers; everything else (away, availability, media, enquiries, website,
  // profile) uses the generic setView.
  const handleNav = (item: NavItem) => {
    switch (item.view) {
      case 'dashboard': goToDashboard(); break;
      case 'quotes': goToQuotes(); break;
      case 'settings': goToSettings(); break;
      case 'clients': goToClients(); break;
      case 'venues': goToVenues(); break;
      case 'library': goToLibrary(); break;
      default: setView(item.view);
    }
  };

  return (
    <div className="more-view">
      {MORE_SECTIONS.map(section => (
        <div key={section.title} className="more-section">
          <div className="more-section-title">{section.title}</div>
          <div className="more-list neu-card">
            {section.items.map(item => (
              <button
                key={item.view}
                className="more-item"
                onClick={() => handleNav(item)}
              >
                <span className="more-item-icon" aria-hidden="true">{item.icon}</span>
                <span className="more-item-label">{item.label}</span>
                <span className="more-item-chevron" aria-hidden="true">{'›'}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
