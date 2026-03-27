import { useState, useEffect, useRef } from 'react';
import { useXR18Connection, type ConnectionState } from '../hooks/xr18/useXR18Connection';
import { useXR18Camera } from '../hooks/xr18/useXR18Camera';
import { useQrScanner } from '../hooks/xr18/useQrScanner';
import { type PairingInfo } from '../hooks/xr18/protocol';

/**
 * XR18 Camera Companion — full-screen camera view that connects to XR18Studio
 * via WebSocket for synchronized multi-camera video recording.
 */
export function XR18Camera() {
  const {
    videoRef, cameraStream, isRecording,
    startCamera, startRecording, stopRecording,
    capturePreviewFrame, applySettings, stopCamera,
  } = useXR18Camera();

  const {
    connectionState, phoneId, lastError, currentSettings,
    connect, disconnect,
  } = useXR18Connection({
    onStartRecording: () => startRecording(),
    onStopRecording: () => stopRecording(),
    onSettingsChanged: (s) => applySettings(s),
    capturePreviewFrame,
  });

  const { isSupported: qrSupported, scannedResult, startScanning, stopScanning } = useQrScanner();

  // Manual entry
  const [showManual, setShowManual] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [manualPort, setManualPort] = useState('8731');
  const [manualSecret, setManualSecret] = useState('');
  const [recElapsed, setRecElapsed] = useState(0);
  const recStartRef = useRef(0);

  // Start camera on mount
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  // Start QR scanning when camera is ready and disconnected
  useEffect(() => {
    if (qrSupported && videoRef.current && cameraStream && connectionState === 'disconnected') {
      startScanning(videoRef.current);
    }
    return () => stopScanning();
  }, [qrSupported, cameraStream, connectionState]);

  // Auto-connect when QR scanned
  useEffect(() => {
    if (scannedResult) {
      connect(scannedResult);
    }
  }, [scannedResult]);

  // Recording elapsed timer
  useEffect(() => {
    if (isRecording) {
      recStartRef.current = Date.now();
      const interval = setInterval(() => {
        setRecElapsed(Math.floor((Date.now() - recStartRef.current) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setRecElapsed(0);
    }
  }, [isRecording]);

  const handleManualConnect = () => {
    const wsPort = parseInt(manualPort, 10) || 8731;
    const info: PairingInfo = { ip: manualIp, tcpPort: wsPort - 1, wsPort, secret: manualSecret };
    connect(info);
  };

  const fmtTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const stateColor = (s: ConnectionState) => {
    switch (s) {
      case 'disconnected': return '#4a4a60';
      case 'connecting': case 'pairing': return '#f39c12';
      case 'connected': return '#00e676';
      case 'recording': return '#ff5252';
      case 'error': return '#ff5252';
    }
  };

  const stateLabel = (s: ConnectionState) => {
    switch (s) {
      case 'disconnected': return 'Disconnected';
      case 'connecting': return 'Connecting…';
      case 'pairing': return 'Pairing…';
      case 'connected': return 'Connected';
      case 'recording': return 'REC';
      case 'error': return 'Error';
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#08080c', overflow: 'hidden' }}>
      {/* Full-screen video preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* Top status bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '12px 16px',
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>XR18 Camera</span>
        <span style={{ flex: 1 }} />
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: stateColor(connectionState), display: 'inline-block',
        }} />
        <span style={{ color: '#fff', fontSize: 12 }}>{stateLabel(connectionState)}</span>
      </div>

      {/* Recording overlay */}
      {isRecording && (
        <div style={{
          position: 'absolute', top: 52, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(255,50,50,0.85)', borderRadius: 20,
          padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff', display: 'inline-block' }} />
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 14, fontFamily: 'monospace' }}>
            REC {fmtTime(recElapsed)}
          </span>
        </div>
      )}

      {/* Bottom panel */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(0,0,0,0.75)',
        borderRadius: '16px 16px 0 0',
        padding: 16,
      }}>
        {(connectionState === 'disconnected' || connectionState === 'error') && (
          <>
            {lastError && (
              <div style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 8 }}>⚠ {lastError}</div>
            )}
            <div style={{ color: '#fff', fontWeight: 700, marginBottom: 4 }}>
              {qrSupported ? 'Scan QR code from XR18 Studio' : 'Enter connection details'}
            </div>
            <div style={{ color: '#7a7a94', fontSize: 12, marginBottom: 12 }}>
              {qrSupported ? 'Point camera at QR code on the PHONES tab' : 'BarcodeDetector not supported — enter manually'}
            </div>

            <button
              onClick={() => setShowManual(!showManual)}
              style={{
                background: 'none', border: 'none', color: '#f39c12',
                cursor: 'pointer', padding: 0, marginBottom: 8, fontSize: 13,
              }}
            >
              {showManual ? 'Hide manual entry' : 'Enter manually instead'}
            </button>

            {showManual && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    placeholder="IP Address"
                    value={manualIp}
                    onChange={e => setManualIp(e.target.value)}
                    style={inputStyle}
                  />
                  <input
                    placeholder="WS Port"
                    value={manualPort}
                    onChange={e => setManualPort(e.target.value)}
                    style={{ ...inputStyle, width: 80 }}
                    type="number"
                  />
                </div>
                <input
                  placeholder="Secret"
                  value={manualSecret}
                  onChange={e => setManualSecret(e.target.value)}
                  style={inputStyle}
                />
                <button
                  onClick={handleManualConnect}
                  style={{
                    background: '#f39c12', color: '#000', border: 'none',
                    borderRadius: 8, padding: '12px 0', fontWeight: 700,
                    cursor: 'pointer', fontSize: 14,
                  }}
                >
                  Connect
                </button>
              </div>
            )}
          </>
        )}

        {(connectionState === 'connected' || connectionState === 'recording') && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#00e676', fontWeight: 700 }}>Connected to XR18 Studio</div>
              <div style={{ color: '#7a7a94', fontSize: 12 }}>ID: {phoneId ?? '—'}</div>
              <div style={{ color: '#7a7a94', fontSize: 12 }}>
                {currentSettings.resolution} @ {currentSettings.framerate}fps
              </div>
            </div>
            <button
              onClick={disconnect}
              style={{
                background: 'transparent', border: '1px solid #ff5252', color: '#ff5252',
                borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13,
              }}
            >
              Disconnect
            </button>
          </div>
        )}

        {(connectionState === 'connecting' || connectionState === 'pairing') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#fff' }}>
            <div style={{ width: 20, height: 20, border: '2px solid #f39c12', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span>{connectionState === 'connecting' ? 'Connecting…' : 'Pairing…'}</span>
          </div>
        )}

        {isRecording && (
          <div style={{ color: '#f39c12', fontSize: 12, marginTop: 8 }}>
            Recording controlled by XR18 Studio
          </div>
        )}
      </div>

      {/* Spinner animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: '#111118',
  border: '1px solid #4a4a60',
  borderRadius: 8,
  color: '#fff',
  padding: '10px 12px',
  fontSize: 14,
  outline: 'none',
};
