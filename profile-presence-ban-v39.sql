-- ============================================================
-- FLIX2WATCH v39 — RECENT TITLES + PRESENCE + STRICT BAN EVASION
-- RUN ONCE IN SUPABASE SQL EDITOR
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists pg_cron;

-- ------------------------------------------------------------
-- RECENTLY WATCHED / OPENED: EXACTLY 10 ROWS PER USER
-- ------------------------------------------------------------
create table if not exists public.profile_title_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null,
  media_id bigint not null,
  title text,
  poster_path text,
  last_opened_at timestamptz not null default now(),
  open_count bigint not null default 1,
  primary key(user_id,media_type,media_id)
);

create index if not exists profile_title_activity_user_last_v39_idx
  on public.profile_title_activity(user_id,last_opened_at desc);

create or replace function public.record_title_open_v39(
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

  insert into public.profile_title_activity(user_id,media_type,media_id,title,poster_path,last_opened_at,open_count)
  values(
    v_me,v_type,p_media_id,
    nullif(left(trim(coalesce(p_title,'')),250),''),
    nullif(left(trim(coalesce(p_poster_path,'')),500),''),
    now(),1
  )
  on conflict(user_id,media_type,media_id) do update
  set title=coalesce(excluded.title,public.profile_title_activity.title),
      poster_path=coalesce(excluded.poster_path,public.profile_title_activity.poster_path),
      last_opened_at=excluded.last_opened_at,
      open_count=public.profile_title_activity.open_count+1;

  -- Keep only the 10 most recently opened unique titles for this account.
  delete from public.profile_title_activity a
  where a.user_id=v_me
    and (a.media_type,a.media_id) in (
      select x.media_type,x.media_id
      from public.profile_title_activity x
      where x.user_id=v_me
      order by x.last_opened_at desc
      offset 10
    );
end;
$$;
grant execute on function public.record_title_open_v39(text,bigint,text,text) to authenticated;

create or replace function public.get_profile_recent_titles_v39(
  p_user_id uuid,
  p_limit integer default 10
)
returns table(
  media_type text,
  media_id bigint,
  title text,
  poster_path text,
  last_opened_at timestamptz,
  open_count bigint
)
language plpgsql
security definer
stable
set search_path=public
as $$
declare
  v_private boolean:=false;
begin
  select coalesce(is_private,false) into v_private
  from public.profiles where user_id=p_user_id;

  if v_private and auth.uid() is distinct from p_user_id then
    return;
  end if;

  return query
  select a.media_type,a.media_id,a.title,a.poster_path,a.last_opened_at,a.open_count
  from public.profile_title_activity a
  where a.user_id=p_user_id
  order by a.last_opened_at desc
  limit greatest(1,least(coalesce(p_limit,10),10));
end;
$$;
grant execute on function public.get_profile_recent_titles_v39(uuid,integer) to anon,authenticated;

-- Trim historical activity to 10 per account now.
delete from public.profile_title_activity a
using (
  select user_id,media_type,media_id,
         row_number() over(partition by user_id order by last_opened_at desc) rn
  from public.profile_title_activity
) old
where a.user_id=old.user_id
  and a.media_type=old.media_type
  and a.media_id=old.media_id
  and old.rn>10;

-- ------------------------------------------------------------
-- PRESENCE: 10s heartbeat, ~30s online expiry, multi-tab aware
-- ------------------------------------------------------------
create table if not exists public.user_presence_sessions (
  session_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
create index if not exists presence_sessions_user_seen_v39_idx
  on public.user_presence_sessions(user_id,last_seen_at desc);

alter table public.user_presence
  add column if not exists online_until timestamptz;

create or replace function public.touch_presence_v17(p_session_id text)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_now timestamptz:=clock_timestamp();
begin
  if v_me is null or nullif(trim(p_session_id),'') is null then return; end if;

  insert into public.user_presence_sessions(session_id,user_id,last_seen_at)
  values(left(p_session_id,200),v_me,v_now)
  on conflict(session_id) do update
  set user_id=excluded.user_id,last_seen_at=excluded.last_seen_at;

  insert into public.user_presence(user_id,last_seen_at,online_until)
  values(v_me,v_now,v_now+interval '30 seconds')
  on conflict(user_id) do update
  set last_seen_at=excluded.last_seen_at,
      online_until=excluded.online_until;
end;
$$;
grant execute on function public.touch_presence_v17(text) to authenticated;

create or replace function public.leave_presence_v17(p_session_id text)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_last timestamptz;
begin
  if v_me is null then return; end if;
  delete from public.user_presence_sessions where session_id=p_session_id and user_id=v_me;

  select max(last_seen_at) into v_last
  from public.user_presence_sessions
  where user_id=v_me and last_seen_at>clock_timestamp()-interval '30 seconds';

  update public.user_presence
  set last_seen_at=coalesce(v_last,clock_timestamp()),
      online_until=case when v_last is null then clock_timestamp() else v_last+interval '30 seconds' end
  where user_id=v_me;
end;
$$;
grant execute on function public.leave_presence_v17(text) to authenticated;

create or replace function public.get_public_profile_presence(p_user_id uuid)
returns table(online boolean,last_seen_at timestamptz)
language sql
security definer
stable
set search_path=public
as $$
  select
    coalesce(p.online_until>clock_timestamp(),false) as online,
    p.last_seen_at
  from public.user_presence p
  where p.user_id=p_user_id;
$$;
grant execute on function public.get_public_profile_presence(uuid) to anon,authenticated;

-- ------------------------------------------------------------
-- STRICT BAN-EVASION SEEDING
-- When an account is login-banned, copy every known device/fingerprint/IP
-- signal into the blocklist immediately.
-- ------------------------------------------------------------
create table if not exists public.account_device_signals (
  user_id uuid not null references auth.users(id) on delete cascade,
  signal_key text not null,
  device_hash text,
  fingerprint_hash text,
  ua_hash text,
  ip_hash text,
  ip_ua_hash text,
  last_seen_at timestamptz not null default now(),
  primary key(user_id,signal_key)
);

create table if not exists public.ban_evasion_blocks (
  id bigint generated by default as identity primary key,
  source_user_id uuid references auth.users(id) on delete cascade,
  signal_type text not null,
  signal_hash text not null,
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ban_evasion_blocks_hash_v39_idx
  on public.ban_evasion_blocks(signal_hash,signal_type);
create index if not exists account_device_signals_user_v39_idx
  on public.account_device_signals(user_id);

create or replace function public.seed_ban_evasion_blocks_v39(
  p_user_id uuid,
  p_reason text default 'Ban evasion protection',
  p_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if p_user_id is null or p_user_id='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then return; end if;

  insert into public.ban_evasion_blocks(source_user_id,signal_type,signal_hash,reason,expires_at)
  select p_user_id,x.signal_type,x.signal_hash,left(coalesce(p_reason,'Ban evasion protection'),500),p_expires_at
  from public.account_device_signals s
  cross join lateral (
    values
      ('device',s.device_hash),
      ('fingerprint',s.fingerprint_hash),
      ('ip_ua',s.ip_ua_hash),
      ('ip',s.ip_hash)
  ) x(signal_type,signal_hash)
  where s.user_id=p_user_id
    and nullif(x.signal_hash,'') is not null
    and not exists(
      select 1 from public.ban_evasion_blocks b
      where b.source_user_id=p_user_id
        and b.signal_type=x.signal_type
        and b.signal_hash=x.signal_hash
        and (b.expires_at is null or b.expires_at>now())
    );
end;
$$;
revoke all on function public.seed_ban_evasion_blocks_v39(uuid,text,timestamptz) from public;
grant execute on function public.seed_ban_evasion_blocks_v39(uuid,text,timestamptz) to service_role;

create or replace function public.f2w_login_ban_seed_guard_v39()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.seed_ban_evasion_blocks_v39(new.user_id,new.reason,new.expires_at);
  return new;
end;
$$;

drop trigger if exists f2w_login_ban_seed_guard_v39 on public.account_login_bans;
create trigger f2w_login_ban_seed_guard_v39
after insert or update of reason,expires_at
on public.account_login_bans
for each row execute function public.f2w_login_ban_seed_guard_v39();

-- Retroactively seed signals for accounts already banned.
do $$
declare r record;
begin
  for r in
    select user_id,reason,expires_at
    from public.account_login_bans
    where expires_at is null or expires_at>now()
  loop
    perform public.seed_ban_evasion_blocks_v39(r.user_id,r.reason,r.expires_at);
  end loop;
end $$;

-- ------------------------------------------------------------
-- REALTIME: make sure the tables that drive visible live UI are published.
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'user_presence','user_presence_sessions','profile_title_activity',
    'account_login_bans','account_events','staff_audit_log',
    'support_tickets','forum_threads','forum_replies'
  ]
  loop
    if to_regclass('public.'||t) is not null then
      begin
        execute format('alter publication supabase_realtime add table public.%I',t);
      exception when duplicate_object then null;
      end;
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 24-HOUR CHAT/DM RETENTION: verify scheduled purges remain installed.
-- ------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.purge_flix2watch_chat_24h()') is not null then
    perform public.purge_flix2watch_chat_24h();
  end if;
  if to_regprocedure('public.purge_flix2watch_dm_24h_v37()') is not null then
    perform public.purge_flix2watch_dm_24h_v37();
  end if;
end $$;

notify pgrst,'reload schema';

-- f2w-force-save:profile-presence-ban-v39:1788218599
 