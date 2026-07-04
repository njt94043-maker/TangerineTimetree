import { useEffect } from 'react';
import type { Gig, AwayDateWithUser, Profile } from '@shared/supabase/types';
import { fmt } from '../utils/format';

// The Timetree-style day-peek sheet (s258). A bottom sheet that slides up over
// the calendar (month stays visible behind) when a day cell is tapped — a quick
// glance at that day's gigs/away without leaving the month. "Open day" still
// takes you to the full DayDetail. Class names `day-peek-overlay` / `day-peek`
// are asserted by the prod smoke.
interface DayPeekProps {
  date: string;                       // YYYY-MM-DD
  gigs: Gig[];
  awayDates: AwayDateWithUser[];
  profiles: Profile[];
  onClose: () => void;
  onOpenDay: (date: string) => void;      // → full day view (goToDay)
  onAddBooking: (date: string) => void;   // → booking wizard (goToBookingWizard)
}

// "Fri 11 July" — short weekday + day + full month, no comma.
function friendlyDate(date: string): string {
  const d = new Date(date + 'T12:00:00');
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' });
  const month = d.toLocaleDateString('en-GB', { month: 'long' });
  return `${weekday} ${d.getDate()} ${month}`;
}

// Status chip — practice styled distinctly; gigs by subtype/status. Reuses the
// existing badge palette (no new colors).
function gigChip(gig: Gig) {
  if (gig.gig_type === 'practice') return <span className="practice-badge">PRACTICE</span>;
  if (gig.status === 'cancelled') return <span className="badge badge-danger">cancelled</span>;
  if (gig.status === 'enquiry' || gig.status === 'pencilled') return <span className="badge badge-tangerine">enquiry</span>;
  if (gig.gig_subtype === 'client') return <span className="badge badge-tangerine">client</span>;
  return <span className="badge badge-green">gig</span>;
}

export function DayPeek({ date, gigs, awayDates, profiles, onClose, onOpenDay, onAddBooking }: DayPeekProps) {
  // Close on Escape (copies Drawer's Escape effect pattern).
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const dayGigs = gigs.filter(g => g.date === date);
  const awayOnDate = awayDates.filter(a => date >= a.start_date && date <= a.end_date);
  const isEmpty = dayGigs.length === 0 && awayOnDate.length === 0;

  const memberName = (a: AwayDateWithUser): string =>
    a.user_name || profiles.find(p => p.id === a.user_id)?.name || 'Someone';

  return (
    <div className="day-peek-overlay" onClick={onClose}>
      <div
        className="day-peek"
        role="dialog"
        aria-modal="true"
        aria-label={friendlyDate(date)}
        onClick={e => e.stopPropagation()}
      >
        <div className="day-peek-header">
          <span className="day-peek-title">{friendlyDate(date)}</span>
          <button className="day-peek-close" onClick={onClose} aria-label="Close">{'×'}</button>
        </div>

        <div className="day-peek-body">
          {isEmpty && (
            <p className="day-peek-empty">Nothing on — this date is free.</p>
          )}

          {dayGigs.map(gig => (
            <button key={gig.id} className="day-peek-row" onClick={() => onOpenDay(date)}>
              <span className="day-peek-row-venue">
                {gig.gig_type === 'practice' ? (gig.venue || 'Practice') : (gig.venue || 'Venue TBC')}
              </span>
              {gig.start_time && <span className="day-peek-row-time">{fmt(gig.start_time)}</span>}
              {gigChip(gig)}
            </button>
          ))}

          {awayOnDate.map(a => (
            <div key={a.id} className="day-peek-away">
              <span aria-hidden="true">{'✈️'}</span>
              <span>{memberName(a)} away</span>
            </div>
          ))}
        </div>

        <div className="day-peek-footer">
          <button className="btn btn-tangerine" onClick={() => onAddBooking(date)}>+ Add booking</button>
          <button className="btn btn-green" onClick={() => onOpenDay(date)}>Open day</button>
        </div>
      </div>
    </div>
  );
}
