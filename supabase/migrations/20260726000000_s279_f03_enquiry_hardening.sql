-- =============================================================================
-- S279 F-03 — harden the public enquiry insert path.
--
-- WHY: public.contact_submissions is written by an UNAUTHENTICATED caller. The
-- public site's contact form calls submitContactForm (shared/supabase/queries.ts)
-- which does a direct anon PostgREST insert, and the anon key ships in the browser
-- bundle — so the insert endpoint is effectively open to the internet. Until this
-- migration the INSERT policy was `WITH CHECK (true)`, which means an anonymous
-- caller could:
--   * set the moderation columns that belong to the inbox owner, not the
--     submitter — `archived => true` (getContactSubmissions filters
--     `archived = false`, so an enquiry could be inserted PRE-ARCHIVED and never
--     appear in the inbox), `read => true`, and free text into `notes`;
--   * submit an arbitrarily large `message` (no length limits anywhere);
--   * submit without limit — and 20260701000300_enquiry_push_webhook.sql puts an
--     AFTER INSERT trigger on this table that calls notify-push via pg_net, while
--     slice-1a's notify_on_enquiry fans out the in-app rows. So EVERY anonymous
--     insert pushes a notification to Nathan's phone. A stranger holding the
--     public key had an unbounded push channel at his lock screen. Rate limiting
--     is the actual fix here, not a nicety.
--
-- Anon READ is already correctly blocked (auth_read_enquiries requires
-- auth.uid() IS NOT NULL) and rls_probe.py covers contact_submissions. This
-- migration deliberately does NOT touch the SELECT or UPDATE policies.
--
-- DESIGN DECISIONS (settled — do not re-open):
--   * BEFORE INSERT on purpose. It fires ahead of the existing AFTER INSERT
--     contact_submissions_notify_push trigger, so a rejected enquiry never
--     reaches Nathan's phone.
--   * Per-email limit only. No global cap. A global "N per hour" bucket is a
--     self-DoS lever — anyone could fill it and block real customers. A per-email
--     cap stops the naive spammer without that failure mode.
--   * No honeypot column. The insert path is a public PostgREST endpoint, so a
--     honeypot only catches bots that scrape the rendered form; anything hitting
--     REST directly ignores it. The length/shape constraints cover the same
--     traffic without a schema column.
--   * No IP-based limiting. It would need current_setting('request.headers'),
--     which could not be verified without an anon write to the live table.
--     Out of scope; recorded, not hidden.
--
-- Apply via Management API `database/query`, NOT `supabase db push` (same as
-- 20260701000300). Prod-DB write — needs Nathan-approval past the classifier.
--
-- STATUS: NOT YET APPLIED. Written and reviewed S279; the apply was withheld
-- pending Nathan's approval of the production write. Record the date here on
-- apply: Applied via Management API S279: <record date on apply>.
-- =============================================================================
BEGIN;

-- Replace WITH CHECK (true): anon may submit an enquiry, and nothing else.
DROP POLICY IF EXISTS anon_submit_enquiry ON public.contact_submissions;
CREATE POLICY anon_submit_enquiry ON public.contact_submissions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
        length(btrim(name))    BETWEEN 1 AND 100
    AND length(btrim(email))   BETWEEN 5 AND 200
    AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[A-Za-z]{2,}$'
    AND length(btrim(message)) BETWEEN 1 AND 2000
    AND length(coalesce(event_type, '')) <= 50
    -- moderation columns are the inbox owner's, never the submitter's
    AND coalesce(read, false)     = false
    AND coalesce(archived, false) = false
    AND coalesce(notes, '')       = ''
    AND (preferred_date IS NULL
         OR preferred_date BETWEEN current_date - 1 AND current_date + interval '3 years')
  );

-- Rate limit. SECURITY DEFINER because anon cannot SELECT this table (and must not be
-- able to) but the check has to count existing rows.
CREATE OR REPLACE FUNCTION public.enforce_enquiry_rate_limit()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM public.contact_submissions
   WHERE lower(email) = lower(NEW.email)
     AND created_at > now() - interval '1 hour';
  IF n >= 3 THEN
    RAISE EXCEPTION 'Too many enquiries from this email address in the last hour. Please email bookings@thegreentangerine.com.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.enforce_enquiry_rate_limit() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS contact_submissions_rate_limit ON public.contact_submissions;
CREATE TRIGGER contact_submissions_rate_limit
  BEFORE INSERT ON public.contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_enquiry_rate_limit();

COMMIT;

-- =============================================================================
-- VERIFY (live) — this table is a LIVE NOTIFY-FLOW. Rejection cases are safe
-- (a rejected INSERT never commits, so the AFTER-INSERT push trigger never
-- fires). The one acceptance case MUST be wrapped BEGIN; INSERT ...; ROLLBACK;
-- — pg_net's queue insert is transactional, so the rollback cancels the queued
-- push too. Never leave a test row in this table.
--
--   (a) [I E2E-test] As anon, each of these is REJECTED:
--         * message of 2001 chars                      -> RLS violation
--         * archived => true                           -> RLS violation
--         * notes => 'x'                               -> RLS violation
--         * email => 'not-an-email'                    -> RLS violation
--         * 4th insert from the same email in one hour -> check_violation,
--           raised by the BEFORE trigger (so no push is queued)
--   (b) [I E2E-test] A well-formed enquiry is ACCEPTED inside
--       BEGIN; INSERT ...; ROLLBACK; and leaves no row behind.
--   (c) [I E2E-test] python "C:\Apps\Dev Team\scripts\rls_probe.py" --scope tgt
--       still PASSES (contact_submissions is in the sensitive list) — anon
--       READ must remain blocked.
--   (d) [NEEDS-NATHAN] The real public contact form on thegreentangerine.com
--       still submits successfully and the push still lands on his phone.
-- =============================================================================
