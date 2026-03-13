import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import App from './App.tsx'

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
    <App />
  </StrictMode>,
)
