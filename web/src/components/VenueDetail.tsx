import { useState, useEffect, useRef } from 'react';
import {
  getVenue, updateVenue, deleteVenue,
  getVenuePhotos, uploadVenuePhoto, deleteVenuePhoto,
} from '@shared/supabase/queries';
import type { Venue, VenuePhoto } from '@shared/supabase/types';
import { supabase } from '../supabase/client';
import { ErrorAlert } from './ErrorAlert';
import { ConfirmModal } from './ConfirmModal';

function StarRating({ value, onChange, label }: {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
}) {
  return (
    <div className="star-rating-row">
      <span className="star-rating-label">{label}</span>
      <span className="star-rating-stars">
        {[1, 2, 3, 4, 5].map(star => (
          <span
            key={star}
            className={`star ${star <= (value ?? 0) ? 'filled' : 'empty'} clickable`}
            onClick={() => onChange(value === star ? null : star)}
          >
            {star <= (value ?? 0) ? '\u2605' : '\u2606'}
          </span>
        ))}
      </span>
    </div>
  );
}

interface VenueDetailProps {
  venueId: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function VenueDetail({ venueId, onClose, onDeleted }: VenueDetailProps) {
  const [venue, setVenue] = useState<Venue | null>(null);
  const [photos, setPhotos] = useState<VenuePhoto[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [loaded, setLoaded] = useState(false);

  // Editable fields
  const [venueName, setVenueName] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [ratingAtmosphere, setRatingAtmosphere] = useState<number | null>(null);
  const [ratingCrowd, setRatingCrowd] = useState<number | null>(null);
  const [ratingStage, setRatingStage] = useState<number | null>(null);
  const [ratingParking, setRatingParking] = useState<number | null>(null);

  // Delete confirmations
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletePhotoTarget, setDeletePhotoTarget] = useState<VenuePhoto | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const v = await getVenue(venueId);
        if (v) {
          setVenue(v);
          setVenueName(v.venue_name);
          setAddress(v.address);
          setPostcode(v.postcode);
          setContactName(v.contact_name);
          setEmail(v.email);
          setPhone(v.phone);
          setNotes(v.notes);
          setRatingAtmosphere(v.rating_atmosphere);
          setRatingCrowd(v.rating_crowd);
          setRatingStage(v.rating_stage);
          setRatingParking(v.rating_parking);
        }
        const p = await getVenuePhotos(venueId);
        setPhotos(p);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load venue');
      } finally {
        setLoaded(true);
      }
    }
    load();
  }, [venueId]);

  async function handleSave() {
    if (!venueName.trim()) { setError('Venue name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await updateVenue(venueId, {
        venue_name: venueName.trim(),
        address: address.trim(),
        postcode: postcode.trim(),
        contact_name: contactName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
        rating_atmosphere: ratingAtmosphere,
        rating_crowd: ratingCrowd,
        rating_stage: ratingStage,
        rating_parking: ratingParking,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteVenue() {
    try {
      await deleteVenue(venueId);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
      setConfirmDelete(false);
    }
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      setUploadProgress(`Uploading ${i + 1}/${files.length}: ${file.name}`);
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `venues/${venueId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('venue-photos')
        .upload(path, file, { cacheControl: '31536000', upsert: false });

      if (uploadError) {
        setError(`Upload failed: ${uploadError.message}`);
        continue;
      }

      const { data: urlData } = supabase.storage.from('venue-photos').getPublicUrl(path);
      await uploadVenuePhoto(venueId, urlData.publicUrl, path);
    }

    setUploadProgress('');
    setUploading(false);
    // Reset file input
    if (fileRef.current) fileRef.current.value = '';
    const updatedPhotos = await getVenuePhotos(venueId);
    setPhotos(updatedPhotos);
  }

  async function handleDeletePhoto() {
    if (!deletePhotoTarget) return;
    try {
      await deleteVenuePhoto(deletePhotoTarget.id, deletePhotoTarget.storage_path);
      setPhotos(prev => prev.filter(p => p.id !== deletePhotoTarget.id));
      setDeletePhotoTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete photo');
      setDeletePhotoTarget(null);
    }
  }

  if (!loaded) return <div className="form-wrap form-top"><p className="empty-text">Loading...</p></div>;
  if (!venue) return <div className="form-wrap form-top"><p className="empty-text">Venue not found</p></div>;

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 className="page-title">Venue Detail</h2>
        <button className="btn btn-small btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {error && <ErrorAlert message={error} compact />}

      {/* Venue Details */}
      <div className="neu-card" style={{ marginBottom: 12 }}>
        <label className="label">VENUE NAME *</label>
        <div className="neu-inset">
          <input className="input-field" value={venueName} onChange={e => setVenueName(e.target.value)} />
        </div>

        <label className="label">ADDRESS</label>
        <div className="neu-inset">
          <textarea className="input-field input-textarea" value={address} onChange={e => setAddress(e.target.value)} rows={3} />
        </div>

        <label className="label">POSTCODE</label>
        <div className="neu-inset">
          <input className="input-field" value={postcode} onChange={e => setPostcode(e.target.value)} style={{ textTransform: 'uppercase' }} />
        </div>
      </div>

      {/* Contact Info */}
      <div className="neu-card" style={{ marginBottom: 12 }}>
        <label className="label" style={{ marginTop: 0 }}>CONTACT INFO</label>

        <label className="label">CONTACT NAME</label>
        <div className="neu-inset">
          <input className="input-field" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="e.g. John Smith" />
        </div>

        <label className="label">EMAIL</label>
        <div className="neu-inset">
          <input className="input-field" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. bookings@venue.com" />
        </div>

        <label className="label">PHONE</label>
        <div className="neu-inset">
          <input className="input-field" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 01234 567890" />
        </div>
      </div>

      {/* Ratings */}
      <div className="neu-card" style={{ marginBottom: 12 }}>
        <label className="label" style={{ marginTop: 0 }}>RATINGS</label>
        <StarRating label="Atmosphere" value={ratingAtmosphere} onChange={setRatingAtmosphere} />
        <StarRating label="Crowd" value={ratingCrowd} onChange={setRatingCrowd} />
        <StarRating label="Stage" value={ratingStage} onChange={setRatingStage} />
        <StarRating label="Parking" value={ratingParking} onChange={setRatingParking} />
      </div>

      {/* Notes */}
      <div className="neu-card" style={{ marginBottom: 12 }}>
        <label className="label" style={{ marginTop: 0 }}>NOTES</label>
        <div className="neu-inset">
          <textarea
            className="input-field input-textarea"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes about this venue..."
            rows={4}
          />
        </div>
      </div>

      {/* Photos */}
      <div className="neu-card" style={{ marginBottom: 12 }}>
        <label className="label" style={{ marginTop: 0 }}>PHOTOS</label>

        {photos.length > 0 && (
          <div className="venue-photo-grid">
            {photos.map(photo => (
              <div key={photo.id} className="venue-photo-item">
                <img src={photo.file_url} alt={photo.caption || 'Venue photo'} />
                <button
                  className="venue-photo-delete"
                  onClick={() => setDeletePhotoTarget(photo)}
                  title="Delete photo"
                >
                  {'\u2715'}
                </button>
              </div>
            ))}
          </div>
        )}

        {photos.length === 0 && !uploading && (
          <p className="empty-text" style={{ marginBottom: 8 }}>No photos yet</p>
        )}

        {uploadProgress && (
          <p className="empty-text" style={{ marginBottom: 8, color: 'var(--color-green)' }}>{uploadProgress}</p>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleFileUpload(e.target.files)}
        />
        <button
          className="btn btn-small btn-primary"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Uploading...' : '+ Add Photos'}
        </button>
      </div>

      {/* Delete Venue */}
      <button className="btn btn-danger btn-full" onClick={() => setConfirmDelete(true)} style={{ marginBottom: 32 }}>
        Delete Venue
      </button>

      {/* Delete venue confirmation */}
      {confirmDelete && (
        <ConfirmModal
          message={`Delete "${venue.venue_name}"? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDeleteVenue}
          onCancel={() => setConfirmDelete(false)}
          danger
        />
      )}

      {/* Delete photo confirmation */}
      {deletePhotoTarget && (
        <ConfirmModal
          message="Delete this photo? This cannot be undone."
          confirmLabel="Delete"
          onConfirm={handleDeletePhoto}
          onCancel={() => setDeletePhotoTarget(null)}
          danger
        />
      )}
    </div>
  );
}
