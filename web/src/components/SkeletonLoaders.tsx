import './SkeletonLoaders.css';

/* ═══════════════════════════════════════════════════════════
   Variant 1: Full-page loader
   Replaces LoadingSpinner for auth / initial app load.
   The tangerine breathes with an orbiting dot.
   ═══════════════════════════════════════════════════════════ */
interface PageLoaderProps {
  text?: string;
}

export function PageLoader({ text = 'Loading' }: PageLoaderProps) {
  return (
    <div className="skel-page">
      <div className="skel-page__icon">
        <img src="/logo-512.png" alt="" className="skel-page__logo" />
        <div className="skel-page__orbit">
          <span className="skel-page__orbit-dot" />
        </div>
      </div>
      <span className="skel-page__label">{text}</span>
      <div className="skel-page__bars">
        <div className="skel-bar skel-bar--w100" />
        <div className="skel-bar skel-bar--w80" />
        <div className="skel-bar skel-bar--w60" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Variant 2: Card skeleton
   For gig cards, invoice cards, etc. while data loads.
   Has the tangerine glow sweep and pulsing mini logo.
   ═══════════════════════════════════════════════════════════ */
interface CardSkeletonProps {
  lines?: number;
}

export function CardSkeleton({ lines = 3 }: CardSkeletonProps) {
  return (
    <div className="skel-card">
      <div className="skel-card__header">
        <div className="skel-tang">
          <img src="/logo-512.png" alt="" />
        </div>
        <div className="skel-card__header-lines">
          <div className="skel-bar skel-bar--w60" />
          <div className="skel-bar skel-bar--w45" />
        </div>
      </div>
      <div className="skel-card__body">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`skel-bar skel-bar--w${i === 0 ? '100' : i === lines - 1 ? '45' : '80'}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Variant 3: Inline list skeleton
   For loading rows in GigList, InvoiceList, etc.
   Mini tangerine + shimmer bars.
   ═══════════════════════════════════════════════════════════ */
interface InlineSkeletonProps {
  rows?: number;
}

export function InlineSkeleton({ rows = 3 }: InlineSkeletonProps) {
  return (
    <div className="skel-inline-group">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="skel-inline" key={i}>
          <div className="skel-tang skel-tang--sm">
            <img src="/logo-512.png" alt="" />
          </div>
          <div className="skel-inline__lines">
            <div className={`skel-bar skel-bar--w${i % 2 === 0 ? '80' : '60'}`} />
            <div className={`skel-bar skel-bar--w${i % 2 === 0 ? '45' : '80'}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Variant 4: Minimal dots
   Lightweight inline indicator — tiny logo + bouncing dots.
   ═══════════════════════════════════════════════════════════ */
export function DotLoader() {
  return (
    <div className="skel-dots">
      <div className="skel-tang skel-tang--xs">
        <img src="/logo-512.png" alt="" />
      </div>
      <div className="skel-dots__group">
        <span className="skel-dots__dot" />
        <span className="skel-dots__dot" />
        <span className="skel-dots__dot" />
      </div>
    </div>
  );
}
