// Library — TGT Web's setlist authoring surface (S125 → S127 direct-edit).
//
// Per `proj-tgt--s118-ecosystem-pivot.md` + `setlist-authoring--build-brief.md`:
// All 3 surfaces (this + MS PWA + APK) edit `setlist_entries` directly via
// Supabase. LWW resolves conflicts; the changelog is the editorial-control
// mechanism. During gig-lock, edits queue to `setlist_pending_edits` and
// auto-apply on gig-end (banner shows soft warning, edits remain available).
//
// Web doesn't host its own copy of the practice audio (MS does), so the
// `practice_audio_ref` field is a plain text display here — picking a track
// happens on MS PWA which can hit /api/library/search on-origin.

import { useState, useEffect, useMemo, useCallback } from 'react';
import * as setlistApi from '@shared/supabase/queries';
import {
  type SetlistEntry,
  type SetlistListId,
  type SetlistChangelogEntry,
  type SetlistPendingEdit,
  type GigLockState,
  SETLIST_LIST_ORDER,
  SETLIST_LIST_LABELS,
} from '@shared/supabase/types';
import { supabase } from '../supabase/client';
import { useAuth } from '../hooks/useAuth';
import { ErrorAlert } from './ErrorAlert';

const SURFACE = 'web' as const;

type DrawerTab = 'library' | 'queued' | 'changelog';

interface AddEntryDraft {
  title: string;
  artist: string;
  bpm: string;
  click: boolean;
}

const EMPTY_DRAFT: AddEntryDraft = { title: '', artist: '', bpm: '', click: false };

/** Responsive breakpoints — same as MS PWA. ≥1100px = 2-col with permanent
 *  drawer; <1100px = single column with slide-out drawer; ≤600px collapses
 *  per-row actions to ⋯ and shows song detail full-screen. */
