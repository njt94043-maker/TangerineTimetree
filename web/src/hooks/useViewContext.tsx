import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';

type View =
  | 'dashboard' | 'calendar' | 'list' | 'day-detail' | 'gig-form' | 'away'
  | 'profile' | 'media' | 'enquiries' | 'website'
  | 'invoices' | 'invoice-form' | 'invoice-detail' | 'invoice-preview'
  | 'quotes' | 'quote-form' | 'quote-detail' | 'quote-preview'
  | 'settings' | 'clients'
  | 'venues' | 'venue-detail'
  | 'songs' | 'song-form'
  | 'setlists' | 'setlist-detail'
  | 'library' | 'player'
  | 'booking-wizard'
  | 'xr18-camera';

/* ── History entry: view name + relevant state snapshot ── */
interface HistoryEntry {
  view: View;
  selectedDate?: string;
  editGigId?: string | null;
  initialGigType?: 'gig' | 'practice';
  invoiceId?: string | null;
  editInvoiceId?: string | null;
  quoteId?: string | null;
  editQuoteId?: string | null;
  venueId?: string | null;
  editSongId?: string | null;
  setlistId?: string | null;
  playerSongId?: string | null;
  playerSetlistId?: string | null;
  playerMode?: 'live' | 'practice' | 'view';
}

interface ViewState {
  view: View;
  selectedDate: string;
  editGigId: string | null;
  initialGigType: 'gig' | 'practice';
  invoiceId: string | null;
  editInvoiceId: string | null;
  quoteId: string | null;
  editQuoteId: string | null;
  venueId: string | null;
  editSongId: string | null;
  setlistId: string | null;
  playerSongId: string | null;
  playerSetlistId: string | null;
  playerMode: 'live' | 'practice' | 'view';
}

interface ViewContextValue extends ViewState {
  setView: (view: View) => void;
  goToDay: (date: string) => void;
  goToAddGig: (date: string, type?: 'gig' | 'practice') => void;
  goToEditGig: (gigId: string) => void;
  goToAddGigFromList: (date: string, type: 'gig' | 'practice') => void;
  goToEditGigFromList: (gigId: string, date: string) => void;
  goBack: () => void;
  // Navigation
  goToDashboard: () => void;
  goToInvoices: () => void;
  goToNewInvoice: () => void;
  goToEditInvoice: (id: string) => void;
  goToInvoiceDetail: (id: string) => void;
  goToInvoicePreview: (id: string) => void;
  goToSettings: () => void;
  goToClients: () => void;
  // Quote navigation
  goToQuotes: () => void;
  goToNewQuote: () => void;
  goToEditQuote: (id: string) => void;
  goToQuoteDetail: (id: string) => void;
  goToQuotePreview: (id: string) => void;
  // Venue navigation
  goToVenues: () => void;
  goToVenueDetail: (id: string) => void;
  // Song navigation
  goToSongs: () => void;
  goToNewSong: () => void;
  goToEditSong: (id: string) => void;
  // Setlist navigation
  goToSetlists: () => void;
  goToSetlistDetail: (id: string) => void;
  // Library + Player navigation
  goToLibrary: () => void;
  goToPlayer: (songId: string, mode: 'live' | 'practice' | 'view', setlistId?: string) => void;
  // XR18 Camera companion
  goToXR18Camera: () => void;
  // Booking wizard / Gig Hub navigation
  goToBookingWizard: (date: string) => void;
  goToEditBooking: (gigId: string) => void;
  // Post-save replace navigation (swaps current stack entry)
  goToAway: (date?: string) => void;
  replaceWithInvoiceDetail: (id: string) => void;
  replaceWithQuoteDetail: (id: string) => void;
  replaceWithNewQuote: () => void;
  replaceWithNewInvoice: () => void;
}

const ViewContext = createContext<ViewContextValue | null>(null);

