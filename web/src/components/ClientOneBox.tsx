import { useState, useRef, useEffect } from 'react';
import type { Client } from '@shared/supabase/types';

// One-box client entry (the s244-LOCKED pattern, first shipped in s260's
// Imports UI, reusable by the booking flow later): free-text name that
// typeahead-matches existing clients. Picking a match links the client_id;
// leaving free text keeps client_id null (a name-only client is auto-created
// at commit time by the caller).
export interface ClientOneBoxValue {
  client_id: string | null;
  client_name: string;
}

interface ClientOneBoxProps {
  value: ClientOneBoxValue;
  onChange: (value: ClientOneBoxValue) => void;
  clients: Client[];
  placeholder?: string;
}

export function ClientOneBox({ value, onChange, clients, placeholder }: ClientOneBoxProps) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  const q = value.client_name.trim().toLowerCase();
  const matches = q
    ? clients.filter(c =>
        c.company_name.toLowerCase().includes(q) ||
        (c.contact_name ?? '').toLowerCase().includes(q),
      ).slice(0, 6)
    : [];

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function pick(c: Client) {
    onChange({ client_id: c.id, client_name: c.company_name });
    setOpen(false);
    setActiveIdx(-1);
  }

  function handleType(text: string) {
    // Typing breaks any existing link — free text leaves client_id null.
    onChange({ client_id: null, client_name: text });
    setOpen(true);
    setActiveIdx(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || matches.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); pick(matches[activeIdx]); }
    else if (e.key === 'Escape') { setOpen(false); }
  }

  return (
    <div ref={wrapRef} className="autocomplete-wrap">
      <div className="entity-input-row">
        <input
          className="input-field client-onebox-input"
          value={value.client_name}
          onChange={e => handleType(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? 'Client (leave blank for none)'}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && matches.length > 0}
        />
        {value.client_id && <span className="entity-linked-badge">Linked</span>}
      </div>
      {open && matches.length > 0 && (
        <div className="autocomplete-dropdown" role="listbox">
          {matches.map((c, i) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={i === activeIdx}
              className={`autocomplete-option${i === activeIdx ? ' active' : ''}`}
              onMouseDown={e => { e.preventDefault(); pick(c); }}
            >
              <div>{c.company_name}</div>
              {c.contact_name && <div className="entity-option-subtitle">{c.contact_name}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
