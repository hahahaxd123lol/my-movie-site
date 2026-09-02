-- Flix2Watch v146 — live staff ops, streams, announcements, realtime account enforcement
-- Run once in Supabase SQL Editor. Safe to re-run.

create extension if not exists pgcrypto;

create or replace function public.f2w_v146_is_staff()
returns boolean
language sql
security definer
set search_path=public
stable
as $$
  select auth.uid() is not null and (
    auth.uid()='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid
    or exists(select 1 from public.chat_moderators m where m.user_id=auth.uid())
    or exists(select 1 from public.profile_role_assignments r where r.user_id=auth.uid() and lower(r.role_key) in ('moderator','support','developer'))
  )
$$;
create or replace function public.f2w_v146_can_live_ops()
returns boolean
language sql
security definer
set search_path=public
stable
as $$
  select auth.uid() is not null and (
    auth.uid()='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid
    or exists(select 1 from public.chat_moderators m where m.user_id=auth.uid())
  )
$$;


-- ---------- announcements ----------
create table if not exists public.site_announcements_v146 (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_announcements_v146 add column if not exists message text;
alter table public.site_announcements_v146 add column if not exists starts_at timestamptz;
alter table public.site_announcements_v146 add column if not exists expires_at timestamptz;
alter table public.site_announcements_v146 add column if not exists active boolean not null default true;
alter table public.site_announcements_v146 add column if not exists created_by uuid;
alter table public.site_announcements_v146 add column if not exists created_at timestamptz not null default now();
alter table public.site_announcements_v146 add column if not exists updated_at timestamptz not null default now();
alter table public.site_announcements_v146 enable row level security;
drop policy if exists "site announcements public read" on public.site_announcements_v146;
create policy "site announcements public read" on public.site_announcements_v146 for select using (true);
grant select on public.site_announcements_v146 to anon, authenticated;

drop function if exists public.staff_publish_announcement(text,timestamptz,timestamptz);
create or replace function public.staff_publish_announcement(p_message text,p_starts_at timestamptz default null,p_expires_at timestamptz default null)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_id uuid;
begin
  if not public.f2w_v146_can_live_ops() then raise exception 'Owner/Staff permission required'; end if;
  if nullif(trim(p_message),'') is null then raise exception 'Announcement message is required'; end if;
  if p_expires_at is not null and p_starts_at is not null and p_expires_at<=p_starts_at then raise exception 'Expiry must be after start time'; end if;
  update public.site_announcements_v146 set active=false,updated_at=now() where active=true;
  insert into public.site_announcements_v146(message,starts_at,expires_at,active,created_by)
  values(trim(p_message),p_starts_at,p_expires_at,true,auth.uid()) returning id into v_id;
  return v_id;
end $$;

drop function if exists public.staff_clear_announcement();
create or replace function public.staff_clear_announcement()
returns boolean
language plpgsql security definer set search_path=public
as $$
begin
  if not public.f2w_v146_can_live_ops() then raise exception 'Owner/Staff permission required'; end if;
  update public.site_announcements_v146 set active=false,updated_at=now() where active=true;
  return true;
end $$;

drop function if exists public.get_active_announcement_v146();
create or replace function public.get_active_announcement_v146()
returns jsonb
language sql security definer set search_path=public stable
as $$
  select coalesce((
    select to_jsonb(a) from public.site_announcements_v146 a
    where a.active=true
      and (a.starts_at is null or a.starts_at<=now())
      and (a.expires_at is null or a.expires_at>now())
    order by a.created_at desc limit 1
  ),'null'::jsonb)
$$;

grant execute on function public.staff_publish_announcement(text,timestamptz,timestamptz) to authenticated;
grant execute on function public.staff_clear_announcement() to authenticated;
grant execute on function public.get_active_announcement_v146() to anon,authenticated;

drop function if exists public.get_staff_announcement_history();
create or replace function public.get_staff_announcement_history()
returns jsonb
language sql security definer set search_path=public stable
as $$
  select case when public.f2w_v146_can_live_ops() then coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',a.id,'message',a.message,'active',a.active and (a.starts_at is null or a.starts_at<=now()) and (a.expires_at is null or a.expires_at>now()),
      'starts_at',a.starts_at,'expires_at',a.expires_at,'created_at',a.created_at,'created_by_alias','staff'
    ) order by a.created_at desc)
    from (select * from public.site_announcements_v146 order by created_at desc limit 50) a
  ),'[]'::jsonb) else '[]'::jsonb end
