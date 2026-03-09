import { useState, useEffect, useCallback } from 'react';
import './theme.css';
import './App.css';
import { Drawer } from './components/Drawer';
import { TrackList } from './components/TrackList';
import { TrackDetail } from './components/TrackDetail';
import { CapturePanel } from './components/CapturePanel';
import { ServerPanel } from './components/ServerPanel';
import { checkHealth } from './api';
import type { View } from './types';

const VIEW_LABELS: Record<View, string> = {
  library: 'Library',
  detail: 'Track',
  capture: 'Capture',
  stats: 'Stats',
  server: 'Server',
};

export default function App() {
  const [view, setView] = useState<View>('library');
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    checkHealth().then(setConnected);
    const interval = setInterval(() => checkHealth().then(setConnected), 10000);
    return () => clearInterval(interval);
  }, []);

  const openTrack = (id: string) => {
    setSelectedTrackId(id);
    setView('detail');
  };

  const goBack = () => {
    setView('library');
    setSelectedTrackId(null);
  };

  const handleNav = useCallback((v: View) => {
    setView(v);
    setSelectedTrackId(null);
    if (window.innerWidth < 768) setDrawerOpen(false);
  }, []);

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="hamburger" onClick={() => setDrawerOpen(!drawerOpen)}>
            <span className={`hamburger-bar ${drawerOpen ? 'open' : ''}`} />
            <span className={`hamburger-bar ${drawerOpen ? 'open' : ''}`} />
            <span className={`hamburger-bar ${drawerOpen ? 'open' : ''}`} />
          </button>
          <img src="/icon-192.png" alt="" className="header-logo" />
          <span className="header-title">
            <span className="header-brand-green">Audio </span>
            <span className="header-brand-orange">Capture</span>
          </span>
        </div>
        <span className="header-screen-name">{VIEW_LABELS[view]}</span>
        <div className="conn-badge">
          <span className={`conn-dot ${connected ? 'ok' : ''}`} />
          {connected ? 'Online' : 'Offline'}
        </div>
      </header>

      {/* Drawer */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        view={view}
        onNav={handleNav}
        connected={connected}
      />

      {/* Content */}
      <div className="main-content">
        {view === 'library' && <TrackList onSelect={openTrack} />}
        {view === 'detail' && selectedTrackId && (
          <TrackDetail trackId={selectedTrackId} onBack={goBack} />
        )}
        {view === 'capture' && <CapturePanel />}
        {view === 'server' && <ServerPanel />}
      </div>
    </div>
  );
}
