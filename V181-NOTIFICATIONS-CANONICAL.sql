-- Flix2Watch V181 — canonical notifications repair.
-- Canonical store: public.user_notifications.
-- Preserves existing notifications, backfills the newer f2w table, keeps 7-day retention,
-- and makes old/new notification writers converge on one inbox.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  notification_type text not null default 'system',
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.f2w_notifications_v125 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_v181_user_created_idx
  on public.user_notifications(user_id,created_at desc);
create index if not exists user_notifications_v181_created_idx
  on public.user_notifications(created_at);
create index if not exists f2w_notifications_v181_user_created_idx
  on public.f2w_notifications_v125(user_id,created_at desc);
create index if not exists f2w_notifications_v181_created_idx
  on public.f2w_notifications_v125(created_at);

alter table public.user_notifications enable row level security;
alter table public.f2w_notifications_v125 enable row level security;

drop policy if exists "Users read own notifications" on public.user_notifications;
create policy "Users read own notifications"
on public.user_notifications for select to authenticated
using(auth.uid()=user_id);

drop policy if exists "Users update own notifications" on public.user_notifications;
create policy "Users update own notifications"
on public.user_notifications for update to authenticated
using(auth.uid()=user_id) with check(auth.uid()=user_id);

grant select on public.user_notifications to authenticated;

-- Keep only the last week in both historical stores.
delete from public.user_notifications where created_at < now() - interval '7 days';
delete from public.f2w_notifications_v125 where created_at < now() - interval '7 days';

-- Recover notifications that were written only to the newer f2w table.
-- A 6-second content window avoids duplicating the same account event if an older trigger
-- already wrote an equivalent notification into user_notifications.
insert into public.user_notifications(
  user_id,actor_user_id,notification_type,title,body,link,read_at,created_at
)
select
  f.user_id,
  null,
  'system',
  f.title,
  coalesce(f.message,''),
  f.link,
  f.read_at,
  f.created_at
from public.f2w_notifications_v125 f
where f.created_at >= now() - interval '7 days'
  and not exists (
    select 1
    from public.user_notifications u
    where u.user_id=f.user_id
      and u.title=f.title
      and coalesce(u.body,'')=coalesce(f.message,'')
      and coalesce(u.link,'')=coalesce(f.link,'')
      and abs(extract(epoch from (u.created_at-f.created_at))) <= 6
  );

-- Compatibility mirror: if any old code still writes to f2w_notifications_v125,
-- copy it into the canonical inbox without producing an obvious duplicate.
create or replace function public.f2w_mirror_notification_to_canonical_v181()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.created_at < now() - interval '7 days' then
    return new;
  end if;

  if not exists (
    select 1 from public.user_notifications u
    where u.user_id=new.user_id
      and u.title=new.title
      and coalesce(u.body,'')=coalesce(new.message,'')
      and coalesce(u.link,'')=coalesce(new.link,'')
      and abs(extract(epoch from (u.created_at-new.created_at))) <= 6
  ) then
    insert into public.user_notifications(
      user_id,notification_type,title,body,link,read_at,created_at
    ) values (
      new.user_id,'system',new.title,coalesce(new.message,''),new.link,new.read_at,new.created_at
    );
  end if;

  return new;
end;
$$;

drop trigger if exists f2w_mirror_notification_to_canonical_v181 on public.f2w_notifications_v125;
create trigger f2w_mirror_notification_to_canonical_v181
after insert on public.f2w_notifications_v125
for each row execute function public.f2w_mirror_notification_to_canonical_v181();

-- FOLLOW: one canonical writer only.
create or replace function public.f2w_notify_profile_follow_v181()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_username text;
begin
  if new.followed_user_id=new.follower_user_id then return new; end if;

  select p.username into v_username
  from public.profiles p
  where p.user_id=new.follower_user_id
  limit 1;

  if not exists (
    select 1 from public.user_notifications u
    where u.user_id=new.followed_user_id
      and u.title='New follower'
      and coalesce(u.body,'')=coalesce('@'||v_username,'Someone')||' followed you.'
      and u.created_at >= now()-interval '6 seconds'
  ) then
    insert into public.user_notifications(
      user_id,actor_user_id,notification_type,title,body,link
    ) values (
      new.followed_user_id,
      new.follower_user_id,
      'follow',
      'New follower',
      coalesce('@'||v_username,'Someone')||' followed you.',
      case when v_username is null then '/profile/' else '/profile/@'||v_username end
    );
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.profile_follows') is not null then
    execute 'drop trigger if exists trg_notify_profile_follow on public.profile_follows';
    execute 'drop trigger if exists f2w_notify_follow_v160 on public.profile_follows';
    execute 'drop trigger if exists f2w_notify_profile_follow_v181 on public.profile_follows';
    execute 'create trigger f2w_notify_profile_follow_v181 after insert on public.profile_follows for each row execute function public.f2w_notify_profile_follow_v181()';
  end if;
