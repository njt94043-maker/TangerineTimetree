import { useState } from 'react';
import './App.css';
import { useAuth } from './hooks/useAuth';
import { useCalendarData } from './hooks/useCalendarData';
import { LoginPage } from './components/LoginPage';
import { Calendar } from './components/Calendar';
import { DayDetail } from './components/DayDetail';
import { GigForm } from './components/GigForm';
import { AwayManager } from './components/AwayManager';

type View = 'calendar' | 'day-detail' | 'gig-form' | 'away';

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
    setView('day-detail');
  }

  function handleAddGig(date: string) {
    setSelectedDate(date);
    setEditGigId(null);
    setView('gig-form');
  }

  function handleEditGig(gigId: string) {
    setEditGigId(gigId);
    setView('gig-form');
  }

  function handleGigSaved() {
    refresh();
    setView('calendar');
  }

  function handleMarkAway() {
    setView('away');
  }

  return (
    <>
      {/* Header */}
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo.png" alt="TGT" className="header-logo" />
          <span className="header-title">Timetree</span>
        </div>
        <div style={{ textAlign: 'right' }}>
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

      {view === 'day-detail' && (
        <DayDetail
          date={selectedDate}
          awayDates={awayDates}
          onClose={() => setView('calendar')}
          onAddGig={handleAddGig}
          onEditGig={handleEditGig}
          onMarkAway={handleMarkAway}
        />
      )}

      {view === 'gig-form' && (
        <GigForm
          date={selectedDate}
          gigId={editGigId}
          onClose={() => setView('calendar')}
          onSaved={handleGigSaved}
        />
      )}

      {view === 'away' && (
        <AwayManager
          initialDate={selectedDate || undefined}
          onClose={() => { refresh(); setView('calendar'); }}
        />
      )}
    </>
  );
}
