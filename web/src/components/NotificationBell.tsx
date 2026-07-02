import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { NotificationPanel } from './NotificationPanel';

const BELL = '🔔'; // bell emoji (matches Drawer's escaped-icon convention)

// Header bell + unread badge (reuses .enquiries-badge). Toggles the dropdown
// panel; closes on outside click. Self-contained so App.tsx only mounts <it/>.
export function NotificationBell() {
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const push = usePushNotifications();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Nudge to enable push only when this device can subscribe but hasn't yet.
  const canEnablePush = push.supported && !push.subscribed && push.permission !== 'denied' && !push.iosNeedsInstall;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className="notif-bell-wrap" ref={wrapRef}>
      <button
        className="notif-bell"
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      >
        <span className="notif-bell-icon">{BELL}</span>
        {unreadCount > 0 && (
          <span className="enquiries-badge notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>
      {open && (
        <NotificationPanel
          items={items}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
          canEnablePush={canEnablePush}
          onEnablePush={() => { void push.enable(); }}
        />
      )}
    </div>
  );
}
