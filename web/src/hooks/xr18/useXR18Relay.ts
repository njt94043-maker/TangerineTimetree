import { useRef, useState, useCallback, useEffect } from 'react';
import {
  type PhoneMessage,
  getRelayChannelTopic, getRealtimeUrl,
} from './protocol';

/**
 * Supabase Broadcast relay transport for XR18 Studio.
 * Connects to Supabase Realtime WebSocket, joins a broadcast channel
 * keyed by the pairing secret, and sends/receives PhoneMessages.
 *
 * Uses the same Phoenix WebSocket protocol as the C# SupabaseBroadcastServer.
 */
export function useXR18Relay() {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelTopicRef = useRef('');
  const refCounterRef = useRef(0);
  const joinedRef = useRef(false);
  const onMessageRef = useRef<((msg: PhoneMessage) => void) | null>(null);
  const onDisconnectRef = useRef<(() => void) | null>(null);

  const nextRef = () => String(++refCounterRef.current);

  const handleFrame = useCallback((json: string) => {
    try {
      const frame = JSON.parse(json);
      const event = frame.event;

      switch (event) {
        case 'phx_reply': {
          const status = frame.payload?.status;
          const topic = frame.topic;
          if (topic === channelTopicRef.current && status === 'ok' && !joinedRef.current) {
            joinedRef.current = true;
          }
          break;
        }

        case 'broadcast': {
          const broadcastEvent = frame.payload?.event;
          if (broadcastEvent !== 'phone_msg') return;
          const innerPayload = frame.payload?.payload;
          if (!innerPayload) return;
          const msg = innerPayload as PhoneMessage;
          if (msg.type) {
            onMessageRef.current?.(msg);
          }
          break;
        }
      }
    } catch { /* bad JSON */ }
  }, []);

  const handleDisconnect = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    joinedRef.current = false;
    setIsConnected(false);
    onDisconnectRef.current?.();
  }, []);

  const disconnect = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    joinedRef.current = false;

    const ws = wsRef.current;
    if (ws) {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            topic: channelTopicRef.current,
            event: 'phx_leave',
            payload: {},
            ref: nextRef(),
          }));
        }
        ws.close(1000, 'Client disconnect');
      } catch { /* ignore */ }
      wsRef.current = null;
    }

    if (isConnected) {
      setIsConnected(false);
    }
  }, [isConnected]);

  const send = useCallback((message: PhoneMessage) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const broadcast = {
      topic: channelTopicRef.current,
      event: 'broadcast',
      payload: {
        type: 'broadcast',
        event: 'phone_msg',
        payload: message,
      },
      ref: nextRef(),
    };
    ws.send(JSON.stringify(broadcast));
  }, []);

  const connect = useCallback((secret: string) => {
    disconnect();

    channelTopicRef.current = getRelayChannelTopic(secret);
    joinedRef.current = false;
    refCounterRef.current = 0;

    const ws = new WebSocket(getRealtimeUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);

      // Send Phoenix join
      ws.send(JSON.stringify({
        topic: channelTopicRef.current,
        event: 'phx_join',
        payload: {
          config: {
            broadcast: { self: false },
          },
        },
        ref: nextRef(),
      }));

      // Start heartbeat (30s)
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            topic: 'phoenix',
            event: 'heartbeat',
            payload: {},
            ref: nextRef(),
          }));
        }
      }, 30_000);
    };

    ws.onmessage = (event) => {
      handleFrame(event.data as string);
    };

    ws.onerror = () => {
      handleDisconnect();
    };

    ws.onclose = () => {
      handleDisconnect();
    };
  }, [disconnect, handleDisconnect, handleFrame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { disconnect(); };
  }, [disconnect]);

  return {
    isConnected,
    connect,
    disconnect,
    send,
    onMessageRef,
    onDisconnectRef,
  };
}
