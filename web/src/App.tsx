import { useState } from 'react';
import './App.css';
import { useAuth } from './hooks/useAuth';
import { useCalendarData } from './hooks/useCalendarData';
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

  const { gigs, awayDates, profiles, refresh } = useCalendarData(year, month);

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
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="TGT" className="header-logo" />
          <span className="header-title">Timetree</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isMainView && (
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
          )}
          <div className="header-user" onClick={onSignOut}>
            {profile?.name ?? 'User'} &middot; Sign out
          </div>
        </div>
      </div>

      {/* Views */}
      {view === 'calendar' && (
        <>
          <Calendar
            year={year}
            month={month}
            gigs={gigs}
            awayDates={awayDates}
            totalMembers={profiles.length}
            onDatePress={handleDatePress}
            onPrevMonth={goToPrev}
            onNextMonth={goToNext}
          />
          <div style={{ padding: '12px 20px' }}>
            <button className="btn btn-green btn-small" style={{ width: '100%' }} onClick={() => setView('away')}>
              My Away Dates
            </button>
          </div>
        </>
      )}

      {view === 'list' && (
        <>
          <GigList
            onGigPress={handleGigPressFromList}
            onAddGig={handleAddGigFromList}
          />
          <div style={{ padding: '12px 20px' }}>
            <button className="btn btn-green btn-small" style={{ width: '100%' }} onClick={() => setView('away')}>
              My Away Dates
            </button>
          </div>
        </>
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
