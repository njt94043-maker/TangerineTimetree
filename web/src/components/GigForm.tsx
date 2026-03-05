import { useState, useEffect, useRef, type FormEvent } from 'react';
import { supabase } from '../supabase/client';
import { createGig, updateGig, deleteGig, getGigAttachments, createGigAttachment, deleteGigAttachment, getGigFieldSuggestions, type GigFieldSuggestions } from '@shared/supabase/queries';
import { AutocompleteInput } from './AutocompleteInput';
import { EntityPicker } from './EntityPicker';
import { isGigIncomplete } from '@shared/supabase/types';
import type { Gig, GigVisibility, GigAttachment } from '@shared/supabase/types';
import { isNetworkError, queueMutation } from '../hooks/useOfflineQueue';
import { ErrorAlert } from './ErrorAlert';
import { ConfirmModal } from './ConfirmModal';
import { TimePicker } from 'react-ios-time-picker';

interface GigFormProps {
  date: string;
  gigId?: string | null;
  initialType?: 'gig' | 'practice';
  onClose: () => void;
  onSaved: () => void;
}

const VISIBILITY_OPTIONS: { value: GigVisibility; label: string; desc: string }[] = [
  { value: 'hidden', label: 'Not Shared', desc: 'Hidden from website' },
  { value: 'public', label: 'Public Gig', desc: 'Full details on website' },
  { value: 'private', label: 'Private Booking', desc: 'Shown as "Private Booking"' },
];

/** Compress image using Canvas before upload */
async function compressImage(file: File, maxWidth = 1200, quality = 0.7): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        blob => resolve(blob ?? file),
        'image/jpeg',
        quality,
      );
    };
    img.src = URL.createObjectURL(file);
  });
}

