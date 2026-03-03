import { useMemo, useRef } from 'react';
import type { Gig, AwayDate } from '@shared/supabase/types';
import { computeDayStatus, isGigIncomplete } from '@shared/supabase/types';

interface CalendarProps {
  year: number;
  month: number;
  gigs: Gig[];
  awayDates: AwayDate[];
  totalMembers: number;
  onDatePress: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
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

export function Calendar({ year, month, gigs, awayDates, totalMembers, onDatePress, onPrevMonth, onNextMonth }: CalendarProps) {
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
        <button className="calendar-arrow" onClick={onPrevMonth}>{'\u25C0'}</button>
        <span className="calendar-month">{MONTH_NAMES[month]} {year}</span>
        <button className="calendar-arrow" onClick={onNextMonth}>{'\u25B6'}</button>
      </div>

      <div className="calendar-grid" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {DAY_HEADERS.map((d, i) => (
          <div key={d} className={`calendar-day-header ${i >= 5 ? 'weekend' : ''}`}>{d}</div>
        ))}

        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} className="calendar-cell" />;

          const iso = toISO(year, month, day);
          const status = computeDayStatus(iso, today, gigs, awayDates, totalMembers);
          const isToday = iso === today;
          const dateGigs = gigsByDate.get(iso) ?? [];
          const hasIncomplete = dateGigs.some(isGigIncomplete);

          const classes = ['calendar-cell', status];
          if (isToday) classes.push('today');

          return (
            <div key={`day-${day}`} className={classes.join(' ')} onClick={() => onDatePress(iso)}>
              <span className="day-num">{day}</span>
              {status === 'gig' && (
                <span className={`day-dot ${hasIncomplete ? 'incomplete' : ''}`} style={{ background: 'var(--color-gig)' }} />
              )}
              {status === 'practice' && (
                <span className="day-dot" style={{ background: 'var(--color-practice)' }} />
              )}
            </div>
          );
        })}
      </div>

      <div className="legend">
        <LegendItem color="var(--color-available)" label="Available" />
        <LegendItem color="var(--color-gig)" label="Gig" />
        <LegendItem color="var(--color-practice)" label="Practice" />
        <LegendItem color="var(--color-unavailable)" label="Away" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="legend-item">
      <span className="legend-dot" style={{ background: color }} />
      <span className="legend-label">{label}</span>
    </div>
  );
}
