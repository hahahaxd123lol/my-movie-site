
-- ================================================================
-- FLIX2WATCH REALTIME LEADERBOARD + PROFILE SOCIAL v17
-- RUN THIS WHOLE FILE ONCE IN SUPABASE -> SQL EDITOR.
-- Safe to run again.
-- ================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------
-- 1) REMOVE PUBLIC "ADMIN" ROLE COMPLETELY
--    Staff is the operational staff identity now.
-- ------------------------------------------------
delete from public.profile_role_assignments where lower(role_key)='admin';

alter table public.profile_role_assignments
  drop constraint if exists profile_role_assignments_role_key_check;

alter table public.profile_role_assignments
  add constraint profile_role_assignments_role_key_check
  check (role_key in (
    'moderator',
    'curator',
    'support',
    'developer',
    'verified',
    'contributor'
  ));

-- ------------------------------------------------
-- 2) RICHER PROFILE FIELDS
-- ------------------------------------------------
alter table public.profiles
  add column if not exists location text,
  add column if not exists favorite_genres text[] not null default '{}'::text[],
  add column if not exists website_url text,
  add column if not exists instagram_username text,
  add column if not exists discord_username text,
  add column if not exists profile_accent text not null default 'red',
  add column if not exists status_text text,
  add column if not exists pronouns text,
  add column if not exists profile_banner_url text,
  add column if not exists favorite_movie_text text,
  add column if not exists favorite_tv_text text,
  add column if not exists profile_quote text;

create or replace function public.update_my_profile_v17(
  p_display_name text default null,
  p_bio text default null,
  p_avatar_url text default null,
  p_is_private boolean default false,
  p_location text default null,
  p_favorite_genres text[] default '{}'::text[],
  p_website_url text default null,
  p_instagram_username text default null,
  p_discord_username text default null,
  p_profile_accent text default 'red',
  p_status_text text default null,
  p_pronouns text default null,
  p_profile_banner_url text default null,
  p_favorite_movie_text text default null,
  p_favorite_tv_text text default null,
  p_profile_quote text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_result jsonb;
  v_avatar text:=nullif(left(trim(coalesce(p_avatar_url,'')),2048),'');
  v_banner text:=nullif(left(trim(coalesce(p_profile_banner_url,'')),2048),'');
  v_site text:=nullif(left(trim(coalesce(p_website_url,'')),2048),'');
  v_accent text:=lower(coalesce(p_profile_accent,'red'));
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if public.account_is_banned(v_me) then raise exception 'Suspended accounts cannot edit profiles'; end if;

  if v_avatar is not null and v_avatar !~* '^https://' and v_avatar !~* '^data:image/' then
    raise exception 'Avatar URL must use HTTPS';
  end if;
  if v_banner is not null and v_banner !~* '^https://' and v_banner !~* '^data:image/' then
    raise exception 'Banner URL must use HTTPS';
  end if;
  if v_site is not null and v_site !~* '^https://' then
    raise exception 'Website URL must use HTTPS';
  end if;
  if v_accent not in ('red','purple','blue','green','gold') then v_accent:='red'; end if;

  update public.profiles
  set display_name=nullif(left(trim(coalesce(p_display_name,'')),50),''),
      bio=nullif(left(trim(coalesce(p_bio,'')),500),''),
      avatar_url=v_avatar,
      is_private=coalesce(p_is_private,false),
      location=nullif(left(trim(coalesce(p_location,'')),80),''),
      favorite_genres=(
        select coalesce(array_agg(left(trim(g),40)),'{}'::text[])
        from unnest((coalesce(p_favorite_genres,'{}'::text[]))[1:12]) as g
        where trim(g)<>''
      ),
      website_url=v_site,
      instagram_username=nullif(left(trim(coalesce(p_instagram_username,'')),80),''),
      discord_username=nullif(left(trim(coalesce(p_discord_username,'')),80),''),
      profile_accent=v_accent,
      status_text=nullif(left(trim(coalesce(p_status_text,'')),80),''),
      pronouns=nullif(left(trim(coalesce(p_pronouns,'')),40),''),
      profile_banner_url=v_banner,
      favorite_movie_text=nullif(left(trim(coalesce(p_favorite_movie_text,'')),100),''),
      favorite_tv_text=nullif(left(trim(coalesce(p_favorite_tv_text,'')),100),''),
      profile_quote=nullif(left(trim(coalesce(p_profile_quote,'')),180),''),
      updated_at=now()
  where user_id=v_me;

  select to_jsonb(p) into v_result from public.profiles p where p.user_id=v_me;
  return v_result;
end;
$$;
grant execute on function public.update_my_profile_v17(
  text,text,text,boolean,text,text[],text,text,text,text,text,text,text,text,text,text
) to authenticated;

-- ------------------------------------------------
-- 3) SESSION-AWARE REALTIME PRESENCE
--    Multiple tabs/devices are handled independently.
-- ------------------------------------------------
create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_presence
  add column if not exists online_until timestamptz;

