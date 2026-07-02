// VAPID application-server PUBLIC key for Web Push (S243 slice 2).
// Public key only — safe to ship in the client bundle even though the repo is
// public. The matching private key lives server-side (supabase secrets / Vault)
// and never leaves the notify-push edge function. Provisioned by the Architect.
export const VAPID_PUBLIC_KEY =
  'BAEET7RhIQS0njmcdDB_oFn8tfPTfRBuqLzj-AE5FV8UmF8PDK4YIKyUpvV25E_VQIf6ZGfC4yCW_mM3xRCv_Q8';

// pushManager.subscribe() needs applicationServerKey as a BufferSource, NOT the
// base64url string — passing the raw string silently fails subscribe(). Decode
// the url-safe base64 VAPID public key to the 65-byte uncompressed P-256 point.
// Return an ArrayBuffer-backed Uint8Array so it satisfies DOM `BufferSource`
// (TS 5.7+ distinguishes Uint8Array<ArrayBuffer> from <SharedArrayBuffer>).
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}
