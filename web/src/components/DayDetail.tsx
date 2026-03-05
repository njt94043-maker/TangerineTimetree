import { useState, useEffect, useRef } from 'react';
import type { GigWithCreator, AwayDateWithUser, GigChangelogWithUser } from '@shared/supabase/types';
import { isGigIncomplete } from '@shared/supabase/types';
import { getGigsByDate, getGigChangelog, deleteGig } from '@shared/supabase/queries';
import { isNetworkError, queueMutation } from '../hooks/useOfflineQueue';
import { formatDisplayDate, fmt, fmtFee } from '../utils/format';
import { ErrorAlert } from './ErrorAlert';
import { LoadingSpinner } from './LoadingSpinner';
import { ConfirmModal } from './ConfirmModal';

interface DayDetailProps {
  date: string;
  awayDates: AwayDateWithUser[];
  eventDates?: string[];
  onClose: () => void;
  onAddGig: (date: string, type: 'gig' | 'practice') => void;
  onEditGig: (gigId: string) => void;
  onMarkAway: () => void;
  onGigDeleted?: () => void;
  onDateChange?: (date: string) => void;
}

export function DayDetail({ date, awayDates, eventDates = [], onClose, onAddGig, onEditGig, onMarkAway, onGigDeleted, onDateChange }: DayDetailProps) {
  const [gigs, setGigs] = useState<GigWithCreator[]>([]);
  const [changelog, setChangelog] = useState<Map<string, GigChangelogWithUser[]>>(new Map());
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
  const touchStartX = useRef(0);

  function fetchDayGigs() {
    setExpandedLog(null);
    setLoading(true);
    setError(null);
    getGigsByDate(date)
      .then(setGigs)
      .catch((err) => setError(isNetworkError(err) ? 'You\'re offline — gigs can\'t be loaded right now' : 'Failed to load gigs for this day'))
      .finally(() => setLoading(false));
  }

  async function handleDelete(gigId: string) {
    try {
      await deleteGig(gigId);
    } catch (err) {
      if (isNetworkError(err)) {
        queueMutation('deleteGig', { id: gigId });
      } else {
        setError('Failed to delete');
        return;
      }
    }
    setGigs(prev => prev.filter(g => g.id !== gigId));
    onGigDeleted?.();
  }

  useEffect(() => {
    fetchDayGigs();
  }, [date]);

  async function toggleLog(gigId: string) {
    if (expandedLog === gigId) { setExpandedLog(null); return; }
    if (!changelog.has(gigId)) {
      try {
        const entries = await getGigChangelog(gigId);
        setChangelog(prev => new Map(prev).set(gigId, entries));
      } catch { return; }
    }
    setExpandedLog(gigId);
  }

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

  return (
    <div className="overlay">
      <div className="overlay-dismiss" onClick={onClose} />
      <div
        className="day-sheet neu-card"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="sheet-handle" />

        {/* Navigation header */}
        <div className="day-nav-row">
          <button
            className={`day-nav-btn ${hasPrev ? '' : 'day-nav-btn-disabled'}`}
            onClick={goToPrevEvent}
            disabled={!hasPrev}
            aria-label="Previous event"
          >&lsaquo;</button>
          <h2
            key={date}
            className={`day-title ${slideDir === 'left' ? 'slide-from-right' : slideDir === 'right' ? 'slide-from-left' : ''}`}
            onAnimationEnd={() => setSlideDir(null)}
          >{formatDisplayDate(date)}</h2>
          <button
            className={`day-nav-btn ${hasNext ? '' : 'day-nav-btn-disabled'}`}
            onClick={goToNextEvent}
            disabled={!hasNext}
            aria-label="Next event"
          >&rsaquo;</button>
        </div>

        {loading && <LoadingSpinner skeleton />}

        {error && <ErrorAlert message={error} onRetry={fetchDayGigs} />}

        {!loading && !error && gigs.length === 0 && (
          <p className="empty-message">Nothing booked</p>
        )}

        {gigs.map(gig => {
          const isPractice = gig.gig_type === 'practice';
          return (
            <div key={gig.id} className="neu-inset gig-card-inset" onClick={() => onEditGig(gig.id)}>
              {isPractice && <span className="practice-badge">PRACTICE</span>}
              {!isPractice && isGigIncomplete(gig) && <span className="incomplete-badge">INCOMPLETE</span>}

              <div className={`gig-venue-name ${isPractice ? 'gig-venue-practice' : ''}`}>
                {isPractice ? (gig.venue || 'Practice') : (gig.venue || 'Venue TBC')}
              </div>
              {!isPractice && <div className="gig-client-name">{gig.client_name || 'Client TBC'}</div>}

              <div className="detail-grid">
                {!isPractice && <div className="detail-row"><span className="detail-label">Fee</span><span className="detail-value">{fmtFee(gig.fee)}</span></div>}
                {!isPractice && <div className="detail-row"><span className="detail-label">Payment</span><span className="detail-value">{gig.payment_type || '\u2014'}</span></div>}
                {!isPractice && <div className="detail-row"><span className="detail-label">Load-in</span><span className="detail-value">{fmt(gig.load_time)}</span></div>}
                <div className="detail-row"><span className="detail-label">Start</span><span className="detail-value">{fmt(gig.start_time)}</span></div>
                {gig.end_time && <div className="detail-row"><span className="detail-label">End</span><span className="detail-value">{fmt(gig.end_time)}</span></div>}
              </div>

              {gig.notes && <p className="gig-notes-text">{gig.notes}</p>}
              <p className="gig-creator-text">Added by {gig.creator_name}</p>

              <div className="gig-actions-row">
                <button className="changelog-toggle" onClick={(e) => { e.stopPropagation(); toggleLog(gig.id); }}>
                  {expandedLog === gig.id ? 'Hide history' : 'Show history'}
                </button>
                <button className="changelog-toggle changelog-toggle-danger" onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(gig.id); }}>
                  Delete
                </button>
              </div>

              {expandedLog === gig.id && (
                <div className="changelog-section">
                  {(changelog.get(gig.id) ?? []).map(entry => (
                    <div key={entry.id} className="changelog-entry">
                      <div className="changelog-text">
                        {entry.action === 'created'
                          ? `${entry.user_name} created this`
                          : entry.action === 'deleted'
                            ? `${entry.user_name} deleted this`
                            : `${entry.user_name} changed ${entry.field_changed} from "${entry.old_value}" to "${entry.new_value}"`}
                      </div>
                      <div className="changelog-time">
                        {new Date(entry.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                  {(changelog.get(gig.id) ?? []).length === 0 && <div className="changelog-text">No history yet</div>}
                </div>
              )}
            </div>
          );
        })}

        {/* Away section */}
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
          <button className="btn btn-green" onClick={() => onAddGig(date, 'gig')}>Add Gig</button>
          <div className="day-actions-row">
            <button className="btn btn-practice btn-flex" onClick={() => onAddGig(date, 'practice')}>Add Practice</button>
            <button className="btn btn-tangerine btn-flex" onClick={onMarkAway}>I'm Away</button>
          </div>
        </div>
      </div>

      {confirmDeleteId && (
        <ConfirmModal
          message="Delete this gig?"
          confirmLabel="Delete"
          danger
          onConfirm={() => { handleDelete(confirmDeleteId); setConfirmDeleteId(null); }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}
