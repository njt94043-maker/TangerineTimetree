import { useState, useEffect } from 'react';
import { getPublicGigs, getPublicProfiles, getPublicMedia, submitContactForm } from '@shared/supabase/queries';
import type { Gig, Profile, PublicMedia } from '@shared/supabase/types';

interface PublicSiteProps {
  onLogin: () => void;
}

// Hardcoded fallback band members (in case anon can't read profiles)
const FALLBACK_MEMBERS = [
  { name: 'Nathan', band_role: 'Lead Guitar & Vocals', avatar_url: '' },
  { name: 'Neil', band_role: 'Rhythm Guitar & Vocals', avatar_url: '' },
  { name: 'James', band_role: 'Bass Guitar', avatar_url: '' },
  { name: 'Adam', band_role: 'Drums', avatar_url: '' },
];

const PRICING_TIERS = [
  {
    name: 'Pub Gig',
    price: '\u00a3400\u2013\u00a3600',
    duration: '2\u00d745min + 15min encore',
    features: ['Full 4-piece band', 'PA & lighting included', 'Flexible setlist', 'Background music between sets'],
    popular: false,
  },
  {
    name: 'Private Party',
    price: '\u00a3600\u2013\u00a3800',
    duration: '2\u00d745min + 15min encore',
    features: ['Everything in Pub Gig', 'Custom setlist options', 'MC & announcements', 'Party atmosphere guaranteed'],
    popular: true,
  },
  {
    name: 'Wedding',
    price: '\u00a3800\u2013\u00a31,200',
    duration: '2\u00d745min + 15min encore',
    features: ['Everything in Private Party', 'First dance song', 'Tailored setlist', 'Venue coordination'],
    popular: false,
  },
  {
    name: 'Corporate',
    price: '\u00a31,000\u2013\u00a31,500',
    duration: '2\u00d745min + 15min encore',
    features: ['Everything in Wedding', 'Corporate-appropriate setlist', 'Professional attire', 'Background music option'],
    popular: false,
  },
  {
    name: 'Festival',
    price: '\u00a31,000+',
    duration: '45\u201390min set',
    features: ['Festival-ready performance', 'High-energy crowd engagement', 'Flexible set length', 'Own backline available'],
    popular: false,
  },
];

const BENEFITS = [
  { title: 'Fully Self-Contained', desc: 'Professional PA and lighting included. No need to hire anything extra.' },
  { title: 'Quick Setup & Soundcheck', desc: '45-minute setup, efficient packdown. Minimal disruption to your venue.' },
  { title: 'Flexible Set Options', desc: '2\u00d745 minute sets or 1\u00d790 minutes. We adapt to your event schedule.' },
  { title: 'Volume Control', desc: 'We adjust our volume to suit your venue and event. Background music between sets.' },
  { title: 'Fully Insured', desc: 'Public liability insurance and PAT-tested equipment. Peace of mind guaranteed.' },
  { title: 'Proven Track Record', desc: '100% recommended across pubs, weddings, and private events in South Wales.' },
];

