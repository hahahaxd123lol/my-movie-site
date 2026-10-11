-- Flix2Watch v121 — Realtime Account Enforcement helpers
-- Run in Supabase SQL editor.

create table if not exists public.public_chat_bans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

alter table public.public_chat_bans enable row level security;

-- No direct client table writes. Staff uses SECURITY DEFINER RPCs.
revoke all on table public.public_chat_bans from anon, authenticated;

create or replace function public.f2w_v121_can_moderate()
returns boolean
language sql
security definer
set search_path=public
stable
as $$
  select
    auth.uid() = 'f5454804-a2a6-4602-9086-51cf51f11c77'::uuid
    or exists (
      select 1
      from public.chat_moderators m
      where m.user_id = auth.uid()
    )
$$;

create or replace function public.staff_set_public_chat_ban(
  p_user_id uuid,
  p_enabled boolean,
  p_minutes integer default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_expires timestamptz;
begin
  if not public.f2w_v121_can_moderate() then
    raise exception 'Staff permission required';
  end if;

  if p_user_id = 'f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    raise exception 'Owner cannot be restricted';
  end if;

  if coalesce(p_enabled,false) then
    v_expires :=
      case
        when coalesce(p_minutes,0) > 0
          then now() + make_interval(mins => p_minutes)
        else null
      end;

    insert into public.public_chat_bans(
      user_id,reason,expires_at,created_at,updated_at,created_by
    )
    values(
      p_user_id,nullif(trim(p_reason),''),v_expires,now(),now(),auth.uid()
    )
    on conflict(user_id) do update set
      reason=excluded.reason,
      expires_at=excluded.expires_at,
      updated_at=now(),
      created_by=auth.uid();
  else
    delete from public.public_chat_bans where user_id=p_user_id;
  end if;

  insert into public.account_events(
    user_id,event_type,title,message,details,created_by
  )
  values(
    p_user_id,
    case when p_enabled then 'public_chat_ban' else 'public_chat_unban' end,
    case when p_enabled then 'Public chat restricted' else 'Public chat restored' end,
    case when p_enabled
      then 'Staff disabled public chat sending for this account.'
      else 'Staff restored public chat sending for this account.'
    end,
    jsonb_build_object(
      'reason',nullif(trim(p_reason),''),
      'expires_at',v_expires
    ),
    auth.uid()
  );

  return jsonb_build_object('ok',true,'enabled',coalesce(p_enabled,false),'expires_at',v_expires);
end
$$;

create or replace function public.staff_get_quick_moderation(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
stable
as $$
declare
  v_public boolean := false;
  v_mute boolean := false;
  v_site boolean := false;
begin
  if not public.f2w_v121_can_moderate() then
    raise exception 'Staff permission required';
  end if;

  select exists(
    select 1
    from public.public_chat_bans b
    where b.user_id=p_user_id
      and (b.expires_at is null or b.expires_at>now())
  ) into v_public;

  select exists(
    select 1
    from public.user_mutes m
    where m.user_id=p_user_id
      and (m.expires_at is null or m.expires_at>now())
  ) into v_mute;

  select exists(
    select 1
    from public.chat_bans b
    where b.user_id=p_user_id
      and (b.expires_at is null or b.expires_at>now())
  ) into v_site;

  return jsonb_build_object(
    'public_chat_banned',v_public,
    'muted',v_mute,
    'site_suspended',v_site,
    'account_banned',v_site
  );
end
$$;

grant execute on function public.f2w_v121_can_moderate() to authenticated;
grant execute on function public.staff_set_public_chat_ban(uuid,boolean,integer,text) to authenticated;
grant execute on function public.staff_get_quick_moderation(uuid) to authenticated;

-- Realtime publication is optional; ignore duplicate-membership error safely.
do $$
begin
  begin
    alter publication supabase_realtime add table public.public_chat_bans;
  exception
    when duplicate_object then null;
  end;
end $$;

-- f2w-force-save:realtime-account-enforcement-v121:1788297958
 