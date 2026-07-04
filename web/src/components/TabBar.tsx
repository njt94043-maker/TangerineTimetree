import { useView } from '../hooks/useViewContext';
import { TAB_ITEMS, VIEW_TO_NAV, type NavItem } from '../nav/navConfig';

// Fixed bottom tab bar — the calendar-first shell's primary nav (s258).
// Persists in every authed view (desktop included; it simply stays put ≥768px).
// Class names `tab-bar` / `tab-item` (+ `active`) are asserted by the prod smoke.
export function TabBar() {
  const { view, setView, goToInvoices } = useView();
  const active = VIEW_TO_NAV[view];

  // Nav semantics copied from the old Drawer.handleNav: invoices has its own
  // reset helper; calendar/list/more use the generic setView (== resetToView —
  // a stack reset, which is the correct behaviour for a top-level tab).
  const handleTab = (item: NavItem) => {
    if (item.view === 'invoices') goToInvoices();
    else setView(item.view);
  };

  return (
    <nav className="tab-bar" aria-label="Primary">
      {TAB_ITEMS.map(item => {
        const isActive = active === item.view;
        return (
          <button
            key={item.view}
            className={`tab-item ${isActive ? 'active' : ''}`}
            onClick={() => handleTab(item)}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="tab-icon" aria-hidden="true">{item.icon}</span>
            <span className="tab-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
