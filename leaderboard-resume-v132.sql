-- Flix2Watch v132 — leaderboard sorting/XP + cross-device playback resume
-- Run after the previous SQL migrations.

create table if not exists public.user_playback_progress_v132 (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('movie','tv')),
  media_id bigint not null check (media_id > 0),
  season integer not null default 1 check (season > 0),
  episode integer not null default 1 check (episode > 0),
  position_seconds integer not null default 0 check (position_seconds >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  updated_at timestamptz not null default now(),
  primary key(user_id,media_type,media_id,season,episode)
);
create index if not exists user_playback_progress_v132_recent_idx
  on public.user_playback_progress_v132(user_id,updated_at desc);
alter table public.user_playback_progress_v132 enable row level security;
revoke all on public.user_playback_progress_v132 from anon,authenticated;

create or replace function public.get_my_playback_progress_v132(
  p_media_type text,p_media_id bigint,p_season integer default 1,p_episode integer default 1
) returns table(position_seconds integer,duration_seconds integer,updated_at timestamptz)
language sql security definer stable set search_path=public as $$
  select x.position_seconds,x.duration_seconds,x.updated_at
  from public.user_playback_progress_v132 x
  where x.user_id=auth.uid()
    and x.media_type=case when lower(p_media_type)='tv' then 'tv' else 'movie' end
    and x.media_id=p_media_id
    and x.season=greatest(coalesce(p_season,1),1)
    and x.episode=greatest(coalesce(p_episode,1),1)
  limit 1;
$$;
grant execute on function public.get_my_playback_progress_v132(text,bigint,integer,integer) to authenticated;

create or replace function public.save_my_playback_progress_v132(
  p_media_type text,p_media_id bigint,p_season integer default 1,p_episode integer default 1,
  p_position_seconds integer default 0,p_duration_seconds integer default 0,p_completed boolean default false
) returns void
language plpgsql security definer set search_path=public as $$
declare v_me uuid:=auth.uid(); v_type text:=case when lower(p_media_type)='tv' then 'tv' else 'movie' end;
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if p_media_id is null or p_media_id<=0 then raise exception 'Invalid media id'; end if;
  if coalesce(p_completed,false) then
    delete from public.user_playback_progress_v132 where user_id=v_me and media_type=v_type and media_id=p_media_id
      and season=greatest(coalesce(p_season,1),1) and episode=greatest(coalesce(p_episode,1),1);
    return;
  end if;
  insert into public.user_playback_progress_v132(user_id,media_type,media_id,season,episode,position_seconds,duration_seconds,updated_at)
  values(v_me,v_type,p_media_id,greatest(coalesce(p_season,1),1),greatest(coalesce(p_episode,1),1),greatest(coalesce(p_position_seconds,0),0),greatest(coalesce(p_duration_seconds,0),0),now())
  on conflict(user_id,media_type,media_id,season,episode) do update set
    position_seconds=excluded.position_seconds,duration_seconds=excluded.duration_seconds,updated_at=now();
end;
$$;
grant execute on function public.save_my_playback_progress_v132(text,bigint,integer,integer,integer,integer,boolean) to authenticated;

create or replace function public.clear_my_playback_progress_v132(
  p_media_type text,p_media_id bigint,p_season integer default 1,p_episode integer default 1
) returns void
language sql security definer set search_path=public as $$
  delete from public.user_playback_progress_v132
  where user_id=auth.uid() and media_type=case when lower(p_media_type)='tv' then 'tv' else 'movie' end
    and media_id=p_media_id and season=greatest(coalesce(p_season,1),1) and episode=greatest(coalesce(p_episode,1),1);
$$;
grant execute on function public.clear_my_playback_progress_v132(text,bigint,integer,integer) to authenticated;

-- Watch time is the dominant XP source. Sorting tabs use their selected metric first,
-- then XP as the tie-breaker.
create or replace function public.get_public_leaderboard(
  p_page integer default 1,p_page_size integer default 25,p_sort text default 'overall'
)
returns table(
  rank_no bigint,user_id uuid,username text,display_name text,avatar_url text,last_seen_at timestamptz,
  online boolean,titles_watched bigint,watch_minutes bigint,ratings_count bigint,achievements integer,
  score bigint,top_role text,total_count bigint
)
language sql security definer stable set search_path=public as $$
with activity as (
  select a.user_id,count(*)::bigint titles_watched from public.profile_title_activity a group by a.user_id
), watchtime as (
  select w.user_id,floor(sum(greatest(w.seconds,0))/60.0)::bigint watch_minutes from public.profile_watch_time w group by w.user_id
), ratings as (
  select r.user_id,count(*)::bigint ratings_count from public.user_ratings r group by r.user_id
), base as (
  select p.user_id,p.username,p.display_name,p.avatar_url,pr.last_seen_at,coalesce(pr.online_until>now(),false) online,
    coalesce(a.titles_watched,0)::bigint titles_watched,coalesce(w.watch_minutes,0)::bigint watch_minutes,
    coalesce(r.ratings_count,0)::bigint ratings_count,
    ((case when nullif(trim(coalesce(p.avatar_url,'')),'') is not null then 1 else 0 end)+
     (case when nullif(trim(coalesce(p.bio,'')),'') is not null then 1 else 0 end)+
     (case when nullif(trim(coalesce(p.display_name,'')),'') is not null then 1 else 0 end)+
     (case when coalesce(a.titles_watched,0)>=1 then 1 else 0 end)+
     (case when coalesce(a.titles_watched,0)>=10 then 1 else 0 end)+
     (case when coalesce(r.ratings_count,0)>=1 then 1 else 0 end)+
     (case when public.resolve_public_top_role(p.user_id,p.username) is not null then 1 else 0 end))::integer achievements,
    public.resolve_public_top_role(p.user_id,p.username) top_role
  from public.profiles p
  left join public.user_presence pr on pr.user_id=p.user_id
  left join activity a on a.user_id=p.user_id left join watchtime w on w.user_id=p.user_id left join ratings r on r.user_id=p.user_id
), scored as (
  -- 20 XP/minute watched; all other actions are deliberately secondary.
  select b.*,(b.watch_minutes*20 + b.titles_watched*5 + b.ratings_count*10 + b.achievements*25)::bigint score from base b
), ranked as (
  select s.*,row_number() over(order by
    case when lower(coalesce(p_sort,'overall'))='titles' then s.titles_watched end desc nulls last,
    case when lower(coalesce(p_sort,'overall'))='watch' then s.watch_minutes end desc nulls last,
    case when lower(coalesce(p_sort,'overall'))='ratings' then s.ratings_count end desc nulls last,
    case when lower(coalesce(p_sort,'overall'))='achievements' then s.achievements end desc nulls last,
    s.score desc,lower(s.username)) rank_no
  from scored s
)
select r.rank_no,r.user_id,r.username,r.display_name,r.avatar_url,r.last_seen_at,r.online,
  r.titles_watched,r.watch_minutes,r.ratings_count,r.achievements,r.score,r.top_role,(select count(*)::bigint from ranked)
from ranked r order by r.rank_no
limit greatest(1,least(coalesce(p_page_size,25),100))
offset (greatest(coalesce(p_page,1),1)-1)*greatest(1,least(coalesce(p_page_size,25),100));
$$;
grant execute on function public.get_public_leaderboard(integer,integer,text) to anon,authenticated;

notify pgrst,'reload schema';
