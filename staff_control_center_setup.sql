-- ============================================================
-- FLIX2WATCH STAFF CONTROL CENTER
-- Comprehensive staff/moderation/CMS backend.
-- Run this WHOLE file once in Supabase SQL Editor.
-- ============================================================

create extension if not exists pgcrypto;

-- Core moderation tables are created here too, so this setup remains safe
-- even if an older moderation setup file was skipped.
create table if not exists public.chat_moderators (
  alias text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_bans (
  alias text primary key,
  created_at timestamptz not null default now(),
  reason text,
  created_by uuid,
  expires_at timestamptz
);

create table if not exists public.site_announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  active boolean not null default true,
  created_by_alias text,
  created_at timestamptz not null default now(),
  starts_at timestamptz default now(),
  expires_at timestamptz
);

-- ---------- Existing tables: extend safely ----------
alter table if exists public.chat_bans
  add column if not exists reason text,
  add column if not exists created_by uuid,
  add column if not exists expires_at timestamptz;

alter table if exists public.site_announcements
  add column if not exists starts_at timestamptz default now(),
  add column if not exists expires_at timestamptz;

-- ---------- Staff permission overrides ----------
create table if not exists public.staff_permission_overrides (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null,
  allowed boolean not null default true,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (user_id, permission)
);

-- ---------- Immutable-ish audit trail ----------
create table if not exists public.staff_audit_log (
  id bigserial primary key,
  actor_user_id uuid,
  actor_username text,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- User moderation ----------
create table if not exists public.user_mutes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  reason text,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.user_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  reason text not null,
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  note text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- ---------- User reports ----------
create table if not exists public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('profile','chat','stream','content','other')),
  target_id text,
  target_username text,
  reason text not null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open'
    check (status in ('open','reviewing','resolved','dismissed')),
  assigned_to uuid references auth.users(id) on delete set null,
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Live site configuration ----------
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

insert into public.site_settings(key,value)
values
  ('chat_locked','false'::jsonb),
  ('chat_slow_mode_seconds','0'::jsonb),
  ('chat_uploads_enabled','true'::jsonb),
  ('maintenance_message','""'::jsonb),
  ('chat_pinned_message_id','null'::jsonb)
on conflict (key) do nothing;

-- ---------- Stream source control ----------
create table if not exists public.stream_source_status (
  source_name text primary key,
  enabled boolean not null default true,
  priority integer not null default 999,
  notice text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

insert into public.stream_source_status(source_name,enabled,priority,notice)
values
('uembed', true, 1, null),
('multiembed', true, 2, null),
('vidsrcsu', true, 3, null),
('embedsu', true, 4, null),
('vidsrcxyz', true, 5, null),
('pstream', true, 6, null),
('moviesapi', true, 7, null),
('hexa', true, 8, null),
('vidlink', true, 9, null),
('vidsrcrip', true, 10, null),
('vidsrcvip', true, 11, null),
('2embed', true, 12, null),
('123embed', true, 13, null),
('111movies', true, 14, null),
('smashystream', true, 15, null),
('autoembed', true, 16, null),
('videasy', true, 17, null),
('vidfast', true, 18, null),
('vidify', true, 19, null),
('flicky', true, 20, null),
('rivestream', true, 21, null),
('vidora', true, 22, null),
('vidsrccc', true, 23, null),
('streamflix', true, 24, null),
('nebulaflix', true, 25, null),
('vidjoy', true, 26, null),
('vidzee', true, 27, null),
('spenflix', true, 28, null),
('vidsrccx', true, 29, null),
('frembed', true, 30, null)
on conflict (source_name) do nothing;

-- ---------- Homepage collections ----------
create table if not exists public.staff_collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.staff_collections(id) on delete cascade,
  media_id bigint not null,
  media_type text not null check (media_type in ('movie','tv')),
  title text not null,
  poster_path text,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  unique(collection_id, media_type, media_id)
);

-- ---------- Staff content blocks ----------
create table if not exists public.content_blocks (
  media_type text not null check (media_type in ('movie','tv')),
  media_id bigint not null,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  primary key(media_type,media_id)
);