export function PublicSite({ onLogin }: PublicSiteProps) {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [media, setMedia] = useState<PublicMedia[]>([]);
  const [members, setMembers] = useState<{ name: string; band_role: string; avatar_url: string }[]>(FALLBACK_MEMBERS);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', event_type: '', date: '', message: '' });
  const [contactStatus, setContactStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    getPublicGigs()
      .then(data => setGigs(data))
      .catch(() => {});
    getPublicProfiles()
      .then((profiles: Profile[]) => {
        if (profiles.length > 0) {
          setMembers(profiles.map(p => ({
            name: p.name,
            band_role: p.band_role || '',
            avatar_url: p.avatar_url || '',
          })));
        }
      })
      .catch(() => {});
    getPublicMedia()
      .then(data => setMedia(data))
      .catch(() => {});
  }, []);

  async function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    setContactStatus('sending');
    try {
      await submitContactForm({
        name: contactForm.name,
        email: contactForm.email,
        event_type: contactForm.event_type,
        preferred_date: contactForm.date || undefined,
        message: contactForm.message,
      });
      setContactStatus('sent');
      setContactForm({ name: '', email: '', event_type: '', date: '', message: '' });
    } catch {
      setContactStatus('error');
    }
  }

  function scrollTo(id: string) {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="public-site">
      {/* ─── Header ─── */}
      <header className="ps-header">
        <div className="ps-header-inner">
          <div className="ps-header-brand" onClick={() => scrollTo('hero')}>
            <img src="/logo.png" alt="The Green Tangerine" className="ps-header-logo" />
            <span className="ps-header-name">The Green Tangerine</span>
          </div>

          <nav className={`ps-nav ${mobileMenuOpen ? 'open' : ''}`}>
            <button className="ps-nav-link" onClick={() => scrollTo('about')}>About</button>
            <button className="ps-nav-link" onClick={() => scrollTo('venues')}>For Venues</button>
            <button className="ps-nav-link" onClick={() => scrollTo('pricing')}>Pricing</button>
            {media.length > 0 && <button className="ps-nav-link" onClick={() => scrollTo('gallery')}>Gallery</button>}
            <button className="ps-nav-link" onClick={() => scrollTo('contact')}>Contact</button>
            <button className="ps-login-btn" onClick={onLogin}>Band Login</button>
          </nav>

          <button
            className="ps-hamburger"
            onClick={() => setMobileMenuOpen(v => !v)}
            aria-label="Toggle menu"
          >
            <span className={`ps-hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
            <span className={`ps-hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
            <span className={`ps-hamburger-line ${mobileMenuOpen ? 'open' : ''}`} />
          </button>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section id="hero" className="ps-hero">
        <div className="ps-hero-overlay" />
        <div className="ps-hero-content">
          <h1 className="ps-hero-title">The Green Tangerine</h1>
          <p className="ps-hero-subtitle">South Wales Function Band</p>
          <p className="ps-hero-tagline">
            Live rock covers for pubs, weddings & events across Cardiff, Swansea, Bridgend, Neath & the Rhondda
          </p>
          <div className="ps-hero-cta">
            <button className="ps-btn ps-btn-primary" onClick={() => scrollTo('contact')}>Book Us</button>
            <button className="ps-btn ps-btn-secondary" onClick={() => scrollTo(media.length > 0 ? 'gallery' : 'about')}>
              {media.length > 0 ? 'View Gallery' : 'Learn More'}
            </button>
          </div>
          <div className="ps-hero-social">
            <a href="https://www.facebook.com/profile.php?id=61559549376238" target="_blank" rel="noopener noreferrer" className="ps-social-link">Facebook</a>
            <a href="https://www.tiktok.com/@thegreentangerine01" target="_blank" rel="noopener noreferrer" className="ps-social-link">TikTok</a>
          </div>
        </div>
      </section>

      {/* ─── Upcoming Gigs ─── */}
      {gigs.length > 0 && (
        <section id="gigs" className="ps-section">
          <h2 className="ps-section-title">Upcoming Gigs</h2>
          <div className="ps-gigs-grid">
            {gigs.slice(0, 6).map(gig => (
              <div key={gig.id} className="ps-gig-card">
                <div className="ps-gig-date">
                  {formatGigDate(gig.date)}
                </div>
                <div className="ps-gig-info">
                  <span className="ps-gig-venue">{gig.venue || 'TBC'}</span>
                  {gig.start_time && (
                    <span className="ps-gig-time">{formatTime(gig.start_time)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── About ─── */}
      <section id="about" className="ps-section">
        <h2 className="ps-section-title">About the Band</h2>
        <div className="ps-about-content">
          <p className="ps-about-text">
            The Green Tangerine is a tribute to classic rock, bringing you revamped high energy rock
            classics guaranteed to get the hips swinging. From Led Zeppelin to The Rolling Stones, from
            Pink Floyd to The Red Hot Chilli Peppers, we cover all the legends with authenticity and passion.
          </p>
          <p className="ps-about-text">
            Based in the Rhondda, performing at venues across South Wales including Cardiff, Swansea,
            Bridgend, Neath, Pontypridd, and beyond. Whether it's a pub gig, wedding, corporate event,
            or festival, we deliver unforgettable performances.
          </p>
          <p className="ps-about-slogan">We don't just play &mdash; we display!</p>

          <div className="ps-members-grid">
            {members.map((m, i) => (
              <div key={i} className="ps-member-card">
                <div className="ps-member-avatar">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt={m.name} className="ps-member-img" />
                  ) : (
                    <div className="ps-member-placeholder">{m.name.charAt(0)}</div>
                  )}
                </div>
                <div className="ps-member-name">{m.name}</div>
                {m.band_role && <div className="ps-member-role">{m.band_role}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── For Venues ─── */}
      <section id="venues" className="ps-section ps-section-alt">
        <h2 className="ps-section-title">For Venues</h2>
        <p className="ps-section-subtitle">Reliable. Professional. Crowd-Pleasing.</p>
        <div className="ps-benefits-grid">
          {BENEFITS.map((b, i) => (
            <div key={i} className="ps-benefit-card">
              <h3 className="ps-benefit-title">{b.title}</h3>
              <p className="ps-benefit-desc">{b.desc}</p>
            </div>
          ))}
        </div>

        <div className="ps-testimonials">
          <div className="ps-testimonial">
            <p className="ps-testimonial-text">
              "The Green Tangerine brought amazing energy to our venue. The crowd loved every minute
              and we've had requests to book them again."
            </p>
            <span className="ps-testimonial-author">&mdash; Cardiff Venue</span>
          </div>
          <div className="ps-testimonial">
            <p className="ps-testimonial-text">
              "Professional setup, great communication, and an incredible live show. Exactly what we
              were looking for."
            </p>
            <span className="ps-testimonial-author">&mdash; Bridgend Function Room</span>
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="ps-section">
        <h2 className="ps-section-title">Pricing</h2>
        <p className="ps-section-subtitle">Transparent pricing with no hidden extras</p>
        <div className="ps-pricing-grid">
          {PRICING_TIERS.map((tier, i) => (
            <div key={i} className={`ps-pricing-card ${tier.popular ? 'popular' : ''}`}>
              {tier.popular && <span className="ps-popular-badge">Most Popular</span>}
              <h3 className="ps-pricing-name">{tier.name}</h3>
              <div className="ps-pricing-price">{tier.price}</div>
              <div className="ps-pricing-duration">{tier.duration}</div>
              <ul className="ps-pricing-features">
                {tier.features.map((f, j) => (
                  <li key={j}>{f}</li>
                ))}
              </ul>
              <button className="ps-btn ps-btn-primary ps-btn-small" onClick={() => scrollTo('contact')}>
                Enquire
              </button>
            </div>
          ))}
        </div>
        <div className="ps-pricing-extras">
          <h3>Additional Services</h3>
          <ul>
            <li>Travel within 50 miles included</li>
            <li>Additional travel: \u00a30.50/mile</li>
            <li>Extra sets: \u00a3100\u2013\u00a3200/hour</li>
            <li>Custom song requests (with advance notice)</li>
            <li>PA hire for speeches: \u00a3150</li>
          </ul>
        </div>
      </section>

      {/* ─── Gallery ─── */}
      {media.length > 0 && (
        <section id="gallery" className="ps-section">
          <h2 className="ps-section-title">Gallery</h2>
          <p className="ps-section-subtitle">Photos & videos from our gigs</p>
          <div className="ps-gallery-grid">
            {media.map(item => (
              <div key={item.id} className="ps-gallery-item">
                {item.media_type === 'photo' ? (
                  <img
                    src={item.url}
                    alt={item.title || 'The Green Tangerine live'}
                    className="ps-gallery-img"
                    loading="lazy"
                    onClick={() => setLightboxImg(item.url)}
                  />
                ) : (
                  <div className="ps-gallery-video">
                    <iframe
                      src={item.video_embed_url || item.url}
                      title={item.title || 'Video'}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                    />
                  </div>
                )}
                {item.title && <div className="ps-gallery-caption">{item.title}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lightbox */}
      {lightboxImg && (
        <div className="ps-lightbox" onClick={() => setLightboxImg(null)}>
          <button className="ps-lightbox-close" onClick={() => setLightboxImg(null)} aria-label="Close">&times;</button>
          <img src={lightboxImg} alt="Full size" className="ps-lightbox-img" />
        </div>
      )}

      {/* ─── Contact ─── */}
      <section id="contact" className="ps-section ps-section-alt">
        <h2 className="ps-section-title">Get in Touch</h2>
        <p className="ps-section-subtitle">Ready to book? Drop us a message</p>
        <div className="ps-contact-content">
          <div className="ps-contact-info">
            <div className="ps-contact-item">
              <span className="ps-contact-label">Email</span>
              <a href="mailto:thegreentangerine01@gmail.com" className="ps-contact-value">
                thegreentangerine01@gmail.com
              </a>
            </div>
            <div className="ps-contact-item">
              <span className="ps-contact-label">Based In</span>
              <span className="ps-contact-value">Rhondda, South Wales</span>
            </div>
            <div className="ps-contact-item">
              <span className="ps-contact-label">Covering</span>
              <span className="ps-contact-value">Cardiff, Swansea, Bridgend, Neath, Pontypridd, Merthyr Tydfil & beyond</span>
            </div>
          </div>

          <form className="ps-contact-form" onSubmit={handleContactSubmit}>
            <div className="ps-form-row">
              <div className="ps-form-group">
                <label className="ps-form-label" htmlFor="cf-name">Your Name</label>
                <input
                  id="cf-name"
                  className="ps-form-input"
                  type="text"
                  required
                  value={contactForm.name}
                  onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. John Smith"
                />
              </div>
              <div className="ps-form-group">
                <label className="ps-form-label" htmlFor="cf-email">Email Address</label>
                <input
                  id="cf-email"
                  className="ps-form-input"
                  type="email"
                  required
                  value={contactForm.email}
                  onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="you@email.com"
                />
              </div>
            </div>
            <div className="ps-form-row">
              <div className="ps-form-group">
                <label className="ps-form-label" htmlFor="cf-type">Event Type</label>
                <select
                  id="cf-type"
                  className="ps-form-input"
                  value={contactForm.event_type}
                  onChange={e => setContactForm(f => ({ ...f, event_type: e.target.value }))}
                >
                  <option value="">Select...</option>
                  <option value="Pub Gig">Pub Gig</option>
                  <option value="Private Party">Private Party</option>
                  <option value="Wedding">Wedding</option>
                  <option value="Corporate">Corporate Event</option>
                  <option value="Festival">Festival</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="ps-form-group">
                <label className="ps-form-label" htmlFor="cf-date">Preferred Date</label>
                <input
                  id="cf-date"
                  className="ps-form-input"
                  type="date"
                  value={contactForm.date}
                  onChange={e => setContactForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>
            </div>
            <div className="ps-form-group">
              <label className="ps-form-label" htmlFor="cf-msg">Message</label>
              <textarea
                id="cf-msg"
                className="ps-form-input ps-form-textarea"
                required
                rows={4}
                value={contactForm.message}
                onChange={e => setContactForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Tell us about your event - venue, location, any special requests..."
              />
            </div>
            <button
              type="submit"
              className="ps-btn ps-btn-primary"
              disabled={contactStatus === 'sending'}
              style={{ width: '100%', marginTop: 8 }}
            >
              {contactStatus === 'sending' ? 'Sending...' : contactStatus === 'sent' ? 'Sent!' : 'Send Booking Enquiry'}
            </button>
            {contactStatus === 'sent' && (
              <p className="ps-form-success">Thanks! We'll get back to you soon.</p>
            )}
            {contactStatus === 'error' && (
              <p className="ps-form-error">
                Something went wrong. You can also email us directly at{' '}
                <a href="mailto:thegreentangerine01@gmail.com">thegreentangerine01@gmail.com</a>
              </p>
            )}
          </form>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="ps-footer">
        <div className="ps-footer-inner">
          <div className="ps-footer-brand">
            <img src="/logo.png" alt="TGT" className="ps-footer-logo" />
            <span className="ps-footer-name">The Green Tangerine</span>
            <span className="ps-footer-tagline">South Wales Function Band</span>
          </div>
          <div className="ps-footer-areas">
            Cardiff &bull; Swansea &bull; Bridgend &bull; Neath &bull; Pontypridd &bull; Rhondda
          </div>
          <div className="ps-footer-social">
            <a href="https://www.facebook.com/profile.php?id=61559549376238" target="_blank" rel="noopener noreferrer">Facebook</a>
            <a href="https://www.tiktok.com/@thegreentangerine01" target="_blank" rel="noopener noreferrer">TikTok</a>
          </div>
          <div className="ps-footer-bottom">
            <span>&copy; {new Date().getFullYear()} The Green Tangerine. All rights reserved.</span>
            <span className="ps-footer-slogan">Keep It Green!</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function formatGigDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const h12 = hour % 12 || 12;
  return `${h12}:${m}${ampm}`;
}
