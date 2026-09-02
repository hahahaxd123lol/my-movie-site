-- FLIX2WATCH V212 — Staff Control profile editor parity.
-- Adds staff-safe read/write RPCs for the same profile fields members can edit.

alter table public.profiles
  add column if not exists favorite_genres text[] not null default '{}'::text[],
  add column if not exists website_url text,
  add column if not exists instagram_username text,
  add column if not exists discord_username text,
  add column if not exists snapchat_username text,
  add column if not exists steam_profile text,
  add column if not exists tiktok_username text;

create or replace function public.staff_get_profile_extras_v212(p_user_id uuid)
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
    'is_private',coalesce(p.is_private,false)
  ) into v_result
  from public.profiles p
  where p.user_id=p_user_id;

  if v_result is null then raise exception 'Profile not found'; end if;
  return v_result;
end
$$;

grant execute on function public.staff_get_profile_extras_v212(uuid) to authenticated;

create or replace function public.staff_edit_user_profile_v212(
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
  p_tiktok_username text default null
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

  update public.profiles
  set username=v_username,
      display_name=v_display_name,
      bio=v_bio,
      avatar_url=v_avatar_url,
      is_private=coalesce(p_is_private,is_private),
      favorite_genres=(select coalesce(array_agg(distinct left(trim(g),40)),'{}'::text[]) from unnest((coalesce(p_favorite_genres,'{}'::text[]))[1:19]) g where trim(g)<>''),
      website_url=v_site,
      instagram_username=nullif(left(trim(leading '@' from coalesce(p_instagram_username,'')),80),''),
      discord_username=nullif(left(trim(leading '@' from coalesce(p_discord_username,'')),80),''),
      snapchat_username=nullif(left(trim(leading '@' from coalesce(p_snapchat_username,'')),80),''),
      steam_profile=v_steam,
      tiktok_username=nullif(left(trim(leading '@' from coalesce(p_tiktok_username,'')),80),''),
      updated_at=clock_timestamp()
  where user_id=p_user_id
  returning * into v_profile;

  -- Keep auth metadata username aligned so account/profile routing stays consistent.
  update auth.users
     set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)||jsonb_build_object('username',v_username,'chat_alias',v_username),
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
      'tiktok_username',v_profile.tiktok_username
    )
  );

  return jsonb_build_object(
    'user_id',v_profile.user_id,
    'username',v_profile.username,
    'display_name',v_profile.display_name,
    'bio',v_profile.bio,
    'avatar_url',v_profile.avatar_url,
    'is_private',v_profile.is_private,
    'favorite_genres',coalesce(v_profile.favorite_genres,'{}'::text[]),
    'website_url',v_profile.website_url,
    'instagram_username',v_profile.instagram_username,
    'discord_username',v_profile.discord_username,
    'snapchat_username',v_profile.snapchat_username,
    'steam_profile',v_profile.steam_profile,
    'tiktok_username',v_profile.tiktok_username,
    'created_at',v_profile.created_at,
    'updated_at',v_profile.updated_at
  );
end
$$;

grant execute on function public.staff_edit_user_profile_v212(uuid,text,text,text,text,boolean,text[],text,text,text,text,text,text) to authenticated;
notify pgrst,'reload schema';
