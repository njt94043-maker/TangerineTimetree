import { useState, useEffect } from 'react';
import { getContactSubmissions, markSubmissionRead, archiveSubmission } from '@shared/supabase/queries';
import type { ContactSubmission } from '@shared/supabase/types';
import { formatRelative, formatShortDate } from '../utils/format';
import { LoadingSpinner } from './LoadingSpinner';

interface EnquiriesProps {
  onClose: () => void;
}

export function Enquiries({ onClose }: EnquiriesProps) {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadSubmissions();
  }, []);

  async function loadSubmissions() {
    try {
      const data = await getContactSubmissions();
      setSubmissions(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  async function handleExpand(item: ContactSubmission) {
    if (expandedId === item.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(item.id);
    if (!item.read) {
      await markSubmissionRead(item.id);
      setSubmissions(prev => prev.map(s => s.id === item.id ? { ...s, read: true } : s));
    }
  }

  async function handleArchive(id: string) {
    await archiveSubmission(id);
    setSubmissions(prev => prev.filter(s => s.id !== id));
    setExpandedId(null);
  }

  const unreadCount = submissions.filter(s => !s.read).length;

  return (
    <div className="enquiries">
      <div className="page-header">
        <h2 className="enquiries-title">
          Booking Enquiries
          {unreadCount > 0 && <span className="enquiries-badge">{unreadCount}</span>}
        </h2>
        <button className="btn btn-small" onClick={onClose}>Back</button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : submissions.length === 0 ? (
        <p className="enquiry-empty">
          No enquiries yet. When someone fills in the contact form on the website, they'll appear here.
        </p>
      ) : (
        <div className="enquiries-list">
          {submissions.map(item => (
            <div
              key={item.id}
              className={`enquiry-card neu-card ${!item.read ? 'unread' : ''} ${expandedId === item.id ? 'expanded' : ''}`}
              onClick={() => handleExpand(item)}
            >
              <div className="enquiry-header">
                <div className="enquiry-header-left">
                  {!item.read && <span className="enquiry-dot" />}
                  <span className="enquiry-name">{item.name}</span>
                  {item.event_type && <span className="enquiry-type">{item.event_type}</span>}
                </div>
                <span className="enquiry-date">{formatRelative(item.created_at)}</span>
              </div>

              {expandedId !== item.id && (
                <p className="enquiry-preview">{item.message}</p>
              )}

              {expandedId === item.id && (
                <div className="enquiry-detail">
                  <div className="enquiry-meta">
                    <div className="enquiry-meta-row">
                      <span className="enquiry-meta-label">Email</span>
                      <a href={`mailto:${item.email}`} className="enquiry-meta-value enquiry-email">{item.email}</a>
                    </div>
                    {item.event_type && (
                      <div className="enquiry-meta-row">
                        <span className="enquiry-meta-label">Event</span>
                        <span className="enquiry-meta-value">{item.event_type}</span>
                      </div>
                    )}
                    {item.preferred_date && (
                      <div className="enquiry-meta-row">
                        <span className="enquiry-meta-label">Date</span>
                        <span className="enquiry-meta-value">{formatShortDate(item.preferred_date)}</span>
                      </div>
                    )}
                  </div>
                  <p className="enquiry-message">{item.message}</p>
                  <div className="enquiry-actions">
                    <a
                      href={`mailto:${item.email}?subject=Re: Booking Enquiry - The Green Tangerine&body=Hi ${item.name},%0A%0AThanks for your enquiry!%0A%0A`}
                      className="btn btn-green btn-small enquiry-reply-link"
                      onClick={e => e.stopPropagation()}
                    >
                      Reply
                    </a>
                    <button
                      className="btn btn-small enquiry-archive-btn"
                      onClick={e => { e.stopPropagation(); handleArchive(item.id); }}
                    >
                      Archive
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
