-- ============================================================
-- FLIX2WATCH v126 — PROFILE COMMENT TYPE FIX + FAST DMs + RETENTION
-- Run this whole file once in Supabase SQL Editor.
-- Safe to run again.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- A) FIX get_profile_comments_v17 ON DATABASES WHERE
--    profile_comments.id IS bigint (your production schema).
--    Postgres cannot CREATE OR REPLACE a changed return type, so drop first.
-- ------------------------------------------------------------
drop function if exists public.get_profile_comments_v17(uuid,integer);
drop function if exists public.add_profile_comment_v17(uuid,text);
drop function if exists public.delete_profile_comment_v17(uuid);
drop function if exists public.delete_profile_comment_v17(bigint);

create or replace function public.add_profile_comment_v17(p_profile_user_id uuid,p_body text)
returns bigint
language plpgsql security definer set search_path=public
as $$
declare v_me uuid:=auth.uid(); v_body text:=trim(coalesce(p_body,'')); v_id bigint;
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

create or replace function public.delete_profile_comment_v17(p_comment_id bigint)
returns void
language plpgsql security definer set search_path=public
as $$
declare v_me uuid:=auth.uid(); v_target uuid; v_author uuid;
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  select profile_user_id,author_user_id into v_target,v_author
  from public.profile_comments where id=p_comment_id;
  if v_target is null then return; end if;
  if v_me<>v_author and v_me<>v_target and v_me<>'f5454804-a2a6-4602-9086-51cf51f11c77'::uuid then
    raise exception 'Not allowed';
  end if;
  delete from public.profile_comments where id=p_comment_id;
end $$;
grant execute on function public.delete_profile_comment_v17(bigint) to authenticated;

