-- =============================================================================
-- S243 slice 2 — Web Push subscriptions.
--
-- Committed RECORD of the public.push_subscriptions table the Architect already
-- provisioned on the LIVE TGT project (ref jlufqgslgjowfaqmqlds) via the Supabase
-- Management API `database/query` — same path as S215/S233/slice-1a, NOT
-- `supabase db push` (base objects public.profiles/contact_submissions are
-- dashboard-created and absent from migrations, so push would fail on them).
-- Idempotent, so re-applying is a no-op.
--
-- SECURITY MODEL (mirrors slice-1a conventions):
--   * RLS ON. Own-row for `authenticated` on ALL of SELECT/INSERT/UPDATE/DELETE
--     (user_id = auth.uid()) — each member manages only their own device rows.
--   * The notify-push edge function reads EVERY row via the service role
--     (BYPASSRLS) to fan out push; it never uses these client policies.
--   * `endpoint` is UNIQUE — re-subscribing the same browser upserts
--     (onConflict = endpoint, which is why INSERT + UPDATE policies both exist),
--     and the edge fn prunes rows whose endpoint returns 404/410.
--
-- Applied via Management API S243: <record date on apply>.
-- =============================================================================
BEGIN;

-- ---- table -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ---- RLS: own-row for every verb (the device owner manages their rows) -------
DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select_own
  ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_insert_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert_own
  ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_update_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_update_own
  ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete_own
  ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

COMMIT;

-- =============================================================================
-- VERIFY (live — bucket: I E2E-test):
--   (a) As a signed-in member, enable push in Settings -> one row appears with
--       user_id = auth.uid(), a unique endpoint, and p256dh/auth populated.
--   (b) Re-enabling on the same browser does NOT duplicate (onConflict=endpoint).
--   (c) A second member cannot SELECT the first member's row (own-row RLS holds).
--   (d) Disabling push deletes the row (own-row DELETE).
-- =============================================================================
