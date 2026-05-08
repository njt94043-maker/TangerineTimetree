-- S141 — gig-lock DB enforcement
--
-- S133 finding #2: gig_lock_state.is_locked has zero DB-side enforcement.
-- E2 verified service-role PATCH succeeds regardless of lock state. APK,
-- Web, and MS PWA *should* check is_locked client-side and route writes
-- through setlist_pending_edits during a gig — but if any surface forgets,
-- writes silently leak through and corrupt the gig-time setlist.
--
-- This migration adds a BEFORE-trigger on setlist_entries that raises an
-- exception when is_locked = true AND the caller is not service-role.
-- Service-role bypasses (admin tools, gig-end auto-apply daemon when it
-- ships in S142, the lock-flip itself).
--
-- NOT enforced on:
--   - setlist_pending_edits — the queue, must accept writes during lock.
--   - setlist_changelog — append-only audit log, must accept writes.
--   - gig_lock_state — surfaces flipping the lock need to write to it.
--
-- Cross-ref: S136-DECISIONS.md (no D# — finding #2 has only one path),
-- specs/tgt/s141-gig-lock-wiring-brief.md, S133-FINDINGS.md #2.

CREATE OR REPLACE FUNCTION public.enforce_gig_lock() RETURNS TRIGGER AS $$
DECLARE
  locked boolean;
BEGIN
  -- Service-role bypass: server-side admin always allowed.
  -- Covers: gig-end auto-apply daemon (S142), admin migrations, the lock
  -- flip itself when fired by service-role-keyed code paths.
  IF auth.role() = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Single-row lock state. id=1 is the only row per S125 schema design.
  SELECT is_locked INTO locked FROM public.gig_lock_state ORDER BY id LIMIT 1;

  IF locked IS TRUE THEN
    RAISE EXCEPTION 'gig is locked — route through setlist_pending_edits'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS setlist_entries_gig_lock ON public.setlist_entries;

CREATE TRIGGER setlist_entries_gig_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.setlist_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_gig_lock();

COMMENT ON FUNCTION public.enforce_gig_lock IS
  'S141: blocks regular auth users from writing setlist_entries while gig_lock_state.is_locked=true. Service-role bypasses. Surfaces should route to setlist_pending_edits during lock.';

COMMENT ON TRIGGER setlist_entries_gig_lock ON public.setlist_entries IS
  'S141: enforces gig_lock_state.is_locked. See enforce_gig_lock() function.';
