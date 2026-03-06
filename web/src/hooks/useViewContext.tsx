import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';

type View =
  | 'dashboard' | 'calendar' | 'list' | 'day-detail' | 'gig-form' | 'away'
  | 'profile' | 'media' | 'enquiries' | 'website'
  | 'invoices' | 'invoice-form' | 'invoice-detail' | 'invoice-preview'
  | 'quotes' | 'quote-form' | 'quote-detail' | 'quote-preview'
  | 'settings' | 'clients'
  | 'venues' | 'venue-detail'
  | 'songs' | 'song-form'
  | 'setlists' | 'setlist-detail';

interface ViewState {
  view: View;
  selectedDate: string;
  editGigId: string | null;
  initialGigType: 'gig' | 'practice';
  // Invoice-specific state
  invoiceId: string | null;
  editInvoiceId: string | null;
  // Quote-specific state
  quoteId: string | null;
  editQuoteId: string | null;
  // Venue-specific state
  venueId: string | null;
  // Song-specific state
  editSongId: string | null;
  // Setlist-specific state
  setlistId: string | null;
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
}

const ViewContext = createContext<ViewContextValue | null>(null);

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

  // View history stack for step-by-step back navigation
  const historyRef = useRef<View[]>(['calendar']);
  // Flag to suppress pushState when handling popstate (browser back button)
  const handlingPopState = useRef(false);

  // Push a new view onto the history stack
  function pushView(v: View) {
    // Avoid duplicate consecutive entries (e.g. navigating to same day-detail)
    const stack = historyRef.current;
    if (stack[stack.length - 1] !== v) {
      historyRef.current = [...stack, v];
    }
    setViewRaw(v);
    // Push browser history entry so hardware/OS back button navigates within the app
    if (!handlingPopState.current) {
      window.history.pushState({ view: v, depth: historyRef.current.length }, '');
    }
  }

  // Top-level navigation — resets the history stack
  function resetToView(v: View) {
    historyRef.current = [v];
    setViewRaw(v);
    // Push browser history entry so hardware back button can return to previous view
    if (!handlingPopState.current) {
      window.history.pushState({ view: v, depth: 1 }, '');
    }
  }

  const setView = useCallback((v: View) => resetToView(v), []);

  const goToDay = useCallback((date: string) => {
    setSelectedDate(date);
    pushView('day-detail');
  }, []);

  const goToAddGig = useCallback((date: string, type: 'gig' | 'practice' = 'gig') => {
    setSelectedDate(date);
    setEditGigId(null);
    setInitialGigType(type);
    pushView('gig-form');
  }, []);

  const goToEditGig = useCallback((gigId: string) => {
    setEditGigId(gigId);
    pushView('gig-form');
  }, []);

  const goToAddGigFromList = useCallback((date: string, type: 'gig' | 'practice') => {
    setSelectedDate(date);
    setEditGigId(null);
    setInitialGigType(type);
    pushView('gig-form');
  }, []);

  const goToEditGigFromList = useCallback((gigId: string, date: string) => {
    setSelectedDate(date);
    setEditGigId(gigId);
    pushView('gig-form');
  }, []);

  const goBack = useCallback(() => {
    const stack = historyRef.current;
    if (stack.length <= 1) {
      // Already at root — stay on calendar
      setViewRaw('calendar');
      return;
    }
    // Pop current view, go to previous
    const newStack = stack.slice(0, -1);
    historyRef.current = newStack;
    setViewRaw(newStack[newStack.length - 1]);
    // Keep browser history in sync — go back so popstate doesn't double-pop
    if (!handlingPopState.current) {
      handlingPopState.current = true;
      window.history.back();
      // Reset flag after a short delay to allow popstate to fire and be skipped
      setTimeout(() => { handlingPopState.current = false; }, 100);
    }
  }, []);

  // Top-level drawer navigation — resets stack
  const goToDashboard = useCallback(() => resetToView('dashboard'), []);
  const goToInvoices = useCallback(() => resetToView('invoices'), []);
  const goToSettings = useCallback(() => resetToView('settings'), []);
  const goToClients = useCallback(() => resetToView('clients'), []);
  const goToVenues = useCallback(() => resetToView('venues'), []);
  const goToQuotes = useCallback(() => resetToView('quotes'), []);

  // Drill-down navigation — pushes onto stack
  const goToNewInvoice = useCallback(() => {
    setEditInvoiceId(null);
    pushView('invoice-form');
  }, []);
  const goToEditInvoice = useCallback((id: string) => {
    setEditInvoiceId(id);
    pushView('invoice-form');
  }, []);
  const goToInvoiceDetail = useCallback((id: string) => {
    setInvoiceId(id);
    pushView('invoice-detail');
  }, []);
  const goToInvoicePreview = useCallback((id: string) => {
    setInvoiceId(id);
    pushView('invoice-preview');
  }, []);
  const goToNewQuote = useCallback(() => {
    setEditQuoteId(null);
    pushView('quote-form');
  }, []);
  const goToEditQuote = useCallback((id: string) => {
    setEditQuoteId(id);
    pushView('quote-form');
  }, []);
  const goToQuoteDetail = useCallback((id: string) => {
    setQuoteId(id);
    pushView('quote-detail');
  }, []);
  const goToQuotePreview = useCallback((id: string) => {
    setQuoteId(id);
    pushView('quote-preview');
  }, []);
  const goToVenueDetail = useCallback((id: string) => {
    setVenueId(id);
    pushView('venue-detail');
  }, []);
  const goToSongs = useCallback(() => resetToView('songs'), []);
  const goToNewSong = useCallback(() => {
    setEditSongId(null);
    pushView('song-form');
  }, []);
  const goToEditSong = useCallback((id: string) => {
    setEditSongId(id);
    pushView('song-form');
  }, []);
  const goToSetlists = useCallback(() => resetToView('setlists'), []);
  const goToSetlistDetail = useCallback((id: string) => {
    setSetlistId(id);
    pushView('setlist-detail');
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
        setViewRaw('calendar');
        window.history.pushState({ view: 'calendar', depth: 1 }, '');
      } else {
        // Pop current view, go to previous
        const newStack = stack.slice(0, -1);
        historyRef.current = newStack;
        setViewRaw(newStack[newStack.length - 1]);
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
        setView, goToDay, goToAddGig, goToEditGig,
        goToAddGigFromList, goToEditGigFromList, goBack,
        goToDashboard, goToInvoices, goToNewInvoice, goToEditInvoice,
        goToInvoiceDetail, goToInvoicePreview,
        goToSettings, goToClients,
        goToQuotes, goToNewQuote, goToEditQuote, goToQuoteDetail, goToQuotePreview,
        goToVenues, goToVenueDetail,
        goToSongs, goToNewSong, goToEditSong,
        goToSetlists, goToSetlistDetail,
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
