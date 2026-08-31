-- ============================================================
-- FLIX2WATCH V35 — realtime social / leaderboard / quick moderation
-- Run AFTER staff_control_center_setup.sql, V16, V17 and V34.
-- Safe to run again.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- richer profiles ----------
alter table public.profiles
  add column if not exists location text,
  add column if not exists favorite_genres text[] not null default '{}'::text[],
  add column if not exists website_url text,
  add column if not exists instagram_username text,
  add column if not exists discord_username text,
  add column if not exists profile_accent text not null default 'red';

do $$ begin
  alter table public.profiles
    add constraint profiles_profile_accent_v35_check
    check (profile_accent in ('red','purple','blue','green','gold'));
exception when duplicate_object then null; end $$;

create or replace function public.update_my_profile_v35(
  p_display_name text default null,
  p_bio text default null,
  p_avatar_url text default null,
  p_is_private boolean default false,
  p_location text default null,
  p_favorite_genres text[] default '{}'::text[],
  p_website_url text default null,
  p_instagram_username text default null,
  p_discord_username text default null,
  p_profile_accent text default 'red'
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_result jsonb;
  v_avatar text:=nullif(left(trim(coalesce(p_avatar_url,'')),2048),'');
  v_site text:=nullif(left(trim(coalesce(p_website_url,'')),2048),'');
  v_accent text:=lower(coalesce(p_profile_accent,'red'));
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if public.account_is_banned(v_me) then raise exception 'Suspended accounts cannot edit profiles'; end if;
  if v_avatar is not null and v_avatar !~* '^https://' and v_avatar !~* '^data:image/' then
    raise exception 'Avatar URL must use HTTPS';
  end if;
  if v_site is not null and v_site !~* '^https://' then
    raise exception 'Website URL must use HTTPS';
  end if;
  if v_accent not in ('red','purple','blue','green','gold') then v_accent:='red'; end if;

  update public.profiles
  set display_name=nullif(left(trim(coalesce(p_display_name,'')),50),''),
      bio=nullif(left(trim(coalesce(p_bio,'')),500),''),
      avatar_url=v_avatar,
      is_private=coalesce(p_is_private,false),
      location=nullif(left(trim(coalesce(p_location,'')),80),''),
      favorite_genres=(select coalesce(array_agg(left(trim(g),40)),'{}'::text[]) from unnest((coalesce(p_favorite_genres,'{}'::text[]))[1:12]) as g where trim(g)<>''),
      website_url=v_site,
      instagram_username=nullif(left(trim(coalesce(p_instagram_username,'')),80),''),
      discord_username=nullif(left(trim(coalesce(p_discord_username,'')),80),''),
      profile_accent=v_accent,
      updated_at=now()
  where user_id=v_me;

  select to_jsonb(p) into v_result from public.profiles p where p.user_id=v_me;
  return v_result;
end;
$$;
grant execute on function public.update_my_profile_v35(text,text,text,boolean,text,text[],text,text,text,text) to authenticated;

-- ---------- realtime presence ----------
create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_presence enable row level security;
drop policy if exists "Presence public read v35" on public.user_presence;
create policy "Presence public read v35" on public.user_presence for select using(true);
revoke insert,update,delete on public.user_presence from anon,authenticated;
grant select on public.user_presence to anon,authenticated;

create or replace function public.touch_presence()
returns timestamptz
language plpgsql
security definer
set search_path=public
as $$
declare v_me uuid:=auth.uid(); v_now timestamptz:=now();
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  insert into public.user_presence(user_id,last_seen_at,updated_at)
  values(v_me,v_now,v_now)
  on conflict(user_id) do update set last_seen_at=excluded.last_seen_at,updated_at=excluded.updated_at;
  return v_now;
end;
$$;
grant execute on function public.touch_presence() to authenticated;

-- ---------- recent title activity, deduplicated ----------
create table if not exists public.profile_title_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check(media_type in ('movie','tv')),
  media_id bigint not null,
  title text not null,
  poster_path text,
  first_opened_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  open_count integer not null default 1 check(open_count>0),
  primary key(user_id,media_type,media_id)
);
alter table public.profile_title_activity enable row level security;
drop policy if exists "Activity privacy read v35" on public.profile_title_activity;
create policy "Activity privacy read v35" on public.profile_title_activity
for select using(
  auth.uid()=user_id
  or exists(select 1 from public.profiles p where p.user_id=profile_title_activity.user_id and coalesce(p.is_private,false)=false)
);
revoke insert,update,delete on public.profile_title_activity from anon,authenticated;
grant select on public.profile_title_activity to anon,authenticated;

