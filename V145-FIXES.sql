-- Flix2Watch v145 — forum/chat/account/notifications repair migration
-- Safe to run after v139+; re-runnable.
create extension if not exists pgcrypto;

-- 1) Forum legacy author_id compatibility.
create or replace function public.f2w_forum_sync_author_v145()
returns trigger language plpgsql as $$
begin
  begin
    if new.author_user_id is null then new.author_user_id := new.author_id; end if;
    if new.author_id is null then new.author_id := new.author_user_id; end if;
  exception when undefined_column then
    null;
  end;
  return new;
end $$;

do $$
begin
  if to_regclass('public.forum_threads') is not null then
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name='forum_threads' and column_name='author_id')
       and exists(select 1 from information_schema.columns where table_schema='public' and table_name='forum_threads' and column_name='author_user_id') then
      execute 'update public.forum_threads set author_user_id=coalesce(author_user_id,author_id), author_id=coalesce(author_id,author_user_id) where author_user_id is null or author_id is null';
      execute 'drop trigger if exists f2w_forum_sync_author_v145 on public.forum_threads';
      execute 'create trigger f2w_forum_sync_author_v145 before insert or update on public.forum_threads for each row execute function public.f2w_forum_sync_author_v145()';
    end if;
  end if;
  if to_regclass('public.forum_replies') is not null then
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name='forum_replies' and column_name='author_id')
       and exists(select 1 from information_schema.columns where table_schema='public' and table_name='forum_replies' and column_name='author_user_id') then
      execute 'update public.forum_replies set author_user_id=coalesce(author_user_id,author_id), author_id=coalesce(author_id,author_user_id) where author_user_id is null or author_id is null';
      execute 'drop trigger if exists f2w_forum_reply_sync_author_v145 on public.forum_replies';
      execute 'create trigger f2w_forum_reply_sync_author_v145 before insert or update on public.forum_replies for each row execute function public.f2w_forum_sync_author_v145()';
    end if;
  end if;
end $$;

