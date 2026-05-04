import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';

type View =
  | 'dashboard' | 'calendar' | 'list' | 'day-detail' | 'gig-form' | 'away'
  | 'profile' | 'media' | 'enquiries' | 'website'
  | 'invoices' | 'invoice-form' | 'invoice-detail' | 'invoice-preview'
  | 'quotes' | 'quote-form' | 'quote-detail' | 'quote-preview'
  | 'settings' | 'clients'
  | 'venues' | 'venue-detail'
  | 'library'
  | 'booking-wizard'
  | 'xr18-camera'
  | 'availability';

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
  // Library navigation (3-list setlist view)
  goToLibrary: () => void;
  // XR18 Camera companion
  goToXR18Camera: () => void;
  // Availability
  goToAvailability: () => void;
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
  }

  /* ── Push a new entry onto the history stack ── */
  const pushEntry = useCallback((entry: HistoryEntry) => {
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
  }, []);

  /* ── Replace the current top of stack (post-save transitions) ── */
  const replaceEntry = useCallback((entry: HistoryEntry) => {
    const stack = historyRef.current;
    historyRef.current = stack.length > 0 ? [...stack.slice(0, -1), entry] : [entry];
    restoreEntry(entry);
    setViewRaw(entry.view);
    if (!handlingPopState.current) {
      window.history.replaceState({ depth: historyRef.current.length }, '');
    }
  }, []);

  /* ── Top-level navigation — resets the history stack ── */
  const resetToView = useCallback((v: View) => {
    historyRef.current = [{ view: v }];
    setViewRaw(v);
    if (!handlingPopState.current) {
      window.history.pushState({ view: v, depth: 1 }, '');
    }
  }, []);

  const setView = useCallback((v: View) => resetToView(v), [resetToView]);

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
  }, [pushEntry]);

  // Gig Form
  const goToAddGig = useCallback((date: string, type: 'gig' | 'practice' = 'gig') => {
    setSelectedDate(date);
    setEditGigId(null);
    setInitialGigType(type);
    pushEntry({ view: 'gig-form', selectedDate: date, editGigId: null, initialGigType: type });
  }, [pushEntry]);

  const goToEditGig = useCallback((gigId: string) => {
    setEditGigId(gigId);
    pushEntry({ view: 'gig-form', editGigId: gigId });
  }, [pushEntry]);

  const goToAddGigFromList = useCallback((date: string, type: 'gig' | 'practice') => {
    setSelectedDate(date);
    setEditGigId(null);
    setInitialGigType(type);
    pushEntry({ view: 'gig-form', selectedDate: date, editGigId: null, initialGigType: type });
  }, [pushEntry]);

  const goToEditGigFromList = useCallback((gigId: string, date: string) => {
    setSelectedDate(date);
    setEditGigId(gigId);
    pushEntry({ view: 'gig-form', editGigId: gigId, selectedDate: date });
  }, [pushEntry]);

  // Top-level drawer navigation — resets stack
  const goToDashboard = useCallback(() => resetToView('dashboard'), [resetToView]);
  const goToInvoices = useCallback(() => resetToView('invoices'), [resetToView]);
  const goToSettings = useCallback(() => resetToView('settings'), [resetToView]);
  const goToClients = useCallback(() => resetToView('clients'), [resetToView]);
  const goToVenues = useCallback(() => resetToView('venues'), [resetToView]);
  const goToQuotes = useCallback(() => resetToView('quotes'), [resetToView]);
  const goToLibrary = useCallback(() => resetToView('library'), [resetToView]);
  const goToXR18Camera = useCallback(() => resetToView('xr18-camera'), [resetToView]);
  const goToAvailability = useCallback(() => resetToView('availability'), [resetToView]);

  // Invoice drill-down
  const goToNewInvoice = useCallback(() => {
    setEditInvoiceId(null);
    pushEntry({ view: 'invoice-form', editInvoiceId: null });
  }, [pushEntry]);
  const goToEditInvoice = useCallback((id: string) => {
    setEditInvoiceId(id);
    pushEntry({ view: 'invoice-form', editInvoiceId: id });
  }, [pushEntry]);
  const goToInvoiceDetail = useCallback((id: string) => {
    setInvoiceId(id);
    pushEntry({ view: 'invoice-detail', invoiceId: id });
  }, [pushEntry]);
  const goToInvoicePreview = useCallback((id: string) => {
    setInvoiceId(id);
    pushEntry({ view: 'invoice-preview', invoiceId: id });
  }, [pushEntry]);

  // Quote drill-down
  const goToNewQuote = useCallback(() => {
    setEditQuoteId(null);
    pushEntry({ view: 'quote-form', editQuoteId: null });
  }, [pushEntry]);
  const goToEditQuote = useCallback((id: string) => {
    setEditQuoteId(id);
    pushEntry({ view: 'quote-form', editQuoteId: id });
  }, [pushEntry]);
  const goToQuoteDetail = useCallback((id: string) => {
    setQuoteId(id);
    pushEntry({ view: 'quote-detail', quoteId: id });
  }, [pushEntry]);
  const goToQuotePreview = useCallback((id: string) => {
    setQuoteId(id);
    pushEntry({ view: 'quote-preview', quoteId: id });
  }, [pushEntry]);

  // Venue drill-down
  const goToVenueDetail = useCallback((id: string) => {
    setVenueId(id);
    pushEntry({ view: 'venue-detail', venueId: id });
  }, [pushEntry]);

  // Booking wizard / Gig Hub
  const goToBookingWizard = useCallback((date: string) => {
    setSelectedDate(date);
    setEditGigId(null);
    pushEntry({ view: 'booking-wizard', selectedDate: date, editGigId: null });
  }, [pushEntry]);
  const goToEditBooking = useCallback((gigId: string) => {
    setEditGigId(gigId);
    pushEntry({ view: 'booking-wizard', editGigId: gigId });
  }, [pushEntry]);
  // Away (push-based, preserves day-detail in stack)
  const goToAway = useCallback((date?: string) => {
    if (date) setSelectedDate(date);
    pushEntry({ view: 'away', selectedDate: date });
  }, [pushEntry]);

  /* ── Post-save replace helpers (swap current entry, no extra back step) ── */
  const replaceWithInvoiceDetail = useCallback((id: string) => {
    setInvoiceId(id);
    replaceEntry({ view: 'invoice-detail', invoiceId: id });
  }, [replaceEntry]);
  const replaceWithQuoteDetail = useCallback((id: string) => {
    setQuoteId(id);
    replaceEntry({ view: 'quote-detail', quoteId: id });
  }, [replaceEntry]);
  const replaceWithNewQuote = useCallback(() => {
    setEditQuoteId(null);
    replaceEntry({ view: 'quote-form', editQuoteId: null });
  }, [replaceEntry]);
  const replaceWithNewInvoice = useCallback(() => {
    setEditInvoiceId(null);
    replaceEntry({ view: 'invoice-form', editInvoiceId: null });
  }, [replaceEntry]);

  // Listen for browser back button / hardware back (Android & iOS PWA)
  useEffect(() => {
    // Seed initial browser history state
    window.history.replaceState({ view: 'calendar', depth: 1 }, '');

    function onPopState() {
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
        setView, goToDay, goToAddGig, goToEditGig,
        goToAddGigFromList, goToEditGigFromList, goBack,
        goToDashboard, goToInvoices, goToNewInvoice, goToEditInvoice,
        goToInvoiceDetail, goToInvoicePreview,
        goToSettings, goToClients,
        goToQuotes, goToNewQuote, goToEditQuote, goToQuoteDetail, goToQuotePreview,
        goToVenues, goToVenueDetail,
        goToLibrary, goToXR18Camera, goToAvailability,
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

// eslint-disable-next-line react-refresh/only-export-components
export function useView() {
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error('useView must be used within ViewProvider');
  return ctx;
}
