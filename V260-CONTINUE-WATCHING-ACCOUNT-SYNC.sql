-- Flix2Watch v260 — account-linked Continue Watching progress.
-- Run this once in Supabase SQL Editor before using cross-device sync.

create table if not exists public.continue_watching_v260 (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('movie','tv')),
  media_id bigint not null check (media_id > 0),
  season integer,
  episode integer,
  seconds integer not null default 0 check (seconds >= 0),
  duration integer not null default 0 check (duration >= 0),
  title text,
  poster_path text,
  updated_at timestamptz not null default now(),
  primary key (user_id, media_type, media_id),
  check (
    (media_type = 'movie' and season is null and episode is null)
    or
    (media_type = 'tv' and coalesce(season,1) > 0 and coalesce(episode,1) > 0)
  )
);

create index if not exists continue_watching_v260_updated_idx
  on public.continue_watching_v260(user_id, updated_at desc);

alter table public.continue_watching_v260 enable row level security;
revoke all on table public.continue_watching_v260 from anon;
grant select, insert, update, delete on table public.continue_watching_v260 to authenticated;

drop policy if exists continue_watching_v260_select_own on public.continue_watching_v260;
create policy continue_watching_v260_select_own
  on public.continue_watching_v260 for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists continue_watching_v260_insert_own on public.continue_watching_v260;
create policy continue_watching_v260_insert_own
  on public.continue_watching_v260 for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists continue_watching_v260_update_own on public.continue_watching_v260;
create policy continue_watching_v260_update_own
  on public.continue_watching_v260 for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists continue_watching_v260_delete_own on public.continue_watching_v260;
create policy continue_watching_v260_delete_own
  on public.continue_watching_v260 for delete to authenticated
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';
