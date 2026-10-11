-- Flix2Watch v139 — instant member age + robust XP leaderboard
-- Run after v136/v137. Safe to re-run.

-- Tiny authoritative member-age RPC. This deliberately avoids the heavier
-- presence/current-watching joins so a profile can paint its true account age
-- as soon as the page begins loading.
create index if not exists profiles_username_lower_v139_idx on public.profiles (lower(username));

create or replace function public.get_profile_member_since_v139(p_username text)
returns timestamptz
language sql
security definer
stable
set search_path=public,auth
as $$
  select u.created_at
  from public.profiles p
  join auth.users u on u.id=p.user_id
  where lower(p.username)=lower(trim(coalesce(p_username,'')))
  limit 1
$$;

grant execute on function public.get_profile_member_since_v139(text) to anon,authenticated;

-- Keep the public profile copy permanently aligned to the actual auth account
-- creation timestamp. This repairs older/stale profile rows too.
update public.profiles p
set created_at=u.created_at
from auth.users u
where u.id=p.user_id
  and p.created_at is distinct from u.created_at;

-- XP leaderboard. Production installs have existed with media_id as both bigint
-- and text across older migrations. Cast BOTH sources to text before UNION so
-- PostgreSQL never has to unify bigint and text. The key is only used for
-- distinct-title counting, so this preserves the correct result.
create or replace function public.get_public_leaderboard(
  p_page integer default 1,
  p_page_size integer default 25,
  p_sort text default 'overall'
)
returns table(
  rank_no bigint,user_id uuid,username text,display_name text,avatar_url text,last_seen_at timestamptz,
  online boolean,titles_watched bigint,watch_minutes bigint,ratings_count bigint,achievements integer,
  score bigint,top_role text,total_count bigint
)
language sql security definer stable set search_path=public as $$
with title_keys as (
  select a.user_id, coalesce(a.media_type,'')::text as media_type, a.media_id::text as media_id
  from public.profile_title_activity a
  union
  select w.user_id, coalesce(w.media_type,'')::text as media_type, w.media_id::text as media_id
  from public.profile_watch_time w
  where greatest(coalesce(w.seconds,0),0) > 0
), activity as (
  select t.user_id,count(*)::bigint as titles_watched
  from title_keys t
  group by t.user_id
), watchtime as (
  select w.user_id,floor(sum(greatest(coalesce(w.seconds,0),0))/60.0)::bigint as watch_minutes
  from public.profile_watch_time w
  group by w.user_id
), ratings as (
  select r.user_id,count(*)::bigint as ratings_count
  from public.user_ratings r
  group by r.user_id
), base as (
  select p.user_id,p.username,p.display_name,p.avatar_url,pr.last_seen_at,
    coalesce(pr.online_until>now(),false) as online,
    coalesce(a.titles_watched,0)::bigint as titles_watched,
    coalesce(w.watch_minutes,0)::bigint as watch_minutes,
    coalesce(r.ratings_count,0)::bigint as ratings_count,
    ((case when nullif(trim(coalesce(p.avatar_url,'')),'') is not null then 1 else 0 end)+
     (case when nullif(trim(coalesce(p.bio,'')),'') is not null then 1 else 0 end)+
     (case when nullif(trim(coalesce(p.display_name,'')),'') is not null then 1 else 0 end)+
     (case when coalesce(a.titles_watched,0)>=1 then 1 else 0 end)+
     (case when coalesce(a.titles_watched,0)>=10 then 1 else 0 end)+
     (case when coalesce(r.ratings_count,0)>=1 then 1 else 0 end)+
     (case when public.resolve_public_top_role(p.user_id,p.username) is not null then 1 else 0 end))::integer as achievements,
    public.resolve_public_top_role(p.user_id,p.username) as top_role
  from public.profiles p
  left join public.user_presence pr on pr.user_id=p.user_id
  left join activity a on a.user_id=p.user_id
  left join watchtime w on w.user_id=p.user_id
  left join ratings r on r.user_id=p.user_id
), scored as (
  select b.*,
    (b.watch_minutes*20 + b.titles_watched*5 + b.ratings_count*10 + b.achievements*25)::bigint as score
  from base b
), ranked as (
  select s.*,
    row_number() over(order by s.score desc,s.watch_minutes desc,s.titles_watched desc,lower(s.username)) as rank_no
  from scored s
)
select r.rank_no,r.user_id,r.username,r.display_name,r.avatar_url,r.last_seen_at,r.online,
  r.titles_watched,r.watch_minutes,r.ratings_count,r.achievements,r.score,r.top_role,
  (select count(*)::bigint from ranked)
from ranked r
order by r.rank_no
limit greatest(1,least(coalesce(p_page_size,25),100))
offset (greatest(coalesce(p_page,1),1)-1)*greatest(1,least(coalesce(p_page_size,25),100));
$$;

grant execute on function public.get_public_leaderboard(integer,integer,text) to anon,authenticated;
notify pgrst,'reload schema';
