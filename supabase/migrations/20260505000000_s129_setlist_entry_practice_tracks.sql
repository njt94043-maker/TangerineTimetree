-- S129: setlist_entry_practice_tracks — the multi-version-per-row join table.
--
-- Per S129 brain-dump row 1: each setlist entry can have multiple practice
-- track versions, both as stereo mixes and as 7-part multitracks:
--
--   version_label  format   source
--   ─────────────  ──────   ──────────────────────────────────────────────
--   original       stereo   media-server stem-sep flow (full mix + click)
--   original       stems    media-server stem-sep flow (drums/bass/vox/other + click)
--   ours_a         stereo   gig multitrack mixdown (Reaper post-prod render)
--   ours_a         stems    gig multitrack mixdown — 7 named stems
--   ours_b         stereo   another gig render (alt take / different night)
--   ours_b         stems    another gig render
--   ours_c         stereo   third take
--   ours_c         stems    third take
--
-- The 7 named stems for ours_*: full / drums / guitar / bass / vox1 / vox2 /
-- vox_bus. Stored in `ms_stems_refs` as a JSON map of stem-name → media-server
-- track-id pointers. The format='stems' row is the addressable unit; the JSON
-- inside it is the per-stem layout.
--
-- Album naming for ours_*: `<gig-name>-<YYYY-MM-DD>` (locked S129). Captured
-- on `gig_album` at ingest time so MS can index the library by gig.
--
-- Per `proj-tgt--media-infrastructure`: audio bytes live on Media Server. The
-- supabase_path column exists for the Web practice player (workstream #4) —
-- when populated, the Web app reads from Supabase Storage instead of Media
-- Server (no Tailscale needed). Populated by the MS ingest pipeline as an
-- opt-in upload step per setlist row.

create table if not exists public.setlist_entry_practice_tracks (
  id                  uuid primary key default gen_random_uuid(),
  setlist_entry_id    uuid not null references public.setlist_entries(id) on delete cascade,
  version_label       text not null check (version_label in ('original', 'ours_a', 'ours_b', 'ours_c')),
  format              text not null check (format in ('stereo', 'stems')),
  ms_track_id         text,                          -- pointer into MS library; null until ingested
  ms_stems_refs       jsonb,                         -- stems format: { full, drums, guitar, bass, vox1, vox2, vox_bus } -> ms-track-id
  supabase_path       text,                          -- bucket path for Web access; null until uploaded
  supabase_stems_paths jsonb,                        -- stems format: same 7-key shape, bucket paths
  gig_album           text,                          -- "<gig-name>-<YYYY-MM-DD>" for ours_*; null for original
  duration_seconds    int,
  bpm                 int,
  notes               text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now(),
  unique (setlist_entry_id, version_label, format)
);

create index if not exists setlist_entry_practice_tracks_entry_idx
  on public.setlist_entry_practice_tracks (setlist_entry_id);

create index if not exists setlist_entry_practice_tracks_album_idx
  on public.setlist_entry_practice_tracks (gig_album)
  where gig_album is not null;

alter table public.setlist_entry_practice_tracks enable row level security;

drop policy if exists "setlist_entry_practice_tracks_read"  on public.setlist_entry_practice_tracks;
drop policy if exists "setlist_entry_practice_tracks_write" on public.setlist_entry_practice_tracks;

create policy "setlist_entry_practice_tracks_read"
  on public.setlist_entry_practice_tracks
  for select
  using (auth.role() = 'authenticated');

create policy "setlist_entry_practice_tracks_write"
  on public.setlist_entry_practice_tracks
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Realtime so MS ingest changes propagate to APK + Web + Studio v2 instantly.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'setlist_entry_practice_tracks'
  ) then
    alter publication supabase_realtime add table public.setlist_entry_practice_tracks;
  end if;
end$$;

create or replace function public.setlist_entry_practice_tracks_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists setlist_entry_practice_tracks_touch_updated_at
  on public.setlist_entry_practice_tracks;
create trigger setlist_entry_practice_tracks_touch_updated_at
  before update on public.setlist_entry_practice_tracks
  for each row execute function public.setlist_entry_practice_tracks_touch_updated_at();

-- Storage bucket for the Web practice player (workstream #4 dependency).
-- Created idempotently. Public read for authenticated band members; writes
-- happen from the MS ingest pipeline using the service-role key so RLS-on-
-- storage applies via the upload script's auth context.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('practice-tracks', 'practice-tracks', false, 524288000, array['audio/wav','audio/mpeg','audio/flac','audio/ogg'])
on conflict (id) do nothing;

drop policy if exists "practice-tracks read" on storage.objects;
create policy "practice-tracks read"
  on storage.objects for select
  using (bucket_id = 'practice-tracks' and auth.role() = 'authenticated');