create or replace function public.get_profile_comments_v17(p_profile_user_id uuid,p_limit integer default 50)
returns table(id bigint,author_user_id uuid,username text,display_name text,avatar_url text,top_role text,body text,created_at timestamptz,can_delete boolean)
language sql security definer stable set search_path=public
as $$
  select c.id,c.author_user_id,p.username,p.display_name,p.avatar_url,
    public.resolve_public_top_role(p.user_id,p.username),
    coalesce(c.body,c.comment_body,''),c.created_at,
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
-- B) DIRECT MESSAGES. One shared retention setting per pair.
-- ------------------------------------------------------------
create table if not exists public.f2w_dm_conversations_v126(
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  retention text not null default '24h' check(retention in ('after_viewing','24h','1w','1m')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint f2w_dm_pair_order_v126 check(user_a::text < user_b::text),
  constraint f2w_dm_pair_unique_v126 unique(user_a,user_b)
);

create table if not exists public.f2w_dm_messages_v126(
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.f2w_dm_conversations_v126(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check(char_length(trim(body)) between 1 and 2000),
  kind text not null default 'message' check(kind in ('message','system')),
  created_at timestamptz not null default now(),
  viewed_at timestamptz,
  expires_at timestamptz
);
create index if not exists f2w_dm_conv_created_v126_idx on public.f2w_dm_messages_v126(conversation_id,created_at desc);
create index if not exists f2w_dm_expiry_v126_idx on public.f2w_dm_messages_v126(expires_at) where expires_at is not null;
create index if not exists f2w_dm_user_a_v126_idx on public.f2w_dm_conversations_v126(user_a,updated_at desc);
create index if not exists f2w_dm_user_b_v126_idx on public.f2w_dm_conversations_v126(user_b,updated_at desc);

alter table public.f2w_dm_conversations_v126 enable row level security;
alter table public.f2w_dm_messages_v126 enable row level security;
revoke all on public.f2w_dm_conversations_v126 from anon,authenticated;
revoke all on public.f2w_dm_messages_v126 from anon,authenticated;
grant select on public.f2w_dm_conversations_v126 to authenticated;
grant select on public.f2w_dm_messages_v126 to authenticated;

drop policy if exists "dm participants read conversations v126" on public.f2w_dm_conversations_v126;
create policy "dm participants read conversations v126" on public.f2w_dm_conversations_v126
for select to authenticated using(auth.uid()=user_a or auth.uid()=user_b);

drop policy if exists "dm participants read messages v126" on public.f2w_dm_messages_v126;
create policy "dm participants read messages v126" on public.f2w_dm_messages_v126
for select to authenticated using(exists(
  select 1 from public.f2w_dm_conversations_v126 c
  where c.id=conversation_id and (c.user_a=auth.uid() or c.user_b=auth.uid())
));

create or replace function public.f2w_dm_expiry_v126(p_retention text,p_created timestamptz)
returns timestamptz language sql immutable as $$
  select case p_retention
    when '24h' then p_created+interval '24 hours'
    when '1w' then p_created+interval '7 days'
    when '1m' then p_created+interval '1 month'
    else null
  end
$$;

create or replace function public.open_dm_conversation_v126(p_other_username text)
returns uuid
language plpgsql security definer set search_path=public
as $$
declare v_me uuid:=auth.uid(); v_other uuid; v_a uuid; v_b uuid; v_id uuid;
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  select user_id into v_other from public.profiles where lower(username)=lower(trim(p_other_username)) limit 1;
  if v_other is null then raise exception 'User not found'; end if;
  if v_other=v_me then raise exception 'You cannot message yourself'; end if;
  if v_me::text < v_other::text then v_a:=v_me;v_b:=v_other; else v_a:=v_other;v_b:=v_me; end if;
  insert into public.f2w_dm_conversations_v126(user_a,user_b)
  values(v_a,v_b)
  on conflict(user_a,user_b) do update set updated_at=public.f2w_dm_conversations_v126.updated_at
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.open_dm_conversation_v126(text) to authenticated;

create or replace function public.get_my_dm_conversations_v126()
returns table(conversation_id uuid,other_user_id uuid,username text,display_name text,avatar_url text,retention text,last_message text,last_message_at timestamptz)
language sql security definer stable set search_path=public
as $$
  select c.id,
    case when c.user_a=auth.uid() then c.user_b else c.user_a end,
    p.username,p.display_name,p.avatar_url,c.retention,
    lm.body,lm.created_at
  from public.f2w_dm_conversations_v126 c
  join public.profiles p on p.user_id=(case when c.user_a=auth.uid() then c.user_b else c.user_a end)
  left join lateral (
    select m.body,m.created_at from public.f2w_dm_messages_v126 m
    where m.conversation_id=c.id and (m.expires_at is null or m.expires_at>now())
    order by m.created_at desc limit 1
  ) lm on true
  where c.user_a=auth.uid() or c.user_b=auth.uid()
  order by coalesce(lm.created_at,c.updated_at) desc
$$;
grant execute on function public.get_my_dm_conversations_v126() to authenticated;

create or replace function public.get_dm_messages_v126(p_conversation_id uuid,p_limit integer default 100)
returns table(id uuid,sender_user_id uuid,body text,kind text,created_at timestamptz,viewed_at timestamptz,retention text)
language plpgsql security definer set search_path=public
as $$
declare v_me uuid:=auth.uid(); v_ret text;
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  select c.retention into v_ret from public.f2w_dm_conversations_v126 c
  where c.id=p_conversation_id and (c.user_a=v_me or c.user_b=v_me);
  if v_ret is null then raise exception 'Conversation not found'; end if;

  -- Mark incoming messages as viewed. For Snapchat-style mode, remove them now.
  update public.f2w_dm_messages_v126 set viewed_at=coalesce(viewed_at,now())
  where conversation_id=p_conversation_id and sender_user_id<>v_me and kind='message';
  if v_ret='after_viewing' then
    delete from public.f2w_dm_messages_v126
    where conversation_id=p_conversation_id and sender_user_id<>v_me and kind='message' and viewed_at is not null;
  end if;

  return query
  select m.id,m.sender_user_id,m.body,m.kind,m.created_at,m.viewed_at,v_ret
  from public.f2w_dm_messages_v126 m
  where m.conversation_id=p_conversation_id and (m.expires_at is null or m.expires_at>now())
  order by m.created_at asc
  limit greatest(1,least(coalesce(p_limit,100),200));
end $$;
grant execute on function public.get_dm_messages_v126(uuid,integer) to authenticated;

create or replace function public.send_dm_message_v126(p_conversation_id uuid,p_body text)
returns table(id uuid,sender_user_id uuid,body text,kind text,created_at timestamptz,viewed_at timestamptz,retention text)
language plpgsql security definer set search_path=public
as $$
declare v_me uuid:=auth.uid(); v_body text:=trim(coalesce(p_body,'')); v_ret text; v_id uuid; v_now timestamptz:=clock_timestamp();
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if char_length(v_body)<1 or char_length(v_body)>2000 then raise exception 'Message must be 1–2000 characters'; end if;
  select c.retention into v_ret from public.f2w_dm_conversations_v126 c
  where c.id=p_conversation_id and (c.user_a=v_me or c.user_b=v_me);
  if v_ret is null then raise exception 'Conversation not found'; end if;

  insert into public.f2w_dm_messages_v126(conversation_id,sender_user_id,body,kind,created_at,expires_at)
  values(p_conversation_id,v_me,v_body,'message',v_now,public.f2w_dm_expiry_v126(v_ret,v_now)) returning f2w_dm_messages_v126.id into v_id;
  update public.f2w_dm_conversations_v126 set updated_at=v_now where f2w_dm_conversations_v126.id=p_conversation_id;

  return query select v_id,v_me,v_body,'message'::text,v_now,null::timestamptz,v_ret;
end $$;
grant execute on function public.send_dm_message_v126(uuid,text) to authenticated;

create or replace function public.set_dm_retention_v126(p_conversation_id uuid,p_retention text)
returns text
language plpgsql security definer set search_path=public
as $$
declare v_me uuid:=auth.uid(); v_ret text:=lower(trim(coalesce(p_retention,''))); v_label text; v_now timestamptz:=clock_timestamp();
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if v_ret not in ('after_viewing','24h','1w','1m') then raise exception 'Invalid deletion time'; end if;
  update public.f2w_dm_conversations_v126 set retention=v_ret,updated_at=v_now
  where id=p_conversation_id and (user_a=v_me or user_b=v_me);
  if not found then raise exception 'Conversation not found'; end if;

  update public.f2w_dm_messages_v126
  set expires_at=public.f2w_dm_expiry_v126(v_ret,created_at)
  where conversation_id=p_conversation_id and kind='message';
  delete from public.f2w_dm_messages_v126 where conversation_id=p_conversation_id and expires_at is not null and expires_at<=v_now;

  v_label:=case v_ret when 'after_viewing' then 'after viewing' when '24h' then 'after 24 hours' when '1w' then 'after 1 week' else 'after 1 month' end;
  insert into public.f2w_dm_messages_v126(conversation_id,sender_user_id,body,kind,created_at,expires_at)
  values(p_conversation_id,v_me,'Message deletion was set to '||v_label||'.','system',v_now,public.f2w_dm_expiry_v126(v_ret,v_now));
  return v_ret;
end $$;
grant execute on function public.set_dm_retention_v126(uuid,text) to authenticated;

create or replace function public.purge_expired_dm_v126()
returns void language sql security definer set search_path=public as $$
  delete from public.f2w_dm_messages_v126 where expires_at is not null and expires_at<=now();
$$;
revoke all on function public.purge_expired_dm_v126() from public;
grant execute on function public.purge_expired_dm_v126() to service_role;

-- pg_cron is optional. If enabled, purge every 15 minutes to keep CPU low.
do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    begin perform cron.unschedule(jobid) from cron.job where jobname='f2w-dm-v126-purge'; exception when others then null; end;
    perform cron.schedule('f2w-dm-v126-purge','*/15 * * * *',$cron$select public.purge_expired_dm_v126();$cron$);
  end if;
end $$;

do $$
begin
  begin alter publication supabase_realtime add table public.f2w_dm_messages_v126; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.f2w_dm_conversations_v126; exception when duplicate_object then null; end;
end $$;

notify pgrst,'reload schema';
