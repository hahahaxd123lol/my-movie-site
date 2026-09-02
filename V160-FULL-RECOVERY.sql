-- Flix2Watch v160 — account-scoped recovery, realtime notifications/social/roles, low usage
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1) STRICT ACCOUNT-SCOPED ENFORCEMENT. Never leak one user's state to another.
-- -----------------------------------------------------------------------------
create table if not exists public.account_enforcement_v146 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  site_suspended boolean not null default false,
  account_banned boolean not null default false,
  reason text,
  expires_at timestamptz,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.account_enforcement_v146 enable row level security;
drop policy if exists "users read own enforcement v160" on public.account_enforcement_v146;
drop policy if exists "users read own enforcement v146" on public.account_enforcement_v146;
create policy "users read own enforcement v160" on public.account_enforcement_v146 for select using (auth.uid()=user_id);
grant select on public.account_enforcement_v146 to authenticated;

create or replace function public.get_my_account_enforcement_v160()
returns jsonb language sql security definer stable set search_path=public as $$
  select case when auth.uid() is null then
    jsonb_build_object('signed_in',false,'user_id',null,'site_suspended',false,'account_banned',false)
  else coalesce((
    select jsonb_build_object(
      'signed_in',true,'user_id',e.user_id,
      'site_suspended',case when e.expires_at is null or e.expires_at>now() then coalesce(e.site_suspended,false) else false end,
      'account_banned',case when e.expires_at is null or e.expires_at>now() then coalesce(e.account_banned,false) else false end,
      'reason',case when e.expires_at is null or e.expires_at>now() then e.reason else null end,
      'expires_at',case when e.expires_at is null or e.expires_at>now() then e.expires_at else null end,
      'updated_at',e.updated_at)
    from public.account_enforcement_v146 e where e.user_id=auth.uid()
  ),jsonb_build_object('signed_in',true,'user_id',auth.uid(),'site_suspended',false,'account_banned',false,'reason',null,'expires_at',null)) end;
$$;
grant execute on function public.get_my_account_enforcement_v160() to authenticated;

-- Expired/stale restrictions are harmless and are normalized here.
update public.account_enforcement_v146
set site_suspended=false,account_banned=false,reason=null,expires_at=null,updated_at=now()
where expires_at is not null and expires_at<=now();

-- Legacy login-ban rows must not survive after the authoritative account ban is OFF.
do $$
begin
  if to_regclass('public.account_login_bans') is not null then
    execute $q$
      delete from public.account_login_bans b
      where exists (
        select 1 from public.account_enforcement_v146 e
        where e.user_id=b.user_id
          and coalesce(e.account_banned,false)=false
      )
    $q$;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2) NOTIFICATIONS — guaranteed RPCs + filtered realtime.
-- -----------------------------------------------------------------------------
create table if not exists public.f2w_notifications_v125(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists f2w_notifications_v160_user_idx on public.f2w_notifications_v125(user_id,created_at desc);
alter table public.f2w_notifications_v125 enable row level security;
revoke all on public.f2w_notifications_v125 from anon,authenticated;
create or replace function public.get_my_notifications_v160(p_limit integer default 60)
returns table(id uuid,title text,message text,link text,read_at timestamptz,created_at timestamptz)
language sql security definer stable set search_path=public as $$
  select n.id,n.title,n.message,n.link,n.read_at,n.created_at
  from public.f2w_notifications_v125 n
  where n.user_id=auth.uid()
  order by n.created_at desc
  limit greatest(1,least(coalesce(p_limit,60),100));
$$;
grant execute on function public.get_my_notifications_v160(integer) to authenticated;
create or replace function public.mark_my_notifications_read_v160()
returns void language sql security definer set search_path=public as $$
  update public.f2w_notifications_v125 set read_at=coalesce(read_at,now())
  where user_id=auth.uid() and read_at is null;
$$;
grant execute on function public.mark_my_notifications_read_v160() to authenticated;

-- -----------------------------------------------------------------------------
-- 3) FOLLOWERS/FOLLOWING — stable, public-safe list RPCs + follow notifications.
-- -----------------------------------------------------------------------------
create table if not exists public.profile_follows(
  follower_user_id uuid not null references auth.users(id) on delete cascade,
  followed_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_user_id,followed_user_id),
  check(follower_user_id<>followed_user_id)
);
create index if not exists profile_follows_followed_v160_idx on public.profile_follows(followed_user_id,created_at desc);
alter table public.profile_follows enable row level security;
drop policy if exists "read follows v160" on public.profile_follows;
drop policy if exists "insert own follows v160" on public.profile_follows;
drop policy if exists "delete own follows v160" on public.profile_follows;
create policy "read follows v160" on public.profile_follows for select using (true);
create policy "insert own follows v160" on public.profile_follows for insert with check (auth.uid()=follower_user_id);
create policy "delete own follows v160" on public.profile_follows for delete using (auth.uid()=follower_user_id);
grant select,insert,delete on public.profile_follows to authenticated;
grant select on public.profile_follows to anon;

