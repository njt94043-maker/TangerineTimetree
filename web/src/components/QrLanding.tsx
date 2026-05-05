/**
 * S129 row 3 — QR-code landing page.
 *
 * Renders REGARDLESS of auth status. Even logged-in band members who scan the
 * QR card land here, not on their dashboard.
 *
 * Brand-locked to match the rest of TGT Web (`App.css` tokens + the splash):
 * dark `--bg-primary`, the half-orange logo, the three-word
 * "The Green / Tangerine" title with green + tangerine accent words, neon
 * glow shadows, Karla body / JetBrains Mono labels.
 */
import { useState } from 'react';
import './QrLanding.css';

const SOCIAL_LINKS = [
  { label: 'Facebook', url: 'https://www.facebook.com/profile.php?id=61559549376238', accent: 'green' as const },
  { label: 'Instagram', url: 'https://www.instagram.com/thegreentangerine', accent: 'tangerine' as const },
  { label: 'TikTok', url: 'https://www.tiktok.com/@thegreentangerine01', accent: 'green' as const },
  { label: 'Website', url: 'https://thegreentangerine.com', accent: 'tangerine' as const },
];

const FB_REVIEW_URL = 'https://www.facebook.com/profile.php?id=61559549376238/reviews';

export function QrLanding() {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="qr">
      <header className="qr__header">
        <div className="qr__logo-wrap">
          <div className="qr__logo-glow" />
          <img src="/logo-512.png" alt="The Green Tangerine" className="qr__logo" />
        </div>
        <div className="qr__title">
          <span className="qr__title-the">The</span>
          <span className="qr__title-green">Green</span>
          <span className="qr__title-tangerine">Tangerine</span>
        </div>
        <div className="qr__tagline">
          <span className="qr__tagline-line" />
          <span className="qr__tagline-text">THANKS FOR COMING TO THE GIG</span>
          <span className="qr__tagline-line" />
        </div>
      </header>

      <section className="qr__actions">
        <a
          href={FB_REVIEW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="qr__cta qr__cta--tangerine"
        >
          <span className="qr__cta-emoji">★</span>
          <span className="qr__cta-text">
            <strong>Leave a Facebook review</strong>
            <small>30 seconds — really helps us land more gigs</small>
          </span>
        </a>

        <button
          type="button"
          onClick={() => setShowUpload(true)}
          className="qr__cta qr__cta--green"
        >
          <span className="qr__cta-emoji">📷</span>
          <span className="qr__cta-text">
            <strong>Send us your photos / videos</strong>
            <small>from your gallery — we use them in our highlights</small>
          </span>
        </button>

        <div className="qr__cta qr__cta--ghost">
          <span className="qr__cta-text">
            <strong>Get the Capture app</strong>
            <small>coming soon — auto-captures clips at the next gig</small>
          </span>
        </div>
      </section>

      <section className="qr__socials">
        <div className="qr__socials-label">FOLLOW THE BAND</div>
        <div className="qr__socials-grid">
          {SOCIAL_LINKS.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`qr__social qr__social--${link.accent}`}
            >
              {link.label}
            </a>
          ))}
        </div>
      </section>

      <footer className="qr__footer">thegreentangerine.com</footer>

      {showUpload && <FanUploadPlaceholder onClose={() => setShowUpload(false)} />}
    </div>
  );
}

function FanUploadPlaceholder({ onClose }: { onClose: () => void }) {
  return (
    <div className="qr__modal-scrim" onClick={onClose}>
      <div className="qr__modal" onClick={(e) => e.stopPropagation()}>
        <div className="qr__modal-title">Coming soon</div>
        <div className="qr__modal-body">
          We're still wiring up the upload. For now, send your clips to us via Facebook
          and we'll grab them. Thanks for the support!
        </div>
        <button type="button" onClick={onClose} className="qr__modal-close">
          Got it
        </button>
      </div>
    </div>
  );
}
