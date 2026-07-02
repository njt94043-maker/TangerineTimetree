import type { AppNotification } from '@shared/supabase/types';

interface NotificationPanelProps {
  items: AppNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  // Optional "Turn on push" nudge (S243 slice 2), shown only when this device
  // can subscribe but hasn't. The full opt-in lives in Settings → Notifications.
  canEnablePush?: boolean;
  onEnablePush?: () => void;
}

function timeAgo(iso: string): string {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Dropdown list shown under the header bell. Clicking an unread item marks it
// read (deep-linking related_id is a later slice). Reuses the dark theme.
export function NotificationPanel({ items, onMarkRead, onMarkAllRead, canEnablePush, onEnablePush }: NotificationPanelProps) {
  const hasUnread = items.some(n => !n.read);
  return (
    <div className="notif-panel" role="dialog" aria-label="Notifications">
      <div className="notif-panel-head">
        <span className="notif-panel-title">Notifications</span>
        {hasUnread && (
          <button className="notif-markall" onClick={onMarkAllRead}>Mark all read</button>
        )}
      </div>
      {canEnablePush && onEnablePush && (
        <button
          className="notif-push-nudge"
          onClick={onEnablePush}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '8px 14px', fontSize: 12, cursor: 'pointer',
            color: 'var(--color-green)', background: 'transparent',
            border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          🔔 Turn on push notifications for this device
        </button>
      )}
      <div className="notif-list">
        {items.length === 0 ? (
          <div className="notif-empty">You're all caught up.</div>
        ) : (
          items.map(n => (
            <button
              key={n.id}
              className={`notif-item${n.read ? '' : ' unread'}`}
              onClick={() => { if (!n.read) onMarkRead(n.id); }}
            >
              <div className="notif-item-row">
                <span className="notif-item-title">{n.title}</span>
                <span className="notif-item-time">{timeAgo(n.created_at)}</span>
              </div>
              {n.body && <div className="notif-item-body">{n.body}</div>}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