-- ---------- Support ----------
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text,
  subject text not null,
  status text not null default 'open'
    check (status in ('open','waiting_user','waiting_staff','resolved','closed')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_role text not null default 'member',
  message text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROLE / PERMISSION HELPERS
-- ============================================================

create or replace function public.staff_current_username()
returns text
language sql
security definer
stable
set search_path=public
as $$
  select lower(p.username)
  from public.profiles p
  where p.user_id=auth.uid()
  limit 1
$$;

create or replace function public.staff_current_role()
returns text
language plpgsql
security definer
stable
set search_path=public
as $$
declare
  v_username text;
begin
  if auth.uid() is null then
    return 'member';
  end if;

  if auth.uid() = 'f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    return 'owner';
  end if;

  select lower(p.username) into v_username
  from public.profiles p
  where p.user_id=auth.uid();

  if v_username is not null and exists(
    select 1 from public.chat_moderators m
    where lower(m.alias)=v_username
  ) then
    return 'staff';
  end if;

  return 'member';
end;
$$;

create or replace function public.staff_is_staff()
returns boolean
language sql
security definer
stable
set search_path=public
as $$
  select public.staff_current_role() in ('owner','staff')
$$;

create or replace function public.staff_has_permission(p_permission text)
returns boolean
language plpgsql
security definer
stable
set search_path=public
as $$
declare
  v_role text;
  v_override boolean;
begin
  v_role := public.staff_current_role();

  if v_role='owner' then
    return true;
  end if;

  if v_role<>'staff' then
    return false;
  end if;

  select spo.allowed into v_override
  from public.staff_permission_overrides spo
  where spo.user_id=auth.uid()
    and spo.permission=p_permission;

  if found then
    return v_override;
  end if;

  return p_permission = any(array[
    'chat_moderate',
    'users_ban',
    'users_mute',
    'users_warn',
    'users_notes',
    'reports_manage',
    'announcements_manage',
    'homepage_manage',
    'streams_manage',
    'collections_manage',
    'support_manage',
    'site_settings_manage',
    'audit_view'
  ]);
end;
$$;

create or replace function public.staff_target_role(p_username text)
returns text
language plpgsql
security definer
stable
set search_path=public
as $$
declare
  v_user_id uuid;
begin
  select p.user_id into v_user_id
  from public.profiles p
  where lower(p.username)=lower(trim(p_username))
  limit 1;

  if v_user_id is null then
    return 'missing';
  end if;

  if v_user_id='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    return 'owner';
  end if;

  if exists(
    select 1 from public.chat_moderators m
    where lower(m.alias)=lower(trim(p_username))
  ) then
    return 'staff';
  end if;

  return 'member';
end;
$$;

create or replace function public.staff_write_audit(
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.staff_is_staff() then
    raise exception 'Staff access required';
  end if;

  insert into public.staff_audit_log(
    actor_user_id,actor_username,action,target_type,target_id,details
  )
  values(
    auth.uid(),
    public.staff_current_username(),
    p_action,
    p_target_type,
    p_target_id,
    coalesce(p_details,'{}'::jsonb)
  );
end;
$$;

create or replace function public.get_staff_context()
returns jsonb
language plpgsql
security definer
stable
set search_path=public
as $$
declare
  v_role text;
  v_username text;
  v_permissions jsonb;
begin
  v_role:=public.staff_current_role();
  v_username:=public.staff_current_username();

  if v_role not in ('owner','staff') then
    return jsonb_build_object(
      'role','member',
      'username',v_username,
      'permissions','[]'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(permission),'[]'::jsonb)
  into v_permissions
  from (
    select permission
    from (values
      ('chat_moderate'),
      ('users_ban'),
      ('users_mute'),
      ('users_warn'),
      ('users_notes'),
      ('reports_manage'),
      ('announcements_manage'),
      ('homepage_manage'),
      ('streams_manage'),
      ('collections_manage'),
      ('support_manage'),
      ('site_settings_manage'),
      ('audit_view'),
      ('staff_manage')
    ) p(permission)
    where public.staff_has_permission(permission)
  ) x;

  return jsonb_build_object(
    'role',v_role,
    'username',v_username,
    'permissions',v_permissions
  );
end;
$$;

-- ============================================================
-- PUBLIC ROLE + PUBLIC CONFIG
-- ============================================================

create or replace function public.get_public_profile_role(target_username text)
returns text
language plpgsql
security definer
stable
set search_path=public
as $$
declare
  v_user_id uuid;
begin
  select p.user_id into v_user_id
  from public.profiles p
  where lower(p.username)=lower(trim(target_username))
  limit 1;

  if v_user_id is null then
    return null;
  end if;

  if v_user_id='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    return 'owner';
  end if;

  if exists(
    select 1 from public.chat_moderators m
    where lower(m.alias)=lower(trim(target_username))
  ) then
    return 'staff';
  end if;

  return null;
end;
$$;

create or replace function public.get_public_site_config()
returns jsonb
language sql
security definer
stable
set search_path=public
as $$
  select jsonb_build_object(
    'chat_locked',coalesce((select value from public.site_settings where key='chat_locked'),'false'::jsonb),
    'chat_slow_mode_seconds',coalesce((select value from public.site_settings where key='chat_slow_mode_seconds'),'0'::jsonb),
    'chat_uploads_enabled',coalesce((select value from public.site_settings where key='chat_uploads_enabled'),'true'::jsonb),
    'maintenance_message',coalesce((select value from public.site_settings where key='maintenance_message'),'""'::jsonb),
    'chat_pinned_message_id',coalesce((select value from public.site_settings where key='chat_pinned_message_id'),'null'::jsonb)
  )
$$;

create or replace function public.get_public_stream_source_status()
returns table(
  source_name text,
  enabled boolean,
  priority integer,
  notice text
)
language sql
security definer
stable
set search_path=public
as $$
  select s.source_name,s.enabled,s.priority,s.notice
  from public.stream_source_status s
  order by s.priority asc,s.source_name asc
$$;

create or replace function public.get_public_content_blocks()
returns table(media_type text,media_id bigint)
language sql
security definer
stable
set search_path=public
as $$
  select b.media_type,b.media_id from public.content_blocks b
$$;

create or replace function public.get_public_staff_collections()
returns jsonb
language sql
security definer
stable
set search_path=public
as $$
  select coalesce(jsonb_agg(collection_obj order by sort_order),'[]'::jsonb)
  from (
    select
      c.sort_order,
      jsonb_build_object(
        'id',c.id,
        'name',c.name,
        'description',c.description,
        'items',coalesce((
          select jsonb_agg(jsonb_build_object(
            'id',i.id,
            'media_id',i.media_id,
            'media_type',i.media_type,
            'title',i.title,
            'poster_path',i.poster_path
          ) order by i.sort_order,i.created_at)
          from public.staff_collection_items i
          where i.collection_id=c.id
        ),'[]'::jsonb)
      ) as collection_obj
    from public.staff_collections c
    where c.active=true
  ) x
$$;

-- ============================================================
-- USER REPORTS / SUPPORT
-- ============================================================

create or replace function public.submit_moderation_report(
  p_target_type text,
  p_target_id text,
  p_target_username text,
  p_reason text,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if p_target_type not in ('profile','chat','stream','content','other') then
    raise exception 'Invalid report type';
  end if;

  if length(trim(coalesce(p_reason,'')))<3 then
    raise exception 'Please provide a report reason';
  end if;

  insert into public.moderation_reports(
    reporter_user_id,target_type,target_id,target_username,reason,details
  )
  values(
    auth.uid(),p_target_type,p_target_id,p_target_username,
    left(trim(p_reason),500),coalesce(p_details,'{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.create_support_ticket(
  p_subject text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_ticket uuid;
  v_username text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if length(trim(coalesce(p_subject,'')))<3 then
    raise exception 'Subject is too short';
  end if;

  if length(trim(coalesce(p_message,'')))<3 then
    raise exception 'Message is too short';
  end if;

  select p.username into v_username
  from public.profiles p
  where p.user_id=auth.uid();

  insert into public.support_tickets(user_id,username,subject)
  values(auth.uid(),v_username,left(trim(p_subject),160))
  returning id into v_ticket;

  insert into public.support_ticket_messages(
    ticket_id,sender_user_id,sender_role,message
  )
  values(
    v_ticket,auth.uid(),'member',left(trim(p_message),4000)
  );

  return v_ticket;
end;
$$;

create or replace function public.add_support_ticket_message(
  p_ticket_id uuid,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_message_id uuid;
  v_role text;
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if length(trim(coalesce(p_message,'')))<1 then
    raise exception 'Message cannot be empty';
  end if;

  select t.user_id into v_owner
  from public.support_tickets t
  where t.id=p_ticket_id;

  if v_owner is null then
    raise exception 'Ticket not found';
  end if;

  v_role:=public.staff_current_role();

  if v_owner<>auth.uid() and v_role not in ('owner','staff') then
    raise exception 'Not allowed';
  end if;

  insert into public.support_ticket_messages(
    ticket_id,sender_user_id,sender_role,message
  )
  values(
    p_ticket_id,
    auth.uid(),
    case when v_role in ('owner','staff') then v_role else 'member' end,
    left(trim(p_message),4000)
  )
  returning id into v_message_id;

  update public.support_tickets
  set
    status=case
      when v_role in ('owner','staff') then 'waiting_user'
      else 'waiting_staff'
    end,
    updated_at=now()
  where id=p_ticket_id;

  return v_message_id;
end;
$$;

-- ============================================================
-- STAFF MODERATION ACTIONS
-- ============================================================

create or replace function public.staff_set_ban(
  p_username text,
  p_banned boolean,
  p_minutes integer default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_target_role text;
  v_expires timestamptz;
begin
  if not public.staff_has_permission('users_ban') then
    raise exception 'Missing permission: users_ban';
  end if;

  v_target_role:=public.staff_target_role(p_username);

  if v_target_role='missing' then
    raise exception 'User not found';
  end if;

  if v_target_role='owner' then
    raise exception 'Owner cannot be moderated';
  end if;

  if v_target_role='staff' and public.staff_current_role()<>'owner' then
    raise exception 'Staff cannot moderate other staff';
  end if;

  if p_banned then
    v_expires:=case
      when p_minutes is null or p_minutes<=0 then null
      else now()+make_interval(mins=>p_minutes)
    end;

    insert into public.chat_bans(alias,created_at,reason,created_by,expires_at)
    values(lower(trim(p_username)),now(),left(p_reason,500),auth.uid(),v_expires)
    on conflict(alias) do update set
      reason=excluded.reason,
      created_by=excluded.created_by,
      expires_at=excluded.expires_at,
      created_at=now();
  else
    delete from public.chat_bans
    where lower(alias)=lower(trim(p_username));
  end if;

  perform public.staff_write_audit(
    case when p_banned then 'user_ban' else 'user_unban' end,
    'user',
    lower(trim(p_username)),
    jsonb_build_object('minutes',p_minutes,'reason',p_reason)
  );
end;
$$;

create or replace function public.staff_set_mute(
  p_username text,
  p_minutes integer,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user_id uuid;
  v_target_role text;
begin
  if not public.staff_has_permission('users_mute') then
    raise exception 'Missing permission: users_mute';
  end if;

  if p_minutes is null or p_minutes<1 then
    raise exception 'Mute duration must be at least 1 minute';
  end if;

  select p.user_id into v_user_id
  from public.profiles p
  where lower(p.username)=lower(trim(p_username))
  limit 1;

  if v_user_id is null then
    raise exception 'User not found';
  end if;

  v_target_role:=public.staff_target_role(p_username);

  if v_target_role='owner' then
    raise exception 'Owner cannot be muted';
  end if;

  if v_target_role='staff' and public.staff_current_role()<>'owner' then
    raise exception 'Staff cannot mute other staff';
  end if;

  insert into public.user_mutes(
    user_id,username,reason,expires_at,created_by,created_at
  )
  values(
    v_user_id,
    lower(trim(p_username)),
    left(p_reason,500),
    now()+make_interval(mins=>p_minutes),
    auth.uid(),
    now()
  )
  on conflict(user_id) do update set
    username=excluded.username,
    reason=excluded.reason,
    expires_at=excluded.expires_at,
    created_by=excluded.created_by,
    created_at=now();

  perform public.staff_write_audit(
    'user_mute','user',lower(trim(p_username)),
    jsonb_build_object('minutes',p_minutes,'reason',p_reason)
  );
end;
$$;

create or replace function public.staff_clear_mute(p_username text)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_target_role text;
begin
  if not public.staff_has_permission('users_mute') then
    raise exception 'Missing permission: users_mute';
  end if;

  v_target_role:=public.staff_target_role(p_username);
  if v_target_role='staff' and public.staff_current_role()<>'owner' then
    raise exception 'Staff cannot moderate other staff';
  end if;

  delete from public.user_mutes
  where lower(username)=lower(trim(p_username));

  perform public.staff_write_audit('user_unmute','user',lower(trim(p_username)),'{}'::jsonb);
end;
$$;

create or replace function public.staff_warn_user(
  p_username text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user_id uuid;
  v_id uuid;
  v_target_role text;
begin
  if not public.staff_has_permission('users_warn') then
    raise exception 'Missing permission: users_warn';
  end if;

  select p.user_id into v_user_id
  from public.profiles p
  where lower(p.username)=lower(trim(p_username))
  limit 1;

  if v_user_id is null then raise exception 'User not found'; end if;

  v_target_role:=public.staff_target_role(p_username);
  if v_target_role='owner' then raise exception 'Owner cannot be warned'; end if;
  if v_target_role='staff' and public.staff_current_role()<>'owner' then
    raise exception 'Staff cannot warn other staff';
  end if;

  insert into public.user_warnings(user_id,username,reason,created_by)
  values(v_user_id,lower(trim(p_username)),left(trim(p_reason),1000),auth.uid())
  returning id into v_id;

  perform public.staff_write_audit(
    'user_warning','user',lower(trim(p_username)),
    jsonb_build_object('warning_id',v_id,'reason',p_reason)
  );

  return v_id;
end;
$$;

create or replace function public.staff_add_note(
  p_username text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user_id uuid;
  v_id uuid;
begin
  if not public.staff_has_permission('users_notes') then
    raise exception 'Missing permission: users_notes';
  end if;

  select p.user_id into v_user_id
  from public.profiles p
  where lower(p.username)=lower(trim(p_username))
  limit 1;

  if v_user_id is null then raise exception 'User not found'; end if;

  insert into public.staff_notes(user_id,username,note,created_by)
  values(v_user_id,lower(trim(p_username)),left(trim(p_note),2000),auth.uid())
  returning id into v_id;

  perform public.staff_write_audit(
    'staff_note','user',lower(trim(p_username)),
    jsonb_build_object('note_id',v_id)
  );

  return v_id;
end;
$$;

create or replace function public.staff_clear_recent_chat()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_count integer;
begin
  if not public.staff_has_permission('chat_moderate') then
    raise exception 'Missing permission: chat_moderate';
  end if;

  with deleted as (
    delete from public.chat_messages
    where created_at > now()-interval '24 hours'
    returning id
  )
  select count(*) into v_count from deleted;

  perform public.staff_write_audit(
    'chat_clear','chat',null,jsonb_build_object('count',v_count)
  );

  return v_count;
end;
$$;

create or replace function public.staff_set_chat_pin(p_message_id uuid default null)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.staff_has_permission('chat_moderate') then
    raise exception 'Missing permission: chat_moderate';
  end if;

  insert into public.site_settings(key,value,updated_by,updated_at)
  values(
    'chat_pinned_message_id',
    case when p_message_id is null then 'null'::jsonb else to_jsonb(p_message_id::text) end,
    auth.uid(),
    now()
  )
  on conflict(key) do update set
    value=excluded.value,
    updated_by=excluded.updated_by,
    updated_at=excluded.updated_at;

  perform public.staff_write_audit(
    case when p_message_id is null then 'chat_unpin' else 'chat_pin' end,
    'chat',
    p_message_id::text,
    '{}'::jsonb
  );
end;
$$;

-- ============================================================
-- STAFF REPORTS / ANNOUNCEMENTS / SETTINGS
-- ============================================================

create or replace function public.staff_update_report(
  p_report_id uuid,
  p_status text,
  p_resolution text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.staff_has_permission('reports_manage') then
    raise exception 'Missing permission: reports_manage';
  end if;

  if p_status not in ('open','reviewing','resolved','dismissed') then
    raise exception 'Invalid report status';
  end if;

  update public.moderation_reports
  set
    status=p_status,
    resolution=left(p_resolution,2000),
    assigned_to=case when p_status='reviewing' then auth.uid() else assigned_to end,
    updated_at=now()
  where id=p_report_id;

  perform public.staff_write_audit(
    'report_update','report',p_report_id::text,
    jsonb_build_object('status',p_status,'resolution',p_resolution)
  );
end;
$$;

create or replace function public.staff_publish_announcement(
  p_message text,
  p_starts_at timestamptz default now(),
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
begin
  if not public.staff_has_permission('announcements_manage') then
    raise exception 'Missing permission: announcements_manage';
  end if;

  if length(trim(coalesce(p_message,'')))<1 then
    raise exception 'Announcement cannot be empty';
  end if;

  update public.site_announcements
  set active=false
  where active=true;

  insert into public.site_announcements(
    message,active,created_by_alias,created_at,starts_at,expires_at
  )
  values(
    left(trim(p_message),500),
    true,
    coalesce(public.staff_current_username(),'staff'),
    now(),
    coalesce(p_starts_at,now()),
    p_expires_at
  )
  returning id into v_id;

  perform public.staff_write_audit(
    'announcement_publish','announcement',v_id::text,
    jsonb_build_object('expires_at',p_expires_at)
  );

  return v_id;
end;
$$;

create or replace function public.staff_clear_announcement()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.staff_has_permission('announcements_manage') then
    raise exception 'Missing permission: announcements_manage';
  end if;

  update public.site_announcements set active=false where active=true;
  perform public.staff_write_audit('announcement_clear','announcement',null,'{}'::jsonb);
end;
$$;

create or replace function public.staff_set_setting(
  p_key text,
  p_value jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.staff_has_permission('site_settings_manage') then
    raise exception 'Missing permission: site_settings_manage';
  end if;

  if p_key not in (
    'chat_locked',
    'chat_slow_mode_seconds',
    'chat_uploads_enabled',
    'maintenance_message',
    'chat_pinned_message_id'
  ) then
    raise exception 'Setting is not staff-editable';
  end if;

  if p_key='chat_slow_mode_seconds' then
    if jsonb_typeof(p_value)<>'number' or (p_value::text)::integer<0 or (p_value::text)::integer>3600 then
      raise exception 'Slow mode must be between 0 and 3600 seconds';
    end if;
  end if;

  insert into public.site_settings(key,value,updated_by,updated_at)
  values(p_key,p_value,auth.uid(),now())
  on conflict(key) do update set
    value=excluded.value,
    updated_by=excluded.updated_by,
    updated_at=excluded.updated_at;

  perform public.staff_write_audit(
    'site_setting','setting',p_key,jsonb_build_object('value',p_value)
  );
end;
$$;

-- ============================================================
-- STREAMS / HOMEPAGE / COLLECTIONS
-- ============================================================

create or replace function public.staff_set_stream_source(
  p_source_name text,
  p_enabled boolean,
  p_priority integer,
  p_notice text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.staff_has_permission('streams_manage') then
    raise exception 'Missing permission: streams_manage';
  end if;

  insert into public.stream_source_status(
    source_name,enabled,priority,notice,updated_by,updated_at
  )
  values(
    lower(trim(p_source_name)),
    p_enabled,
    greatest(1,least(coalesce(p_priority,999),9999)),
    nullif(left(trim(coalesce(p_notice,'')),300),''),
    auth.uid(),
    now()
  )
  on conflict(source_name) do update set
    enabled=excluded.enabled,
    priority=excluded.priority,
    notice=excluded.notice,
    updated_by=excluded.updated_by,
    updated_at=excluded.updated_at;

  perform public.staff_write_audit(
    'stream_source_update','stream_source',lower(trim(p_source_name)),
    jsonb_build_object('enabled',p_enabled,'priority',p_priority,'notice',p_notice)
  );
end;
$$;

create or replace function public.staff_create_collection(
  p_name text,
  p_description text default null,
  p_sort_order integer default 100
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
begin
  if not public.staff_has_permission('collections_manage') then
    raise exception 'Missing permission: collections_manage';
  end if;

  insert into public.staff_collections(name,description,sort_order,created_by)
  values(
    left(trim(p_name),100),
    nullif(left(trim(coalesce(p_description,'')),500),''),
    coalesce(p_sort_order,100),
    auth.uid()
  )
  returning id into v_id;

  perform public.staff_write_audit('collection_create','collection',v_id::text,jsonb_build_object('name',p_name));
  return v_id;
end;
$$;

create or replace function public.staff_delete_collection(p_collection_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.staff_has_permission('collections_manage') then
    raise exception 'Missing permission: collections_manage';
  end if;

  delete from public.staff_collections where id=p_collection_id;
  perform public.staff_write_audit('collection_delete','collection',p_collection_id::text,'{}'::jsonb);
end;
$$;

create or replace function public.staff_add_collection_item(
  p_collection_id uuid,
  p_media_id bigint,
  p_media_type text,
  p_title text,
  p_poster_path text default null,
  p_sort_order integer default 100
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
begin
  if not public.staff_has_permission('collections_manage') then
    raise exception 'Missing permission: collections_manage';
  end if;

  if p_media_type not in ('movie','tv') then
    raise exception 'Invalid media type';
  end if;

  insert into public.staff_collection_items(
    collection_id,media_id,media_type,title,poster_path,sort_order
  )
  values(
    p_collection_id,p_media_id,p_media_type,left(trim(p_title),200),p_poster_path,coalesce(p_sort_order,100)
  )
  on conflict(collection_id,media_type,media_id) do update set
    title=excluded.title,
    poster_path=excluded.poster_path,
    sort_order=excluded.sort_order
  returning id into v_id;

  perform public.staff_write_audit(
    'collection_item_add','collection',p_collection_id::text,
    jsonb_build_object('media_id',p_media_id,'media_type',p_media_type,'title',p_title)
  );

  return v_id;
end;
$$;

create or replace function public.staff_remove_collection_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.staff_has_permission('collections_manage') then
    raise exception 'Missing permission: collections_manage';
  end if;

  delete from public.staff_collection_items where id=p_item_id;
  perform public.staff_write_audit('collection_item_remove','collection_item',p_item_id::text,'{}'::jsonb);
end;
$$;

create or replace function public.staff_set_content_block(
  p_media_type text,
  p_media_id bigint,
  p_blocked boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.staff_has_permission('homepage_manage') then
    raise exception 'Missing permission: homepage_manage';
  end if;

  if p_media_type not in ('movie','tv') then
    raise exception 'Invalid media type';
  end if;

  if p_blocked then
    insert into public.content_blocks(media_type,media_id,reason,created_by)
    values(p_media_type,p_media_id,left(p_reason,500),auth.uid())
    on conflict(media_type,media_id) do update set
      reason=excluded.reason,
      created_by=excluded.created_by,
      created_at=now();
  else
    delete from public.content_blocks
    where media_type=p_media_type and media_id=p_media_id;
  end if;

  perform public.staff_write_audit(
    case when p_blocked then 'content_block' else 'content_unblock' end,
    'content',
    p_media_type||':'||p_media_id::text,
    jsonb_build_object('reason',p_reason)
  );
end;
$$;

-- ============================================================
-- SUPPORT / OWNER STAFF MANAGEMENT / PERMISSIONS
-- ============================================================

create or replace function public.staff_update_ticket(
  p_ticket_id uuid,
  p_status text,
  p_priority text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.staff_has_permission('support_manage') then
    raise exception 'Missing permission: support_manage';
  end if;

  if p_status not in ('open','waiting_user','waiting_staff','resolved','closed') then
    raise exception 'Invalid ticket status';
  end if;

  if p_priority is not null and p_priority not in ('low','normal','high','urgent') then
    raise exception 'Invalid priority';
  end if;

  update public.support_tickets
  set
    status=p_status,
    priority=coalesce(p_priority,priority),
    assigned_to=coalesce(assigned_to,auth.uid()),
    updated_at=now()
  where id=p_ticket_id;

  perform public.staff_write_audit(
    'support_ticket_update','support_ticket',p_ticket_id::text,
    jsonb_build_object('status',p_status,'priority',p_priority)
  );
end;
$$;

create or replace function public.owner_set_staff(
  p_username text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if public.staff_current_role()<>'owner' then
    raise exception 'Owner access required';
  end if;

  if lower(trim(p_username))='josh' then
    raise exception 'Owner cannot be changed';
  end if;

  if not exists(select 1 from public.profiles p where lower(p.username)=lower(trim(p_username))) then
    raise exception 'User not found';
  end if;

  if p_enabled then
    insert into public.chat_moderators(alias,created_at)
    values(lower(trim(p_username)),now())
    on conflict(alias) do nothing;
  else
    delete from public.chat_moderators
    where lower(alias)=lower(trim(p_username));
  end if;

  perform public.staff_write_audit(
    case when p_enabled then 'staff_grant' else 'staff_revoke' end,
    'user',
    lower(trim(p_username)),
    '{}'::jsonb
  );
end;
$$;

create or replace function public.owner_set_staff_permission(
  p_username text,
  p_permission text,
  p_allowed boolean
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user_id uuid;
begin
  if public.staff_current_role()<>'owner' then
    raise exception 'Owner access required';
  end if;

  select p.user_id into v_user_id
  from public.profiles p
  where lower(p.username)=lower(trim(p_username))
  limit 1;

  if v_user_id is null then raise exception 'User not found'; end if;
  if v_user_id='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then raise exception 'Owner permissions cannot be overridden'; end if;

  insert into public.staff_permission_overrides(user_id,permission,allowed,updated_by,updated_at)
  values(v_user_id,p_permission,p_allowed,auth.uid(),now())
  on conflict(user_id,permission) do update set
    allowed=excluded.allowed,
    updated_by=excluded.updated_by,
    updated_at=excluded.updated_at;

  perform public.staff_write_audit(
    'staff_permission','user',lower(trim(p_username)),
    jsonb_build_object('permission',p_permission,'allowed',p_allowed)
  );
end;
$$;

create or replace function public.get_staff_user_snapshot(p_username text)
returns jsonb
language plpgsql
security definer
stable
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_role text;
  v_ban jsonb;
  v_mute jsonb;
  v_warnings jsonb;
  v_notes jsonb;
begin
  if not public.staff_is_staff() then
    raise exception 'Staff access required';
  end if;

  select * into v_profile
  from public.profiles
  where lower(username)=lower(trim(p_username))
  limit 1;

  if v_profile.user_id is null then
    return null;
  end if;

  v_role:=public.staff_target_role(v_profile.username);

  select to_jsonb(b) into v_ban
  from public.chat_bans b
  where lower(b.alias)=lower(v_profile.username)
  limit 1;

  select to_jsonb(m) into v_mute
  from public.user_mutes m
  where m.user_id=v_profile.user_id
    and (m.expires_at is null or m.expires_at>now())
  limit 1;

  select coalesce(jsonb_agg(to_jsonb(w) order by w.created_at desc),'[]'::jsonb)
  into v_warnings
  from public.user_warnings w
  where w.user_id=v_profile.user_id;

  select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc),'[]'::jsonb)
  into v_notes
  from public.staff_notes n
  where n.user_id=v_profile.user_id;

  return jsonb_build_object(
    'profile',jsonb_build_object(
      'user_id',v_profile.user_id,
      'username',v_profile.username,
      'display_name',v_profile.display_name,
      'bio',v_profile.bio,
      'avatar_url',v_profile.avatar_url,
      'is_private',v_profile.is_private,
      'created_at',v_profile.created_at
    ),
    'role',v_role,
    'ban',v_ban,
    'mute',v_mute,
    'warnings',v_warnings,
    'notes',v_notes
  );
end;
$$;

create or replace function public.get_staff_dashboard_stats()
returns jsonb
language plpgsql
security definer
stable
set search_path=public
as $$
begin
  if not public.staff_is_staff() then
    raise exception 'Staff access required';
  end if;

  return jsonb_build_object(
    'open_reports',(select count(*) from public.moderation_reports where status in ('open','reviewing')),
    'banned_users',(select count(*) from public.chat_bans where expires_at is null or expires_at>now()),
    'active_mutes',(select count(*) from public.user_mutes where expires_at is null or expires_at>now()),
    'active_staff',(select count(*) from public.chat_moderators),
    'open_tickets',(select count(*) from public.support_tickets where status not in ('resolved','closed')),
    'active_collections',(select count(*) from public.staff_collections where active=true),
    'disabled_sources',(select count(*) from public.stream_source_status where enabled=false),
    'messages_24h',(select count(*) from public.chat_messages where created_at>now()-interval '24 hours')
  );
end;
$$;

-- ============================================================
-- RLS
-- ============================================================

alter table public.staff_permission_overrides enable row level security;
alter table public.staff_audit_log enable row level security;
alter table public.user_mutes enable row level security;
alter table public.user_warnings enable row level security;
alter table public.staff_notes enable row level security;
alter table public.moderation_reports enable row level security;
alter table public.site_settings enable row level security;
alter table public.stream_source_status enable row level security;
alter table public.staff_collections enable row level security;
alter table public.staff_collection_items enable row level security;
alter table public.content_blocks enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;

-- Staff read policies.
drop policy if exists "Staff read audit" on public.staff_audit_log;
create policy "Staff read audit" on public.staff_audit_log
for select to authenticated
using(public.staff_has_permission('audit_view'));

drop policy if exists "Staff read moderation reports" on public.moderation_reports;
create policy "Staff read moderation reports" on public.moderation_reports
for select to authenticated
using(public.staff_has_permission('reports_manage'));

drop policy if exists "Staff read mutes" on public.user_mutes;
create policy "Staff read mutes" on public.user_mutes
for select to authenticated
using(public.staff_is_staff());

drop policy if exists "Staff read warnings" on public.user_warnings;
create policy "Staff read warnings" on public.user_warnings
for select to authenticated
using(public.staff_is_staff() or user_id=auth.uid());

drop policy if exists "Staff read notes" on public.staff_notes;
create policy "Staff read notes" on public.staff_notes
for select to authenticated
using(public.staff_has_permission('users_notes'));

drop policy if exists "Staff read settings" on public.site_settings;
create policy "Staff read settings" on public.site_settings
for select to authenticated
using(public.staff_is_staff());

drop policy if exists "Staff read sources" on public.stream_source_status;
create policy "Staff read sources" on public.stream_source_status
for select to authenticated
using(public.staff_is_staff());

drop policy if exists "Staff read collections" on public.staff_collections;
create policy "Staff read collections" on public.staff_collections
for select to authenticated
using(public.staff_is_staff());

drop policy if exists "Staff read collection items" on public.staff_collection_items;
create policy "Staff read collection items" on public.staff_collection_items
for select to authenticated
using(public.staff_is_staff());

drop policy if exists "Staff read content blocks" on public.content_blocks;
create policy "Staff read content blocks" on public.content_blocks
for select to authenticated
using(public.staff_is_staff());

drop policy if exists "Owner read permission overrides" on public.staff_permission_overrides;
create policy "Owner read permission overrides" on public.staff_permission_overrides
for select to authenticated
using(public.staff_current_role()='owner');

-- Support: owner of ticket or staff.
drop policy if exists "Users and staff read support tickets" on public.support_tickets;
create policy "Users and staff read support tickets" on public.support_tickets
for select to authenticated
using(user_id=auth.uid() or public.staff_has_permission('support_manage'));

drop policy if exists "Users and staff read support messages" on public.support_ticket_messages;
create policy "Users and staff read support messages" on public.support_ticket_messages
for select to authenticated
using(
  exists(
    select 1 from public.support_tickets t
    where t.id=public.support_ticket_messages.ticket_id
      and (t.user_id=auth.uid() or public.staff_has_permission('support_manage'))
  )
);

-- Users can see their own warnings.
drop policy if exists "Users read own warnings" on public.user_warnings;
create policy "Users read own warnings" on public.user_warnings
for select to authenticated
using(user_id=auth.uid());

-- All writes are intended to go through RPCs above.
revoke insert,update,delete on public.staff_permission_overrides from anon,authenticated;
revoke insert,update,delete on public.staff_audit_log from anon,authenticated;
revoke insert,update,delete on public.user_mutes from anon,authenticated;
revoke insert,update,delete on public.user_warnings from anon,authenticated;
revoke insert,update,delete on public.staff_notes from anon,authenticated;
revoke insert,update,delete on public.moderation_reports from anon,authenticated;
revoke insert,update,delete on public.site_settings from anon,authenticated;
revoke insert,update,delete on public.stream_source_status from anon,authenticated;
revoke insert,update,delete on public.staff_collections from anon,authenticated;
revoke insert,update,delete on public.staff_collection_items from anon,authenticated;
revoke insert,update,delete on public.content_blocks from anon,authenticated;
revoke insert,update,delete on public.support_tickets from anon,authenticated;
revoke insert,update,delete on public.support_ticket_messages from anon,authenticated;

grant select on public.staff_audit_log to authenticated;
grant select on public.user_mutes to authenticated;
grant select on public.user_warnings to authenticated;
grant select on public.staff_notes to authenticated;
grant select on public.moderation_reports to authenticated;
grant select on public.site_settings to authenticated;
grant select on public.stream_source_status to authenticated;
grant select on public.staff_collections to authenticated;
grant select on public.staff_collection_items to authenticated;
grant select on public.content_blocks to authenticated;
grant select on public.support_tickets to authenticated;
grant select on public.support_ticket_messages to authenticated;
grant select on public.staff_permission_overrides to authenticated;

-- Public/user RPC grants.
grant execute on function public.get_public_profile_role(text) to anon,authenticated;
grant execute on function public.get_public_site_config() to anon,authenticated;
grant execute on function public.get_public_stream_source_status() to anon,authenticated;
grant execute on function public.get_public_content_blocks() to anon,authenticated;
grant execute on function public.get_public_staff_collections() to anon,authenticated;
grant execute on function public.submit_moderation_report(text,text,text,text,jsonb) to authenticated;
grant execute on function public.create_support_ticket(text,text) to authenticated;
grant execute on function public.add_support_ticket_message(uuid,text) to authenticated;

-- Staff RPC grants; the functions still do their own permission checks.
grant execute on function public.get_staff_context() to authenticated;
grant execute on function public.get_staff_dashboard_stats() to authenticated;
grant execute on function public.get_staff_user_snapshot(text) to authenticated;
grant execute on function public.staff_set_ban(text,boolean,integer,text) to authenticated;
grant execute on function public.staff_set_mute(text,integer,text) to authenticated;
grant execute on function public.staff_clear_mute(text) to authenticated;
grant execute on function public.staff_warn_user(text,text) to authenticated;
grant execute on function public.staff_add_note(text,text) to authenticated;
grant execute on function public.staff_clear_recent_chat() to authenticated;
grant execute on function public.staff_set_chat_pin(uuid) to authenticated;
grant execute on function public.staff_update_report(uuid,text,text) to authenticated;
grant execute on function public.staff_publish_announcement(text,timestamptz,timestamptz) to authenticated;
grant execute on function public.staff_clear_announcement() to authenticated;
grant execute on function public.staff_set_setting(text,jsonb) to authenticated;
grant execute on function public.staff_set_stream_source(text,boolean,integer,text) to authenticated;
grant execute on function public.staff_create_collection(text,text,integer) to authenticated;
grant execute on function public.staff_delete_collection(uuid) to authenticated;
grant execute on function public.staff_add_collection_item(uuid,bigint,text,text,text,integer) to authenticated;
grant execute on function public.staff_remove_collection_item(uuid) to authenticated;
grant execute on function public.staff_set_content_block(text,bigint,boolean,text) to authenticated;
grant execute on function public.staff_update_ticket(uuid,text,text) to authenticated;
grant execute on function public.owner_set_staff(text,boolean) to authenticated;
grant execute on function public.owner_set_staff_permission(text,text,boolean) to authenticated;

-- Chat-media upload can be switched off centrally.
create or replace function public.chat_uploads_enabled()
returns boolean
language sql
security definer
stable
set search_path=public
as $$
  select coalesce(
    (select (value::text)::boolean from public.site_settings where key='chat_uploads_enabled'),
    true
  )
$$;

drop policy if exists "Authenticated users upload own chat media" on storage.objects;
create policy "Authenticated users upload own chat media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id='chat-media'
  and (storage.foldername(name))[1]=auth.uid()::text
  and public.chat_uploads_enabled()
);

-- ============================================================
-- END
-- ============================================================


-- ============================================================
-- PROFESSIONAL V2: ACCOUNT-LEVEL MODERATION + USERNAME HISTORY
-- ============================================================

-- Moderation and Staff status now attach to auth UUIDs as well as aliases.
alter table public.chat_bans
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.chat_moderators
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Backfill UUIDs from the current profile username.
update public.chat_bans b
set user_id=p.user_id
from public.profiles p
where b.user_id is null
  and lower(b.alias)=lower(p.username);

update public.chat_moderators m
set user_id=p.user_id
from public.profiles p
where m.user_id is null
  and lower(m.alias)=lower(p.username);

create unique index if not exists chat_bans_user_id_unique
  on public.chat_bans(user_id)
  where user_id is not null;

create unique index if not exists chat_moderators_user_id_unique
  on public.chat_moderators(user_id)
  where user_id is not null;

-- Permanent username ownership/history prevents another account taking an
-- old username and inheriting identity confusion.
create table if not exists public.username_history (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  changed_at timestamptz not null default now()
);

create unique index if not exists username_history_lower_unique
  on public.username_history(lower(username));

insert into public.username_history(user_id,username)
select p.user_id,p.username
from public.profiles p
where p.username is not null
on conflict do nothing;

-- Center-screen user notices.
create table if not exists public.account_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'ban','unban','mute','unmute','warning',
      'staff_granted','staff_revoked'
    )
  ),
  title text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

alter table public.account_events enable row level security;

drop policy if exists "Users read own account events" on public.account_events;
create policy "Users read own account events"
on public.account_events
for select
to authenticated
using(user_id=auth.uid());

revoke insert,update,delete on public.account_events from anon,authenticated;
grant select on public.account_events to authenticated;

create or replace function public.f2w_emit_account_event(
  p_user_id uuid,
  p_event_type text,
  p_title text,
  p_message text,
  p_details jsonb default '{}'::jsonb,
  p_created_by uuid default auth.uid()
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
begin
  if p_user_id is null then
    raise exception 'Target user is required';
  end if;

  insert into public.account_events(
    user_id,event_type,title,message,details,created_by
  )
  values(
    p_user_id,
    p_event_type,
    left(p_title,160),
    left(p_message,2000),
    coalesce(p_details,'{}'::jsonb),
    p_created_by
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.f2w_emit_account_event(uuid,text,text,text,jsonb,uuid) from public,anon,authenticated;

create or replace function public.acknowledge_account_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.account_events
  set acknowledged_at=coalesce(acknowledged_at,now())
  where id=p_event_id
    and user_id=auth.uid();
end;
$$;

grant execute on function public.acknowledge_account_event(uuid) to authenticated;

-- Canonical role checks are UUID-first.
create or replace function public.staff_current_role()
returns text
language plpgsql
security definer
stable
set search_path=public
as $$
begin
  if auth.uid() is null then
    return 'member';
  end if;

  if auth.uid()='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    return 'owner';
  end if;

  if exists(
    select 1
    from public.chat_moderators m
    where m.user_id=auth.uid()
       or (
         m.user_id is null
         and lower(m.alias)=lower(coalesce(public.staff_current_username(),''))
       )
  ) then
    return 'staff';
  end if;

  return 'member';
end;
$$;

create or replace function public.staff_target_role(p_username text)
returns text
language plpgsql
security definer
stable
set search_path=public
as $$
declare
  v_user_id uuid;
begin
  select p.user_id into v_user_id
  from public.profiles p
  where lower(p.username)=lower(trim(p_username))
  limit 1;

  if v_user_id is null then
    return 'missing';
  end if;

  if v_user_id='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    return 'owner';
  end if;

  if exists(
    select 1
    from public.chat_moderators m
    where m.user_id=v_user_id
       or (
         m.user_id is null
         and lower(m.alias)=lower(trim(p_username))
       )
  ) then
    return 'staff';
  end if;

  return 'member';
end;
$$;

create or replace function public.get_public_profile_role(target_username text)
returns text
language plpgsql
security definer
stable
set search_path=public
as $$
declare
  v_user_id uuid;
begin
  select p.user_id into v_user_id
  from public.profiles p
  where lower(p.username)=lower(trim(target_username))
  limit 1;

  if v_user_id is null then
    return null;
  end if;

  if v_user_id='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    return 'owner';
  end if;

  if exists(
    select 1
    from public.chat_moderators m
    where m.user_id=v_user_id
       or (
         m.user_id is null
         and lower(m.alias)=lower(trim(target_username))
       )
  ) then
    return 'staff';
  end if;

  return null;
end;
$$;

-- Current signed-in moderation state. This is what the site-wide account guard uses.
create or replace function public.get_my_account_state()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user_id uuid:=auth.uid();
  v_username text;
  v_role text;
  v_ban public.chat_bans%rowtype;
  v_mute public.user_mutes%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select p.username into v_username
  from public.profiles p
  where p.user_id=v_user_id
  limit 1;

  v_role:=public.staff_current_role();

  -- Owner can never be locked out by moderation data.
  if v_user_id<>'f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    select b.* into v_ban
    from public.chat_bans b
    where b.user_id=v_user_id
       or (
         b.user_id is null
         and lower(b.alias)=lower(coalesce(v_username,''))
       )
    order by b.created_at desc
    limit 1;

    if v_ban.alias is not null
       and v_ban.expires_at is not null
       and v_ban.expires_at<=now() then
      delete from public.chat_bans
      where alias=v_ban.alias;
      v_ban:=null;
    end if;
  end if;

  select m.* into v_mute
  from public.user_mutes m
  where m.user_id=v_user_id
  limit 1;

  if v_mute.user_id is not null
     and v_mute.expires_at is not null
     and v_mute.expires_at<=now() then
    delete from public.user_mutes where user_id=v_user_id;
    v_mute:=null;
  end if;

  return jsonb_build_object(
    'user_id',v_user_id,
    'username',v_username,
    'role',v_role,
    'banned',v_ban.alias is not null,
    'ban_reason',v_ban.reason,
    'ban_expires_at',v_ban.expires_at,
    'muted',v_mute.user_id is not null,
    'mute_reason',v_mute.reason,
    'mute_expires_at',v_mute.expires_at,
    'warning_count',(
      select count(*)
      from public.user_warnings w
      where w.user_id=v_user_id and w.active=true
    )
  );
end;
$$;

grant execute on function public.get_my_account_state() to authenticated;

-- Username changes are unlimited, but identity/moderation stays attached to UUID.
create or replace function public.change_my_username(p_new_username text)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_user_id uuid:=auth.uid();
  v_old_username text;
  v_new_username text:=trim(coalesce(p_new_username,''));
  v_history_owner uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_new_username !~ '^[A-Za-z0-9]{2,30}$' then
    raise exception 'Username must use 2-30 English letters or numbers only';
  end if;

  if lower(v_new_username)='josh'
     and v_user_id<>'f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    raise exception 'That username is reserved';
  end if;

  select p.username into v_old_username
  from public.profiles p
  where p.user_id=v_user_id
  for update;

  if v_old_username is null then
    raise exception 'Profile not found';
  end if;

  if lower(v_old_username)=lower(v_new_username) then
    update public.profiles
    set username=v_new_username,updated_at=now()
    where user_id=v_user_id;

    return jsonb_build_object('username',v_new_username,'changed',false);
  end if;

  if exists(
    select 1 from public.profiles p
    where p.user_id<>v_user_id
      and lower(p.username)=lower(v_new_username)
  ) then
    raise exception 'That username is already taken';
  end if;

  select h.user_id into v_history_owner
  from public.username_history h
  where lower(h.username)=lower(v_new_username)
  limit 1;

  if v_history_owner is not null and v_history_owner<>v_user_id then
    raise exception 'That username belongs to another account';
  end if;

  insert into public.username_history(user_id,username)
  values(v_user_id,v_old_username)
  on conflict do nothing;

  insert into public.username_history(user_id,username)
  values(v_user_id,v_new_username)
  on conflict do nothing;

  -- Update alias-backed legacy tables while UUID-backed moderation remains intact.
  update public.chat_moderators
  set alias=lower(v_new_username),user_id=v_user_id
  where user_id=v_user_id
     or (user_id is null and lower(alias)=lower(v_old_username));

  update public.chat_bans
  set alias=lower(v_new_username),user_id=v_user_id
  where user_id=v_user_id
     or (user_id is null and lower(alias)=lower(v_old_username));

  update public.user_mutes
  set username=lower(v_new_username)
  where user_id=v_user_id;

  update public.user_warnings
  set username=lower(v_new_username)
  where user_id=v_user_id;

  update public.staff_notes
  set username=lower(v_new_username)
  where user_id=v_user_id;

  update public.support_tickets
  set username=v_new_username,updated_at=now()
  where user_id=v_user_id;

  update public.chat_messages
  set alias=lower(v_new_username)
  where lower(alias)=lower(v_old_username)
    and created_at>now()-interval '24 hours';

  update public.profiles
  set username=v_new_username,updated_at=now()
  where user_id=v_user_id;

  -- Keep Supabase Auth metadata in sync with the authoritative profile record.
  update auth.users
  set raw_user_meta_data=
    jsonb_set(
      jsonb_set(
        coalesce(raw_user_meta_data,'{}'::jsonb),
        '{username}',
        to_jsonb(v_new_username),
        true
      ),
      '{chat_alias}',
      to_jsonb(v_new_username),
      true
    )
  where id=v_user_id;

  return jsonb_build_object(
    'username',v_new_username,
    'previous_username',v_old_username,
    'changed',true
  );
end;
$$;

grant execute on function public.change_my_username(text) to authenticated;

-- Staff dashboard actions now emit user-facing events and write UUID-backed bans.
create or replace function public.staff_set_ban(
  p_username text,
  p_banned boolean,
  p_minutes integer default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_target_role text;
  v_target_user_id uuid;
  v_expires timestamptz;
begin
  if not public.staff_has_permission('users_ban') then
    raise exception 'Missing permission: users_ban';
  end if;

  select p.user_id into v_target_user_id
  from public.profiles p
  where lower(p.username)=lower(trim(p_username))
  limit 1;

  if v_target_user_id is null then
    raise exception 'User not found';
  end if;

  v_target_role:=public.staff_target_role(p_username);

  if v_target_role='owner' then
    raise exception 'Owner cannot be moderated';
  end if;

  if v_target_role='staff' and public.staff_current_role()<>'owner' then
    raise exception 'Staff cannot moderate other Staff';
  end if;

  if p_banned then
    v_expires:=case
      when p_minutes is null or p_minutes<=0 then null
      else now()+make_interval(mins=>p_minutes)
    end;

    delete from public.chat_bans
    where user_id=v_target_user_id
      and lower(alias)<>lower(trim(p_username));

    insert into public.chat_bans(
      alias,user_id,created_at,reason,created_by,expires_at
    )
    values(
      lower(trim(p_username)),
      v_target_user_id,
      now(),
      left(p_reason,500),
      auth.uid(),
      v_expires
    )
    on conflict(alias) do update set
      user_id=excluded.user_id,
      reason=excluded.reason,
      created_by=excluded.created_by,
      expires_at=excluded.expires_at,
      created_at=now();

    perform public.f2w_emit_account_event(
      v_target_user_id,
      'ban',
      'Your account has been banned',
      'Staff have suspended this account from using Flix2Watch.',
      jsonb_build_object(
        'reason',nullif(trim(coalesce(p_reason,'')),''),
        'expires_at',v_expires,
        'duration_minutes',p_minutes
      ),
      auth.uid()
    );
  else
    delete from public.chat_bans
    where user_id=v_target_user_id
       or lower(alias)=lower(trim(p_username));

    perform public.f2w_emit_account_event(
      v_target_user_id,
      'unban',
      'Your account has been unbanned',
      'Staff have restored access to Flix2Watch for this account.',
      '{}'::jsonb,
      auth.uid()
    );
  end if;

  perform public.staff_write_audit(
    case when p_banned then 'user_ban' else 'user_unban' end,
    'user',
    lower(trim(p_username)),
    jsonb_build_object('user_id',v_target_user_id,'minutes',p_minutes,'reason',p_reason)
  );
end;
$$;

create or replace function public.staff_set_mute(
  p_username text,
  p_minutes integer,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user_id uuid;
  v_target_role text;
  v_expires timestamptz;
begin
  if not public.staff_has_permission('users_mute') then
    raise exception 'Missing permission: users_mute';
  end if;

  if p_minutes is null or p_minutes<1 then
    raise exception 'Mute duration must be at least 1 minute';
  end if;

  select p.user_id into v_user_id
  from public.profiles p
  where lower(p.username)=lower(trim(p_username))
  limit 1;

  if v_user_id is null then
    raise exception 'User not found';
  end if;

  v_target_role:=public.staff_target_role(p_username);

  if v_target_role='owner' then
    raise exception 'Owner cannot be muted';
  end if;

  if v_target_role='staff' and public.staff_current_role()<>'owner' then
    raise exception 'Staff cannot mute other Staff';
  end if;

  v_expires:=now()+make_interval(mins=>p_minutes);

  insert into public.user_mutes(
    user_id,username,reason,expires_at,created_by,created_at
  )
  values(
    v_user_id,
    lower(trim(p_username)),
    left(p_reason,500),
    v_expires,
    auth.uid(),
    now()
  )
  on conflict(user_id) do update set
    username=excluded.username,
    reason=excluded.reason,
    expires_at=excluded.expires_at,
    created_by=excluded.created_by,
    created_at=now();

  perform public.f2w_emit_account_event(
    v_user_id,
    'mute',
    'You have been muted',
    'Staff have temporarily disabled chat sending for your account.',
    jsonb_build_object(
      'reason',nullif(trim(coalesce(p_reason,'')),''),
      'expires_at',v_expires,
      'duration_minutes',p_minutes
    ),
    auth.uid()
  );

  perform public.staff_write_audit(
    'user_mute','user',lower(trim(p_username)),
    jsonb_build_object('user_id',v_user_id,'minutes',p_minutes,'reason',p_reason)
  );
end;
$$;

create or replace function public.staff_clear_mute(p_username text)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user_id uuid;
  v_target_role text;
begin
  if not public.staff_has_permission('users_mute') then
    raise exception 'Missing permission: users_mute';
  end if;

  select p.user_id into v_user_id
  from public.profiles p
  where lower(p.username)=lower(trim(p_username))
  limit 1;

  if v_user_id is null then raise exception 'User not found'; end if;

  v_target_role:=public.staff_target_role(p_username);
  if v_target_role='staff' and public.staff_current_role()<>'owner' then
    raise exception 'Staff cannot moderate other Staff';
  end if;

  delete from public.user_mutes where user_id=v_user_id;

  perform public.f2w_emit_account_event(
    v_user_id,
    'unmute',
    'Your mute has been removed',
    'Staff have restored your ability to send chat messages.',
    '{}'::jsonb,
    auth.uid()
  );

  perform public.staff_write_audit(
    'user_unmute','user',lower(trim(p_username)),
    jsonb_build_object('user_id',v_user_id)
  );
end;
$$;

create or replace function public.staff_warn_user(
  p_username text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user_id uuid;
  v_id uuid;
  v_target_role text;
begin
  if not public.staff_has_permission('users_warn') then
    raise exception 'Missing permission: users_warn';
  end if;

  select p.user_id into v_user_id
  from public.profiles p
  where lower(p.username)=lower(trim(p_username))
  limit 1;

  if v_user_id is null then raise exception 'User not found'; end if;

  v_target_role:=public.staff_target_role(p_username);
  if v_target_role='owner' then raise exception 'Owner cannot be warned'; end if;
  if v_target_role='staff' and public.staff_current_role()<>'owner' then
    raise exception 'Staff cannot warn other Staff';
  end if;

  insert into public.user_warnings(user_id,username,reason,created_by)
  values(v_user_id,lower(trim(p_username)),left(trim(p_reason),1000),auth.uid())
  returning id into v_id;

  perform public.f2w_emit_account_event(
    v_user_id,
    'warning',
    'You received a Staff warning',
    left(trim(p_reason),1000),
    jsonb_build_object('reason',left(trim(p_reason),1000),'warning_id',v_id),
    auth.uid()
  );

  perform public.staff_write_audit(
    'user_warning','user',lower(trim(p_username)),
    jsonb_build_object('user_id',v_user_id,'warning_id',v_id,'reason',p_reason)
  );

  return v_id;
end;
$$;

create or replace function public.owner_set_staff(
  p_username text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user_id uuid;
begin
  if public.staff_current_role()<>'owner' then
    raise exception 'Owner access required';
  end if;

  select p.user_id into v_user_id
  from public.profiles p
  where lower(p.username)=lower(trim(p_username))
  limit 1;

  if v_user_id is null then
    raise exception 'User not found';
  end if;

  if v_user_id='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    raise exception 'Owner cannot be changed';
  end if;

  if p_enabled then
    delete from public.chat_moderators
    where user_id=v_user_id
      and lower(alias)<>lower(trim(p_username));

    insert into public.chat_moderators(alias,user_id,created_at)
    values(lower(trim(p_username)),v_user_id,now())
    on conflict(alias) do update set
      user_id=excluded.user_id,
      created_at=excluded.created_at;

    perform public.f2w_emit_account_event(
      v_user_id,
      'staff_granted',
      'You are now Flix2Watch Staff',
      'The Owner granted this account Staff access. Your Staff Control Center is now available.',
      '{}'::jsonb,
      auth.uid()
    );
  else
    delete from public.chat_moderators
    where user_id=v_user_id
       or lower(alias)=lower(trim(p_username));

    perform public.f2w_emit_account_event(
      v_user_id,
      'staff_revoked',
      'Your Staff access was removed',
      'The Owner removed Staff permissions from this account.',
      '{}'::jsonb,
      auth.uid()
    );
  end if;

  perform public.staff_write_audit(
    case when p_enabled then 'staff_grant' else 'staff_revoke' end,
    'user',
    lower(trim(p_username)),
    jsonb_build_object('user_id',v_user_id)
  );
end;
$$;

-- End Professional V2.


-- Username history is also enforced for future signups/direct profile inserts.
create or replace function public.enforce_username_history_ownership()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_owner uuid;
begin
  if new.username is null or new.username !~ '^[A-Za-z0-9]{2,30}$' then
    raise exception 'Username must use 2-30 English letters or numbers only';
  end if;

  select h.user_id into v_owner
  from public.username_history h
  where lower(h.username)=lower(new.username)
  limit 1;

  if v_owner is not null and v_owner<>new.user_id then
    raise exception 'That username belongs to another account';
  end if;

  return new;
end;
$$;

create or replace function public.remember_profile_username()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.username_history(user_id,username)
  values(new.user_id,new.username)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_username_history_guard on public.profiles;
create trigger profiles_username_history_guard
before insert or update of username on public.profiles
for each row execute function public.enforce_username_history_ownership();

drop trigger if exists profiles_username_history_remember on public.profiles;
create trigger profiles_username_history_remember
after insert or update of username on public.profiles
for each row execute function public.remember_profile_username();


-- ============================================================
-- PROFESSIONAL V2: BANNED-ACCOUNT WRITE LOCK
-- ============================================================

create or replace function public.account_is_banned(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path=public
as $$
  select case
    when p_user_id is null then false
    when p_user_id='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then false
    else exists(
      select 1
      from public.chat_bans b
      left join public.profiles p on p.user_id=p_user_id
      where (
        b.user_id=p_user_id
        or (
          b.user_id is null
          and lower(b.alias)=lower(coalesce(p.username,''))
        )
      )
      and (b.expires_at is null or b.expires_at>now())
    )
  end
$$;

revoke all on function public.account_is_banned(uuid) from public,anon;
grant execute on function public.account_is_banned(uuid) to authenticated;

-- Profiles.
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (
  auth.uid()=user_id
  and not public.account_is_banned(auth.uid())
);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (
  auth.uid()=user_id
  and not public.account_is_banned(auth.uid())
)
with check (
  auth.uid()=user_id
  and not public.account_is_banned(auth.uid())
);

-- Favorites.
drop policy if exists "Users can insert own favorites" on public.user_favorites;
create policy "Users can insert own favorites"
on public.user_favorites
for insert
to authenticated
with check (
  auth.uid()=user_id
  and not public.account_is_banned(auth.uid())
);

drop policy if exists "Users can delete own favorites" on public.user_favorites;
create policy "Users can delete own favorites"
on public.user_favorites
for delete
to authenticated
using (
  auth.uid()=user_id
  and not public.account_is_banned(auth.uid())
);

-- Following.
drop policy if exists "Users can follow other users" on public.profile_follows;
create policy "Users can follow other users"
on public.profile_follows
for insert
to authenticated
with check (
  auth.uid()=follower_user_id
  and follower_user_id<>followed_user_id
  and not public.account_is_banned(auth.uid())
);

drop policy if exists "Users can unfollow" on public.profile_follows;
create policy "Users can unfollow"
on public.profile_follows
for delete
to authenticated
using (
  auth.uid()=follower_user_id
  and not public.account_is_banned(auth.uid())
);

-- Avatar writes.
drop policy if exists "Users upload own profile avatars" on storage.objects;
create policy "Users upload own profile avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id='profile-avatars'
  and (storage.foldername(name))[1]=auth.uid()::text
  and not public.account_is_banned(auth.uid())
);

drop policy if exists "Users update own profile avatars" on storage.objects;
create policy "Users update own profile avatars"
on storage.objects
for update
to authenticated
using (
  bucket_id='profile-avatars'
  and (storage.foldername(name))[1]=auth.uid()::text
  and not public.account_is_banned(auth.uid())
)
with check (
  bucket_id='profile-avatars'
  and (storage.foldername(name))[1]=auth.uid()::text
  and not public.account_is_banned(auth.uid())
);

drop policy if exists "Users delete own profile avatars" on storage.objects;
create policy "Users delete own profile avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id='profile-avatars'
  and (storage.foldername(name))[1]=auth.uid()::text
  and not public.account_is_banned(auth.uid())
);

-- Chat-media writes.
drop policy if exists "Authenticated users upload own chat media" on storage.objects;
create policy "Authenticated users upload own chat media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id='chat-media'
  and (storage.foldername(name))[1]=auth.uid()::text
  and public.chat_uploads_enabled()
  and not public.account_is_banned(auth.uid())
);

drop policy if exists "Users delete own chat media" on storage.objects;
create policy "Users delete own chat media"
on storage.objects
for delete
to authenticated
using (
  bucket_id='chat-media'
  and (storage.foldername(name))[1]=auth.uid()::text
  and not public.account_is_banned(auth.uid())
);

-- A banned account cannot rename itself through the secured RPC either.
create or replace function public.change_my_username(p_new_username text)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_user_id uuid:=auth.uid();
  v_old_username text;
  v_new_username text:=trim(coalesce(p_new_username,''));
  v_history_owner uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if public.account_is_banned(v_user_id) then
    raise exception 'Banned accounts cannot change username';
  end if;

  if v_new_username !~ '^[A-Za-z0-9]{2,30}$' then
    raise exception 'Username must use 2-30 English letters or numbers only';
  end if;

  if lower(v_new_username)='josh'
     and v_user_id<>'f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    raise exception 'That username is reserved';
  end if;

  select p.username into v_old_username
  from public.profiles p
  where p.user_id=v_user_id
  for update;

  if v_old_username is null then
    raise exception 'Profile not found';
  end if;

  if lower(v_old_username)=lower(v_new_username) then
    update public.profiles
    set username=v_new_username,updated_at=now()
    where user_id=v_user_id;

    update auth.users
    set raw_user_meta_data=
      jsonb_set(
        jsonb_set(
          coalesce(raw_user_meta_data,'{}'::jsonb),
          '{username}',
          to_jsonb(v_new_username),
          true
        ),
        '{chat_alias}',
        to_jsonb(v_new_username),
        true
      )
    where id=v_user_id;

    return jsonb_build_object('username',v_new_username,'changed',false);
  end if;

  if exists(
    select 1 from public.profiles p
    where p.user_id<>v_user_id
      and lower(p.username)=lower(v_new_username)
  ) then
    raise exception 'That username is already taken';
  end if;

  select h.user_id into v_history_owner
  from public.username_history h
  where lower(h.username)=lower(v_new_username)
  limit 1;

  if v_history_owner is not null and v_history_owner<>v_user_id then
    raise exception 'That username belongs to another account';
  end if;

  insert into public.username_history(user_id,username)
  values(v_user_id,v_old_username)
  on conflict do nothing;

  insert into public.username_history(user_id,username)
  values(v_user_id,v_new_username)
  on conflict do nothing;

  update public.chat_moderators
  set alias=lower(v_new_username),user_id=v_user_id
  where user_id=v_user_id
     or (user_id is null and lower(alias)=lower(v_old_username));

  update public.chat_bans
  set alias=lower(v_new_username),user_id=v_user_id
  where user_id=v_user_id
     or (user_id is null and lower(alias)=lower(v_old_username));

  update public.user_mutes
  set username=lower(v_new_username)
  where user_id=v_user_id;

  update public.user_warnings
  set username=lower(v_new_username)
  where user_id=v_user_id;

  update public.staff_notes
  set username=lower(v_new_username)
  where user_id=v_user_id;

  update public.support_tickets
  set username=v_new_username,updated_at=now()
  where user_id=v_user_id;

  update public.chat_messages
  set alias=lower(v_new_username)
  where lower(alias)=lower(v_old_username)
    and created_at>now()-interval '24 hours';

  update public.profiles
  set username=v_new_username,updated_at=now()
  where user_id=v_user_id;

  update auth.users
  set raw_user_meta_data=
    jsonb_set(
      jsonb_set(
        coalesce(raw_user_meta_data,'{}'::jsonb),
        '{username}',
        to_jsonb(v_new_username),
        true
      ),
      '{chat_alias}',
      to_jsonb(v_new_username),
      true
    )
  where id=v_user_id;

  return jsonb_build_object(
    'username',v_new_username,
    'previous_username',v_old_username,
    'changed',true
  );
end;
$$;

grant execute on function public.change_my_username(text) to authenticated;

-- End banned-account write lock.


-- Banned Staff lose privileged RPC access until the Owner unbans them.
create or replace function public.staff_current_role()
returns text
language plpgsql
security definer
stable
set search_path=public
as $$
begin
  if auth.uid() is null then
    return 'member';
  end if;

  if auth.uid()='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    return 'owner';
  end if;

  if public.account_is_banned(auth.uid()) then
    return 'member';
  end if;

  if exists(
    select 1
    from public.chat_moderators m
    where m.user_id=auth.uid()
       or (
         m.user_id is null
         and lower(m.alias)=lower(coalesce(public.staff_current_username(),''))
       )
  ) then
    return 'staff';
  end if;

  return 'member';
end;
$$;

create or replace function public.submit_moderation_report(
  p_target_type text,
  p_target_id text,
  p_target_username text,
  p_reason text,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.account_is_banned(auth.uid()) then
    raise exception 'Banned accounts cannot submit reports';
  end if;

  if p_target_type not in ('profile','chat','stream','content','other') then
    raise exception 'Invalid report type';
  end if;

  if length(trim(coalesce(p_reason,'')))<3 then
    raise exception 'Please provide a report reason';
  end if;

  insert into public.moderation_reports(
    reporter_user_id,target_type,target_id,target_username,reason,details
  )
  values(
    auth.uid(),p_target_type,p_target_id,p_target_username,
    left(trim(p_reason),500),coalesce(p_details,'{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.create_support_ticket(
  p_subject text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_ticket uuid;
  v_username text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.account_is_banned(auth.uid()) then
    raise exception 'Banned accounts cannot create support tickets while signed in';
  end if;

  if length(trim(coalesce(p_subject,'')))<3 then
    raise exception 'Subject is too short';
  end if;

  if length(trim(coalesce(p_message,'')))<3 then
    raise exception 'Message is too short';
  end if;

  select p.username into v_username
  from public.profiles p
  where p.user_id=auth.uid();

  insert into public.support_tickets(user_id,username,subject)
  values(auth.uid(),v_username,left(trim(p_subject),160))
  returning id into v_ticket;

  insert into public.support_ticket_messages(
    ticket_id,sender_user_id,sender_role,message
  )
  values(
    v_ticket,auth.uid(),'member',left(trim(p_message),4000)
  );

  return v_ticket;
end;
$$;

create or replace function public.add_support_ticket_message(
  p_ticket_id uuid,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_message_id uuid;
  v_role text;
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if public.account_is_banned(auth.uid()) then
    raise exception 'Banned accounts cannot send support messages while signed in';
  end if;

  if length(trim(coalesce(p_message,'')))<1 then
    raise exception 'Message cannot be empty';
  end if;

  select t.user_id into v_owner
  from public.support_tickets t
  where t.id=p_ticket_id;

  if v_owner is null then
    raise exception 'Ticket not found';
  end if;

  v_role:=public.staff_current_role();

  if v_owner<>auth.uid() and v_role not in ('owner','staff') then
    raise exception 'Not allowed';
  end if;

  insert into public.support_ticket_messages(
    ticket_id,sender_user_id,sender_role,message
  )
  values(
    p_ticket_id,
    auth.uid(),
    case when v_role in ('owner','staff') then v_role else 'member' end,
    left(trim(p_message),4000)
  )
  returning id into v_message_id;

  update public.support_tickets
  set
    status=case
      when v_role in ('owner','staff') then 'waiting_user'
      else 'waiting_staff'
    end,
    updated_at=now()
  where id=p_ticket_id;

  return v_message_id;
end;
$$;

grant execute on function public.submit_moderation_report(text,text,text,text,jsonb) to authenticated;
grant execute on function public.create_support_ticket(text,text) to authenticated;
grant execute on function public.add_support_ticket_message(uuid,text) to authenticated;


-- Safer scalar implementation of the account-state RPC.
create or replace function public.get_my_account_state()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user_id uuid:=auth.uid();
  v_username text;
  v_role text;
  v_banned boolean:=false;
  v_ban_alias text;
  v_ban_reason text;
  v_ban_expires_at timestamptz;
  v_muted boolean:=false;
  v_mute_reason text;
  v_mute_expires_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select p.username into v_username
  from public.profiles p
  where p.user_id=v_user_id
  limit 1;

  v_role:=public.staff_current_role();

  if v_user_id<>'f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    select
      true,
      b.alias,
      b.reason,
      b.expires_at
    into
      v_banned,
      v_ban_alias,
      v_ban_reason,
      v_ban_expires_at
    from public.chat_bans b
    where b.user_id=v_user_id
       or (
         b.user_id is null
         and lower(b.alias)=lower(coalesce(v_username,''))
       )
    order by b.created_at desc
    limit 1;

    if v_banned
       and v_ban_expires_at is not null
       and v_ban_expires_at<=now() then
      delete from public.chat_bans
      where user_id=v_user_id
         or alias=v_ban_alias;

      v_banned:=false;
      v_ban_reason:=null;
      v_ban_expires_at:=null;
    end if;
  end if;

  select
    true,
    m.reason,
    m.expires_at
  into
    v_muted,
    v_mute_reason,
    v_mute_expires_at
  from public.user_mutes m
  where m.user_id=v_user_id
  limit 1;

  if v_muted
     and v_mute_expires_at is not null
     and v_mute_expires_at<=now() then
    delete from public.user_mutes where user_id=v_user_id;
    v_muted:=false;
    v_mute_reason:=null;
    v_mute_expires_at:=null;
  end if;

  return jsonb_build_object(
    'user_id',v_user_id,
    'username',v_username,
    'role',v_role,
    'banned',coalesce(v_banned,false),
    'ban_reason',v_ban_reason,
    'ban_expires_at',v_ban_expires_at,
    'muted',coalesce(v_muted,false),
    'mute_reason',v_mute_reason,
    'mute_expires_at',v_mute_expires_at,
    'warning_count',(
      select count(*)
      from public.user_warnings w
      where w.user_id=v_user_id and w.active=true
    )
  );
end;
$$;

grant execute on function public.get_my_account_state() to authenticated;


-- Any successful profile username update (including a direct API update)
-- synchronizes the UUID-backed/legacy alias records automatically.
create or replace function public.sync_profile_username_identity()
returns trigger
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  if new.username is not distinct from old.username then
    return new;
  end if;

  update public.chat_moderators
  set alias=lower(new.username),user_id=new.user_id
  where user_id=new.user_id
     or (user_id is null and lower(alias)=lower(old.username));

  update public.chat_bans
  set alias=lower(new.username),user_id=new.user_id
  where user_id=new.user_id
     or (user_id is null and lower(alias)=lower(old.username));

  update public.user_mutes
  set username=lower(new.username)
  where user_id=new.user_id;

  update public.user_warnings
  set username=lower(new.username)
  where user_id=new.user_id;

  update public.staff_notes
  set username=lower(new.username)
  where user_id=new.user_id;

  update public.support_tickets
  set username=new.username,updated_at=now()
  where user_id=new.user_id;

  update public.chat_messages
  set alias=lower(new.username)
  where lower(alias)=lower(old.username)
    and created_at>now()-interval '24 hours';

  update auth.users
  set raw_user_meta_data=
    jsonb_set(
      jsonb_set(
        coalesce(raw_user_meta_data,'{}'::jsonb),
        '{username}',
        to_jsonb(new.username),
        true
      ),
      '{chat_alias}',
      to_jsonb(new.username),
      true
    )
  where id=new.user_id;

  return new;
end;
$$;

drop trigger if exists profiles_username_identity_sync on public.profiles;
create trigger profiles_username_identity_sync
after update of username on public.profiles
for each row execute function public.sync_profile_username_identity();


-- ============================================================
-- FINAL PUSH V7: LIVE OPS / REALTIME / COLLECTION CONTROLS
-- ============================================================

create or replace function public.get_staff_live_moderation()
returns jsonb
language plpgsql
security definer
stable
set search_path=public
as $$
begin
  if not public.staff_is_staff() then
    raise exception 'Staff access required';
  end if;

  return jsonb_build_object(
    'bans',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'alias',b.alias,
          'username',coalesce(p.username,b.alias),
          'user_id',b.user_id,
          'reason',b.reason,
          'expires_at',b.expires_at,
          'created_at',b.created_at
        )
        order by b.created_at desc
      )
      from public.chat_bans b
      left join public.profiles p on p.user_id=b.user_id
      where b.expires_at is null or b.expires_at>now()
    ),'[]'::jsonb),

    'mutes',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'username',m.username,
          'user_id',m.user_id,
          'reason',m.reason,
          'expires_at',m.expires_at,
          'created_at',m.created_at
        )
        order by m.created_at desc
      )
      from public.user_mutes m
      where m.expires_at is null or m.expires_at>now()
    ),'[]'::jsonb),

    'warnings',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',w.id,
          'username',w.username,
          'user_id',w.user_id,
          'reason',w.reason,
          'active',w.active,
          'created_at',w.created_at
        )
        order by w.created_at desc
      )
      from public.user_warnings w
      where w.active=true
    ),'[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_staff_live_moderation() to authenticated;

create or replace function public.staff_resolve_warning(p_warning_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_username text;
begin
  if not public.staff_has_permission('users_warn') then
    raise exception 'Missing permission: users_warn';
  end if;

  select w.username into v_username
  from public.user_warnings w
  where w.id=p_warning_id
  limit 1;

  if v_username is null then
    raise exception 'Warning not found';
  end if;

  if public.staff_target_role(v_username)='owner' then
    raise exception 'Owner warnings cannot be changed';
  end if;

  if public.staff_target_role(v_username)='staff'
     and public.staff_current_role()<>'owner' then
    raise exception 'Staff cannot resolve warnings for other Staff';
  end if;

  update public.user_warnings
  set active=false
  where id=p_warning_id;

  perform public.staff_write_audit(
    'warning_resolved',
    'warning',
    p_warning_id::text,
    jsonb_build_object('username',v_username)
  );
end;
$$;

grant execute on function public.staff_resolve_warning(uuid) to authenticated;

create or replace function public.staff_update_collection(
  p_collection_id uuid,
  p_name text,
  p_description text,
  p_active boolean,
  p_sort_order integer
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.staff_has_permission('collections_manage') then
    raise exception 'Missing permission: collections_manage';
  end if;

  if length(trim(coalesce(p_name,'')))<1 then
    raise exception 'Collection name is required';
  end if;

  update public.staff_collections
  set
    name=left(trim(p_name),100),
    description=nullif(left(trim(coalesce(p_description,'')),500),''),
    active=coalesce(p_active,true),
    sort_order=greatest(-9999,least(coalesce(p_sort_order,100),9999)),
    updated_at=now()
  where id=p_collection_id;

  if not found then
    raise exception 'Collection not found';
  end if;

  perform public.staff_write_audit(
    'collection_update',
    'collection',
    p_collection_id::text,
    jsonb_build_object(
      'name',p_name,
      'active',p_active,
      'sort_order',p_sort_order
    )
  );
end;
$$;

grant execute on function public.staff_update_collection(uuid,text,text,boolean,integer) to authenticated;

-- Final user snapshot includes UUID-backed moderation + username history.
create or replace function public.get_staff_user_snapshot(p_username text)
returns jsonb
language plpgsql
security definer
stable
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_role text;
  v_ban jsonb;
  v_mute jsonb;
  v_warnings jsonb;
  v_notes jsonb;
  v_history jsonb;
begin
  if not public.staff_is_staff() then
    raise exception 'Staff access required';
  end if;

  select * into v_profile
  from public.profiles
  where lower(username)=lower(trim(p_username))
  limit 1;

  if v_profile.user_id is null then
    return null;
  end if;

  v_role:=public.staff_target_role(v_profile.username);

  select to_jsonb(b) into v_ban
  from public.chat_bans b
  where b.user_id=v_profile.user_id
     or (
       b.user_id is null
       and lower(b.alias)=lower(v_profile.username)
     )
  order by b.created_at desc
  limit 1;

  select to_jsonb(m) into v_mute
  from public.user_mutes m
  where m.user_id=v_profile.user_id
    and (m.expires_at is null or m.expires_at>now())
  limit 1;

  select coalesce(jsonb_agg(to_jsonb(w) order by w.created_at desc),'[]'::jsonb)
  into v_warnings
  from public.user_warnings w
  where w.user_id=v_profile.user_id;

  select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc),'[]'::jsonb)
  into v_notes
  from public.staff_notes n
  where n.user_id=v_profile.user_id;

  select coalesce(jsonb_agg(h.username order by h.changed_at desc),'[]'::jsonb)
  into v_history
  from public.username_history h
  where h.user_id=v_profile.user_id;

  return jsonb_build_object(
    'profile',jsonb_build_object(
      'user_id',v_profile.user_id,
      'username',v_profile.username,
      'display_name',v_profile.display_name,
      'bio',v_profile.bio,
      'avatar_url',v_profile.avatar_url,
      'is_private',v_profile.is_private,
      'created_at',v_profile.created_at
    ),
    'role',v_role,
    'ban',v_ban,
    'mute',v_mute,
    'warnings',v_warnings,
    'notes',v_notes,
    'username_history',v_history
  );
end;
$$;

grant execute on function public.get_staff_user_snapshot(text) to authenticated;

-- ============================================================
-- REALTIME PUBLICATION
-- ============================================================

do $f2w$
declare
  v_table text;
begin
  foreach v_table in array array[
    'chat_messages',
    'account_events',
    'site_announcements',
    'site_settings',
    'stream_source_status',
    'staff_collections',
    'staff_collection_items',
    'content_blocks',
    'moderation_reports',
    'support_tickets',
    'support_ticket_messages',
    'staff_audit_log',
    'chat_bans',
    'user_mutes',
    'user_warnings',
    'profiles',
    'profile_follows',
    'user_favorites'
  ]
  loop
    begin
      execute format(
        'alter publication supabase_realtime add table public.%I',
        v_table
      );
    exception
      when duplicate_object then null;
      when undefined_object then
        raise notice 'Supabase realtime publication/table not available for %',v_table;
      when insufficient_privilege then
        raise notice 'No privilege to add % to realtime publication',v_table;
    end;
  end loop;
end
$f2w$;

-- ============================================================
-- OPTIONAL SELF-HEALING CRON
-- Tries to call rapid-worker every 10 minutes so its 24h cleanup
-- runs even when nobody manually opens chat.
-- If pg_cron/pg_net cannot be enabled, deployment continues safely.
-- ============================================================

do $f2w$
begin
  begin
    execute 'create extension if not exists pg_cron';
  exception when others then
    raise notice 'pg_cron unavailable: %',sqlerrm;
  end;

  begin
    execute 'create extension if not exists pg_net';
  exception when others then
    raise notice 'pg_net unavailable: %',sqlerrm;
  end;
end
$f2w$;

do $f2w$
declare
  v_job bigint;
begin
  if exists(select 1 from pg_extension where extname='pg_cron')
     and exists(select 1 from pg_extension where extname='pg_net') then

    begin
      select jobid into v_job
      from cron.job
      where jobname='flix2watch-chat-cleanup'
      limit 1;

      if v_job is not null then
        perform cron.unschedule(v_job);
      end if;
    exception when others then
      null;
    end;

    perform cron.schedule(
      'flix2watch-chat-cleanup',
      '*/10 * * * *',
      'select net.http_get(url := ''https://viqufxlcxwgboyxbdhjb.supabase.co/functions/v1/rapid-worker'');'
    );
  end if;
exception when others then
  raise notice 'Automatic chat cleanup cron could not be scheduled: %',sqlerrm;
end
$f2w$;

-- End Final Push V7.


-- Final Push V7 expanded Live Ops payload.
create or replace function public.get_staff_live_moderation()
returns jsonb
language plpgsql
security definer
stable
set search_path=public
as $$
begin
  if not public.staff_is_staff() then
    raise exception 'Staff access required';
  end if;

  return jsonb_build_object(
    'bans',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'alias',b.alias,
          'username',coalesce(p.username,b.alias),
          'user_id',b.user_id,
          'reason',b.reason,
          'expires_at',b.expires_at,
          'created_at',b.created_at
        )
        order by b.created_at desc
      )
      from public.chat_bans b
      left join public.profiles p on p.user_id=b.user_id
      where b.expires_at is null or b.expires_at>now()
    ),'[]'::jsonb),

    'mutes',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'username',m.username,
          'user_id',m.user_id,
          'reason',m.reason,
          'expires_at',m.expires_at,
          'created_at',m.created_at
        )
        order by m.created_at desc
      )
      from public.user_mutes m
      where m.expires_at is null or m.expires_at>now()
    ),'[]'::jsonb),

    'warnings',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',w.id,
          'username',w.username,
          'user_id',w.user_id,
          'reason',w.reason,
          'active',w.active,
          'created_at',w.created_at
        )
        order by w.created_at desc
      )
      from public.user_warnings w
      where w.active=true
    ),'[]'::jsonb),

    'staff',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'alias',m.alias,
          'username',coalesce(p.username,m.alias),
          'user_id',m.user_id
        )
        order by coalesce(p.username,m.alias)
      )
      from public.chat_moderators m
      left join public.profiles p on p.user_id=m.user_id
    ),'[]'::jsonb),

    'recent_usernames',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'username',h.username,
          'current_username',p.username,
          'user_id',h.user_id,
          'changed_at',h.changed_at
        )
        order by h.changed_at desc
      )
      from (
        select *
        from public.username_history
        order by changed_at desc
        limit 30
      ) h
      left join public.profiles p on p.user_id=h.user_id
    ),'[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_staff_live_moderation() to authenticated;


