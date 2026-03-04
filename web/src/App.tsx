import { useState, useEffect, useRef } from 'react';
import './App.css';
import { useAuth } from './hooks/useAuth';
import { useCalendarData } from './hooks/useCalendarData';
import { getChangesSince, updateLastOpened } from '@shared/supabase/queries';
import type { ChangeSummaryItem } from '@shared/supabase/types';
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
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const { user, profile, loading: authLoading, signIn, signOut } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  if (authLoading) {
    return (
      <div className="app app-centered">
        <LoadingSpinner />
      </div>
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
    setView, goToDay, goToAddGig, goToEditGig,
    goToAddGigFromList, goToEditGigFromList, goBack,
  } = useView();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const { gigs, awayDates, profiles, error: calendarError, refresh } = useCalendarData(year, month);

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

  const isMainView = view === 'calendar' || view === 'list' || view === 'website';

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="flex-row-gap-10">
          <img src="/logo.png" alt="TGT" className="header-logo" />
          <span className="header-title">
            {view === 'calendar' ? 'Calendar' : view === 'list' ? 'Upcoming' : view === 'away' ? 'Away Dates' : 'Timetree'}
          </span>
        </div>
        <div className="flex-row-gap-8">
          <button className="header-user header-user-name" onClick={() => setView('profile')}>
            {profile?.name ?? 'User'}
          </button>
          <span className="header-separator">&middot;</span>
          <button className="header-user header-signout" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

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
      {calendarError && isMainView && (
        <div className="error-banner" role="alert">
          <span className="error-banner-text">{calendarError}</span>
          <button className="btn btn-small btn-green error-banner-retry" onClick={refresh}>Retry</button>
        </div>
      )}

      {/* Change summary banner */}
      {changeSummary.length > 0 && isMainView && (
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
          totalMembers={profiles.length}
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
        />
      )}

      {isMainView && (
        <div className="main-actions">
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${view === 'calendar' ? 'active' : ''}`}
              onClick={() => setView('calendar')}
            >
              Cal
            </button>
            <button
              className={`view-toggle-btn ${view === 'list' ? 'active' : ''}`}
              onClick={() => setView('list')}
            >
              List
            </button>
          </div>
          <button className="btn btn-green btn-small btn-full" onClick={() => setView('away')}>
            My Away Dates
          </button>
          <button className="btn btn-tangerine btn-small btn-full" onClick={() => setView('media')}>
            Manage Media
          </button>
          <button className="btn btn-small btn-full enquiry-archive-btn" onClick={() => setView('enquiries')}>
            Booking Enquiries
          </button>
          <button className="btn btn-small btn-full btn-outline" onClick={() => setView('website')}>
            View Website
          </button>
        </div>
      )}

      {view === 'day-detail' && (
        <DayDetail
          date={selectedDate}
          awayDates={awayDates}
          onClose={goBack}
          onAddGig={goToAddGig}
          onEditGig={goToEditGig}
          onMarkAway={() => setView('away')}
          onGigDeleted={() => { refresh(); refreshQueueCount(); }}
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
    </>
  );
}