end $$;

-- ACCOUNT EVENTS: bans, unbans, warnings, mutes and staff changes.
create or replace function public.f2w_notify_account_event_v181()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if not exists (
    select 1 from public.user_notifications u
    where u.user_id=new.user_id
      and u.title=coalesce(nullif(new.title,''),'Account update')
      and coalesce(u.body,'')=coalesce(new.message,'')
      and abs(extract(epoch from (u.created_at-coalesce(new.created_at,now())))) <= 6
  ) then
    insert into public.user_notifications(
      user_id,actor_user_id,notification_type,title,body,link,created_at
    ) values (
      new.user_id,
      new.created_by,
      case
        when new.event_type in ('warning','ban','unban','mute','unmute','staff_granted','staff_revoked')
          then new.event_type
        else 'system'
      end,
      coalesce(nullif(new.title,''),'Account update'),
      coalesce(new.message,''),
      '/account/',
      coalesce(new.created_at,now())
    );
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.account_events') is not null then
    execute 'drop trigger if exists trg_notify_account_event on public.account_events';
    execute 'drop trigger if exists f2w_account_event_to_notification_v179 on public.account_events';
    execute 'drop trigger if exists f2w_notify_account_event_v181 on public.account_events';
    execute 'create trigger f2w_notify_account_event_v181 after insert on public.account_events for each row execute function public.f2w_notify_account_event_v181()';
  end if;
end $$;

-- PROFILE ROLES: role grants/removals go straight to the canonical inbox.
create or replace function public.f2w_notify_profile_role_v181()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_uid uuid; v_role text; v_added boolean;
begin
  if tg_op='INSERT' then
    v_uid:=new.user_id; v_role:=new.role_key; v_added:=true;
  else
    v_uid:=old.user_id; v_role:=old.role_key; v_added:=false;
  end if;

  if not exists (
    select 1 from public.user_notifications u
    where u.user_id=v_uid
      and u.title=case when v_added then 'Role added' else 'Role removed' end
      and u.created_at >= now()-interval '6 seconds'
  ) then
    insert into public.user_notifications(
      user_id,notification_type,title,body,link
    ) values (
      v_uid,
      'system',
      case when v_added then 'Role added' else 'Role removed' end,
      case when v_added
        then 'You were given the '||initcap(replace(coalesce(v_role,'role'),'_',' '))||' role.'
        else 'Your '||initcap(replace(coalesce(v_role,'role'),'_',' '))||' role was removed.'
      end,
      '/account/'
    );
  end if;

  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.profile_role_assignments') is not null then
    execute 'drop trigger if exists f2w_profile_role_notification_v179 on public.profile_role_assignments';
    execute 'drop trigger if exists f2w_notify_profile_role_v181 on public.profile_role_assignments';
    execute 'create trigger f2w_notify_profile_role_v181 after insert or delete on public.profile_role_assignments for each row execute function public.f2w_notify_profile_role_v181()';
  end if;
end $$;

-- SUPPORT replies: stop writing only to the legacy f2w table.
create or replace function public.f2w_notify_support_reply_v181()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_owner uuid; v_subject text;
begin
  select t.user_id,t.subject into v_owner,v_subject
  from public.support_tickets t
  where t.id=new.ticket_id;

  if v_owner is null then return new; end if;
  if new.sender_user_id is distinct from v_owner then
    if not exists (
      select 1 from public.user_notifications u
      where u.user_id=v_owner
        and u.title='Support replied to your ticket'
        and coalesce(u.link,'')='/support/?ticket='||new.ticket_id::text
        and u.created_at >= now()-interval '6 seconds'
    ) then
      insert into public.user_notifications(
        user_id,actor_user_id,notification_type,title,body,link
      ) values (
        v_owner,
        new.sender_user_id,
        'system',
        'Support replied to your ticket',
        coalesce(v_subject,'Your support ticket')||' has a new Staff reply.',
        '/support/?ticket='||new.ticket_id::text
      );
    end if;
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.support_ticket_messages') is not null
     and to_regclass('public.support_tickets') is not null then
    execute 'drop trigger if exists f2w_support_reply_notification_v125 on public.support_ticket_messages';
    execute 'drop trigger if exists f2w_notify_support_reply_v181 on public.support_ticket_messages';
    execute 'create trigger f2w_notify_support_reply_v181 after insert on public.support_ticket_messages for each row execute function public.f2w_notify_support_reply_v181()';
  end if;
end $$;

-- Existing site-wide header RPC. Keep its shape, but make the 7-day window authoritative.
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
      ) order by n.created_at desc
    ),
    '[]'::jsonb
  )
  from (
    select *
    from public.user_notifications
    where user_id=auth.uid()
      and created_at >= now() - interval '7 days'
    order by created_at desc
    limit greatest(1,least(coalesce(p_limit,40),100))
  ) n
  left join public.profiles p on p.user_id=n.actor_user_id
