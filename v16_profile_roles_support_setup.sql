
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
