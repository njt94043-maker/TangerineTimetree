import { useState, useEffect, useMemo } from 'react';
import { addMonths, eachDayOfInterval, format, isFriday, isSaturday, isSunday, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { getGigsForMonth, getAwayDatesForMonth, getPublicGigs } from '@shared/supabase/queries';
import type { Gig, AwayDate } from '@shared/supabase/types';

interface AvailabilityProps {
  /** Public mode: only shows public gig data, hides venue for private gigs */
  isPublic?: boolean;
}

type DateStatus = 'available' | 'booked' | 'unavailable';

interface WeekendDate {
  date: Date;
  dateStr: string;
  dayName: string;
  status: DateStatus;
  venue?: string;
}

export default function Availability({ isPublic = false }: AvailabilityProps) {
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [awayDates, setAwayDates] = useState<AwayDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthsAhead, setMonthsAhead] = useState(3);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        if (isPublic) {
          const publicGigs = await getPublicGigs();
          if (!cancelled) {
            setGigs(publicGigs);
            setAwayDates([]); // Away dates not shown publicly
          }
        } else {
          const now = new Date();
          const allGigs: Gig[] = [];
          const allAway: AwayDate[] = [];

          for (let i = 0; i < monthsAhead; i++) {
            const d = addMonths(now, i);
            const year = d.getFullYear();
            const month = d.getMonth();
            const [monthGigs, monthAway] = await Promise.all([
              getGigsForMonth(year, month),
              getAwayDatesForMonth(year, month),
            ]);
            allGigs.push(...monthGigs);
            allAway.push(...monthAway);
          }

          if (!cancelled) {
            // Deduplicate by id
            const uniqueGigs = [...new Map(allGigs.map(g => [g.id, g])).values()];
            const uniqueAway = [...new Map(allAway.map(a => [a.id, a])).values()];
            setGigs(uniqueGigs);
            setAwayDates(uniqueAway);
          }
        }
      } catch (err) {
        console.error('Availability load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isPublic, monthsAhead]);

  // Build weekend dates for the range
  const weekendDates = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(addMonths(now, monthsAhead - 1));
    const allDays = eachDayOfInterval({ start, end });

    // Filter to only Fri/Sat/Sun that are today or later
    const today = format(now, 'yyyy-MM-dd');
    return allDays
      .filter(d => isFriday(d) || isSaturday(d) || isSunday(d))
      .filter(d => format(d, 'yyyy-MM-dd') >= today)
      .map(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        const dayName = isFriday(d) ? 'Fri' : isSaturday(d) ? 'Sat' : 'Sun';

        // Check if there's a gig on this date
        const gig = gigs.find(g => g.date === dateStr && g.status !== 'cancelled');

        // Check if there's an away date covering this date
        const away = awayDates.some(a =>
          isWithinInterval(d, { start: parseISO(a.start_date), end: parseISO(a.end_date) })
        );

        let status: DateStatus = 'available';
        let venue: string | undefined;

        if (gig) {
          status = 'booked';
          if (isPublic && gig.visibility === 'private') {
            venue = 'Private event';
          } else {
            venue = gig.venue || undefined;
          }
        } else if (away) {
          status = 'unavailable';
        }

        return { date: d, dateStr, dayName, status, venue } as WeekendDate;
      });
  }, [gigs, awayDates, monthsAhead, isPublic]);

  // Group by month
  const groupedByMonth = useMemo(() => {
    const groups: { month: string; dates: WeekendDate[] }[] = [];
    for (const wd of weekendDates) {
      const monthKey = format(wd.date, 'MMMM yyyy');
      let group = groups.find(g => g.month === monthKey);
      if (!group) {
        group = { month: monthKey, dates: [] };
        groups.push(group);
      }
      group.dates.push(wd);
    }
    return groups;
  }, [weekendDates]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h2 style={styles.title}>Availability</h2>
        </div>
        <p style={styles.loading}>Loading availability...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>
          {isPublic ? 'Our Availability' : 'Band Availability'}
        </h2>
        {!isPublic && (
          <div style={styles.rangeSelector}>
            {[3, 6, 12].map(m => (
              <button
                key={m}
                onClick={() => setMonthsAhead(m)}
                style={{
                  ...styles.rangeButton,
                  ...(monthsAhead === m ? styles.rangeButtonActive : {}),
                }}
              >
                {m} months
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={styles.legend}>
        <span style={styles.legendItem}>
          <span style={{ ...styles.dot, background: '#22c55e' }} /> Available
        </span>
        <span style={styles.legendItem}>
          <span style={{ ...styles.dot, background: '#ef4444' }} /> Booked
        </span>
        {!isPublic && (
          <span style={styles.legendItem}>
            <span style={{ ...styles.dot, background: '#6b7280' }} /> Unavailable
          </span>
        )}
      </div>

      {groupedByMonth.map(group => (
        <div key={group.month} style={styles.monthGroup}>
          <h3 style={styles.monthHeader}>{group.month}</h3>
          <div style={styles.dateGrid}>
            {group.dates.map(wd => (
              <div key={wd.dateStr} style={styles.dateRow}>
                <span style={styles.dateDay}>{wd.dayName}</span>
                <span style={styles.dateNum}>
                  {format(wd.date, 'd MMM')}
                </span>
                <span style={{
                  ...styles.statusBadge,
                  background: wd.status === 'available' ? '#22c55e'
                    : wd.status === 'booked' ? '#ef4444'
                    : '#6b7280',
                }}>
                  {wd.status === 'available' ? 'Available'
                    : wd.status === 'booked' ? 'Booked'
                    : 'Away'}
                </span>
                {wd.venue && (
                  <span style={styles.venue}>{wd.venue}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {groupedByMonth.length === 0 && (
        <p style={styles.empty}>No weekend dates in the selected range.</p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
    maxWidth: '600px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '8px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    margin: 0,
  },
  rangeSelector: {
    display: 'flex',
    gap: '4px',
  },
  rangeButton: {
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid var(--border, #374151)',
    background: 'transparent',
    color: 'var(--text-secondary, #9ca3af)',
    fontSize: '13px',
    cursor: 'pointer',
  },
  rangeButtonActive: {
    background: 'var(--accent, #f97316)',
    color: 'white',
    borderColor: 'var(--accent, #f97316)',
  },
  legend: {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px',
    fontSize: '13px',
    color: 'var(--text-secondary, #9ca3af)',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
  },
  monthGroup: {
    marginBottom: '24px',
  },
  monthHeader: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text-secondary, #9ca3af)',
    marginBottom: '8px',
    borderBottom: '1px solid var(--border, #374151)',
    paddingBottom: '4px',
  },
  dateGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  dateRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '8px',
    background: 'var(--surface, #1f2937)',
  },
  dateDay: {
    width: '32px',
    fontWeight: 600,
    fontSize: '13px',
    color: 'var(--text-secondary, #9ca3af)',
  },
  dateNum: {
    width: '60px',
    fontSize: '14px',
    fontWeight: 500,
  },
  statusBadge: {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'white',
  },
  venue: {
    fontSize: '13px',
    color: 'var(--text-secondary, #9ca3af)',
    marginLeft: 'auto',
  },
  loading: {
    color: 'var(--text-secondary, #9ca3af)',
    textAlign: 'center' as const,
    padding: '32px 0',
  },
  empty: {
    color: 'var(--text-secondary, #9ca3af)',
    textAlign: 'center' as const,
    padding: '32px 0',
  },
};
