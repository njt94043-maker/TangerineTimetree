import { useState, useEffect } from 'react';
import type { GigWithCreator, AwayDateWithUser, GigChangelogWithUser } from '../supabase/types';
import { isGigIncomplete } from '../supabase/types';
import { getGigsByDate, getGigChangelog } from '../supabase/queries';

interface DayDetailProps {
  date: string;
  awayDates: AwayDateWithUser[];
  onClose: () => void;
  onAddGig: (date: string, type: 'gig' | 'practice') => void;
  onEditGig: (gigId: string) => void;
  onMarkAway: () => void;
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function fmt(time: string | null): string {
  return time ? time.slice(0, 5) : '\u2014';
}

function fmtFee(fee: number | null): string {
  return fee != null ? `\u00A3${fee.toFixed(2)}` : '\u2014';
}

export function DayDetail({ date, awayDates, onClose, onAddGig, onEditGig, onMarkAway }: DayDetailProps) {
  const [gigs, setGigs] = useState<GigWithCreator[]>([]);
  const [changelog, setChangelog] = useState<Map<string, GigChangelogWithUser[]>>(new Map());
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setExpandedLog(null);
    setLoading(true);
    getGigsByDate(date)
      .then(setGigs)
      .catch(() => setGigs([]))
      .finally(() => setLoading(false));
  }, [date]);

  async function toggleLog(gigId: string) {
    if (expandedLog === gigId) { setExpandedLog(null); return; }
    if (!changelog.has(gigId)) {
      const entries = await getGigChangelog(gigId);
      setChangelog(prev => new Map(prev).set(gigId, entries));
    }
    setExpandedLog(gigId);
  }

  const awayOnDate = awayDates.filter(a => date >= a.start_date && date <= a.end_date);

  return (
    <div className="overlay">
      <div className="overlay-dismiss" onClick={onClose} />
      <div className="day-sheet neu-card">
        <div className="sheet-handle" />

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{formatDisplayDate(date)}</h2>

        {loading && <p style={{ color: 'var(--color-text-dim)', textAlign: 'center', padding: '20px 0' }}>Loading...</p>}

        {!loading && gigs.length === 0 && (
          <p style={{ color: 'var(--color-text-dim)', textAlign: 'center', padding: '20px 0' }}>Nothing booked</p>
        )}

        {gigs.map(gig => {
          const isPractice = gig.gig_type === 'practice';
          return (
            <div key={gig.id} className="neu-inset" style={{ padding: 14, marginBottom: 12, cursor: 'pointer' }} onClick={() => onEditGig(gig.id)}>
              {isPractice && <span className="practice-badge">PRACTICE</span>}
              {!isPractice && isGigIncomplete(gig) && <span className="incomplete-badge">INCOMPLETE</span>}

              <div style={{ fontSize: 16, fontWeight: 700, color: isPractice ? 'var(--color-practice)' : undefined }}>
                {isPractice ? (gig.venue || 'Practice') : (gig.venue || 'Venue TBC')}
              </div>
              {!isPractice && <div style={{ fontSize: 13, color: 'var(--color-text-dim)', marginBottom: 10 }}>{gig.client_name || 'Client TBC'}</div>}

              <div className="detail-grid">
                {!isPractice && <div className="detail-row"><span className="detail-label">Fee</span><span className="detail-value">{fmtFee(gig.fee)}</span></div>}
                {!isPractice && <div className="detail-row"><span className="detail-label">Payment</span><span className="detail-value">{gig.payment_type || '\u2014'}</span></div>}
                {!isPractice && <div className="detail-row"><span className="detail-label">Load-in</span><span className="detail-value">{fmt(gig.load_time)}</span></div>}
                <div className="detail-row"><span className="detail-label">Start</span><span className="detail-value">{fmt(gig.start_time)}</span></div>
                {gig.end_time && <div className="detail-row"><span className="detail-label">End</span><span className="detail-value">{fmt(gig.end_time)}</span></div>}
              </div>

              {gig.notes && <p style={{ fontSize: 12, color: 'var(--color-text-dim)', fontStyle: 'italic', marginTop: 6 }}>{gig.notes}</p>}
              <p style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 8 }}>Added by {gig.creator_name}</p>

              <button className="changelog-toggle" onClick={(e) => { e.stopPropagation(); toggleLog(gig.id); }}>
                {expandedLog === gig.id ? 'Hide history' : 'Show history'}
              </button>

              {expandedLog === gig.id && (
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(68,68,90,0.3)' }}>
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
          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>Away</h3>
            {awayOnDate.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', padding: '4px 0' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-danger)' }}>{a.user_name}</span>
                {a.reason && <span style={{ fontSize: 12, color: 'var(--color-text-dim)', marginLeft: 8 }}>{a.reason}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-green" onClick={() => onAddGig(date, 'gig')}>Add Gig</button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-practice" style={{ flex: 1 }} onClick={() => onAddGig(date, 'practice')}>Add Practice</button>
            <button className="btn btn-tangerine" style={{ flex: 1 }} onClick={onMarkAway}>I'm Away</button>
          </div>
        </div>
      </div>
    </div>
  );
}
