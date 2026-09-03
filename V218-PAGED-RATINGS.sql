-- Flix2Watch V218 — paged public profile ratings for large libraries
-- Run after V215-RATINGS.sql (safe to run repeatedly).

create or replace function public.get_public_profile_ratings_v218(
  p_username text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table(
  media_type text,
  media_id bigint,
  rating smallint,
  review text,
  title text,
  poster_path text,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_user uuid;
  v_private boolean;
  v_limit integer := greatest(1,least(coalesce(p_limit,20),50));
  v_offset integer := greatest(0,coalesce(p_offset,0));
begin
  select p.user_id,coalesce(p.is_private,false)
  into v_user,v_private
  from public.profiles p
  where lower(p.username)=lower(trim(coalesce(p_username,'')))
  limit 1;

  if v_user is null then return; end if;
  if v_private and auth.uid() is distinct from v_user then return; end if;

  return query
  with scoped as (
    select r.media_type,r.media_id,r.rating,r.review,r.title,r.poster_path,r.updated_at
    from public.user_ratings_v215 r
    where r.user_id=v_user
  ), counted as (
    select count(*)::bigint as total from scoped
  )
  select s.media_type,s.media_id,s.rating,s.review,s.title,s.poster_path,s.updated_at,c.total
  from scoped s
  cross join counted c
  order by s.updated_at desc
  limit v_limit offset v_offset;
end;
$$;

grant execute on function public.get_public_profile_ratings_v218(text,integer,integer) to anon,authenticated;

-- f2w-force-save:v218-paged-profile-ratings-sql:20260903
