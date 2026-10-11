-- Flix2Watch V220 — restore legacy ratings and keep scalable paging.
-- Safe to run repeatedly after V215-RATINGS.sql.

begin;

insert into public.user_ratings_v215(
  user_id,media_type,media_id,rating,review,title,poster_path,created_at,updated_at
)
select
  r.user_id,
  lower(r.media_type),
  r.media_id,
  r.rating,
  nullif(trim(r.review),''),
  nullif(trim(r.title),''),
  nullif(trim(r.poster_path),''),
  coalesce(r.created_at,now()),
  coalesce(r.updated_at,r.created_at,now())
from public.user_ratings r
where r.user_id is not null
  and lower(r.media_type) in ('movie','tv')
  and r.media_id > 0
  and r.rating between 1 and 5
on conflict (user_id,media_type,media_id)
do update set
  rating = case when excluded.updated_at > public.user_ratings_v215.updated_at then excluded.rating else public.user_ratings_v215.rating end,
  review = case when excluded.updated_at > public.user_ratings_v215.updated_at then excluded.review else public.user_ratings_v215.review end,
  title = coalesce(public.user_ratings_v215.title,excluded.title),
  poster_path = coalesce(public.user_ratings_v215.poster_path,excluded.poster_path),
  created_at = least(public.user_ratings_v215.created_at,excluded.created_at),
  updated_at = greatest(public.user_ratings_v215.updated_at,excluded.updated_at);

create index if not exists user_ratings_v215_user_updated_v220_idx
  on public.user_ratings_v215(user_id,updated_at desc);

create or replace function public.get_public_profile_ratings_v220(
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
set search_path=public,auth
as $$
declare
  v_user uuid;
  v_private boolean;
  v_limit integer:=greatest(1,least(coalesce(p_limit,20),50));
  v_offset integer:=greatest(0,coalesce(p_offset,0));
begin
  select p.user_id,coalesce(p.is_private,false)
    into v_user,v_private
  from public.profiles p
  where lower(p.username)=lower(trim(coalesce(p_username,'')))
  limit 1;

  if v_user is null then return; end if;
  if v_private and auth.uid() is distinct from v_user then return; end if;

  return query
  with scoped as materialized (
    select r.media_type,r.media_id,r.rating,r.review,r.title,r.poster_path,r.updated_at
    from public.user_ratings_v215 r
    where r.user_id=v_user
  ),
  counted as (
    select count(*)::bigint total from scoped
  )
  select s.media_type,s.media_id,s.rating,s.review,s.title,s.poster_path,s.updated_at,c.total
  from scoped s
  cross join counted c
  order by s.updated_at desc,s.media_type,s.media_id
  limit v_limit offset v_offset;
end;
$$;

grant execute on function public.get_public_profile_ratings_v220(text,integer,integer)
to anon,authenticated;

notify pgrst,'reload schema';

commit;

-- f2w-force-save:v220-ratings-migration:20260903
