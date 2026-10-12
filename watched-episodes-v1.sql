-- Flix2Watch watched media v1 — UID-linked movies and TV episodes.
-- Run this updated migration in the Supabase SQL Editor. Safe to re-run and upgrades
-- the earlier TV-only watched-episodes-v1.sql schema if that was already applied.

begin;

create table if not exists public.user_watched_episodes_v1 (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_id bigint not null check (media_id > 0),
  media_type text not null default 'tv',
  season integer not null default 0,
  episode integer not null default 0,
  watched_at timestamptz not null default now(),
  primary key (user_id, media_id, season, episode)
);

alter table public.user_watched_episodes_v1
  add column if not exists media_type text not null default 'tv';

-- Remove the older positive-only per-column constraints from the TV-only version.
alter table public.user_watched_episodes_v1
  drop constraint if exists user_watched_episodes_v1_season_check;
alter table public.user_watched_episodes_v1
  drop constraint if exists user_watched_episodes_v1_episode_check;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.user_watched_episodes_v1'::regclass
      and conname='user_watched_episodes_v1_media_type_check'
  ) then
    alter table public.user_watched_episodes_v1
      add constraint user_watched_episodes_v1_media_type_check
      check (media_type in ('movie','tv'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.user_watched_episodes_v1'::regclass
      and conname='user_watched_episodes_v1_scope_check'
  ) then
    alter table public.user_watched_episodes_v1
      add constraint user_watched_episodes_v1_scope_check
      check (
        (media_type='movie' and season=0 and episode=0)
        or
        (media_type='tv' and season>0 and episode>0)
      );
  end if;
end $$;

create index if not exists user_watched_episodes_v1_lookup_idx
  on public.user_watched_episodes_v1(user_id, media_id, media_type, season, episode);

alter table public.user_watched_episodes_v1 enable row level security;
revoke all on public.user_watched_episodes_v1 from public, anon, authenticated;

-- Legacy TV-only fetch RPC retained for previously shipped scripts.
create or replace function public.get_my_watched_episodes_v1(p_media_id bigint)
returns table(season integer, episode integer, watched_at timestamptz)
language sql security definer stable set search_path = public as $$
  select w.season, w.episode, w.watched_at
  from public.user_watched_episodes_v1 w
  where w.user_id = auth.uid() and w.media_id = p_media_id and w.media_type = 'tv'
  order by w.season, w.episode;
$$;
revoke all on function public.get_my_watched_episodes_v1(bigint) from public, anon;
grant execute on function public.get_my_watched_episodes_v1(bigint) to authenticated;

create or replace function public.get_my_watched_media_v1(p_media_id bigint, p_media_type text)
returns table(season integer, episode integer, watched_at timestamptz)
language plpgsql security definer stable set search_path = public as $$
declare
  v_type text := lower(trim(coalesce(p_media_type,'')));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_type not in ('movie','tv') or p_media_id is null or p_media_id <= 0 then
    raise exception 'Invalid media identity';
  end if;
  return query
    select w.season, w.episode, w.watched_at
    from public.user_watched_episodes_v1 w
    where w.user_id = auth.uid() and w.media_id = p_media_id and w.media_type = v_type
    order by w.season, w.episode;
end;
$$;
revoke all on function public.get_my_watched_media_v1(bigint,text) from public, anon;
grant execute on function public.get_my_watched_media_v1(bigint,text) to authenticated;

create or replace function public.mark_my_watched_media_v1(
  p_media_id bigint, p_media_type text, p_season integer, p_episode integer,
  p_position_seconds integer, p_duration_seconds integer
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_type text := lower(trim(coalesce(p_media_type,'')));
  v_season integer;
  v_episode integer;
  v_threshold integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_media_id is null or p_media_id <= 0 then raise exception 'Invalid media id'; end if;
  if v_type not in ('movie','tv') then raise exception 'Invalid media type'; end if;

  if v_type = 'movie' then
    v_season := 0; v_episode := 0;
  else
    if p_season is null or p_season <= 0 or p_episode is null or p_episode <= 0 then
      raise exception 'Invalid episode identity';
    end if;
    v_season := p_season; v_episode := p_episode;
  end if;

  if p_position_seconds is null or p_duration_seconds is null or p_duration_seconds <= 0 then
    raise exception 'Valid playback position and duration are required';
  end if;
  if p_duration_seconds > 600 then
    v_threshold := p_duration_seconds - 600;
  else
    v_threshold := ceil(p_duration_seconds * 0.5)::integer;
  end if;
  if p_position_seconds < v_threshold then raise exception 'Watched threshold has not been reached'; end if;

  insert into public.user_watched_episodes_v1(user_id, media_id, media_type, season, episode, watched_at)
  values (v_uid, p_media_id, v_type, v_season, v_episode, now())
  on conflict (user_id, media_id, season, episode)
  do update set watched_at = public.user_watched_episodes_v1.watched_at;
end;
$$;
revoke all on function public.mark_my_watched_media_v1(bigint,text,integer,integer,integer,integer) from public, anon;
grant execute on function public.mark_my_watched_media_v1(bigint,text,integer,integer,integer,integer) to authenticated;

-- Compatibility wrapper for older TV-only clients.
create or replace function public.mark_my_watched_episode_v1(
  p_media_id bigint, p_season integer, p_episode integer,
  p_position_seconds integer, p_duration_seconds integer
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.mark_my_watched_media_v1(
    p_media_id, 'tv', p_season, p_episode, p_position_seconds, p_duration_seconds
  );
end;
$$;
revoke all on function public.mark_my_watched_episode_v1(bigint,integer,integer,integer,integer) from public, anon;
grant execute on function public.mark_my_watched_episode_v1(bigint,integer,integer,integer,integer) to authenticated;

notify pgrst, 'reload schema';
commit;
