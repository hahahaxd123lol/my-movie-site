-- Flix2Watch v177: low-write realtime playback state.
-- One RPC per active viewer about every 30 seconds updates watch credit and the public playback snapshot.

alter table if exists public.current_watching_v125 add column if not exists source_key text;
alter table if exists public.current_watching_v125 add column if not exists position_seconds integer;
alter table if exists public.current_watching_v125 add column if not exists duration_seconds integer;
alter table if exists public.current_watching_v125 add column if not exists playback_status text;
alter table if exists public.current_watching_v125 add column if not exists progress_updated_at timestamptz;
create index if not exists current_watching_v125_live_idx on public.current_watching_v125(last_seen_at desc);

create or replace function public.touch_playback_session_v177(
  p_media_type text,
  p_media_id bigint,
  p_title text,
  p_poster_path text default null,
  p_source_key text default null,
  p_position_seconds integer default null,
  p_duration_seconds integer default null,
  p_playback_status text default 'active',
  p_watch_seconds integer default 30
) returns void
language plpgsql security definer set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_type text:=case when lower(coalesce(p_media_type,''))='tv' then 'tv' else 'movie' end;
  v_add integer:=greatest(0,least(coalesce(p_watch_seconds,0),45));
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if p_media_id is null or p_media_id<=0 then raise exception 'Invalid title'; end if;

  insert into public.current_watching_v125(user_id,media_type,media_id,title,poster_path,last_seen_at,source_key,position_seconds,duration_seconds,playback_status,progress_updated_at)
  values(v_me,v_type,p_media_id,left(coalesce(nullif(trim(p_title),''),'Untitled'),250),p_poster_path,now(),left(p_source_key,80),
    case when p_position_seconds is null then null else greatest(0,p_position_seconds) end,
    case when p_duration_seconds is null then null else greatest(0,p_duration_seconds) end,
    left(coalesce(p_playback_status,'active'),32),case when p_position_seconds is null then null else now() end)
  on conflict(user_id) do update set
    media_type=excluded.media_type,media_id=excluded.media_id,title=excluded.title,poster_path=excluded.poster_path,last_seen_at=now(),source_key=excluded.source_key,
    position_seconds=coalesce(excluded.position_seconds,public.current_watching_v125.position_seconds),
    duration_seconds=coalesce(excluded.duration_seconds,public.current_watching_v125.duration_seconds),
    playback_status=excluded.playback_status,
    progress_updated_at=case when excluded.position_seconds is null then public.current_watching_v125.progress_updated_at else now() end;

  if v_add>0 then
    insert into public.profile_watch_time(user_id,media_type,media_id,seconds,updated_at)
    values(v_me,v_type,p_media_id,v_add,now())
    on conflict(user_id,media_type,media_id) do update set seconds=public.profile_watch_time.seconds+v_add,updated_at=now();
  end if;
end;
$$;
grant execute on function public.touch_playback_session_v177(text,bigint,text,text,text,integer,integer,text,integer) to authenticated;

create or replace function public.get_public_current_watching_v177(p_username text)
returns table(user_id uuid,media_type text,media_id bigint,title text,poster_path text,last_seen_at timestamptz,source_key text,position_seconds integer,duration_seconds integer,playback_status text,progress_updated_at timestamptz)
language sql security definer stable set search_path=public
as $$
  select c.user_id,c.media_type,c.media_id,c.title,c.poster_path,c.last_seen_at,c.source_key,c.position_seconds,c.duration_seconds,c.playback_status,c.progress_updated_at
  from public.current_watching_v125 c join public.profiles p on p.user_id=c.user_id
  where lower(p.username)=lower(trim(p_username)) and c.last_seen_at>clock_timestamp()-interval '75 seconds'
    and (coalesce(p.is_private,false)=false or auth.uid()=p.user_id)
  limit 1;
$$;
grant execute on function public.get_public_current_watching_v177(text) to anon,authenticated;