create or replace function public.get_profile_followers(target_user_id uuid)
returns table(user_id uuid,username text,display_name text,avatar_url text)
language sql security definer stable set search_path=public as $$
  select p.user_id,p.username,p.display_name,p.avatar_url
  from public.profile_follows f join public.profiles p on p.user_id=f.follower_user_id
  where f.followed_user_id=target_user_id
  order by f.created_at desc limit 500;
$$;
create or replace function public.get_profile_following(target_user_id uuid)
returns table(user_id uuid,username text,display_name text,avatar_url text)
language sql security definer stable set search_path=public as $$
  select p.user_id,p.username,p.display_name,p.avatar_url
  from public.profile_follows f join public.profiles p on p.user_id=f.followed_user_id
  where f.follower_user_id=target_user_id
  order by f.created_at desc limit 500;
$$;
grant execute on function public.get_profile_followers(uuid) to anon,authenticated;
grant execute on function public.get_profile_following(uuid) to anon,authenticated;

create or replace function public.f2w_notify_follow_v160()
returns trigger language plpgsql security definer set search_path=public as $$
declare u text;
begin
  select username into u from public.profiles where user_id=new.follower_user_id;
  insert into public.f2w_notifications_v125(user_id,title,message,link)
  values(new.followed_user_id,'New follower','@'||coalesce(u,'Someone')||' followed you.','/profile/@'||coalesce(u,''));
  return new;
end $$;
drop trigger if exists f2w_notify_follow_v160 on public.profile_follows;
create trigger f2w_notify_follow_v160 after insert on public.profile_follows for each row execute function public.f2w_notify_follow_v160();

-- -----------------------------------------------------------------------------
-- 4) PUBLIC PROFILE FETCH — one stable RPC avoids direct-query/RLS/auth races.
-- -----------------------------------------------------------------------------
create or replace function public.get_public_profile_v160(p_username text)
returns jsonb language sql security definer stable set search_path=public as $$
  select to_jsonb(p) from public.profiles p
  where lower(p.username)=lower(trim(regexp_replace(coalesce(p_username,''),'[^A-Za-z0-9]','','g')))
  limit 1;
$$;
grant execute on function public.get_public_profile_v160(text) to anon,authenticated;

-- -----------------------------------------------------------------------------
-- 5) ROLES — UUID authoritative; removing Moderator removes it immediately.
-- -----------------------------------------------------------------------------
create table if not exists public.profile_role_assignments(
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null,
  assigned_at timestamptz not null default now(),
  primary key(user_id,role_key)
);
create index if not exists profile_role_assignments_v160_idx on public.profile_role_assignments(user_id,role_key);

create or replace function public.staff_get_profile_roles(p_user_id uuid)
returns text[] language sql security definer stable set search_path=public as $$
  select coalesce(array_agg(role_key order by role_key),'{}'::text[])
  from public.profile_role_assignments where user_id=p_user_id;
$$;
grant execute on function public.staff_get_profile_roles(uuid) to authenticated;

create or replace function public.staff_set_profile_role(p_user_id uuid,p_role_key text,p_enabled boolean)
returns text[] language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid();r text:=lower(trim(coalesce(p_role_key,'')));owner constant uuid:='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid;allowed boolean;
begin
  allowed:=me=owner or exists(select 1 from public.chat_moderators m where m.user_id=me);
  if not allowed then raise exception 'Staff permission required'; end if;
  if p_user_id is null then raise exception 'Target user required'; end if;
  if r not in ('moderator','curator','support','developer','verified','contributor') then raise exception 'Unsupported role'; end if;
  if coalesce(p_enabled,false) then
    insert into public.profile_role_assignments(user_id,role_key) values(p_user_id,r) on conflict do nothing;
  else
    delete from public.profile_role_assignments where user_id=p_user_id and role_key=r;
  end if;
  return (select coalesce(array_agg(role_key order by role_key),'{}'::text[]) from public.profile_role_assignments where user_id=p_user_id);
