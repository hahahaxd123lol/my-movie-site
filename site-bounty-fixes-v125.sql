-- ============================================================
-- Flix2Watch v125 — bounty bug-fix backend migration
-- Run once in Supabase SQL Editor. Safe to rerun.
-- ============================================================
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- A) PROFILE COMMENTS — legacy NOT NULL compatibility
-- ------------------------------------------------------------
alter table if exists public.profile_comments
  add column if not exists profile_user_id uuid,
  add column if not exists author_user_id uuid,
  add column if not exists body text,
  add column if not exists comment_body text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
declare c text;
begin
  if to_regclass('public.profile_comments') is null then return; end if;

  -- Backfill current columns from known legacy layouts where possible.
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='profile_comments' and column_name='comment_body') then
    execute 'update public.profile_comments set body=coalesce(body,comment_body) where body is null';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='profile_comments' and column_name='target_user_id') then
    execute 'update public.profile_comments set profile_user_id=coalesce(profile_user_id,target_user_id) where profile_user_id is null';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='profile_comments' and column_name='commenter_user_id') then
    execute 'update public.profile_comments set author_user_id=coalesce(author_user_id,commenter_user_id) where author_user_id is null';
  end if;

  -- Old required columns must not block the current insert RPC.
  foreach c in array array['comment_body','commenter_user_id','target_user_id','comment','message'] loop
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name='profile_comments' and column_name=c) then
      execute format('alter table public.profile_comments alter column %I drop not null',c);
    end if;
  end loop;
end $$;

create or replace function public.add_profile_comment_v17(p_profile_user_id uuid,p_body text)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_me uuid:=auth.uid();v_body text:=trim(coalesce(p_body,''));v_id uuid;
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if p_profile_user_id is null or not exists(select 1 from public.profiles where user_id=p_profile_user_id) then raise exception 'Profile not found'; end if;
  if char_length(v_body)<1 or char_length(v_body)>500 then raise exception 'Comment must be between 1 and 500 characters'; end if;

  insert into public.profile_comments(profile_user_id,author_user_id,body,comment_body,created_at,updated_at)
  values(p_profile_user_id,v_me,v_body,v_body,now(),now())
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.add_profile_comment_v17(uuid,text) to authenticated;

create or replace function public.get_profile_comments_v17(p_profile_user_id uuid,p_limit integer default 50)
returns table(id uuid,author_user_id uuid,username text,display_name text,avatar_url text,top_role text,body text,created_at timestamptz,can_delete boolean)
language sql security definer stable set search_path=public
as $$
  select c.id,c.author_user_id,p.username,p.display_name,p.avatar_url,
    public.resolve_public_top_role(p.user_id,p.username),
    coalesce(c.body,c.comment_body,''),
    c.created_at,
    (auth.uid()=c.author_user_id or auth.uid()=c.profile_user_id or auth.uid()='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid)
  from public.profile_comments c
  join public.profiles p on p.user_id=c.author_user_id
  join public.profiles target on target.user_id=c.profile_user_id
  where c.profile_user_id=p_profile_user_id
    and (coalesce(target.is_private,false)=false or auth.uid()=c.profile_user_id or auth.uid()=c.author_user_id)
  order by c.created_at desc
  limit greatest(1,least(coalesce(p_limit,50),100))
$$;
grant execute on function public.get_profile_comments_v17(uuid,integer) to anon,authenticated;

-- ------------------------------------------------------------
-- B) PUBLIC PROFILE FAVORITES
-- ------------------------------------------------------------
create or replace function public.get_public_profile_favorites_v125(p_user_id uuid)
returns table(media_id bigint,media_type text,title text,poster_path text,created_at timestamptz)
language sql security definer stable set search_path=public
as $$
  select f.media_id,f.media_type,f.title,f.poster_path,f.created_at
  from public.user_favorites f
  join public.profiles p on p.user_id=f.user_id
  where f.user_id=p_user_id
    and (coalesce(p.is_private,false)=false or auth.uid()=p_user_id)
  order by f.created_at desc
  limit 300
$$;
grant execute on function public.get_public_profile_favorites_v125(uuid) to anon,authenticated;

