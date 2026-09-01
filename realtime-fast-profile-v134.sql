-- ============================================================
-- FLIX2WATCH v134 — INSTANT PROFILE REALTIME SNAPSHOT
-- Run once in Supabase SQL Editor after previous migrations.
-- Safe to re-run.
-- ============================================================

-- Keep the public profile membership timestamp authoritative. This also repairs
-- old profile rows whose created_at was the profile-row date instead of the
-- actual Supabase account creation date.
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

-- One small indexed request supplies the profile header data that must feel
-- instant: true member-since time, online/last-online state, and current title.
-- This avoids serial RPCs and removes the long "1MO" -> correct-age delay.
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

-- Realtime publications are best-effort/idempotent. The website still has the
-- 30-second fallback, but changes normally arrive immediately.
do $$
begin
  begin alter publication supabase_realtime add table public.user_presence; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.current_watching_v125; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
end $$;

create index if not exists profiles_username_lower_v134_idx on public.profiles (lower(username));
create index if not exists user_presence_user_v134_idx on public.user_presence (user_id);
create index if not exists current_watching_user_v134_idx on public.current_watching_v125 (user_id);
