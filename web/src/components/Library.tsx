import { useState, useEffect, useMemo } from 'react';
import { getSetlistEntries } from '@shared/supabase/queries';
import {
  type SetlistEntry,
  type SetlistListId,
  SETLIST_LIST_ORDER,
  SETLIST_LIST_LABELS,
} from '@shared/supabase/types';
import { ErrorAlert } from './ErrorAlert';

export function Library() {
  const [entries, setEntries] = useState<SetlistEntry[]>([]);
  const [activeList, setActiveList] = useState<SetlistListId>('staples');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional load-trigger
    setLoading(true);
    getSetlistEntries()
      .then(rows => { if (!cancelled) setEntries(rows); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load setlist'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<SetlistListId, SetlistEntry[]>();
    for (const id of SETLIST_LIST_ORDER) map.set(id, []);
    for (const e of entries) {
      const bucket = map.get(e.list_id);
      if (bucket) bucket.push(e);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [entries]);

  const visibleEntries = grouped.get(activeList) ?? [];

  return (
    <div className="form-wrap form-top">
      {error && <ErrorAlert message={error} compact />}

      {/* Mobile-friendly 3-list segmented switch — large text, easy thumb hits */}
      <div className="setlist-list-tabs">
        {SETLIST_LIST_ORDER.map(id => {
          const count = grouped.get(id)?.length ?? 0;
          return (
            <button
              key={id}
              className={`setlist-list-tab ${activeList === id ? 'active' : ''}`}
              onClick={() => setActiveList(id)}
            >
              <span className="setlist-list-tab-label">{SETLIST_LIST_LABELS[id]}</span>
              <span className="setlist-list-tab-count">{count}</span>
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="setlist-entries-list">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="setlist-entry-row neu-card skeleton-card" />
          ))}
        </div>
      )}

      {!loading && (
        <div className="setlist-entries-list">
          {visibleEntries.length === 0 && (
            <p className="empty-text">No songs in {SETLIST_LIST_LABELS[activeList]} yet</p>
          )}
          {visibleEntries.map(entry => (
            <div key={entry.id} className="setlist-entry-row neu-card">
              <span className="setlist-entry-pos">{entry.position}</span>
              <div className="setlist-entry-info">
                <span className="setlist-entry-title">{entry.title}</span>
                {entry.artist && <span className="setlist-entry-artist">{entry.artist}</span>}
              </div>
              <div className="setlist-entry-meta">
                {entry.bpm != null && (
                  <span className="setlist-entry-bpm">
                    {entry.bpm}
                    <span className="setlist-entry-bpm-unit">BPM</span>
                  </span>
                )}
                {entry.click_y_n && <span className="setlist-entry-tag">CLICK</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && (
        <p className="setlist-list-hint">
          Authoring lives in Tangerine Studio. Web is read-only for now — proposer flow coming soon.
        </p>
      )}
    </div>
  );
}
