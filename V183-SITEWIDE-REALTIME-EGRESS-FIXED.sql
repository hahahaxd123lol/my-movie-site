-- ============================================================
-- FLIX2WATCH V183 — realtime correctness + low-egress hardening
-- Safe to re-run. Does not remove user-facing features.
-- ============================================================

-- Fast lookup indexes used repeatedly by profile, presence, recent-watch and leaderboard paths.
create index if not exists profiles_username_lower_v183_idx on public.profiles(lower(username));
create index if not exists user_presence_user_v183_idx on public.user_presence(user_id);
create index if not exists user_presence_online_v183_idx on public.user_presence(online_until) where online_until is not null;
create index if not exists profile_watch_time_user_v183_idx on public.profile_watch_time(user_id);
create index if not exists profile_watch_time_user_media_v183_idx on public.profile_watch_time(user_id,media_type,media_id);
create index if not exists current_watching_v125_user_seen_v183_idx on public.current_watching_v125(user_id,last_seen_at desc);
create index if not exists user_ratings_user_v183_idx on public.user_ratings(user_id);

-- Membership age: auth.users.created_at is the one authoritative timestamp.
create or replace function public.get_profile_member_since_v139(p_username text)
returns timestamptz
language sql
security definer
stable
set search_path=public,auth
as $$
  select u.created_at
  from public.profiles p
  join auth.users u on u.id=p.user_id
  where lower(p.username)=lower(trim(coalesce(p_username,'')))
  limit 1
$$;
grant execute on function public.get_profile_member_since_v139(text) to anon,authenticated;

-- Keep recent watched compact: at most 10 unique rows per account.
create table if not exists public.profile_recent_views_v59 (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('movie','tv')),
  media_id bigint not null,
  title text,
  poster_path text,
  viewed_at timestamptz not null default now(),
  primary key(user_id,media_type,media_id)
);
create index if not exists profile_recent_views_v59_user_viewed_v183_idx on public.profile_recent_views_v59(user_id,viewed_at desc);

