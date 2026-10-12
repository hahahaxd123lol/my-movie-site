-- Flix2Watch watched episodes v1 — account-linked with auth.uid().
-- Run once in the Supabase SQL Editor. Safe to re-run.

begin;

create table if not exists public.user_watched_episodes_v1 (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id bigint not null check (media_id > 0),
  season integer not null check (season > 0),
  episode integer not null check (episode > 0),
  watched_at timestamptz not null default now(),
  primary key (user_id, media_id, season, episode)
);

create index if not exists user_watched_episodes_v1_lookup_idx
  on public.user_watched_episodes_v1(user_id, media_id, season, episode);

alter table public.user_watched_episodes_v1 enable row level security;
revoke all on public.user_watched_episodes_v1 from public, anon, authenticated;

create or replace function public.get_my_watched_episodes_v1(p_media_id bigint)
returns table(season integer, episode integer, watched_at timestamptz)
language sql
security definer
stable
set search_path = public
as $$
  select w.season, w.episode, w.watched_at
  from public.user_watched_episodes_v1 w
  where w.user_id = auth.uid()
    and w.media_id = p_media_id
  order by w.season, w.episode;
$$;

revoke all on function public.get_my_watched_episodes_v1(bigint) from public, anon;
grant execute on function public.get_my_watched_episodes_v1(bigint) to authenticated;

create or replace function public.mark_my_watched_episode_v1(
  p_media_id bigint,
  p_season integer,
  p_episode integer,
  p_position_seconds integer,
  p_duration_seconds integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_threshold integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;
  if p_media_id is null or p_media_id <= 0
     or p_season is null or p_season <= 0
     or p_episode is null or p_episode <= 0 then
    raise exception 'Invalid episode identity';
  end if;
  if p_position_seconds is null or p_duration_seconds is null or p_duration_seconds <= 0 then
    raise exception 'Valid playback position and duration are required';
  end if;

  if p_duration_seconds > 600 then
    v_threshold := p_duration_seconds - 600;
  else
    v_threshold := ceil(p_duration_seconds * 0.5)::integer;
  end if;

  if p_position_seconds < v_threshold then
    raise exception 'Episode has not reached the watched threshold';
  end if;

  insert into public.user_watched_episodes_v1(user_id, media_id, season, episode, watched_at)
  values (v_uid, p_media_id, p_season, p_episode, now())
  on conflict (user_id, media_id, season, episode)
  do update set watched_at = public.user_watched_episodes_v1.watched_at;
end;
$$;

revoke all on function public.mark_my_watched_episode_v1(bigint, integer, integer, integer, integer) from public, anon;
grant execute on function public.mark_my_watched_episode_v1(bigint, integer, integer, integer, integer) to authenticated;

notify pgrst, 'reload schema';
commit;