create table if not exists public.user_presence_sessions (
  session_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint user_presence_sessions_id_len check(char_length(session_id) between 8 and 160)
);
create index if not exists user_presence_sessions_user_idx
  on public.user_presence_sessions(user_id,last_seen_at desc);

alter table public.user_presence enable row level security;
alter table public.user_presence_sessions enable row level security;

drop policy if exists "Presence public read v35" on public.user_presence;
drop policy if exists "Leaderboard presence public read" on public.user_presence;
drop policy if exists "Presence public read v17" on public.user_presence;
create policy "Presence public read v17"
on public.user_presence for select using(true);

revoke insert,update,delete on public.user_presence from anon,authenticated;
revoke all on public.user_presence_sessions from anon,authenticated;
grant select on public.user_presence to anon,authenticated;

create or replace function public.touch_presence_v17(p_session_id text)
returns timestamptz
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_now timestamptz:=now();
  v_sid text:=left(trim(coalesce(p_session_id,'')),160);
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if char_length(v_sid)<8 then raise exception 'Invalid presence session'; end if;

  delete from public.user_presence_sessions
  where last_seen_at < v_now - interval '7 days';

  insert into public.user_presence_sessions(session_id,user_id,last_seen_at)
  values(v_sid,v_me,v_now)
  on conflict(session_id) do update
    set user_id=excluded.user_id,
        last_seen_at=excluded.last_seen_at;

  insert into public.user_presence(user_id,last_seen_at,updated_at,online_until)
  values(v_me,v_now,v_now,v_now+interval '45 seconds')
  on conflict(user_id) do update
    set last_seen_at=greatest(public.user_presence.last_seen_at,excluded.last_seen_at),
        updated_at=v_now,
        online_until=v_now+interval '45 seconds';

  return v_now;
end;
$$;
grant execute on function public.touch_presence_v17(text) to authenticated;

create or replace function public.leave_presence_v17(p_session_id text)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_now timestamptz:=now();
  v_sid text:=left(trim(coalesce(p_session_id,'')),160);
  v_other timestamptz;
begin
  if v_me is null or char_length(v_sid)<8 then return; end if;

  delete from public.user_presence_sessions
  where session_id=v_sid and user_id=v_me;

  select max(last_seen_at)
    into v_other
  from public.user_presence_sessions
  where user_id=v_me
    and last_seen_at > v_now - interval '45 seconds';

  if v_other is null then
    insert into public.user_presence(user_id,last_seen_at,updated_at,online_until)
    values(v_me,v_now,v_now,v_now)
    on conflict(user_id) do update
      set last_seen_at=v_now,
          updated_at=v_now,
          online_until=v_now;
  else
    update public.user_presence
    set last_seen_at=greatest(last_seen_at,v_other),
        updated_at=v_now,
        online_until=v_other+interval '45 seconds'
    where user_id=v_me;
  end if;
end;
$$;
grant execute on function public.leave_presence_v17(text) to authenticated;

-- Backwards compatible touch function used by older pages.
create or replace function public.touch_presence()
returns timestamptz
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_now timestamptz:=now();
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  insert into public.user_presence(user_id,last_seen_at,updated_at,online_until)
  values(v_me,v_now,v_now,v_now+interval '45 seconds')
  on conflict(user_id) do update
    set last_seen_at=v_now,
        updated_at=v_now,
        online_until=v_now+interval '45 seconds';
  return v_now;
end;
$$;
grant execute on function public.touch_presence() to authenticated;

create or replace function public.get_public_profile_presence(p_user_id uuid)
returns table(online boolean,last_seen_at timestamptz)
language sql
security definer
stable
set search_path=public
as $$
  select
    coalesce(up.online_until>now(),false) as online,
    up.last_seen_at
  from public.user_presence up
  where up.user_id=p_user_id
  union all
  select false,null::timestamptz
  where not exists(select 1 from public.user_presence x where x.user_id=p_user_id)
  limit 1;
$$;
grant execute on function public.get_public_profile_presence(uuid) to anon,authenticated;

