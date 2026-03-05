import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type View =
  | 'dashboard' | 'calendar' | 'list' | 'day-detail' | 'gig-form' | 'away'
  | 'profile' | 'media' | 'enquiries' | 'website'
  | 'invoices' | 'invoice-form' | 'invoice-detail' | 'invoice-preview'
  | 'quotes' | 'quote-form' | 'quote-detail' | 'quote-preview'
  | 'settings' | 'clients';

interface ViewState {
  view: View;
  selectedDate: string;
  editGigId: string | null;
  initialGigType: 'gig' | 'practice';
  returnView: 'calendar' | 'list';
  // Invoice-specific state
  invoiceId: string | null;
  editInvoiceId: string | null;
  // Quote-specific state
  quoteId: string | null;
  editQuoteId: string | null;
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
}

const ViewContext = createContext<ViewContextValue | null>(null);

export function ViewProvider({ children }: { children: ReactNode }) {
  const [view, setViewRaw] = useState<View>('calendar');
  const [selectedDate, setSelectedDate] = useState('');
  const [editGigId, setEditGigId] = useState<string | null>(null);
  const [initialGigType, setInitialGigType] = useState<'gig' | 'practice'>('gig');
  const [returnView, setReturnView] = useState<'calendar' | 'list'>('calendar');
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [editQuoteId, setEditQuoteId] = useState<string | null>(null);

  const setView = useCallback((v: View) => setViewRaw(v), []);

  const goToDay = useCallback((date: string) => {
    setSelectedDate(date);
    setReturnView('calendar');
    setViewRaw('day-detail');
  }, []);

  const goToAddGig = useCallback((date: string, type: 'gig' | 'practice' = 'gig') => {
    setSelectedDate(date);
    setEditGigId(null);
    setInitialGigType(type);
    setReturnView('calendar');
    setViewRaw('gig-form');
  }, []);

  const goToEditGig = useCallback((gigId: string) => {
    setEditGigId(gigId);
    setReturnView('calendar');
    setViewRaw('gig-form');
  }, []);

  const goToAddGigFromList = useCallback((date: string, type: 'gig' | 'practice') => {
    setSelectedDate(date);
    setEditGigId(null);
    setInitialGigType(type);
    setReturnView('list');
    setViewRaw('gig-form');
  }, []);

  const goToEditGigFromList = useCallback((gigId: string, date: string) => {
    setSelectedDate(date);
    setEditGigId(gigId);
    setReturnView('list');
    setViewRaw('gig-form');
  }, []);

  const goBack = useCallback(() => setViewRaw(returnView), [returnView]);

  // Navigation
  const goToDashboard = useCallback(() => setViewRaw('dashboard'), []);
  const goToInvoices = useCallback(() => setViewRaw('invoices'), []);
  const goToNewInvoice = useCallback(() => {
    setEditInvoiceId(null);
    setViewRaw('invoice-form');
  }, []);
  const goToEditInvoice = useCallback((id: string) => {
    setEditInvoiceId(id);
    setViewRaw('invoice-form');
  }, []);
  const goToInvoiceDetail = useCallback((id: string) => {
    setInvoiceId(id);
    setViewRaw('invoice-detail');
  }, []);
  const goToInvoicePreview = useCallback((id: string) => {
    setInvoiceId(id);
    setViewRaw('invoice-preview');
  }, []);
  const goToSettings = useCallback(() => setViewRaw('settings'), []);
  const goToClients = useCallback(() => setViewRaw('clients'), []);
  const goToQuotes = useCallback(() => setViewRaw('quotes'), []);
  const goToNewQuote = useCallback(() => {
    setEditQuoteId(null);
    setViewRaw('quote-form');
  }, []);
  const goToEditQuote = useCallback((id: string) => {
    setEditQuoteId(id);
    setViewRaw('quote-form');
  }, []);
  const goToQuoteDetail = useCallback((id: string) => {
    setQuoteId(id);
    setViewRaw('quote-detail');
  }, []);
  const goToQuotePreview = useCallback((id: string) => {
    setQuoteId(id);
    setViewRaw('quote-preview');
  }, []);

  return (
    <ViewContext.Provider
      value={{
        view, selectedDate, editGigId, initialGigType, returnView,
        invoiceId, editInvoiceId,
        quoteId, editQuoteId,
        setView, goToDay, goToAddGig, goToEditGig,
        goToAddGigFromList, goToEditGigFromList, goBack,
        goToDashboard, goToInvoices, goToNewInvoice, goToEditInvoice,
        goToInvoiceDetail, goToInvoicePreview,
        goToSettings, goToClients,
        goToQuotes, goToNewQuote, goToEditQuote, goToQuoteDetail, goToQuotePreview,
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
