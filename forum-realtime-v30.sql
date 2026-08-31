-- ============================================================
-- FLIX2WATCH FORUM v30 — REALTIME THREADS + REPLIES
-- This migration is additive and safe to rerun.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  category text not null default 'general',
  is_spoiler boolean not null default false,
  view_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.forum_threads
  add column if not exists author_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists category text default 'general',
  add column if not exists is_spoiler boolean default false,
  add column if not exists view_count bigint default 0,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create table if not exists public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.forum_replies
  add column if not exists thread_id uuid references public.forum_threads(id) on delete cascade,
  add column if not exists author_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists body text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists forum_threads_created_idx on public.forum_threads(created_at desc);
create index if not exists forum_threads_category_idx on public.forum_threads(category,created_at desc);
create index if not exists forum_replies_thread_idx on public.forum_replies(thread_id,created_at);

alter table public.forum_threads enable row level security;
alter table public.forum_replies enable row level security;

drop policy if exists "forum threads public read" on public.forum_threads;
create policy "forum threads public read" on public.forum_threads for select using (true);
drop policy if exists "forum replies public read" on public.forum_replies;
create policy "forum replies public read" on public.forum_replies for select using (true);

create or replace function public.create_forum_thread_v30(
  p_title text,
  p_body text,
  p_category text default 'general',
  p_is_spoiler boolean default false
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_id uuid;
  v_title text:=trim(coalesce(p_title,''));
  v_body text:=trim(coalesce(p_body,''));
  v_category text:=lower(trim(coalesce(p_category,'general')));
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if public.account_is_banned(v_me) then raise exception 'Account suspended'; end if;
  if char_length(v_title)<3 or char_length(v_title)>120 then raise exception 'Title must be 3–120 characters'; end if;
  if char_length(v_body)<1 or char_length(v_body)>5000 then raise exception 'Post must be 1–5000 characters'; end if;
  if v_category not in ('general','movies','tv','reviews','recommendations','off-topic') then v_category:='general'; end if;

  insert into public.forum_threads(author_user_id,title,body,category,is_spoiler)
  values(v_me,v_title,v_body,v_category,coalesce(p_is_spoiler,false))
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function public.create_forum_thread_v30(text,text,text,boolean) to authenticated;

create or replace function public.create_forum_reply_v30(
  p_thread_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_id uuid;
  v_body text:=trim(coalesce(p_body,''));
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if public.account_is_banned(v_me) then raise exception 'Account suspended'; end if;
  if not exists(select 1 from public.forum_threads where id=p_thread_id) then raise exception 'Thread not found'; end if;
  if char_length(v_body)<1 or char_length(v_body)>3000 then raise exception 'Reply must be 1–3000 characters'; end if;

  insert into public.forum_replies(thread_id,author_user_id,body)
  values(p_thread_id,v_me,v_body)
  returning id into v_id;

  update public.forum_threads set updated_at=now() where id=p_thread_id;
  return v_id;
end;
$$;
grant execute on function public.create_forum_reply_v30(uuid,text) to authenticated;

create or replace function public.get_forum_threads_v30(p_limit integer default 100)
returns table(
  id uuid,
  author_user_id uuid,
  username text,
  display_name text,
  top_role text,
  title text,
  body text,
  category text,
  is_spoiler boolean,
  view_count bigint,
  reply_count bigint,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
stable
set search_path=public
as $$
  select
    t.id,t.author_user_id,p.username,p.display_name,
    public.resolve_public_top_role(p.user_id,p.username) as top_role,
    t.title,t.body,t.category,t.is_spoiler,coalesce(t.view_count,0),
    (select count(*) from public.forum_replies r where r.thread_id=t.id) as reply_count,
    t.created_at,t.updated_at
  from public.forum_threads t
  join public.profiles p on p.user_id=t.author_user_id
  order by t.updated_at desc,t.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),200));
$$;
grant execute on function public.get_forum_threads_v30(integer) to anon,authenticated;

create or replace function public.get_forum_thread_v30(p_thread_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_result jsonb;
begin
  update public.forum_threads set view_count=coalesce(view_count,0)+1 where id=p_thread_id;

  select jsonb_build_object(
    'id',t.id,
    'title',t.title,
    'body',t.body,
    'category',t.category,
    'is_spoiler',t.is_spoiler,
    'view_count',t.view_count,
    'created_at',t.created_at,
    'updated_at',t.updated_at,
    'username',p.username,
    'display_name',p.display_name,
    'top_role',public.resolve_public_top_role(p.user_id,p.username),
    'reply_count',(select count(*) from public.forum_replies rr where rr.thread_id=t.id),
    'replies',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,
        'body',r.body,
        'created_at',r.created_at,
        'author_user_id',r.author_user_id,
        'username',rp.username,
        'display_name',rp.display_name,
        'top_role',public.resolve_public_top_role(rp.user_id,rp.username)
      ) order by r.created_at asc)
      from public.forum_replies r
      join public.profiles rp on rp.user_id=r.author_user_id
      where r.thread_id=t.id
    ),'[]'::jsonb)
  )
  into v_result
  from public.forum_threads t
  join public.profiles p on p.user_id=t.author_user_id
  where t.id=p_thread_id;

  return v_result;
end;
$$;
grant execute on function public.get_forum_thread_v30(uuid) to anon,authenticated;

-- Keep the role resolver/public name-effect RPC available for Owner/Staff/etc.
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

do $$
begin
  begin alter publication supabase_realtime add table public.forum_threads; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.forum_replies; exception when duplicate_object then null; end;
end $$;

notify pgrst,'reload schema';

-- f2w-force-save:forum-realtime-v30:1788216738
 