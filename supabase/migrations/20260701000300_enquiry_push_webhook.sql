-- =============================================================================
-- S243 slice 2 — fire the notify-push edge function on each new enquiry.
--
-- Best-effort Web Push layer ON TOP OF the guaranteed in-app fan-out (slice-1a's
-- notify_on_enquiry). A SEPARATE AFTER-INSERT trigger + SECURITY DEFINER function
-- (NOT an edit to notify_on_enquiry) keeps the two concerns independent, and the
-- net.http_post call is wrapped in an exception guard so a push/webhook failure
-- can NEVER abort the enquiry insert or the transactional in-app rows
-- (decision 3: log, never block the enquiry insert).
--
-- HOW: pg_net's net.http_post enqueues the request asynchronously (it returns a
-- request id; a background worker sends it), so it does not block the inserting
-- transaction. The X-Webhook-Secret is read from Vault (vault.decrypted_secrets,
-- name 'PUSH_WEBHOOK_SECRET') — the SAME secret the edge fn checks constant-time.
--
-- DEPLOY ORDER (Architect applies this LAST, AFTER):
--   1. supabase secrets set VAPID_* PUSH_WEBHOOK_SECRET VAPID_SUBJECT
--   2. supabase functions deploy notify-push
--   3. vault.create_secret('<value>', 'PUSH_WEBHOOK_SECRET') in the live DB
-- Apply via Management API `database/query`, NOT `supabase db push`. Prod-DB
-- write — needs Nathan-approval past the classifier.
--
-- Applied via Management API S243: <record date on apply>.
-- =============================================================================
BEGIN;

-- pg_net provides net.http_post (async HTTP from Postgres). Idempotent; on
-- Supabase it is typically already available on the project.
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_push_on_enquiry()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_secret text;
BEGIN
  -- Best-effort: never let a webhook problem abort the enquiry insert / 1a rows.
  BEGIN
    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'PUSH_WEBHOOK_SECRET'
    LIMIT 1;

    IF v_secret IS NULL THEN
      RAISE WARNING 'notify_push_on_enquiry: PUSH_WEBHOOK_SECRET not in vault; skipping push';
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url     := 'https://jlufqgslgjowfaqmqlds.supabase.co/functions/v1/notify-push',
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'X-Webhook-Secret', v_secret
                 ),
      body    := to_jsonb(NEW)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_push_on_enquiry: push webhook failed (%): %', SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Clients must never call this directly (mirrors notify_on_enquiry).
REVOKE EXECUTE ON FUNCTION public.notify_push_on_enquiry() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS contact_submissions_notify_push ON public.contact_submissions;
CREATE TRIGGER contact_submissions_notify_push
  AFTER INSERT ON public.contact_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_on_enquiry();

COMMIT;

-- =============================================================================
-- VERIFY (live):
--   (a) [NEEDS-NATHAN] With a member subscribed (Settings -> enable) on a real
--       device, submit the public contact form -> an OS/lock-screen notification
--       arrives on the subscribed device.
--   (b) [I E2E-test] pg_net's net._http_response shows a 200 from notify-push for
--       the queued request id.
--   (c) [I E2E-test] The booking form still returns success even if notify-push
--       is down (the exception guard holds — push never blocks the enquiry).
-- =============================================================================
