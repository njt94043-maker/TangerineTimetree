import { useState, useEffect } from 'react';
import {
  getVenues, searchVenues, createVenue, deleteVenue,
} from '@shared/supabase/queries';
import type { Venue } from '@shared/supabase/types';
import { ErrorAlert } from './ErrorAlert';
import { ConfirmModal } from './ConfirmModal';

function avgRating(v: Venue): number | null {
  const vals = [v.rating_atmosphere, v.rating_crowd, v.rating_stage, v.rating_parking].filter(
    (r): r is number => r !== null,
  );
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((s, n) => s + n, 0) / vals.length);
}

function Stars({ value }: { value: number }) {
  return (
    <span className="star-rating-stars">
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} className={`star ${s <= value ? 'filled' : 'empty'}`}>
          {s <= value ? '\u2605' : '\u2606'}
        </span>
      ))}
    </span>
  );
}

interface VenueListProps {
  onClose: () => void;
  onVenuePress: (id: string) => void;
}

export function VenueList({ onClose, onVenuePress }: VenueListProps) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  // Add modal
  const [showForm, setShowForm] = useState(false);
  const [venueName, setVenueName] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Venue | null>(null);

  async function loadVenues() {
    try {
      const list = search.trim() ? await searchVenues(search.trim()) : await getVenues();
      setVenues(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load venues');
    }
  }

  useEffect(() => { loadVenues(); }, [search]);

  function openAdd() {
    setVenueName(''); setAddress(''); setPostcode('');
    setShowForm(true);
  }

  async function handleSave() {
    if (!venueName.trim()) { setError('Venue name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await createVenue({ venue_name: venueName.trim(), address: address.trim(), postcode: postcode.trim() });
      setShowForm(false);
      await loadVenues();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteVenue(deleteTarget.id);
      setDeleteTarget(null);
      await loadVenues();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setDeleteTarget(null);
    }
  }

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 className="page-title">Venues</h2>
        <div className="page-header-spacer" />
      </div>

      <div className="neu-inset" style={{ marginBottom: 8 }}>
        <input
          className="input-field"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search venues..."
        />
      </div>

      <button className="btn btn-primary btn-small btn-full" onClick={openAdd} style={{ marginBottom: 12 }}>
        + Add Venue
      </button>

      {error && <ErrorAlert message={error} compact />}

      <div className="venue-list-items">
        {venues.map(venue => {
          const avg = avgRating(venue);
          return (
            <div key={venue.id} className="venue-card neu-card">
              <div className="venue-card-info" onClick={() => onVenuePress(venue.id)} style={{ cursor: 'pointer' }}>
                <span className="venue-card-name">{venue.venue_name}</span>
                {venue.address && <span className="venue-card-address">{venue.address}</span>}
                {venue.postcode && <span className="venue-card-postcode">{venue.postcode}</span>}
                {avg !== null && (
                  <div className="venue-card-rating">
                    <Stars value={avg} />
                  </div>
                )}
              </div>
              <div className="venue-card-actions">
                <button className="btn btn-small btn-tangerine" onClick={() => onVenuePress(venue.id)}>View</button>
                <button className="btn btn-small btn-danger" onClick={() => setDeleteTarget(venue)}>Del</button>
              </div>
            </div>
          );
        })}
        {venues.length === 0 && (
          <p className="empty-text">{search ? 'No matching venues' : 'No venues yet'}</p>
        )}
      </div>

      {/* Add Venue Modal */}
      {showForm && (
        <div className="overlay" onClick={() => setShowForm(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">New Venue</h3>

            <label className="label">VENUE NAME *</label>
            <div className="neu-inset">
              <input className="input-field" value={venueName} onChange={e => setVenueName(e.target.value)} placeholder="e.g. The Rose & Crown" />
            </div>

            <label className="label">ADDRESS</label>
            <div className="neu-inset">
              <textarea className="input-field input-textarea" value={address} onChange={e => setAddress(e.target.value)} placeholder="Full address" rows={3} />
            </div>

            <label className="label">POSTCODE</label>
            <div className="neu-inset">
              <input className="input-field" value={postcode} onChange={e => setPostcode(e.target.value)} placeholder="e.g. SW1A 1AA" style={{ textTransform: 'uppercase' }} />
            </div>

            <div className="form-actions">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmModal
          message={`Delete "${deleteTarget.venue_name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}
    </div>
  );
}
