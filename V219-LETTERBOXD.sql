-- FLIX2WATCH V219 — Letterboxd profile linking + staff parity.
-- Safe to run after V200/V202/V212.

alter table public.profiles
  add column if not exists letterboxd_username text;

create or replace function public.get_public_profile_extras_v219(p_username text)
returns table(
  favorite_genres text[],
  website_url text,
  instagram_username text,
  discord_username text,
  snapchat_username text,
  steam_profile text,
  tiktok_username text,
  letterboxd_username text,
  is_private boolean
)
language sql
security definer
stable
set search_path=public
as $$
  select
    coalesce(p.favorite_genres,'{}'::text[]),
    p.website_url,
    p.instagram_username,
    p.discord_username,
    p.snapchat_username,
    p.steam_profile,
    p.tiktok_username,
    p.letterboxd_username,
    coalesce(p.is_private,false)
  from public.profiles p
  where lower(p.username)=lower(trim(regexp_replace(coalesce(p_username,''),'[^A-Za-z0-9]','','g')))
  limit 1
$$;

grant execute on function public.get_public_profile_extras_v219(text) to anon,authenticated;

create or replace function public.update_my_profile_v219(
  p_display_name text default null,
  p_bio text default null,
  p_favorite_genres text[] default '{}'::text[],
  p_website_url text default null,
  p_instagram_username text default null,
  p_discord_username text default null,
  p_snapchat_username text default null,
  p_steam_profile text default null,
  p_tiktok_username text default null,
  p_is_private boolean default false,
  p_letterboxd_username text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_result jsonb;
  v_site text;
  v_steam text;
  v_display text;
  v_letterboxd text;
begin
  if v_me is null then raise exception 'Authentication required'; end if;

  v_display:=nullif(left(trim(replace(coalesce(p_display_name,''),'@','')),50),'');
  v_site:=nullif(left(trim(coalesce(p_website_url,'')),2048),'');
  if v_site is not null and v_site !~* '^https?://' then v_site:='https://'||v_site; end if;
  v_steam:=nullif(left(trim(coalesce(p_steam_profile,'')),2048),'');
  v_letterboxd:=nullif(left(trim(leading '@' from coalesce(p_letterboxd_username,'')),80),'');

  if v_letterboxd is not null and v_letterboxd !~ '^[A-Za-z0-9._-]+$' then
    raise exception 'Letterboxd username contains unsupported characters';
  end if;

  update public.profiles
  set display_name=v_display,
      bio=left(trim(coalesce(p_bio,'')),500),
      is_private=coalesce(p_is_private,false),
      favorite_genres=(select coalesce(array_agg(distinct left(trim(g),40)),'{}'::text[])
                       from unnest((coalesce(p_favorite_genres,'{}'::text[]))[1:19]) g
                       where trim(g)<>''),
      website_url=v_site,
      instagram_username=nullif(left(trim(leading '@' from coalesce(p_instagram_username,'')),80),''),
      discord_username=nullif(left(trim(leading '@' from coalesce(p_discord_username,'')),80),''),
      snapchat_username=nullif(left(trim(leading '@' from coalesce(p_snapchat_username,'')),80),''),
      steam_profile=v_steam,
      tiktok_username=nullif(left(trim(leading '@' from coalesce(p_tiktok_username,'')),80),''),
      letterboxd_username=v_letterboxd,
      updated_at=clock_timestamp()
  where user_id=v_me;

  if not found then raise exception 'Profile not found'; end if;

  select to_jsonb(p) into v_result
  from public.profiles p
  where p.user_id=v_me;

  return v_result;
end
$$;

grant execute on function public.update_my_profile_v219(text,text,text[],text,text,text,text,text,text,boolean,text) to authenticated;

create or replace function public.staff_get_profile_extras_v219(p_user_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path=public,auth
as $$
declare v_result jsonb;
begin
  if not (public.staff_has_permission('profiles_manage') or public.staff_has_permission('profile_roles_manage')) then
    raise exception 'Profile management permission required';
  end if;

  select jsonb_build_object(
    'favorite_genres',coalesce(p.favorite_genres,'{}'::text[]),
    'website_url',p.website_url,
    'instagram_username',p.instagram_username,
    'discord_username',p.discord_username,
    'snapchat_username',p.snapchat_username,
    'steam_profile',p.steam_profile,
    'tiktok_username',p.tiktok_username,
    'letterboxd_username',p.letterboxd_username,
    'is_private',coalesce(p.is_private,false)
  )
  into v_result
  from public.profiles p
  where p.user_id=p_user_id;

  if v_result is null then raise exception 'Profile not found'; end if;
  return v_result;
end
$$;

grant execute on function public.staff_get_profile_extras_v219(uuid) to authenticated;

create or replace function public.staff_edit_user_profile_v219(
  p_user_id uuid,
  p_username text,
  p_display_name text default null,
  p_bio text default null,
  p_avatar_url text default null,
  p_is_private boolean default null,
  p_favorite_genres text[] default '{}'::text[],
  p_website_url text default null,
  p_instagram_username text default null,
  p_discord_username text default null,
  p_snapchat_username text default null,
  p_steam_profile text default null,
  p_tiktok_username text default null,
  p_letterboxd_username text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_profile public.profiles%rowtype;
  v_username text:=trim(coalesce(p_username,''));
  v_display_name text:=nullif(left(trim(replace(coalesce(p_display_name,''),'@','')),50),'');
  v_bio text:=left(coalesce(p_bio,''),500);
  v_avatar_url text:=nullif(left(trim(coalesce(p_avatar_url,'')),2048),'');
  v_site text:=nullif(left(trim(coalesce(p_website_url,'')),2048),'');
  v_steam text:=nullif(left(trim(coalesce(p_steam_profile,'')),2048),'');
  v_letterboxd text:=nullif(left(trim(leading '@' from coalesce(p_letterboxd_username,'')),80),'');
begin
  if not public.staff_has_permission('profiles_manage') then
    raise exception 'Profile management permission required';
  end if;

  select * into v_profile from public.profiles where user_id=p_user_id for update;
  if v_profile.user_id is null then raise exception 'Profile not found'; end if;

  if p_user_id='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    if public.staff_current_role()<>'owner' then raise exception 'Only Owner can edit the Owner profile'; end if;
    if lower(v_username)<>'josh' then raise exception 'Owner username must remain josh'; end if;
  end if;

  if v_username !~ '^[A-Za-z0-9]{2,30}$' then
    raise exception 'Username must use 2-30 English letters or numbers only';
  end if;

  if exists(select 1 from public.profiles p where p.user_id<>p_user_id and lower(p.username)=lower(v_username)) then
    raise exception 'That username is already taken';
  end if;

  if v_avatar_url is not null and v_avatar_url !~* '^https://' and v_avatar_url !~* '^data:image/' then
    raise exception 'Avatar URL must use HTTPS';
  end if;

  if v_site is not null and v_site !~* '^https?://' then v_site:='https://'||v_site; end if;
  if v_site is not null and v_site !~* '^https?://[^[:space:]]+\.[^[:space:]]+' then
    raise exception 'Website must be a valid HTTP/HTTPS URL or domain';
  end if;

  if v_letterboxd is not null and v_letterboxd !~ '^[A-Za-z0-9._-]+$' then
    raise exception 'Letterboxd username contains unsupported characters';
  end if;

  update public.profiles
  set username=v_username,
      display_name=v_display_name,
      bio=v_bio,
      avatar_url=v_avatar_url,
      is_private=coalesce(p_is_private,is_private),
      favorite_genres=(select coalesce(array_agg(distinct left(trim(g),40)),'{}'::text[])
                       from unnest((coalesce(p_favorite_genres,'{}'::text[]))[1:19]) g
                       where trim(g)<>''),
      website_url=v_site,
      instagram_username=nullif(left(trim(leading '@' from coalesce(p_instagram_username,'')),80),''),
      discord_username=nullif(left(trim(leading '@' from coalesce(p_discord_username,'')),80),''),
      snapchat_username=nullif(left(trim(leading '@' from coalesce(p_snapchat_username,'')),80),''),
      steam_profile=v_steam,
      tiktok_username=nullif(left(trim(leading '@' from coalesce(p_tiktok_username,'')),80),''),
      letterboxd_username=v_letterboxd,
      updated_at=clock_timestamp()
  where user_id=p_user_id
  returning * into v_profile;

  update auth.users
     set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)
       ||jsonb_build_object('username',v_username,'chat_alias',v_username),
         updated_at=clock_timestamp()
   where id=p_user_id;

  perform public.staff_write_audit(
    'profile_edited',
    'user',
    p_user_id::text,
    jsonb_build_object(
      'username',v_profile.username,
      'display_name',v_profile.display_name,
      'is_private',v_profile.is_private,
      'favorite_genres',v_profile.favorite_genres,
      'website_url',v_profile.website_url,
      'instagram_username',v_profile.instagram_username,
      'discord_username',v_profile.discord_username,
      'snapchat_username',v_profile.snapchat_username,
      'steam_profile',v_profile.steam_profile,
      'tiktok_username',v_profile.tiktok_username,
      'letterboxd_username',v_profile.letterboxd_username
    )
  );

  return to_jsonb(v_profile);
end
$$;

grant execute on function public.staff_edit_user_profile_v219(uuid,text,text,text,text,boolean,text[],text,text,text,text,text,text,text) to authenticated;

notify pgrst,'reload schema';

-- f2w-force-save:v219-letterboxd-sql:20260903