create or replace function public.get_staff_announcement_history()
returns jsonb
language plpgsql
security definer
stable
set search_path=public
as $$
begin
  if not public.staff_has_permission('announcements_manage')
     and not public.staff_has_permission('audit_view') then
    raise exception 'Staff access required';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id',a.id,
        'message',a.message,
        'active',a.active,
        'created_at',a.created_at,
        'starts_at',a.starts_at,
        'expires_at',a.expires_at,
        'created_by_alias',a.created_by_alias
      )
      order by a.created_at desc
    )
    from (
      select *
      from public.site_announcements
      order by created_at desc
      limit 20
    ) a
  ),'[]'::jsonb);
end;
$$;

grant execute on function public.get_staff_announcement_history() to authenticated;



-- ============================================================
-- FLIX2WATCH V14 — GOOGLE / DISCORD OAUTH PROFILE BOOTSTRAP
-- Run this ONCE in Supabase SQL Editor after the existing
-- Flix2Watch Staff/Profile setup.
-- ============================================================

create or replace function public.ensure_my_oauth_profile(
  p_username_base text,
  p_display_name text default null,
  p_avatar_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_user_id uuid:=auth.uid();
  v_existing public.profiles%rowtype;
  v_base text;
  v_candidate text;
  v_suffix text;
  v_attempt integer:=0;
  v_history_owner uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_existing
  from public.profiles
  where user_id=v_user_id
  limit 1;

  if v_existing.user_id is not null then
    update auth.users
    set raw_user_meta_data=
      jsonb_set(
        jsonb_set(
          coalesce(raw_user_meta_data,'{}'::jsonb),
          '{username}',
          to_jsonb(v_existing.username),
          true
        ),
        '{chat_alias}',
        to_jsonb(v_existing.username),
        true
      )
    where id=v_user_id;

    return jsonb_build_object(
      'user_id',v_existing.user_id,
      'username',v_existing.username,
      'display_name',v_existing.display_name,
      'created',false
    );
  end if;

  v_base:=regexp_replace(
    coalesce(nullif(trim(p_username_base),''),'User'),
    '[^A-Za-z0-9]',
    '',
    'g'
  );

  if length(v_base)<2 then
    v_base:='User';
  end if;

  v_base:=left(v_base,24);

  if lower(v_base)='josh'
     and v_user_id<>'f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    v_base:='UserJosh';
  end if;

  v_suffix:=right(
    regexp_replace(v_user_id::text,'[^A-Za-z0-9]','','g'),
    5
  );

  loop
    if v_attempt=0 then
      v_candidate:=v_base;
    elsif v_attempt=1 then
      v_candidate:=left(v_base,25)||v_suffix;
    else
      v_candidate:=
        left(v_base,greatest(2,30-length(v_suffix)-length(v_attempt::text)))
        ||v_suffix
        ||v_attempt::text;
    end if;

    v_candidate:=left(v_candidate,30);

    if lower(v_candidate)='josh'
       and v_user_id<>'f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
      v_candidate:='User'||v_suffix||v_attempt::text;
    end if;

    if not exists(
      select 1
      from public.profiles p
      where lower(p.username)=lower(v_candidate)
        and p.user_id<>v_user_id
    ) then
      v_history_owner:=null;

      if to_regclass('public.username_history') is not null then
        execute
          'select user_id from public.username_history where lower(username)=lower($1) limit 1'
        into v_history_owner
        using v_candidate;
      end if;

      if v_history_owner is null or v_history_owner=v_user_id then
        begin
          insert into public.profiles(
            user_id,
            username,
            display_name,
            avatar_url
          )
          values(
            v_user_id,
            v_candidate,
            coalesce(
              nullif(left(trim(coalesce(p_display_name,'')),50),''),
              v_candidate
            ),
            nullif(left(trim(coalesce(p_avatar_url,'')),2048),'')
          );

          update auth.users
          set raw_user_meta_data=
            jsonb_set(
              jsonb_set(
                coalesce(raw_user_meta_data,'{}'::jsonb),
                '{username}',
                to_jsonb(v_candidate),
                true
              ),
              '{chat_alias}',
              to_jsonb(v_candidate),
              true
            )
          where id=v_user_id;

          return jsonb_build_object(
            'user_id',v_user_id,
            'username',v_candidate,
            'display_name',coalesce(
              nullif(left(trim(coalesce(p_display_name,'')),50),''),
              v_candidate
            ),
            'created',true
          );
        exception
          when unique_violation then
            null;
        end;
      end if;
    end if;

    v_attempt:=v_attempt+1;

    if v_attempt>50 then
      raise exception 'Could not create a unique Flix2Watch username';
    end if;
  end loop;
end;
$$;

revoke all on function public.ensure_my_oauth_profile(text,text,text)
from public,anon;

grant execute on function public.ensure_my_oauth_profile(text,text,text)
to authenticated;

-- This RPC does not grant Staff/Owner permissions.
-- OAuth users remain normal members unless the Owner explicitly grants Staff.



-- ============================================================
-- FLIX2WATCH V16 — STAFF PROFILE MANAGEMENT + PUBLIC ROLES
-- Run ONCE after the existing V14/V15 backend setup.
-- ============================================================

create table if not exists public.profile_role_assignments (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  role_key text not null,
  assigned_by uuid,
  created_at timestamptz not null default now(),
  primary key(user_id,role_key),
  constraint profile_role_assignments_role_key_check
    check(role_key in (
      'admin',
      'moderator',
      'curator',
      'support',
      'developer',
      'verified',
      'contributor'
    ))
);

alter table public.profile_role_assignments enable row level security;

drop policy if exists "Public role assignments are readable" on public.profile_role_assignments;
create policy "Public role assignments are readable"
on public.profile_role_assignments
for select
to anon,authenticated
using(true);

revoke insert,update,delete on public.profile_role_assignments from anon,authenticated;

-- Extend default Staff permissions with profile management.
create or replace function public.staff_has_permission(p_permission text)
returns boolean
language plpgsql
security definer
stable
set search_path=public
as $$
declare
  v_role text;
  v_override boolean;
begin
  v_role := public.staff_current_role();

  if v_role='owner' then
    return true;
  end if;

  if v_role<>'staff' then
    return false;
  end if;

  select spo.allowed into v_override
  from public.staff_permission_overrides spo
  where spo.user_id=auth.uid()
    and spo.permission=p_permission;

  if found then
    return v_override;
  end if;

  return p_permission = any(array[
    'chat_moderate',
    'users_ban',
    'users_mute',
    'users_warn',
    'users_notes',
    'reports_manage',
    'announcements_manage',
    'homepage_manage',
    'streams_manage',
    'collections_manage',
    'support_manage',
    'site_settings_manage',
    'audit_view',
    'profiles_manage',
    'profile_roles_manage'
  ]);
end;
$$;

create or replace function public.get_staff_context()
returns jsonb
language plpgsql
security definer
stable
set search_path=public
as $$
declare
  v_role text;
  v_username text;
  v_permissions jsonb;
begin
  v_role:=public.staff_current_role();
  v_username:=public.staff_current_username();

  if v_role not in ('owner','staff') then
    return jsonb_build_object(
      'role','member',
      'username',v_username,
      'permissions','[]'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(permission),'[]'::jsonb)
  into v_permissions
  from (
    select permission
    from (values
      ('chat_moderate'),
      ('users_ban'),
      ('users_mute'),
      ('users_warn'),
      ('users_notes'),
      ('reports_manage'),
      ('announcements_manage'),
      ('homepage_manage'),
      ('streams_manage'),
      ('collections_manage'),
      ('support_manage'),
      ('site_settings_manage'),
      ('audit_view'),
      ('staff_manage'),
      ('profiles_manage'),
      ('profile_roles_manage')
    ) p(permission)
    where public.staff_has_permission(permission)
  ) x;

  return jsonb_build_object(
    'role',v_role,
    'username',v_username,
    'permissions',v_permissions
  );
end;
$$;

-- Public role badges are display roles only. They never grant Staff access.
create or replace function public.get_public_profile_badges(target_username text)
returns jsonb
language plpgsql
security definer
stable
set search_path=public
as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id
  from public.profiles
  where lower(username)=lower(trim(target_username))
  limit 1;

  if v_user_id is null then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'role_key',pra.role_key,
          'created_at',pra.created_at
        )
        order by
          case pra.role_key
            when 'admin' then 1
            when 'moderator' then 2
            when 'curator' then 3
            when 'support' then 4
            when 'developer' then 5
            when 'verified' then 6
            when 'contributor' then 7
            else 99
          end
      )
      from public.profile_role_assignments pra
      where pra.user_id=v_user_id
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.staff_get_profile_roles(p_user_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path=public
as $$
begin
  if not public.staff_has_permission('profile_roles_manage') then
    raise exception 'Profile role permission required';
  end if;

  return coalesce(
    (
      select jsonb_agg(role_key order by role_key)
      from public.profile_role_assignments
      where user_id=p_user_id
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.staff_set_profile_role(
  p_user_id uuid,
  p_role_key text,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text:=lower(trim(coalesce(p_role_key,'')));
  v_username text;
begin
  if not public.staff_has_permission('profile_roles_manage') then
    raise exception 'Profile role permission required';
  end if;

  if v_role not in (
    'admin','moderator','curator','support',
    'developer','verified','contributor'
  ) then
    raise exception 'Unknown profile role';
  end if;

  select username into v_username
  from public.profiles
  where user_id=p_user_id;

  if v_username is null then
    raise exception 'Profile not found';
  end if;

  if p_user_id='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid
     and public.staff_current_role()<>'owner' then
    raise exception 'Only Owner can change Owner profile roles';
  end if;

  if p_enabled then
    insert into public.profile_role_assignments(user_id,role_key,assigned_by)
    values(p_user_id,v_role,auth.uid())
    on conflict(user_id,role_key) do nothing;
  else
    delete from public.profile_role_assignments
    where user_id=p_user_id
      and role_key=v_role;
  end if;

  perform public.staff_write_audit(
    case when p_enabled then 'profile_role_added' else 'profile_role_removed' end,
    'user',
    p_user_id::text,
    jsonb_build_object(
      'username',v_username,
      'role_key',v_role
    )
  );

  return public.staff_get_profile_roles(p_user_id);
end;
$$;

create or replace function public.staff_edit_user_profile(
  p_user_id uuid,
  p_username text,
  p_display_name text default null,
  p_bio text default null,
  p_avatar_url text default null,
  p_is_private boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_profile public.profiles%rowtype;
  v_username text:=trim(coalesce(p_username,''));
  v_display_name text:=nullif(left(trim(coalesce(p_display_name,'')),50),'');
  v_bio text:=left(coalesce(p_bio,''),500);
  v_avatar_url text:=nullif(left(trim(coalesce(p_avatar_url,'')),2048),'');
begin
  if not public.staff_has_permission('profiles_manage') then
    raise exception 'Profile management permission required';
  end if;

  select * into v_profile
  from public.profiles
  where user_id=p_user_id
  for update;

  if v_profile.user_id is null then
    raise exception 'Profile not found';
  end if;

  if p_user_id='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    if public.staff_current_role()<>'owner' then
      raise exception 'Only Owner can edit the Owner profile';
    end if;

    if lower(v_username)<>'josh' then
      raise exception 'Owner username must remain josh';
    end if;
  end if;

  if v_username !~ '^[A-Za-z0-9]{2,30}$' then
    raise exception 'Username must use 2-30 English letters or numbers only';
  end if;

  if v_avatar_url is not null
     and v_avatar_url !~* '^https://'
     and v_avatar_url !~* '^data:image/' then
    raise exception 'Avatar URL must use HTTPS';
  end if;

  update public.profiles
  set
    username=v_username,
    display_name=v_display_name,
    bio=v_bio,
    avatar_url=v_avatar_url,
    is_private=coalesce(p_is_private,is_private),
    updated_at=now()
  where user_id=p_user_id
  returning * into v_profile;

  perform public.staff_write_audit(
    'profile_edited',
    'user',
    p_user_id::text,
    jsonb_build_object(
      'username',v_profile.username,
      'display_name',v_profile.display_name,
      'is_private',v_profile.is_private,
      'avatar_changed',p_avatar_url is distinct from null
    )
  );

  return jsonb_build_object(
    'user_id',v_profile.user_id,
    'username',v_profile.username,
    'display_name',v_profile.display_name,
    'bio',v_profile.bio,
    'avatar_url',v_profile.avatar_url,
    'is_private',v_profile.is_private,
    'created_at',v_profile.created_at,
    'updated_at',v_profile.updated_at
  );
end;
$$;

-- Staff may upload/replace profile avatars for users when they have profile
-- management permission. Public reads remain handled by the existing bucket.
drop policy if exists "Staff manage profile avatars" on storage.objects;
create policy "Staff manage profile avatars"
on storage.objects
for all
to authenticated
using(
  bucket_id='profile-avatars'
  and public.staff_has_permission('profiles_manage')
)
with check(
  bucket_id='profile-avatars'
  and public.staff_has_permission('profiles_manage')
);

grant select on public.profile_role_assignments to anon,authenticated;
grant execute on function public.get_public_profile_badges(text) to anon,authenticated;
grant execute on function public.staff_get_profile_roles(uuid) to authenticated;
grant execute on function public.staff_set_profile_role(uuid,text,boolean) to authenticated;
grant execute on function public.staff_edit_user_profile(uuid,text,text,text,text,boolean) to authenticated;

-- Add V16 tables to realtime publication when publication exists.
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.profile_role_assignments;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;



-- ============================================================
-- FLIX2WATCH V17 — NOTIFICATIONS + PRIVATE DIRECT MESSAGES
-- Run ONCE after the V16/V14 backend setup.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  notification_type text not null check (
    notification_type in (
      'follow',
      'warning',
      'ban',
      'unban',
      'mute',
      'unmute',
      'staff_granted',
      'staff_revoked',
      'dm',
      'system'
    )
  ),
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_created_idx
on public.user_notifications(user_id,created_at desc);

create index if not exists user_notifications_unread_idx
on public.user_notifications(user_id,read_at,created_at desc);

alter table public.user_notifications enable row level security;

drop policy if exists "Users read own notifications" on public.user_notifications;
create policy "Users read own notifications"
on public.user_notifications
for select
to authenticated
using(auth.uid()=user_id);

drop policy if exists "Users update own notifications" on public.user_notifications;
create policy "Users update own notifications"
on public.user_notifications
for update
to authenticated
using(auth.uid()=user_id)
with check(auth.uid()=user_id);

drop policy if exists "Users delete own notifications" on public.user_notifications;
create policy "Users delete own notifications"
on public.user_notifications
for delete
to authenticated
using(auth.uid()=user_id);

revoke insert,update,delete on public.user_notifications from anon,authenticated;
grant select on public.user_notifications to authenticated;

create or replace function public.notify_profile_follow()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_username text;
begin
  if new.followed_user_id=new.follower_user_id then
    return new;
  end if;

  select username into v_username
  from public.profiles
  where user_id=new.follower_user_id
  limit 1;

  insert into public.user_notifications(
    user_id,
    actor_user_id,
    notification_type,
    title,
    body,
    link
  )
  values(
    new.followed_user_id,
    new.follower_user_id,
    'follow',
    'New follower',
    coalesce('@'||v_username,'Someone')||' followed you.',
    case
      when v_username is null then '/profile/'
      else '/profile/?user='||v_username
    end
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_profile_follow on public.profile_follows;
create trigger trg_notify_profile_follow
after insert on public.profile_follows
for each row execute function public.notify_profile_follow();

create or replace function public.notify_account_event()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.user_notifications(
    user_id,
    actor_user_id,
    notification_type,
    title,
    body,
    link
  )
  values(
    new.user_id,
    new.created_by,
    case
      when new.event_type in (
        'warning','ban','unban','mute','unmute',
        'staff_granted','staff_revoked'
      ) then new.event_type
      else 'system'
    end,
    new.title,
    new.message,
    '/home/'
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_account_event on public.account_events;
create trigger trg_notify_account_event
after insert on public.account_events
for each row execute function public.notify_account_event();

create or replace function public.get_my_notifications(p_limit integer default 40)
returns jsonb
language sql
security definer
stable
set search_path=public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',n.id,
        'notification_type',n.notification_type,
        'title',n.title,
        'body',n.body,
        'link',n.link,
        'read_at',n.read_at,
        'created_at',n.created_at,
        'actor_user_id',n.actor_user_id,
        'actor_username',p.username,
        'actor_display_name',p.display_name,
        'actor_avatar_url',p.avatar_url
      )
      order by n.created_at desc
    ),
    '[]'::jsonb
  )
  from (
    select *
    from public.user_notifications
    where user_id=auth.uid()
    order by created_at desc
    limit greatest(1,least(coalesce(p_limit,40),100))
  ) n
  left join public.profiles p
    on p.user_id=n.actor_user_id
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.user_notifications
  set read_at=coalesce(read_at,now())
  where id=p_notification_id
    and user_id=auth.uid();

  return found;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_count integer;
begin
  update public.user_notifications
  set read_at=now()
  where user_id=auth.uid()
    and read_at is null;

  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

grant execute on function public.get_my_notifications(integer) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- ============================================================
-- PRIVATE DIRECT MESSAGES
--
-- The site UI exposes DMs only to conversation participants.
-- Message bodies are encrypted at rest with AES-256 via pgcrypto.
-- The conversation encryption key is never granted to browser clients.
--
-- This is NOT end-to-end encryption: privileged database operators/service
-- infrastructure can technically access/decrypt server-side data.
-- ============================================================

create table if not exists public.dm_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  encryption_secret uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dm_conversations_different_users check(user_a<>user_b),
  constraint dm_conversations_unique_pair unique(user_a,user_b)
);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body_encrypted bytea not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint dm_messages_different_users check(sender_id<>recipient_id)
);

create index if not exists dm_messages_conversation_created_idx
on public.dm_messages(conversation_id,created_at asc);

create index if not exists dm_messages_recipient_unread_idx
on public.dm_messages(recipient_id,read_at,created_at desc);

alter table public.dm_conversations enable row level security;
alter table public.dm_messages enable row level security;

-- No direct browser SELECT/INSERT/UPDATE/DELETE access is granted to encrypted
-- DM rows. All reads/writes go through participant-checking RPCs below.
revoke all on public.dm_conversations from anon,authenticated;
revoke all on public.dm_messages from anon,authenticated;

create or replace function public.dm_normalized_pair(
  p_one uuid,
  p_two uuid,
  out user_a uuid,
  out user_b uuid
)
language sql
immutable
as $$
  select
    case when p_one::text<p_two::text then p_one else p_two end,
    case when p_one::text<p_two::text then p_two else p_one end
$$;

create or replace function public.dm_get_or_create_conversation(p_target_username text)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_me uuid:=auth.uid();
  v_target public.profiles%rowtype;
  v_a uuid;
  v_b uuid;
  v_conversation public.dm_conversations%rowtype;
begin
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  if public.account_is_banned(v_me) then
    raise exception 'This account cannot use direct messages';
  end if;

  select * into v_target
  from public.profiles
  where lower(username)=lower(trim(p_target_username))
  limit 1;

  if v_target.user_id is null then
    raise exception 'User not found';
  end if;

  if v_target.user_id=v_me then
    raise exception 'You cannot message yourself';
  end if;

  select user_a,user_b into v_a,v_b
  from public.dm_normalized_pair(v_me,v_target.user_id);

  insert into public.dm_conversations(user_a,user_b)
  values(v_a,v_b)
  on conflict(user_a,user_b)
  do update set updated_at=public.dm_conversations.updated_at
  returning * into v_conversation;

  return jsonb_build_object(
    'conversation_id',v_conversation.id,
    'username',v_target.username,
    'display_name',v_target.display_name,
    'avatar_url',v_target.avatar_url,
    'user_id',v_target.user_id
  );
end;
$$;

create or replace function public.dm_send_message(
  p_target_username text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_me uuid:=auth.uid();
  v_target public.profiles%rowtype;
  v_sender public.profiles%rowtype;
  v_a uuid;
  v_b uuid;
  v_conversation public.dm_conversations%rowtype;
  v_message public.dm_messages%rowtype;
  v_body text:=trim(coalesce(p_body,''));
begin
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  if public.account_is_banned(v_me) then
    raise exception 'This account cannot use direct messages';
  end if;

  if length(v_body)<1 or length(v_body)>2000 then
    raise exception 'Private messages must be 1–2000 characters';
  end if;

  select * into v_target
  from public.profiles
  where lower(username)=lower(trim(p_target_username))
  limit 1;

  if v_target.user_id is null then
    raise exception 'User not found';
  end if;

  if v_target.user_id=v_me then
    raise exception 'You cannot message yourself';
  end if;

  select * into v_sender
  from public.profiles
  where user_id=v_me
  limit 1;

  select user_a,user_b into v_a,v_b
  from public.dm_normalized_pair(v_me,v_target.user_id);

  insert into public.dm_conversations(user_a,user_b)
  values(v_a,v_b)
  on conflict(user_a,user_b)
  do update set updated_at=now()
  returning * into v_conversation;

  insert into public.dm_messages(
    conversation_id,
    sender_id,
    recipient_id,
    body_encrypted
  )
  values(
    v_conversation.id,
    v_me,
    v_target.user_id,
    extensions.pgp_sym_encrypt(
      v_body,
      v_conversation.encryption_secret::text,
      'cipher-algo=aes256,compress-algo=1'
    )
  )
  returning * into v_message;

  update public.dm_conversations
  set updated_at=v_message.created_at
  where id=v_conversation.id;

  insert into public.user_notifications(
    user_id,
    actor_user_id,
    notification_type,
    title,
    body,
    link
  )
  values(
    v_target.user_id,
    v_me,
    'dm',
    'New private message',
    coalesce('@'||v_sender.username,'Someone')||' sent you a private message.',
    'dm:'||coalesce(v_sender.username,'')
  );

  return jsonb_build_object(
    'id',v_message.id,
    'conversation_id',v_conversation.id,
    'sender_id',v_message.sender_id,
    'recipient_id',v_message.recipient_id,
    'body',v_body,
    'created_at',v_message.created_at,
    'read_at',v_message.read_at
  );
end;
$$;

create or replace function public.dm_list_conversations()
returns jsonb
language plpgsql
security definer
stable
set search_path=public,extensions
as $$
declare
  v_me uuid:=auth.uid();
begin
  if v_me is null then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(row_data order by (row_data->>'updated_at')::timestamptz desc)
      from (
        select jsonb_build_object(
          'conversation_id',c.id,
          'updated_at',c.updated_at,
          'other_user_id',other_profile.user_id,
          'username',other_profile.username,
          'display_name',other_profile.display_name,
          'avatar_url',other_profile.avatar_url,
          'last_message',
            case
              when last_message.id is null then ''
              else extensions.pgp_sym_decrypt(
                last_message.body_encrypted,
                c.encryption_secret::text
              )
            end,
          'last_message_at',last_message.created_at,
          'last_sender_id',last_message.sender_id,
          'unread_count',(
            select count(*)
            from public.dm_messages unread
            where unread.conversation_id=c.id
              and unread.recipient_id=v_me
              and unread.read_at is null
          )
        ) row_data
        from public.dm_conversations c
        join public.profiles other_profile
          on other_profile.user_id=
            case when c.user_a=v_me then c.user_b else c.user_a end
        left join lateral (
          select m.*
          from public.dm_messages m
          where m.conversation_id=c.id
          order by m.created_at desc
          limit 1
        ) last_message on true
        where c.user_a=v_me or c.user_b=v_me
      ) x
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.dm_get_messages(
  p_conversation_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_me uuid:=auth.uid();
  v_conversation public.dm_conversations%rowtype;
begin
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  select * into v_conversation
  from public.dm_conversations
  where id=p_conversation_id
    and (user_a=v_me or user_b=v_me);

  if v_conversation.id is null then
    raise exception 'Conversation not found';
  end if;

  update public.dm_messages
  set read_at=coalesce(read_at,now())
  where conversation_id=p_conversation_id
    and recipient_id=v_me
    and read_at is null;

  update public.user_notifications
  set read_at=coalesce(read_at,now())
  where user_id=v_me
    and notification_type='dm'
    and actor_user_id=case
      when v_conversation.user_a=v_me then v_conversation.user_b
      else v_conversation.user_a
    end
    and read_at is null;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id',m.id,
          'sender_id',m.sender_id,
          'recipient_id',m.recipient_id,
          'body',extensions.pgp_sym_decrypt(
            m.body_encrypted,
            v_conversation.encryption_secret::text
          ),
          'created_at',m.created_at,
          'read_at',m.read_at,
          'mine',m.sender_id=v_me
        )
        order by m.created_at asc
      )
      from (
        select *
        from public.dm_messages
        where conversation_id=p_conversation_id
        order by created_at desc
        limit greatest(1,least(coalesce(p_limit,100),250))
      ) m
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.dm_delete_message(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
begin
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  delete from public.dm_messages
  where id=p_message_id
    and sender_id=v_me;

  return found;
end;
$$;

grant execute on function public.dm_get_or_create_conversation(text) to authenticated;
grant execute on function public.dm_send_message(text,text) to authenticated;
grant execute on function public.dm_list_conversations() to authenticated;
grant execute on function public.dm_get_messages(uuid,integer) to authenticated;
grant execute on function public.dm_delete_message(uuid) to authenticated;

-- ============================================================
-- REALTIME
-- ============================================================

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.user_notifications;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