/* ── Dedup key: view + primary identifier for that view ── */
function entryKey(e: HistoryEntry): string {
  switch (e.view) {
    case 'day-detail': return `day-detail:${e.selectedDate ?? ''}`;
    case 'gig-form': return `gig-form:${e.editGigId ?? 'new'}:${e.selectedDate ?? ''}`;
    case 'booking-wizard': return `booking-wizard:${e.editGigId ?? 'new'}:${e.selectedDate ?? ''}`;
    case 'invoice-detail': return `invoice-detail:${e.invoiceId ?? ''}`;
    case 'invoice-form': return `invoice-form:${e.editInvoiceId ?? 'new'}`;
    case 'invoice-preview': return `invoice-preview:${e.invoiceId ?? ''}`;
    case 'quote-detail': return `quote-detail:${e.quoteId ?? ''}`;
    case 'quote-form': return `quote-form:${e.editQuoteId ?? 'new'}`;
    case 'quote-preview': return `quote-preview:${e.quoteId ?? ''}`;
    case 'venue-detail': return `venue-detail:${e.venueId ?? ''}`;
    case 'song-form': return `song-form:${e.editSongId ?? 'new'}`;
    case 'setlist-detail': return `setlist-detail:${e.setlistId ?? ''}`;
    case 'player': return `player:${e.playerSongId ?? ''}:${e.playerMode ?? 'live'}`;
    default: return e.view;
  }
}

