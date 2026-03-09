import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase/client';
import type { GigWithCreator } from '@shared/supabase/types';
import { isGigIncomplete } from '@shared/supabase/types';
import { getUpcomingGigs, getInvoiceByGigId, updateGig } from '@shared/supabase/queries';
import { fmt, fmtFee, formatGroupDate, daysUntil } from '../utils/format';
import { ErrorAlert } from './ErrorAlert';
import { LoadingSpinner } from './LoadingSpinner';

interface GigListProps {
  onGigPress: (gigId: string, date: string) => void;
  onAddGig: (date: string, type: 'gig' | 'practice') => void;
  onCreateInvoice?: (gig: GigWithCreator) => void;
}

export function GigList({ onGigPress, onAddGig, onCreateInvoice }: GigListProps) {
  const [gigs, setGigs] = useState<GigWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoicedGigIds, setInvoicedGigIds] = useState<Set<string>>(new Set());

  const fetchGigs = useCallback(async () => {
    try {
      const data = await getUpcomingGigs();
      setGigs(data);
      setError(null);
    } catch {
      setError('Failed to load gigs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGigs();
  }, [fetchGigs]);

  // Check which gigs already have invoices
  useEffect(() => {
    const invoiceGigs = gigs.filter(g => g.gig_type !== 'practice');
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

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('gig-list-web')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gigs' }, () => {
        fetchGigs();
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('GigList realtime error', status, err);
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [fetchGigs]);

  async function toggleVisibility(e: React.MouseEvent, gig: GigWithCreator) {
    e.stopPropagation();
    const newVis = gig.visibility === 'public' ? 'private' : 'public';
    try {
      await updateGig(gig.id, { visibility: newVis });
      fetchGigs();
    } catch { /* silently fail */ }
  }

  if (loading) {
    return <LoadingSpinner skeleton />;
  }

  if (error) {
    return <ErrorAlert message={error} onRetry={fetchGigs} />;
  }

  // Group gigs by date
  const grouped = new Map<string, GigWithCreator[]>();
  for (const gig of gigs) {
    const existing = grouped.get(gig.date) ?? [];
    existing.push(gig);
    grouped.set(gig.date, existing);
  }

  const dates = Array.from(grouped.keys());

  return (
    <div className="gig-list">
      {dates.length === 0 && (
        <div className="gig-list-empty neu-card">
          <p className="empty-message">No upcoming gigs</p>
          <button className="btn btn-green btn-small btn-full" onClick={() => {
            const today = new Date();
            onAddGig(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`, 'gig');
          }}>
            Add a Gig
          </button>
        </div>
      )}

      {dates.map(date => {
        const dateGigs = grouped.get(date)!;
        return (
          <div key={date} className="gig-list-group">
            <div className="gig-list-date-header">
              <span className="gig-list-date">{formatGroupDate(date)}</span>
              <span className="gig-list-countdown">{daysUntil(date)}</span>
            </div>

            {dateGigs.map(gig => {
              const isPractice = gig.gig_type === 'practice';
              return (
                <div
                  key={gig.id}
                  className={`gig-list-card neu-card ${isPractice ? 'practice' : 'gig'}`}
                  onClick={() => onGigPress(gig.id, gig.date)}
                >
                  <div className="gig-list-card-header">
                    <div className="gig-list-card-left">
                      {isPractice && <span className="practice-badge">PRACTICE</span>}
                      {!isPractice && isGigIncomplete(gig) && <span className="incomplete-badge">INCOMPLETE</span>}
                      {!isPractice && invoicedGigIds.has(gig.id) && <span className="invoiced-badge">INVOICED</span>}
                      <div className="gig-list-venue">
                        {isPractice ? (gig.venue || 'Practice') : (gig.venue || 'Venue TBC')}
                      </div>
                      {!isPractice && (
                        <div className="gig-list-client">{gig.client_name || 'Client TBC'}</div>
                      )}
                    </div>
                    <div className="gig-list-card-right">
                      {!isPractice && (
                        <button
                          className={`visibility-toggle ${gig.visibility === 'public' ? 'public' : ''}`}
                          onClick={(e) => toggleVisibility(e, gig)}
                          title={gig.visibility === 'public' ? 'Visible on website (click to hide)' : 'Hidden from website (click to show)'}
                        >
                          {gig.visibility === 'public' ? '\uD83C\uDF10' : '\uD83D\uDD12'}
                        </button>
                      )}
                      {!isPractice && gig.fee != null && (
                        <div className="gig-list-fee">{fmtFee(gig.fee)}</div>
                      )}
                    </div>
                  </div>

                  <div className="gig-list-meta">
                    <span>{fmt(gig.start_time)}{gig.end_time ? ` \u2013 ${fmt(gig.end_time)}` : ''}</span>
                    {!isPractice && gig.load_time && (
                      <span>Load {fmt(gig.load_time)}</span>
                    )}
                    {!isPractice && gig.payment_type && (
                      <span className="gig-list-payment">{gig.payment_type}</span>
                    )}
                  </div>

                  {gig.notes && (
                    <div className="gig-list-notes">{gig.notes}</div>
                  )}

                  {!isPractice && !invoicedGigIds.has(gig.id) && onCreateInvoice && (
                    <button
                      className="btn btn-small btn-primary gig-create-invoice-btn"
                      onClick={(e) => { e.stopPropagation(); onCreateInvoice(gig); }}
                    >
                      Create Invoice
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
