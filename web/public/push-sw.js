/* Tangerine Timetree — Web Push handlers (S243 slice 2).
 *
 * Pulled into the Workbox-GENERATED service worker via VitePWA
 * workbox.importScripts: ['push-sw.js'] (generateSW mode stays — do NOT switch to
 * injectManifest, and do NOT add a second navigator.serviceWorker.register()).
 * Runs in the SW global scope, so keep this dependency-free plain JS. */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = {}; // non-JSON / empty payload → generic alert below
  }
  const title = data.title || 'Tangerine Timetree';
  const options = {
    body: data.body,
    icon: '/logo.png',
    badge: '/logo.png',
    data: { url: data.url || '/' },
    tag: data.tag,
    renotify: !!data.tag, // renotify requires a tag; guard so it never throws
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Focus an already-open app window (the in-app bell shows the alert);
        // otherwise open a fresh one at the target url.
        for (const client of clients) {
          if ('focus' in client) return client.focus();
        }
        return self.clients.openWindow(url);
      }),
  );
});