end $$;
grant execute on function public.staff_set_profile_role(uuid,text,boolean) to authenticated;

create or replace function public.resolve_public_top_role(p_user_id uuid,p_username text)
returns text language sql security definer stable set search_path=public as $$
  select case
    when p_user_id='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then 'owner'
    when exists(select 1 from public.chat_moderators m where m.user_id=p_user_id) then 'staff'
    when exists(select 1 from public.profile_role_assignments r where r.user_id=p_user_id and r.role_key='moderator') then 'moderator'
    when exists(select 1 from public.profile_role_assignments r where r.user_id=p_user_id and r.role_key='support') then 'support'
    when exists(select 1 from public.profile_role_assignments r where r.user_id=p_user_id and r.role_key='developer') then 'developer'
    when exists(select 1 from public.profile_role_assignments r where r.user_id=p_user_id and r.role_key='verified') then 'verified'
    when exists(select 1 from public.profile_role_assignments r where r.user_id=p_user_id and r.role_key='contributor') then 'contributor'
    when exists(select 1 from public.profile_role_assignments r where r.user_id=p_user_id and r.role_key='curator') then 'curator'
    else null end;
$$;
grant execute on function public.resolve_public_top_role(uuid,text) to anon,authenticated;
create or replace function public.get_public_profile_role(target_username text)
returns text language sql security definer stable set search_path=public as $$
  select public.resolve_public_top_role(p.user_id,p.username) from public.profiles p where lower(p.username)=lower(trim(target_username)) limit 1;
$$;
grant execute on function public.get_public_profile_role(text) to anon,authenticated;

-- -----------------------------------------------------------------------------
-- 6) CHAT BOOTSTRAP — no optional/legacy columns referenced.
-- -----------------------------------------------------------------------------
create or replace function public.get_public_chat_bootstrap()
returns jsonb language plpgsql security definer stable set search_path=public as $$
declare msgs jsonb:='[]'::jsonb; ann jsonb:='null'::jsonb;
begin
  if to_regclass('public.chat_messages') is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',x.id,'alias',x.alias,'message',x.message,'created_at',x.created_at,
      'owner',lower(coalesce(x.alias,''))='josh',
      'moderator',exists(select 1 from public.chat_moderators cm where lower(coalesce(cm.alias,''))=lower(coalesce(x.alias,'')))
    ) order by x.created_at asc),'[]'::jsonb)
    into msgs from (
      select id,alias,message,created_at from public.chat_messages
      where created_at>now()-interval '24 hours' order by created_at desc limit 200
    ) x;
  end if;
  if to_regprocedure('public.get_active_announcement_v146()') is not null then execute 'select public.get_active_announcement_v146()' into ann; end if;
  return jsonb_build_object('success',true,'messages',msgs,'announcement',ann,
    'config',jsonb_build_object('chat_locked',false,'chat_slow_mode_seconds',0,'chat_uploads_enabled',false,'chat_pinned_message_id',null),'pinned_message',null);
end $$;
grant execute on function public.get_public_chat_bootstrap() to anon,authenticated;

