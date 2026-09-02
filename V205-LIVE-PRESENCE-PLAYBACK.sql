-- Flix2Watch V205 — one public authority for profile presence + current playback.
-- Safe to rerun after V203/V201.
begin;

create or replace function public.get_public_profile_live_v205(p_username text)
returns table(
  user_id uuid,
  last_seen_at timestamptz,
  online boolean,
  watching_media_type text,
  watching_media_id bigint,
  watching_title text,
  watching_poster_path text,
  watching_last_seen_at timestamptz,
  watching_source_key text,
  watching_position_seconds integer,
  watching_duration_seconds integer,
  watching_playback_status text,
  watching_progress_updated_at timestamptz
)
language sql
security definer
stable
set search_path=public
as $$
  with target as (
    select p.user_id, coalesce(p.is_private,false) as is_private
    from public.profiles p
    where lower(p.username)=lower(trim(regexp_replace(coalesce(p_username,''),'[^A-Za-z0-9]','','g')))
    limit 1
  ), ps as (
    select s.user_id,max(s.last_seen_at) as session_seen
    from public.user_presence_sessions s
    join target t on t.user_id=s.user_id
    group by s.user_id
  ), cw as (
    select c.*
    from public.current_watching_v125 c
    join target t on t.user_id=c.user_id
    limit 1
  )
  select
    t.user_id,
    greatest(
      coalesce(ps.session_seen,'epoch'::timestamptz),
      coalesce(up.last_seen_at,'epoch'::timestamptz),
      coalesce(cw.last_seen_at,'epoch'::timestamptz)
    ) as last_seen_at,
    (
      coalesce(ps.session_seen > clock_timestamp()-interval '25 seconds',false)
      or coalesce(cw.last_seen_at > clock_timestamp()-interval '25 seconds',false)
    ) as online,
    case when live.allow_watch then cw.media_type end,
    case when live.allow_watch then cw.media_id end,
    case when live.allow_watch then cw.title end,
    case when live.allow_watch then coalesce(cw.poster_path,rv.poster_path) end,
    case when live.allow_watch then cw.last_seen_at end,
    case when live.allow_watch then cw.source_key end,
    case when live.allow_watch then cw.position_seconds end,
    case when live.allow_watch then cw.duration_seconds end,
    case when live.allow_watch then coalesce(nullif(cw.playback_status,''),'unknown') end,
    case when live.allow_watch then cw.progress_updated_at end
  from target t
  left join ps on ps.user_id=t.user_id
  left join public.user_presence up on up.user_id=t.user_id
  left join cw on cw.user_id=t.user_id
  left join public.profile_recent_views_v59 rv
    on rv.user_id=cw.user_id and rv.media_type=cw.media_type and rv.media_id=cw.media_id
  cross join lateral (
    select (
      cw.media_id is not null
      and cw.last_seen_at > clock_timestamp()-interval '25 seconds'
      and coalesce(lower(cw.playback_status),'unknown') not in ('completed','stopped')
      and (not t.is_private or auth.uid()=t.user_id)
    ) as allow_watch
  ) live;
$$;

grant execute on function public.get_public_profile_live_v205(text) to anon,authenticated;

-- Keep the two tiny live tables available to open profile pages.
do $$
begin
  if to_regclass('public.user_presence') is not null
     and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='user_presence') then
    alter publication supabase_realtime add table public.user_presence;
  end if;
  if to_regclass('public.current_watching_v125') is not null
     and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='current_watching_v125') then
    alter publication supabase_realtime add table public.current_watching_v125;
  end if;
end $$;

commit;
notify pgrst,'reload schema';
