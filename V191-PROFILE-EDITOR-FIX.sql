-- Flix2Watch V191 — stable profile loading + complete Edit Profile fields
-- Run once in Supabase SQL Editor. Safe to re-run.

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists bio text not null default '',
  add column if not exists is_private boolean not null default false,
  add column if not exists favorite_genres text[] not null default '{}'::text[],
  add column if not exists website_url text,
  add column if not exists instagram_username text,
  add column if not exists discord_username text,
  add column if not exists snapchat_username text,
  add column if not exists steam_profile text,
  add column if not exists tiktok_username text,
  add column if not exists location text,
  add column if not exists status_text text,
  add column if not exists pronouns text,
  add column if not exists favorite_movie_text text,
  add column if not exists favorite_movie_tmdb_id bigint,
  add column if not exists favorite_movie_poster_path text,
  add column if not exists profile_quote text;

-- Case-insensitive username uniqueness. If this fails, there are already duplicate
-- usernames that differ only by case and those duplicates need resolving first.
create unique index if not exists profiles_username_lower_v191_uidx
  on public.profiles (lower(username));

create or replace function public.get_public_profile_v191(p_username text)
returns jsonb
language sql
security definer
stable
set search_path=public
as $$
  select to_jsonb(p)
  from public.profiles p
  where lower(p.username)=lower(
    trim(regexp_replace(coalesce(p_username,''),'[^A-Za-z0-9]','','g'))
  )
  limit 1;
$$;

grant execute on function public.get_public_profile_v191(text) to anon,authenticated;

create or replace function public.update_my_profile_v191(
  p_username text,
  p_display_name text default null,
  p_bio text default null,
  p_is_private boolean default false,
  p_location text default null,
  p_favorite_genres text[] default '{}'::text[],
  p_website_url text default null,
  p_instagram_username text default null,
  p_discord_username text default null,
  p_snapchat_username text default null,
  p_steam_profile text default null,
  p_tiktok_username text default null,
  p_status_text text default null,
  p_pronouns text default null,
  p_favorite_movie_text text default null,
  p_favorite_movie_tmdb_id bigint default null,
  p_favorite_movie_poster_path text default null,
  p_profile_quote text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_me uuid := auth.uid();
  v_username text := trim(coalesce(p_username,''));
  v_site text := nullif(left(trim(coalesce(p_website_url,'')),2048),'');
  v_steam text := nullif(left(trim(coalesce(p_steam_profile,'')),2048),'');
  v_result jsonb;
begin
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  if v_username !~ '^[A-Za-z0-9]{3,20}$' then
    raise exception 'Username must be 3-20 letters or numbers only';
  end if;

  if exists (
    select 1 from public.profiles p
    where lower(p.username)=lower(v_username)
      and p.user_id<>v_me
  ) then
    raise exception 'That username is already taken';
  end if;

  if v_site is not null and v_site !~* '^https?://' then
    v_site := 'https://' || v_site;
  end if;

  update public.profiles
  set username=v_username,
      display_name=nullif(left(trim(coalesce(p_display_name,'')),50),''),
      bio=left(trim(coalesce(p_bio,'')),500),
      is_private=coalesce(p_is_private,false),
      location=nullif(left(trim(coalesce(p_location,'')),80),''),
      favorite_genres=(
        select coalesce(array_agg(distinct left(trim(g),40)),'{}'::text[])
        from unnest((coalesce(p_favorite_genres,'{}'::text[]))[1:19]) as g
        where trim(g)<>''
      ),
      website_url=v_site,
      instagram_username=nullif(left(trim(leading '@' from coalesce(p_instagram_username,'')),80),''),
      discord_username=nullif(left(trim(leading '@' from coalesce(p_discord_username,'')),80),''),
      snapchat_username=nullif(left(trim(leading '@' from coalesce(p_snapchat_username,'')),80),''),
      steam_profile=v_steam,
      tiktok_username=nullif(left(trim(leading '@' from coalesce(p_tiktok_username,'')),80),''),
      status_text=nullif(left(trim(coalesce(p_status_text,'')),80),''),
      pronouns=nullif(left(trim(coalesce(p_pronouns,'')),40),''),
      favorite_movie_text=nullif(left(trim(coalesce(p_favorite_movie_text,'')),120),''),
      favorite_movie_tmdb_id=case
        when p_favorite_movie_tmdb_id is not null and p_favorite_movie_tmdb_id>0
          then p_favorite_movie_tmdb_id
        else null
      end,
      favorite_movie_poster_path=nullif(left(trim(coalesce(p_favorite_movie_poster_path,'')),300),''),
      profile_quote=nullif(left(trim(coalesce(p_profile_quote,'')),180),''),
      updated_at=now()
  where user_id=v_me;

  if not found then
    raise exception 'Profile not found';
  end if;

  -- Keep auth metadata in sync where possible. Profile routing remains based on
  -- public.profiles.username, so a metadata update failure must not break saving.
  begin
    update auth.users
    set raw_user_meta_data = coalesce(raw_user_meta_data,'{}'::jsonb)
      || jsonb_build_object(
        'username',v_username,
        'display_name',nullif(left(trim(coalesce(p_display_name,'')),50),'')
      )
    where id=v_me;
  exception when others then
    null;
  end;

  select to_jsonb(p) into v_result
  from public.profiles p
  where p.user_id=v_me;

  return v_result;
end;
$$;

grant execute on function public.update_my_profile_v191(
  text,text,text,boolean,text,text[],text,text,text,text,text,text,text,text,text,bigint,text,text
) to authenticated;

notify pgrst,'reload schema';
