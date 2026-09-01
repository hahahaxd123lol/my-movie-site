-- Flix2Watch v122 — server-authoritative Staff page access
-- Run this in Supabase SQL Editor before deploying the v122 Staff page.

create or replace function public.get_staff_page_access_v122()
returns jsonb
language plpgsql
security definer
set search_path=public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_username text := '';
  v_role text := 'member';
  v_permissions jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    return jsonb_build_object(
      'allowed',false,
      'role','member',
      'username','',
      'permissions','[]'::jsonb
    );
  end if;

  select coalesce(p.username,'')
    into v_username
  from public.profiles p
  where p.user_id=v_uid
  limit 1;

  if v_uid='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    v_role:='owner';
    v_permissions:='["*"]'::jsonb;

  elsif exists(
    select 1 from public.chat_moderators m where m.user_id=v_uid
  ) then
    v_role:='staff';
    v_permissions:='["*"]'::jsonb;

  elsif exists(
    select 1 from public.profile_role_assignments r
    where r.user_id=v_uid and lower(r.role_key)='moderator'
  ) then
    v_role:='moderator';
    v_permissions:='["chat_moderate","users_mute","users_warn","users_notes","reports_manage","audit_view"]'::jsonb;

  elsif exists(
    select 1 from public.profile_role_assignments r
    where r.user_id=v_uid and lower(r.role_key)='support'
  ) then
    v_role:='support';
    v_permissions:='["support_manage","users_notes"]'::jsonb;

  elsif exists(
    select 1 from public.profile_role_assignments r
    where r.user_id=v_uid and lower(r.role_key)='developer'
  ) then
    v_role:='developer';
    v_permissions:='["audit_view"]'::jsonb;
  end if;

  return jsonb_build_object(
    'allowed',v_role in ('owner','staff','moderator','support','developer'),
    'role',v_role,
    'username',v_username,
    'permissions',v_permissions
  );
end
$$;

revoke all on function public.get_staff_page_access_v122() from public;
grant execute on function public.get_staff_page_access_v122() to authenticated;

create or replace function public.f2w_require_staff_role_v122(
  p_allowed_roles text[] default array['owner','staff']
)
returns text
language plpgsql
security definer
set search_path=public
stable
as $$
declare
  v_access jsonb;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  v_access := public.get_staff_page_access_v122();
  v_role := coalesce(v_access->>'role','member');

  if not coalesce((v_access->>'allowed')::boolean,false) then
    raise exception 'Staff access required';
  end if;

  if not (v_role = any(p_allowed_roles)) then
    raise exception 'Insufficient Staff role';
  end if;

  return v_role;
end
$$;

revoke all on function public.f2w_require_staff_role_v122(text[]) from public;
grant execute on function public.f2w_require_staff_role_v122(text[]) to authenticated;

-- IMPORTANT:
-- Every SECURITY DEFINER Staff write RPC should call f2w_require_staff_role_v122()
-- (or perform an equivalent auth.uid()-based check) before modifying data.
-- Client-side hidden buttons are NOT a security boundary.

-- f2w-force-save:staff-access-security-v122:1788298462
 