import { useEffect } from 'react';
import type { View } from '../types';

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
    title: 'Library',
    items: [
      { icon: '\uD83C\uDFB5', label: 'All Tracks', view: 'library' },
    ],
  },
  {
    title: 'Record',
    items: [
      { icon: '\uD83C\uDF99\uFE0F', label: 'WASAPI Capture', view: 'capture' },
    ],
  },
  {
    title: 'System',
    items: [
      { icon: '\u2699\uFE0F', label: 'Server', view: 'server' },
    ],
  },
];

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  view: View;
  onNav: (v: View) => void;
  connected: boolean;
}

export function Drawer({ isOpen, onClose, view, onNav, connected }: DrawerProps) {
  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Map detail view to library for active state
  const activeNav = view === 'detail' ? 'library' : view;

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
          <img src="/icon-192.png" alt="" className="drawer-logo-img" />
          <span className="drawer-logo">
            <span className="drawer-logo-green">Audio </span>
            <span className="drawer-logo-orange">Capture</span>
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
                  onClick={() => onNav(item.view)}
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
          <div className="drawer-item" style={{ cursor: 'default' }}>
            <span className="drawer-icon">
              <span className={`conn-dot ${connected ? 'ok' : ''}`} />
            </span>
            <span className="drawer-label" style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {connected ? 'Backend connected' : 'Backend offline'}
            </span>
          </div>
        </div>
      </nav>
    </>
  );
}
