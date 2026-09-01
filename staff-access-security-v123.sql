-- Flix2Watch v123 — optional server-side Staff page gate
-- Run in Supabase SQL Editor for the extra page authorization check.

create or replace function public.get_staff_page_access_v123()
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
    return jsonb_build_object('allowed',false,'role','member','username','','permissions','[]'::jsonb);
  end if;

  select coalesce(p.username,'')
    into v_username
  from public.profiles p
  where p.user_id=v_uid
  limit 1;

  if v_uid='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    v_role:='owner';
    v_permissions:='["*"]'::jsonb;
  elsif exists(select 1 from public.chat_moderators m where m.user_id=v_uid) then
    v_role:='staff';
    v_permissions:='["*"]'::jsonb;
  elsif exists(select 1 from public.profile_role_assignments r where r.user_id=v_uid and lower(r.role_key)='moderator') then
    v_role:='moderator';
    v_permissions:='["chat_moderate","users_mute","users_warn","users_notes","reports_manage","audit_view"]'::jsonb;
  elsif exists(select 1 from public.profile_role_assignments r where r.user_id=v_uid and lower(r.role_key)='support') then
    v_role:='support';
    v_permissions:='["support_manage","users_notes"]'::jsonb;
  elsif exists(select 1 from public.profile_role_assignments r where r.user_id=v_uid and lower(r.role_key)='developer') then
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

revoke all on function public.get_staff_page_access_v123() from public;
grant execute on function public.get_staff_page_access_v123() to authenticated;

-- This page gate is not the sole security boundary.
-- Every sensitive Staff RPC must still validate auth.uid()/role server-side.

-- f2w-force-save:staff-access-security-v123:1788298849
 