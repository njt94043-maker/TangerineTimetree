import { useState, useEffect, useRef } from 'react';
import './App.css';
import { useAuth } from './hooks/useAuth';
import { useCalendarData } from './hooks/useCalendarData';
import { getChangesSince, updateLastOpened } from '@shared/supabase/queries';
import type { ChangeSummaryItem } from '@shared/supabase/types';
import { useOfflineQueue } from './hooks/useOfflineQueue';
import { LoginPage } from './components/LoginPage';
import { Calendar } from './components/Calendar';
import { GigList } from './components/GigList';
import { DayDetail } from './components/DayDetail';
import { GigForm } from './components/GigForm';
import { AwayManager } from './components/AwayManager';

type View = 'calendar' | 'list' | 'day-detail' | 'gig-form' | 'away';

export default function App() {
  const { user, profile, loading: authLoading, signIn, signOut } = useAuth();

  if (authLoading) {
    return (
      <div className="app" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p style={{ color: 'var(--color-tangerine)' }}>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app">
        <LoginPage onSignIn={signIn} />
      </div>
    );
  }

  return (
    <div className="app">
      <MainView profile={profile} onSignOut={signOut} />
    </div>
  );
}

function MainView({ profile, onSignOut }: { profile: any; onSignOut: () => void }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [view, setView] = useState<View>('calendar');
  const [selectedDate, setSelectedDate] = useState('');
  const [editGigId, setEditGigId] = useState<string | null>(null);
  const [initialGigType, setInitialGigType] = useState<'gig' | 'practice'>('gig');

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

  function handleDatePress(date: string) {
    setSelectedDate(date);
    setReturnView('calendar');
    setView('day-detail');
  }

  function handleAddGig(date: string, type: 'gig' | 'practice' = 'gig') {
    setSelectedDate(date);
    setEditGigId(null);
    setInitialGigType(type);
    setReturnView('calendar');
    setView('gig-form');
  }

  function handleEditGig(gigId: string) {
    setEditGigId(gigId);
    setReturnView('calendar');
    setView('gig-form');
  }

  const [returnView, setReturnView] = useState<'calendar' | 'list'>('calendar');

  function handleGigSaved() {
    refresh();
    refreshQueueCount();
    setView(returnView);
  }

  function handleMarkAway() {
    setView('away');
  }

  function handleGigPressFromList(gigId: string, date: string) {
    setSelectedDate(date);
    setEditGigId(gigId);
    setReturnView('list');
    setView('gig-form');
  }

  function handleAddGigFromList(date: string, type: 'gig' | 'practice') {
    setSelectedDate(date);
    setEditGigId(null);
    setInitialGigType(type);
    setReturnView('list');
    setView('gig-form');
  }

  const isMainView = view === 'calendar' || view === 'list';

  return (
    <>
      {/* Header */}
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="TGT" className="header-logo" />
          <span className="header-title">
            {view === 'calendar' ? 'Calendar' : view === 'list' ? 'Upcoming' : view === 'away' ? 'Away Dates' : 'Timetree'}
          </span>
        </div>
        <button className="header-user" onClick={onSignOut}>
          {profile?.name ?? 'User'} &middot; Sign out
        </button>
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
          <button className="btn btn-small btn-green" style={{ marginLeft: 12 }} onClick={refresh}>Retry</button>
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
      {view === 'calendar' && (
        <Calendar
          year={year}
          month={month}
          gigs={gigs}
          awayDates={awayDates}
          totalMembers={profiles.length}
          onDatePress={handleDatePress}
          onPrevMonth={goToPrev}
          onNextMonth={goToNext}
          onGoToToday={() => { const n = new Date(); setYear(n.getFullYear()); setMonth(n.getMonth()); }}
        />
      )}

      {view === 'list' && (
        <GigList
          onGigPress={handleGigPressFromList}
          onAddGig={handleAddGigFromList}
        />
      )}

      {isMainView && (
        <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="view-toggle" style={{ alignSelf: 'center' }}>
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
          <button className="btn btn-green btn-small" style={{ width: '100%' }} onClick={() => setView('away')}>
            My Away Dates
          </button>
        </div>
      )}

      {view === 'day-detail' && (
        <DayDetail
          date={selectedDate}
          awayDates={awayDates}
          onClose={() => setView(returnView)}
          onAddGig={handleAddGig}
          onEditGig={handleEditGig}
          onMarkAway={handleMarkAway}
        />
      )}

      {view === 'gig-form' && (
        <GigForm
          date={selectedDate}
          gigId={editGigId}
          initialType={initialGigType}
          onClose={() => setView(returnView)}
          onSaved={handleGigSaved}
        />
      )}

      {view === 'away' && (
        <AwayManager
          initialDate={selectedDate || undefined}
          onClose={() => { refresh(); setView(returnView); }}
        />
      )}
    </>
  );
}