export function GigForm({ date: initialDate, gigId, initialType = 'gig', onClose, onSaved }: GigFormProps) {
  const isEditing = !!gigId;

  const [date, setDate] = useState(initialDate);
  const [gigType, setGigType] = useState<'gig' | 'practice'>(initialType);
  const [venue, setVenue] = useState('');
  const [venueId, setVenueId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState<string | null>(null);
  const [fee, setFee] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'invoice' | ''>('');
  const [loadTime, setLoadTime] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [visibility, setVisibility] = useState<GigVisibility>('hidden');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmIncomplete, setConfirmIncomplete] = useState<string | null>(null);

  // Attachments
  const [attachments, setAttachments] = useState<GigAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deleteAttachmentTarget, setDeleteAttachmentTarget] = useState<GigAttachment | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Field suggestions
  const [suggestions, setSuggestions] = useState<GigFieldSuggestions>({ venues: [], clients: [], fees: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingSubmitRef = useRef<any>(null);

  useEffect(() => {
    if (gigId) {
      supabase.from('gigs').select('*').eq('id', gigId).single().then(({ data, error: err }) => {
        if (err) { setError('Failed to load gig details'); return; }
        if (data) {
          setDate(data.date ?? initialDate);
          setGigType(data.gig_type ?? 'gig');
          setVenue(data.venue ?? '');
          setVenueId(data.venue_id ?? null);
          setClientName(data.client_name ?? '');
          setClientId(data.client_id ?? null);
          setFee(data.fee != null ? String(data.fee) : '');
          setPaymentType(data.payment_type ?? '');
          setLoadTime(data.load_time ? data.load_time.slice(0, 5) : '');
          setStartTime(data.start_time ? data.start_time.slice(0, 5) : '');
          setEndTime(data.end_time ? data.end_time.slice(0, 5) : '');
          setNotes(data.notes ?? '');
          setVisibility(data.visibility ?? 'hidden');
        }
      });
      getGigAttachments(gigId).then(setAttachments).catch(() => {});
    }
  }, [gigId, initialDate]);

  useEffect(() => {
    getGigFieldSuggestions().then(setSuggestions).catch(() => {});
  }, []);

  const isPractice = gigType === 'practice';
  const label = isPractice ? 'Practice' : 'Gig';

  function buildGigData() {
    return {
      date,
      gig_type: gigType,
      venue,
      venue_id: isPractice ? null : venueId,
      client_name: clientName,
      client_id: isPractice ? null : clientId,
      fee: fee ? parseFloat(fee) : null,
      payment_type: paymentType,
      load_time: loadTime || null,
      start_time: startTime || null,
      end_time: endTime || null,
      notes,
      visibility: isPractice ? 'hidden' as GigVisibility : visibility,
    };
  }

  type GigData = ReturnType<typeof buildGigData>;

  async function doSave(data: GigData) {
    setSaving(true);
    setError('');
    try {
      if (isEditing && gigId) {
        await updateGig(gigId, data);
      } else {
        await createGig(data);
      }
      onSaved();
    } catch (err) {
      if (isNetworkError(err)) {
        if (isEditing && gigId) {
          queueMutation('updateGig', { id: gigId, updates: data });
        } else {
          queueMutation('createGig', data);
        }
        onSaved();
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const data = buildGigData();

    const checkGig = { ...data, id: '', created_by: '', created_at: '', updated_at: '', fee: data.fee, payment_type: data.payment_type || '' } as Gig;
    if (isGigIncomplete(checkGig)) {
      const missing: string[] = [];
      if (!venue) missing.push('venue');
      if (gigType !== 'practice' && !clientName) missing.push('client');
      if (gigType !== 'practice' && data.fee == null) missing.push('fee');
      if (!startTime) missing.push('start time');
      pendingSubmitRef.current = data;
      setConfirmIncomplete(`This ${gigType} is missing: ${missing.join(', ')}.\n\nSave anyway? It will be marked INCOMPLETE.`);
      return;
    }

    doSave(data);
  }

  async function handleDelete() {
    if (!gigId) return;
    try {
      await deleteGig(gigId);
      onSaved();
    } catch (err) {
      if (isNetworkError(err)) {
        queueMutation('deleteGig', { id: gigId });
        onSaved();
        return;
      }
      setError('Failed to delete');
    }
  }

  // ─── Attachment handlers ──────────────────────────────

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0 || !gigId) return;
    setUploading(true);
    setError('');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      try {
        const compressed = await compressImage(file);
        const path = `${gigId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;

        const { error: uploadErr } = await supabase.storage
          .from('gig-attachments')
          .upload(path, compressed, { cacheControl: '31536000', upsert: false, contentType: 'image/jpeg' });

        if (uploadErr) { setError(`Upload failed: ${uploadErr.message}`); continue; }

        // Get signed URL (private bucket)
        const { data: urlData } = await supabase.storage.from('gig-attachments').createSignedUrl(path, 60 * 60 * 24 * 365);
        const fileUrl = urlData?.signedUrl ?? '';

        await createGigAttachment(gigId, fileUrl, path, compressed.size);
      } catch {
        setError('Failed to upload image');
      }
    }

    setUploading(false);
    getGigAttachments(gigId).then(setAttachments).catch(() => {});
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDeleteAttachment() {
    if (!deleteAttachmentTarget || !gigId) return;
    try {
      await deleteGigAttachment(deleteAttachmentTarget.id, deleteAttachmentTarget.storage_path);
      setDeleteAttachmentTarget(null);
      getGigAttachments(gigId).then(setAttachments).catch(() => {});
    } catch {
      setError('Failed to delete attachment');
      setDeleteAttachmentTarget(null);
    }
  }

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <button className="btn btn-small btn-green" onClick={onClose}>{'\u25C0'} Back</button>
        <h2 className="page-title">{isEditing ? `Edit ${label}` : `New ${label}`}</h2>
        <div className="page-header-spacer" />
      </div>

      <form onSubmit={handleSubmit}>
        <label className="label" htmlFor="gig-date">DATE</label>
        <div className="neu-inset">
          <input id="gig-date" className="input-field" type="date" value={date} onChange={e => setDate(e.target.value)} required />
        </div>

        {!isPractice && (
          <>
            <label className="label">VENUE</label>
            <EntityPicker
              mode="venue"
              value={venue}
              entityId={venueId}
              onChange={(text, id) => { setVenue(text); setVenueId(id); }}
              placeholder="e.g. Gin & Juice, Mumbles"
            />

            <label className="label">CLIENT / BOOKER</label>
            <EntityPicker
              mode="client"
              value={clientName}
              entityId={clientId}
              onChange={(text, id) => { setClientName(text); setClientId(id); }}
              placeholder="e.g. Suave Agency"
            />

            <label className="label" htmlFor="gig-fee">FEE</label>
            <div className="neu-inset">
              <AutocompleteInput id="gig-fee" placeholder="e.g. 400" type="number" step="0.01" inputMode="decimal" value={fee} onChange={setFee} suggestions={suggestions.fees.map(String)} />
            </div>

            <div className="label">PAYMENT TYPE</div>
            <div className="toggle-row">
              <button type="button" className={`toggle-btn neu-card ${paymentType === 'cash' ? 'active' : ''}`} onClick={() => setPaymentType('cash')}>Cash</button>
              <button type="button" className={`toggle-btn neu-card ${paymentType === 'invoice' ? 'active' : ''}`} onClick={() => setPaymentType('invoice')}>Invoice</button>
            </div>

            <label className="label">LOAD-IN TIME</label>
            <div className="time-picker-wrap">
              <TimePicker value={loadTime || '18:00'} onChange={setLoadTime} pickerDefaultValue="18:00" />
            </div>
          </>
        )}

        <label className="label">START TIME</label>
        <div className="time-picker-wrap">
          <TimePicker value={startTime || '21:00'} onChange={setStartTime} pickerDefaultValue="21:00" />
        </div>

        <label className="label">END TIME (OPTIONAL)</label>
        <div className="time-picker-wrap">
          <TimePicker value={endTime || '23:30'} onChange={setEndTime} pickerDefaultValue="23:30" />
        </div>

        {isPractice && (
          <>
            <label className="label" htmlFor="gig-location">LOCATION (OPTIONAL)</label>
            <div className="neu-inset">
              <AutocompleteInput id="gig-location" placeholder="e.g. Neil's garage" value={venue} onChange={setVenue} suggestions={suggestions.venues} />
            </div>
          </>
        )}

        <label className="label" htmlFor="gig-notes">NOTES (OPTIONAL)</label>
        <div className="neu-inset">
          <textarea
            id="gig-notes"
            className="input-field input-noresize"
            placeholder="Any extra details..."
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* Visibility — gigs only */}
        {!isPractice && (
          <>
            <label className="label" htmlFor="gig-visibility">WEBSITE VISIBILITY</label>
            <div className="neu-inset">
              <select
                id="gig-visibility"
                className="input-field"
                value={visibility}
                onChange={e => setVisibility(e.target.value as GigVisibility)}
              >
                {VISIBILITY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label} — {o.desc}</option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Attachments — only for saved gigs */}
        {isEditing && gigId && (
          <div className="gig-attachments-section">
            <label className="label">ATTACHMENTS</label>
            {attachments.length > 0 && (
              <div className="attachment-grid">
                {attachments.map(a => (
                  <div key={a.id} className="attachment-thumb" onClick={() => setViewingImage(a.file_url)}>
                    <img src={a.file_url} alt="Attachment" />
                    <button
                      className="attachment-delete-btn"
                      type="button"
                      onClick={e => { e.stopPropagation(); setDeleteAttachmentTarget(a); }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={e => handleFileUpload(e.target.files)}
            />
            <button
              className="btn btn-outline btn-small btn-full"
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              style={{ marginTop: 8 }}
            >
              {uploading ? 'Uploading...' : '+ Add Screenshots'}
            </button>
          </div>
        )}

        {error && <ErrorAlert message={error} compact />}

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : isEditing ? `Update ${label}` : `Save ${label}`}
          </button>
          {isEditing && (
            <button className="btn btn-danger" type="button" onClick={() => setConfirmDelete(true)}>Delete</button>
          )}
        </div>
      </form>

      {/* Image lightbox */}
      {viewingImage && (
        <div className="overlay" onClick={() => setViewingImage(null)}>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <img src={viewingImage} alt="Full size" className="lightbox-image" />
            <button className="btn btn-outline btn-small" onClick={() => setViewingImage(null)} style={{ marginTop: 12 }}>Close</button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          message="Delete this gig?"
          confirmLabel="Delete"
          danger
          onConfirm={() => { setConfirmDelete(false); handleDelete(); }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}

      {confirmIncomplete && (
        <ConfirmModal
          message={confirmIncomplete}
          confirmLabel="Save Anyway"
          onConfirm={() => { setConfirmIncomplete(null); if (pendingSubmitRef.current) doSave(pendingSubmitRef.current); }}
          onCancel={() => { setConfirmIncomplete(null); pendingSubmitRef.current = null; }}
        />
      )}

      {deleteAttachmentTarget && (
        <ConfirmModal
          message="Delete this attachment?"
          confirmLabel="Delete"
          danger
          onConfirm={handleDeleteAttachment}
          onCancel={() => setDeleteAttachmentTarget(null)}
        />
      )}
    </div>
  );
}