-- ------------------------------------------------------------
-- C) CURRENTLY WATCHING — 30 second heartbeat
-- ------------------------------------------------------------
create table if not exists public.current_watching_v125(
  user_id uuid primary key references auth.users(id) on delete cascade,
  media_type text not null,
  media_id bigint not null,
  title text not null,
  poster_path text,
  last_seen_at timestamptz not null default now()
);
create index if not exists current_watching_v125_seen_idx on public.current_watching_v125(last_seen_at desc);
alter table public.current_watching_v125 enable row level security;
revoke all on table public.current_watching_v125 from anon,authenticated;

create or replace function public.touch_current_watching_v125(
  p_media_type text,p_media_id bigint,p_title text,p_poster_path text default null
)
returns void
language plpgsql security definer set search_path=public
as $$
declare v_me uuid:=auth.uid();v_type text:=lower(trim(coalesce(p_media_type,'')));v_title text:=left(trim(coalesce(p_title,'')),250);
begin
  if v_me is null then return; end if;
  if v_type not in ('movie','tv') or p_media_id is null or p_media_id<=0 or v_title='' then return; end if;
  insert into public.current_watching_v125(user_id,media_type,media_id,title,poster_path,last_seen_at)
  values(v_me,v_type,p_media_id,v_title,nullif(trim(p_poster_path),''),now())
  on conflict(user_id) do update set media_type=excluded.media_type,media_id=excluded.media_id,title=excluded.title,poster_path=excluded.poster_path,last_seen_at=now();
end $$;
grant execute on function public.touch_current_watching_v125(text,bigint,text,text) to authenticated;

create or replace function public.get_public_current_watching_v125(p_username text)
returns table(media_type text,media_id bigint,title text,poster_path text,last_seen_at timestamptz)
language sql security definer stable set search_path=public
as $$
  select w.media_type,w.media_id,w.title,w.poster_path,w.last_seen_at
  from public.current_watching_v125 w
  join public.profiles p on p.user_id=w.user_id
  where lower(p.username)=lower(trim(p_username))
    and w.last_seen_at>now()-interval '75 seconds'
    and (coalesce(p.is_private,false)=false or auth.uid()=p.user_id)
  limit 1
$$;
grant execute on function public.get_public_current_watching_v125(text) to anon,authenticated;

do $$
begin
  begin alter publication supabase_realtime add table public.current_watching_v125; exception when duplicate_object then null; end;
end $$;

-- ------------------------------------------------------------
-- D) RATINGS — make profile ratings always resolvable
-- ------------------------------------------------------------
create table if not exists public.user_ratings(
  user_id uuid not null references auth.users(id) on delete cascade,
  media_type text not null,
  media_id bigint not null,
  rating smallint not null,
  review text,
  title text,
  poster_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_ratings add column if not exists review text;
alter table public.user_ratings add column if not exists title text;
alter table public.user_ratings add column if not exists poster_path text;
alter table public.user_ratings add column if not exists updated_at timestamptz default now();
create unique index if not exists user_ratings_user_media_v125_uq on public.user_ratings(user_id,media_type,media_id);

create or replace function public.get_public_profile_ratings_v117(p_username text)
returns table(media_type text,media_id bigint,rating smallint,review text,title text,poster_path text,updated_at timestamptz)
language sql security definer stable set search_path=public
as $$
  select r.media_type,r.media_id,r.rating,r.review,r.title,r.poster_path,r.updated_at
  from public.user_ratings r
  join public.profiles p on p.user_id=r.user_id
  where lower(p.username)=lower(trim(p_username))
    and (coalesce(p.is_private,false)=false or auth.uid()=p.user_id)
  order by r.updated_at desc
  limit 30
$$;
grant execute on function public.get_public_profile_ratings_v117(text) to anon,authenticated;

-- ------------------------------------------------------------
-- E) FORUM — repair thread/reply RPCs
-- ------------------------------------------------------------
alter table if exists public.forum_threads
  add column if not exists author_user_id uuid,
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists category text default 'general',
  add column if not exists is_spoiler boolean default false,
  add column if not exists view_count bigint default 0,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table if exists public.forum_replies
  add column if not exists thread_id uuid,
  add column if not exists author_user_id uuid,
  add column if not exists body text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