create or replace function public.record_recent_view_v59(
  p_media_type text,
  p_media_id bigint,
  p_title text default null,
  p_poster_path text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_type text:=case when lower(trim(coalesce(p_media_type,'')))='tv' then 'tv' else 'movie' end;
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if p_media_id is null or p_media_id<=0 then raise exception 'Invalid title'; end if;

  insert into public.profile_recent_views_v59(user_id,media_type,media_id,title,poster_path,viewed_at)
  values(v_me,v_type,p_media_id,nullif(left(trim(coalesce(p_title,'')),250),''),nullif(left(trim(coalesce(p_poster_path,'')),500),''),now())
  on conflict(user_id,media_type,media_id) do update
  set title=coalesce(excluded.title,public.profile_recent_views_v59.title),
      poster_path=coalesce(excluded.poster_path,public.profile_recent_views_v59.poster_path),
      viewed_at=excluded.viewed_at;

  delete from public.profile_recent_views_v59 r
  where r.user_id=v_me
    and (r.media_type,r.media_id) in (
      select x.media_type,x.media_id
      from public.profile_recent_views_v59 x
      where x.user_id=v_me
      order by x.viewed_at desc
      offset 10
    );
end;
$$;
revoke all on function public.record_recent_view_v59(text,bigint,text,text) from public;
grant execute on function public.record_recent_view_v59(text,bigint,text,text) to authenticated;

create or replace function public.get_profile_recent_views_v59(p_user_id uuid,p_limit integer default 10)
returns table(media_type text,media_id bigint,title text,poster_path text,viewed_at timestamptz)
language plpgsql
security definer
stable
set search_path=public
as $$
declare v_private boolean:=false;
begin
  if p_user_id is null then return; end if;
  select coalesce(p.is_private,false) into v_private from public.profiles p where p.user_id=p_user_id;
  if v_private and auth.uid() is distinct from p_user_id then return; end if;
  return query
  select r.media_type,r.media_id,r.title,r.poster_path,r.viewed_at
  from public.profile_recent_views_v59 r
  where r.user_id=p_user_id
  order by r.viewed_at desc
  limit greatest(1,least(coalesce(p_limit,10),10));
end;
$$;
revoke all on function public.get_profile_recent_views_v59(uuid,integer) from public;
grant execute on function public.get_profile_recent_views_v59(uuid,integer) to anon,authenticated;

-- Current watching: return the smallest useful row and fill missing art from recent history.
create or replace function public.get_public_current_watching_v177(p_username text)
returns table(
  user_id uuid,media_type text,media_id bigint,title text,poster_path text,last_seen_at timestamptz,
  source_key text,position_seconds integer,duration_seconds integer,playback_status text,progress_updated_at timestamptz
)
language sql
security definer
stable
set search_path=public
as $$
  select c.user_id,c.media_type,c.media_id,c.title,
         coalesce(c.poster_path,r.poster_path) as poster_path,
         c.last_seen_at,c.source_key,c.position_seconds,c.duration_seconds,c.playback_status,c.progress_updated_at
  from public.current_watching_v125 c
  join public.profiles p on p.user_id=c.user_id
  left join public.profile_recent_views_v59 r
    on r.user_id=c.user_id and r.media_type=c.media_type and r.media_id=c.media_id
  where lower(p.username)=lower(trim(p_username))
    and c.last_seen_at>clock_timestamp()-interval '75 seconds'
    and (coalesce(p.is_private,false)=false or auth.uid()=p.user_id)
  limit 1;
$$;
revoke all on function public.get_public_current_watching_v177(text) from public;
grant execute on function public.get_public_current_watching_v177(text) to anon,authenticated;

-- Presence remains one tiny heartbeat every ~30s. Online expires quickly when heartbeats stop.
-- The older site version used a different return type for this RPC. PostgreSQL cannot
-- change a function return type with CREATE OR REPLACE, so remove that exact signature first.
drop function if exists public.touch_presence_v17(text);

create function public.touch_presence_v17(p_session_id text)
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
  on conflict(session_id) do update set user_id=excluded.user_id,last_seen_at=excluded.last_seen_at;

  insert into public.user_presence(user_id,last_seen_at,updated_at,online_until)
  values(v_me,v_now,v_now,v_now+interval '45 seconds')
  on conflict(user_id) do update
  set last_seen_at=excluded.last_seen_at,updated_at=excluded.updated_at,online_until=excluded.online_until;

  -- Cleanup is intentionally rare, not on every heartbeat.
  if random()<0.01 then
    delete from public.user_presence_sessions where last_seen_at < v_now-interval '1 day';
  end if;
  return v_now;
end;
$$;
grant execute on function public.touch_presence_v17(text) to authenticated;

-- Correct ban/suspension notifications directly from the authoritative enforcement row.
create or replace function public.f2w_notify_enforcement_change_v183()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor uuid:=new.updated_by;
  v_old_site boolean:=case when tg_op='INSERT' then false else coalesce(old.site_suspended,false) end;
  v_old_ban boolean:=case when tg_op='INSERT' then false else coalesce(old.account_banned,false) end;
  v_new_site boolean:=coalesce(new.site_suspended,false);
  v_new_ban boolean:=coalesce(new.account_banned,false);
  v_reason text:=nullif(trim(coalesce(new.reason,'')),'');
begin
  if to_regclass('public.user_notifications') is null then return new; end if;

  if v_old_site is distinct from v_new_site then
    insert into public.user_notifications(user_id,actor_user_id,notification_type,title,body,link)
    select new.user_id,v_actor,
           case when v_new_site then 'suspension' else 'unsuspension' end,
           case when v_new_site then 'Site suspension applied' else 'Site suspension removed' end,
           case when v_new_site then coalesce('Your site access was suspended. Reason: '||v_reason,'Your site access was suspended.') else 'Your site suspension was removed.' end,
           case when v_new_site then '/support/' else '/account/' end
    where not exists(
      select 1 from public.user_notifications n
      where n.user_id=new.user_id
        and n.title=case when v_new_site then 'Site suspension applied' else 'Site suspension removed' end
        and n.created_at>now()-interval '5 seconds'
    );
  end if;

  if v_old_ban is distinct from v_new_ban then
    insert into public.user_notifications(user_id,actor_user_id,notification_type,title,body,link)
    select new.user_id,v_actor,
           case when v_new_ban then 'ban' else 'unban' end,
           case when v_new_ban then 'Account login ban applied' else 'Account login ban removed' end,
           case when v_new_ban then coalesce('Your account login was banned. Reason: '||v_reason,'Your account login was banned.') else 'Your account login ban was removed.' end,
           '/account/'
    where not exists(
      select 1 from public.user_notifications n
      where n.user_id=new.user_id
        and n.title=case when v_new_ban then 'Account login ban applied' else 'Account login ban removed' end
        and n.created_at>now()-interval '5 seconds'
    );
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.account_enforcement_v146') is not null then
    execute 'drop trigger if exists f2w_notify_enforcement_change_v183 on public.account_enforcement_v146';
    execute 'create trigger f2w_notify_enforcement_change_v183 after insert or update of site_suspended,account_banned,reason on public.account_enforcement_v146 for each row execute function public.f2w_notify_enforcement_change_v183()';
  end if;
end $$;

-- Seven-day notification retention, with a cheap index for cleanup and page reads.
create index if not exists user_notifications_user_created_v183_idx on public.user_notifications(user_id,created_at desc);
create index if not exists user_notifications_created_v183_idx on public.user_notifications(created_at);
delete from public.user_notifications where created_at<now()-interval '7 days';

notify pgrst,'reload schema';
-- f2w-force-save:v183-realtime-egress-sql:20260902

-- V183 SQL return-type compatibility fix 2026-09-02
