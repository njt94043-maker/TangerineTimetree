import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type View = 'calendar' | 'list' | 'day-detail' | 'gig-form' | 'away' | 'profile' | 'media' | 'enquiries' | 'website';

interface ViewState {
  view: View;
  selectedDate: string;
  editGigId: string | null;
  initialGigType: 'gig' | 'practice';
  returnView: 'calendar' | 'list';
}

interface ViewContextValue extends ViewState {
  setView: (view: View) => void;
  goToDay: (date: string) => void;
  goToAddGig: (date: string, type?: 'gig' | 'practice') => void;
  goToEditGig: (gigId: string) => void;
  goToAddGigFromList: (date: string, type: 'gig' | 'practice') => void;
  goToEditGigFromList: (gigId: string, date: string) => void;
  goBack: () => void;
}

const ViewContext = createContext<ViewContextValue | null>(null);

export function ViewProvider({ children }: { children: ReactNode }) {
  const [view, setViewRaw] = useState<View>('calendar');
  const [selectedDate, setSelectedDate] = useState('');
  const [editGigId, setEditGigId] = useState<string | null>(null);
  const [initialGigType, setInitialGigType] = useState<'gig' | 'practice'>('gig');
  const [returnView, setReturnView] = useState<'calendar' | 'list'>('calendar');

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

  return (
    <ViewContext.Provider
      value={{
        view, selectedDate, editGigId, initialGigType, returnView,
        setView, goToDay, goToAddGig, goToEditGig,
        goToAddGigFromList, goToEditGigFromList, goBack,
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
