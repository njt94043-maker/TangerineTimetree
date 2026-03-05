import { useState, useEffect } from 'react';
import { getPublicGigs, getPublicMedia, getPublicReviews, getSiteContent, submitContactForm } from '@shared/supabase/queries';
import type { Gig, PublicMedia, SiteReview } from '@shared/supabase/types';

interface PublicSiteProps {
  onLogin: () => void;
}

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

// Static gallery photos from Facebook
const GALLERY_PHOTOS = [
  '597106079_122203114304318312_6658064872395739304_n.jpg',
  '599940850_122203114316318312_7234787539894986138_n.jpg',
  '597816557_122203114208318312_1511647365440667672_n.jpg',
  '597686988_122203114196318312_7380671637909424026_n.jpg',
  '597766945_122203114262318312_2855019826452984325_n.jpg',
  '599942438_122203114250318312_4715496230997956731_n.jpg',
  '598806438_122203114154318312_3738731288650294377_n.jpg',
  '597667933_122203114232318312_3376259773236282285_n.jpg',
  '597686467_122203114220318312_8499032770169649442_n.jpg',
  '599950695_122203114184318312_4075550291178093672_n.jpg',
  '599937526_122203114166318312_8822826353486095203_n.jpg',
  '596616100_122203114280318312_4774789225283861685_n.jpg',
  '599931778_122203114142318312_2510743017703448193_n.jpg',
  '599945802_122203522964318312_8505338935023776184_n.jpg',
  '559917240_122198179376318312_338513422612439942_n.jpg',
  '573046765_122198179160318312_6611713516069725623_n.jpg',
  '517373707_122184618476318312_9079173012852202353_n.jpg',
  '518292004_122184618194318312_7470469164487337077_n.jpg',
  '518178779_122184618356318312_5797258311142432207_n.jpg',
  '517932280_122184618398318312_7899127581410056593_n.jpg',
  '517593387_122184618308318312_1469287926402591328_n.jpg',
  '517658459_122184618320318312_918293111362977779_n.jpg',
  '517915069_122184618218318312_1289342786448300270_n.jpg',
  '516694328_122184618176318312_3053346118825880157_n.jpg',
  '472670979_122156629358318312_8073782115706429438_n.jpg',
  '472735587_122156647370318312_1328698029704239520_n.jpg',
  '475068530_122159718272318312_1808472951566202610_n.jpg',
  '475166599_122159718284318312_7103355741818100711_n.jpg',
  '475458199_122159718188318312_513881708284064786_n.jpg',
  '475756232_122160803756318312_5485839986337765140_n.jpg',
  '475794011_122160803684318312_2167642453336680850_n.jpg',
  '475870045_122160803702318312_5106760121842329194_n.jpg',
  '475944088_122160803738318312_3019678196786161403_n.jpg',
  '476220689_122160803516318312_6973583794071836750_n.jpg',
  '476603930_122160803714318312_2269170579322988337_n.jpg',
  '475101818_122159718266318312_8134630960279957291_n.jpg',
  '475167972_122159718278318312_3589011426051096025_n.jpg',
  '475818158_122160803678318312_6529702723166442073_n.jpg',
  '475904381_122160803510318312_6087368118378830505_n.jpg',
  '475951073_122160803540318312_5779162694975329062_n.jpg',
  '475990453_122160803648318312_48028581563210430_n.jpg',
  '476082222_122160242924318312_5404536789557330705_n.jpg',
  '599929404_122203522574318312_4278800614656553218_n.jpg',
  '601819856_122203522562318312_938249262472603777_n.jpg',
];

