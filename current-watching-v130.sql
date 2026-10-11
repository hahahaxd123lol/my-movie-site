-- FLIX2WATCH v130 — CURRENTLY WATCHING RELIABILITY
-- Run after the older v125/v126/v129 SQL files.

create table if not exists public.current_watching_v125(
  user_id uuid primary key references auth.users(id) on delete cascade,
  media_type text not null,
  media_id bigint not null,
  title text not null,
  poster_path text,
  last_seen_at timestamptz not null default clock_timestamp()
);

create index if not exists current_watching_v125_seen_idx
  on public.current_watching_v125(last_seen_at desc);

alter table public.current_watching_v125 enable row level security;
revoke all on table public.current_watching_v125 from anon, authenticated;

-- Security-definer heartbeat: signed-in users may only touch their own row.
create or replace function public.touch_current_watching_v125(
  p_media_type text,
  p_media_id bigint,
  p_title text,
  p_poster_path text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid := auth.uid();
  v_type text := lower(trim(coalesce(p_media_type,'')));
  v_title text := left(trim(coalesce(p_title,'')),250);
begin
  if v_me is null then
    raise exception 'Authentication required';
  end if;
  if v_type not in ('movie','tv') then raise exception 'Invalid media type'; end if;
  if p_media_id is null or p_media_id <= 0 then raise exception 'Invalid media id'; end if;
  if v_title = '' then raise exception 'Title required'; end if;

  insert into public.current_watching_v125(user_id,media_type,media_id,title,poster_path,last_seen_at)
  values(v_me,v_type,p_media_id,v_title,nullif(trim(coalesce(p_poster_path,'')),''),clock_timestamp())
  on conflict(user_id) do update set
    media_type=excluded.media_type,
    media_id=excluded.media_id,
    title=excluded.title,
    poster_path=excluded.poster_path,
    last_seen_at=clock_timestamp();
end
$$;

grant execute on function public.touch_current_watching_v125(text,bigint,text,text) to authenticated;

-- Public profile reader. The 95s window comfortably covers a 30s heartbeat
-- through a sleeping/busy browser without leaving stale activity around long-term.
create or replace function public.get_public_current_watching_v125(p_username text)
returns table(media_type text,media_id bigint,title text,poster_path text,last_seen_at timestamptz)
language sql
security definer
stable
set search_path=public
as $$
  select w.media_type,w.media_id,w.title,w.poster_path,w.last_seen_at
  from public.current_watching_v125 w
  join public.profiles p on p.user_id=w.user_id
  where lower(p.username)=lower(trim(coalesce(p_username,'')))
    and w.last_seen_at > clock_timestamp()-interval '95 seconds'
    and (coalesce(p.is_private,false)=false or auth.uid()=p.user_id)
  order by w.last_seen_at desc
  limit 1
$$;

grant execute on function public.get_public_current_watching_v125(text) to anon,authenticated;
