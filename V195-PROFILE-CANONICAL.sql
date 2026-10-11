-- Flix2Watch V195 — canonical public profile read path
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

create index if not exists profiles_username_lower_v195_idx
  on public.profiles (lower(username));

create or replace function public.get_public_profile_v195(p_username text)
returns jsonb
language sql
security definer
stable
set search_path=public
as $$
  select to_jsonb(p)
  from public.profiles p
  where lower(p.username)=lower(trim(regexp_replace(coalesce(p_username,''),'[^A-Za-z0-9]','','g')))
  limit 1;
$$;

grant execute on function public.get_public_profile_v195(text) to anon, authenticated;

notify pgrst,'reload schema';
