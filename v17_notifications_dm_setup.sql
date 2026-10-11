
-- ============================================================
-- FLIX2WATCH V17 — NOTIFICATIONS + PRIVATE DIRECT MESSAGES
-- Run ONCE after the V16/V14 backend setup.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  notification_type text not null check (
    notification_type in (
      'follow',
      'warning',
      'ban',
      'unban',
      'mute',
      'unmute',
      'staff_granted',
      'staff_revoked',
      'dm',
      'system'
    )
  ),
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_created_idx
on public.user_notifications(user_id,created_at desc);

create index if not exists user_notifications_unread_idx
on public.user_notifications(user_id,read_at,created_at desc);

alter table public.user_notifications enable row level security;

drop policy if exists "Users read own notifications" on public.user_notifications;
create policy "Users read own notifications"
on public.user_notifications
for select
to authenticated
using(auth.uid()=user_id);

drop policy if exists "Users update own notifications" on public.user_notifications;
create policy "Users update own notifications"
on public.user_notifications
for update
to authenticated
using(auth.uid()=user_id)
with check(auth.uid()=user_id);

drop policy if exists "Users delete own notifications" on public.user_notifications;
create policy "Users delete own notifications"
on public.user_notifications
for delete
to authenticated
using(auth.uid()=user_id);

revoke insert,update,delete on public.user_notifications from anon,authenticated;
grant select on public.user_notifications to authenticated;

create or replace function public.notify_profile_follow()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_username text;
begin
  if new.followed_user_id=new.follower_user_id then
    return new;
  end if;

  select username into v_username
  from public.profiles
  where user_id=new.follower_user_id
  limit 1;

  insert into public.user_notifications(
    user_id,
    actor_user_id,
    notification_type,
    title,
    body,
    link
  )
  values(
    new.followed_user_id,
    new.follower_user_id,
    'follow',
    'New follower',
    coalesce('@'||v_username,'Someone')||' followed you.',
    case
      when v_username is null then '/profile/'
      else '/profile/?user='||v_username
    end
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_profile_follow on public.profile_follows;
create trigger trg_notify_profile_follow
after insert on public.profile_follows
for each row execute function public.notify_profile_follow();

create or replace function public.notify_account_event()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.user_notifications(
    user_id,
    actor_user_id,
    notification_type,
    title,
    body,
    link
  )
  values(
    new.user_id,
    new.created_by,
    case
      when new.event_type in (
        'warning','ban','unban','mute','unmute',
        'staff_granted','staff_revoked'
      ) then new.event_type
      else 'system'
    end,
    new.title,
    new.message,
    '/home/'
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_account_event on public.account_events;
create trigger trg_notify_account_event
after insert on public.account_events
for each row execute function public.notify_account_event();

create or replace function public.get_my_notifications(p_limit integer default 40)
returns jsonb
language sql
security definer
stable
set search_path=public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',n.id,
        'notification_type',n.notification_type,
        'title',n.title,
        'body',n.body,
        'link',n.link,
        'read_at',n.read_at,
        'created_at',n.created_at,
        'actor_user_id',n.actor_user_id,
        'actor_username',p.username,
        'actor_display_name',p.display_name,
        'actor_avatar_url',p.avatar_url
      )
      order by n.created_at desc
    ),
    '[]'::jsonb
  )
  from (
    select *
    from public.user_notifications
    where user_id=auth.uid()
    order by created_at desc
    limit greatest(1,least(coalesce(p_limit,40),100))
  ) n
  left join public.profiles p
    on p.user_id=n.actor_user_id
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.user_notifications
  set read_at=coalesce(read_at,now())
  where id=p_notification_id
    and user_id=auth.uid();

  return found;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  v_count integer;
begin
  update public.user_notifications
  set read_at=now()
  where user_id=auth.uid()
    and read_at is null;

  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

grant execute on function public.get_my_notifications(integer) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- ============================================================
-- PRIVATE DIRECT MESSAGES
--
-- The site UI exposes DMs only to conversation participants.
-- Message bodies are encrypted at rest with AES-256 via pgcrypto.
-- The conversation encryption key is never granted to browser clients.
--
-- This is NOT end-to-end encryption: privileged database operators/service
-- infrastructure can technically access/decrypt server-side data.
-- ============================================================

