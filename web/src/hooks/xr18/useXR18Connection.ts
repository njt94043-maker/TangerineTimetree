import { useRef, useState, useCallback, useEffect } from 'react';
import {
  type PhoneMessage, type PairingInfo, type PhoneSettings, type SyncTimePayload, type StartRecPayload,
  createMessage, serializePayload, deserializePayload,
} from './protocol';

export type ConnectionState = 'disconnected' | 'connecting' | 'pairing' | 'connected' | 'recording' | 'error';

interface UseXR18ConnectionOptions {
  /** Called when server sends StartRec */
  onStartRecording?: (sessionName: string) => void;
  /** Called when server sends StopRec */
  onStopRecording?: () => void;
  /** Called when server pushes new settings */
  onSettingsChanged?: (settings: PhoneSettings) => void;
  /** Returns a base64 JPEG preview frame, or null */
  capturePreviewFrame?: () => string | null;
}

export function useXR18Connection(opts: UseXR18ConnectionOptions = {}) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [phoneId, setPhoneId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [currentSettings, setCurrentSettings] = useState<PhoneSettings>({
    resolution: '1080p', framerate: 30, exposure: 'Auto', stabilisation: 'Off',
  });

  const wsRef = useRef<WebSocket | null>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(1000);
  const intentionalRef = useRef(false);
  const pairingRef = useRef<PairingInfo | null>(null);
  const phoneIdRef = useRef<string | null>(null);
  const stateRef = useRef<ConnectionState>('disconnected');
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const sendMessage = useCallback((msg: PhoneMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const handleMessage = useCallback((msg: PhoneMessage) => {
    switch (msg.type) {
      case 'pairAck': {
        const id = msg.phoneId ?? null;
        setPhoneId(id);
        phoneIdRef.current = id;
        setConnectionState('connected');
        stateRef.current = 'connected';
        backoffRef.current = 1000;
        startStatusSender();
        startPreviewSender();
        break;
      }
      case 'pairReject':
        setLastError('Pairing rejected — invalid secret');
        setConnectionState('error');
        stateRef.current = 'error';
        wsRef.current?.close();
        break;

      case 'heartbeat':
        sendMessage(createMessage('heartbeatAck', phoneIdRef.current));
        break;

      case 'syncTimeRequest': {
        const t2 = Date.now();
        const syncPayload = deserializePayload<SyncTimePayload>(msg.payload);
        const t1 = syncPayload?.t1 ?? 0;
        const t3 = Date.now();
        sendMessage(createMessage('syncTimeResponse', phoneIdRef.current,
          serializePayload({ t1, t2, t3 })));
        break;
      }

      case 'startRec': {
        const recPayload = deserializePayload<StartRecPayload>(msg.payload);
        setConnectionState('recording');
        stateRef.current = 'recording';
        optsRef.current.onStartRecording?.(recPayload?.sessionName ?? 'recording');
        sendMessage(createMessage('recStarted', phoneIdRef.current));
        break;
      }

      case 'stopRec':
        optsRef.current.onStopRecording?.();
        setConnectionState('connected');
        stateRef.current = 'connected';
        sendMessage(createMessage('recStopped', phoneIdRef.current));
        break;

      case 'settingsPush': {
        const settings = deserializePayload<PhoneSettings>(msg.payload);
        if (settings) {
          setCurrentSettings(settings);
          optsRef.current.onSettingsChanged?.(settings);
        }
        sendMessage(createMessage('settingsAck', phoneIdRef.current));
        break;
      }
    }
  }, [sendMessage]);

  const startStatusSender = useCallback(() => {
    if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    statusIntervalRef.current = setInterval(async () => {
      let battery = 0;
      let storageFree = 0;
      try {
        const bm = await (navigator as any).getBattery?.();
        if (bm) battery = Math.round(bm.level * 100);
      } catch { /* unsupported */ }
      try {
        const est = await navigator.storage?.estimate?.();
        if (est) storageFree = (est.quota ?? 0) - (est.usage ?? 0);
      } catch { /* unsupported */ }
      sendMessage(createMessage('status', phoneIdRef.current, serializePayload({
        battery, storageFree,
        resolution: '1080p', framerate: 30, sampleRate: '48000',
        isRecording: stateRef.current === 'recording',
      })));
    }, 10_000);
  }, [sendMessage]);

  const startPreviewSender = useCallback(() => {
    if (previewIntervalRef.current) clearInterval(previewIntervalRef.current);
    previewIntervalRef.current = setInterval(() => {
      if (stateRef.current === 'recording') return; // less frequent during recording
      const frame = optsRef.current.capturePreviewFrame?.();
      if (frame) {
        sendMessage(createMessage('cameraPreview', phoneIdRef.current, frame));
      }
    }, 2000);
  }, [sendMessage]);

  const connect = useCallback((info: PairingInfo) => {
    pairingRef.current = info;
    intentionalRef.current = false;
    setLastError(null);
    setConnectionState('connecting');
    stateRef.current = 'connecting';

    const ws = new WebSocket(`ws://${info.ip}:${info.wsPort}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionState('pairing');
      stateRef.current = 'pairing';
      const pairPayload = serializePayload({
        deviceModel: navigator.userAgent.slice(0, 50),
        platform: 'Web',
        name: 'Camera',
      });
      sendMessage(createMessage('pair', null, pairPayload, info.secret));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as PhoneMessage;
        handleMessage(msg);
      } catch { /* bad JSON, ignore */ }
    };

    ws.onerror = () => {
      setLastError('WebSocket connection error');
      setConnectionState('error');
      stateRef.current = 'error';
    };

    ws.onclose = () => {
      cleanup();
      if (!intentionalRef.current) {
        setConnectionState('error');
        stateRef.current = 'error';
        setLastError('Connection lost');
        scheduleReconnect();
      } else {
        setConnectionState('disconnected');
        stateRef.current = 'disconnected';
      }
    };
  }, [sendMessage, handleMessage, startStatusSender, startPreviewSender]);

  const disconnect = useCallback(() => {
    intentionalRef.current = true;
    cleanup();
    wsRef.current?.close();
    wsRef.current = null;
    setConnectionState('disconnected');
    stateRef.current = 'disconnected';
    setPhoneId(null);
    phoneIdRef.current = null;
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (intentionalRef.current || !pairingRef.current) return;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(() => {
      if (pairingRef.current && !intentionalRef.current) {
        backoffRef.current = Math.min(backoffRef.current * 2, 30_000);
        connect(pairingRef.current);
      }
    }, backoffRef.current);
  }, [connect]);

  const cleanup = useCallback(() => {
    if (statusIntervalRef.current) { clearInterval(statusIntervalRef.current); statusIntervalRef.current = null; }
    if (previewIntervalRef.current) { clearInterval(previewIntervalRef.current); previewIntervalRef.current = null; }
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intentionalRef.current = true;
      cleanup();
      wsRef.current?.close();
    };
  }, [cleanup]);

  return { connectionState, phoneId, lastError, currentSettings, connect, disconnect, sendMessage };
}
