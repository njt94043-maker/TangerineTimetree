import { useMemo, useRef } from 'react';
import type { Gig, AwayDate } from '@shared/supabase/types';
import { computeDayDisplay, isGigIncomplete } from '@shared/supabase/types';

interface CalendarProps {
  year: number;
  month: number;
  gigs: Gig[];
  awayDates: AwayDate[];
  onDatePress: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onGoToToday: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getMondayOffset(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return (day + 6) % 7;
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function Calendar({ year, month, gigs, awayDates, onDatePress, onPrevMonth, onNextMonth, onGoToToday }: CalendarProps) {
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const daysInMonth = getDaysInMonth(year, month);
  const offset = getMondayOffset(year, month);

  // Swipe handling
  const touchStartX = useRef(0);
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > 50) onPrevMonth();
    else if (dx < -50) onNextMonth();
  }

  const gigsByDate = useMemo(() => {
    const map = new Map<string, Gig[]>();
    for (const g of gigs) {
      const existing = map.get(g.date) ?? [];
      existing.push(g);
      map.set(g.date, existing);
    }
    return map;
  }, [gigs]);

  // Build cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="calendar neu-card">
      <div className="calendar-header">
        <button className="calendar-arrow" onClick={onPrevMonth} aria-label="Previous month">{'\u25C0'}</button>
        <span className="calendar-month">{MONTH_NAMES[month]} {year}</span>
        <button className="calendar-arrow" onClick={onNextMonth} aria-label="Next month">{'\u25B6'}</button>
      </div>
      <div className="calendar-today-row">
        <button className="today-btn" onClick={onGoToToday}>Today</button>
      </div>

      <div className="calendar-day-headers">
        {DAY_HEADERS.map((d, i) => (
          <div key={d} className={`calendar-day-header ${i >= 5 ? 'weekend' : ''}`}>{d.toUpperCase()}</div>
        ))}
      </div>

      <div className="calendar-grid" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} className="calendar-cell" style={{ cursor: 'default' }} />;

          const iso = toISO(year, month, day);
          const display = computeDayDisplay(iso, today, gigs, awayDates);
          const isToday = iso === today;
          const dateGigs = gigsByDate.get(iso) ?? [];
          const activeGigs = dateGigs.filter(g => g.status !== 'cancelled');

          const classes = ['calendar-cell', display];
          if (isToday) classes.push('today');

          const gigCount = activeGigs.length;

          // Build dots: one per active gig (max 3), colored by subtype
          const dots = activeGigs.slice(0, 3).map((g, i) => {
            const color = g.gig_type === 'practice'
              ? 'var(--color-practice)'
              : g.gig_subtype === 'client'
                ? 'var(--color-tangerine)'
                : 'var(--color-gig)';
            const inc = g.gig_type !== 'practice' && isGigIncomplete(g);
            const dashed = g.status === 'enquiry' || g.status === 'pencilled';
            return <span key={i} className={`day-dot${inc ? ' incomplete' : ''}${dashed ? ' enquiry' : ''}`} style={{ background: color }} />;
          });

          // Venue words — split name into one word per line
          const venueWords: { word: string; color: string }[] = [];
          for (const g of activeGigs.slice(0, 1)) {
            const label = g.venue || '';
            if (!label) continue;
            const color = g.gig_type === 'practice'
              ? 'var(--color-practice)'
              : g.gig_subtype === 'client'
                ? 'var(--color-tangerine)'
                : 'var(--color-gig)';
            for (const word of label.split(/\s+/)) {
              venueWords.push({ word, color });
            }
          }

          return (
            <button key={`day-${day}`} className={classes.join(' ')} onClick={() => onDatePress(iso)} aria-label={`${MONTH_NAMES[month]} ${day}`}>
              <span className="day-num">{day}</span>
              {venueWords.length > 0 && (
                <span className="day-venues">
                  {venueWords.map((v, i) => (
                    <span key={i} className="day-venue" style={{ color: v.color }}>{v.word}</span>
                  ))}
                </span>
              )}
              {dots.length > 0 && <span className="day-dots">{dots}</span>}
              {gigCount > 2 && (
                <span className="day-count">+{gigCount - 2}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="legend">
        <LegendItem color="var(--color-available)" label="Available" />
        <LegendItem color="var(--color-gig)" label="Pub Gig" />
        <LegendItem color="var(--color-tangerine)" label="Client" />
        <LegendItem color="var(--color-tangerine)" label="Enquiry" dashed />
        <LegendItem color="var(--color-practice)" label="Practice" />
        <LegendItem color="var(--color-unavailable)" label="Away" />
      </div>
    </div>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="legend-item">
      <span className={`legend-dot${dashed ? ' legend-dot-dashed' : ''}`} style={{ background: dashed ? 'transparent' : color, borderColor: dashed ? color : undefined }} />
      <span className="legend-label">{label}</span>
    </div>
  );
}