function useViewport(): { narrow: boolean; phone: boolean } {
  const get = () => ({
    narrow: typeof window !== 'undefined' && window.matchMedia('(max-width: 1099px)').matches,
    phone: typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches,
  });
  const [v, setV] = useState(get);
  useEffect(() => {
    const m1 = window.matchMedia('(max-width: 1099px)');
    const m2 = window.matchMedia('(max-width: 600px)');
    const update = () => setV(get());
    m1.addEventListener('change', update);
    m2.addEventListener('change', update);
    return () => {
      m1.removeEventListener('change', update);
      m2.removeEventListener('change', update);
    };
  }, []);
  return v;
}

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function Library() {
  const { user, profile } = useAuth();
  const viewport = useViewport();

  const actor = useMemo(() => ({
    id: user?.id ?? '00000000-0000-0000-0000-000000000000',
    name: profile?.name || user?.email?.split('@')[0] || 'Web user',
  }), [user?.id, user?.email, profile?.name]);

  const [entries, setEntries] = useState<SetlistEntry[]>([]);
  const [lockState, setLockState] = useState<GigLockState | null>(null);
  const [changelog, setChangelog] = useState<SetlistChangelogEntry[]>([]);
  const [pending, setPending] = useState<SetlistPendingEdit[]>([]);
  const [activeList, setActiveList] = useState<SetlistListId>('staples');
  const [activeDrawer, setActiveDrawer] = useState<DrawerTab>('library');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionSheetId, setActionSheetId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AddEntryDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'live' | 'offline'>('connecting');

  // ── Initial load + Realtime subscriptions ──────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        const [allEntries, lock, log, pend] = await Promise.all([
          setlistApi.getSetlistEntries(),
          setlistApi.getGigLockState(),
          setlistApi.getSetlistChangelog(50),
          setlistApi.getPendingEdits(),
        ]);
        if (cancelled) return;
        setEntries(allEntries);
        setLockState(lock);
        setChangelog(log);
        setPending(pend);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load setlists');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAll();

    const channel = supabase
      .channel('setlist-authoring-web')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'setlist_entries' }, () => {
        setlistApi.getSetlistEntries().then(setEntries).catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gig_lock_state' }, () => {
        setlistApi.getGigLockState().then(setLockState).catch(() => {});
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'setlist_changelog' }, () => {
        setlistApi.getSetlistChangelog(50).then(setChangelog).catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'setlist_pending_edits' }, () => {
        setlistApi.getPendingEdits().then(setPending).catch(() => {});
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setRealtimeStatus('offline');
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // ── Derived state ──────────────────────────────────────────────────────
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

  const activeEntries = grouped.get(activeList) ?? [];
  const isLocked = lockState?.is_locked ?? false;
  const unappliedPending = useMemo(() => pending.filter(p => !p.applied_at), [pending]);

  // ── Edit operations (route through pending queue when locked) ──────────

  const wrapWrite = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setSaving(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      return null;
    } finally {
      setSaving(false);
    }
  }, []);

  const handleAddEntry = async () => {
    if (!draft.title.trim()) return;
    const tail = activeEntries.length;
    const input = {
      list_id: activeList,
      position: tail + 1,
      title: draft.title.trim(),
      artist: draft.artist.trim() || null,
      bpm: draft.bpm ? Number(draft.bpm) : null,
      click_y_n: draft.click,
    };
    if (isLocked) {
      await wrapWrite(() => setlistApi.queuePendingEdit({
        list_id: activeList,
        entry_id: null,
        action: 'created',
        payload: input,
      }, actor, SURFACE));
    } else {
      await wrapWrite(() => setlistApi.createSetlistEntry(input, actor, SURFACE));
    }
    setDraft(EMPTY_DRAFT);
  };

  const handleUpdateEntry = async (id: string, patch: Partial<SetlistEntry>, prev?: Partial<SetlistEntry>) => {
    if (isLocked) {
      await wrapWrite(() => setlistApi.queuePendingEdit({
        list_id: activeList,
        entry_id: id,
        action: 'updated',
        payload: patch,
      }, actor, SURFACE));
    } else {
      await wrapWrite(() => setlistApi.updateSetlistEntry(id, patch, actor, SURFACE, prev));
    }
  };

  const handleDeleteEntry = async (entry: SetlistEntry) => {
    if (!confirm(`Remove "${entry.title}" from ${SETLIST_LIST_LABELS[entry.list_id]}?`)) return;
    if (isLocked) {
      await wrapWrite(() => setlistApi.queuePendingEdit({
        list_id: entry.list_id,
        entry_id: entry.id,
        action: 'deleted',
        payload: { id: entry.id, title: entry.title },
      }, actor, SURFACE));
    } else {
      await wrapWrite(() => setlistApi.deleteSetlistEntry(entry.id, actor, SURFACE, { list_id: entry.list_id, title: entry.title }));
    }
  };

  const handleMoveEntry = async (entry: SetlistEntry, toList: SetlistListId) => {
    if (toList === entry.list_id) return;
    if (isLocked) {
      await wrapWrite(() => setlistApi.queuePendingEdit({
        list_id: toList,
        entry_id: entry.id,
        action: 'moved',
        payload: { id: entry.id, from: entry.list_id, to: toList },
      }, actor, SURFACE));
    } else {
      await wrapWrite(() => setlistApi.moveSetlistEntry(entry.id, toList, actor, SURFACE, { list_id: entry.list_id, title: entry.title }));
    }
  };

  const handleReorder = async (id: string, direction: -1 | 1) => {
    const idx = activeEntries.findIndex(e => e.id === id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= activeEntries.length) return;
    const reordered = [...activeEntries];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(newIdx, 0, moved);
    const orderedIds = reordered.map(e => e.id);
    if (isLocked) {
      await wrapWrite(() => setlistApi.queuePendingEdit({
        list_id: activeList,
        entry_id: id,
        action: 'reordered',
        payload: { orderedIds },
      }, actor, SURFACE));
    } else {
      await wrapWrite(() => setlistApi.reorderSetlistEntries(activeList, orderedIds, actor, SURFACE));
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="setlists-view">
      {error && <ErrorAlert message={error} compact />}

      <header className="setlists-heading">
        <div className="setlists-title-block">
          <h2 className="setlists-title">Setlists</h2>
          <div className="setlists-subtitle">
            3-list master order · gig-time is browse-and-skip only
          </div>
        </div>
        <div className="setlists-tabs">
          {SETLIST_LIST_ORDER.map(id => {
            const count = grouped.get(id)?.length ?? 0;
            return (
              <button
                key={id}
                className={`setlists-tab ${activeList === id ? 'active' : ''}`}
                onClick={() => { setActiveList(id); setExpandedId(null); }}
              >
                {SETLIST_LIST_LABELS[id]}
                <span className="setlists-tab-count">{count}</span>
              </button>
            );
          })}
        </div>
      </header>

      <SyncBanner
        realtimeStatus={realtimeStatus}
        lockState={lockState}
        changelog={changelog}
        actorName={actor.name}
      />

      {loading && (
        <div className="setlist-entries-list">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="setlist-entry-row neu-card skeleton-card" />
          ))}
        </div>
      )}

      {!loading && (
        <div className={`setlists-body ${viewport.narrow ? 'narrow' : ''}`}>
          <SongsCard
            listId={activeList}
            entries={activeEntries}
            expandedId={expandedId}
            isLocked={isLocked}
            saving={saving}
            phone={viewport.phone}
            onExpandToggle={(id) => setExpandedId(prev => prev === id ? null : id)}
            onUpdate={handleUpdateEntry}
            onDelete={handleDeleteEntry}
            onMove={handleMoveEntry}
            onReorder={handleReorder}
            onActionSheet={(id) => setActionSheetId(id)}
            onOpenDrawer={() => setDrawerOpen(true)}
            showDrawerToggle={viewport.narrow}
            pendingCount={unappliedPending.length}
          />
          {viewport.narrow ? (
            drawerOpen && (
              <>
                <div className="setlists-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
                <div className="setlists-drawer-overlay">
                  <button
                    className="setlists-drawer-close"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close drawer"
                  >×</button>
                  <DrawerCard
                    activeTab={activeDrawer}
                    onTabChange={setActiveDrawer}
                    activeList={activeList}
                    allEntries={entries}
                    pending={unappliedPending}
                    changelog={changelog}
                    isLocked={isLocked}
                    saving={saving}
                    draft={draft}
                    onDraftChange={setDraft}
                    onAddEntry={() => { handleAddEntry(); setDrawerOpen(false); }}
                    onMoveToActive={(entry) => { handleMoveEntry(entry, activeList); setDrawerOpen(false); }}
                  />
                </div>
              </>
            )
          ) : (
            <DrawerCard
              activeTab={activeDrawer}
              onTabChange={setActiveDrawer}
              activeList={activeList}
              allEntries={entries}
              pending={unappliedPending}
              changelog={changelog}
              isLocked={isLocked}
              saving={saving}
              draft={draft}
              onDraftChange={setDraft}
              onAddEntry={handleAddEntry}
              onMoveToActive={(entry) => handleMoveEntry(entry, activeList)}
            />
          )}
        </div>
      )}

      {actionSheetId && (() => {
        const target = activeEntries.find(e => e.id === actionSheetId);
        if (!target) return null;
        const idx = activeEntries.findIndex(e => e.id === actionSheetId);
        return (
          <ActionSheet
            entry={target}
            isFirst={idx === 0}
            isLast={idx === activeEntries.length - 1}
            onMoveUp={() => { handleReorder(target.id, -1); setActionSheetId(null); }}
            onMoveDown={() => { handleReorder(target.id, 1); setActionSheetId(null); }}
            onMoveToList={(to) => { handleMoveEntry(target, to); setActionSheetId(null); }}
            onDelete={() => { handleDeleteEntry(target); setActionSheetId(null); }}
            onClose={() => setActionSheetId(null)}
          />
        );
      })()}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// ActionSheet (phone ⋯ menu)
