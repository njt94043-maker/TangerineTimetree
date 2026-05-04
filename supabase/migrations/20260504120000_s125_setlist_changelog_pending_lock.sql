-- S125: setlist_changelog + setlist_pending_edits + gig_lock_state.
--
-- Ecosystem context (per `proj-tgt--s118-ecosystem-pivot.md` LOCKED): all 3
-- surfaces (MS PWA / TGT Web / APK) edit `setlist_entries` directly. LWW
-- resolves conflicts; the changelog is the editorial-control mechanism
-- (anyone can roll back from history). The pending-edits queue handles the
-- gig-lock case (S118 Resolved-decision 5: "Web edits proposed while locked
-- queue up, apply on gig-end").
--
-- gig_lock_state is a single-row control table that all 3 surfaces subscribe
-- to via Realtime. APK or whichever surface starts the gig flips is_locked
-- to true; on gig-end it flips back. While locked, surfaces write to
-- setlist_pending_edits instead of setlist_entries.
--
-- Surface enum: 'ms_pwa' | 'web' | 'apk' | 'studio_v2' (studio_v2 paused
-- per S118 but kept in enum for the eventual revival).

-- ── setlist_changelog ──────────────────────────────────────────────────────

create table if not exists public.setlist_changelog (
  id              uuid primary key default gen_random_uuid(),
  list_id         text not null check (list_id in ('staples', 'party', 'classic_rock')),
  entry_id        uuid references public.setlist_entries(id) on delete set null,
  actor_id        uuid references auth.users(id) on delete set null,
  actor_name      text not null default '',
  surface         text not null check (surface in ('ms_pwa', 'web', 'apk', 'studio_v2')),
  action          text not null check (action in ('created', 'updated', 'deleted', 'reordered', 'moved')),
  field_changed   text,
  old_value       text,
  new_value       text,
  created_at      timestamptz not null default now()
);

create index if not exists setlist_changelog_list_created_idx
  on public.setlist_changelog (list_id, created_at desc);

create index if not exists setlist_changelog_entry_idx
  on public.setlist_changelog (entry_id);

alter table public.setlist_changelog enable row level security;

drop policy if exists "setlist_changelog_read"  on public.setlist_changelog;
drop policy if exists "setlist_changelog_write" on public.setlist_changelog;

create policy "setlist_changelog_read"
  on public.setlist_changelog
  for select
  using (auth.role() = 'authenticated');

create policy "setlist_changelog_write"
  on public.setlist_changelog
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'setlist_changelog'
  ) then
    alter publication supabase_realtime add table public.setlist_changelog;
  end if;
end$$;

-- ── setlist_pending_edits ─────────────────────────────────────────────────

create table if not exists public.setlist_pending_edits (
  id              uuid primary key default gen_random_uuid(),
  list_id         text not null check (list_id in ('staples', 'party', 'classic_rock')),
  entry_id        uuid references public.setlist_entries(id) on delete cascade,
  actor_id        uuid references auth.users(id) on delete set null,
  actor_name      text not null default '',
  surface         text not null check (surface in ('ms_pwa', 'web', 'apk', 'studio_v2')),
  action          text not null check (action in ('created', 'updated', 'deleted', 'reordered', 'moved')),
  payload         jsonb not null,
  created_at      timestamptz not null default now(),
  applied_at      timestamptz,
  apply_error     text
);

create index if not exists setlist_pending_unapplied_idx
  on public.setlist_pending_edits (created_at)
  where applied_at is null;

alter table public.setlist_pending_edits enable row level security;

drop policy if exists "setlist_pending_read"  on public.setlist_pending_edits;
drop policy if exists "setlist_pending_write" on public.setlist_pending_edits;

create policy "setlist_pending_read"
  on public.setlist_pending_edits
  for select
  using (auth.role() = 'authenticated');

create policy "setlist_pending_write"
  on public.setlist_pending_edits
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'setlist_pending_edits'
  ) then
    alter publication supabase_realtime add table public.setlist_pending_edits;
  end if;
end$$;

-- ── gig_lock_state ────────────────────────────────────────────────────────
-- Single-row control table. The single_row check constraint enforces it.

create table if not exists public.gig_lock_state (
  id                  integer primary key default 1,
  is_locked           boolean not null default false,
  locked_by_surface   text check (locked_by_surface in ('apk', 'studio_v2', 'ms_pwa', 'web')),
  locked_at           timestamptz,
  gig_label           text,
  updated_at          timestamptz not null default now(),
  constraint gig_lock_state_single_row check (id = 1)
);

-- Seed the singleton row if it doesn't exist.
insert into public.gig_lock_state (id, is_locked)
values (1, false)
on conflict (id) do nothing;

alter table public.gig_lock_state enable row level security;

drop policy if exists "gig_lock_state_read"  on public.gig_lock_state;
drop policy if exists "gig_lock_state_write" on public.gig_lock_state;

create policy "gig_lock_state_read"
  on public.gig_lock_state
  for select
  using (auth.role() = 'authenticated');

create policy "gig_lock_state_write"
  on public.gig_lock_state
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'gig_lock_state'
  ) then
    alter publication supabase_realtime add table public.gig_lock_state;
  end if;
end$$;

create or replace function public.gig_lock_state_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists gig_lock_state_touch_updated_at on public.gig_lock_state;
create trigger gig_lock_state_touch_updated_at
  before update on public.gig_lock_state
  for each row execute function public.gig_lock_state_touch_updated_at();
