-- Flix2Watch V215 — canonical ratings + profile ratings
begin;

create table if not exists public.user_ratings_v215 (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('movie','tv')),
  media_id bigint not null check (media_id > 0),
  rating smallint not null check (rating between 1 and 5),
  review text null check (review is null or char_length(review) <= 600),
  title text null,
  poster_path text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, media_type, media_id)
);

create index if not exists user_ratings_v215_title_idx on public.user_ratings_v215(media_type, media_id);
create index if not exists user_ratings_v215_user_updated_idx on public.user_ratings_v215(user_id, updated_at desc);

alter table public.user_ratings_v215 enable row level security;

drop policy if exists "v215 user reads own ratings" on public.user_ratings_v215;
create policy "v215 user reads own ratings" on public.user_ratings_v215 for select to authenticated using (auth.uid() = user_id);

drop policy if exists "v215 user inserts own ratings" on public.user_ratings_v215;
create policy "v215 user inserts own ratings" on public.user_ratings_v215 for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "v215 user updates own ratings" on public.user_ratings_v215;
create policy "v215 user updates own ratings" on public.user_ratings_v215 for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "v215 user deletes own ratings" on public.user_ratings_v215;
create policy "v215 user deletes own ratings" on public.user_ratings_v215 for delete to authenticated using (auth.uid() = user_id);

create or replace function public.save_user_rating_v215(
  p_media_type text,p_media_id bigint,p_rating integer,p_review text default null,p_title text default null,p_poster_path text default null
) returns void language plpgsql security definer set search_path = public, auth as $$
declare v_user uuid := auth.uid(); v_type text := lower(trim(coalesce(p_media_type,''))); v_review text := nullif(trim(coalesce(p_review,'')),'');
begin
  if v_user is null then raise exception 'You must be signed in to save a rating.'; end if;
  if v_type not in ('movie','tv') then raise exception 'Invalid media type.'; end if;
  if coalesce(p_media_id,0) <= 0 then raise exception 'Invalid media id.'; end if;
  if p_rating not between 1 and 5 then raise exception 'Rating must be between 1 and 5.'; end if;
  if v_review is not null and char_length(v_review) > 600 then raise exception 'Review is too long.'; end if;

  insert into public.user_ratings_v215(user_id,media_type,media_id,rating,review,title,poster_path,created_at,updated_at)
  values(v_user,v_type,p_media_id,p_rating,v_review,nullif(trim(coalesce(p_title,'')),''),nullif(trim(coalesce(p_poster_path,'')),''),now(),now())
  on conflict (user_id,media_type,media_id) do update set
    rating=excluded.rating,review=excluded.review,
    title=coalesce(excluded.title,public.user_ratings_v215.title),
    poster_path=coalesce(excluded.poster_path,public.user_ratings_v215.poster_path),
    updated_at=now();
end $$;

create or replace function public.clear_user_rating_v215(p_media_type text,p_media_id bigint)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'You must be signed in.'; end if;
  delete from public.user_ratings_v215 where user_id=auth.uid() and media_type=lower(trim(coalesce(p_media_type,''))) and media_id=p_media_id;
end $$;

create or replace function public.get_my_rating_v215(p_media_type text,p_media_id bigint)
returns table(rating smallint,review text,title text,poster_path text,updated_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select r.rating,r.review,r.title,r.poster_path,r.updated_at
  from public.user_ratings_v215 r
  where auth.uid() is not null and r.user_id=auth.uid()
    and r.media_type=lower(trim(coalesce(p_media_type,''))) and r.media_id=p_media_id
  limit 1
$$;

create or replace function public.get_title_rating_summary_v215(p_media_type text,p_media_id bigint)
returns table(average_rating numeric,rating_count bigint,one_star bigint,two_star bigint,three_star bigint,four_star bigint,five_star bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(round(avg(r.rating)::numeric,2),0),count(*)::bigint,
    count(*) filter (where r.rating=1)::bigint,count(*) filter (where r.rating=2)::bigint,
    count(*) filter (where r.rating=3)::bigint,count(*) filter (where r.rating=4)::bigint,
    count(*) filter (where r.rating=5)::bigint
  from public.user_ratings_v215 r
  where r.media_type=lower(trim(coalesce(p_media_type,''))) and r.media_id=p_media_id
$$;

create or replace function public.get_public_profile_ratings_v215(p_username text)
returns table(media_type text,media_id bigint,rating smallint,review text,title text,poster_path text,updated_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
declare v_user uuid; v_private boolean;
begin
  select p.user_id,coalesce(p.is_private,false) into v_user,v_private
  from public.profiles p where lower(p.username)=lower(trim(coalesce(p_username,''))) limit 1;
  if v_user is null then return; end if;
  if v_private and auth.uid() is distinct from v_user then return; end if;
  return query
  select r.media_type,r.media_id,r.rating,r.review,r.title,r.poster_path,r.updated_at
  from public.user_ratings_v215 r where r.user_id=v_user order by r.updated_at desc limit 60;
end $$;

revoke all on function public.save_user_rating_v215(text,bigint,integer,text,text,text) from public;
revoke all on function public.clear_user_rating_v215(text,bigint) from public;
revoke all on function public.get_my_rating_v215(text,bigint) from public;
grant execute on function public.save_user_rating_v215(text,bigint,integer,text,text,text) to authenticated;
grant execute on function public.clear_user_rating_v215(text,bigint) to authenticated;
grant execute on function public.get_my_rating_v215(text,bigint) to authenticated;
grant execute on function public.get_title_rating_summary_v215(text,bigint) to anon,authenticated;
grant execute on function public.get_public_profile_ratings_v215(text) to anon,authenticated;

commit;
-- f2w-force-save:v215-ratings-sql:20260903
