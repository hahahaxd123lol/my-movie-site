-- Flix2Watch V179 — notifications page, pagination, event notifications and 7-day retention.
-- Run once in Supabase SQL Editor.

create index if not exists f2w_notifications_v179_user_created_idx
  on public.f2w_notifications_v125(user_id, created_at desc);
create index if not exists f2w_notifications_v179_created_idx
  on public.f2w_notifications_v125(created_at);

alter table public.f2w_notifications_v125 enable row level security;

-- Global cleanup helper. Kept private; page reads also prune the signed-in user's expired rows.
create or replace function public.f2w_cleanup_notifications_v179()
returns bigint
language plpgsql
security definer
set search_path=public
as $$
declare v_count bigint:=0;
begin
  delete from public.f2w_notifications_v125 where created_at < now() - interval '7 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.f2w_cleanup_notifications_v179() from public,anon,authenticated;

-- Ten-per-page canonical feed. Returns the real unread total, not merely this page.
drop function if exists public.get_my_notifications_v179(integer,integer);
create function public.get_my_notifications_v179(p_page integer default 1,p_page_size integer default 10)
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
  delete from public.f2w_notifications_v125 where user_id=v_uid and created_at < now()-interval '7 days';
  select count(*),count(*) filter(where read_at is null) into v_total,v_unread from public.f2w_notifications_v125 where user_id=v_uid;
  v_pages:=greatest(1,ceil(v_total::numeric/v_size)::integer);
  v_page:=least(v_page,v_pages);
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id::text,'title',q.title,'message',q.message,'link',q.link,'read_at',q.read_at,'created_at',q.created_at) order by q.created_at desc),'[]'::jsonb)
  into v_rows
  from (
    select n.id,n.title,n.message,n.link,n.read_at,n.created_at
    from public.f2w_notifications_v125 n
    where n.user_id=v_uid
    order by n.created_at desc
    limit v_size offset (v_page-1)*v_size
  ) q;
  return jsonb_build_object('rows',v_rows,'unread_count',v_unread,'total_count',v_total,'page',v_page,'page_count',v_pages,'page_size',v_size);
end;
$$;
revoke all on function public.get_my_notifications_v179(integer,integer) from public;
grant execute on function public.get_my_notifications_v179(integer,integer) to authenticated;

drop function if exists public.mark_my_notifications_read_v179();
create function public.mark_my_notifications_read_v179()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_count integer:=0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.f2w_notifications_v125 set read_at=coalesce(read_at,now()) where user_id=auth.uid() and read_at is null;
  get diagnostics v_count=row_count;
  return jsonb_build_object('ok',true,'updated',v_count);
end;
$$;
revoke all on function public.mark_my_notifications_read_v179() from public;
grant execute on function public.mark_my_notifications_read_v179() to authenticated;

-- Staff/account actions already write to account_events. Mirror them into the notification inbox.
create or replace function public.f2w_account_event_to_notification_v179()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  insert into public.f2w_notifications_v125(user_id,title,message,link,created_at)
  values(new.user_id,coalesce(nullif(new.title,''),'Account update'),coalesce(new.message,''),'/account/',coalesce(new.created_at,now()));
  return new;
end;
$$;
do $$ begin
  if to_regclass('public.account_events') is not null then
    execute 'drop trigger if exists f2w_account_event_to_notification_v179 on public.account_events';
    execute 'create trigger f2w_account_event_to_notification_v179 after insert on public.account_events for each row execute function public.f2w_account_event_to_notification_v179()';
  end if;
end $$;

-- Public/profile role grants/removals also deserve an inbox notification.
create or replace function public.f2w_profile_role_notification_v179()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_uid uuid;v_role text;v_added boolean;
begin
  v_uid:=coalesce(new.user_id,old.user_id);v_role:=coalesce(new.role_key,old.role_key);v_added:=(tg_op='INSERT');
  insert into public.f2w_notifications_v125(user_id,title,message,link)
  values(v_uid,case when v_added then 'Role added' else 'Role removed' end,
    case when v_added then 'You were given the '||initcap(replace(v_role,'_',' '))||' role.' else 'Your '||initcap(replace(v_role,'_',' '))||' role was removed.' end,
    '/account/');
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
do $$ begin
  if to_regclass('public.profile_role_assignments') is not null then
    execute 'drop trigger if exists f2w_profile_role_notification_v179 on public.profile_role_assignments';
    execute 'create trigger f2w_profile_role_notification_v179 after insert or delete on public.profile_role_assignments for each row execute function public.f2w_profile_role_notification_v179()';
  end if;
end $$;

-- Realtime feed registration.
do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='f2w_notifications_v125') then
    alter publication supabase_realtime add table public.f2w_notifications_v125;
  end if;
end $$;

-- If pg_cron is enabled in this Supabase project, purge expired notifications hourly.
do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    begin perform cron.unschedule('f2w-notifications-retention-v179'); exception when others then null; end;
    perform cron.schedule('f2w-notifications-retention-v179','17 * * * *','select public.f2w_cleanup_notifications_v179();');
  end if;
exception when others then null;
end $$;

-- Do one cleanup immediately when this migration is applied.
select public.f2w_cleanup_notifications_v179();
-- f2w-force-save:v179-notifications-sql
