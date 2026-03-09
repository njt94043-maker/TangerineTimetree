import { useState, useEffect, useCallback } from 'react';
import { getHealth, getBackendLogs, restartBackend, getStats } from '../api';

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function ServerPanel() {
  const [health, setHealth] = useState<{ status: string; uptime: number; ffmpeg: string } | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [h, s, l] = await Promise.all([getHealth(), getStats(), getBackendLogs(80)]);
      setHealth(h);
      setStats(s);
      setLogs(l.lines);
      setError('');
    } catch {
      setError('Backend offline');
      setHealth(null);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleRestart = async () => {
    setRestarting(true);
    try {
      await restartBackend();
      // Wait for uvicorn to reload
      await new Promise(r => setTimeout(r, 3000));
      await refresh();
    } catch {
      setError('Restart failed — backend may be offline');
    } finally {
      setRestarting(false);
    }
  };

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <h2 className="page-title">Server</h2>
        <button
          className={`btn btn-small ${restarting ? '' : 'btn-tangerine'}`}
          onClick={handleRestart}
          disabled={restarting}
        >
          {restarting ? 'Restarting...' : 'Restart Backend'}
        </button>
      </div>

      {error && (
        <div className="neu-card" style={{ padding: 16, borderLeft: '3px solid var(--color-danger)', marginBottom: 12 }}>
          <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>
        </div>
      )}

      {/* Status cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div className="neu-card" style={{ padding: 14 }}>
          <div className="label" style={{ margin: '0 0 4px' }}>Status</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`conn-dot ${health ? 'ok' : ''}`} style={{ width: 8, height: 8 }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: health ? 'var(--color-green)' : 'var(--color-danger)' }}>
              {health ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="neu-card" style={{ padding: 14 }}>
          <div className="label" style={{ margin: '0 0 4px' }}>Uptime</div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>
            {health ? formatUptime(health.uptime) : '--'}
          </span>
        </div>

        <div className="neu-card" style={{ padding: 14 }}>
          <div className="label" style={{ margin: '0 0 4px' }}>Tracks</div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>
            {stats?.total_tracks ?? '--'}
          </span>
        </div>

        <div className="neu-card" style={{ padding: 14 }}>
          <div className="label" style={{ margin: '0 0 4px' }}>Library Size</div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>
            {stats?.total_duration_seconds
              ? `${Math.floor(stats.total_duration_seconds / 60)} min`
              : '--'}
          </span>
        </div>
      </div>

      {/* FFmpeg */}
      <div className="neu-card" style={{ padding: 14, marginBottom: 16 }}>
        <div className="label" style={{ margin: '0 0 4px' }}>FFmpeg</div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-dim)', wordBreak: 'break-all' }}>
          {health?.ffmpeg ?? 'Unknown'}
        </span>
      </div>

      {/* Logs */}
      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="label" style={{ margin: 0 }}>Backend Logs</span>
        <button className="btn btn-small" onClick={refresh}>Refresh</button>
      </div>
      <div
        className="neu-inset"
        style={{
          padding: 12,
          maxHeight: 320,
          overflowY: 'auto',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          lineHeight: 1.6,
          color: 'var(--color-text-dim)',
        }}
      >
        {logs.length === 0 ? (
          <span style={{ color: 'var(--color-text-muted)' }}>No logs yet</span>
        ) : (
          logs.map((line, i) => (
            <div
              key={i}
              style={{
                color: line.includes('ERROR') ? 'var(--color-danger)'
                     : line.includes('WARNING') ? 'var(--color-tangerine)'
                     : undefined,
              }}
            >
              {line}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
