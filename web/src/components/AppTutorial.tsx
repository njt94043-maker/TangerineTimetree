import { useState, useEffect, useCallback } from 'react';

interface TutorialSlide {
  title: string;
  body: string;
  icon: string;
  accent: string; // CSS color
}

const SLIDES: TutorialSlide[] = [
  {
    title: 'Welcome to Tangerine Timetree',
    body: 'Your shared band calendar, invoicing hub, and gig manager — all in one place. Swipe through to learn the basics.',
    icon: '\uD83C\uDF4A',
    accent: 'var(--color-gig)',
  },
  {
    title: 'Calendar',
    body: 'The home screen shows your gig calendar. Tap any day to see details, add gigs, mark practice sessions, or set yourself as away. Swipe left/right to change month.',
    icon: '\uD83D\uDCC5',
    accent: 'var(--color-available)',
  },
  {
    title: 'Day View',
    body: 'Tap a day to open the day sheet. From here you can add a gig or practice, mark yourself as away, view gig details, or jump straight to creating an invoice.',
    icon: '\uD83D\uDC41\uFE0F',
    accent: 'var(--color-gig)',
  },
  {
    title: 'Colour Coding',
    body: 'Green = available, orange = gig booked, blue = practice, red = someone is away. Venue names appear on each day so you can see your schedule at a glance.',
    icon: '\uD83C\uDFA8',
    accent: 'var(--color-practice)',
  },
  {
    title: 'Invoices',
    body: 'Create professional invoices with your band details, send them as PDFs, and track payment status. Choose from 7 beautiful invoice styles. You can also create an invoice directly from a gig.',
    icon: '\uD83D\uDCC4',
    accent: 'var(--color-gig)',
  },
  {
    title: 'Quotes',
    body: 'Send quotes to potential clients with a 4-step wizard. Track their lifecycle from draft through to accepted or declined. Accepted quotes can be converted into gigs automatically.',
    icon: '\uD83D\uDCDD',
    accent: 'var(--color-available)',
  },
  {
    title: 'Clients & Venues',
    body: 'Keep a directory of your clients and venues. Rate venues with stars, add notes, and track which clients book you most. Invoices and quotes link to your client/venue records.',
    icon: '\uD83D\uDC65',
    accent: 'var(--color-practice)',
  },
  {
    title: 'Dashboard',
    body: 'See your business at a glance — overdue invoices, monthly earnings breakdown, tax year stats, and quick-nav buttons. Export your data as CSV for your accountant.',
    icon: '\uD83D\uDCCA',
    accent: 'var(--color-gig)',
  },
  {
    title: 'Away Dates',
    body: 'Mark dates when you\'re unavailable. Other band members can see who\'s away so you avoid booking conflicts. The calendar shows away dates in red.',
    icon: '\u2708\uFE0F',
    accent: 'var(--color-unavailable)',
  },
  {
    title: 'Settings',
    body: 'Set up your bank details for invoices, customise your service catalogue, add PLI insurance info, and configure quote defaults. Your details are shared across all invoices and quotes.',
    icon: '\u2699\uFE0F',
    accent: 'var(--color-available)',
  },
  {
    title: 'Navigation Tips',
    body: 'Use the sidebar to jump between sections. On mobile, use the hamburger menu. Your phone\'s back button works too — it retraces your steps through the app.',
    icon: '\uD83E\uDDED',
    accent: 'var(--color-practice)',
  },
  {
    title: 'You\'re All Set!',
    body: 'That\'s the tour! You can replay this guide anytime from the sidebar. Now go book some gigs!',
    icon: '\uD83C\uDF89',
    accent: 'var(--color-gig)',
  },
];

interface AppTutorialProps {
  onClose: () => void;
}

export function AppTutorial({ onClose }: AppTutorialProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [animating, setAnimating] = useState(false);
  const total = SLIDES.length;
  const slide = SLIDES[current];

  const goTo = useCallback((idx: number, dir: 'next' | 'prev') => {
    if (animating) return;
    setDirection(dir);
    setAnimating(true);
    setTimeout(() => {
      setCurrent(idx);
      setAnimating(false);
    }, 250);
  }, [animating]);

  const next = useCallback(() => {
    if (current < total - 1) goTo(current + 1, 'next');
    else onClose();
  }, [current, total, goTo, onClose]);

  const prev = useCallback(() => {
    if (current > 0) goTo(current - 1, 'prev');
  }, [current, goTo]);

  // Swipe support
  const [touchX, setTouchX] = useState(0);
  function handleTouchStart(e: React.TouchEvent) { setTouchX(e.touches[0].clientX); }
  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchX;
    if (dx > 60) prev();
    else if (dx < -60) next();
  }

  // Keyboard support
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [next, prev, onClose]);

  const slideClass = animating
    ? `tutorial-slide tutorial-slide-exit-${direction}`
    : 'tutorial-slide tutorial-slide-enter';

  return (
    <div className="tutorial-overlay" onClick={onClose}>
      <div className="tutorial-modal" onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {/* Close button */}
        <button className="tutorial-close" onClick={onClose} aria-label="Close tutorial">
          {'\u2715'}
        </button>

        {/* Progress bar */}
        <div className="tutorial-progress">
          <div className="tutorial-progress-fill" style={{ width: `${((current + 1) / total) * 100}%`, background: slide.accent }} />
        </div>

        {/* Slide content */}
        <div className={slideClass} key={current}>
          <div className="tutorial-icon" style={{ color: slide.accent }}>{slide.icon}</div>
          <h2 className="tutorial-title">{slide.title}</h2>
          <p className="tutorial-body">{slide.body}</p>
        </div>

        {/* Dots */}
        <div className="tutorial-dots">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              className={`tutorial-dot ${i === current ? 'active' : ''}`}
              style={i === current ? { background: slide.accent } : undefined}
              onClick={() => goTo(i, i > current ? 'next' : 'prev')}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="tutorial-nav">
          <button
            className="tutorial-nav-btn"
            onClick={prev}
            disabled={current === 0}
          >
            Back
          </button>
          <span className="tutorial-counter">{current + 1} / {total}</span>
          <button
            className="tutorial-nav-btn tutorial-nav-primary"
            onClick={next}
            style={{ background: slide.accent }}
          >
            {current === total - 1 ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
