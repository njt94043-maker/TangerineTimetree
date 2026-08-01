import { DEPLOY_ENV, IS_PRODUCTION_DEPLOY } from '../lib/deployEnv';

// F0 fork slice — the PREVIEW chip.
//
// The `cutover` branch deploys to a Vercel preview URL with the same name, the
// same icon and the same colours as the live app the band uses. Same-looking
// builds on two URLs is a foot-gun during the migration, so a non-production
// build says so, unmissably, on every screen.
//
// Mounted once in main.tsx (alongside the __APP_VERSION__ assignment, same
// precedent) so it covers the splash, the public site, the QR landing, the
// practice mixer and the main app without touching any of them.
//
// Renders NOTHING on production, so thegreentangerine.com and its prod smoke
// are byte-for-byte unaffected. Fixed + pointer-events:none (see .preview-badge
// in App.css) so it can never sit in front of a tap target.
export function PreviewBadge() {
  if (IS_PRODUCTION_DEPLOY) return null;
  return (
    <div className="preview-badge" aria-label={`Preview build (${DEPLOY_ENV})`}>
      PREVIEW
    </div>
  );
}