create table if not exists public.dm_conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  encryption_secret uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dm_conversations_different_users check(user_a<>user_b),
  constraint dm_conversations_unique_pair unique(user_a,user_b)
);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body_encrypted bytea not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint dm_messages_different_users check(sender_id<>recipient_id)
);

create index if not exists dm_messages_conversation_created_idx
on public.dm_messages(conversation_id,created_at asc);

create index if not exists dm_messages_recipient_unread_idx
on public.dm_messages(recipient_id,read_at,created_at desc);

alter table public.dm_conversations enable row level security;
alter table public.dm_messages enable row level security;

-- No direct browser SELECT/INSERT/UPDATE/DELETE access is granted to encrypted
-- DM rows. All reads/writes go through participant-checking RPCs below.
revoke all on public.dm_conversations from anon,authenticated;
revoke all on public.dm_messages from anon,authenticated;

create or replace function public.dm_normalized_pair(
  p_one uuid,
  p_two uuid,
  out user_a uuid,
  out user_b uuid
)
language sql
immutable
as $$
  select
    case when p_one::text<p_two::text then p_one else p_two end,
    case when p_one::text<p_two::text then p_two else p_one end
$$;

create or replace function public.dm_get_or_create_conversation(p_target_username text)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_me uuid:=auth.uid();
  v_target public.profiles%rowtype;
  v_a uuid;
  v_b uuid;
  v_conversation public.dm_conversations%rowtype;
begin
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  if public.account_is_banned(v_me) then
    raise exception 'This account cannot use direct messages';
  end if;

  select * into v_target
  from public.profiles
  where lower(username)=lower(trim(p_target_username))
  limit 1;

  if v_target.user_id is null then
    raise exception 'User not found';
  end if;

  if v_target.user_id=v_me then
    raise exception 'You cannot message yourself';
  end if;

  select user_a,user_b into v_a,v_b
  from public.dm_normalized_pair(v_me,v_target.user_id);

  insert into public.dm_conversations(user_a,user_b)
  values(v_a,v_b)
  on conflict(user_a,user_b)
  do update set updated_at=public.dm_conversations.updated_at
  returning * into v_conversation;

  return jsonb_build_object(
    'conversation_id',v_conversation.id,
    'username',v_target.username,
    'display_name',v_target.display_name,
    'avatar_url',v_target.avatar_url,
    'user_id',v_target.user_id
  );
end;
$$;

