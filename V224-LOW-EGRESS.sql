-- Flix2Watch V224 — low-egress presence lease.
-- Run once after V203/V205. Does not remove or reset user data.

begin;

create or replace function public.touch_presence_v203(p_session_id text)
returns timestamptz
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_now timestamptz:=clock_timestamp();
  v_sid text:=left(trim(coalesce(p_session_id,'')),160);
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if char_length(v_sid)<8 then raise exception 'Invalid presence session'; end if;

  insert into public.user_presence_sessions(session_id,user_id,last_seen_at)
  values(v_sid,v_me,v_now)
  on conflict(session_id) do update
    set user_id=excluded.user_id,last_seen_at=excluded.last_seen_at;

  insert into public.user_presence(user_id,last_seen_at,updated_at,online_until)
  values(v_me,v_now,v_now,v_now+interval '75 seconds')
  on conflict(user_id) do update
    set last_seen_at=excluded.last_seen_at,
        updated_at=excluded.updated_at,
        online_until=excluded.online_until;

  if random()<0.005 then
    delete from public.user_presence_sessions where last_seen_at<v_now-interval '1 day';
  end if;

  return v_now;
end;
$$;

create or replace function public.leave_presence_v203(p_session_id text)
returns timestamptz
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_now timestamptz:=clock_timestamp();
  v_sid text:=left(trim(coalesce(p_session_id,'')),160);
  v_other timestamptz;
begin
  if v_me is null then return v_now; end if;

  delete from public.user_presence_sessions
  where session_id=v_sid and user_id=v_me;

  select max(last_seen_at) into v_other
  from public.user_presence_sessions
  where user_id=v_me
    and last_seen_at>v_now-interval '75 seconds';

  if v_other is null then
    update public.user_presence
       set last_seen_at=v_now,updated_at=v_now,online_until=v_now
     where user_id=v_me;
  else
    update public.user_presence
       set last_seen_at=greatest(coalesce(last_seen_at,v_other),v_other),
           updated_at=v_now,
           online_until=v_other+interval '75 seconds'
     where user_id=v_me;
  end if;

  return v_now;
end;
$$;

create or replace function public.get_public_profile_presence_v203(p_username text)
returns table(user_id uuid,last_seen_at timestamptz,online boolean)
language sql
security definer
stable
set search_path=public
as $$
  with target as (
    select p.user_id
    from public.profiles p
    where lower(p.username)=lower(trim(regexp_replace(coalesce(p_username,''),'[^A-Za-z0-9]','','g')))
    limit 1
  ), latest_session as (
    select s.user_id,max(s.last_seen_at) as last_seen_at
    from public.user_presence_sessions s
    join target t on t.user_id=s.user_id
    group by s.user_id
  )
  select
    t.user_id,
    greatest(up.last_seen_at,ls.last_seen_at) as last_seen_at,
    coalesce(ls.last_seen_at>clock_timestamp()-interval '75 seconds',false) as online
  from target t
  left join public.user_presence up on up.user_id=t.user_id
  left join latest_session ls on ls.user_id=t.user_id;
$$;

-- V205 combined profile snapshot: Online gets the 75-second site-presence
-- window, while Currently Watching intentionally keeps its existing tight
-- 25-second freshness rule.
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
    select p.user_id,coalesce(p.is_private,false) as is_private
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
      coalesce(ps.session_seen>clock_timestamp()-interval '75 seconds',false)
      or coalesce(cw.last_seen_at>clock_timestamp()-interval '25 seconds',false)
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
    on rv.user_id=cw.user_id
   and rv.media_type=cw.media_type
   and rv.media_id=cw.media_id
  cross join lateral (
    select (
      cw.media_id is not null
      and cw.last_seen_at>clock_timestamp()-interval '25 seconds'
      and coalesce(lower(cw.playback_status),'unknown') not in ('completed','stopped')
      and (not t.is_private or auth.uid()=t.user_id)
    ) as allow_watch
  ) live;
$$;

grant execute on function public.touch_presence_v203(text) to authenticated;
grant execute on function public.leave_presence_v203(text) to authenticated;
grant execute on function public.get_public_profile_presence_v203(text) to anon,authenticated;
grant execute on function public.get_public_profile_live_v205(text) to anon,authenticated;

notify pgrst,'reload schema';

commit;

-- f2w-force-save:v224-low-egress-presence-sql:20260903
