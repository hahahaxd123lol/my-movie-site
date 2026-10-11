-- FLIX2WATCH V202 — profile extras, follower/following lists, and privacy helpers.
-- Safe to run after V200/V201. Does not change the known-working core profile loader.

create or replace function public.get_public_profile_extras_v202(p_username text)
returns table(
  favorite_genres text[],
  website_url text,
  instagram_username text,
  discord_username text,
  snapchat_username text,
  steam_profile text,
  tiktok_username text,
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
    coalesce(p.is_private,false)
  from public.profiles p
  where lower(p.username)=lower(trim(regexp_replace(coalesce(p_username,''),'[^A-Za-z0-9]','','g')))
  limit 1
$$;
grant execute on function public.get_public_profile_extras_v202(text) to anon,authenticated;

create or replace function public.get_profile_followers_v202(p_profile_user_id uuid)
returns table(username text,display_name text,avatar_url text)
language sql
security definer
stable
set search_path=public
as $$
  select p.username,
         nullif(trim(replace(coalesce(p.display_name,''),'@','')),''),
         p.avatar_url
  from public.profile_follows f
  join public.profiles target on target.user_id=f.followed_user_id
  join public.profiles p on p.user_id=f.follower_user_id
  where f.followed_user_id=p_profile_user_id
    and (
      coalesce(target.is_private,false)=false
      or auth.uid()=p_profile_user_id
    )
  order by lower(coalesce(nullif(trim(replace(coalesce(p.display_name,''),'@','')),''),p.username)), lower(p.username)
$$;
grant execute on function public.get_profile_followers_v202(uuid) to anon,authenticated;

create or replace function public.get_profile_following_v202(p_profile_user_id uuid)
returns table(username text,display_name text,avatar_url text)
language sql
security definer
stable
set search_path=public
as $$
  select p.username,
         nullif(trim(replace(coalesce(p.display_name,''),'@','')),''),
         p.avatar_url
  from public.profile_follows f
  join public.profiles target on target.user_id=f.follower_user_id
  join public.profiles p on p.user_id=f.followed_user_id
  where f.follower_user_id=p_profile_user_id
    and (
      coalesce(target.is_private,false)=false
      or auth.uid()=p_profile_user_id
    )
  order by lower(coalesce(nullif(trim(replace(coalesce(p.display_name,''),'@','')),''),p.username)), lower(p.username)
$$;
grant execute on function public.get_profile_following_v202(uuid) to anon,authenticated;

create or replace function public.set_my_profile_private_v202(p_private boolean)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  update public.profiles
     set is_private=coalesce(p_private,false),
         updated_at=clock_timestamp()
   where user_id=auth.uid();
  if not found then raise exception 'Profile not found'; end if;
  return coalesce(p_private,false);
end
$$;
grant execute on function public.set_my_profile_private_v202(boolean) to authenticated;

notify pgrst,'reload schema';
