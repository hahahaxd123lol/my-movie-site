-- Flix2Watch v158 — emergency recovery for Staff roles + live moderation + stream priority
-- Safe to re-run.

create table if not exists public.staff_permission_overrides (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null,
  allowed boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, permission)
);

alter table public.staff_permission_overrides enable row level security;
drop policy if exists "staff permission own/read" on public.staff_permission_overrides;
create policy "staff permission own/read" on public.staff_permission_overrides
for select using (auth.uid()=user_id or auth.uid()='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid);
grant select on public.staff_permission_overrides to authenticated;

create or replace function public.owner_set_staff_v158(p_username text,p_enabled boolean)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_uid uuid;
  v_username text;
begin
  if auth.uid() is distinct from 'f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    raise exception 'Owner permission required';
  end if;

  select p.user_id,p.username into v_uid,v_username
  from public.profiles p
  where lower(p.username)=lower(trim(coalesce(p_username,'')))
  limit 1;

  if v_uid is null then raise exception 'User not found'; end if;
  if v_uid=auth.uid() then raise exception 'Owner role cannot be changed'; end if;

  if coalesce(p_enabled,false) then
    delete from public.chat_moderators where user_id=v_uid or lower(coalesce(alias,''))=lower(v_username);
    insert into public.chat_moderators(alias,user_id) values(lower(v_username),v_uid);
  else
    delete from public.chat_moderators where user_id=v_uid or lower(coalesce(alias,''))=lower(v_username);
    delete from public.staff_permission_overrides where user_id=v_uid;
  end if;

  return jsonb_build_object('ok',true,'user_id',v_uid,'username',v_username,'staff',coalesce(p_enabled,false));
end $$;

grant execute on function public.owner_set_staff_v158(text,boolean) to authenticated;

create or replace function public.owner_set_staff_permission_v158(p_username text,p_permission text,p_allowed boolean)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare v_uid uuid; v_perm text:=lower(trim(coalesce(p_permission,'')));
begin
  if auth.uid() is distinct from 'f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    raise exception 'Owner permission required';
  end if;
  select user_id into v_uid from public.profiles where lower(username)=lower(trim(coalesce(p_username,''))) limit 1;
  if v_uid is null then raise exception 'User not found'; end if;
  if v_perm='' then raise exception 'Permission required'; end if;
  insert into public.staff_permission_overrides(user_id,permission,allowed,updated_at)
  values(v_uid,v_perm,coalesce(p_allowed,false),now())
  on conflict(user_id,permission) do update set allowed=excluded.allowed,updated_at=now();
  return jsonb_build_object('ok',true,'user_id',v_uid,'permission',v_perm,'allowed',coalesce(p_allowed,false));
end $$;

grant execute on function public.owner_set_staff_permission_v158(text,text,boolean) to authenticated;

-- Keep the primary provider enabled and first.
do $$
begin
  if to_regclass('public.stream_source_status_v146') is not null then
    update public.stream_source_status_v146 set enabled=true,priority=1,updated_at=now() where source_name='flix2watchapi';
    update public.stream_source_status_v146 set priority=greatest(priority,2),updated_at=now() where source_name<>'flix2watchapi' and priority<=1;
  end if;
end $$;

-- Ensure realtime publication contains the live enforcement table.
do $$
begin
  if to_regclass('public.account_enforcement_v146') is not null then
    begin alter publication supabase_realtime add table public.account_enforcement_v146; exception when duplicate_object then null; end;
  end if;
end $$;
