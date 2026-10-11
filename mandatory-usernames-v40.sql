-- ============================================================
-- FLIX2WATCH v40 — MANDATORY UNIQUE USERNAMES
-- RUN ONCE IN SUPABASE SQL EDITOR
-- ============================================================

-- First, normalize blank usernames to NULL so duplicates are visible.
update public.profiles
set username=null
where username is not null and trim(username)='';

-- Fail clearly if the database already has duplicate case-insensitive usernames.
do $$
declare
  v_dup text;
begin
  select lower(username)
  into v_dup
  from public.profiles
  where username is not null
  group by lower(username)
  having count(*)>1
  limit 1;

  if v_dup is not null then
    raise exception 'Duplicate username already exists (case-insensitive): %. Resolve it before rerunning v40.',v_dup;
  end if;
end $$;

create unique index if not exists profiles_username_lower_unique_v40
  on public.profiles(lower(username))
  where username is not null;

create or replace function public.claim_my_username_v40(p_username text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_username text:=trim(coalesce(p_username,''));
  v_result jsonb;
begin
  if v_me is null then raise exception 'Authentication required'; end if;

  if char_length(v_username)<2 or char_length(v_username)>30 then
    raise exception 'Username must be 2–30 characters.';
  end if;

  if v_username !~ '^[A-Za-z0-9]+$' then
    raise exception 'Username can only contain letters and numbers.';
  end if;

  if lower(v_username)='josh' and v_me<>'f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    raise exception 'That username is reserved.';
  end if;

  if exists(
    select 1
    from public.profiles p
    where p.user_id<>v_me
      and lower(p.username)=lower(v_username)
  ) then
    raise exception 'That username is already taken.';
  end if;

  update public.profiles
  set username=v_username,
      updated_at=now()
  where user_id=v_me;

  if not found then
    insert into public.profiles(user_id,username,created_at,updated_at)
    values(v_me,v_username,now(),now());
  end if;

  update auth.users
  set raw_user_meta_data=
      coalesce(raw_user_meta_data,'{}'::jsonb) ||
      jsonb_build_object('username',v_username,'chat_alias',v_username)
  where id=v_me;

  select jsonb_build_object('user_id',p.user_id,'username',p.username)
  into v_result
  from public.profiles p
  where p.user_id=v_me;

  return v_result;
end;
$$;

revoke all on function public.claim_my_username_v40(text) from public;
grant execute on function public.claim_my_username_v40(text) to authenticated;

notify pgrst,'reload schema';

-- f2w-force-save:mandatory-usernames-v40:1788218691
 