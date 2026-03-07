import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './App.css';
import { useAuth } from './hooks/useAuth';
import { useCalendarData } from './hooks/useCalendarData';
import { useInvoiceData } from './hooks/useInvoiceData';
import { useQuoteData } from './hooks/useQuoteData';
import { getChangesSince, updateLastOpened, createGig } from '@shared/supabase/queries';
import type { ChangeSummaryItem, GigWithCreator } from '@shared/supabase/types';
import { useOfflineQueue } from './hooks/useOfflineQueue';
import { ViewProvider, useView } from './hooks/useViewContext';
import { PublicSite } from './components/PublicSite';
import { LoginModal } from './components/LoginModal';
import { Calendar } from './components/Calendar';
import { GigList } from './components/GigList';
import { DayDetail } from './components/DayDetail';
import { GigForm } from './components/GigForm';
import { AwayManager } from './components/AwayManager';
import { ProfilePage } from './components/ProfilePage';
import { MediaManager } from './components/MediaManager';
import { Enquiries } from './components/Enquiries';
import { Settings } from './components/Settings';
import { ClientList } from './components/ClientList';
import { InvoiceList } from './components/InvoiceList';
import { InvoiceForm } from './components/InvoiceForm';
import { InvoiceDetail } from './components/InvoiceDetail';
import { InvoicePreview } from './components/InvoicePreview';
import { QuoteList } from './components/QuoteList';
import { QuoteForm } from './components/QuoteForm';
import { QuoteDetail } from './components/QuoteDetail';
import { QuotePreview } from './components/QuotePreview';
import { Dashboard } from './components/Dashboard';
import { VenueList } from './components/VenueList';
import { VenueDetail } from './components/VenueDetail';
import { SongList } from './components/SongList';
import { SongForm } from './components/SongForm';
import { SetlistList } from './components/SetlistList';
import { SetlistDetail } from './components/SetlistDetail';
import { Drawer } from './components/Drawer';
import { SplashScreen } from './components/SplashScreen';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const { user, profile, loading: authLoading, signIn, signOut } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  if (!splashDone) {
    return (
      <SplashScreen
        ready={!authLoading}
        onComplete={() => setSplashDone(true)}
      />
    );
  }

  if (!user) {
    return (
      <>
        <PublicSite onLogin={() => setShowLoginModal(true)} />
        {showLoginModal && (
          <LoginModal onSignIn={signIn} onClose={() => setShowLoginModal(false)} />
        )}
      </>
    );
  }

  return (
    <ErrorBoundary>
      <ViewProvider>
        <div className="app">
          <MainView profile={profile} userEmail={user.email ?? ''} onSignOut={signOut} />
        </div>
      </ViewProvider>
    </ErrorBoundary>
  );
}

