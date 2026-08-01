import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import App from './App.tsx'
import { PreviewBadge } from './components/PreviewBadge.tsx'

// Truthful build version (s258) — the prod smoke reads window.__APP_VERSION__.
(window as unknown as { __APP_VERSION__?: string }).__APP_VERSION__ = __APP_VERSION__;

// Deploy environment (F0) — same precedent as __APP_VERSION__ above, so the
// build's environment is checkable from the console/smoke as well as visible
// via <PreviewBadge/>. 'production' on thegreentangerine.com; 'preview' on the
// `cutover` branch deploy.
(window as unknown as { __DEPLOY_ENV__?: string }).__DEPLOY_ENV__ = __DEPLOY_ENV__;

// ── Service Worker: auto-reload on update ──
// When a new deploy goes live, the SW activates immediately (skipWaiting +
// clientsClaim). This listener detects the controller change and reloads
// the page so all users always run the latest code — no manual refresh needed.
if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });

  // Check for SW updates every 5 minutes (catches updates mid-session)
  setInterval(() => {
    navigator.serviceWorker.getRegistration().then(reg => reg?.update());
  }, 5 * 60 * 1000);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreviewBadge />
    <App />
  </StrictMode>,
)
