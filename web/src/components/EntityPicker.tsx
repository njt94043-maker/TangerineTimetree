import { useState, useRef, useEffect, useCallback } from 'react';
import { searchVenues, searchClients, getVenues, getClients, createVenue, createClient } from '@shared/supabase/queries';
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
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const venue = await createVenue({ venue_name: newName.trim(), address: newAddress.trim() });
        onChange(venue.venue_name, venue.id);
      } else {
        const client = await createClient({ company_name: newName.trim() });
        onChange(client.company_name, client.id);
      }
      setShowAddNew(false);
      setOpen(false);
      setNewName('');
      setNewAddress('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : `Failed to create ${label.toLowerCase()}`);
    } finally {
      setCreating(false);
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
                <input
                  className="input-field"
                  placeholder="Address (optional)"
                  value={newAddress}
                  onChange={e => setNewAddress(e.target.value)}
                  style={{ marginTop: 6 }}
                />
              )}
              <div className="entity-mini-form-actions">
                <button type="button" className="btn btn-small btn-green" onClick={handleCreateNew} disabled={creating}>
                  {creating ? 'Saving...' : 'Save'}
                </button>
                <button type="button" className="btn btn-small" onClick={() => { setShowAddNew(false); setNewName(''); setNewAddress(''); setCreateError(''); }}>
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