-- -----------------------------------------------------------------------------
-- 7) LEADERBOARD — one RPC / 30s, explicit total_count for reliable pagination.
-- -----------------------------------------------------------------------------
create or replace function public.get_public_leaderboard_bundle_v160(p_page integer default 1,p_page_size integer default 25)
returns jsonb language plpgsql security definer stable set search_path=public as $$
declare result jsonb;
begin
  with title_keys as (
    select a.user_id,coalesce(a.media_type,'')::text media_type,a.media_id::text media_id from public.profile_title_activity a
    union
    select w.user_id,coalesce(w.media_type,'')::text,w.media_id::text from public.profile_watch_time w where greatest(coalesce(w.seconds,0),0)>0
  ), activity as (select user_id,count(*)::bigint titles_watched from title_keys group by user_id),
  wt as (select user_id,floor(sum(greatest(coalesce(seconds,0),0))/60.0)::bigint watch_minutes from public.profile_watch_time group by user_id),
  rt as (select user_id,count(*)::bigint ratings_count from public.user_ratings group by user_id),
  b as (
    select p.user_id,p.username,p.display_name,p.avatar_url,coalesce(pr.online_until>now(),false) online,pr.last_seen_at,
      coalesce(a.titles_watched,0)::bigint titles_watched,coalesce(w.watch_minutes,0)::bigint watch_minutes,coalesce(r.ratings_count,0)::bigint ratings_count,
      public.resolve_public_top_role(p.user_id,p.username) top_role,
      ((case when nullif(trim(coalesce(p.avatar_url,'')),'') is not null then 1 else 0 end)+(case when nullif(trim(coalesce(p.bio,'')),'') is not null then 1 else 0 end)+(case when nullif(trim(coalesce(p.display_name,'')),'') is not null then 1 else 0 end)+(case when coalesce(a.titles_watched,0)>=1 then 1 else 0 end)+(case when coalesce(a.titles_watched,0)>=10 then 1 else 0 end)+(case when coalesce(r.ratings_count,0)>=1 then 1 else 0 end))::integer achievements
    from public.profiles p left join public.user_presence pr on pr.user_id=p.user_id left join activity a on a.user_id=p.user_id left join wt w on w.user_id=p.user_id left join rt r on r.user_id=p.user_id
    where nullif(trim(coalesce(p.username,'')),'') is not null
  ), ranked as (
    select b.*,(watch_minutes*20+titles_watched*5+ratings_count*10+achievements*25)::bigint score,
      row_number() over(order by (watch_minutes*20+titles_watched*5+ratings_count*10+achievements*25) desc,watch_minutes desc,titles_watched desc,lower(username))::bigint rank_no
    from b
  ), meta as (select count(*)::bigint total_count,count(*) filter(where online)::bigint online_now,coalesce(sum(watch_minutes),0)::bigint combined_watch_minutes from ranked),
  page_rows as (select * from ranked order by rank_no limit greatest(1,least(coalesce(p_page_size,25),100)) offset (greatest(coalesce(p_page,1),1)-1)*greatest(1,least(coalesce(p_page_size,25),100)))
  select jsonb_build_object(
    'rows',coalesce((select jsonb_agg(jsonb_build_object('rank_no',x.rank_no,'user_id',x.user_id,'username',x.username,'display_name',x.display_name,'avatar_url',x.avatar_url,'last_seen_at',x.last_seen_at,'online',x.online,'titles_watched',x.titles_watched,'watch_minutes',x.watch_minutes,'ratings_count',x.ratings_count,'achievements',x.achievements,'score',x.score,'top_role',x.top_role,'total_count',m.total_count) order by x.rank_no) from page_rows x cross join meta m),'[]'::jsonb),
    'total_count',(select total_count from meta),
    'stats',jsonb_build_object('registered_players',(select total_count from meta),'online_now',(select online_now from meta),'combined_watch_minutes',(select combined_watch_minutes from meta))
  ) into result;
  return result;
end $$;
grant execute on function public.get_public_leaderboard_bundle_v160(integer,integer) to anon,authenticated;

-- Realtime publication: idempotent, only the two user-filtered tables that need instant UI.
do $$ begin
  begin alter publication supabase_realtime add table public.account_enforcement_v146; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.f2w_notifications_v125; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profile_role_assignments; exception when duplicate_object then null; end;
end $$;

