-- ============================================================
-- FLIX2WATCH FORUM v137 — REPAIRED + REVAMPED FORUM BACKEND
-- Safe to run after v136. Re-runnable.
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
create table if not exists public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.forum_threads add column if not exists author_user_id uuid references auth.users(id) on delete cascade;
alter table public.forum_threads add column if not exists title text;
alter table public.forum_threads add column if not exists body text;
alter table public.forum_threads add column if not exists category text default 'general';
alter table public.forum_threads add column if not exists is_spoiler boolean default false;
alter table public.forum_threads add column if not exists view_count bigint default 0;
alter table public.forum_threads add column if not exists created_at timestamptz default now();
alter table public.forum_threads add column if not exists updated_at timestamptz default now();
alter table public.forum_replies add column if not exists thread_id uuid references public.forum_threads(id) on delete cascade;
alter table public.forum_replies add column if not exists author_user_id uuid references auth.users(id) on delete cascade;
alter table public.forum_replies add column if not exists body text;
alter table public.forum_replies add column if not exists created_at timestamptz default now();
alter table public.forum_replies add column if not exists updated_at timestamptz default now();

create index if not exists forum_threads_created_idx on public.forum_threads(created_at desc);
create index if not exists forum_threads_updated_idx on public.forum_threads(updated_at desc);
create index if not exists forum_threads_category_idx on public.forum_threads(category,updated_at desc);
create index if not exists forum_replies_thread_idx on public.forum_replies(thread_id,created_at);

alter table public.forum_threads enable row level security;
alter table public.forum_replies enable row level security;
drop policy if exists "forum threads public read" on public.forum_threads;
create policy "forum threads public read" on public.forum_threads for select using (true);
drop policy if exists "forum replies public read" on public.forum_replies;
create policy "forum replies public read" on public.forum_replies for select using (true);

create or replace function public.create_forum_thread_v137(p_title text,p_body text,p_category text default 'general',p_is_spoiler boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_me uuid:=auth.uid();v_id uuid;v_title text:=trim(coalesce(p_title,''));v_body text:=trim(coalesce(p_body,''));v_category text:=lower(trim(coalesce(p_category,'general')));v_banned boolean:=false;
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if to_regprocedure('public.account_is_banned(uuid)') is not null then execute 'select public.account_is_banned($1)' into v_banned using v_me; end if;
  if coalesce(v_banned,false) then raise exception 'Account suspended'; end if;
  if char_length(v_title)<3 or char_length(v_title)>120 then raise exception 'Title must be 3–120 characters'; end if;
  if char_length(v_body)<1 or char_length(v_body)>5000 then raise exception 'Post must be 1–5000 characters'; end if;
  if v_category not in ('general','movies','tv','reviews','recommendations','off-topic') then v_category:='general'; end if;
  insert into public.forum_threads(author_user_id,title,body,category,is_spoiler,created_at,updated_at) values(v_me,v_title,v_body,v_category,coalesce(p_is_spoiler,false),now(),now()) returning id into v_id;
  return v_id;
end $$;
grant execute on function public.create_forum_thread_v137(text,text,text,boolean) to authenticated;

create or replace function public.create_forum_reply_v137(p_thread_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_me uuid:=auth.uid();v_id uuid;v_body text:=trim(coalesce(p_body,''));v_banned boolean:=false;
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if to_regprocedure('public.account_is_banned(uuid)') is not null then execute 'select public.account_is_banned($1)' into v_banned using v_me; end if;
  if coalesce(v_banned,false) then raise exception 'Account suspended'; end if;
  if not exists(select 1 from public.forum_threads where id=p_thread_id) then raise exception 'Thread not found'; end if;
  if char_length(v_body)<1 or char_length(v_body)>3000 then raise exception 'Reply must be 1–3000 characters'; end if;
  insert into public.forum_replies(thread_id,author_user_id,body,created_at,updated_at) values(p_thread_id,v_me,v_body,now(),now()) returning id into v_id;
  update public.forum_threads set updated_at=now() where id=p_thread_id;
  return v_id;
end $$;
grant execute on function public.create_forum_reply_v137(uuid,text) to authenticated;


create or replace function public.forum_public_role_v137(p_user_id uuid,p_username text)
returns text language plpgsql security definer stable set search_path=public as $$
declare v text;
begin
  if to_regprocedure('public.resolve_public_top_role(uuid,text)') is null then return null; end if;
  execute 'select public.resolve_public_top_role($1,$2)' into v using p_user_id,p_username;
  return v;
end $$;
grant execute on function public.forum_public_role_v137(uuid,text) to anon,authenticated;

create or replace function public.get_forum_threads_v137(p_limit integer default 100)
returns table(id uuid,author_user_id uuid,username text,display_name text,top_role text,title text,body text,category text,is_spoiler boolean,view_count bigint,reply_count bigint,created_at timestamptz,updated_at timestamptz)
language sql security definer stable set search_path=public as $$
  select t.id,t.author_user_id,p.username,p.display_name,
    public.forum_public_role_v137(p.user_id,p.username),
    t.title,t.body,t.category,t.is_spoiler,coalesce(t.view_count,0)::bigint,
    (select count(*)::bigint from public.forum_replies r where r.thread_id=t.id),t.created_at,t.updated_at
  from public.forum_threads t left join public.profiles p on p.user_id=t.author_user_id
  order by t.updated_at desc nulls last,t.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),200));
$$;
grant execute on function public.get_forum_threads_v137(integer) to anon,authenticated;

create or replace function public.get_forum_thread_v137(p_thread_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_result jsonb;
begin
  update public.forum_threads set view_count=coalesce(view_count,0)+1 where id=p_thread_id;
  select jsonb_build_object('id',t.id,'title',t.title,'body',t.body,'category',t.category,'is_spoiler',t.is_spoiler,'view_count',t.view_count,'created_at',t.created_at,'updated_at',t.updated_at,
    'username',p.username,'display_name',p.display_name,
    'top_role',public.forum_public_role_v137(p.user_id,p.username),
    'reply_count',(select count(*) from public.forum_replies rr where rr.thread_id=t.id),
    'replies',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'body',r.body,'created_at',r.created_at,'author_user_id',r.author_user_id,'username',rp.username,'display_name',rp.display_name,'top_role',public.forum_public_role_v137(rp.user_id,rp.username)) order by r.created_at asc) from public.forum_replies r left join public.profiles rp on rp.user_id=r.author_user_id where r.thread_id=t.id),'[]'::jsonb)) into v_result
  from public.forum_threads t left join public.profiles p on p.user_id=t.author_user_id where t.id=p_thread_id;
  return v_result;
end $$;
grant execute on function public.get_forum_thread_v137(uuid) to anon,authenticated;

-- Realtime: add tables if they are not already in the publication.
do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='forum_threads') then alter publication supabase_realtime add table public.forum_threads; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='forum_replies') then alter publication supabase_realtime add table public.forum_replies; end if;
exception when undefined_object then null; end $$;

notify pgrst,'reload schema';