create or replace function public.record_title_open(
  p_media_type text,
  p_media_id bigint,
  p_title text,
  p_poster_path text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_me uuid:=auth.uid(); v_type text:=lower(trim(coalesce(p_media_type,'')));
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if public.account_is_banned(v_me) then raise exception 'Account suspended'; end if;
  if v_type not in ('movie','tv') or p_media_id is null or p_media_id<=0 then raise exception 'Invalid title'; end if;
  insert into public.profile_title_activity(user_id,media_type,media_id,title,poster_path)
  values(v_me,v_type,p_media_id,left(coalesce(nullif(trim(p_title),''),'Untitled'),250),nullif(left(trim(coalesce(p_poster_path,'')),300),''))
  on conflict(user_id,media_type,media_id) do update
    set title=excluded.title,
        poster_path=coalesce(excluded.poster_path,public.profile_title_activity.poster_path),
        last_opened_at=now(),
        open_count=public.profile_title_activity.open_count+1;
end;
$$;
grant execute on function public.record_title_open(text,bigint,text,text) to authenticated;

-- ---------- active watch-page time ----------
create table if not exists public.profile_watch_time (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check(media_type in ('movie','tv')),
  media_id bigint not null,
  seconds bigint not null default 0 check(seconds>=0),
  updated_at timestamptz not null default now(),
  primary key(user_id,media_type,media_id)
);
alter table public.profile_watch_time enable row level security;
drop policy if exists "Watch time own read v35" on public.profile_watch_time;
create policy "Watch time own read v35" on public.profile_watch_time for select to authenticated using(auth.uid()=user_id);
revoke insert,update,delete on public.profile_watch_time from anon,authenticated;
grant select on public.profile_watch_time to authenticated;

create or replace function public.add_watch_seconds(p_media_type text,p_media_id bigint,p_seconds integer default 30)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_me uuid:=auth.uid(); v_type text:=lower(trim(coalesce(p_media_type,''))); v_add integer:=greatest(1,least(coalesce(p_seconds,30),120));
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if public.account_is_banned(v_me) then raise exception 'Account suspended'; end if;
  if v_type not in ('movie','tv') or p_media_id is null or p_media_id<=0 then raise exception 'Invalid title'; end if;
  insert into public.profile_watch_time(user_id,media_type,media_id,seconds)
  values(v_me,v_type,p_media_id,v_add)
  on conflict(user_id,media_type,media_id) do update set seconds=public.profile_watch_time.seconds+v_add,updated_at=now();
end;
$$;
grant execute on function public.add_watch_seconds(text,bigint,integer) to authenticated;

-- ---------- public role/name effect resolution ----------
create or replace function public.get_public_name_effects(p_usernames text[])
returns table(username text,top_role text)
language sql
security definer
stable
set search_path=public
as $$
  select p.username,
    case
      when p.user_id='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then 'owner'
      when exists(select 1 from public.profile_role_assignments r where r.user_id=p.user_id and r.role_key='admin') then 'admin'
      when exists(select 1 from public.chat_moderators m where lower(m.alias)=lower(p.username)) then 'staff'
      when exists(select 1 from public.profile_role_assignments r where r.user_id=p.user_id and r.role_key='moderator') then 'moderator'
      when exists(select 1 from public.profile_role_assignments r where r.user_id=p.user_id and r.role_key='support') then 'support'
      when exists(select 1 from public.profile_role_assignments r where r.user_id=p.user_id and r.role_key='developer') then 'developer'
      when exists(select 1 from public.profile_role_assignments r where r.user_id=p.user_id and r.role_key='verified') then 'verified'
      when exists(select 1 from public.profile_role_assignments r where r.user_id=p.user_id and r.role_key='contributor') then 'contributor'
      when exists(select 1 from public.profile_role_assignments r where r.user_id=p.user_id and r.role_key='curator') then 'curator'
      else null
    end as top_role
  from public.profiles p
  where lower(p.username)=any(select lower(x) from unnest(coalesce(p_usernames,'{}'::text[])) x)
$$;
grant execute on function public.get_public_name_effects(text[]) to anon,authenticated;

-- ---------- leaderboard (all profiles, 25/page) ----------
create or replace function public.get_public_leaderboard(
  p_page integer default 1,
  p_page_size integer default 25,
  p_sort text default 'overall'
)
returns table(
  rank_no bigint,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  last_seen_at timestamptz,
  online boolean,
  titles_watched bigint,
  watch_minutes bigint,
  ratings_count bigint,
  achievements integer,
  score bigint,
  top_role text,
  total_count bigint
)
language sql
security definer
stable
set search_path=public
as $$
with activity as (
  select a.user_id,count(*)::bigint titles_watched from public.profile_title_activity a group by a.user_id
), watchtime as (
  select w.user_id,floor(sum(w.seconds)/60.0)::bigint watch_minutes from public.profile_watch_time w group by w.user_id
), ratings as (
  select r.user_id,count(*)::bigint ratings_count from public.user_ratings r group by r.user_id
), base as (
  select
    p.user_id,p.username,p.display_name,p.avatar_url,pr.last_seen_at,
    (pr.last_seen_at>now()-interval '90 seconds') as online,
    coalesce(a.titles_watched,0)::bigint titles_watched,
    coalesce(w.watch_minutes,0)::bigint watch_minutes,
    coalesce(r.ratings_count,0)::bigint ratings_count,
    (
      (case when nullif(trim(coalesce(p.avatar_url,'')),'') is not null then 1 else 0 end)+
      (case when nullif(trim(coalesce(p.bio,'')),'') is not null then 1 else 0 end)+
      (case when nullif(trim(coalesce(p.display_name,'')),'') is not null then 1 else 0 end)+
      (case when coalesce(a.titles_watched,0)>=1 then 1 else 0 end)+
      (case when coalesce(a.titles_watched,0)>=10 then 1 else 0 end)+
      (case when coalesce(r.ratings_count,0)>=1 then 1 else 0 end)+
      (case when exists(select 1 from public.profile_role_assignments pra where pra.user_id=p.user_id) then 1 else 0 end)
    )::integer achievements,
    case
      when p.user_id='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then 'owner'
      when exists(select 1 from public.profile_role_assignments x where x.user_id=p.user_id and x.role_key='admin') then 'admin'
      when exists(select 1 from public.chat_moderators m where lower(m.alias)=lower(p.username)) then 'staff'
      when exists(select 1 from public.profile_role_assignments x where x.user_id=p.user_id and x.role_key='moderator') then 'moderator'
      when exists(select 1 from public.profile_role_assignments x where x.user_id=p.user_id and x.role_key='support') then 'support'
      when exists(select 1 from public.profile_role_assignments x where x.user_id=p.user_id and x.role_key='developer') then 'developer'
      when exists(select 1 from public.profile_role_assignments x where x.user_id=p.user_id and x.role_key='verified') then 'verified'
      when exists(select 1 from public.profile_role_assignments x where x.user_id=p.user_id and x.role_key='contributor') then 'contributor'
      when exists(select 1 from public.profile_role_assignments x where x.user_id=p.user_id and x.role_key='curator') then 'curator'
      else null
    end top_role
  from public.profiles p
  left join public.user_presence pr on pr.user_id=p.user_id
  left join activity a on a.user_id=p.user_id
  left join watchtime w on w.user_id=p.user_id
  left join ratings r on r.user_id=p.user_id
), scored as (
  select b.*,
    (b.titles_watched*100+b.watch_minutes+b.ratings_count*25+b.achievements*50)::bigint score
  from base b
), ranked as (
  select s.*,
    row_number() over(order by
      case when lower(coalesce(p_sort,'overall'))='titles' then s.titles_watched end desc nulls last,
      case when lower(coalesce(p_sort,'overall'))='watch' then s.watch_minutes end desc nulls last,
      case when lower(coalesce(p_sort,'overall'))='ratings' then s.ratings_count end desc nulls last,
      case when lower(coalesce(p_sort,'overall'))='achievements' then s.achievements end desc nulls last,
      s.score desc,
      lower(s.username)
    ) rank_no
  from scored s
)
select r.rank_no,r.user_id,r.username,r.display_name,r.avatar_url,r.last_seen_at,r.online,
       r.titles_watched,r.watch_minutes,r.ratings_count,r.achievements,r.score,r.top_role,
       (select count(*)::bigint from ranked) total_count
from ranked r
order by r.rank_no
limit greatest(1,least(coalesce(p_page_size,25),100))
offset (greatest(coalesce(p_page,1),1)-1)*greatest(1,least(coalesce(p_page_size,25),100))
$$;
grant execute on function public.get_public_leaderboard(integer,integer,text) to anon,authenticated;

-- ---------- separate public-chat ban and auth/login ban ----------
create table if not exists public.public_chat_bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.account_login_bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.public_chat_bans enable row level security;
alter table public.account_login_bans enable row level security;
drop policy if exists "Own login ban realtime v35" on public.account_login_bans;
create policy "Own login ban realtime v35" on public.account_login_bans for select to authenticated using(auth.uid()=user_id);
revoke all on public.public_chat_bans from anon,authenticated;
revoke insert,update,delete on public.account_login_bans from anon,authenticated;
grant select on public.account_login_bans to authenticated;

-- Extend account event types used by the instant controls.
alter table public.account_events drop constraint if exists account_events_event_type_check;
alter table public.account_events add constraint account_events_event_type_check check(event_type in(
  'ban','unban','mute','unmute','warning','staff_granted','staff_revoked',
  'public_chat_ban','public_chat_unban','account_ban','account_unban'
));

create or replace function public.staff_set_public_chat_ban(
  p_user_id uuid,
  p_enabled boolean,
  p_minutes integer default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_username text; v_exp timestamptz;
begin
  if not public.staff_has_permission('users_ban') then raise exception 'Permission denied'; end if;
  if p_user_id is null then raise exception 'Target user required'; end if;
  if p_user_id='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then raise exception 'Owner cannot be moderated'; end if;
  select username into v_username from public.profiles where user_id=p_user_id;
  if v_username is null then raise exception 'Profile not found'; end if;
  if coalesce(p_enabled,false) then
    if p_minutes is not null and p_minutes>0 then v_exp:=now()+make_interval(mins=>least(p_minutes,525600)); end if;
    insert into public.public_chat_bans(user_id,reason,expires_at,created_by,updated_at)
    values(p_user_id,nullif(left(trim(coalesce(p_reason,'')),500),''),v_exp,auth.uid(),now())
    on conflict(user_id) do update set reason=excluded.reason,expires_at=excluded.expires_at,created_by=excluded.created_by,updated_at=now();
    perform public.f2w_emit_account_event(p_user_id,'public_chat_ban','Public chat restricted',coalesce(nullif(trim(p_reason),''),'You cannot send public chat messages right now.'),jsonb_build_object('expires_at',v_exp),auth.uid());
  else
    delete from public.public_chat_bans where user_id=p_user_id;
    perform public.f2w_emit_account_event(p_user_id,'public_chat_unban','Public chat restored','Your public chat access has been restored.','{}'::jsonb,auth.uid());
  end if;
  insert into public.staff_audit_log(actor_user_id,actor_username,action,target_type,target_id,details)
  values(auth.uid(),public.staff_current_username(),case when p_enabled then 'public_chat_ban' else 'public_chat_unban' end,'user',p_user_id::text,jsonb_build_object('username',v_username,'reason',p_reason,'minutes',p_minutes));
end;
$$;
grant execute on function public.staff_set_public_chat_ban(uuid,boolean,integer,text) to authenticated;

create or replace function public.staff_set_account_login_ban(
  p_user_id uuid,
  p_enabled boolean,
  p_minutes integer default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_username text; v_exp timestamptz; v_auth_exp timestamptz;
begin
  if not public.staff_has_permission('users_ban') then raise exception 'Permission denied'; end if;
  if p_user_id is null then raise exception 'Target user required'; end if;
  if p_user_id='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then raise exception 'Owner cannot be moderated'; end if;
  select username into v_username from public.profiles where user_id=p_user_id;
  if v_username is null then raise exception 'Profile not found'; end if;
  if coalesce(p_enabled,false) then
    if p_minutes is not null and p_minutes>0 then v_exp:=now()+make_interval(mins=>least(p_minutes,525600)); end if;
    v_auth_exp:=coalesce(v_exp,now()+interval '100 years');
    insert into public.account_login_bans(user_id,reason,expires_at,created_by,updated_at)
    values(p_user_id,nullif(left(trim(coalesce(p_reason,'')),500),''),v_exp,auth.uid(),now())
    on conflict(user_id) do update set reason=excluded.reason,expires_at=excluded.expires_at,created_by=excluded.created_by,updated_at=now();
    update auth.users set banned_until=v_auth_exp where id=p_user_id;
    perform public.f2w_emit_account_event(p_user_id,'account_ban','Account banned',coalesce(nullif(trim(p_reason),''),'This account has been banned.'),jsonb_build_object('expires_at',v_exp),auth.uid());
  else
    delete from public.account_login_bans where user_id=p_user_id;
    update auth.users set banned_until=null where id=p_user_id;
    perform public.f2w_emit_account_event(p_user_id,'account_unban','Account ban removed','Your account login has been restored.','{}'::jsonb,auth.uid());
  end if;
  insert into public.staff_audit_log(actor_user_id,actor_username,action,target_type,target_id,details)
  values(auth.uid(),public.staff_current_username(),case when p_enabled then 'account_login_ban' else 'account_login_unban' end,'user',p_user_id::text,jsonb_build_object('username',v_username,'reason',p_reason,'minutes',p_minutes));
end;
$$;
grant execute on function public.staff_set_account_login_ban(uuid,boolean,integer,text) to authenticated;

create or replace function public.staff_get_quick_moderation(p_user_id uuid)
returns jsonb
language sql
security definer
stable
set search_path=public
as $$
  select case when public.staff_is_staff() then jsonb_build_object(
    'public_chat_banned',exists(select 1 from public.public_chat_bans b where b.user_id=p_user_id and (b.expires_at is null or b.expires_at>now())),
    'muted',exists(select 1 from public.user_mutes m where m.user_id=p_user_id and (m.expires_at is null or m.expires_at>now())),
    'site_suspended',exists(select 1 from public.chat_bans b where b.user_id=p_user_id and (b.expires_at is null or b.expires_at>now())),
    'account_banned',exists(select 1 from public.account_login_bans b where b.user_id=p_user_id and (b.expires_at is null or b.expires_at>now()))
  ) else '{}'::jsonb end
$$;
grant execute on function public.staff_get_quick_moderation(uuid) to authenticated;

-- Account state keeps V16 fields and adds the two V35 restrictions.
create or replace function public.get_my_account_state()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user_id uuid:=auth.uid(); v_username text; v_role text;
  v_banned boolean:=false; v_ban_reason text; v_ban_expires_at timestamptz;
  v_muted boolean:=false; v_mute_reason text; v_mute_expires_at timestamptz;
  v_public_chat_banned boolean:=false; v_account_banned boolean:=false; v_account_reason text; v_account_expires timestamptz;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select username into v_username from public.profiles where user_id=v_user_id limit 1;
  v_role:=public.staff_current_role();
  if v_user_id<>'f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    select true,b.reason,b.expires_at into v_banned,v_ban_reason,v_ban_expires_at from public.chat_bans b
      where (b.user_id=v_user_id or (b.user_id is null and lower(b.alias)=lower(coalesce(v_username,''))))
        and (b.expires_at is null or b.expires_at>now()) order by b.created_at desc limit 1;
    select true,m.reason,m.expires_at into v_muted,v_mute_reason,v_mute_expires_at from public.user_mutes m where m.user_id=v_user_id and (m.expires_at is null or m.expires_at>now()) limit 1;
    select exists(select 1 from public.public_chat_bans b where b.user_id=v_user_id and (b.expires_at is null or b.expires_at>now())) into v_public_chat_banned;
    select true,b.reason,b.expires_at into v_account_banned,v_account_reason,v_account_expires from public.account_login_bans b where b.user_id=v_user_id and (b.expires_at is null or b.expires_at>now()) limit 1;
  end if;
  return jsonb_build_object(
    'user_id',v_user_id,'username',v_username,'role',v_role,
    'banned',coalesce(v_banned,false),'ban_reason',v_ban_reason,'ban_expires_at',v_ban_expires_at,
    'muted',coalesce(v_muted,false),'mute_reason',v_mute_reason,'mute_expires_at',v_mute_expires_at,
    'public_chat_banned',coalesce(v_public_chat_banned,false),
    'account_login_banned',coalesce(v_account_banned,false),'account_login_ban_reason',v_account_reason,'account_login_ban_expires_at',v_account_expires,
    'warning_count',(select count(*) from public.user_warnings w where w.user_id=v_user_id and w.active=true)
  );
end;
$$;
grant execute on function public.get_my_account_state() to authenticated;

-- ---------- forum categories for richer community filtering ----------
alter table public.forum_threads add column if not exists category text not null default 'general';

-- ---------- realtime publication ----------
do $$
declare t text;
begin
  foreach t in array array['user_presence','profile_title_activity','profile_watch_time','public_chat_bans','account_login_bans'] loop
    begin execute format('alter publication supabase_realtime add table public.%I',t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- Clean up expired chat-only/login-ban rows whenever this migration is rerun.
delete from public.public_chat_bans where expires_at is not null and expires_at<=now();
delete from public.account_login_bans where expires_at is not null and expires_at<=now();

-- Keep the two known working fallback sources at the front.
insert into public.stream_source_status(source_name,enabled,priority,notice)
values ('videasy',true,2,'VidEasy 4K'),('vidfast',true,3,'VidFast 4K')
on conflict(source_name) do update set enabled=true,priority=excluded.priority,notice=excluded.notice;