function MainView({ profile, userEmail, onSignOut }: { profile: any; userEmail: string; onSignOut: () => void }) {
  const {
    view, selectedDate, editGigId, initialGigType,
    invoiceId,
    setView, goToDay, goToAddGig, goToEditGig,
    goToAddGigFromList, goToEditGigFromList, goBack,
    goToInvoices, goToNewInvoice, goToInvoiceDetail, goToInvoicePreview,
    goToSettings, goToClients,
    quoteId,
    goToQuotes, goToNewQuote, goToEditQuote, goToQuoteDetail, goToQuotePreview,
    venueId, goToVenues, goToVenueDetail,
    editSongId, goToSongs, goToNewSong, goToEditSong,
    setlistId, goToSetlistDetail,
  } = useView();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [invoicePrefill, setInvoicePrefill] = useState<{ venue?: string; venue_id?: string; client_id?: string; gig_id?: string; gig_date?: string; amount?: string; description?: string } | undefined>();

  const { gigs, awayDates, error: calendarError, refresh } = useCalendarData(year, month);
  const { invoices, loading: invoicesLoading, refresh: refreshInvoices } = useInvoiceData();
  const { quotes, loading: quotesLoading, refresh: refreshQuotes } = useQuoteData();

  // Build sorted list of dates that have events (gigs, practice, or away)
  const eventDates = useMemo(() => {
    const dateSet = new Set<string>();
    gigs.forEach(g => dateSet.add(g.date));
    awayDates.forEach(a => {
      const start = new Date(a.start_date + 'T12:00:00');
      const end = new Date(a.end_date + 'T12:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dateSet.add(d.toISOString().slice(0, 10));
      }
    });
    return [...dateSet].sort();
  }, [gigs, awayDates]);

  // Offline mutation queue
  const { pendingCount, refreshCount: refreshQueueCount } = useOfflineQueue(refresh);

  // Change summary banner
  const [changeSummary, setChangeSummary] = useState<ChangeSummaryItem[]>([]);
  const changeSummaryChecked = useRef(false);

  useEffect(() => {
    if (!profile?.last_opened_at || changeSummaryChecked.current) return;
    changeSummaryChecked.current = true;
    getChangesSince(profile.last_opened_at)
      .then(items => { if (items.length > 0) setChangeSummary(items); })
      .catch(() => {});
  }, [profile]);

  function dismissChangeSummary() {
    setChangeSummary([]);
    updateLastOpened().catch(() => {});
  }

  // Offline indicator
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => { setIsOffline(false); refresh(); };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline); };
  }, [refresh]);

  const toggleDrawer = useCallback(() => setDrawerOpen(o => !o), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  function goToPrev() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }

  function goToNext() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  function handleGigSaved() {
    refresh();
    refreshQueueCount();
    goBack();
  }

  function handleInvoiceSaved(id: string) {
    refreshInvoices();
    setInvoicePrefill(undefined);
    goToInvoiceDetail(id);
  }

  function handleCreateInvoiceFromGig(gig: GigWithCreator) {
    setInvoicePrefill({
      venue: gig.venue,
      venue_id: gig.venue_id ?? undefined,
      client_id: gig.client_id ?? undefined,
      gig_id: gig.id,
      gig_date: gig.date,
      amount: gig.fee != null ? String(gig.fee) : undefined,
      description: `Live music performance at ${gig.venue}`,
    });
    goToNewInvoice();
  }

  function handleQuoteSaved(id: string) {
    refreshQuotes();
    goToQuoteDetail(id);
  }

  async function handleAddGigFromQuote(date: string, venue: string, fee: number, venueId?: string | null, clientId?: string | null, clientName?: string) {
    try {
      await createGig({ date, venue, fee, venue_id: venueId, client_id: clientId, client_name: clientName || '', payment_type: 'invoice', visibility: 'hidden' });
      refresh();
    } catch {
      // Silently fail — gig creation is optional
    }
  }

  const headerTitle = (() => {
    switch (view) {
      case 'dashboard': return 'Dashboard';
      case 'calendar': return 'Calendar';
      case 'list': return 'Gig List';
      case 'away': return 'Away Dates';
      case 'invoices': case 'invoice-form': case 'invoice-detail': case 'invoice-preview': return 'Invoices';
      case 'quotes': case 'quote-form': case 'quote-detail': case 'quote-preview': return 'Quotes';
      case 'settings': return 'Settings';
      case 'clients': return 'Clients';
      case 'venues': case 'venue-detail': return 'Venues';
      case 'songs': case 'song-form': return 'Songs';
      case 'setlists': case 'setlist-detail': return 'Setlists';
      case 'media': return 'Media';
      case 'enquiries': return 'Enquiries';
      case 'website': return 'Website';
      case 'profile': return 'Profile';
      case 'day-detail': return 'Day Detail';
      case 'gig-form': return 'Gig Form';
      default: return 'Timetree';
    }
  })();

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="flex-row-gap-10">
          <button className="hamburger" onClick={toggleDrawer} aria-label="Toggle menu">
            <span className={`hamburger-bar ${drawerOpen ? 'open' : ''}`} />
            <span className={`hamburger-bar ${drawerOpen ? 'open' : ''}`} />
            <span className={`hamburger-bar ${drawerOpen ? 'open' : ''}`} />
          </button>
          <img src="/logo.png" alt="TGT" className="header-logo" />
          <span className="header-title">
            <span className="header-brand-green">Tangerine</span>{' '}
            <span className="header-brand-orange">Timetree</span>
          </span>
        </div>
        <div className="flex-row-gap-8">
          <span className="header-screen-name">{headerTitle}</span>
          <button className="header-avatar" onClick={() => setView('profile')} title={profile?.name ?? 'Profile'}>
            {(profile?.name ?? 'U')[0]}
          </button>
          <button className="header-user header-signout" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      {/* Drawer */}
      <Drawer isOpen={drawerOpen} onClose={closeDrawer} profileName={profile?.name ?? 'User'} />

      {/* Main content area */}
      <main className="main-content">
        {/* Offline banner */}
        {isOffline && (
          <div className="offline-banner" role="status">
            You're offline — showing cached data
            {pendingCount > 0 && ` (${pendingCount} change${pendingCount > 1 ? 's' : ''} pending sync)`}
          </div>
        )}

        {/* Pending sync badge (when online but queue still has items) */}
        {!isOffline && pendingCount > 0 && (
          <div className="offline-banner" role="status">
            {pendingCount} change{pendingCount > 1 ? 's' : ''} syncing...
          </div>
        )}

        {/* Error banner */}
        {calendarError && (view === 'dashboard' || view === 'calendar' || view === 'list') && (
          <div className="error-banner" role="alert">
            <span className="error-banner-text">{calendarError}</span>
            <button className="btn btn-small btn-green error-banner-retry" onClick={refresh}>Retry</button>
          </div>
        )}

        {/* Change summary banner */}
        {changeSummary.length > 0 && (view === 'dashboard' || view === 'calendar' || view === 'list') && (
          <div className="change-banner">
            <div className="change-banner-header">
              <span className="change-banner-title">What's changed</span>
              <button className="change-banner-dismiss" onClick={dismissChangeSummary}>Dismiss</button>
            </div>
            <ul className="change-banner-list">
              {changeSummary.map((item, i) => (
                <li key={i} className="change-banner-item">
                  <span className={`change-dot ${item.type}`} />
                  <span><strong>{item.user_name}</strong> {item.description}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Views */}
        {view === 'dashboard' && (
          <Dashboard
            onInvoicePress={goToInvoiceDetail}
            onNewInvoice={goToNewInvoice}
            onGoToInvoices={goToInvoices}
            onGoToCalendar={() => setView('calendar')}
            onGoToClients={goToClients}
            onGoToSettings={goToSettings}
          />
        )}

        {view === 'website' && (
          <div className="website-preview">
            <button className="btn btn-green website-back-btn" onClick={() => setView('calendar')}>
              Back to App
            </button>
            <PublicSite onLogin={() => {}} />
          </div>
        )}

        {view === 'calendar' && (
          <Calendar
            year={year}
            month={month}
            gigs={gigs}
            awayDates={awayDates}
            onDatePress={goToDay}
            onPrevMonth={goToPrev}
            onNextMonth={goToNext}
            onGoToToday={() => { const n = new Date(); setYear(n.getFullYear()); setMonth(n.getMonth()); }}
          />
        )}

        {view === 'list' && (
          <GigList
            onGigPress={goToEditGigFromList}
            onAddGig={goToAddGigFromList}
            onCreateInvoice={handleCreateInvoiceFromGig}
          />
        )}

        {view === 'day-detail' && (
          <DayDetail
            date={selectedDate}
            awayDates={awayDates}
            eventDates={eventDates}
            onClose={goBack}
            onAddGig={goToAddGig}
            onEditGig={goToEditGig}
            onMarkAway={() => setView('away')}
            onGigDeleted={() => { refresh(); refreshQueueCount(); }}
            onDateChange={goToDay}
            onCreateInvoice={handleCreateInvoiceFromGig}
          />
        )}

        {view === 'gig-form' && (
          <GigForm
            date={selectedDate}
            gigId={editGigId}
            initialType={initialGigType}
            onClose={goBack}
            onSaved={handleGigSaved}
          />
        )}

        {view === 'away' && (
          <AwayManager
            initialDate={selectedDate || undefined}
            onClose={() => { refresh(); goBack(); }}
          />
        )}

        {view === 'profile' && (
          <ProfilePage
            userEmail={userEmail}
            onClose={goBack}
            onSignOut={onSignOut}
          />
        )}

        {view === 'media' && (
          <MediaManager onClose={goBack} />
        )}

        {view === 'enquiries' && (
          <Enquiries onClose={goBack} />
        )}

        {view === 'invoices' && (
          <InvoiceList
            invoices={invoices}
            loading={invoicesLoading}
            onNewInvoice={goToNewInvoice}
            onInvoicePress={goToInvoiceDetail}
            onClose={() => setView('calendar')}
          />
        )}

        {view === 'invoice-form' && (
          <InvoiceForm
            onClose={() => { setInvoicePrefill(undefined); goBack(); }}
            onSaved={handleInvoiceSaved}
            prefill={invoicePrefill}
          />
        )}

        {view === 'invoice-detail' && invoiceId && (
          <InvoiceDetail
            invoiceId={invoiceId}
            onClose={goBack}
            onPreview={goToInvoicePreview}
            onDuplicate={goToNewInvoice}
            onDeleted={() => { refreshInvoices(); goToInvoices(); }}
          />
        )}

        {view === 'invoice-preview' && invoiceId && (
          <InvoicePreview
            invoiceId={invoiceId}
            onClose={() => goToInvoiceDetail(invoiceId)}
          />
        )}

        {view === 'quotes' && (
          <QuoteList
            quotes={quotes}
            loading={quotesLoading}
            onNewQuote={goToNewQuote}
            onQuotePress={goToQuoteDetail}
            onClose={() => setView('calendar')}
          />
        )}

        {view === 'quote-form' && (
          <QuoteForm
            onClose={goBack}
            onSaved={handleQuoteSaved}
          />
        )}

        {view === 'quote-detail' && quoteId && (
          <QuoteDetail
            quoteId={quoteId}
            onClose={goBack}
            onPreview={goToQuotePreview}
            onEdit={goToEditQuote}
            onDeleted={() => { refreshQuotes(); goToQuotes(); }}
            onAddGig={handleAddGigFromQuote}
          />
        )}

        {view === 'quote-preview' && quoteId && (
          <QuotePreview
            quoteId={quoteId}
            onClose={() => goToQuoteDetail(quoteId)}
          />
        )}

        {view === 'settings' && (
          <Settings onClose={() => setView('calendar')} />
        )}

        {view === 'clients' && (
          <ClientList onClose={() => setView('calendar')} />
        )}

        {view === 'venues' && (
          <VenueList
            onClose={() => setView('calendar')}
            onVenuePress={goToVenueDetail}
          />
        )}

        {view === 'venue-detail' && venueId && (
          <VenueDetail
            venueId={venueId}
            onClose={goBack}
            onDeleted={goToVenues}
          />
        )}

        {view === 'songs' && (
          <SongList
            onClose={() => setView('calendar')}
            onNewSong={goToNewSong}
            onEditSong={goToEditSong}
          />
        )}

        {view === 'song-form' && (
          <SongForm
            songId={editSongId}
            onClose={goBack}
            onSaved={() => { goToSongs(); }}
            bandRole={profile?.band_role}
          />
        )}

        {view === 'setlists' && (
          <SetlistList
            onClose={() => setView('calendar')}
            onSetlistPress={goToSetlistDetail}
          />
        )}

        {view === 'setlist-detail' && setlistId && (
          <SetlistDetail
            setlistId={setlistId}
            onClose={goBack}
          />
        )}
      </main>
    </>
  );
}
