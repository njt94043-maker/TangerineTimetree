import { useState, useEffect, useRef, useCallback } from 'react';
import type { GigWithCreator, AwayDateWithUser } from '@shared/supabase/types';
import { isGigIncomplete } from '@shared/supabase/types';
import { getGigsByDate, getVenue, getInvoiceByGigId, getVenuePerformanceHistory } from '@shared/supabase/queries';
import { isNetworkError } from '../hooks/useOfflineQueue';
import { formatDisplayDate, fmt, fmtFee } from '../utils/format';
import { ErrorAlert } from './ErrorAlert';
import { LoadingSpinner } from './LoadingSpinner';
import { GigCardExpanded } from './GigCardExpanded';

interface DayDetailProps {
  date: string;
  awayDates: AwayDateWithUser[];
  eventDates?: string[];
  onClose: () => void;
  onAddGig: (date: string, type: 'gig' | 'practice') => void;
  onEditGig: (gigId: string) => void;
  onAddBooking?: (date: string) => void;
  onMarkAway: () => void;
  onGigDeleted?: () => void;
  onDateChange?: (date: string) => void;
  onCreateInvoice?: (gig: GigWithCreator) => void;
  // New props for expanded card navigation
  onViewQuote?: (quoteId: string) => void;
  onViewInvoice?: (invoiceId: string) => void;
  onGenerateQuote?: (gig: GigWithCreator) => void;
  onEditBooking?: (gigId: string) => void;
  onPlayLive?: (gigId: string) => void;
}

