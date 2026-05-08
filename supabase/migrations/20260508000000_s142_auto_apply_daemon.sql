-- S142 — auto-apply daemon for setlist_pending_edits
--
-- Closes the second half of S133 finding #2. Pairs with S141 (lock wiring +
-- DB enforcement). When gig_lock_state.is_locked transitions from true to
-- false, this daemon drains setlist_pending_edits → setlist_entries +
-- setlist_changelog.
--
-- v1 supports `updated` (per-field UPDATE with changelog) and `deleted`.
-- `created` / `reordered` / `moved` get marked with apply_error and stay
-- in queue for manual handling — deferred to S142b.
--
-- Why server-side trigger: works regardless of which surface flipped the
-- lock; survives APK crash; service-role context bypasses S141's
-- enforce_gig_lock (though at unlock-time the lock IS false anyway).
--
-- Cross-ref: specs/tgt/s142-auto-apply-daemon-brief.md, S141 migration
-- 20260507000000_s141_gig_lock_enforcement.sql.

CREATE OR REPLACE FUNCTION public.drain_pending_edits() RETURNS TRIGGER AS $$
DECLARE
  edit RECORD;
  field_name TEXT;
  field_value JSONB;
  prev_value TEXT;
  new_value TEXT;
  applied_count INTEGER := 0;
  errored_count INTEGER := 0;
BEGIN
  -- Idempotence: only fire on the lock=true → lock=false transition.
  -- (The trigger WHEN clause also guards this, but be defensive.)
  IF NOT (OLD.is_locked = TRUE AND NEW.is_locked = FALSE) THEN
    RETURN NEW;
  END IF;

  -- Drain queue in created_at order.
  -- LWW falls out naturally — later edits to the same field overwrite earlier.
  FOR edit IN
    SELECT * FROM public.setlist_pending_edits
    WHERE applied_at IS NULL
      AND apply_error IS NULL
    ORDER BY created_at ASC
  LOOP
    BEGIN

      IF edit.action = 'updated' THEN
        -- Per-field UPDATE + changelog row per field.
        FOR field_name, field_value IN SELECT * FROM jsonb_each(edit.payload) LOOP
          -- Capture previous value for changelog.
          EXECUTE format('SELECT (%I)::text FROM public.setlist_entries WHERE id = $1', field_name)
            INTO prev_value
            USING edit.entry_id;

          -- Coerce JSONB scalar to text. jsonb_typeof handles null/string/number/bool/object.
          new_value := CASE jsonb_typeof(field_value)
            WHEN 'null'   THEN NULL
            WHEN 'string' THEN field_value #>> '{}'  -- strip outer quotes
            ELSE field_value::text
          END;

          -- Apply the update. cast to jsonb's underlying type at the column
          -- level — UPDATE accepts jsonb-castable text for most columns.
          EXECUTE format(
            'UPDATE public.setlist_entries SET %I = ($1::jsonb #>> ''{}''), updated_at = now() WHERE id = $2',
            field_name
          ) USING field_value, edit.entry_id;

          INSERT INTO public.setlist_changelog
            (list_id, entry_id, actor_id, actor_name, surface, action, field_changed, old_value, new_value)
          VALUES
            (edit.list_id, edit.entry_id, edit.actor_id, edit.actor_name, edit.surface,
             'updated', field_name, prev_value, new_value);
        END LOOP;

        UPDATE public.setlist_pending_edits SET applied_at = now() WHERE id = edit.id;
        applied_count := applied_count + 1;

      ELSIF edit.action = 'deleted' THEN
        DELETE FROM public.setlist_entries WHERE id = edit.entry_id;

        INSERT INTO public.setlist_changelog
          (list_id, entry_id, actor_id, actor_name, surface, action)
        VALUES
          (edit.list_id, edit.entry_id, edit.actor_id, edit.actor_name, edit.surface, 'deleted');

        UPDATE public.setlist_pending_edits SET applied_at = now() WHERE id = edit.id;
        applied_count := applied_count + 1;

      ELSE
        -- v1 stub: created / reordered / moved deferred to S142b.
        UPDATE public.setlist_pending_edits
          SET apply_error = format('S142 v1: action %L not yet supported (manual apply needed)', edit.action)
          WHERE id = edit.id;
        errored_count := errored_count + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      -- Per-edit error capture so one bad edit doesn't abort the whole drain.
      UPDATE public.setlist_pending_edits
        SET apply_error = format('apply failed: %s (%s)', SQLERRM, SQLSTATE)
        WHERE id = edit.id;
      errored_count := errored_count + 1;
    END;
  END LOOP;

  RAISE LOG 'S142 daemon drained: applied=% errored=%', applied_count, errored_count;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DROP TRIGGER IF EXISTS gig_lock_state_drain ON public.gig_lock_state;

CREATE TRIGGER gig_lock_state_drain
  AFTER UPDATE ON public.gig_lock_state
  FOR EACH ROW
  WHEN (OLD.is_locked = TRUE AND NEW.is_locked = FALSE)
  EXECUTE FUNCTION public.drain_pending_edits();


COMMENT ON FUNCTION public.drain_pending_edits IS
  'S142: drains setlist_pending_edits → setlist_entries + setlist_changelog on gig unlock. v1 supports updated + deleted; created/reordered/moved deferred (marked with apply_error).';

COMMENT ON TRIGGER gig_lock_state_drain ON public.gig_lock_state IS
  'S142: fires drain_pending_edits() on lock=true → lock=false transition.';
