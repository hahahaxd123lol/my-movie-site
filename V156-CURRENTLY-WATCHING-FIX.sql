-- FLIX2WATCH v156 — CURRENTLY WATCHING LEASE / EXIT CLEAR
-- Run once in Supabase SQL Editor. Safe after v130/v134/v136.

create or replace function public.clear_current_watching_v156()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  delete from public.current_watching_v125 where user_id=auth.uid();
end
$$;
grant execute on function public.clear_current_watching_v156() to authenticated;

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
    and w.last_seen_at > clock_timestamp()-interval '70 seconds'
    and (coalesce(p.is_private,false)=false or auth.uid()=p.user_id)
  order by w.last_seen_at desc
  limit 1
$$;
grant execute on function public.get_public_current_watching_v125(text) to anon,authenticated;

create or replace function public.get_public_profile_live_v134(p_username text)
returns table(
  user_id uuid, username text, member_since timestamptz, last_seen_at timestamptz, online_until timestamptz,
  watching_media_type text, watching_media_id bigint, watching_title text, watching_poster_path text, watching_last_seen_at timestamptz
)
language sql
security definer
stable
set search_path=public,auth
as $$
  select p.user_id,p.username,u.created_at,up.last_seen_at,up.online_until,
    case when cw.last_seen_at > clock_timestamp()-interval '70 seconds' and (coalesce(p.is_private,false)=false or auth.uid()=p.user_id) then cw.media_type else null end,
    case when cw.last_seen_at > clock_timestamp()-interval '70 seconds' and (coalesce(p.is_private,false)=false or auth.uid()=p.user_id) then cw.media_id else null end,
    case when cw.last_seen_at > clock_timestamp()-interval '70 seconds' and (coalesce(p.is_private,false)=false or auth.uid()=p.user_id) then cw.title else null end,
    case when cw.last_seen_at > clock_timestamp()-interval '70 seconds' and (coalesce(p.is_private,false)=false or auth.uid()=p.user_id) then cw.poster_path else null end,
    case when cw.last_seen_at > clock_timestamp()-interval '70 seconds' and (coalesce(p.is_private,false)=false or auth.uid()=p.user_id) then cw.last_seen_at else null end
  from public.profiles p
  join auth.users u on u.id=p.user_id
  left join public.user_presence up on up.user_id=p.user_id
  left join public.current_watching_v125 cw on cw.user_id=p.user_id
  where lower(p.username)=lower(trim(coalesce(p_username,'')))
  limit 1
$$;
grant execute on function public.get_public_profile_live_v134(text) to anon,authenticated;

-- Remove rows that are already stale so existing profiles correct immediately.
delete from public.current_watching_v125 where last_seen_at < clock_timestamp()-interval '70 seconds';