create or replace function public.dm_send_message(
  p_target_username text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_me uuid:=auth.uid();
  v_target public.profiles%rowtype;
  v_sender public.profiles%rowtype;
  v_a uuid;
  v_b uuid;
  v_conversation public.dm_conversations%rowtype;
  v_message public.dm_messages%rowtype;
  v_body text:=trim(coalesce(p_body,''));
begin
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  if public.account_is_banned(v_me) then
    raise exception 'This account cannot use direct messages';
  end if;

  if length(v_body)<1 or length(v_body)>2000 then
    raise exception 'Private messages must be 1–2000 characters';
  end if;

  select * into v_target
  from public.profiles
  where lower(username)=lower(trim(p_target_username))
  limit 1;

  if v_target.user_id is null then
    raise exception 'User not found';
  end if;

  if v_target.user_id=v_me then
    raise exception 'You cannot message yourself';
  end if;

  select * into v_sender
  from public.profiles
  where user_id=v_me
  limit 1;

  select user_a,user_b into v_a,v_b
  from public.dm_normalized_pair(v_me,v_target.user_id);

  insert into public.dm_conversations(user_a,user_b)
  values(v_a,v_b)
  on conflict(user_a,user_b)
  do update set updated_at=now()
  returning * into v_conversation;

  insert into public.dm_messages(
    conversation_id,
    sender_id,
    recipient_id,
    body_encrypted
  )
  values(
    v_conversation.id,
    v_me,
    v_target.user_id,
    extensions.pgp_sym_encrypt(
      v_body,
      v_conversation.encryption_secret::text,
      'cipher-algo=aes256,compress-algo=1'
    )
  )
  returning * into v_message;

  update public.dm_conversations
  set updated_at=v_message.created_at
  where id=v_conversation.id;

  insert into public.user_notifications(
    user_id,
    actor_user_id,
    notification_type,
    title,
    body,
    link
  )
  values(
    v_target.user_id,
    v_me,
    'dm',
    'New private message',
    coalesce('@'||v_sender.username,'Someone')||' sent you a private message.',
    'dm:'||coalesce(v_sender.username,'')
  );

  return jsonb_build_object(
    'id',v_message.id,
    'conversation_id',v_conversation.id,
    'sender_id',v_message.sender_id,
    'recipient_id',v_message.recipient_id,
    'body',v_body,
    'created_at',v_message.created_at,
    'read_at',v_message.read_at
  );
end;
$$;

create or replace function public.dm_list_conversations()
returns jsonb
language plpgsql
security definer
stable
set search_path=public,extensions
as $$
declare
  v_me uuid:=auth.uid();
begin
  if v_me is null then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(row_data order by (row_data->>'updated_at')::timestamptz desc)
      from (
        select jsonb_build_object(
          'conversation_id',c.id,
          'updated_at',c.updated_at,
          'other_user_id',other_profile.user_id,
          'username',other_profile.username,
          'display_name',other_profile.display_name,
          'avatar_url',other_profile.avatar_url,
          'last_message',
            case
              when last_message.id is null then ''
              else extensions.pgp_sym_decrypt(
                last_message.body_encrypted,
                c.encryption_secret::text
              )
            end,
          'last_message_at',last_message.created_at,
          'last_sender_id',last_message.sender_id,
          'unread_count',(
            select count(*)
            from public.dm_messages unread
            where unread.conversation_id=c.id
              and unread.recipient_id=v_me
              and unread.read_at is null
          )
        ) row_data
        from public.dm_conversations c
        join public.profiles other_profile
          on other_profile.user_id=
            case when c.user_a=v_me then c.user_b else c.user_a end
        left join lateral (
          select m.*
          from public.dm_messages m
          where m.conversation_id=c.id
          order by m.created_at desc
          limit 1
        ) last_message on true
        where c.user_a=v_me or c.user_b=v_me
      ) x
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.dm_get_messages(
  p_conversation_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions
as $$
declare
  v_me uuid:=auth.uid();
  v_conversation public.dm_conversations%rowtype;
begin
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  select * into v_conversation
  from public.dm_conversations
  where id=p_conversation_id
    and (user_a=v_me or user_b=v_me);

  if v_conversation.id is null then
    raise exception 'Conversation not found';
  end if;

  update public.dm_messages
  set read_at=coalesce(read_at,now())
  where conversation_id=p_conversation_id
    and recipient_id=v_me
    and read_at is null;

  update public.user_notifications
  set read_at=coalesce(read_at,now())
  where user_id=v_me
    and notification_type='dm'
    and actor_user_id=case
      when v_conversation.user_a=v_me then v_conversation.user_b
      else v_conversation.user_a
    end
    and read_at is null;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id',m.id,
          'sender_id',m.sender_id,
          'recipient_id',m.recipient_id,
          'body',extensions.pgp_sym_decrypt(
            m.body_encrypted,
            v_conversation.encryption_secret::text
          ),
          'created_at',m.created_at,
          'read_at',m.read_at,
          'mine',m.sender_id=v_me
        )
        order by m.created_at asc
      )
      from (
        select *
        from public.dm_messages
        where conversation_id=p_conversation_id
        order by created_at desc
        limit greatest(1,least(coalesce(p_limit,100),250))
      ) m
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.dm_delete_message(p_message_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_me uuid:=auth.uid();
begin
  if v_me is null then
    raise exception 'Authentication required';
  end if;

  delete from public.dm_messages
  where id=p_message_id
    and sender_id=v_me;

  return found;
end;
$$;

grant execute on function public.dm_get_or_create_conversation(text) to authenticated;
grant execute on function public.dm_send_message(text,text) to authenticated;
grant execute on function public.dm_list_conversations() to authenticated;
grant execute on function public.dm_get_messages(uuid,integer) to authenticated;
grant execute on function public.dm_delete_message(uuid) to authenticated;

-- ============================================================
-- REALTIME
-- ============================================================

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.user_notifications;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