export function ViewProvider({ children }: { children: ReactNode }) {
  const [view, setViewRaw] = useState<View>('calendar');
  const [selectedDate, setSelectedDate] = useState('');
  const [editGigId, setEditGigId] = useState<string | null>(null);
  const [initialGigType, setInitialGigType] = useState<'gig' | 'practice'>('gig');
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [editQuoteId, setEditQuoteId] = useState<string | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [editSongId, setEditSongId] = useState<string | null>(null);
  const [setlistId, setSetlistId] = useState<string | null>(null);
  const [playerSongId, setPlayerSongId] = useState<string | null>(null);
  const [playerSetlistId, setPlayerSetlistId] = useState<string | null>(null);
  const [playerMode, setPlayerMode] = useState<'live' | 'practice' | 'view'>('live');

  // View history stack — each entry stores the view + its state snapshot
  const historyRef = useRef<HistoryEntry[]>([{ view: 'calendar' }]);
  // Flag to suppress pushState when handling popstate (browser back button)
  const handlingPopState = useRef(false);

  /* ── Restore state from a history entry ── */
  function restoreEntry(entry: HistoryEntry) {
    if (entry.selectedDate !== undefined) setSelectedDate(entry.selectedDate);
    if (entry.editGigId !== undefined) setEditGigId(entry.editGigId);
    if (entry.initialGigType !== undefined) setInitialGigType(entry.initialGigType);
    if (entry.invoiceId !== undefined) setInvoiceId(entry.invoiceId);
    if (entry.editInvoiceId !== undefined) setEditInvoiceId(entry.editInvoiceId);
    if (entry.quoteId !== undefined) setQuoteId(entry.quoteId);
    if (entry.editQuoteId !== undefined) setEditQuoteId(entry.editQuoteId);
    if (entry.venueId !== undefined) setVenueId(entry.venueId);
    if (entry.editSongId !== undefined) setEditSongId(entry.editSongId);
    if (entry.setlistId !== undefined) setSetlistId(entry.setlistId);
    if (entry.playerSongId !== undefined) setPlayerSongId(entry.playerSongId);
    if (entry.playerSetlistId !== undefined) setPlayerSetlistId(entry.playerSetlistId);
    if (entry.playerMode !== undefined) setPlayerMode(entry.playerMode);
  }

  /* ── Push a new entry onto the history stack ── */
  function pushEntry(entry: HistoryEntry) {
    const stack = historyRef.current;
    const top = stack[stack.length - 1];
    // Prevent duplicate consecutive entries (e.g. rapid double-tap)
    if (!top || entryKey(top) !== entryKey(entry)) {
      historyRef.current = [...stack, entry];
    }
    // Apply state + view
    restoreEntry(entry);
    setViewRaw(entry.view);
    // Push browser history entry so hardware/OS back button navigates within the app
    if (!handlingPopState.current) {
      window.history.pushState({ depth: historyRef.current.length }, '');
    }
  }

  /* ── Replace the current top of stack (post-save transitions) ── */
  function replaceEntry(entry: HistoryEntry) {
    const stack = historyRef.current;
    historyRef.current = stack.length > 0 ? [...stack.slice(0, -1), entry] : [entry];
    restoreEntry(entry);
    setViewRaw(entry.view);
    if (!handlingPopState.current) {
      window.history.replaceState({ depth: historyRef.current.length }, '');
    }
  }

  /* ── Top-level navigation — resets the history stack ── */
  function resetToView(v: View) {
    historyRef.current = [{ view: v }];
    setViewRaw(v);
    if (!handlingPopState.current) {
      window.history.pushState({ view: v, depth: 1 }, '');
    }
  }

  const setView = useCallback((v: View) => resetToView(v), []);

  /* ── Go back one step, restoring previous state ── */
  const goBack = useCallback(() => {
    const stack = historyRef.current;
    if (stack.length <= 1) {
      historyRef.current = [{ view: 'calendar' }];
      setViewRaw('calendar');
      return;
    }
    const newStack = stack.slice(0, -1);
    historyRef.current = newStack;
    const prev = newStack[newStack.length - 1];
    restoreEntry(prev);
    setViewRaw(prev.view);
    // Keep browser history in sync
    if (!handlingPopState.current) {
      handlingPopState.current = true;
      window.history.back();
      setTimeout(() => { handlingPopState.current = false; }, 100);
    }
  }, []);

  /* ═══ Navigation functions ═══ */

  // Calendar / Day Detail
  const goToDay = useCallback((date: string) => {
    setSelectedDate(date);
    pushEntry({ view: 'day-detail', selectedDate: date });
  }, []);

  // Gig Form
  const goToAddGig = useCallback((date: string, type: 'gig' | 'practice' = 'gig') => {
    setSelectedDate(date);
    setEditGigId(null);
    setInitialGigType(type);
    pushEntry({ view: 'gig-form', selectedDate: date, editGigId: null, initialGigType: type });
  }, []);

  const goToEditGig = useCallback((gigId: string) => {
    setEditGigId(gigId);
    pushEntry({ view: 'gig-form', editGigId: gigId });
  }, []);

  const goToAddGigFromList = useCallback((date: string, type: 'gig' | 'practice') => {
    setSelectedDate(date);
    setEditGigId(null);
    setInitialGigType(type);
    pushEntry({ view: 'gig-form', selectedDate: date, editGigId: null, initialGigType: type });
  }, []);

  const goToEditGigFromList = useCallback((gigId: string, date: string) => {
    setSelectedDate(date);
    setEditGigId(gigId);
    pushEntry({ view: 'gig-form', editGigId: gigId, selectedDate: date });
  }, []);

  // Top-level drawer navigation — resets stack
  const goToDashboard = useCallback(() => resetToView('dashboard'), []);
  const goToInvoices = useCallback(() => resetToView('invoices'), []);
  const goToSettings = useCallback(() => resetToView('settings'), []);
  const goToClients = useCallback(() => resetToView('clients'), []);
  const goToVenues = useCallback(() => resetToView('venues'), []);
  const goToQuotes = useCallback(() => resetToView('quotes'), []);
  const goToSongs = useCallback(() => resetToView('songs'), []);
  const goToSetlists = useCallback(() => resetToView('setlists'), []);
  const goToLibrary = useCallback(() => resetToView('library'), []);
  const goToXR18Camera = useCallback(() => resetToView('xr18-camera'), []);

  // Invoice drill-down
  const goToNewInvoice = useCallback(() => {
    setEditInvoiceId(null);
    pushEntry({ view: 'invoice-form', editInvoiceId: null });
  }, []);
  const goToEditInvoice = useCallback((id: string) => {
    setEditInvoiceId(id);
    pushEntry({ view: 'invoice-form', editInvoiceId: id });
  }, []);
  const goToInvoiceDetail = useCallback((id: string) => {
    setInvoiceId(id);
    pushEntry({ view: 'invoice-detail', invoiceId: id });
  }, []);
  const goToInvoicePreview = useCallback((id: string) => {
    setInvoiceId(id);
    pushEntry({ view: 'invoice-preview', invoiceId: id });
  }, []);

  // Quote drill-down
  const goToNewQuote = useCallback(() => {
    setEditQuoteId(null);
    pushEntry({ view: 'quote-form', editQuoteId: null });
  }, []);
  const goToEditQuote = useCallback((id: string) => {
    setEditQuoteId(id);
    pushEntry({ view: 'quote-form', editQuoteId: id });
  }, []);
  const goToQuoteDetail = useCallback((id: string) => {
    setQuoteId(id);
    pushEntry({ view: 'quote-detail', quoteId: id });
  }, []);
  const goToQuotePreview = useCallback((id: string) => {
    setQuoteId(id);
    pushEntry({ view: 'quote-preview', quoteId: id });
  }, []);

  // Venue drill-down
  const goToVenueDetail = useCallback((id: string) => {
    setVenueId(id);
    pushEntry({ view: 'venue-detail', venueId: id });
  }, []);

  // Song drill-down
  const goToNewSong = useCallback(() => {
    setEditSongId(null);
    pushEntry({ view: 'song-form', editSongId: null });
  }, []);
  const goToEditSong = useCallback((id: string) => {
    setEditSongId(id);
    pushEntry({ view: 'song-form', editSongId: id });
  }, []);

  // Setlist drill-down
  const goToSetlistDetail = useCallback((id: string) => {
    setSetlistId(id);
    pushEntry({ view: 'setlist-detail', setlistId: id });
  }, []);

  // Player drill-down (from library)
  const goToPlayer = useCallback((songId: string, mode: 'live' | 'practice' | 'view', slId?: string) => {
    setPlayerSongId(songId);
    setPlayerMode(mode);
    setPlayerSetlistId(slId ?? null);
    pushEntry({ view: 'player', playerSongId: songId, playerMode: mode, playerSetlistId: slId ?? null });
  }, []);

  // Booking wizard / Gig Hub
  const goToBookingWizard = useCallback((date: string) => {
    setSelectedDate(date);
    setEditGigId(null);
    pushEntry({ view: 'booking-wizard', selectedDate: date, editGigId: null });
  }, []);
  const goToEditBooking = useCallback((gigId: string) => {
    setEditGigId(gigId);
    pushEntry({ view: 'booking-wizard', editGigId: gigId });
  }, []);
  // Away (push-based, preserves day-detail in stack)
  const goToAway = useCallback((date?: string) => {
    if (date) setSelectedDate(date);
    pushEntry({ view: 'away', selectedDate: date });
  }, []);

  /* ── Post-save replace helpers (swap current entry, no extra back step) ── */
  const replaceWithInvoiceDetail = useCallback((id: string) => {
    setInvoiceId(id);
    replaceEntry({ view: 'invoice-detail', invoiceId: id });
  }, []);
  const replaceWithQuoteDetail = useCallback((id: string) => {
    setQuoteId(id);
    replaceEntry({ view: 'quote-detail', quoteId: id });
  }, []);
  const replaceWithNewQuote = useCallback(() => {
    setEditQuoteId(null);
    replaceEntry({ view: 'quote-form', editQuoteId: null });
  }, []);
  const replaceWithNewInvoice = useCallback(() => {
    setEditInvoiceId(null);
    replaceEntry({ view: 'invoice-form', editInvoiceId: null });
  }, []);

  // Listen for browser back button / hardware back (Android & iOS PWA)
  useEffect(() => {
    // Seed initial browser history state
    window.history.replaceState({ view: 'calendar', depth: 1 }, '');

    function onPopState(_e: PopStateEvent) {
      // If goBack() already handled the stack pop, skip to avoid double-pop
      if (handlingPopState.current) return;
      handlingPopState.current = true;
      const stack = historyRef.current;
      if (stack.length <= 1) {
        // At root — push a dummy entry so the next back doesn't close the app
        historyRef.current = [{ view: 'calendar' }];
        setViewRaw('calendar');
        window.history.pushState({ view: 'calendar', depth: 1 }, '');
      } else {
        // Pop current view, restore previous
        const newStack = stack.slice(0, -1);
        historyRef.current = newStack;
        const prev = newStack[newStack.length - 1];
        restoreEntry(prev);
        setViewRaw(prev.view);
      }
      handlingPopState.current = false;
    }

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return (
    <ViewContext.Provider
      value={{
        view, selectedDate, editGigId, initialGigType,
        invoiceId, editInvoiceId,
        quoteId, editQuoteId,
        venueId,
        editSongId,
        setlistId,
        playerSongId,
        playerSetlistId,
        playerMode,
        setView, goToDay, goToAddGig, goToEditGig,
        goToAddGigFromList, goToEditGigFromList, goBack,
        goToDashboard, goToInvoices, goToNewInvoice, goToEditInvoice,
        goToInvoiceDetail, goToInvoicePreview,
        goToSettings, goToClients,
        goToQuotes, goToNewQuote, goToEditQuote, goToQuoteDetail, goToQuotePreview,
        goToVenues, goToVenueDetail,
        goToSongs, goToNewSong, goToEditSong,
        goToSetlists, goToSetlistDetail,
        goToLibrary, goToPlayer, goToXR18Camera,
        goToBookingWizard, goToEditBooking,
        goToAway,
        replaceWithInvoiceDetail, replaceWithQuoteDetail,
        replaceWithNewQuote, replaceWithNewInvoice,
      }}
    >
      {children}
    </ViewContext.Provider>
  );
}

export function useView() {
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error('useView must be used within ViewProvider');
  return ctx;
}
