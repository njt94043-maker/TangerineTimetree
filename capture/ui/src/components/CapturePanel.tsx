import { useState, useEffect, useRef } from 'react';
import { startWasapi, stopWasapi, pauseCapture, resumeCapture, getCaptureStatus, getWasapiDevices, getTabInfo, confirmWasapi, discardWasapi } from '../api';

interface Device {
  index: number;
  name: string;
  channels: number;
  sample_rate: number;
}

export function CapturePanel() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<number | undefined>(undefined);
  const [tabTitle, setTabTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [paused, setPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');
  const [detecting, setDetecting] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    getWasapiDevices()
      .then(setDevices)
      .catch(() => setError('Cannot connect to backend. Is the server running?'));
    // Auto-detect on mount
    detectFromChrome();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const detectFromChrome = async () => {
    setDetecting(true);
    try {
      const info = await getTabInfo();
      if (info.title) setTabTitle(info.title);
      if (info.url) setSourceUrl(info.url);
    } catch {
      // Extension not reporting — that's fine
    } finally {
      setDetecting(false);
    }
  };

  const startPolling = (sid: string) => {
    pollRef.current = window.setInterval(async () => {
      try {
        const res = await getCaptureStatus(sid);
        setStatus(res.status);
        setPaused(res.paused);
        if (res.duration_seconds !== undefined) setDuration(res.duration_seconds);
        if (res.status === 'review' || res.status === 'complete' || res.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          if (res.status === 'failed') setError(res.error_message || 'Encoding failed');
        }
      } catch {
        // ignore poll errors
      }
    }, 500);
  };

  const handleStart = async () => {
    setError('');
    try {
      const res = await startWasapi(selectedDevice, tabTitle, sourceUrl);
      setSessionId(res.session_id);
      setStatus('recording');
      setDuration(0);
      startPolling(res.session_id);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleStop = async () => {
    if (!sessionId) return;
    try {
      await stopWasapi(sessionId);
      setStatus('review');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleConfirm = async () => {
    if (!sessionId) return;
    setError('');
    try {
      await confirmWasapi(sessionId);
      setStatus('encoding');
      startPolling(sessionId);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDiscard = async () => {
    if (!sessionId) return;
    setError('');
    try {
      await discardWasapi(sessionId);
      setStatus('idle');
      setSessionId(null);
      setDuration(0);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handlePause = async () => {
    if (!sessionId) return;
    await pauseCapture(sessionId);
    setPaused(true);
  };

  const handleResume = async () => {
    if (!sessionId) return;
    await resumeCapture(sessionId);
    setPaused(false);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isRecording = status === 'recording';
  const isEncoding = status === 'encoding';
  const isReview = status === 'review';

  return (
    <div className="form-wrap form-top">
      <div className="page-header">
        <h2 className="page-title">WASAPI Capture</h2>
        <div className="page-header-spacer" />
      </div>

      <p style={{ fontSize: 13, color: 'var(--color-text-dim)', marginBottom: 16 }}>
        Record system audio directly. Use Pause to skip ads.
      </p>

      {!isRecording && !isEncoding && !isReview && status !== 'complete' && (
        <>
          {/* What's playing — auto-fill from Chrome extension */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="label" style={{ margin: '0 0 6px' }}>What's Playing</label>
              <button
                className="btn btn-small btn-green"
                onClick={detectFromChrome}
                disabled={detecting}
                style={{ padding: '4px 10px', minHeight: 'auto', fontSize: 11 }}
              >
                {detecting ? 'Detecting...' : 'Get from Chrome'}
              </button>
            </div>
            <div className="neu-inset" style={{ marginBottom: 8 }}>
              <input
                className="input-field"
                placeholder="Song title (e.g. Artist - Song Name)"
                value={tabTitle}
                onChange={e => setTabTitle(e.target.value)}
              />
            </div>
            <div className="neu-inset">
              <input
                className="input-field"
                placeholder="Source URL (optional)"
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                style={{ fontSize: 12 }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="label">Audio Device</label>
            <div className="neu-inset">
              <select
                className="input-field"
                value={selectedDevice ?? ''}
                onChange={e => setSelectedDevice(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">Default Loopback</option>
                {devices.map(d => (
                  <option key={d.index} value={d.index}>
                    {d.name} ({d.sample_rate} Hz)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button className="btn btn-primary btn-full" onClick={handleStart}>
            Start Recording
          </button>
        </>
      )}

      {(isRecording || isEncoding) && (
        <div className="neu-card" style={{ padding: 20 }}>
          {tabTitle && (
            <p style={{ fontSize: 12, color: 'var(--color-text-dim)', marginBottom: 8 }}>
              {tabTitle}
            </p>
          )}
          <div className="capture-status">
            <div className={`rec-dot ${paused ? 'paused' : ''}`} />
            <span>
              {isEncoding ? 'Encoding...' : paused ? 'Paused (Ad Skip)' : 'Recording'}
            </span>
          </div>

          <div className="capture-timer">{formatTimer(duration)}</div>

          {isRecording && (
            <div className="capture-actions">
              {paused ? (
                <button className="btn btn-primary" onClick={handleResume}>Resume</button>
              ) : (
                <button className="btn btn-tangerine" onClick={handlePause}>Pause (Ad)</button>
              )}
              <button className="btn btn-danger" onClick={handleStop}>Stop</button>
            </div>
          )}

          {isEncoding && (
            <p style={{ fontSize: 13, color: 'var(--color-text-dim)', marginTop: 8 }}>
              Converting to MP3 and analyzing...
            </p>
          )}
        </div>
      )}

      {isReview && (
        <div className="neu-card" style={{ padding: 20, borderLeft: '3px solid var(--color-tangerine)' }}>
          {tabTitle && (
            <p style={{ fontSize: 12, color: 'var(--color-text-dim)', marginBottom: 8 }}>
              {tabTitle}
            </p>
          )}
          <div className="capture-status">
            <div className="rec-dot paused" />
            <span>Recording Stopped</span>
          </div>
          <div className="capture-timer">{formatTimer(duration)}</div>
          <p style={{ fontSize: 13, color: 'var(--color-text-dim)', margin: '12px 0 16px' }}>
            Save this recording to your library?
          </p>
          <div className="capture-actions">
            <button className="btn btn-green" onClick={handleConfirm}>
              Save &amp; Analyze
            </button>
            <button className="btn btn-danger" onClick={handleDiscard}>
              Discard
            </button>
          </div>
        </div>
      )}

      {status === 'complete' && (
        <div className="neu-card" style={{ padding: 16, borderLeft: '3px solid var(--color-green)' }}>
          <p style={{ color: 'var(--color-green)' }}>Capture complete! Check your library.</p>
          <button
            className="btn btn-primary btn-full"
            style={{ marginTop: 12 }}
            onClick={() => { setStatus('idle'); setSessionId(null); setTabTitle(''); setSourceUrl(''); }}
          >
            New Capture
          </button>
        </div>
      )}

      {error && (
        <div className="neu-card" style={{ padding: 16, borderLeft: '3px solid var(--color-danger)', marginTop: 12 }}>
          <p style={{ color: 'var(--color-danger)', fontSize: 13 }}>{error}</p>
        </div>
      )}
    </div>
  );
}