-- ------------------------------------------------
-- 4) TITLE CLICKS + ACTIVE WATCH TIME
-- ------------------------------------------------
create table if not exists public.profile_title_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check(media_type in ('movie','tv')),
  media_id bigint not null,
  title text not null,
  poster_path text,
  first_opened_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  open_count integer not null default 1 check(open_count>0),
  primary key(user_id,media_type,media_id)
);

create table if not exists public.profile_watch_time (
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null check(media_type in ('movie','tv')),
  media_id bigint not null,
  seconds bigint not null default 0 check(seconds>=0),
  updated_at timestamptz not null default now(),
  primary key(user_id,media_type,media_id)
);

alter table public.profile_title_activity enable row level security;
alter table public.profile_watch_time enable row level security;

drop policy if exists "Activity privacy read v35" on public.profile_title_activity;
create policy "Activity privacy read v17" on public.profile_title_activity
for select using(
  auth.uid()=user_id
  or exists(
    select 1 from public.profiles p
    where p.user_id=profile_title_activity.user_id
      and coalesce(p.is_private,false)=false
  )
);
grant select on public.profile_title_activity to anon,authenticated;

drop policy if exists "Watch time own read v35" on public.profile_watch_time;
create policy "Watch time own read v17" on public.profile_watch_time
for select to authenticated using(auth.uid()=user_id);
grant select on public.profile_watch_time to authenticated;

revoke insert,update,delete on public.profile_title_activity from anon,authenticated;
revoke insert,update,delete on public.profile_watch_time from anon,authenticated;