$$;

revoke all on function public.get_my_notifications(integer) from public;
grant execute on function public.get_my_notifications(integer) to authenticated;

-- Ten-per-page canonical page feed.
drop function if exists public.get_my_notifications_v181(integer,integer);
create function public.get_my_notifications_v181(
  p_page integer default 1,
  p_page_size integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid:=auth.uid();
  v_page integer:=greatest(1,coalesce(p_page,1));
  v_size integer:=greatest(1,least(coalesce(p_page_size,10),10));
  v_total bigint:=0;
  v_unread bigint:=0;
  v_pages integer:=1;
  v_rows jsonb:='[]'::jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  delete from public.user_notifications
  where user_id=v_uid and created_at < now() - interval '7 days';
  delete from public.f2w_notifications_v125
  where user_id=v_uid and created_at < now() - interval '7 days';

  select count(*),count(*) filter(where n.read_at is null)
    into v_total,v_unread
  from public.user_notifications n
  where n.user_id=v_uid
    and n.created_at >= now() - interval '7 days';

  v_pages:=greatest(1,ceil(v_total::numeric/v_size)::integer);
  v_page:=least(v_page,v_pages);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',q.id::text,
        'notification_type',q.notification_type,
        'title',q.title,
        'message',q.body,
        'body',q.body,
        'link',q.link,
        'read_at',q.read_at,
        'created_at',q.created_at,
        'actor_user_id',q.actor_user_id,
        'actor_username',q.actor_username,
        'actor_display_name',q.actor_display_name,
        'actor_avatar_url',q.actor_avatar_url
      ) order by q.created_at desc
    ),'[]'::jsonb
  ) into v_rows
  from (
    select n.id,n.notification_type,n.title,n.body,n.link,n.read_at,n.created_at,
           n.actor_user_id,p.username actor_username,p.display_name actor_display_name,p.avatar_url actor_avatar_url
    from public.user_notifications n
    left join public.profiles p on p.user_id=n.actor_user_id
    where n.user_id=v_uid
      and n.created_at >= now() - interval '7 days'
    order by n.created_at desc
    limit v_size offset (v_page-1)*v_size
  ) q;

  return jsonb_build_object(
    'rows',v_rows,
    'unread_count',v_unread,
    'total_count',v_total,
    'page',v_page,
    'page_count',v_pages,
    'page_size',v_size
  );
end;
$$;

revoke all on function public.get_my_notifications_v181(integer,integer) from public;
grant execute on function public.get_my_notifications_v181(integer,integer) to authenticated;

-- Read everything in both stores so no old badge can stay stuck.
drop function if exists public.mark_my_notifications_read_v181();
create function public.mark_my_notifications_read_v181()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_count integer:=0; v_legacy integer:=0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  update public.user_notifications
  set read_at=coalesce(read_at,now())
  where user_id=auth.uid() and read_at is null;
  get diagnostics v_count=row_count;

  update public.f2w_notifications_v125
  set read_at=coalesce(read_at,now())
  where user_id=auth.uid() and read_at is null;
  get diagnostics v_legacy=row_count;

  return jsonb_build_object('ok',true,'updated',v_count,'legacy_updated',v_legacy);
end;
$$;

revoke all on function public.mark_my_notifications_read_v181() from public;
grant execute on function public.mark_my_notifications_read_v181() to authenticated;

create or replace function public.f2w_cleanup_notifications_v181()
returns bigint
language plpgsql
security definer
set search_path=public
as $$
declare v_a bigint:=0; v_b bigint:=0;
begin
  delete from public.user_notifications where created_at < now() - interval '7 days';
  get diagnostics v_a=row_count;
  delete from public.f2w_notifications_v125 where created_at < now() - interval '7 days';
  get diagnostics v_b=row_count;
  return v_a+v_b;
end;
$$;
revoke all on function public.f2w_cleanup_notifications_v181() from public,anon,authenticated;

-- Realtime registration for both historical and canonical stores.
do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='user_notifications'
  ) then
    alter publication supabase_realtime add table public.user_notifications;
  end if;

  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='f2w_notifications_v125'
  ) then
    alter publication supabase_realtime add table public.f2w_notifications_v125;
  end if;
end $$;

-- Hourly physical cleanup when pg_cron is available. The read RPC also enforces the window,
-- so retention remains correct even on projects where pg_cron is disabled.
do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    begin perform cron.unschedule('f2w-notifications-retention-v181'); exception when others then null; end;
    perform cron.schedule(
      'f2w-notifications-retention-v181',
      '17 * * * *',
      'select public.f2w_cleanup_notifications_v181();'
    );
  end if;
exception when others then null;
end $$;

select public.f2w_cleanup_notifications_v181();
notify pgrst,'reload schema';
-- f2w-force-save:v181-notifications-canonical:20260902
