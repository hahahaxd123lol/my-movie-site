-- ============================================================
-- FLIX2WATCH v144 — FORUM / CHAT / ACCOUNT / NOTIFICATIONS REPAIR
-- Safe to rerun after v139+. Designed to tolerate older production schemas.
-- ============================================================
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) FORUM: repair legacy author_id NOT NULL schemas.
-- v137 writes author_user_id. Older databases may still have author_id NOT NULL,
-- which causes: null value in column "author_id" violates not-null constraint.
-- ------------------------------------------------------------
alter table if exists public.forum_threads
  add column if not exists author_user_id uuid references auth.users(id) on delete cascade;
alter table if exists public.forum_replies
  add column if not exists author_user_id uuid references auth.users(id) on delete cascade;

do $$
declare t text; typ text;
begin
  foreach t in array array['forum_threads','forum_replies'] loop
    if to_regclass('public.'||t) is null then continue; end if;

    select c.data_type into typ
    from information_schema.columns c
    where c.table_schema='public' and c.table_name=t and c.column_name='author_id';

    if typ is not null then
      -- Backfill the canonical user-id column wherever legacy author_id is usable.
      if typ='uuid' then
        execute format('update public.%I set author_user_id=author_id where author_user_id is null and author_id is not null',t);
      elsif typ in ('text','character varying','character') then
        begin
          execute format($q$update public.%I set author_user_id=author_id::uuid where author_user_id is null and author_id is not null and author_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'$q$,t);
        exception when others then null;
        end;
      end if;

      -- Crucial compatibility fix: old author_id can no longer block v137 inserts.
      execute format('alter table public.%I alter column author_id drop not null',t);
    end if;
  end loop;
end $$;

create index if not exists forum_threads_author_user_v144_idx on public.forum_threads(author_user_id);
create index if not exists forum_replies_author_user_v144_idx on public.forum_replies(author_user_id);

-- Recreate the current forum post RPC in place so the existing v137 client works.
create or replace function public.create_forum_thread_v137(
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
  v_banned boolean:=false;
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if char_length(v_title)<3 or char_length(v_title)>120 then raise exception 'Title must be 3–120 characters'; end if;
  if char_length(v_body)<1 or char_length(v_body)>5000 then raise exception 'Post must be 1–5000 characters'; end if;
  if v_category not in ('general','movies','tv','reviews','recommendations','off-topic') then v_category:='general'; end if;

  if to_regprocedure('public.account_is_banned(uuid)') is not null then
    execute 'select public.account_is_banned($1)' into v_banned using v_me;
  end if;
  if coalesce(v_banned,false) then raise exception 'Account suspended'; end if;

  insert into public.forum_threads(author_user_id,title,body,category,is_spoiler,created_at,updated_at)
  values(v_me,v_title,v_body,v_category,coalesce(p_is_spoiler,false),now(),now())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.create_forum_thread_v137(text,text,text,boolean) from public;
grant execute on function public.create_forum_thread_v137(text,text,text,boolean) to authenticated;

create or replace function public.create_forum_reply_v137(p_thread_id uuid,p_body text)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare v_me uuid:=auth.uid();v_id uuid;v_body text:=trim(coalesce(p_body,''));
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if char_length(v_body)<1 or char_length(v_body)>3000 then raise exception 'Reply must be 1–3000 characters'; end if;
  if not exists(select 1 from public.forum_threads where id=p_thread_id) then raise exception 'Thread not found'; end if;
  insert into public.forum_replies(thread_id,author_user_id,body,created_at,updated_at)
  values(p_thread_id,v_me,v_body,now(),now()) returning id into v_id;
  update public.forum_threads set updated_at=now() where id=p_thread_id;
  return v_id;
end $$;
revoke all on function public.create_forum_reply_v137(uuid,text) from public;
grant execute on function public.create_forum_reply_v137(uuid,text) to authenticated;

-- ------------------------------------------------------------
-- 2) PUBLIC CHAT: delete ownership by immutable auth user_id, not username.
-- Works for v131+ messages because send_public_chat_message_v131 stores
-- user_token_hash = 'auth:<uuid>'. Staff/owner deletion can still use worker path.
-- ------------------------------------------------------------
create or replace function public.delete_my_public_chat_message_v144(p_message_id text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_deleted text;
begin
  if v_me is null then return jsonb_build_object('success',false,'error','Sign in again first.'); end if;
  if to_regclass('public.chat_messages') is null then return jsonb_build_object('success',false,'error','Chat is unavailable.'); end if;

  delete from public.chat_messages m
  where m.id::text=p_message_id
    and (
      m.user_token_hash='auth:'||v_me::text
      or m.owner_id=v_me
    )
  returning m.id::text into v_deleted;

  if v_deleted is null then
    return jsonb_build_object('success',false,'error','You can only delete your own messages.');
  end if;
  return jsonb_build_object('success',true,'message_id',v_deleted);
end $$;
revoke all on function public.delete_my_public_chat_message_v144(text) from public;
grant execute on function public.delete_my_public_chat_message_v144(text) to authenticated;

-- ------------------------------------------------------------
-- 3) NOTIFICATIONS: guarantee the table/RPCs exist so the header never fails
-- just because v125 was skipped on production.
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
  limit greatest(1,least(coalesce(p_limit,60),100));
$$;
revoke all on function public.get_my_notifications_v125(integer) from public;
grant execute on function public.get_my_notifications_v125(integer) to authenticated;

create or replace function public.mark_my_notifications_read_v125()
returns void language sql security definer set search_path=public as $$
  update public.f2w_notifications_v125
  set read_at=coalesce(read_at,now())
  where user_id=auth.uid() and read_at is null;
$$;
revoke all on function public.mark_my_notifications_read_v125() from public;
grant execute on function public.mark_my_notifications_read_v125() to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.f2w_notifications_v125;
  exception when duplicate_object then null; when undefined_object then null; end;
end $$;

-- ------------------------------------------------------------
-- 4) USERNAMES: inline availability + atomic rename.
-- No alias/redirect row is created, so the old /profile/@name stops resolving.
-- User-owned data remains attached to the same auth UUID.
-- ------------------------------------------------------------
create unique index if not exists profiles_username_lower_unique_v40
  on public.profiles(lower(username)) where username is not null;

