import { useState, useRef, useEffect, useCallback } from 'react';
import { searchVenues, searchClients, getVenues, getClients, getVenue, createVenue, createClient, updateVenue } from '@shared/supabase/queries';
import type { Venue, Client } from '@shared/supabase/types';

interface EntityPickerProps {
  mode: 'venue' | 'client';
  value: string;
  entityId: string | null;
  onChange: (text: string, id: string | null) => void;
  placeholder?: string;
}

type Entity = Venue | Client;

function getName(entity: Entity, mode: 'venue' | 'client'): string {
  return mode === 'venue' ? (entity as Venue).venue_name : (entity as Client).company_name;
}

function getSubtitle(entity: Entity, mode: 'venue' | 'client'): string {
  if (mode === 'venue') {
    const v = entity as Venue;
    return [v.address, v.postcode].filter(Boolean).join(', ');
  }
  return (entity as Client).contact_name || '';
}

export function EntityPicker({ mode, value, entityId, onChange, placeholder }: EntityPickerProps) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Entity[]>([]);
  const [showAddNew, setShowAddNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPostcode, setNewPostcode] = useState('');
  const [newContact, setNewContact] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Venue detail expansion
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [venueDetail, setVenueDetail] = useState<Venue | null>(null);
  const [editAddress, setEditAddress] = useState('');
  const [editPostcode, setEditPostcode] = useState('');
  const [editContact, setEditContact] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);

  const doSearch = useCallback(async (query: string) => {
    try {
      if (!query.trim()) {
        const all = mode === 'venue' ? await getVenues() : await getClients();
        setResults(all.slice(0, 8));
      } else {
        const found = mode === 'venue' ? await searchVenues(query) : await searchClients(query);
        setResults(found.slice(0, 8));
      }
    } catch {
      setResults([]);
    }
  }, [mode]);

  function handleInputChange(text: string) {
    onChange(text, null);
    setShowAddNew(false);
    setDetailsExpanded(false);
    setVenueDetail(null);
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(text), 300);
  }

  function handleSelect(entity: Entity) {
    onChange(getName(entity, mode), entity.id);
    setOpen(false);
    setShowAddNew(false);
  }

  async function handleCreateNew() {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      if (mode === 'venue') {
        const venue = await createVenue({
          venue_name: newName.trim(),
          address: newAddress.trim(),
          postcode: newPostcode.trim(),
          contact_name: newContact.trim(),
          email: newEmail.trim(),
          phone: newPhone.trim(),
        });
        onChange(venue.venue_name, venue.id);
      } else {
        const client = await createClient({ company_name: newName.trim() });
        onChange(client.company_name, client.id);
      }
      setShowAddNew(false);
      setOpen(false);
      resetNewFields();
    } catch (err) {
      const entityLabel = mode === 'venue' ? 'venue' : 'client';
      setCreateError(err instanceof Error ? err.message : `Failed to create ${entityLabel}`);
    } finally {
      setCreating(false);
    }
  }

  function resetNewFields() {
    setNewName('');
    setNewAddress('');
    setNewPostcode('');
    setNewContact('');
    setNewEmail('');
    setNewPhone('');
  }

  async function toggleDetails() {
    if (detailsExpanded) {
      setDetailsExpanded(false);
      return;
    }
    if (!entityId || mode !== 'venue') return;
    try {
      const v = await getVenue(entityId);
      if (v) {
        setVenueDetail(v);
        setEditAddress(v.address || '');
        setEditPostcode(v.postcode || '');
        setEditContact(v.contact_name || '');
        setEditEmail(v.email || '');
        setEditPhone(v.phone || '');
        setDetailsExpanded(true);
      }
    } catch { /* ignore */ }
  }

  async function handleSaveDetails() {
    if (!entityId || !venueDetail) return;
    setSavingDetail(true);
    try {
      await updateVenue(entityId, {
        address: editAddress.trim(),
        postcode: editPostcode.trim(),
        contact_name: editContact.trim(),
        email: editEmail.trim(),
        phone: editPhone.trim(),
      });
      setDetailsExpanded(false);
    } catch {
      setCreateError('Failed to update venue');
    } finally {
      setSavingDetail(false);
    }
  }

  // Clean up debounce timer on unmount
  useEffect(() => () => {
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowAddNew(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load initial results on focus
  function handleFocus() {
    setOpen(true);
    doSearch(value);
  }

  const showDropdown = open;
  const label = mode === 'venue' ? 'Venue' : 'Client';

  return (
    <div ref={wrapRef} className="autocomplete-wrap">
      <div className="entity-input-row">
        <input
          className="input-field"
          value={value}
          onChange={e => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
          autoComplete="off"
        />
        {entityId && <span className="entity-linked-badge">Linked</span>}
      </div>

      {/* Venue details toggle — shown when venue is linked and dropdown is closed */}
      {mode === 'venue' && entityId && !open && (
        <button type="button" className="entity-details-toggle" onClick={toggleDetails}>
          {detailsExpanded ? 'Hide Details \u25B2' : 'View / Edit Details \u25BC'}
        </button>
      )}

      {/* Venue details panel */}
      {detailsExpanded && venueDetail && (
        <div className="entity-detail-panel">
          <label className="entity-detail-label">ADDRESS</label>
          <input className="input-field" value={editAddress} onChange={e => setEditAddress(e.target.value)} placeholder="Address" />

          <label className="entity-detail-label">POSTCODE</label>
          <input className="input-field" value={editPostcode} onChange={e => setEditPostcode(e.target.value)} placeholder="Postcode" />

          <label className="entity-detail-label">CONTACT NAME</label>
          <input className="input-field" value={editContact} onChange={e => setEditContact(e.target.value)} placeholder="Contact name" />

          <label className="entity-detail-label">EMAIL</label>
          <input className="input-field" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Email" />

          <label className="entity-detail-label">PHONE</label>
          <input className="input-field" type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Phone" />

          <div className="entity-mini-form-actions">
            <button type="button" className="btn btn-small btn-green" onClick={handleSaveDetails} disabled={savingDetail}>
              {savingDetail ? 'Saving...' : 'Save Details'}
            </button>
            <button type="button" className="btn btn-small" onClick={() => setDetailsExpanded(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {showDropdown && (
        <div className="autocomplete-dropdown">
          {results.map(entity => (
            <button
              key={entity.id}
              type="button"
              className={`autocomplete-option${entity.id === entityId ? ' active' : ''}`}
              onMouseDown={e => { e.preventDefault(); handleSelect(entity); }}
            >
              <div>{getName(entity, mode)}</div>
              {getSubtitle(entity, mode) && (
                <div className="entity-option-subtitle">{getSubtitle(entity, mode)}</div>
              )}
            </button>
          ))}
          {!showAddNew && (
            <button
              type="button"
              className="autocomplete-option entity-add-new"
              onMouseDown={e => { e.preventDefault(); setShowAddNew(true); }}
            >
              + Add New {label}
            </button>
          )}
          {showAddNew && (
            <div className="entity-mini-form" onMouseDown={e => e.preventDefault()}>
              {createError && <div className="entity-mini-form-error">{createError}</div>}
              <input
                className="input-field"
                placeholder={mode === 'venue' ? 'Venue name' : 'Company name'}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
              />
              {mode === 'venue' && (
                <>
                  <input
                    className="input-field"
                    placeholder="Address"
                    value={newAddress}
                    onChange={e => setNewAddress(e.target.value)}
                    style={{ marginTop: 6 }}
                  />
                  <input
                    className="input-field"
                    placeholder="Postcode"
                    value={newPostcode}
                    onChange={e => setNewPostcode(e.target.value)}
                    style={{ marginTop: 6 }}
                  />
                  <input
                    className="input-field"
                    placeholder="Contact name"
                    value={newContact}
                    onChange={e => setNewContact(e.target.value)}
                    style={{ marginTop: 6 }}
                  />
                  <input
                    className="input-field"
                    placeholder="Email"
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    style={{ marginTop: 6 }}
                  />
                  <input
                    className="input-field"
                    placeholder="Phone"
                    type="tel"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    style={{ marginTop: 6 }}
                  />
                </>
              )}
              <div className="entity-mini-form-actions">
                <button type="button" className="btn btn-small btn-green" onClick={handleCreateNew} disabled={creating}>
                  {creating ? 'Saving...' : 'Save'}
                </button>
                <button type="button" className="btn btn-small" onClick={() => { setShowAddNew(false); resetNewFields(); setCreateError(''); }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
