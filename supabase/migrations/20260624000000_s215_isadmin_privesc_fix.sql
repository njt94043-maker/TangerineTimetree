-- S215 Block B — Fix `is_admin` privilege escalation  (audit finding TGT-Web-02)
-- Spec: C:/apps/Dev Team/specs/prompts/s215-block-b-isadmin-privesc.md
--
-- Closes two independent self-escalation paths verified against the LIVE DB:
--   1. handle_new_user() trusted client-controlled raw_user_meta_data->>'is_admin'
--      => supabase.auth.signUp({ data: { is_admin: true } }) granted instant admin.
--   2. profiles UPDATE policy had with_check = NULL => any logged-in user could
--      `update public.profiles set is_admin = true where id = auth.uid()`.
--
-- Safe: existing admin (Nathan) untouched; new users are non-admin; admin promotion
-- happens only via dashboard/service role. App profile edits keep working.
-- NOTE: `is_admin` also drives the receipt/is_self logic in shared/supabase/queries.ts
-- (receipts go to `!is_admin` members), so locking the column also protects that
-- business invariant — a self-escalation would have corrupted receipt generation too.
--
-- DRIFT: base objects (public.profiles, on_auth_user_created trigger, handle_new_user)
-- were created via the Supabase dashboard and are NOT in any prior migration. This file
-- is applied via the Management API `database/query` (CLI unavailable this session),
-- NOT via `supabase db push` — running push would fail on the missing base objects.
-- Full drift reconciliation (base objects -> migrations) is tracked separately.
--
-- Applied: 2026-06-24 (S215).

BEGIN;

-- 1. Signup never trusts client metadata for privilege
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, is_admin)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), FALSE);
  RETURN NEW;
END;
$function$;

-- 2. Users may edit profile fields but NOT the is_admin column (column-level grant)
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (name, avatar_url, last_opened_at, band_role) ON public.profiles TO authenticated;

COMMIT;
