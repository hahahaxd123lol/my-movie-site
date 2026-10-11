-- Flix2Watch V221 — half-star ratings (0.5 to 5.0)
-- Run once after V215/V218/V220.

begin;

alter table public.user_ratings_v215
  drop constraint if exists user_ratings_v215_rating_check;

alter table public.user_ratings_v215
  alter column rating type numeric(2,1)
  using rating::numeric(2,1);

alter table public.user_ratings_v215
  add constraint user_ratings_v215_rating_check
  check (
    rating >= 0.5
    and rating <= 5.0
    and rating * 2 = trunc(rating * 2)
  );

create or replace function public.save_user_rating_v221(
  p_media_type text,
  p_media_id bigint,
  p_rating numeric,
  p_review text default null,
  p_title text default null,
  p_poster_path text default null
)
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_user uuid:=auth.uid();
  v_type text:=lower(trim(coalesce(p_media_type,'')));
  v_rating numeric(2,1):=round(coalesce(p_rating,0)::numeric*2)/2;
  v_review text:=nullif(trim(coalesce(p_review,'')),'');
begin
  if v_user is null then
    raise exception 'You must be signed in to save a rating.';
  end if;

  if v_type not in ('movie','tv') then
    raise exception 'Invalid media type.';
  end if;

  if coalesce(p_media_id,0)<=0 then
    raise exception 'Invalid media id.';
  end if;

  if v_rating < 0.5 or v_rating > 5.0 or v_rating*2<>trunc(v_rating*2) then
    raise exception 'Rating must be from 0.5 to 5.0 in half-star steps.';
  end if;

  if v_review is not null and char_length(v_review)>600 then
    raise exception 'Review is too long.';
  end if;

  insert into public.user_ratings_v215(
    user_id,media_type,media_id,rating,review,title,poster_path,created_at,updated_at
  )
  values(
    v_user,
    v_type,
    p_media_id,
    v_rating,
    v_review,
    nullif(trim(coalesce(p_title,'')),''),
    nullif(trim(coalesce(p_poster_path,'')),''),
    now(),
    now()
  )
  on conflict(user_id,media_type,media_id)
  do update set
    rating=excluded.rating,
    review=excluded.review,
    title=coalesce(excluded.title,public.user_ratings_v215.title),
    poster_path=coalesce(excluded.poster_path,public.user_ratings_v215.poster_path),
    updated_at=now();
end;
$$;

create or replace function public.get_my_rating_v221(
  p_media_type text,
  p_media_id bigint
)
returns table(
  rating numeric,
  review text,
  title text,
  poster_path text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path=public,auth
as $$
  select r.rating,r.review,r.title,r.poster_path,r.updated_at
  from public.user_ratings_v215 r
  where auth.uid() is not null
    and r.user_id=auth.uid()
    and r.media_type=lower(trim(coalesce(p_media_type,'')))
    and r.media_id=p_media_id
  limit 1
$$;

create or replace function public.get_title_rating_summary_v221(
  p_media_type text,
  p_media_id bigint
)
returns table(
  average_rating numeric,
  rating_count bigint
)
language sql
stable
security definer
set search_path=public
as $$
  select
    coalesce(round(avg(r.rating)::numeric,2),0),
    count(*)::bigint
  from public.user_ratings_v215 r
  where r.media_type=lower(trim(coalesce(p_media_type,'')))
    and r.media_id=p_media_id
$$;

create or replace function public.get_public_profile_ratings_v221(
  p_username text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table(
  media_type text,
  media_id bigint,
  rating numeric,
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
    select
      r.media_type,
      r.media_id,
      r.rating,
      r.review,
      r.title,
      r.poster_path,
      r.updated_at
    from public.user_ratings_v215 r
    where r.user_id=v_user
  ),
  counted as (
    select count(*)::bigint total from scoped
  )
  select
    s.media_type,
    s.media_id,
    s.rating,
    s.review,
    s.title,
    s.poster_path,
    s.updated_at,
    c.total
  from scoped s
  cross join counted c
  order by s.updated_at desc,s.media_type,s.media_id
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.save_user_rating_v221(text,bigint,numeric,text,text,text) from public;
revoke all on function public.get_my_rating_v221(text,bigint) from public;

grant execute on function public.save_user_rating_v221(text,bigint,numeric,text,text,text) to authenticated;
grant execute on function public.get_my_rating_v221(text,bigint) to authenticated;
grant execute on function public.get_title_rating_summary_v221(text,bigint) to anon,authenticated;
grant execute on function public.get_public_profile_ratings_v221(text,integer,integer) to anon,authenticated;

notify pgrst,'reload schema';

commit;

-- f2w-force-save:v221-half-star-ratings-sql:20260903
