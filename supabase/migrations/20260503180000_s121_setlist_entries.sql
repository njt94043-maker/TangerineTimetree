-- S121: setlist_entries — self-contained setlist row, single source of truth.
-- Replaces tgt_songs as the song-data SOT (S118 ecosystem-pivot lock).
-- tgt_songs survives in this migration; it's dropped in a later S121-tail
-- migration once every consumer (APK, Web, Studio v2, Media Server) reads
-- from setlist_entries.
--
-- Per S121 routing memory: practice_audio_ref + practice_stems_refs are flat
-- pointers into Media Server's catalog. Audio assets live on Media Server
-- (OptiPlex) — never duplicated to Supabase Storage.

create table if not exists public.setlist_entries (
  id              uuid primary key default gen_random_uuid(),
  list_id         text not null check (list_id in ('staples', 'party', 'classic_rock')),
  position        int  not null,
  title           text not null,
  artist          text,
  bpm             int,
  beats_per_bar   int  default 4,
  click_y_n       bool not null default false,
  click_config    jsonb,
  led_visual      text,
  backdrop_url    text,
  notes           text,
  chord_text      text,
  lyric_text      text,
  drum_text       text,
  practice_audio_ref   text,
  practice_stems_refs  jsonb,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index if not exists setlist_entries_list_position_idx
  on public.setlist_entries (list_id, position);

alter table public.setlist_entries enable row level security;

-- Authenticated band members read + write the whole table.
-- Future: gig-lock + LWW propose-only is enforced at the app layer
-- per S91 lock; RLS stays simple for now.
drop policy if exists "setlist_entries_read"  on public.setlist_entries;
drop policy if exists "setlist_entries_write" on public.setlist_entries;

create policy "setlist_entries_read"
  on public.setlist_entries
  for select
  using (auth.role() = 'authenticated');

create policy "setlist_entries_write"
  on public.setlist_entries
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Realtime publication so APK / Media Server PWA / Web / Studio v2 stay in sync.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'setlist_entries'
  ) then
    alter publication supabase_realtime add table public.setlist_entries;
  end if;
end$$;

-- updated_at autotouch trigger
create or replace function public.setlist_entries_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists setlist_entries_touch_updated_at on public.setlist_entries;
create trigger setlist_entries_touch_updated_at
  before update on public.setlist_entries
  for each row execute function public.setlist_entries_touch_updated_at();
