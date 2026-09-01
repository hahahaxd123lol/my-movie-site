-- Flix2Watch v117 public user ratings
create extension if not exists pgcrypto;

create table if not exists public.user_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null,
  media_id bigint not null,
  rating smallint not null,
  review text,
  title text,
  poster_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_ratings add column if not exists user_id uuid;
alter table public.user_ratings add column if not exists media_type text;
alter table public.user_ratings add column if not exists media_id bigint;
alter table public.user_ratings add column if not exists rating smallint;
alter table public.user_ratings add column if not exists review text;
alter table public.user_ratings add column if not exists title text;
alter table public.user_ratings add column if not exists poster_path text;
alter table public.user_ratings add column if not exists created_at timestamptz default now();
alter table public.user_ratings add column if not exists updated_at timestamptz default now();

create unique index if not exists user_ratings_user_media_v117_uq
  on public.user_ratings(user_id,media_type,media_id);

alter table public.user_ratings enable row level security;

drop policy if exists user_ratings_select_own_v117 on public.user_ratings;
create policy user_ratings_select_own_v117 on public.user_ratings
  for select to authenticated using (auth.uid()=user_id);

drop policy if exists user_ratings_write_own_v117 on public.user_ratings;
create policy user_ratings_write_own_v117 on public.user_ratings
  for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

create or replace function public.save_user_rating_v117(
  p_media_type text,
  p_media_id bigint,
  p_rating smallint,
  p_review text default null,
  p_title text default null,
  p_poster_path text default null
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if lower(p_media_type) not in ('movie','tv') then raise exception 'Invalid media type'; end if;
  if p_media_id is null or p_media_id<=0 then raise exception 'Invalid media id'; end if;
  if p_rating<1 or p_rating>5 then raise exception 'Rating must be 1 to 5'; end if;
  if length(coalesce(p_review,''))>600 then raise exception 'Review too long'; end if;

  insert into public.user_ratings(user_id,media_type,media_id,rating,review,title,poster_path,created_at,updated_at)
  values(v_uid,lower(p_media_type),p_media_id,p_rating,nullif(trim(p_review),''),nullif(trim(p_title),''),nullif(trim(p_poster_path),''),now(),now())
  on conflict(user_id,media_type,media_id) do update set
    rating=excluded.rating,
    review=excluded.review,
    title=coalesce(excluded.title,public.user_ratings.title),
    poster_path=coalesce(excluded.poster_path,public.user_ratings.poster_path),
    updated_at=now();

  return jsonb_build_object('ok',true);
end $$;

create or replace function public.clear_user_rating_v117(p_media_type text,p_media_id bigint)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  delete from public.user_ratings where user_id=v_uid and media_type=lower(p_media_type) and media_id=p_media_id;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.get_my_rating_v117(p_media_type text,p_media_id bigint)
returns table(rating smallint,review text)
language sql security definer set search_path=public stable
as $$
  select r.rating,r.review from public.user_ratings r
  where r.user_id=auth.uid() and r.media_type=lower(p_media_type) and r.media_id=p_media_id
  limit 1
$$;

create or replace function public.get_title_rating_summary_v117(p_media_type text,p_media_id bigint)
returns table(average_rating numeric,rating_count bigint)
language sql security definer set search_path=public stable
as $$
  select round(avg(r.rating)::numeric,1),count(*)::bigint
  from public.user_ratings r
  where r.media_type=lower(p_media_type) and r.media_id=p_media_id
$$;

create or replace function public.get_public_profile_ratings_v117(p_username text)
returns table(media_type text,media_id bigint,rating smallint,review text,title text,poster_path text,updated_at timestamptz)
language sql security definer set search_path=public stable
as $$
  select r.media_type,r.media_id,r.rating,r.review,r.title,r.poster_path,r.updated_at
  from public.user_ratings r
  join public.profiles p on p.user_id=r.user_id
  where lower(p.username)=lower(trim(p_username))
    and coalesce(p.is_private,false)=false
  order by r.updated_at desc
  limit 30
$$;

grant execute on function public.save_user_rating_v117(text,bigint,smallint,text,text,text) to authenticated;
grant execute on function public.clear_user_rating_v117(text,bigint) to authenticated;
grant execute on function public.get_my_rating_v117(text,bigint) to authenticated;
grant execute on function public.get_title_rating_summary_v117(text,bigint) to anon,authenticated;
grant execute on function public.get_public_profile_ratings_v117(text) to anon,authenticated;

-- f2w-force-save:ratings-v117:1788295984
 