-- -----------------------------------------------------------------------------
-- 8) OWNER STAFF STATE + ROLE-SCOPED CONTEXT
-- -----------------------------------------------------------------------------
create or replace function public.owner_set_staff_v160(p_user_id uuid,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare owner constant uuid:='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid;uname text;
begin
  if auth.uid() is distinct from owner then raise exception 'Owner permission required'; end if;
  if p_user_id is null then raise exception 'Target user required'; end if;
  if p_user_id=owner then raise exception 'Owner role cannot be changed'; end if;
  select username into uname from public.profiles where user_id=p_user_id limit 1;
  if uname is null then raise exception 'User not found'; end if;
  delete from public.chat_moderators where user_id=p_user_id or (user_id is null and lower(coalesce(alias,''))=lower(uname));
  if coalesce(p_enabled,false) then
    insert into public.chat_moderators(alias,user_id) values(lower(uname),p_user_id);
  else
    delete from public.staff_permission_overrides where user_id=p_user_id;
  end if;
  return jsonb_build_object('ok',true,'user_id',p_user_id,'username',uname,'staff',coalesce(p_enabled,false));
end $$;
grant execute on function public.owner_set_staff_v160(uuid,boolean) to authenticated;

create or replace function public.staff_get_profile_staff_state_v160(p_user_id uuid)
returns boolean language sql security definer stable set search_path=public as $$
  select p_user_id='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid
      or exists(select 1 from public.chat_moderators m where m.user_id=p_user_id);
$$;
grant execute on function public.staff_get_profile_staff_state_v160(uuid) to authenticated;

create or replace function public.get_staff_context_v160()
returns jsonb language plpgsql security definer stable set search_path=public as $$
declare me uuid:=auth.uid();owner constant uuid:='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid;uname text;role text:='member';perms text[]:='{}'::text[];
begin
  if me is null then return jsonb_build_object('role','member','username','','permissions','[]'::jsonb); end if;
  select username into uname from public.profiles where user_id=me limit 1;
  if me=owner then role:='owner';
  elsif exists(select 1 from public.chat_moderators where user_id=me) then role:='staff';
  elsif exists(select 1 from public.profile_role_assignments where user_id=me and role_key='moderator') then role:='moderator';
  elsif exists(select 1 from public.profile_role_assignments where user_id=me and role_key='support') then role:='support';
  elsif exists(select 1 from public.profile_role_assignments where user_id=me and role_key='developer') then role:='developer';
  end if;
  if role in ('owner','staff') then
    select coalesce(array_agg(x.permission order by x.permission),'{}'::text[]) into perms
    from (select unnest(array['chat_moderate','users_ban','users_mute','users_warn','users_notes','reports_manage','announcements_manage','homepage_manage','streams_manage','collections_manage','support_manage','site_settings_manage','audit_view','profiles_manage','profile_roles_manage']) permission) x
    where role='owner' or not exists(select 1 from public.staff_permission_overrides o where o.user_id=me and o.permission=x.permission and o.allowed=false);
  elsif role='moderator' then perms:=array['chat_moderate','users_mute','users_warn','users_notes','reports_manage','audit_view'];
  elsif role='support' then perms:=array['support_manage','users_notes'];
  elsif role='developer' then perms:=array['streams_manage','audit_view']; end if;
  return jsonb_build_object('role',role,'username',coalesce(uname,''),'permissions',to_jsonb(perms));
end $$;
grant execute on function public.get_staff_context_v160() to authenticated;

-- -----------------------------------------------------------------------------
-- 9) ONE-RPC ACCOUNT PAGE SUMMARY (fast, avoids profile/RLS races)
-- -----------------------------------------------------------------------------
create or replace function public.get_my_account_summary_v160()
returns jsonb language sql security definer stable set search_path=public as $$
  select case when auth.uid() is null then jsonb_build_object('signed_in',false)
  else jsonb_build_object(
    'signed_in',true,
    'user_id',auth.uid(),
    'username',p.username,
    'display_name',p.display_name,
    'role',coalesce(public.resolve_public_top_role(p.user_id,p.username),'member')
  ) end
  from (select 1) q
  left join public.profiles p on p.user_id=auth.uid()
  limit 1;
$$;
grant execute on function public.get_my_account_summary_v160() to authenticated;

create or replace function public.get_profile_social(target_user_id uuid)
returns table(followers_count bigint,following_count bigint,is_following boolean,can_view_social boolean)
language sql security definer stable set search_path=public as $$
  select
    (select count(*)::bigint from public.profile_follows where followed_user_id=target_user_id),
    (select count(*)::bigint from public.profile_follows where follower_user_id=target_user_id),
    case when auth.uid() is null then false else exists(select 1 from public.profile_follows where follower_user_id=auth.uid() and followed_user_id=target_user_id) end,
    case when exists(select 1 from public.profiles p where p.user_id=target_user_id and coalesce(p.is_private,false)=true)
      then auth.uid()=target_user_id else true end;
$$;
grant execute on function public.get_profile_social(uuid) to anon,authenticated;
