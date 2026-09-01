-- ============================================================
-- FLIX2WATCH v134 — INSTANT PROFILE REALTIME SNAPSHOT (FIXED v136)
-- Safe to re-run. This corrected copy now creates the Current Watching
-- prerequisite before get_public_profile_live_v134 references it.
-- ============================================================

-- Prerequisite used by the live profile snapshot and watch-page heartbeat.
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
revoke all on table public.current_watching_v125 from anon,authenticated;

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
  if v_me is null then raise exception 'Authentication required'; end if;
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

-- Presence table is also required by the one-shot profile snapshot. Creating it
-- here makes this migration tolerant of installs where the older presence SQL
-- was only partially applied.
create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_presence add column if not exists online_until timestamptz;

-- Repair member-since values to the real Supabase account creation timestamp.
update public.profiles p
set created_at = u.created_at
from auth.users u
where p.user_id = u.id
  and p.created_at is distinct from u.created_at;

create or replace function public.f2w_keep_true_member_created_at_v134()
returns trigger
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_created timestamptz;
begin
  select created_at into v_created from auth.users where id=new.user_id;
  if v_created is not null then new.created_at:=v_created; end if;
  return new;
end $$;

drop trigger if exists f2w_true_member_created_at_v129 on public.profiles;
drop trigger if exists f2w_true_member_created_at_v134 on public.profiles;
create trigger f2w_true_member_created_at_v134
before insert or update of created_at on public.profiles
for each row execute function public.f2w_keep_true_member_created_at_v134();

create or replace function public.get_public_profile_live_v134(p_username text)
returns table(
  user_id uuid,
  username text,
  member_since timestamptz,
  last_seen_at timestamptz,
  online_until timestamptz,
  watching_media_type text,
  watching_media_id bigint,
  watching_title text,
  watching_poster_path text,
  watching_last_seen_at timestamptz
)
language sql
security definer
stable
set search_path=public,auth
as $$
  select
    p.user_id,
    p.username,
    u.created_at as member_since,
    up.last_seen_at,
    up.online_until,
    case when cw.last_seen_at > clock_timestamp()-interval '95 seconds'
           and (coalesce(p.is_private,false)=false or auth.uid()=p.user_id)
         then cw.media_type else null end,
    case when cw.last_seen_at > clock_timestamp()-interval '95 seconds'
           and (coalesce(p.is_private,false)=false or auth.uid()=p.user_id)
         then cw.media_id else null end,
    case when cw.last_seen_at > clock_timestamp()-interval '95 seconds'
           and (coalesce(p.is_private,false)=false or auth.uid()=p.user_id)
         then cw.title else null end,
    case when cw.last_seen_at > clock_timestamp()-interval '95 seconds'
           and (coalesce(p.is_private,false)=false or auth.uid()=p.user_id)
         then cw.poster_path else null end,
    case when cw.last_seen_at > clock_timestamp()-interval '95 seconds'
           and (coalesce(p.is_private,false)=false or auth.uid()=p.user_id)
         then cw.last_seen_at else null end
  from public.profiles p
  join auth.users u on u.id=p.user_id
  left join public.user_presence up on up.user_id=p.user_id
  left join public.current_watching_v125 cw on cw.user_id=p.user_id
  where lower(p.username)=lower(trim(coalesce(p_username,'')))
  limit 1
$$;
grant execute on function public.get_public_profile_live_v134(text) to anon,authenticated;

-- Best-effort publication setup. Duplicate membership is harmless.
do $$
begin
  begin alter publication supabase_realtime add table public.user_presence; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.current_watching_v125; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
end $$;

create index if not exists profiles_username_lower_v134_idx on public.profiles (lower(username));
create index if not exists user_presence_user_v134_idx on public.user_presence (user_id);
create index if not exists current_watching_user_v134_idx on public.current_watching_v125 (user_id);