export function DayDetail({
  date, awayDates, eventDates = [], onClose, onAddGig, onEditGig,
  onAddBooking, onMarkAway, onGigDeleted, onDateChange, onCreateInvoice,
  onViewQuote, onViewInvoice, onGenerateQuote, onEditBooking, onPlayLive,
}: DayDetailProps) {
  const [gigs, setGigs] = useState<GigWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
  const [venueAddresses, setVenueAddresses] = useState<Map<string, string>>(new Map());
  const [invoicedGigIds, setInvoicedGigIds] = useState<Set<string>>(new Set());
  const [expandedGigId, setExpandedGigId] = useState<string | null>(null);
  const [venueHistory, setVenueHistory] = useState<{ gig_date: string; songs: { name: string; artist: string }[] }[]>([]);
  const [songFreqs, setSongFreqs] = useState<{ name: string; count: number }[]>([]);
  const touchStartX = useRef(0);

  const fetchDayGigs = useCallback(() => {
    setExpandedGigId(null);
    setLoading(true);
    setError(null);
    getGigsByDate(date)
      .then(setGigs)
      .catch((err) => setError(isNetworkError(err) ? 'You\'re offline — gigs can\'t be loaded right now' : 'Failed to load gigs for this day'))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on mount/date change
    fetchDayGigs();
  }, [fetchDayGigs]);

  // Fetch venue addresses for gigs with venue_id
  useEffect(() => {
    const gigsWithVenue = gigs.filter(g => g.venue_id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional early-return default
    if (gigsWithVenue.length === 0) { setVenueAddresses(new Map()); return; }
    Promise.all(
      gigsWithVenue.map(async g => {
        const venue = await getVenue(g.venue_id!);
        const addr = venue ? [venue.address, venue.postcode].filter(Boolean).join(', ') : '';
        return [g.id, addr] as const;
      })
    ).then(entries => {
      setVenueAddresses(new Map(entries.filter(([, addr]) => !!addr)));
    }).catch(() => {});
  }, [gigs]);

  // Check which gigs already have invoices
  useEffect(() => {
    const invoiceGigs = gigs.filter(g => g.gig_type !== 'practice');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional early-return default
    if (invoiceGigs.length === 0) { setInvoicedGigIds(new Set()); return; }
    Promise.all(
      invoiceGigs.map(async g => {
        const inv = await getInvoiceByGigId(g.id);
        return inv ? g.id : null;
      })
    ).then(ids => {
      setInvoicedGigIds(new Set(ids.filter(Boolean) as string[]));
    }).catch(() => {});
  }, [gigs]);

  // Fetch venue performance history for non-practice gigs
  useEffect(() => {
    if (gigs.length === 0) return;
    const gigVenues = gigs.filter(g => g.gig_type !== 'practice' && g.venue).map(g => g.venue);
    if (gigVenues.length === 0) { setVenueHistory([]); setSongFreqs([]); return; }
    // Use first gig's venue (most common: 1 gig per day)
    getVenuePerformanceHistory(gigVenues[0], 3).then(history => {
      setVenueHistory(history.map(h => ({ gig_date: h.gig_date, songs: h.songs })));
      // Compute song frequency across all returned gigs
      const freqMap = new Map<string, number>();
      for (const h of history) for (const s of h.songs) freqMap.set(s.name, (freqMap.get(s.name) ?? 0) + 1);
      const sorted = [...freqMap.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
      setSongFreqs(sorted);
    }).catch(() => {});
  }, [gigs]);

  // Swipe navigation between event dates
  const currentIdx = eventDates.indexOf(date);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < eventDates.length - 1;

  function navigateToDate(newDate: string, direction: 'left' | 'right') {
    if (!onDateChange) return;
    setSlideDir(direction);
    onDateChange(newDate);
  }

  function goToPrevEvent() {
    if (hasPrev) navigateToDate(eventDates[currentIdx - 1], 'right');
  }
  function goToNextEvent() {
    if (hasNext) navigateToDate(eventDates[currentIdx + 1], 'left');
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) < 50) return;
    if (dx < 0 && hasNext) goToNextEvent();
    else if (dx > 0 && hasPrev) goToPrevEvent();
  }

  const awayOnDate = awayDates.filter(a => date >= a.start_date && date <= a.end_date);

  function handleGigCardClick(gig: GigWithCreator) {
    const isPractice = gig.gig_type === 'practice';
    if (isPractice) {
      onEditGig(gig.id);
      return;
    }
    // Toggle accordion expand/collapse
    setExpandedGigId(prev => prev === gig.id ? null : gig.id);
  }

  function handleGigUpdated() {
    fetchDayGigs();
    onGigDeleted?.(); // triggers calendar refresh
  }

  function handleGigDeleted() {
    fetchDayGigs();
    onGigDeleted?.();
  }

  return (
    <div
      className="gigday-fullscreen"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="gigday-header">
        <button className="bw-back" onClick={onClose}>{'\u25C0'}</button>
        <h2
          key={date}
          className={`gigday-title ${slideDir === 'left' ? 'slide-from-right' : slideDir === 'right' ? 'slide-from-left' : ''}`}
          onAnimationEnd={() => setSlideDir(null)}
        >{formatDisplayDate(date)}</h2>
        <div className="gigday-nav-arrows">
          <button
            className={`day-nav-btn ${hasPrev ? '' : 'day-nav-btn-disabled'}`}
            onClick={goToPrevEvent}
            disabled={!hasPrev}
          >&lsaquo;</button>
          <button
            className={`day-nav-btn ${hasNext ? '' : 'day-nav-btn-disabled'}`}
            onClick={goToNextEvent}
            disabled={!hasNext}
          >&rsaquo;</button>
        </div>
      </div>

      <div className="gigday-body">
        {loading && <LoadingSpinner skeleton />}
        {error && <ErrorAlert message={error} onRetry={fetchDayGigs} />}

        {!loading && !error && gigs.length === 0 && (
          <p className="empty-message">Nothing booked</p>
        )}

        {/* Away warning banner */}
        {awayOnDate.length > 0 && (
          <div className="bw-banner bw-banner-danger" style={{ marginBottom: 12 }}>
            <span>{'\u26A0\uFE0F'}</span>
            <span><strong>Band Unavailable</strong> — {awayOnDate.map(a => a.user_name).join(', ')} away</span>
          </div>
        )}

        {/* Gig cards */}
        {gigs.map(gig => {
          const isPractice = gig.gig_type === 'practice';
          const isClient = !isPractice && gig.gig_subtype === 'client';
          const accentClass = isPractice ? 'gig-acc-practice' : isClient ? 'gig-acc-client' : 'gig-acc-pub';
          const isCancelled = gig.status === 'cancelled';
          const isExpanded = expandedGigId === gig.id;

          return (
            <div
              key={gig.id}
              className={`neu-inset gig-card-inset gig-card-accented${isCancelled ? ' gig-card-cancelled' : ''}${isExpanded ? ' gig-card-expanded' : ''}`}
              onClick={() => handleGigCardClick(gig)}
              style={{ cursor: isPractice ? 'pointer' : 'pointer' }}
            >
              {/* Accent strip */}
              <div className={`gig-accent-strip ${accentClass}`} />

              <div className="gig-card-body">
                {/* Status badges */}
                <div className="gig-badges-row">
                  {isPractice && <span className="practice-badge">PRACTICE</span>}
                  {!isPractice && gig.status && gig.status !== 'confirmed' && (
                    <span className={`badge ${gig.status === 'cancelled' ? 'badge-danger' : (gig.status === 'enquiry' || gig.status === 'pencilled') ? 'badge-tangerine' : 'badge-dim'}`}>{gig.status === 'pencilled' ? 'enquiry' : gig.status}</span>
                  )}
                  {!isPractice && isGigIncomplete(gig) && <span className="incomplete-badge">INCOMPLETE</span>}
                  {!isPractice && invoicedGigIds.has(gig.id) && <span className="invoiced-badge">INVOICED</span>}
                  {isClient && <span className="badge badge-tangerine">CLIENT</span>}
                </div>

                {/* Venue + Navigate */}
                <div className={`gig-venue-name ${isPractice ? 'gig-venue-practice' : ''}`}>
                  {isPractice ? (gig.venue || 'Practice') : (gig.venue || 'Venue TBC')}
                  {!isPractice && venueAddresses.has(gig.id) && (
                    <button
                      className="btn-navigate"
                      onClick={(e) => {
                        e.stopPropagation();
                        const addr = encodeURIComponent(venueAddresses.get(gig.id)!);
                        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                        const pref = localStorage.getItem('tgt_map_app') || (isIOS ? 'apple' : 'google');
                        const urls: Record<string, string> = {
                          google: `https://www.google.com/maps/search/?api=1&query=${addr}`,
                          waze: `https://waze.com/ul?q=${addr}`,
                          apple: `https://maps.apple.com/?q=${addr}`,
                        };
                        window.open(urls[pref] || urls.google, '_blank', 'noopener');
                      }}
                    >
                      Navigate
                    </button>
                  )}
                </div>
                {!isPractice && gig.client_name && <div className="gig-client-name">{gig.client_name}</div>}

                {/* Detail grid */}
                <div className="detail-grid">
                  {!isPractice && <div className="detail-row"><span className="detail-label">Fee</span><span className="detail-value">{fmtFee(gig.fee)}</span></div>}
                  {!isPractice && <div className="detail-row"><span className="detail-label">Payment</span><span className="detail-value">{gig.payment_type || '\u2014'}</span></div>}
                  {!isPractice && <div className="detail-row"><span className="detail-label">Load-in</span><span className="detail-value">{fmt(gig.load_time)}</span></div>}
                  <div className="detail-row"><span className="detail-label">Start</span><span className="detail-value">{fmt(gig.start_time)}</span></div>
                  {gig.end_time && <div className="detail-row"><span className="detail-label">End</span><span className="detail-value">{fmt(gig.end_time)}</span></div>}
                </div>

                {gig.notes && !isExpanded && <p className="gig-notes-text">{gig.notes}</p>}
                <p className="gig-creator-text">Added by {gig.creator_name}</p>

                {/* Collapsed: mini pipeline indicator for non-practice gigs */}
                {!isPractice && !isExpanded && (
                  <div className="gig-mini-pipeline">
                    {['Enq', 'Conf', 'Quo', 'Inv', 'Paid'].map((label, i) => {
                      const sIdx = gig.status === 'enquiry' || gig.status === 'pencilled' ? 0 : gig.status === 'confirmed' ? 1 : -1;
                      const reached = i <= sIdx;
                      const active = i === sIdx;
                      return (
                        <span key={label} className={`mini-pip-dot${reached ? ' reached' : ''}${active ? ' active' : ''}`} title={label} />
                      );
                    })}
                    <span className="mini-pip-label">
                      {gig.status === 'pencilled' ? 'enquiry' : gig.status}
                    </span>
                  </div>
                )}

                {/* Collapsed hint */}
                {!isPractice && !isExpanded && (
                  <div className="gig-expand-hint">Tap for details</div>
                )}

                {/* EXPANDED: GigCardExpanded with full pipeline, docs, actions */}
                {isExpanded && !isPractice && (
                  <GigCardExpanded
                    gigId={gig.id}
                    onEdit={onEditBooking || onEditGig}
                    onViewQuote={onViewQuote}
                    onViewInvoice={onViewInvoice}
                    onCreateInvoice={onCreateInvoice}
                    onGenerateQuote={onGenerateQuote}
                    onGigUpdated={handleGigUpdated}
                    onGigDeleted={handleGigDeleted}
                  />
                )}
              </div>
            </div>
          );
        })}

        {/* S41: Join as Prompter — launches Player in live/prompter mode (visual lyrics/notes only) */}
        {gigs.filter(g => g.gig_type !== 'practice').length > 0 && onPlayLive && (
          <div style={{ padding: '0 0 12px' }}>
            {gigs.filter(g => g.gig_type !== 'practice').map(gig => (
              <button
                key={`live-${gig.id}`}
                className="btn btn-green"
                style={{ width: '100%', marginBottom: 6 }}
                onClick={() => onPlayLive(gig.id)}
              >
                Join as Prompter{gigs.filter(g => g.gig_type !== 'practice').length > 1 ? ` — ${gig.venue || 'Gig'}` : ''}
              </button>
            ))}
          </div>
        )}

        {/* Previously Played at this venue */}
        {venueHistory.length > 0 && (
          <div className="venue-history-section">
            <h3 className="away-section-title">Previously Played Here</h3>
            {songFreqs.length > 0 && (
              <div className="venue-freq-row">
                {songFreqs.slice(0, 8).map(sf => (
                  <span className="venue-freq-badge" key={sf.name}>
                    {sf.name} {sf.count > 1 ? `x${sf.count}` : ''}
                  </span>
                ))}
              </div>
            )}
            {venueHistory.map(vh => (
              <div key={vh.gig_date} className="venue-history-gig">
                <span className="venue-history-date">{formatDisplayDate(vh.gig_date)}</span>
                <ol className="venue-history-songs">
                  {vh.songs.map((s, i) => <li key={i}>{s.name}</li>)}
                </ol>
              </div>
            ))}
          </div>
        )}

        {/* Away details */}
        {awayOnDate.length > 0 && (
          <div className="away-section">
            <h3 className="away-section-title">Away</h3>
            {awayOnDate.map(a => (
              <div key={a.id} className="away-row">
                <span className="away-user-name">{a.user_name}</span>
                {a.reason && <span className="away-user-reason">{a.reason}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="day-actions">
          {onAddBooking ? (
            <button className="btn-add-booking" onClick={() => onAddBooking(date)}>
              <span className="btn-add-booking-label">+ Add Booking</span>
              <span className="btn-add-booking-hint">Quick entry or full client booking</span>
            </button>
          ) : (
            <button className="btn btn-green" onClick={() => onAddGig(date, 'gig')}>Add Gig</button>
          )}
          <div className="day-actions-row">
            <button className="btn btn-practice btn-flex" onClick={() => onAddGig(date, 'practice')}>Add Practice</button>
            <button className="btn btn-tangerine btn-flex" onClick={onMarkAway}>I'm Away</button>
          </div>
        </div>
      </div>
    </div>
  );
}
