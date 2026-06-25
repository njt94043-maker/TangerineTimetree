-- =============================================================================
-- S233 — band signup allow-list (defence-in-depth behind disable_signup).
-- Rejects any auth signup whose email is not on the fixed band roster.
--
-- STATUS: APPLIED to the live TGT project 2026-06-25 via the Supabase Management
--         API `database/query` (HTTP 201), same path as S215 — NOT `supabase db
--         push` (base auth objects aren't in migrations; this file is the record
--         for the Architect to commit, like 20260624000000_s215_isadmin_privesc_fix.sql).
--         Verified by read-back: roster = the 4 live emails; RLS on with only a
--         supabase_auth_admin SELECT policy; function body fail-closed; anon probe PASS.
--         Part A (disable_signup=true) was set via the dashboard toggle and probe-verified.
--         REMAINING (dormant while signup is OFF): register the hook in config/auth
--         (see "AFTER APPLY / B" below) — only fires once signup is ever re-enabled.
--
-- CORRECTED vs the s233 prompt's literal SQL after the §B.11 hostile second-pass.
-- Three deviations, each with evidence — Architect to confirm at wrap:
--
--   (1) REJECTION MECHANISM  [was: a BLOCKER bug]
--       Prompt's SQL rejected via `RAISE EXCEPTION ... USING ERRCODE='check_violation'`.
--       That is NOT the GoTrue Before-User-Created contract: a raised Postgres
--       exception surfaces as an opaque HTTP 500, not a clean signup rejection.
--       The documented contract is to RETURN a jsonb error object to reject, and
--       return '{}' to allow. Rewritten accordingly below.
--       (Supabase Auth reads only the returned payload's `error` field.)
--
--   (2) LOCKOUT-PROOF READ  [was: a latent whole-band-lockout trap]
--       Prompt used SECURITY DEFINER, relying on the postgres owner's BYPASSRLS to
--       read the RLS-locked, zero-policy table. Supabase guidance is AGAINST
--       security definer for hooks, and dropping it later (a plausible "harden"
--       edit) without granting supabase_auth_admin read would fail-close EVERY
--       signup = the band can never be provisioned. Fixed by running the hook as
--       the default SECURITY INVOKER (i.e. as supabase_auth_admin) and giving that
--       role an EXPLICIT read grant + SELECT policy. anon/authenticated still get
--       ZERO policies, so the roster stays anon/client-invisible (default-deny kept).
--
--   (3) SCHEMA = public (NOT auth)  [discovered at apply: ERROR 42501]
--       The Management API database/query role cannot CREATE in the `auth` schema
--       (owned by supabase_auth_admin). `public` is the schema Supabase's own
--       before-user-created hook docs use anyway. Live hook URI is therefore
--       pg-functions://postgres/public/before_user_created_allowlist — the schema
--       segment `public` must match this CREATE and the fn name char-for-char or
--       GoTrue silently never resolves the hook.
--
-- NOTE: real member emails are REDACTED above — this repo (TangerineTimetree) is
--       PUBLIC (verified at wrap 2026-06-25; the Builder's "private" claim was wrong).
--       The live roster was seeded from auth.users; ON CONFLICT keeps re-runs idempotent.
-- =============================================================================
BEGIN;

-- ---- roster table ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.signup_allowlist (
  email text PRIMARY KEY,
  added_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.signup_allowlist ENABLE ROW LEVEL SECURITY;

-- Default-deny to CLIENTS: no policy for anon or authenticated => the table is
-- invisible/untouchable from the browser. Only supabase_auth_admin (GoTrue's
-- role, which the hook runs as) gets an explicit read path; the service role
-- bypasses RLS. This is what makes the hook read lockout-proof.
DROP POLICY IF EXISTS signup_allowlist_auth_admin_read ON public.signup_allowlist;
CREATE POLICY signup_allowlist_auth_admin_read
  ON public.signup_allowlist
  FOR SELECT TO supabase_auth_admin
  USING (true);

GRANT USAGE  ON SCHEMA public            TO supabase_auth_admin;
GRANT SELECT ON public.signup_allowlist  TO supabase_auth_admin;

-- Seed the fixed roster — applied LIVE 2026-06-25 from the 4 existing auth.users
-- accounts. The real member emails are intentionally REDACTED from this committed
-- record (PII): the live seed used the actual roster, which lives in the live DB +
-- the password vault. Re-running this file inserts only these inert placeholders
-- (ON CONFLICT keeps it harmless) — it is a structural record, not a re-seed.
-- (Base auth objects aren't in migrations, so `supabase db push` won't run it anyway.)
INSERT INTO public.signup_allowlist (email) VALUES
  ('member-1@REDACTED.invalid'),  -- Drums / admin
  ('member-2@REDACTED.invalid'),  -- Bass
  ('member-3@REDACTED.invalid'),  -- Lead Vocals
  ('member-4@REDACTED.invalid')   -- Guitar & Backing Vocals
ON CONFLICT (email) DO NOTHING;

-- ---- the Before-User-Created hook ------------------------------------------
-- Contract: RETURN {"error":{"http_code":403,"message":...}} to REJECT;
--           RETURN '{}'::jsonb to ALLOW.
-- Default SECURITY INVOKER (no `security definer` tag) => runs as the calling
-- supabase_auth_admin role, which has the explicit read grant + policy above.
CREATE OR REPLACE FUNCTION public.before_user_created_allowlist(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_email text := lower(event->'user'->>'email');
BEGIN
  IF new_email IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.signup_allowlist WHERE lower(email) = new_email) THEN
    -- Fail-closed: documented rejection payload (NOT raise exception).
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message',   'signup not permitted for this email'
      )
    );
  END IF;
  RETURN '{}'::jsonb;  -- on the roster => allow (empty object = no error field = accept, doc-canonical)
END;
$$;

-- Only GoTrue's role may execute the hook; clients cannot.
REVOKE EXECUTE ON FUNCTION public.before_user_created_allowlist(jsonb) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.before_user_created_allowlist(jsonb) TO supabase_auth_admin;

COMMIT;

-- =============================================================================
-- AFTER APPLY:
--   A. DONE 2026-06-25 — disable_signup=true set via dashboard toggle; verified by
--      read-only GET /auth/v1/settings (disable_signup:true).
--   B. REMAINING (dormant while signup is OFF) — register the hook in config/auth:
--        hook_before_user_created_enabled = true
--        hook_before_user_created_uri = "pg-functions://postgres/public/before_user_created_allowlist"
--      Prefer the dashboard (Authentication -> Hooks -> Before User Created). Do NOT
--      send hook_before_user_created_secrets (HTTPS-hooks only). Known issue
--      supabase/supabase#36861: PATCH config/auth can fail when hooks are present.
--   C. Static proof (done): pg_get_functiondef('public.before_user_created_allowlist'::regproc)
--      shows the {"error":...} fail-closed return (NOT raise exception).
--   D. Runtime proof (Architect, bucket-2; only meaningful once B is done AND signup
--      re-enabled): a non-roster email signup is REJECTED with the 403 message and NO
--      new auth.users row; a roster email is permitted.
-- =============================================================================
