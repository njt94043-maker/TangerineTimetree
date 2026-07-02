import { useState, useEffect, useCallback } from 'react';
import { savePushSubscription, deletePushSubscription } from '@shared/supabase/queries';
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from '../lib/vapid';

export interface PushState {
  /** Browser exposes ServiceWorker + PushManager + Notification (false on an iOS Safari tab). */
  supported: boolean;
  /** Notification.permission — 'default' | 'granted' | 'denied'. */
  permission: NotificationPermission;
  /** THIS browser/device currently holds a push subscription. */
  subscribed: boolean;
  /** iPhone in a Safari tab: must Add to Home Screen (iOS 16.4+) before push works. */
  iosNeedsInstall: boolean;
  /** An enable()/disable() call is in flight. */
  busy: boolean;
  /** Last error message, if any. */
  error: string | null;
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPhone/iPad/iPod, plus iPadOS 13+ which reports as "Macintosh" with touch.
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (/macintosh/i.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document)
  );
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari-specific standalone flag (non-standard).
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// A device has exactly ONE physical push subscription, but the hook is mounted in
// two places at once (the header bell + Settings). Keep the persistent facts
// (permission + subscribed) in a tiny module-level store so every instance agrees
// without a full reload — enabling in Settings instantly clears the bell's nudge,
// and vice-versa (S243 review fix). busy/error stay per-instance.
let shared: { permission: NotificationPermission; subscribed: boolean } = {
  permission: 'default',
  subscribed: false,
};
const listeners = new Set<() => void>();
function setShared(patch: Partial<typeof shared>): void {
  shared = { ...shared, ...patch };
  listeners.forEach((l) => l());
}

// Web Push opt-in state machine (S243 slice 2). The browser is the source of
// truth for whether THIS device is subscribed (pushManager.getSubscription());
// the DB row is just a server-side mirror the notify-push edge fn fans out to.
export function usePushNotifications() {
  const supported = pushSupported();
  const [, bump] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe this instance to the shared store; re-render on any change.
  useEffect(() => {
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const permission = shared.permission;
  const subscribed = shared.subscribed;

  // iPhone in a plain Safari tab can't do Web Push until installed to the Home
  // Screen — surface a hint instead of a dead button (decision 6).
  const iosNeedsInstall = !supported && isIOS() && !isStandalone();

  const refresh = useCallback(async () => {
    if (!supported) {
      setShared({ subscribed: false });
      return;
    }
    setShared({ permission: Notification.permission });
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setShared({ subscribed: !!sub });
    } catch {
      setShared({ subscribed: false });
    }
  }, [supported]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Pick up a subscription made in another view/tab (or a permission change) when
  // the app regains focus — belt-and-braces on top of the shared store.
  useEffect(() => {
    if (!supported) return;
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [supported, refresh]);

  const enable = useCallback(async () => {
    if (!supported || busy) return;
    setBusy(true);
    setError(null);
    try {
      const perm = await Notification.requestPermission();
      setShared({ permission: perm });
      if (perm !== 'granted') {
        setError(
          perm === 'denied'
            ? 'Notifications are blocked. Enable them in your browser settings.'
            : 'Notification permission was not granted.',
        );
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      const createdNew = !sub;
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        if (createdNew) { try { await sub.unsubscribe(); } catch { /* best effort */ } }
        throw new Error('Push subscription is missing endpoint/keys.');
      }
      try {
        await savePushSubscription({
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
          user_agent: navigator.userAgent,
        });
      } catch (saveErr) {
        // Roll back the subscription we just created so we never leave an orphan
        // (browser subscribed, no server row → silently dead pushes). Leave a
        // pre-existing subscription alone.
        if (createdNew) { try { await sub.unsubscribe(); } catch { /* best effort */ } }
        throw saveErr;
      }
      setShared({ subscribed: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not enable notifications.');
    } finally {
      setBusy(false);
    }
  }, [supported, busy]);

  const disable = useCallback(async () => {
    if (!supported || busy) return;
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        try {
          await deletePushSubscription(endpoint);
        } catch {
          // Row cleanup is best-effort — the browser subscription is already gone,
          // and the edge fn prunes dead endpoints on the next 404/410 anyway.
        }
      }
      setShared({ subscribed: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not turn off notifications.');
    } finally {
      setBusy(false);
    }
  }, [supported, busy]);

  const state: PushState = { supported, permission, subscribed, iosNeedsInstall, busy, error };
  return { ...state, enable, disable, refresh };
}
