-- Re-published on 2026-10-12 to ensure the updated movie + TV migration is pushed to main.
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


-- Best-effort historical backfill across existing public playback/history tables.
-- Completed records in the v132 resume table may already have been deleted. Search
-- for other retained account-linked tables as well, without guessing or transferring UIDs.
-- A record is imported only when it has a real user_id + media identity and either:
-- (a) progress is at the watched threshold, or (b) its data explicitly says completed/watched.
do $f2w_historical_backfill$
declare
  t record;
  cols text[];
  season_col text;
  episode_col text;
  position_col text;
  duration_col text;
  position_expr text;
  duration_expr text;
  season_expr text;
  episode_expr text;
  completion_expr text;
  progress_expr text;
  inserted bigint;
  total_inserted bigint := 0;
  candidate_tables integer := 0;
begin
  for t in
    select n.nspname as schema_name, c.relname as table_name,
           c.oid as relation_id
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r','p')
      and c.relname <> 'user_watched_episodes_v1'
    order by c.relname
  loop
    select coalesce(array_agg(a.attname), array[]::text[])
      into cols
    from pg_attribute a
    where a.attrelid = t.relation_id and a.attnum > 0 and not a.attisdropped;

    -- Ignore unrelated tables, including ordinary favorites.
    if not ('user_id' = any(cols)
      and 'media_id' = any(cols)
      and 'media_type' = any(cols)) then
      continue;
    end if;

    season_col := case
      when 'season' = any(cols) then 'season'
      when 'season_number' = any(cols) then 'season_number'
      else null
    end;
    episode_col := case
      when 'episode' = any(cols) then 'episode'
      when 'episode_number' = any(cols) then 'episode_number'
      else null
    end;
    position_col := case
      when 'position_seconds' = any(cols) then 'position_seconds'
      when 'player_position_seconds' = any(cols) then 'player_position_seconds'
      when 'progress_seconds' = any(cols) then 'progress_seconds'
      when 'current_time_seconds' = any(cols) then 'current_time_seconds'
      else null
    end;
    duration_col := case
      when 'duration_seconds' = any(cols) then 'duration_seconds'
      when 'player_duration_seconds' = any(cols) then 'player_duration_seconds'
      else null
    end;

    -- Need either a progress/duration pair or an explicit watched/completed signal.
    if not (
      (position_col is not null and duration_col is not null)
      or 'completed' = any(cols)
      or 'is_completed' = any(cols)
      or 'watched' = any(cols)
      or 'is_watched' = any(cols)
      or 'playback_status' = any(cols)
      or 'status' = any(cols)
      or 'completed_at' = any(cols)
      or 'finished_at' = any(cols)
      or 'watched_at' = any(cols)
    ) then
      continue;
    end if;

    if position_col is null then
      position_expr := 'null::numeric';
    else
      position_expr := format(
        'case when (to_jsonb(p)->>%L) ~ ''^-?[0-9]+([.][0-9]+)?$'' then (to_jsonb(p)->>%L)::numeric end',
        position_col, position_col
      );
    end if;

    if duration_col is null then
      duration_expr := 'null::numeric';
    else
      duration_expr := format(
        'case when (to_jsonb(p)->>%L) ~ ''^[0-9]+([.][0-9]+)?$'' then (to_jsonb(p)->>%L)::numeric end',
        duration_col, duration_col
      );
    end if;

    if season_col is null then
      season_expr := 'null::integer';
    else
      season_expr := format(
        'case when (to_jsonb(p)->>%L) ~ ''^[0-9]+$'' then (to_jsonb(p)->>%L)::integer end',
        season_col, season_col
      );
    end if;

    if episode_col is null then
      episode_expr := 'null::integer';
    else
      episode_expr := format(
        'case when (to_jsonb(p)->>%L) ~ ''^[0-9]+$'' then (to_jsonb(p)->>%L)::integer end',
        episode_col, episode_col
      );
    end if;

    completion_expr := $completion$
      (
        lower(coalesce(to_jsonb(p)->>'playback_status', '')) in
          ('complete','completed','ended','finished','watched')
        or lower(coalesce(to_jsonb(p)->>'status', '')) in
          ('complete','completed','ended','finished','watched')
        or lower(coalesce(to_jsonb(p)->>'completed', '')) in ('true','t','1','yes','completed')
        or lower(coalesce(to_jsonb(p)->>'is_completed', '')) in ('true','t','1','yes','completed')
        or lower(coalesce(to_jsonb(p)->>'watched', '')) in ('true','t','1','yes','watched')
        or lower(coalesce(to_jsonb(p)->>'is_watched', '')) in ('true','t','1','yes','watched')
        or nullif(to_jsonb(p)->>'completed_at', '') is not null
        or nullif(to_jsonb(p)->>'finished_at', '') is not null
        or nullif(to_jsonb(p)->>'watched_at', '') is not null
      )
    $completion$;

    candidate_tables := candidate_tables + 1;

    progress_expr := format(
      '(%1$s is not null and %2$s is not null and %2$s > 0 and %1$s >= case when %2$s > 600 then %2$s - 600 else ceil(%2$s * 0.5) end)',
      position_expr, duration_expr
    );

    execute format($sql$
      insert into public.user_watched_episodes_v1
        (user_id, media_id, media_type, season, episode)
      select
        case when (to_jsonb(p)->>'user_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}
        case
          when lower(trim(to_jsonb(p)->>'media_type')) in ('movie','film') then 'movie'
          when lower(trim(to_jsonb(p)->>'media_type')) in ('tv','series','show') then 'tv'
          else null
        end,
        case
          when lower(trim(to_jsonb(p)->>'media_type')) in ('movie','film') then 0
          else %s
        end,
        case
          when lower(trim(to_jsonb(p)->>'media_type')) in ('movie','film') then 0
          else %s
        end
      from %I.%I p
      where (to_jsonb(p)->>'user_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (to_jsonb(p)->>'media_id') ~ '^[0-9]{1,18}$'
        and case when (to_jsonb(p)->>'media_id') ~ '^[0-9]{1,18}        and lower(trim(coalesce(to_jsonb(p)->>'media_type',''))) in ('movie','film','tv','series','show')
        and (
          %s
          or %s
        )
        and (
          lower(trim(to_jsonb(p)->>'media_type')) in ('movie','film')
          or (%s is not null and %s is not null and %s > 0 and %s > 0)
        )
      on conflict (user_id, media_id, season, episode) do nothing
    $sql$,
      season_expr, episode_expr, t.schema_name, t.table_name,
      completion_expr, progress_expr,
      season_expr, episode_expr, season_expr, episode_expr
    );

    get diagnostics inserted = row_count;
    total_inserted := total_inserted + inserted;

    if inserted > 0 then
      raise notice 'Recovered % watched records from %.%', inserted, t.schema_name, t.table_name;
    end if;
  end loop;

  raise notice 'Historical watched backfill checked % candidate tables. Total new records recovered: %.', candidate_tables, total_inserted;
end;
$f2w_historical_backfill$;

notify pgrst, 'reload schema';
commit;
 then (to_jsonb(p)->>'user_id')::uuid end,
        case when (to_jsonb(p)->>'media_id') ~ '^[0-9]{1,18}
        case
          when lower(trim(to_jsonb(p)->>'media_type')) in ('movie','film') then 'movie'
          when lower(trim(to_jsonb(p)->>'media_type')) in ('tv','series','show') then 'tv'
          else null
        end,
        case
          when lower(trim(to_jsonb(p)->>'media_type')) in ('movie','film') then 0
          else %s
        end,
        case
          when lower(trim(to_jsonb(p)->>'media_type')) in ('movie','film') then 0
          else %s
        end
      from %I.%I p
      where (to_jsonb(p)->>'user_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (to_jsonb(p)->>'media_id') ~ '^[0-9]{1,18}$'
        and (to_jsonb(p)->>'media_id')::numeric > 0
        and lower(trim(coalesce(to_jsonb(p)->>'media_type',''))) in ('movie','film','tv','series','show')
        and (
          %s
          or %s
        )
        and (
          lower(trim(to_jsonb(p)->>'media_type')) in ('movie','film')
          or (%s is not null and %s is not null and %s > 0 and %s > 0)
        )
      on conflict (user_id, media_id, season, episode) do nothing
    $sql$,
      season_expr, episode_expr, t.schema_name, t.table_name,
      completion_expr, progress_expr,
      season_expr, episode_expr, season_expr, episode_expr
    );

    get diagnostics inserted = row_count;
    total_inserted := total_inserted + inserted;

    if inserted > 0 then
      raise notice 'Recovered % watched records from %.%', inserted, t.schema_name, t.table_name;
    end if;
  end loop;

  raise notice 'Historical watched backfill complete. Total new records recovered: %.', total_inserted;
end;
$f2w_historical_backfill$;

notify pgrst, 'reload schema';
commit;
 then (to_jsonb(p)->>'media_id')::bigint end,
        case
          when lower(trim(to_jsonb(p)->>'media_type')) in ('movie','film') then 'movie'
          when lower(trim(to_jsonb(p)->>'media_type')) in ('tv','series','show') then 'tv'
          else null
        end,
        case
          when lower(trim(to_jsonb(p)->>'media_type')) in ('movie','film') then 0
          else %s
        end,
        case
          when lower(trim(to_jsonb(p)->>'media_type')) in ('movie','film') then 0
          else %s
        end
      from %I.%I p
      where (to_jsonb(p)->>'user_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (to_jsonb(p)->>'media_id') ~ '^[0-9]{1,18}$'
        and (to_jsonb(p)->>'media_id')::numeric > 0
        and lower(trim(coalesce(to_jsonb(p)->>'media_type',''))) in ('movie','film','tv','series','show')
        and (
          %s
          or %s
        )
        and (
          lower(trim(to_jsonb(p)->>'media_type')) in ('movie','film')
          or (%s is not null and %s is not null and %s > 0 and %s > 0)
        )
      on conflict (user_id, media_id, season, episode) do nothing
    $sql$,
      season_expr, episode_expr, t.schema_name, t.table_name,
      completion_expr, progress_expr,
      season_expr, episode_expr, season_expr, episode_expr
    );

    get diagnostics inserted = row_count;
    total_inserted := total_inserted + inserted;

    if inserted > 0 then
      raise notice 'Recovered % watched records from %.%', inserted, t.schema_name, t.table_name;
    end if;
  end loop;

  raise notice 'Historical watched backfill complete. Total new records recovered: %.', total_inserted;
end;
$f2w_historical_backfill$;

notify pgrst, 'reload schema';
commit;
 then (to_jsonb(p)->>'media_id')::numeric > 0 else false end
        and lower(trim(coalesce(to_jsonb(p)->>'media_type',''))) in ('movie','film','tv','series','show')
        and (
          %s
          or %s
        )
        and (
          lower(trim(to_jsonb(p)->>'media_type')) in ('movie','film')
          or (%s is not null and %s is not null and %s > 0 and %s > 0)
        )
      on conflict (user_id, media_id, season, episode) do nothing
    $sql$,
      season_expr, episode_expr, t.schema_name, t.table_name,
      completion_expr, progress_expr,
      season_expr, episode_expr, season_expr, episode_expr
    );

    get diagnostics inserted = row_count;
    total_inserted := total_inserted + inserted;

    if inserted > 0 then
      raise notice 'Recovered % watched records from %.%', inserted, t.schema_name, t.table_name;
    end if;
  end loop;

  raise notice 'Historical watched backfill complete. Total new records recovered: %.', total_inserted;
end;
$f2w_historical_backfill$;

notify pgrst, 'reload schema';
commit;
 then (to_jsonb(p)->>'user_id')::uuid end,
        case when (to_jsonb(p)->>'media_id') ~ '^[0-9]{1,18}
        case
          when lower(trim(to_jsonb(p)->>'media_type')) in ('movie','film') then 'movie'
          when lower(trim(to_jsonb(p)->>'media_type')) in ('tv','series','show') then 'tv'
          else null
        end,
        case
          when lower(trim(to_jsonb(p)->>'media_type')) in ('movie','film') then 0
          else %s
        end,
        case
          when lower(trim(to_jsonb(p)->>'media_type')) in ('movie','film') then 0
          else %s
        end
      from %I.%I p
      where (to_jsonb(p)->>'user_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (to_jsonb(p)->>'media_id') ~ '^[0-9]{1,18}$'
        and (to_jsonb(p)->>'media_id')::numeric > 0
        and lower(trim(coalesce(to_jsonb(p)->>'media_type',''))) in ('movie','film','tv','series','show')
        and (
          %s
          or %s
        )
        and (
          lower(trim(to_jsonb(p)->>'media_type')) in ('movie','film')
          or (%s is not null and %s is not null and %s > 0 and %s > 0)
        )
      on conflict (user_id, media_id, season, episode) do nothing
    $sql$,
      season_expr, episode_expr, t.schema_name, t.table_name,
      completion_expr, progress_expr,
      season_expr, episode_expr, season_expr, episode_expr
    );

    get diagnostics inserted = row_count;
    total_inserted := total_inserted + inserted;

    if inserted > 0 then
      raise notice 'Recovered % watched records from %.%', inserted, t.schema_name, t.table_name;
    end if;
  end loop;

  raise notice 'Historical watched backfill complete. Total new records recovered: %.', total_inserted;
end;
$f2w_historical_backfill$;

notify pgrst, 'reload schema';
commit;
 then (to_jsonb(p)->>'media_id')::bigint end,
        case
          when lower(trim(to_jsonb(p)->>'media_type')) in ('movie','film') then 'movie'
          when lower(trim(to_jsonb(p)->>'media_type')) in ('tv','series','show') then 'tv'
          else null
        end,
        case
          when lower(trim(to_jsonb(p)->>'media_type')) in ('movie','film') then 0
          else %s
        end,
        case
          when lower(trim(to_jsonb(p)->>'media_type')) in ('movie','film') then 0
          else %s
        end
      from %I.%I p
      where (to_jsonb(p)->>'user_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and (to_jsonb(p)->>'media_id') ~ '^[0-9]{1,18}$'
        and (to_jsonb(p)->>'media_id')::numeric > 0
        and lower(trim(coalesce(to_jsonb(p)->>'media_type',''))) in ('movie','film','tv','series','show')
        and (
          %s
          or %s
        )
        and (
          lower(trim(to_jsonb(p)->>'media_type')) in ('movie','film')
          or (%s is not null and %s is not null and %s > 0 and %s > 0)
        )
      on conflict (user_id, media_id, season, episode) do nothing
    $sql$,
      season_expr, episode_expr, t.schema_name, t.table_name,
      completion_expr, progress_expr,
      season_expr, episode_expr, season_expr, episode_expr
    );

    get diagnostics inserted = row_count;
    total_inserted := total_inserted + inserted;

    if inserted > 0 then
      raise notice 'Recovered % watched records from %.%', inserted, t.schema_name, t.table_name;
    end if;
  end loop;

  raise notice 'Historical watched backfill complete. Total new records recovered: %.', total_inserted;
end;
$f2w_historical_backfill$;

notify pgrst, 'reload schema';
commit;
