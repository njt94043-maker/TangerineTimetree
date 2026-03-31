import { useState, useRef, useEffect, useMemo } from 'react';

interface AutocompleteInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  type?: string;
  step?: string;
  inputMode?: 'text' | 'decimal' | 'numeric';
}

export function AutocompleteInput({
  id,
  value,
  onChange,
  suggestions,
  placeholder,
  type,
  step,
  inputMode,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!value.trim()) {
      return suggestions.slice(0, 8);
    }
    const lower = value.toLowerCase();
    return suggestions.filter(s => s.toLowerCase().includes(lower)).slice(0, 8);
  }, [value, suggestions]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const showDropdown = open && filtered.length > 0 && !(filtered.length === 1 && filtered[0] === value);

  return (
    <div ref={wrapRef} className="autocomplete-wrap">
      <input
        id={id}
        className="input-field"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        type={type}
        step={step}
        inputMode={inputMode}
        autoComplete="off"
      />
      {showDropdown && (
        <div className="autocomplete-dropdown">
          {filtered.map(s => (
            <button
              key={s}
              type="button"
              className={`autocomplete-option${s === value ? ' active' : ''}`}
              onMouseDown={e => { e.preventDefault(); onChange(s); setOpen(false); }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
