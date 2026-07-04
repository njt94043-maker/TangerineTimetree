-- s260 — TimeTree migration landing ground.
-- One staging table; NOTHING here writes to gigs/away_dates automatically —
-- commits happen only via explicit approval in the Imports review UI.
-- Re-run safe (create if not exists + drop-policy-if-exists + create-or-replace).

create table if not exists import_staging (
  id uuid primary key default gen_random_uuid(),
  timetree_uid text not null unique,
  kind text not null check (kind in ('gig','away')),
  raw_title text not null default '',
  raw_notes text not null default '',
  proposed jsonb not null default '{}'::jsonb,
  match_source text not null default '',
  status text not null default 'pending' check (status in ('pending','committed','skipped')),
  created_gig_id uuid references gigs(id) on delete set null,
  created_away_id uuid references away_dates(id) on delete set null,
  staged_at timestamptz not null default now(),
  committed_at timestamptz,
  committed_by uuid references profiles(id),
  -- addendum (s260): source-disappearance + drift tracking
  last_seen_at timestamptz not null default now(),
  missing_from_source boolean not null default false,
  missing_acknowledged boolean not null default false,
  source_changed boolean not null default false,
  latest_from_source jsonb
);

-- Idempotent column adds (if the table already existed pre-addendum)
alter table import_staging add column if not exists last_seen_at timestamptz not null default now();
alter table import_staging add column if not exists missing_from_source boolean not null default false;
alter table import_staging add column if not exists missing_acknowledged boolean not null default false;
alter table import_staging add column if not exists source_changed boolean not null default false;
alter table import_staging add column if not exists latest_from_source jsonb;

alter table import_staging enable row level security;

-- Band-only app: every member is admin (D-120); the boundary is authenticated
-- vs anon. Explicit per-command policies TO authenticated; anon gets NOTHING.
drop policy if exists imp_sel on import_staging;
drop policy if exists imp_ins on import_staging;
drop policy if exists imp_upd on import_staging;
drop policy if exists imp_del on import_staging;
create policy imp_sel on import_staging for select to authenticated using (auth.uid() is not null);
create policy imp_ins on import_staging for insert to authenticated with check (auth.uid() is not null);
create policy imp_upd on import_staging for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);
create policy imp_del on import_staging for delete to authenticated using (auth.uid() is not null);

-- ─────────────────────────────────────────────────────────────────────────
-- Away commits — staging-bound SECURITY DEFINER RPCs (s260 §1b).
-- The away_dates INSERT/UPDATE/DELETE policies are self-only (user_id =
-- auth.uid()) and STAY that way. These are the ONLY door that lets an import
-- create/remove/update ANOTHER member's away, and each fires ONLY off a
-- pending/committed staged row — never a general "write away for anyone".
-- Changelog parity: createAwayDate/deleteAwayDate log app-side, so these
-- mirror the away_date_changelog rows in the same transaction.
-- ─────────────────────────────────────────────────────────────────────────

-- Commit a pending away staging row → creates the away_date for the resolved
-- member, logs a 'created' changelog row, marks the staging row committed.
create or replace function commit_import_away(p_staging_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_row  import_staging;
  v_user uuid;
  v_away uuid;
  v_range text;
begin
  select * into v_row from import_staging where id = p_staging_id for update;
  if not found then raise exception 'staging row not found'; end if;
  if v_row.kind <> 'away' then raise exception 'not an away row'; end if;
  if v_row.status <> 'pending' then raise exception 'row is %', v_row.status; end if;

  v_user := (v_row.proposed->>'user_id')::uuid;
  if v_user is null or not exists (select 1 from profiles where id = v_user) then
    raise exception 'member not resolved — pick the member on the card first';
  end if;

  insert into away_dates (user_id, start_date, end_date, reason)
    values (v_user,
            (v_row.proposed->>'start_date')::date,
            (v_row.proposed->>'end_date')::date,
            coalesce(v_row.proposed->>'reason',''))
    returning id into v_away;

  v_range := case when (v_row.proposed->>'start_date') = (v_row.proposed->>'end_date')
                  then (v_row.proposed->>'start_date')
                  else (v_row.proposed->>'start_date') || ' to ' || (v_row.proposed->>'end_date') end;
  insert into away_date_changelog (away_date_id, user_id, action, date_range, reason)
    values (v_away, v_user, 'created', v_range, coalesce(v_row.proposed->>'reason',''));

  update import_staging
     set status='committed', created_away_id=v_away, committed_at=now(), committed_by=auth.uid()
   where id = p_staging_id;
  return v_away;
end $$;
revoke all on function commit_import_away(uuid) from public, anon;
grant execute on function commit_import_away(uuid) to authenticated;

-- Remove the away created by an import (Gone-from-TimeTree). Deletes the linked
-- away_date + logs a 'deleted' changelog row. The FK (created_away_id ON DELETE
-- SET NULL) nulls the link → the UI shows the card as returned-to-pending.
create or replace function remove_import_away(p_staging_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_row  import_staging;
  v_away away_dates;
  v_range text;
begin
  select * into v_row from import_staging where id = p_staging_id for update;
  if not found then raise exception 'staging row not found'; end if;
  if v_row.kind <> 'away' then raise exception 'not an away row'; end if;
  if v_row.created_away_id is null then raise exception 'no linked away to remove'; end if;

  select * into v_away from away_dates where id = v_row.created_away_id;
  if found then
    v_range := case when v_away.start_date = v_away.end_date then v_away.start_date::text
                    else v_away.start_date::text || ' to ' || v_away.end_date::text end;
    insert into away_date_changelog (away_date_id, user_id, action, date_range, reason)
      values (v_away.id, v_away.user_id, 'deleted', v_range, coalesce(v_away.reason,''));
    delete from away_dates where id = v_away.id;
  end if;
end $$;
revoke all on function remove_import_away(uuid) from public, anon;
grant execute on function remove_import_away(uuid) to authenticated;

-- Apply a TimeTree-side change (Changed pill) to a committed import's away:
-- updates the linked away_date's dates/reason from latest_from_source, merges
-- latest into proposed (reviewed truth now matches source), clears the flag.
-- (away UPDATE logs no changelog — updateAwayDate doesn't either — so none here.)
create or replace function apply_import_away(p_staging_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_row    import_staging;
  v_latest jsonb;
begin
  select * into v_row from import_staging where id = p_staging_id for update;
  if not found then raise exception 'staging row not found'; end if;
  if v_row.kind <> 'away' then raise exception 'not an away row'; end if;
  if v_row.created_away_id is null then raise exception 'no linked away to update'; end if;
  if v_row.latest_from_source is null then raise exception 'nothing changed to apply'; end if;
  v_latest := v_row.latest_from_source;

  update away_dates set
    start_date = coalesce((v_latest->>'start_date')::date, start_date),
    end_date   = coalesce((v_latest->>'end_date')::date, end_date),
    reason     = coalesce(v_latest->>'reason', reason)
  where id = v_row.created_away_id;

  update import_staging set
    proposed = proposed || v_latest,
    source_changed = false,
    latest_from_source = null
  where id = p_staging_id;
end $$;
revoke all on function apply_import_away(uuid) from public, anon;
grant execute on function apply_import_away(uuid) to authenticated;
