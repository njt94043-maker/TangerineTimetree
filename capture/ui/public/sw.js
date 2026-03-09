// Minimal service worker for PWA installability
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  // Network-first for everything (local tool, always online)
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
