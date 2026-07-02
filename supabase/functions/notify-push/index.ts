// notify-push — Tangerine Timetree Web Push sender (S243 slice 2).
// The project's FIRST edge function. Deno / Supabase Edge Runtime (deno_version = 2).
//
// SECURITY: config.toml sets verify_jwt = false (JWT signing is disabled
// project-wide), so the ONLY guard is a mandatory constant-time X-Webhook-Secret
// check against PUSH_WEBHOOK_SECRET -> 401 on mismatch. Never rely on the gateway.
//
// Flow: (1) check secret; (2) parse body — either a pre-built push payload
// { title, body?, url?, tag?, user_ids? } OR a raw contact_submissions row
// (to_jsonb(NEW) from the notify_push_on_enquiry trigger), which is mapped to an
// enquiry notification; (3) a service-role client reads matching push_subscriptions
// (all rows, or scoped to user_ids); (4) send a VAPID-signed encrypted push to
// each endpoint; (5) prune rows whose endpoint returns 404/410; (6) always 200
// with a per-endpoint result summary (except 401 on a bad/missing secret).
//
// Secrets (supabase secrets set): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (both raw
// base64url — public = 65-byte uncompressed P-256 point, private = 32-byte
// scalar), VAPID_SUBJECT (mailto:), PUSH_WEBHOOK_SECRET. SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY are injected automatically by the platform.

import * as webpush from 'jsr:@negrel/webpush@0.5.0';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// ── base64url helpers (VAPID keys are stored raw base64url) ──────────────────
function b64urlToBytes(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64url(b: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Constant-time string compare (equal length). Differing lengths fail fast — the
// secret length is fixed, so that leaks nothing useful.
function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

// Build the { publicKey, privateKey } JsonWebKey pair @negrel/webpush wants from
// our raw base64url VAPID keys. Public point = 0x04 || X(32) || Y(32); private
// scalar d = the raw private key (already base64url). Minimal JWKs (no ext/key_ops)
// so importKey applies the requested usages without conflict.
function buildVapidJwks(pubB64url: string, privB64url: string): {
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
} {
  const pub = b64urlToBytes(pubB64url);
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error('VAPID_PUBLIC_KEY must be a 65-byte uncompressed P-256 point');
  }
  const x = bytesToB64url(pub.slice(1, 33));
  const y = bytesToB64url(pub.slice(33, 65));
  return {
    publicKey: { kty: 'EC', crv: 'P-256', x, y },
    privateKey: { kty: 'EC', crv: 'P-256', x, y, d: privB64url },
  };
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: JSON_HEADERS });
  }

  // ── 1. mandatory constant-time secret gate ────────────────────────────────
  const expected = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';
  const provided = req.headers.get('X-Webhook-Secret') ?? '';
  if (!expected || !timingSafeEqual(provided, expected)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: JSON_HEADERS });
  }

  // ── 2. parse + normalise the payload ──────────────────────────────────────
  let raw: Record<string, unknown>;
  try {
    raw = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400, headers: JSON_HEADERS });
  }

  const userIds = Array.isArray(raw.user_ids)
    ? (raw.user_ids as unknown[]).filter((v): v is string => typeof v === 'string')
    : null;

  let payload: { title: string; body?: string; url?: string; tag?: string };
  if (typeof raw.title === 'string') {
    // Pre-built push payload (direct test calls + future generic senders).
    payload = {
      title: raw.title,
      body: typeof raw.body === 'string' ? raw.body : undefined,
      url: typeof raw.url === 'string' ? raw.url : '/',
      tag: typeof raw.tag === 'string' ? raw.tag : undefined,
    };
  } else if (typeof raw.name === 'string') {
    // Raw contact_submissions row from the notify_push_on_enquiry trigger.
    const name = raw.name;
    const message = typeof raw.message === 'string' ? raw.message : '';
    payload = {
      title: `New booking enquiry: ${name}`,
      body: message.length > 140 ? `${message.slice(0, 137)}…` : message,
      url: '/',
      tag: typeof raw.id === 'string' ? `enquiry-${raw.id}` : 'enquiry',
    };
  } else {
    return new Response(JSON.stringify({ error: 'unrecognised_payload' }), { status: 400, headers: JSON_HEADERS });
  }

  // ── 3. init the VAPID sender + service-role client ────────────────────────
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:bookings@thegreentangerine.com';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!vapidPublic || !vapidPrivate || !supabaseUrl || !serviceKey) {
    console.error('notify-push: missing required env (VAPID_* / SUPABASE_*)');
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500, headers: JSON_HEADERS });
  }

  const vapidKeys = await webpush.importVapidKeys(
    buildVapidJwks(vapidPublic, vapidPrivate),
    { extractable: true },
  );
  const appServer = await webpush.ApplicationServer.new({
    contactInformation: vapidSubject,
    vapidKeys,
  });

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // ── 4. read target subscriptions (service role bypasses RLS) ──────────────
  const base = supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth');
  const { data: subs, error: readErr } =
    userIds && userIds.length > 0 ? await base.in('user_id', userIds) : await base;
  if (readErr) {
    console.error('notify-push: subscription read failed', readErr.message);
    return new Response(JSON.stringify({ error: 'subscription_read_failed' }), { status: 500, headers: JSON_HEADERS });
  }

  const rows = subs ?? [];
  const message = JSON.stringify(payload);
  const results: Array<{ endpoint: string; ok: boolean; status?: number; pruned?: boolean }> = [];
  let sent = 0;
  let failed = 0;
  let pruned = 0;

  // ── 5. fan out; prune dead endpoints (404/410) ────────────────────────────
  for (const row of rows) {
    const endpoint = row.endpoint as string;
    try {
      const subscriber = appServer.subscribe(
        { endpoint, keys: { p256dh: row.p256dh as string, auth: row.auth as string } } as unknown as Parameters<
          typeof appServer.subscribe
        >[0],
      );
      await subscriber.pushTextMessage(message, {});
      sent++;
      results.push({ endpoint, ok: true });
    } catch (err) {
      failed++;
      const status = err instanceof webpush.PushMessageError ? err.response.status : undefined;
      const gone = err instanceof webpush.PushMessageError && (err.isGone() || status === 404);
      if (gone) {
        const { error: delErr } = await supabase.from('push_subscriptions').delete().eq('id', row.id);
        if (!delErr) pruned++;
      }
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`notify-push: send failed (${status ?? 'n/a'}) ${endpoint.slice(0, 60)} — ${msg}`);
      results.push({ endpoint, ok: false, status, pruned: gone });
    }
  }

  console.log(`notify-push: sent=${sent} failed=${failed} pruned=${pruned} total=${rows.length}`);
  return new Response(JSON.stringify({ sent, failed, pruned, total: rows.length, results }), {
    status: 200,
    headers: JSON_HEADERS,
  });
});