create or replace function public.record_title_open(
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
  v_me uuid:=auth.uid();
  v_type text:=lower(trim(coalesce(p_media_type,'')));
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if public.account_is_banned(v_me) then raise exception 'Account suspended'; end if;
  if v_type not in ('movie','tv') or p_media_id is null or p_media_id<=0 then
    raise exception 'Invalid title';
  end if;

  insert into public.profile_title_activity(
    user_id,media_type,media_id,title,poster_path
  )
  values(
    v_me,v_type,p_media_id,
    left(coalesce(nullif(trim(p_title),''),'Untitled'),250),
    nullif(left(trim(coalesce(p_poster_path,'')),300),'')
  )
  on conflict(user_id,media_type,media_id) do update
  set title=excluded.title,
      poster_path=coalesce(excluded.poster_path,public.profile_title_activity.poster_path),
      last_opened_at=now(),
      open_count=public.profile_title_activity.open_count+1;
end;
$$;
grant execute on function public.record_title_open(text,bigint,text,text) to authenticated;

create or replace function public.add_watch_seconds(
  p_media_type text,
  p_media_id bigint,
  p_seconds integer default 15
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_type text:=lower(trim(coalesce(p_media_type,'')));
  v_add integer:=greatest(1,least(coalesce(p_seconds,15),30));
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if public.account_is_banned(v_me) then raise exception 'Account suspended'; end if;
  if v_type not in ('movie','tv') or p_media_id is null or p_media_id<=0 then
    raise exception 'Invalid title';
  end if;

  insert into public.profile_watch_time(user_id,media_type,media_id,seconds,updated_at)
  values(v_me,v_type,p_media_id,v_add,now())
  on conflict(user_id,media_type,media_id) do update
    set seconds=public.profile_watch_time.seconds+v_add,
        updated_at=now();
end;
$$;
grant execute on function public.add_watch_seconds(text,bigint,integer) to authenticated;

-- ------------------------------------------------
-- 5) PROFILE COMMENTS (Steam-style wall)
-- ------------------------------------------------
create table if not exists public.profile_comments (
  id uuid primary key default gen_random_uuid(),
  profile_user_id uuid not null references auth.users(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check(char_length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profile_comments_target_idx
  on public.profile_comments(profile_user_id,created_at desc);
create index if not exists profile_comments_author_idx
  on public.profile_comments(author_user_id,created_at desc);

alter table public.profile_comments enable row level security;

drop policy if exists "Profile comments readable v17" on public.profile_comments;
create policy "Profile comments readable v17"
on public.profile_comments for select
using(
  auth.uid()=profile_user_id
  or auth.uid()=author_user_id
  or exists(
    select 1 from public.profiles p
    where p.user_id=profile_comments.profile_user_id
      and coalesce(p.is_private,false)=false
  )
);
grant select on public.profile_comments to anon,authenticated;
revoke insert,update,delete on public.profile_comments from anon,authenticated;

create or replace function public.add_profile_comment_v17(
  p_profile_user_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_body text:=trim(coalesce(p_body,''));
  v_id uuid;
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if public.account_is_banned(v_me) then raise exception 'Account suspended'; end if;
  if p_profile_user_id is null or not exists(select 1 from public.profiles where user_id=p_profile_user_id) then
    raise exception 'Profile not found';
  end if;
  if char_length(v_body)<1 or char_length(v_body)>500 then
    raise exception 'Comment must be between 1 and 500 characters';
  end if;

  insert into public.profile_comments(profile_user_id,author_user_id,body)
  values(p_profile_user_id,v_me,v_body)
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.add_profile_comment_v17(uuid,text) to authenticated;

create or replace function public.delete_profile_comment_v17(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_target uuid;
  v_author uuid;
begin
  if v_me is null then raise exception 'Authentication required'; end if;

  select profile_user_id,author_user_id
    into v_target,v_author
  from public.profile_comments
  where id=p_comment_id;

  if v_target is null then return; end if;

  if v_me<>v_author and v_me<>v_target and v_me<>'f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    raise exception 'Not allowed';
  end if;

  delete from public.profile_comments where id=p_comment_id;
end;
$$;
grant execute on function public.delete_profile_comment_v17(uuid) to authenticated;

-- ------------------------------------------------
-- 6) ONE PUBLIC ROLE RESOLVER, HIGHEST ROLE WINS
-- Owner > Staff > Moderator > Support > Developer >
-- Verified > Contributor > Curator
-- ------------------------------------------------
create or replace function public.resolve_public_top_role(
  p_user_id uuid,
  p_username text
)
returns text
language sql
security definer
stable
set search_path=public
as $$
  select case
    when p_user_id='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then 'owner'
    when exists(
      select 1 from public.chat_moderators m
      where m.user_id=p_user_id
         or (m.user_id is null and lower(m.alias)=lower(coalesce(p_username,'')))
    ) then 'staff'
    when exists(select 1 from public.profile_role_assignments r where r.user_id=p_user_id and r.role_key='moderator') then 'moderator'
    when exists(select 1 from public.profile_role_assignments r where r.user_id=p_user_id and r.role_key='support') then 'support'
    when exists(select 1 from public.profile_role_assignments r where r.user_id=p_user_id and r.role_key='developer') then 'developer'
    when exists(select 1 from public.profile_role_assignments r where r.user_id=p_user_id and r.role_key='verified') then 'verified'
    when exists(select 1 from public.profile_role_assignments r where r.user_id=p_user_id and r.role_key='contributor') then 'contributor'
    when exists(select 1 from public.profile_role_assignments r where r.user_id=p_user_id and r.role_key='curator') then 'curator'
    else null
  end;
$$;
grant execute on function public.resolve_public_top_role(uuid,text) to anon,authenticated;

create or replace function public.get_public_profile_role(target_username text)
returns text
language sql
security definer
stable
set search_path=public
as $$
  select public.resolve_public_top_role(p.user_id,p.username)
  from public.profiles p
  where lower(p.username)=lower(trim(target_username))
  limit 1;
$$;
grant execute on function public.get_public_profile_role(text) to anon,authenticated;

create or replace function public.get_public_name_effects(p_usernames text[])
returns table(username text,top_role text)
language sql
security definer
stable
set search_path=public
as $$
  select p.username,public.resolve_public_top_role(p.user_id,p.username)
  from public.profiles p
  where lower(p.username)=any(
    select lower(trim(x)) from unnest(coalesce(p_usernames,'{}'::text[])) x
  );
$$;
grant execute on function public.get_public_name_effects(text[]) to anon,authenticated;

create or replace function public.get_profile_comments_v17(
  p_profile_user_id uuid,
  p_limit integer default 50
)
returns table(
  id uuid,
  author_user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  top_role text,
  body text,
  created_at timestamptz,
  can_delete boolean
)
language sql
security definer
stable
set search_path=public
as $$
  select
    c.id,
    c.author_user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    public.resolve_public_top_role(p.user_id,p.username) as top_role,
    c.body,
    c.created_at,
    (auth.uid()=c.author_user_id or auth.uid()=c.profile_user_id or auth.uid()='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid) as can_delete
  from public.profile_comments c
  join public.profiles p on p.user_id=c.author_user_id
  join public.profiles target on target.user_id=c.profile_user_id
  where c.profile_user_id=p_profile_user_id
    and (
      coalesce(target.is_private,false)=false
      or auth.uid()=c.profile_user_id
      or auth.uid()=c.author_user_id
    )
  order by c.created_at desc
  limit greatest(1,least(coalesce(p_limit,50),100));
$$;
grant execute on function public.get_profile_comments_v17(uuid,integer) to anon,authenticated;

-- ------------------------------------------------
-- 7) LIVE LEADERBOARD
-- ------------------------------------------------
create or replace function public.get_public_leaderboard_stats()
returns table(
  registered_players bigint,
  online_now bigint,
  combined_watch_minutes bigint
)
language sql
security definer
stable
set search_path=public
as $$
  select
    (select count(*)::bigint from public.profiles),
    (select count(*)::bigint from public.user_presence up where up.online_until>now()),
    coalesce((
      select floor(sum(greatest(w.seconds,0))/60.0)::bigint
      from public.profile_watch_time w
    ),0)::bigint;
$$;
grant execute on function public.get_public_leaderboard_stats() to anon,authenticated;

create or replace function public.get_public_leaderboard(
  p_page integer default 1,
  p_page_size integer default 25,
  p_sort text default 'overall'
)
returns table(
  rank_no bigint,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  last_seen_at timestamptz,
  online boolean,
  titles_watched bigint,
  watch_minutes bigint,
  ratings_count bigint,
  achievements integer,
  score bigint,
  top_role text,
  total_count bigint
)
language sql
security definer
stable
set search_path=public
as $$
with activity as (
  select a.user_id,count(*)::bigint titles_watched
  from public.profile_title_activity a
  group by a.user_id
), watchtime as (
  select w.user_id,floor(sum(w.seconds)/60.0)::bigint watch_minutes
  from public.profile_watch_time w
  group by w.user_id
), ratings as (
  select r.user_id,count(*)::bigint ratings_count
  from public.user_ratings r
  group by r.user_id
), base as (
  select
    p.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    pr.last_seen_at,
    coalesce(pr.online_until>now(),false) as online,
    coalesce(a.titles_watched,0)::bigint titles_watched,
    coalesce(w.watch_minutes,0)::bigint watch_minutes,
    coalesce(r.ratings_count,0)::bigint ratings_count,
    (
      (case when nullif(trim(coalesce(p.avatar_url,'')),'') is not null then 1 else 0 end)+
      (case when nullif(trim(coalesce(p.bio,'')),'') is not null then 1 else 0 end)+
      (case when nullif(trim(coalesce(p.display_name,'')),'') is not null then 1 else 0 end)+
      (case when coalesce(a.titles_watched,0)>=1 then 1 else 0 end)+
      (case when coalesce(a.titles_watched,0)>=10 then 1 else 0 end)+
      (case when coalesce(r.ratings_count,0)>=1 then 1 else 0 end)+
      (case when public.resolve_public_top_role(p.user_id,p.username) is not null then 1 else 0 end)
    )::integer achievements,
    public.resolve_public_top_role(p.user_id,p.username) as top_role
  from public.profiles p
  left join public.user_presence pr on pr.user_id=p.user_id
  left join activity a on a.user_id=p.user_id
  left join watchtime w on w.user_id=p.user_id
  left join ratings r on r.user_id=p.user_id
), scored as (
  select b.*,
    (
      b.titles_watched*100 +
      b.watch_minutes +
      b.ratings_count*25 +
      b.achievements*50
    )::bigint score
  from base b
), ranked as (
  select s.*,
    row_number() over(order by
      case when lower(coalesce(p_sort,'overall'))='titles' then s.titles_watched end desc nulls last,
      case when lower(coalesce(p_sort,'overall'))='watch' then s.watch_minutes end desc nulls last,
      case when lower(coalesce(p_sort,'overall'))='ratings' then s.ratings_count end desc nulls last,
      case when lower(coalesce(p_sort,'overall'))='achievements' then s.achievements end desc nulls last,
      s.score desc,
      lower(s.username)
    ) rank_no
  from scored s
)
select
  r.rank_no,r.user_id,r.username,r.display_name,r.avatar_url,
  r.last_seen_at,r.online,r.titles_watched,r.watch_minutes,
  r.ratings_count,r.achievements,r.score,r.top_role,
  (select count(*)::bigint from ranked)
from ranked r
order by r.rank_no
limit greatest(1,least(coalesce(p_page_size,25),100))
offset (greatest(coalesce(p_page,1),1)-1)*greatest(1,least(coalesce(p_page_size,25),100));
$$;
grant execute on function public.get_public_leaderboard(integer,integer,text) to anon,authenticated;

-- ------------------------------------------------
-- 8) REALTIME PUBLICATIONS
-- ------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.user_presence; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profile_title_activity; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profile_watch_time; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.user_ratings; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profile_comments; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profile_role_assignments; exception when duplicate_object then null; end;
end $$;

notify pgrst,'reload schema';

-- f2w-force-save:realtime-profile-leaderboard-v17:1788213599
 