// ───────────────────────────────────────────────────────────────────────────

function ActionSheet({
  entry, isFirst, isLast,
  onMoveUp, onMoveDown, onMoveToList, onDelete, onClose,
}: {
  entry: SetlistEntry;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveToList: (to: SetlistListId) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const otherLists = SETLIST_LIST_ORDER.filter(l => l !== entry.list_id);
  return (
    <>
      <div className="setlists-sheet-backdrop" onClick={onClose} />
      <div className="setlists-action-sheet">
        <div className="setlists-action-sheet-title">{entry.title}</div>
        {!showMoveMenu ? (
          <>
            <button onClick={onMoveUp} disabled={isFirst}>↑ Move up</button>
            <button onClick={onMoveDown} disabled={isLast}>↓ Move down</button>
            <button onClick={() => setShowMoveMenu(true)}>→ Move to list…</button>
            <button className="danger" onClick={onDelete}>× Remove from list</button>
            <button className="cancel" onClick={onClose}>Cancel</button>
          </>
        ) : (
          <>
            {otherLists.map(l => (
              <button key={l} onClick={() => onMoveToList(l)}>
                Move to {SETLIST_LIST_LABELS[l]}
              </button>
            ))}
            <button className="cancel" onClick={() => setShowMoveMenu(false)}>← Back</button>
          </>
        )}
      </div>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Sync banner — soft warning when locked, status when unlocked
// ───────────────────────────────────────────────────────────────────────────

function SyncBanner({
  realtimeStatus, lockState, changelog, actorName,
}: {
  realtimeStatus: 'connecting' | 'live' | 'offline';
  lockState: GigLockState | null;
  changelog: SetlistChangelogEntry[];
  actorName: string;
}) {
  const isLocked = lockState?.is_locked ?? false;
  const lastWrite = changelog[0];
  const lastSummary = lastWrite
    ? `last write ${formatRelativeTime(lastWrite.created_at)} by ${lastWrite.actor_name || 'unknown'} (${lastWrite.surface})`
    : 'no edits yet';

  return (
    <div className={`setlists-sync-banner ${isLocked ? 'gig-lock' : ''} ${realtimeStatus}`}>
      <span className="setlists-sync-icon">●</span>
      {isLocked ? (
        <span>
          <strong className="text-tangerine">Gig in progress</strong>
          {lockState?.gig_label && ` — ${lockState.gig_label}`}
          {' '}· edits queue · {realtimeStatus === 'live' ? 'realtime live' : realtimeStatus}
        </span>
      ) : (
        <span>
          <strong className={realtimeStatus === 'live' ? 'text-green' : 'text-muted'}>
            {realtimeStatus === 'live' ? 'Synced' : realtimeStatus === 'connecting' ? 'Connecting…' : 'Offline'}
          </strong>
          {' '}· {lastSummary}
        </span>
      )}
      <span className="setlists-sync-spacer" />
      <span className="setlists-actor-display" title="Edits attributed to your signed-in account">
        editing as <strong>{actorName}</strong>
      </span>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Songs card (left) + per-row actions
// ───────────────────────────────────────────────────────────────────────────

function SongsCard({
  listId, entries, expandedId, isLocked, saving, phone,
  onExpandToggle, onUpdate, onDelete, onMove, onReorder,
  onActionSheet, onOpenDrawer, showDrawerToggle, pendingCount,
}: {
  listId: SetlistListId;
  entries: SetlistEntry[];
  expandedId: string | null;
  isLocked: boolean;
  saving: boolean;
  phone: boolean;
  onExpandToggle: (id: string) => void;
  onUpdate: (id: string, patch: Partial<SetlistEntry>, prev?: Partial<SetlistEntry>) => void;
  onDelete: (entry: SetlistEntry) => void;
  onMove: (entry: SetlistEntry, toList: SetlistListId) => void;
  onReorder: (id: string, direction: -1 | 1) => void;
  onActionSheet: (id: string) => void;
  onOpenDrawer: () => void;
  showDrawerToggle: boolean;
  pendingCount: number;
}) {
  const clickReady = entries.filter(e => e.click_y_n).length;
  const ledReady = entries.filter(e => e.led_visual).length;

  return (
    <div className="setlists-songs-card">
      <div className="setlists-songs-head">
        <div>
          <div className="setlists-songs-title">
            <span className="text-tangerine">{SETLIST_LIST_LABELS[listId]}</span>
            <span className="setlists-pill-info">staple wins</span>
          </div>
          <div className="setlists-songs-meta">
            <span>{entries.length} songs · master order</span>
            <span><span className="text-green">{clickReady}</span> click ready</span>
            <span><span className="text-info">{ledReady}</span> LED visuals set</span>
            {isLocked && <span className="text-tangerine">edits queue while locked</span>}
            {saving && <span className="text-muted">saving…</span>}
          </div>
        </div>
        {showDrawerToggle && (
          <button
            className="setlists-drawer-toggle"
            onClick={onOpenDrawer}
            title="Open Library / Queued / Changelog drawer"
          >
            <span>☰</span>
            <span>More</span>
            {pendingCount > 0 && <span className="setlists-drawer-toggle-badge">{pendingCount}</span>}
          </button>
        )}
      </div>
      <div className="setlists-songs-list">
        {entries.length === 0 && (
          <div className="setlists-empty-state">
            No songs in {SETLIST_LIST_LABELS[listId]}.<br />
            {showDrawerToggle ? 'Tap "More" to open the Library drawer.' : 'Add one from the Library drawer →'}
          </div>
        )}
        {entries.map((entry, idx) => (
          <SongRow
            key={entry.id}
            entry={entry}
            position={idx + 1}
            isFirst={idx === 0}
            isLast={idx === entries.length - 1}
            expanded={expandedId === entry.id}
            phone={phone}
            onExpandToggle={() => onExpandToggle(entry.id)}
            onUpdate={(patch) => onUpdate(entry.id, patch, entry)}
            onDelete={() => onDelete(entry)}
            onMove={(to) => onMove(entry, to)}
            onMoveUp={() => onReorder(entry.id, -1)}
            onMoveDown={() => onReorder(entry.id, 1)}
            onActionSheet={() => onActionSheet(entry.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SongRow({
  entry, position, isFirst, isLast, expanded, phone,
  onExpandToggle, onUpdate, onDelete, onMove, onMoveUp, onMoveDown, onActionSheet,
}: {
  entry: SetlistEntry;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  expanded: boolean;
  phone: boolean;
  onExpandToggle: () => void;
  onUpdate: (patch: Partial<SetlistEntry>) => void;
  onDelete: () => void;
  onMove: (to: SetlistListId) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onActionSheet: () => void;
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const otherLists = SETLIST_LIST_ORDER.filter(l => l !== entry.list_id);

  return (
    <div className={`setlists-song-row ${expanded ? 'expanded' : ''}`}>
      <div className="setlists-song-row-main" onClick={onExpandToggle}>
        <span className="setlists-song-pos">{position.toString().padStart(2, '0')}</span>
        <div className="setlists-song-body">
          <span className="setlists-song-title">{entry.title}</span>
          <span className="setlists-song-sub">
            {entry.artist && <span className="setlists-song-artist">{entry.artist}</span>}
            {entry.bpm != null && <span className="setlists-song-bpm">{entry.bpm} BPM</span>}
          </span>
        </div>
        <div className="setlists-song-flags">
          <span className={`setlists-flag-pill ${entry.click_y_n ? 'flag-click' : 'flag-missing'}`}>
            {entry.click_y_n ? 'click' : 'no click'}
          </span>
          {entry.led_visual && <span className="setlists-flag-pill flag-led">LED</span>}
        </div>
        <div className="setlists-song-actions" onClick={(e) => e.stopPropagation()}>
          {phone ? (
            <button
              className="setlists-icon-btn setlists-overflow-btn"
              onClick={onActionSheet}
              title="More actions"
            >⋯</button>
          ) : (
            <>
              <button className="setlists-icon-btn" disabled={isFirst} onClick={onMoveUp} title="Move up in list">↑</button>
              <button className="setlists-icon-btn" disabled={isLast} onClick={onMoveDown} title="Move down in list">↓</button>
              <div className="setlists-move-wrap">
                <button
                  className="setlists-icon-btn"
                  onClick={() => setShowMoveMenu(v => !v)}
                  title="Move to another list"
                >→</button>
                {showMoveMenu && (
                  <div className="setlists-move-menu">
                    {otherLists.map(l => (
                      <button key={l} onClick={() => { onMove(l); setShowMoveMenu(false); }}>
                        Move to {SETLIST_LIST_LABELS[l]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="setlists-icon-btn danger" onClick={onDelete} title="Remove from list">×</button>
            </>
          )}
        </div>
      </div>
      {expanded && (
        <SongDetailWrapper fullScreen={phone} onClose={onExpandToggle}>
          <SongDetail entry={entry} onUpdate={onUpdate} />
        </SongDetailWrapper>
      )}
    </div>
  );
}

function SongDetailWrapper({
  fullScreen, onClose, children,
}: {
  fullScreen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!fullScreen) return <>{children}</>;
  return (
    <div className="setlists-detail-fullscreen">
      <div className="setlists-detail-fullscreen-header">
        <button className="setlists-detail-back" onClick={onClose} aria-label="Close detail view">← Back</button>
      </div>
      <div className="setlists-detail-fullscreen-body">
        {children}
      </div>
    </div>
  );
}

function SongDetail({
  entry,
  onUpdate,
}: {
  entry: SetlistEntry;
  onUpdate: (patch: Partial<SetlistEntry>) => void;
}) {
  const initialDraft = useCallback(() => ({
    title: entry.title,
    artist: entry.artist ?? '',
    bpm: entry.bpm?.toString() ?? '',
    beats_per_bar: entry.beats_per_bar?.toString() ?? '4',
    click_y_n: entry.click_y_n,
    led_visual: entry.led_visual ?? '',
    backdrop_url: entry.backdrop_url ?? '',
    notes: entry.notes ?? '',
    chord_text: entry.chord_text ?? '',
    lyric_text: entry.lyric_text ?? '',
    drum_text: entry.drum_text ?? '',
    practice_audio_ref: entry.practice_audio_ref ?? '',
  }), [entry]);

  const [draft, setDraft] = useState(initialDraft);

  // Reset when underlying entry id changes (different song expanded).
  // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional draft reset on row swap
  useEffect(() => { setDraft(initialDraft()); }, [entry.id, initialDraft]);

  const dirty = useMemo(() => {
    return draft.title !== entry.title
      || draft.artist !== (entry.artist ?? '')
      || draft.bpm !== (entry.bpm?.toString() ?? '')
      || draft.beats_per_bar !== (entry.beats_per_bar?.toString() ?? '4')
      || draft.click_y_n !== entry.click_y_n
      || draft.led_visual !== (entry.led_visual ?? '')
      || draft.backdrop_url !== (entry.backdrop_url ?? '')
      || draft.notes !== (entry.notes ?? '')
      || draft.chord_text !== (entry.chord_text ?? '')
      || draft.lyric_text !== (entry.lyric_text ?? '')
      || draft.drum_text !== (entry.drum_text ?? '')
      || draft.practice_audio_ref !== (entry.practice_audio_ref ?? '');
  }, [draft, entry]);

  const handleSave = () => {
    const patch: Partial<SetlistEntry> = {};
    if (draft.title !== entry.title) patch.title = draft.title;
    if (draft.artist !== (entry.artist ?? '')) patch.artist = draft.artist || null;
    const bpmNum = draft.bpm ? Number(draft.bpm) : null;
    if (bpmNum !== entry.bpm) patch.bpm = bpmNum;
    const bpb = draft.beats_per_bar ? Number(draft.beats_per_bar) : 4;
    if (bpb !== entry.beats_per_bar) patch.beats_per_bar = bpb;
    if (draft.click_y_n !== entry.click_y_n) patch.click_y_n = draft.click_y_n;
    if (draft.led_visual !== (entry.led_visual ?? '')) patch.led_visual = draft.led_visual || null;
    if (draft.backdrop_url !== (entry.backdrop_url ?? '')) patch.backdrop_url = draft.backdrop_url || null;
    if (draft.notes !== (entry.notes ?? '')) patch.notes = draft.notes || null;
    if (draft.chord_text !== (entry.chord_text ?? '')) patch.chord_text = draft.chord_text || null;
    if (draft.lyric_text !== (entry.lyric_text ?? '')) patch.lyric_text = draft.lyric_text || null;
    if (draft.drum_text !== (entry.drum_text ?? '')) patch.drum_text = draft.drum_text || null;
    if (draft.practice_audio_ref !== (entry.practice_audio_ref ?? '')) patch.practice_audio_ref = draft.practice_audio_ref || null;
    if (Object.keys(patch).length > 0) onUpdate(patch);
  };

  return (
    <div className="setlists-song-detail" onClick={(e) => e.stopPropagation()}>
      <div className="setlists-detail-grid">
        <div className="setlists-detail-section">
          <div className="setlists-detail-label">Identity</div>
          <FieldInput label="Title" value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} />
          <FieldInput label="Artist" value={draft.artist} onChange={(v) => setDraft({ ...draft, artist: v })} />
          <FieldInput label="BPM" value={draft.bpm} onChange={(v) => setDraft({ ...draft, bpm: v })} mono />
          <FieldInput label="Beats / bar" value={draft.beats_per_bar} onChange={(v) => setDraft({ ...draft, beats_per_bar: v })} mono />
          <label className="setlists-checkbox">
            <input
              type="checkbox"
              checked={draft.click_y_n}
              onChange={(e) => setDraft({ ...draft, click_y_n: e.target.checked })}
            />
            <span>Click track on at gig-time</span>
          </label>
        </div>
        <div className="setlists-detail-section">
          <div className="setlists-detail-label">Stage display</div>
          <FieldInput label="LED visual" value={draft.led_visual} onChange={(v) => setDraft({ ...draft, led_visual: v })} placeholder="visual id / name" />
          <FieldInput label="Backdrop URL" value={draft.backdrop_url} onChange={(v) => setDraft({ ...draft, backdrop_url: v })} placeholder="https://..." />
          <FieldInput label="Notes" value={draft.notes} onChange={(v) => setDraft({ ...draft, notes: v })} placeholder="any per-song stage notes" />
        </div>
        <div className="setlists-detail-section setlists-detail-wide">
          <div className="setlists-detail-label">Practice audio</div>
          <FieldInput
            label="Track ref"
            value={draft.practice_audio_ref}
            onChange={(v) => setDraft({ ...draft, practice_audio_ref: v })}
            placeholder="set on Media Server PWA — track id"
            mono
          />
          <div className="setlists-detail-hint">
            Picking a track from the Media Server library is on the MS PWA.
            Web stores the ref but doesn't browse.
          </div>
        </div>
        <div className="setlists-detail-section setlists-detail-wide">
          <div className="setlists-detail-label">Lyrics / chords / drum notes</div>
          <FieldTextarea label="Chord chart" value={draft.chord_text} onChange={(v) => setDraft({ ...draft, chord_text: v })} rows={3} />
          <FieldTextarea label="Lyrics" value={draft.lyric_text} onChange={(v) => setDraft({ ...draft, lyric_text: v })} rows={4} />
          <FieldTextarea label="Drum notes" value={draft.drum_text} onChange={(v) => setDraft({ ...draft, drum_text: v })} rows={3} />
        </div>
      </div>
      <div className="setlists-detail-actions">
        <button className="setlists-btn-ghost" onClick={() => setDraft(initialDraft())} disabled={!dirty}>Reset</button>
        <button className="setlists-btn-primary" onClick={handleSave} disabled={!dirty}>Save changes</button>
      </div>
    </div>
  );
}

function FieldInput({
  label, value, onChange, placeholder, mono,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <label className="setlists-field">
      <span className="setlists-field-label">{label}</span>
      <input
        className={`setlists-field-input ${mono ? 'mono' : ''}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function FieldTextarea({
  label, value, onChange, rows = 3,
}: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="setlists-field">
      <span className="setlists-field-label">{label}</span>
      <textarea
        className="setlists-field-input"
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Drawer card — Library / Queued / Changelog
// ───────────────────────────────────────────────────────────────────────────

function DrawerCard({
  activeTab, onTabChange, activeList, allEntries, pending, changelog,
  isLocked, saving, draft, onDraftChange, onAddEntry, onMoveToActive,
}: {
  activeTab: DrawerTab;
  onTabChange: (t: DrawerTab) => void;
  activeList: SetlistListId;
  allEntries: SetlistEntry[];
  pending: SetlistPendingEdit[];
  changelog: SetlistChangelogEntry[];
  isLocked: boolean;
  saving: boolean;
  draft: AddEntryDraft;
  onDraftChange: (d: AddEntryDraft) => void;
  onAddEntry: () => void;
  onMoveToActive: (entry: SetlistEntry) => void;
}) {
  return (
    <div className="setlists-drawer-card">
      <div className="setlists-drawer-tabs">
        <button
          className={`setlists-drawer-tab ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => onTabChange('library')}
        >Library</button>
        <button
          className={`setlists-drawer-tab ${activeTab === 'queued' ? 'active' : ''}`}
          onClick={() => onTabChange('queued')}
        >
          Queued
          {pending.length > 0 && <span className="setlists-drawer-badge">{pending.length}</span>}
        </button>
        <button
          className={`setlists-drawer-tab ${activeTab === 'changelog' ? 'active' : ''}`}
          onClick={() => onTabChange('changelog')}
        >Changelog</button>
      </div>
      <div className="setlists-drawer-body">
        {activeTab === 'library' && (
          <LibraryDrawer
            activeList={activeList}
            allEntries={allEntries}
            saving={saving}
            draft={draft}
            onDraftChange={onDraftChange}
            onAddEntry={onAddEntry}
            onMoveToActive={onMoveToActive}
          />
        )}
        {activeTab === 'queued' && (
          <QueuedDrawer pending={pending} isLocked={isLocked} />
        )}
        {activeTab === 'changelog' && (
          <ChangelogDrawer changelog={changelog} />
        )}
      </div>
    </div>
  );
}

function LibraryDrawer({
  activeList, allEntries, saving, draft, onDraftChange, onAddEntry, onMoveToActive,
}: {
  activeList: SetlistListId;
  allEntries: SetlistEntry[];
  saving: boolean;
  draft: AddEntryDraft;
  onDraftChange: (d: AddEntryDraft) => void;
  onAddEntry: () => void;
  onMoveToActive: (entry: SetlistEntry) => void;
}) {
  const [filter, setFilter] = useState('');
  const others = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return allEntries
      .filter(e => e.list_id !== activeList)
      .filter(e => !q || e.title.toLowerCase().includes(q) || (e.artist ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [allEntries, activeList, filter]);

  const canAdd = draft.title.trim().length > 0;

  return (
    <>
      <div className="setlists-drawer-section">
        <div className="setlists-drawer-section-label">+ Add to {SETLIST_LIST_LABELS[activeList]}</div>
        <div className="setlists-add-form">
          <input
            className="setlists-field-input"
            placeholder="Song title (required)"
            value={draft.title}
            onChange={(e) => onDraftChange({ ...draft, title: e.target.value })}
          />
          <input
            className="setlists-field-input"
            placeholder="Artist"
            value={draft.artist}
            onChange={(e) => onDraftChange({ ...draft, artist: e.target.value })}
          />
          <div className="setlists-add-row">
            <input
              className="setlists-field-input mono setlists-add-bpm"
              placeholder="BPM"
              value={draft.bpm}
              onChange={(e) => onDraftChange({ ...draft, bpm: e.target.value.replace(/[^\d.]/g, '') })}
            />
            <label className="setlists-checkbox">
              <input
                type="checkbox"
                checked={draft.click}
                onChange={(e) => onDraftChange({ ...draft, click: e.target.checked })}
              />
              <span>click</span>
            </label>
            <button
              className="setlists-btn-primary setlists-add-btn"
              onClick={onAddEntry}
              disabled={!canAdd || saving}
            >Add</button>
          </div>
        </div>
      </div>

      <div className="setlists-drawer-section">
        <div className="setlists-drawer-section-label">Move from another list</div>
        <input
          className="setlists-field-input"
          placeholder="Filter title or artist…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {others.length === 0 && (
          <div className="setlists-empty-state-small">
            {filter ? 'No matches in other lists' : 'No songs in other lists'}
          </div>
        )}
        <div className="setlists-lib-list">
          {others.map(entry => (
            <div key={entry.id} className="setlists-lib-row">
              <div className="setlists-lib-row-info">
                <span className="setlists-lib-title">{entry.title}</span>
                <span className="setlists-lib-sub">
                  {entry.artist && <span>{entry.artist}</span>}
                  {entry.bpm != null && <span className="mono">{entry.bpm} BPM</span>}
                  <span className={`setlists-home-pill home-${entry.list_id}`}>
                    {SETLIST_LIST_LABELS[entry.list_id]}
                  </span>
                </span>
              </div>
              <button
                className="setlists-btn-ghost-sm"
                onClick={() => onMoveToActive(entry)}
                disabled={saving}
              >Move here</button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function QueuedDrawer({ pending, isLocked }: { pending: SetlistPendingEdit[]; isLocked: boolean }) {
  if (pending.length === 0) {
    return (
      <div className="setlists-empty-state">
        {isLocked
          ? 'No queued edits yet. Edits made during the gig will queue here and auto-apply when the gig ends.'
          : 'No edits are queued. Edits queue when a gig is in progress.'}
      </div>
    );
  }
  return (
    <>
      <div className="setlists-footnote">
        {isLocked
          ? <>Edits are <strong>queued</strong> while the gig is in progress. They auto-apply on gig-end.</>
          : <>Edits queued during the previous gig that haven't applied yet.</>}
      </div>
      {pending.map(p => (
        <div key={p.id} className="setlists-pending-row">
          <div className="setlists-pending-head">
            <span className="setlists-pending-actor">{p.actor_name || 'unknown'}</span>
            <span className="setlists-pending-action">{p.action} in {SETLIST_LIST_LABELS[p.list_id]}</span>
            <span className="setlists-pending-time">{formatRelativeTime(p.created_at)}</span>
          </div>
          <div className="setlists-pending-payload">
            <code>{JSON.stringify(p.payload, null, 0).slice(0, 240)}</code>
          </div>
          {p.apply_error && (
            <div className="setlists-pending-error">apply error: {p.apply_error}</div>
          )}
        </div>
      ))}
    </>
  );
}

function ChangelogDrawer({ changelog }: { changelog: SetlistChangelogEntry[] }) {
  if (changelog.length === 0) {
    return <div className="setlists-empty-state">No edits yet.</div>;
  }
  return (
    <>
      <div className="setlists-footnote">
        Append-only audit log. Most recent first. Rollback action coming in a future session.
      </div>
      {changelog.map(row => (
        <div key={row.id} className="setlists-log-row">
          <span className="setlists-log-time">{formatRelativeTime(row.created_at)}</span>
          <span className="setlists-log-body">
            <span className="setlists-log-actor">{row.actor_name || 'unknown'}</span>
            {' '}<span className="setlists-log-verb">{row.action}</span>
            {row.field_changed && <> <span className="text-muted">{row.field_changed}</span></>}
            {' '}<span className="text-muted">in {SETLIST_LIST_LABELS[row.list_id]}</span>
            <span className="setlists-log-surface">{row.surface}</span>
            {(row.old_value || row.new_value) && (
              <div className="setlists-log-detail">
                {row.old_value != null && <><span className="text-muted">was</span> <code>{row.old_value}</code></>}
                {row.old_value != null && row.new_value != null && ' → '}
                {row.new_value != null && <><code>{row.new_value}</code></>}
              </div>
            )}
          </span>
        </div>
      ))}
    </>
  );
}
