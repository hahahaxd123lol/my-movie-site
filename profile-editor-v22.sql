-- ============================================================
-- FLIX2WATCH PROFILE EDITOR v22
-- RUN ONCE IN SUPABASE SQL EDITOR
-- ============================================================

alter table public.profiles
  add column if not exists snapchat_username text,
  add column if not exists reddit_username text,
  add column if not exists steam_profile text,
  add column if not exists tiktok_username text,
  add column if not exists favorite_movie_tmdb_id bigint,
  add column if not exists favorite_movie_poster_path text;

create or replace function public.update_my_profile_v22(
  p_display_name text default null,
  p_bio text default null,
  p_is_private boolean default false,
  p_location text default null,
  p_favorite_genres text[] default '{}'::text[],
  p_website_url text default null,
  p_instagram_username text default null,
  p_discord_username text default null,
  p_snapchat_username text default null,
  p_reddit_username text default null,
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
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_result jsonb;
  v_site text:=nullif(left(trim(coalesce(p_website_url,'')),2048),'');
  v_steam text:=nullif(left(trim(coalesce(p_steam_profile,'')),2048),'');
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if public.account_is_banned(v_me) then raise exception 'Suspended accounts cannot edit profiles'; end if;

  if v_site is not null and v_site !~* '^https?://' then
    v_site:='https://'||v_site;
  end if;

  update public.profiles
  set display_name=nullif(left(trim(coalesce(p_display_name,'')),50),''),
      bio=nullif(left(trim(coalesce(p_bio,'')),500),''),
      is_private=coalesce(p_is_private,false),
      location=nullif(left(trim(coalesce(p_location,'')),80),''),
      favorite_genres=(
        select coalesce(array_agg(distinct left(trim(g),40)),'{}'::text[])
        from unnest((coalesce(p_favorite_genres,'{}'::text[]))[1:19]) as g
        where trim(g)<>''
      ),
      website_url=v_site,
      instagram_username=nullif(left(trim(coalesce(p_instagram_username,'')),80),''),
      discord_username=nullif(left(trim(coalesce(p_discord_username,'')),80),''),
      snapchat_username=nullif(left(trim(coalesce(p_snapchat_username,'')),80),''),
      reddit_username=nullif(left(trim(coalesce(p_reddit_username,'')),80),''),
      steam_profile=v_steam,
      tiktok_username=nullif(left(trim(coalesce(p_tiktok_username,'')),80),''),
      status_text=nullif(left(trim(coalesce(p_status_text,'')),80),''),
      pronouns=nullif(left(trim(coalesce(p_pronouns,'')),40),''),
      favorite_movie_text=nullif(left(trim(coalesce(p_favorite_movie_text,'')),120),''),
      favorite_movie_tmdb_id=case when p_favorite_movie_tmdb_id is not null and p_favorite_movie_tmdb_id>0 then p_favorite_movie_tmdb_id else null end,
      favorite_movie_poster_path=nullif(left(trim(coalesce(p_favorite_movie_poster_path,'')),300),''),
      profile_quote=nullif(left(trim(coalesce(p_profile_quote,'')),180),''),
      updated_at=now()
  where user_id=v_me;

  select to_jsonb(p) into v_result
  from public.profiles p
  where p.user_id=v_me;

  return v_result;
end;
$$;

grant execute on function public.update_my_profile_v22(
  text,text,boolean,text,text[],text,text,text,text,text,text,text,text,text,text,bigint,text,text
) to authenticated;

notify pgrst,'reload schema';

-- f2w-force-save:profile-editor-sql-v22:1788214990
 