$$;
grant execute on function public.get_staff_announcement_history() to authenticated;

-- ---------- stream source controls ----------
create table if not exists public.stream_source_status_v146 (
  source_name text primary key,
  enabled boolean not null default true,
  priority integer not null default 999,
  notice text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.stream_source_status_v146 add column if not exists enabled boolean not null default true;
alter table public.stream_source_status_v146 add column if not exists priority integer not null default 999;
alter table public.stream_source_status_v146 add column if not exists notice text;
alter table public.stream_source_status_v146 add column if not exists updated_by uuid;
alter table public.stream_source_status_v146 add column if not exists updated_at timestamptz not null default now();
alter table public.stream_source_status_v146 enable row level security;
drop policy if exists "stream source public read" on public.stream_source_status_v146;
create policy "stream source public read" on public.stream_source_status_v146 for select using (true);
grant select on public.stream_source_status_v146 to anon,authenticated;

insert into public.stream_source_status_v146(source_name,enabled,priority,notice)
values
 ('flix2watchapi',true,1,null),('vidcore',true,2,null),('ezvidapi',true,3,null),('vidlink',true,4,null),
 ('moviesrc',true,5,null),('vidsrchair',true,6,null),('vidsrcio',true,7,null),('vidsrcfyi',true,8,null),
 ('frembed',true,9,null),('uembed',true,10,null),('vidsrcsu',true,11,null),('embedsu',true,12,null)
on conflict(source_name) do nothing;
update public.stream_source_status_v146 set enabled=true,priority=1 where source_name='flix2watchapi';
update public.stream_source_status_v146 set priority=greatest(priority,2) where source_name<>'flix2watchapi' and priority<=1;

drop function if exists public.get_public_stream_source_status();
create or replace function public.get_public_stream_source_status()
returns setof public.stream_source_status_v146
language sql security definer set search_path=public stable
as $$ select * from public.stream_source_status_v146 order by priority,source_name $$;

drop function if exists public.staff_set_stream_source(text,boolean,integer,text);
create or replace function public.staff_set_stream_source(p_source_name text,p_enabled boolean,p_priority integer,p_notice text default null)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare v_name text:=lower(trim(p_source_name)); v_priority integer;
begin
  if not public.f2w_v146_can_live_ops() then raise exception 'Owner/Staff permission required'; end if;
  if v_name='' then raise exception 'Source name required'; end if;
  v_priority:=case when v_name='flix2watchapi' then 1 else greatest(coalesce(p_priority,999),2) end;
  insert into public.stream_source_status_v146(source_name,enabled,priority,notice,updated_by,updated_at)
  values(v_name,case when v_name='flix2watchapi' then true else coalesce(p_enabled,true) end,v_priority,nullif(trim(p_notice),''),auth.uid(),now())
  on conflict(source_name) do update set
    enabled=case when excluded.source_name='flix2watchapi' then true else excluded.enabled end,
    priority=case when excluded.source_name='flix2watchapi' then 1 else greatest(excluded.priority,2) end,
    notice=excluded.notice,updated_by=auth.uid(),updated_at=now();
  update public.stream_source_status_v146 set enabled=true,priority=1,updated_at=now() where source_name='flix2watchapi';
  return jsonb_build_object('ok',true,'source_name',v_name,'enabled',case when v_name='flix2watchapi' then true else p_enabled end,'priority',v_priority);
end $$;

grant execute on function public.get_public_stream_source_status() to anon,authenticated;
grant execute on function public.staff_set_stream_source(text,boolean,integer,text) to authenticated;

-- ---------- realtime account enforcement ----------
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
drop policy if exists "users read own enforcement v146" on public.account_enforcement_v146;
create policy "users read own enforcement v146" on public.account_enforcement_v146 for select using (auth.uid()=user_id);
grant select on public.account_enforcement_v146 to authenticated;

create or replace function public.get_my_account_enforcement_v146()
returns jsonb
language plpgsql security definer set search_path=public stable
as $$
declare r public.account_enforcement_v146%rowtype;
begin
  if auth.uid() is null then return jsonb_build_object('signed_in',false,'site_suspended',false,'account_banned',false); end if;
  select * into r from public.account_enforcement_v146 where user_id=auth.uid();
  if not found or (r.expires_at is not null and r.expires_at<=now()) then
    return jsonb_build_object('signed_in',true,'site_suspended',false,'account_banned',false,'reason',null,'expires_at',null);
  end if;
  return jsonb_build_object('signed_in',true,'site_suspended',r.site_suspended,'account_banned',r.account_banned,'reason',r.reason,'expires_at',r.expires_at,'updated_at',r.updated_at);
end $$;

create or replace function public.staff_set_account_enforcement_v146(p_user_id uuid,p_kind text,p_enabled boolean,p_minutes integer default null,p_reason text default null)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare v_exp timestamptz; v_kind text:=lower(trim(p_kind));
begin
  if not public.f2w_v146_can_live_ops() then raise exception 'Owner/Staff permission required'; end if;
  if p_user_id is null then raise exception 'Target account required'; end if;
  if p_user_id='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then raise exception 'Owner cannot be restricted'; end if;
  if v_kind not in ('site-suspension','account-ban') then raise exception 'Unsupported enforcement type'; end if;
  v_exp:=case when coalesce(p_enabled,false) and coalesce(p_minutes,0)>0 then now()+make_interval(mins=>p_minutes) else null end;

  insert into public.account_enforcement_v146(user_id,site_suspended,account_banned,reason,expires_at,updated_by,updated_at)
  values(p_user_id,v_kind='site-suspension' and p_enabled,v_kind='account-ban' and p_enabled,nullif(trim(p_reason),''),v_exp,auth.uid(),now())
  on conflict(user_id) do update set
    site_suspended=case when v_kind='site-suspension' then p_enabled else account_enforcement_v146.site_suspended end,
    account_banned=case when v_kind='account-ban' then p_enabled else account_enforcement_v146.account_banned end,
    reason=case when p_enabled then nullif(trim(p_reason),'') else account_enforcement_v146.reason end,
    expires_at=case when p_enabled then v_exp else account_enforcement_v146.expires_at end,
    updated_by=auth.uid(),updated_at=now();

  return jsonb_build_object('ok',true,'kind',v_kind,'enabled',p_enabled,'expires_at',v_exp);
end $$;

create or replace function public.staff_get_quick_moderation(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path=public stable
as $$
declare e public.account_enforcement_v146%rowtype; v_public boolean:=false; v_mute boolean:=false;
begin
  if not public.f2w_v146_can_live_ops() then raise exception 'Owner/Staff permission required'; end if;
  select * into e from public.account_enforcement_v146 where user_id=p_user_id and (expires_at is null or expires_at>now());
  if to_regclass('public.public_chat_bans') is not null then execute 'select exists(select 1 from public.public_chat_bans where user_id=$1 and (expires_at is null or expires_at>now()))' into v_public using p_user_id; end if;
  if to_regclass('public.user_mutes') is not null then execute 'select exists(select 1 from public.user_mutes where user_id=$1 and (expires_at is null or expires_at>now()))' into v_mute using p_user_id; end if;
  return jsonb_build_object('public_chat_banned',v_public,'muted',v_mute,'site_suspended',coalesce(e.site_suspended,false),'account_banned',coalesce(e.account_banned,false));
end $$;

grant execute on function public.get_my_account_enforcement_v146() to authenticated;
grant execute on function public.staff_set_account_enforcement_v146(uuid,text,boolean,integer,text) to authenticated;
grant execute on function public.staff_get_quick_moderation(uuid) to authenticated;

do $$
begin
  begin alter publication supabase_realtime add table public.site_announcements_v146; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.stream_source_status_v146; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.account_enforcement_v146; exception when duplicate_object then null; end;
end $$;
