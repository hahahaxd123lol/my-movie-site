-- Flix2Watch V203 — authoritative 10-second presence + stale current-watching cleanup.
-- Safe to rerun. This does not remove user data.
begin;

create table if not exists public.user_presence_sessions (
  session_id text primary key,
  user_id uuid not null,
  last_seen_at timestamptz not null default clock_timestamp(),
  constraint user_presence_sessions_id_len check(char_length(session_id) between 8 and 160)
);
create index if not exists user_presence_sessions_user_seen_v203_idx
  on public.user_presence_sessions(user_id,last_seen_at desc);

alter table public.user_presence_sessions enable row level security;
revoke all on public.user_presence_sessions from anon,authenticated;

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
  values(v_me,v_now,v_now,v_now+interval '22 seconds')
  on conflict(user_id) do update
    set last_seen_at=excluded.last_seen_at,
        updated_at=excluded.updated_at,
        online_until=excluded.online_until;

  -- Rare cleanup only; do not scan this table on every heartbeat.
  if random()<0.005 then
    delete from public.user_presence_sessions where last_seen_at<v_now-interval '1 day';
  end if;

  return v_now;
end;
$$;
grant execute on function public.touch_presence_v203(text) to authenticated;

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
    and last_seen_at>v_now-interval '22 seconds';

  if v_other is null then
    update public.user_presence
       set last_seen_at=v_now,updated_at=v_now,online_until=v_now
     where user_id=v_me;
  else
    update public.user_presence
       set last_seen_at=greatest(coalesce(last_seen_at,v_other),v_other),
           updated_at=v_now,
           online_until=v_other+interval '22 seconds'
     where user_id=v_me;
  end if;
  return v_now;
end;
$$;
grant execute on function public.leave_presence_v203(text) to authenticated;

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
  select t.user_id,
         greatest(up.last_seen_at,ls.last_seen_at) as last_seen_at,
         coalesce(ls.last_seen_at>clock_timestamp()-interval '22 seconds',false) as online
  from target t
  left join public.user_presence up on up.user_id=t.user_id
  left join latest_session ls on ls.user_id=t.user_id;
$$;
grant execute on function public.get_public_profile_presence_v203(text) to anon,authenticated;

create or replace function public.get_public_current_watching_v203(p_username text)
returns table(
  user_id uuid,
  media_type text,
  media_id bigint,
  title text,
  poster_path text,
  last_seen_at timestamptz,
  source_key text,
  position_seconds integer,
  duration_seconds integer,
  playback_status text,
  progress_updated_at timestamptz
)
language sql
security definer
stable
set search_path=public
as $$
  with target as (
    select p.user_id,p.is_private
    from public.profiles p
    where lower(p.username)=lower(trim(regexp_replace(coalesce(p_username,''),'[^A-Za-z0-9]','','g')))
    limit 1
  ), alive as (
    select s.user_id,max(s.last_seen_at) as last_seen_at
    from public.user_presence_sessions s
    join target t on t.user_id=s.user_id
    group by s.user_id
  )
  select
    c.user_id,
    c.media_type,
    c.media_id,
    c.title,
    coalesce(c.poster_path,r.poster_path),
    c.last_seen_at,
    c.source_key,
    c.position_seconds,
    c.duration_seconds,
    coalesce(nullif(c.playback_status,''),'unknown'),
    c.progress_updated_at
  from public.current_watching_v125 c
  join target t on t.user_id=c.user_id
  join alive a on a.user_id=c.user_id
  left join public.profile_recent_views_v59 r
    on r.user_id=c.user_id
   and r.media_type=c.media_type
   and r.media_id=c.media_id
  where a.last_seen_at>clock_timestamp()-interval '22 seconds'
    and c.last_seen_at>clock_timestamp()-interval '45 seconds'
    and coalesce(lower(c.playback_status),'unknown') not in ('completed','stopped')
    and (coalesce(t.is_private,false)=false or auth.uid()=c.user_id)
  limit 1;
$$;
grant execute on function public.get_public_current_watching_v203(text) to anon,authenticated;

-- Keep realtime available for open profile pages.
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
