/**
 * XR18Studio Phone Director protocol — TypeScript client types.
 * Matches the C# server protocol exactly (camelCase JSON).
 */

// ── Message types ──

export type PhoneMessageType =
  | 'pair' | 'pairAck' | 'pairReject'
  | 'status' | 'heartbeat' | 'heartbeatAck'
  | 'startRec' | 'stopRec' | 'settingsPush'
  | 'recStarted' | 'recStopped' | 'settingsAck'
  | 'syncTimeRequest' | 'syncTimeResponse'
  | 'cameraPreview'
  | 'previewRequest' | 'previewStart' | 'previewStop'
  | 'syncPulse' | 'syncPulseAck' | 'qualityWarning'
  | 'songChanged';

// ── Message envelope ──

export interface PhoneMessage {
  type: PhoneMessageType;
  phoneId?: string | null;
  timestampMs: number;
  payload?: string | null;
  secret?: string | null;
}

// ── Payload types ──

export interface PairPayload {
  deviceModel: string;
  platform: string;
  name: string;
}

export interface StatusPayload {
  battery: number;
  storageFree: number;
  resolution: string;
  framerate: number;
  sampleRate: string;
  isRecording: boolean;
  actualFramerate: number;
  isConstantFrameRate: boolean;
}

export interface SyncTimePayload {
  t1: number;
  t2: number;
  t3: number;
}

export interface PhoneSettings {
  resolution: string;
  framerate: number;
  exposure: string;
  stabilisation: string;
  cameraFacing: string;  // "back" or "front"
}

export interface StartRecPayload {
  sessionName: string;
  timestamp: number;
  sessionId: string;
  gigId?: string;
  venueName?: string;
  gigDate?: string;
}

export interface SongChangedPayload {
  songId: string;
  songName: string;
  artist: string;
  bpm: number;
}

export interface SyncPulsePayload {
  serverTimestampMs: number;
  sessionId: string;
}

export interface QualityWarningPayload {
  warning: string;
  actualFramerate: number;
  requestedFramerate: number;
  isConstantFrameRate: boolean;
}

// ── QR pairing URI ──

export interface PairingInfo {
  ips: string[];
  ip: string;
  tcpPort: number;
  wsPort: number;
  secret: string;
}

/** Parse QR URI: xr18studio://<ip1,ip2,...>:<tcpPort>/<wsPort>/<secret> */
export function parsePairingUri(uri: string): PairingInfo | null {
  const prefix = 'xr18studio://';
  if (!uri.startsWith(prefix)) return null;
  const rest = uri.slice(prefix.length);
  const parts = rest.split('/');
  if (parts.length < 3) return null;
  const hostPort = parts[0].split(':');
  if (hostPort.length !== 2) return null;
  const ips = hostPort[0].split(',').filter(s => s.length > 0);
  if (ips.length === 0) return null;
  const tcpPort = parseInt(hostPort[1], 10);
  const wsPort = parseInt(parts[1], 10);
  if (isNaN(tcpPort) || isNaN(wsPort)) return null;
  return { ips, ip: ips[0], tcpPort, wsPort, secret: parts[2] };
}

/** Create a message envelope. */
export function createMessage(
  type: PhoneMessageType,
  phoneId?: string | null,
  payload?: string | null,
  secret?: string | null,
): PhoneMessage {
  return { type, phoneId: phoneId ?? undefined, timestampMs: Date.now(), payload: payload ?? undefined, secret: secret ?? undefined };
}

/** Serialize an object to a JSON payload string. */
export function serializePayload<T>(obj: T): string {
  return JSON.stringify(obj);
}

/** Deserialize a JSON payload string. */
export function deserializePayload<T>(json: string | null | undefined): T | null {
  if (!json) return null;
  try { return JSON.parse(json) as T; }
  catch { return null; }
}

// ── Supabase Relay Config ──

export const SUPABASE_REALTIME_URL = 'wss://jlufqgslgjowfaqmqlds.supabase.co/realtime/v1/websocket';
export const SUPABASE_ANON_KEY = 'sb_publishable_JwBPIqMBRavKV326-3oc9w_62AsevO1';

/** Build the relay channel topic from a pairing secret. */
export function getRelayChannelTopic(secret: string): string {
  return `xr18-relay:${secret}`;
}

/** Build the full Supabase Realtime WebSocket URL. */
export function getRealtimeUrl(): string {
  return `${SUPABASE_REALTIME_URL}?apikey=${SUPABASE_ANON_KEY}&vsn=1.0.0`;
}