-- Recreate forum posting RPCs so auth.uid() is always the author.
create or replace function public.create_forum_thread_v137(p_title text,p_body text,p_category text default 'general',p_is_spoiler boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_me uuid:=auth.uid();v_id uuid;v_title text:=trim(coalesce(p_title,''));v_body text:=trim(coalesce(p_body,''));v_category text:=lower(trim(coalesce(p_category,'general')));
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if char_length(v_title)<3 or char_length(v_title)>120 then raise exception 'Title must be 3–120 characters'; end if;
  if char_length(v_body)<1 or char_length(v_body)>5000 then raise exception 'Post must be 1–5000 characters'; end if;
  if v_category not in ('general','movies','tv','reviews','recommendations','off-topic') then v_category:='general'; end if;
  insert into public.forum_threads(author_user_id,title,body,category,is_spoiler,created_at,updated_at)
  values(v_me,v_title,v_body,v_category,coalesce(p_is_spoiler,false),now(),now()) returning id into v_id;
  return v_id;
end $$;
grant execute on function public.create_forum_thread_v137(text,text,text,boolean) to authenticated;

create or replace function public.create_forum_reply_v137(p_thread_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path=public as $$
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
grant execute on function public.create_forum_reply_v137(uuid,text) to authenticated;

-- 2) Notifications: guarantee table + RPCs exist.
create table if not exists public.f2w_notifications_v125(
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, message text not null default '', link text, read_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists f2w_notifications_v125_user_idx on public.f2w_notifications_v125(user_id,created_at desc);
alter table public.f2w_notifications_v125 enable row level security;
revoke all on table public.f2w_notifications_v125 from anon,authenticated;
create or replace function public.get_my_notifications_v125(p_limit integer default 60)
returns table(id uuid,title text,message text,link text,read_at timestamptz,created_at timestamptz)
language sql security definer stable set search_path=public as $$
  select n.id,n.title,n.message,n.link,n.read_at,n.created_at from public.f2w_notifications_v125 n
  where n.user_id=auth.uid() order by n.created_at desc limit greatest(1,least(coalesce(p_limit,60),100))
$$;
grant execute on function public.get_my_notifications_v125(integer) to authenticated;
create or replace function public.mark_my_notifications_read_v125()
returns void language sql security definer set search_path=public as $$
 update public.f2w_notifications_v125 set read_at=coalesce(read_at,now()) where user_id=auth.uid() and read_at is null
$$;
grant execute on function public.mark_my_notifications_read_v125() to authenticated;

-- 3) Stable public-chat ownership. Images are not accepted by the direct send RPC.
alter table if exists public.chat_messages add column if not exists sender_user_id uuid references auth.users(id) on delete set null;
create index if not exists chat_messages_sender_v145_idx on public.chat_messages(sender_user_id,created_at desc);
create or replace function public.send_public_chat_message_v131(p_message text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();v_alias text;v_message text:=trim(coalesce(p_message,''));v_row record;
begin
  if v_uid is null then return jsonb_build_object('success',false,'error','Sign in to send a message.'); end if;
  if v_message='' then return jsonb_build_object('success',false,'error','Message cannot be empty.'); end if;
  if length(v_message)>500 then return jsonb_build_object('success',false,'error','Message must be 500 characters or less.'); end if;
  if left(v_message,1)='/' then return jsonb_build_object('success',false,'error','Commands must use the secure chat worker.'); end if;
  if position('[[image:' in v_message)>0 then return jsonb_build_object('success',false,'error','Image sending is disabled in public chat.'); end if;
  select nullif(trim(username),'') into v_alias from public.profiles where user_id=v_uid limit 1;
  if v_alias is null then return jsonb_build_object('success',false,'error','Account username required.'); end if;
  insert into public.chat_messages(alias,message,user_token_hash,owner_id,sender_user_id)
  values(v_alias,v_message,'auth:'||v_uid::text,null,v_uid)
  returning id,alias,message,created_at,owner_id into v_row;
  return jsonb_build_object('success',true,'message',jsonb_build_object('id',v_row.id,'alias',v_row.alias,'message',v_row.message,'created_at',v_row.created_at));
exception when others then return jsonb_build_object('success',false,'error',sqlerrm); end $$;
revoke all on function public.send_public_chat_message_v131(text) from public;
grant execute on function public.send_public_chat_message_v131(text) to authenticated;

create or replace function public.delete_my_public_chat_message_v145(p_message_id text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();v_username text;v_deleted integer:=0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select username into v_username from public.profiles where user_id=v_uid limit 1;
  delete from public.chat_messages m
   where m.id::text=p_message_id
     and (m.sender_user_id=v_uid or m.user_token_hash='auth:'||v_uid::text or (m.sender_user_id is null and lower(m.alias)=lower(coalesce(v_username,''))));
  get diagnostics v_deleted = row_count;
  if v_deleted=0 then raise exception 'You can only delete your own messages.'; end if;
  return true;
end $$;
revoke all on function public.delete_my_public_chat_message_v145(text) from public;
grant execute on function public.delete_my_public_chat_message_v145(text) to authenticated;

-- 4) Username availability + atomic rename. Old profile URL stops resolving because the same profile row is updated in place.
create unique index if not exists profiles_username_lower_v145_uidx on public.profiles(lower(username)) where username is not null;
create or replace function public.is_username_available_v145(p_username text)
returns boolean language sql security definer stable set search_path=public as $$
  select case when trim(coalesce(p_username,'')) !~ '^[A-Za-z0-9]{2,30}$' then false
              else not exists(select 1 from public.profiles p where lower(p.username)=lower(trim(p_username)) and p.user_id is distinct from auth.uid()) end
$$;
grant execute on function public.is_username_available_v145(text) to authenticated;

create or replace function public.change_my_username_v145(p_username text)
returns text language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();v_next text:=trim(coalesce(p_username,''));v_old text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_next !~ '^[A-Za-z0-9]{2,30}$' then raise exception 'Use 2–30 English letters or numbers.'; end if;
  if exists(select 1 from public.profiles p where lower(p.username)=lower(v_next) and p.user_id<>v_uid) then raise exception 'That username is already taken.'; end if;
  select username into v_old from public.profiles where user_id=v_uid limit 1;
  update public.profiles set username=v_next where user_id=v_uid;
  -- Keep auth metadata in sync so fresh sessions do not resurrect the previous username.
  update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)||jsonb_build_object('username',v_next,'chat_alias',v_next), updated_at=now() where id=v_uid;
  return v_next;
end $$;
revoke all on function public.change_my_username_v145(text) from public;
grant execute on function public.change_my_username_v145(text) to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.f2w_notifications_v125; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.chat_messages; exception when duplicate_object then null; end;
end $$;
notify pgrst,'reload schema';