declare c text;
begin
  if to_regclass('public.forum_threads') is not null then
    foreach c in array array['content','post_body','thread_title','author_id'] loop
      if exists(select 1 from information_schema.columns where table_schema='public' and table_name='forum_threads' and column_name=c) then
        execute format('alter table public.forum_threads alter column %I drop not null',c);
      end if;
    end loop;
  end if;
  if to_regclass('public.forum_replies') is not null then
    foreach c in array array['content','reply_body','author_id'] loop
      if exists(select 1 from information_schema.columns where table_schema='public' and table_name='forum_replies' and column_name=c) then
        execute format('alter table public.forum_replies alter column %I drop not null',c);
      end if;
    end loop;
  end if;
end $$;

create or replace function public.create_forum_thread_v30(p_title text,p_body text,p_category text default 'general',p_is_spoiler boolean default false)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_me uuid:=auth.uid();v_id uuid;v_title text:=trim(coalesce(p_title,''));v_body text:=trim(coalesce(p_body,''));v_category text:=lower(trim(coalesce(p_category,'general')));
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if char_length(v_title)<3 or char_length(v_title)>120 then raise exception 'Title must be 3–120 characters'; end if;
  if char_length(v_body)<1 or char_length(v_body)>5000 then raise exception 'Post must be 1–5000 characters'; end if;
  if v_category not in ('general','movies','tv','reviews','recommendations','off-topic') then v_category:='general'; end if;
  insert into public.forum_threads(author_user_id,title,body,category,is_spoiler,created_at,updated_at)
  values(v_me,v_title,v_body,v_category,coalesce(p_is_spoiler,false),now(),now())
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.create_forum_thread_v30(text,text,text,boolean) to authenticated;

create or replace function public.create_forum_reply_v30(p_thread_id uuid,p_body text)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_me uuid:=auth.uid();v_id uuid;v_body text:=trim(coalesce(p_body,''));
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.forum_threads where id=p_thread_id) then raise exception 'Thread not found'; end if;
  if char_length(v_body)<1 or char_length(v_body)>3000 then raise exception 'Reply must be 1–3000 characters'; end if;
  insert into public.forum_replies(thread_id,author_user_id,body,created_at,updated_at)
  values(p_thread_id,v_me,v_body,now(),now()) returning id into v_id;
  update public.forum_threads set updated_at=now() where id=p_thread_id;
  return v_id;
end $$;
grant execute on function public.create_forum_reply_v30(uuid,text) to authenticated;

