import { useRef, useState, useCallback, useEffect } from 'react';
import {
  type PhoneMessage, type PairingInfo, type PhoneSettings, type SyncTimePayload,
  type StartRecPayload, type SyncPulsePayload, type SongChangedPayload,
  createMessage, serializePayload, deserializePayload,
  getRelayChannelTopic, getRealtimeUrl,
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
  /** S41: Called when Studio relays a SongChanged message from APK (drummer selected a song) */
  onSongChanged?: (payload: SongChangedPayload) => void;
}

/** Flash screen white and play a 1kHz beep — sync cue for multi-camera alignment. */
function executeSyncPulse(): number {
  const timestamp = Date.now();

  // Flash screen white for 66ms
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:white;z-index:99999;pointer-events:none';
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 66);

  // Play 1kHz beep for 100ms
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 1000;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 1.0;
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
    setTimeout(() => ctx.close(), 200);
  } catch { /* AudioContext may not be available */ }

  return timestamp;
}

export function useXR18Connection(opts: UseXR18ConnectionOptions = {}) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [phoneId, setPhoneId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [currentSettings, setCurrentSettings] = useState<PhoneSettings>({
    resolution: '1080p', framerate: 30, exposure: 'Auto', stabilisation: 'Off', cameraFacing: 'back',
  });
  const [wsConnected, setWsConnected] = useState(false);
  const [relayConnected, setRelayConnected] = useState(false);

  // WebSocket (direct) transport
  const wsRef = useRef<WebSocket | null>(null);
  // Supabase relay transport
  const relayWsRef = useRef<WebSocket | null>(null);
  const relayHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const relayRefCounter = useRef(0);
  const relayChannelRef = useRef('');
  const relayJoinedRef = useRef(false);

  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const livePreviewEnabledRef = useRef(true);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(1000);
  const intentionalRef = useRef(false);
  const pairingRef = useRef<PairingInfo | null>(null);
  const phoneIdRef = useRef<string | null>(null);
  const stateRef = useRef<ConnectionState>('disconnected');
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; });
  const connectRef = useRef<(info: PairingInfo) => void>(() => {});
  const tryConnectIpRef = useRef<(ip: string, info: PairingInfo) => void>(() => {});

  const nextRelayRef = () => String(++relayRefCounter.current);

  /** Send via best available transport: WS direct first, relay fallback. */
  const sendMessage = useCallback((msg: PhoneMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return;
    }
    // Fallback to relay
    const relay = relayWsRef.current;
    if (relay && relay.readyState === WebSocket.OPEN) {
      relay.send(JSON.stringify({
        topic: relayChannelRef.current,
        event: 'broadcast',
        payload: {
          type: 'broadcast',
          event: 'phone_msg',
          payload: msg,
        },
        ref: nextRelayRef(),
      }));
    }
  }, []);

  const cleanup = useCallback(() => {
    if (statusIntervalRef.current) { clearInterval(statusIntervalRef.current); statusIntervalRef.current = null; }
    if (previewIntervalRef.current) { clearInterval(previewIntervalRef.current); previewIntervalRef.current = null; }
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
  }, []);

  const cleanupRelay = useCallback(() => {
    if (relayHeartbeatRef.current) {
      clearInterval(relayHeartbeatRef.current);
      relayHeartbeatRef.current = null;
    }
    relayJoinedRef.current = false;
    setRelayConnected(false);
  }, []);

  const startStatusSender = useCallback(() => {
    if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    statusIntervalRef.current = setInterval(async () => {
      let battery = 0;
      let storageFree = 0;
      try {
        const bm = await (navigator as unknown as { getBattery?: () => Promise<{ level: number }> }).getBattery?.();
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
        actualFramerate: 30,  // Web can't easily measure this
        isConstantFrameRate: true,
      })));
    }, 10_000);
  }, [sendMessage]);

  const startPreviewSender = useCallback(() => {
    if (previewIntervalRef.current) clearInterval(previewIntervalRef.current);
    previewIntervalRef.current = setInterval(() => {
      if (!livePreviewEnabledRef.current) return;
      if (stateRef.current === 'recording') return;
      const frame = optsRef.current.capturePreviewFrame?.();
      if (frame) {
        sendMessage(createMessage('cameraPreview', phoneIdRef.current, frame));
      }
    }, 2000);
  }, [sendMessage]);

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

      case 'syncPulse': {
        const pulsePayload = deserializePayload<SyncPulsePayload>(msg.payload);
        void pulsePayload; // acknowledged but session ID not needed client-side
        const executedAt = executeSyncPulse();
        sendMessage(createMessage('syncPulseAck', phoneIdRef.current,
          serializePayload({ executedAtMs: executedAt })));
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

      case 'previewRequest': {
        // Server requests a single preview frame
        const frame = optsRef.current.capturePreviewFrame?.();
        if (frame) {
          sendMessage(createMessage('cameraPreview', phoneIdRef.current, frame));
        }
        break;
      }

      case 'previewStart':
        livePreviewEnabledRef.current = true;
        break;

      case 'previewStop':
        livePreviewEnabledRef.current = false;
        break;

      case 'songChanged': {
        // S41: Studio relayed a songChanged from the APK — update prompter display
        const songPayload = deserializePayload<SongChangedPayload>(msg.payload);
        if (songPayload) {
          optsRef.current.onSongChanged?.(songPayload);
        }
        break;
      }
    }
  }, [sendMessage, startStatusSender, startPreviewSender]);

  /** Connect relay (Supabase Broadcast) as a fallback transport. */
  const connectRelay = useCallback((secret: string) => {
    relayChannelRef.current = getRelayChannelTopic(secret);
    relayJoinedRef.current = false;
    relayRefCounter.current = 0;

    const ws = new WebSocket(getRealtimeUrl());
    relayWsRef.current = ws;

    ws.onopen = () => {
      setRelayConnected(true);

      // Phoenix join
      ws.send(JSON.stringify({
        topic: relayChannelRef.current,
        event: 'phx_join',
        payload: { config: { broadcast: { self: false } } },
        ref: nextRelayRef(),
      }));

      // Heartbeat
      relayHeartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            topic: 'phoenix',
            event: 'heartbeat',
            payload: {},
            ref: nextRelayRef(),
          }));
        }
      }, 30_000);
    };

    ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data as string);
        const evt = frame.event;
        if (evt === 'phx_reply') {
          if (frame.topic === relayChannelRef.current && frame.payload?.status === 'ok') {
            relayJoinedRef.current = true;
          }
        } else if (evt === 'broadcast') {
          if (frame.payload?.event === 'phone_msg' && frame.payload?.payload) {
            handleMessage(frame.payload.payload as PhoneMessage);
          }
        }
      } catch { /* bad JSON */ }
    };

    ws.onerror = () => { cleanupRelay(); };
    ws.onclose = () => { cleanupRelay(); };
  }, [handleMessage, cleanupRelay]);

  const scheduleReconnect = useCallback(() => {
    if (intentionalRef.current || !pairingRef.current) return;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(() => {
      if (pairingRef.current && !intentionalRef.current) {
        backoffRef.current = Math.min(backoffRef.current * 2, 30_000);
        connectRef.current(pairingRef.current);
      }
    }, backoffRef.current);
  }, []);

  const tryConnectIp = useCallback((ip: string, info: PairingInfo) => {
    const ws = new WebSocket(`ws://${ip}:${info.wsPort}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
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
      // Try next IP if available
      const idx = info.ips.indexOf(ip);
      if (idx >= 0 && idx < info.ips.length - 1) {
        tryConnectIpRef.current(info.ips[idx + 1], info);
      } else {
        // All IPs failed — try relay-only connection
        setWsConnected(false);
        if (relayWsRef.current?.readyState === WebSocket.OPEN) {
          // Relay is already connected, pair via relay
          setConnectionState('pairing');
          stateRef.current = 'pairing';
          const pairPayload = serializePayload({
            deviceModel: navigator.userAgent.slice(0, 50),
            platform: 'Web',
            name: 'Camera',
          });
          sendMessage(createMessage('pair', null, pairPayload, info.secret));
        } else {
          setLastError('No connection — WebSocket and relay both failed');
          setConnectionState('error');
          stateRef.current = 'error';
        }
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      cleanup();
      if (!intentionalRef.current) {
        // If relay is still alive, keep going
        if (relayWsRef.current?.readyState === WebSocket.OPEN) return;
        setConnectionState('error');
        stateRef.current = 'error';
        setLastError('Connection lost');
        scheduleReconnect();
      } else {
        setConnectionState('disconnected');
        stateRef.current = 'disconnected';
      }
    };
  }, [sendMessage, handleMessage, cleanup, scheduleReconnect]);

  useEffect(() => { tryConnectIpRef.current = tryConnectIp; }, [tryConnectIp]);

  const connect = useCallback((info: PairingInfo) => {
    pairingRef.current = info;
    intentionalRef.current = false;
    setLastError(null);
    setConnectionState('connecting');
    stateRef.current = 'connecting';

    // Start relay in background (always available as fallback)
    connectRelay(info.secret);

    // Try direct WebSocket connection
    tryConnectIp(info.ips[0], info);
  }, [tryConnectIp, connectRelay]);

  useEffect(() => { connectRef.current = connect; }, [connect]);

  const disconnect = useCallback(() => {
    intentionalRef.current = true;
    cleanup();
    wsRef.current?.close();
    wsRef.current = null;
    setWsConnected(false);
    // Disconnect relay too
    if (relayWsRef.current) {
      try {
        if (relayWsRef.current.readyState === WebSocket.OPEN) {
          relayWsRef.current.send(JSON.stringify({
            topic: relayChannelRef.current,
            event: 'phx_leave',
            payload: {},
            ref: nextRelayRef(),
          }));
        }
        relayWsRef.current.close();
      } catch { /* ignore */ }
      relayWsRef.current = null;
    }
    cleanupRelay();
    setConnectionState('disconnected');
    stateRef.current = 'disconnected';
    setPhoneId(null);
    phoneIdRef.current = null;
  }, [cleanup, cleanupRelay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intentionalRef.current = true;
      cleanup();
      wsRef.current?.close();
      relayWsRef.current?.close();
      cleanupRelay();
    };
  }, [cleanup, cleanupRelay]);

  return {
    connectionState, phoneId, lastError, currentSettings,
    wsConnected, relayConnected,
    connect, disconnect, sendMessage,
  };
}
