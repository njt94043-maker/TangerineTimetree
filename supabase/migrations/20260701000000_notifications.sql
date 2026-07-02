-- =============================================================================
-- S242 slice 1a — in-app booking notifications (in-app alert, NO external dep).
--
-- Adds public.notifications + a SECURITY DEFINER fan-out trigger that writes ONE
-- notification row per band member whenever a public booking enquiry lands in
-- contact_submissions. The in-app alert is therefore transactional/guaranteed —
-- it fires even if the (slice-1b) Resend email ever fails. Slice 1b later adds a
-- pg_net http_post to the same trigger; this file is 1a only (no email).
--
-- STATUS: apply to the LIVE TGT project (ref jlufqgslgjowfaqmqlds) via the Supabase
--   Management API `database/query` (HTTP 2xx), same path as S215/S233 — NOT
--   `supabase db push`. Base objects (public.profiles, public.contact_submissions)
--   were dashboard-created and are absent from migrations, so push would fail on
--   them. This file is the committed record for the Architect.
--
-- SECURITY MODEL (mirrors S215/S233 conventions):
--   * RLS ON. `authenticated` may SELECT/UPDATE own row only (user_id = auth.uid()).
--   * NO INSERT policy for anon/authenticated — rows are written ONLY by the
--     SECURITY DEFINER trigger (owned by postgres, which BYPASSRLS), so no member
--     can forge a notification for another member.
--   * The trigger fn is SET search_path = public. It fires on the ANON insert into
--     contact_submissions; a trigger fn needs no EXECUTE grant on the invoking role,
--     and EXECUTE is REVOKEd from clients so it cannot be called directly as an RPC.
--   * notifications is enrolled in the supabase_realtime publication so the header
--     bell badge updates live without refresh; per-row RLS means each member's
--     realtime stream carries only their own rows.
--
-- Applied: <pending — record date on apply, S242>.
-- =============================================================================
BEGIN;

-- ---- table -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type          text NOT NULL,
  event_type    text,
  title         text NOT NULL,
  body          text,
  related_table text,
  related_id    uuid,
  read          boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ---- RLS: own-row read + mark-read update; NO client insert path ------------
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own
  ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own
  ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---- fan-out trigger: 1 notification per member on each new enquiry ----------
-- SECURITY DEFINER (owner = postgres) so it reads every profile and writes the
-- RLS-locked notifications table; clients have neither an INSERT policy nor
-- EXECUTE on the function, so this is the ONLY write path.
CREATE OR REPLACE FUNCTION public.notify_on_enquiry()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications
    (user_id, type, event_type, title, body, related_table, related_id)
  SELECT
    p.id,
    'enquiry',
    'enquiry',
    'New booking enquiry: ' || NEW.name,
    left(NEW.message, 200),
    'contact_submissions',
    NEW.id
  FROM public.profiles p;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_on_enquiry() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS contact_submissions_notify ON public.contact_submissions;
CREATE TRIGGER contact_submissions_notify
  AFTER INSERT ON public.contact_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_enquiry();

-- ---- realtime: enroll so the header bell badge updates without refresh -------
-- Idempotent guard (same pattern as s121/s125/s129 migrations): a NEW table emits
-- no postgres_changes events until it is a member of the supabase_realtime
-- publication. Without this, verify-(b) "badge increments live" would fail.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END$$;

COMMIT;

-- =============================================================================
-- VERIFY 1a (live — bucket: I E2E-test, after apply):
--   (a) Submit the public contact form; assert one notifications row PER profile
--       exists with related_id = the new contact_submissions.id.
--   (b) Header bell badge increments live WITHOUT refresh (realtime publication).
--   (c) Clicking a notification marks it read and the badge decrements.
--   (d) A second member's login sees only their own row (own-row RLS holds).
--   (e) The booking form still returns success (trigger did not abort the insert).
-- =============================================================================