export function PublicSite({ onLogin }: PublicSiteProps) {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [media, setMedia] = useState<PublicMedia[]>([]);
  const [reviews, setReviews] = useState<SiteReview[]>([]);
  const [content, setContent] = useState<Record<string, string>>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({ name: '', email: '', event_type: '', date: '', message: '' });
  const [contactStatus, setContactStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    getPublicGigs().then(data => setGigs(data)).catch(() => {});
    getPublicMedia().then(data => setMedia(data)).catch(() => {});
    getPublicReviews().then(data => setReviews(data)).catch(() => {});
    getSiteContent().then(rows => {
      const map: Record<string, string> = {};
      for (const row of rows) map[row.key] = row.value;
      setContent(map);
    }).catch(() => {});
  }, []);

  // Helper: get content with fallback
  const c = (key: string, fallback: string) => content[key] || fallback;

  // Build pricing from content or fallbacks
  const pricingTiers = PRICING_TIERS.map(tier => {
    const prefix = `pricing_${tier.name.toLowerCase().replace(/\s+/g, '_')}`;
    const featuresRaw = content[`${prefix}_features`];
    let features = tier.features;
    if (featuresRaw) {
      try { features = JSON.parse(featuresRaw); } catch { /* keep default */ }
    }
    return {
      ...tier,
      price: content[`${prefix}_price`] || tier.price,
      duration: content[`${prefix}_duration`] || tier.duration,
      features,
    };
  });

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
      setTimeout(() => setContactStatus('idle'), 4000);
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
            {reviews.length > 0 && <button className="ps-nav-link" onClick={() => scrollTo('reviews')}>Reviews</button>}
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
      <section id="hero" className="ps-hero" style={{
        ...(content['bg_hero_desktop'] ? { '--bg-hero': `url('${content['bg_hero_desktop']}')` } : {}),
        ...(content['bg_hero_mobile'] ? { '--bg-hero-mobile': `url('${content['bg_hero_mobile']}')` } : {}),
      } as React.CSSProperties}>
        <div className="ps-hero-overlay" />
        <div className="ps-hero-content">
          <h1 className="ps-hero-title">The Green Tangerine</h1>
          <p className="ps-hero-subtitle">South Wales Function Band</p>
          <p className="ps-hero-tagline">
            {c('hero_tagline', 'Live rock covers for pubs, weddings & events across Cardiff, Swansea, Bridgend, Neath & the Rhondda')}
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
                  {gig.visibility === 'private' ? (
                    <span className="ps-gig-venue ps-gig-private">Private Booking</span>
                  ) : (
                    <>
                      <span className="ps-gig-venue">{gig.venue || 'TBC'}</span>
                      {gig.start_time && (
                        <span className="ps-gig-time">{formatTime(gig.start_time)}</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── About ─── */}
      <section id="about" className="ps-section ps-section-bg-about" style={{
        ...(content['bg_about'] ? { '--bg-about': `url('${content['bg_about']}')` } : {}),
      } as React.CSSProperties}>
        <h2 className="ps-section-title">About the Band</h2>
        <div className="ps-about-content">
          <p className="ps-about-text">
            {c('about_text_1', 'The Green Tangerine is a tribute to classic rock, bringing you revamped high energy rock classics guaranteed to get the hips swinging. From Led Zeppelin to The Rolling Stones, from Pink Floyd to The Red Hot Chilli Peppers, we cover all the legends with authenticity and passion.')}
          </p>
          <p className="ps-about-text">
            {c('about_text_2', 'Based in the Rhondda, performing at venues across South Wales including Cardiff, Swansea, Bridgend, Neath, Pontypridd, and beyond. Whether it\'s a pub gig, wedding, corporate event, or festival, we deliver unforgettable performances.')}
          </p>
          <p className="ps-about-slogan">{c('about_slogan', 'We don\'t just play \u2014 we display!')}</p>

          <p className="ps-about-text">A 4-piece live band from the Rhondda covering rock &amp; indie classics.</p>
        </div>
      </section>

      {/* ─── For Venues ─── */}
      <section id="venues" className="ps-section ps-section-alt ps-section-bg-venues" style={{
        ...(content['bg_venues'] ? { '--bg-venues': `url('${content['bg_venues']}')` } : {}),
      } as React.CSSProperties}>
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
      </section>

      {/* ─── Reviews ─── */}
      {reviews.length > 0 && (
        <section id="reviews" className="ps-section">
          <h2 className="ps-section-title">What People Say</h2>
          <div className="ps-reviews-header">
            <div className="ps-reviews-badge">
              <span className="ps-reviews-badge-icon">&#x1F44D;</span>
              {reviews.length} out of {reviews.length} recommend us on Facebook
            </div>
          </div>
          <div className="ps-reviews-grid">
            {reviews.map(review => (
              <div
                key={review.id}
                className={`ps-review-card ${review.source === 'Google' ? 'ps-review-card-google' : review.source === 'Direct' ? 'ps-review-card-direct' : ''}`}
              >
                <span className="ps-review-quote">&ldquo;</span>
                <div className="ps-review-header">
                  <div className="ps-review-avatar">
                    {getInitials(review.author_name)}
                  </div>
                  <div className="ps-review-meta">
                    <div className="ps-review-author">{review.author_name}</div>
                    <span className={`ps-review-source ps-review-source-${review.source.toLowerCase()}`}>
                      {review.source}
                    </span>
                  </div>
                </div>
                <div className="ps-review-stars">
                  {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                </div>
                <p className="ps-review-text">{review.review_text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Pricing ─── */}
      <section id="pricing" className="ps-section">
        <h2 className="ps-section-title">Pricing</h2>
        <p className="ps-section-subtitle">Transparent pricing with no hidden extras</p>
        <div className="ps-pricing-grid">
          {pricingTiers.map((tier, i) => (
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
            {(() => {
              const raw = content['extras_list'];
              if (raw) {
                try {
                  return (JSON.parse(raw) as string[]).map((item, i) => <li key={i}>{item}</li>);
                } catch { /* fall through */ }
              }
              return [
                <li key={0}>Travel within 50 miles included</li>,
                <li key={1}>Additional travel: {'\u00a3'}0.50/mile</li>,
                <li key={2}>Extra sets: {'\u00a3'}100{'\u2013'}{'\u00a3'}200/hour</li>,
                <li key={3}>Custom song requests (with advance notice)</li>,
                <li key={4}>PA hire for speeches: {'\u00a3'}150</li>,
              ];
            })()}
          </ul>
        </div>
      </section>

      {/* ─── Gallery ─── */}
      {(media.length > 0 || GALLERY_PHOTOS.length > 0) && (
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
            {GALLERY_PHOTOS.map(photo => (
              <div key={photo} className="ps-gallery-item">
                <img
                  src={`/images/gallery/${photo}`}
                  alt="The Green Tangerine live"
                  className="ps-gallery-img"
                  loading="lazy"
                  onClick={() => setLightboxImg(`/images/gallery/${photo}`)}
                />
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
              <a href="mailto:bookings@thegreentangerine.com" className="ps-contact-value">
                bookings@thegreentangerine.com
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
                <a href="mailto:bookings@thegreentangerine.com">bookings@thegreentangerine.com</a>
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

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
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
