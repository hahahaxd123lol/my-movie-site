-- ============================================================
-- FLIX2WATCH v59 — RECENTLY WATCHED / VIEWED
-- Clean independent table: no dependency on old profile_title_activity schema.
--
-- Behaviour:
--   * logged-in user must stay on a Watch title for 5+ visible seconds
--     (the 5-second timing is enforced by the frontend before this RPC)
--   * one row per user/title
--   * only latest 10 unique titles are retained per account
--   * reopening an old title moves it back to the top
-- ============================================================

create table if not exists public.profile_recent_views_v59 (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check (media_type in ('movie','tv')),
  media_id bigint not null,
  title text,
  poster_path text,
  viewed_at timestamptz not null default now(),
  primary key(user_id,media_type,media_id)
);

create index if not exists profile_recent_views_v59_user_viewed_idx
  on public.profile_recent_views_v59(user_id,viewed_at desc);

-- Do not expose direct writes. Frontend writes through SECURITY DEFINER RPC.
alter table public.profile_recent_views_v59 enable row level security;
revoke all on table public.profile_recent_views_v59 from anon,authenticated;

create or replace function public.record_recent_view_v59(
  p_media_type text,
  p_media_id bigint,
  p_title text default null,
  p_poster_path text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_type text:=case when lower(trim(coalesce(p_media_type,'')))='tv' then 'tv' else 'movie' end;
begin
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  if p_media_id is null or p_media_id<=0 then
    raise exception 'Invalid title';
  end if;

  insert into public.profile_recent_views_v59(
    user_id,media_type,media_id,title,poster_path,viewed_at
  )
  values(
    v_me,
    v_type,
    p_media_id,
    nullif(left(trim(coalesce(p_title,'')),250),''),
    nullif(left(trim(coalesce(p_poster_path,'')),500),''),
    now()
  )
  on conflict(user_id,media_type,media_id) do update
  set title=coalesce(excluded.title,public.profile_recent_views_v59.title),
      poster_path=coalesce(excluded.poster_path,public.profile_recent_views_v59.poster_path),
      viewed_at=excluded.viewed_at;

  -- Hard storage cap: exactly the newest 10 unique titles per user.
  delete from public.profile_recent_views_v59 r
  where r.user_id=v_me
    and exists (
      select 1
      from (
        select media_type,media_id,
               row_number() over(order by viewed_at desc,media_type,media_id) as rn
        from public.profile_recent_views_v59
        where user_id=v_me
      ) ranked
      where ranked.rn>10
        and ranked.media_type=r.media_type
        and ranked.media_id=r.media_id
    );
end;
$$;

revoke all on function public.record_recent_view_v59(text,bigint,text,text) from public;
grant execute on function public.record_recent_view_v59(text,bigint,text,text) to authenticated;

create or replace function public.get_profile_recent_views_v59(
  p_user_id uuid,
  p_limit integer default 10
)
returns table(
  media_type text,
  media_id bigint,
  title text,
  poster_path text,
  viewed_at timestamptz
)
language plpgsql
security definer
stable
set search_path=public
as $$
declare
  v_private boolean:=false;
begin
  if p_user_id is null then
    return;
  end if;

  select coalesce(p.is_private,false)
    into v_private
  from public.profiles p
  where p.user_id=p_user_id;

  if v_private and auth.uid() is distinct from p_user_id then
    return;
  end if;

  return query
  select
    r.media_type,
    r.media_id,
    r.title,
    r.poster_path,
    r.viewed_at
  from public.profile_recent_views_v59 r
  where r.user_id=p_user_id
  order by r.viewed_at desc
  limit greatest(1,least(coalesce(p_limit,10),10));
end;
$$;

revoke all on function public.get_profile_recent_views_v59(uuid,integer) from public;
grant execute on function public.get_profile_recent_views_v59(uuid,integer) to anon,authenticated;

-- Realtime profile updates.
do $$
begin
  begin
    alter publication supabase_realtime add table public.profile_recent_views_v59;
  exception
    when duplicate_object then null;
  end;
end $$;

notify pgrst,'reload schema';

-- f2w-force-save:recent-views-v59:1788221542
 