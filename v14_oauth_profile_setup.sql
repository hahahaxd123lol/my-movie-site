
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