-- ------------------------------------------------------------
-- F) NOTIFICATIONS + SUPPORT REPLY NOTIFICATION
-- ------------------------------------------------------------
create table if not exists public.f2w_notifications_v125(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists f2w_notifications_v125_user_idx on public.f2w_notifications_v125(user_id,created_at desc);
alter table public.f2w_notifications_v125 enable row level security;
revoke all on table public.f2w_notifications_v125 from anon,authenticated;

create or replace function public.get_my_notifications_v125(p_limit integer default 60)
returns table(id uuid,title text,message text,link text,read_at timestamptz,created_at timestamptz)
language sql security definer stable set search_path=public
as $$
  select n.id,n.title,n.message,n.link,n.read_at,n.created_at
  from public.f2w_notifications_v125 n
  where n.user_id=auth.uid()
  order by n.created_at desc
  limit greatest(1,least(coalesce(p_limit,60),100))
$$;
grant execute on function public.get_my_notifications_v125(integer) to authenticated;

create or replace function public.mark_my_notifications_read_v125()
returns void
language sql security definer set search_path=public
as $$
  update public.f2w_notifications_v125 set read_at=coalesce(read_at,now()) where user_id=auth.uid() and read_at is null
$$;
grant execute on function public.mark_my_notifications_read_v125() to authenticated;

create or replace function public.f2w_support_reply_notification_v125()
returns trigger
language plpgsql security definer set search_path=public
as $$
declare v_owner uuid;v_subject text;
begin
  select t.user_id,t.subject into v_owner,v_subject from public.support_tickets t where t.id=new.ticket_id;
  if v_owner is null then return new; end if;
  if new.sender_user_id is distinct from v_owner then
    insert into public.f2w_notifications_v125(user_id,title,message,link)
    values(v_owner,'Support replied to your ticket',coalesce(v_subject,'Your support ticket')||' has a new Staff reply.','/support/?ticket='||new.ticket_id::text);
  end if;
  return new;
end $$;

do $$
begin
  if to_regclass('public.support_ticket_messages') is not null and to_regclass('public.support_tickets') is not null then
    execute 'drop trigger if exists f2w_support_reply_notification_v125 on public.support_ticket_messages';
    execute 'create trigger f2w_support_reply_notification_v125 after insert on public.support_ticket_messages for each row execute function public.f2w_support_reply_notification_v125()';
  end if;
end $$;

do $$
begin
  begin alter publication supabase_realtime add table public.f2w_notifications_v125; exception when duplicate_object then null; end;
end $$;

-- ------------------------------------------------------------
-- G) LEADERBOARD — overall rank is watch-time first
-- ------------------------------------------------------------
create or replace function public.get_public_leaderboard(
  p_page integer default 1,p_page_size integer default 25,p_sort text default 'overall'
)
returns table(
  rank_no bigint,user_id uuid,username text,display_name text,avatar_url text,last_seen_at timestamptz,
  online boolean,titles_watched bigint,watch_minutes bigint,ratings_count bigint,achievements integer,
  score bigint,top_role text,total_count bigint
)
language sql security definer stable set search_path=public
as $$
with activity as (
  select a.user_id,count(*)::bigint titles_watched from public.profile_title_activity a group by a.user_id
), watchtime as (
  select w.user_id,floor(sum(greatest(w.seconds,0))/60.0)::bigint watch_minutes from public.profile_watch_time w group by w.user_id
), ratings as (
  select r.user_id,count(*)::bigint ratings_count from public.user_ratings r group by r.user_id
), base as (
  select p.user_id,p.username,p.display_name,p.avatar_url,pr.last_seen_at,
    coalesce(pr.online_until>now(),false) online,
    coalesce(a.titles_watched,0)::bigint titles_watched,
    coalesce(w.watch_minutes,0)::bigint watch_minutes,
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
  left join activity a on a.user_id=p.user_id
  left join watchtime w on w.user_id=p.user_id
  left join ratings r on r.user_id=p.user_id
), scored as (
  select b.*,(b.watch_minutes*10 + b.titles_watched*5 + b.ratings_count*2 + b.achievements*3)::bigint score
  from base b
), ranked as (
  select s.*,
    row_number() over(order by
      case when lower(coalesce(p_sort,'overall'))='titles' then s.titles_watched end desc nulls last,
      case when lower(coalesce(p_sort,'overall'))='watch' then s.watch_minutes end desc nulls last,
      case when lower(coalesce(p_sort,'overall'))='ratings' then s.ratings_count end desc nulls last,
      case when lower(coalesce(p_sort,'overall'))='achievements' then s.achievements end desc nulls last,
      case when lower(coalesce(p_sort,'overall'))='overall' then s.watch_minutes end desc nulls last,
      s.score desc,lower(s.username)
    ) rank_no
  from scored s
)
select r.rank_no,r.user_id,r.username,r.display_name,r.avatar_url,r.last_seen_at,r.online,
  r.titles_watched,r.watch_minutes,r.ratings_count,r.achievements,r.score,r.top_role,
  (select count(*)::bigint from ranked)
from ranked r
order by r.rank_no
limit greatest(1,least(coalesce(p_page_size,25),100))
offset (greatest(coalesce(p_page,1),1)-1)*greatest(1,least(coalesce(p_page_size,25),100))
$$;
grant execute on function public.get_public_leaderboard(integer,integer,text) to anon,authenticated;

notify pgrst,'reload schema';

-- f2w-force-save:site-bounty-fixes-v125:1788300576
 