create or replace function public.username_available_v144(p_username text)
returns jsonb
language plpgsql
security definer
stable
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_name text:=trim(coalesce(p_username,''));
  v_owner uuid;
begin
  if v_name !~ '^[A-Za-z0-9]{2,30}$' then
    return jsonb_build_object('available',false,'reason','Use 2–30 English letters or numbers only.');
  end if;
  if lower(v_name)='josh' and v_me is distinct from 'f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    return jsonb_build_object('available',false,'reason','That username is reserved.');
  end if;
  select p.user_id into v_owner from public.profiles p where lower(p.username)=lower(v_name) limit 1;
  if v_owner is null then return jsonb_build_object('available',true); end if;
  if v_me is not null and v_owner=v_me then return jsonb_build_object('available',true,'current',true); end if;
  return jsonb_build_object('available',false,'reason','That username is already taken.');
end $$;
revoke all on function public.username_available_v144(text) from public;
grant execute on function public.username_available_v144(text) to authenticated;

create or replace function public.change_my_username_v144(p_username text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
  v_name text:=trim(coalesce(p_username,''));
  v_old text;
begin
  if v_me is null then return jsonb_build_object('success',false,'error','Authentication required.'); end if;
  if v_name !~ '^[A-Za-z0-9]{2,30}$' then return jsonb_build_object('success',false,'error','Use 2–30 English letters or numbers only.'); end if;
  if lower(v_name)='josh' and v_me<>'f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    return jsonb_build_object('success',false,'error','That username is reserved.');
  end if;
  if exists(select 1 from public.profiles p where p.user_id<>v_me and lower(p.username)=lower(v_name)) then
    return jsonb_build_object('success',false,'error','That username is already taken.');
  end if;

  select p.username into v_old from public.profiles p where p.user_id=v_me for update;

  update public.profiles set username=v_name,updated_at=now() where user_id=v_me;
  if not found then
    insert into public.profiles(user_id,username,created_at,updated_at) values(v_me,v_name,now(),now());
  end if;

  update auth.users
  set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)||jsonb_build_object('username',v_name,'chat_alias',v_name)
  where id=v_me;

  -- Keep historical/public text labels consistent where the schema has them.
  if to_regclass('public.chat_messages') is not null and v_old is not null then
    update public.chat_messages set alias=v_name
    where lower(alias)=lower(v_old) and (user_token_hash='auth:'||v_me::text or owner_id=v_me);
  end if;

  if to_regclass('public.support_tickets') is not null and v_old is not null then
    begin
      execute 'update public.support_tickets set username=$1 where user_id=$2 and lower(username)=lower($3)' using v_name,v_me,v_old;
    exception when undefined_column then null;
    end;
  end if;

  return jsonb_build_object('success',true,'old_username',v_old,'username',v_name,'user_id',v_me);
exception
  when unique_violation then return jsonb_build_object('success',false,'error','That username is already taken.');
  when others then return jsonb_build_object('success',false,'error',sqlerrm);
end $$;
revoke all on function public.change_my_username_v144(text) from public;
grant execute on function public.change_my_username_v144(text) to authenticated;

notify pgrst,'reload schema';
