-- ============================================================
-- FLIX2WATCH v31 — HARD 24-HOUR CHAT PURGE + COMMENT COMPAT
-- RUN ONCE IN SUPABASE SQL EDITOR
-- ============================================================

create extension if not exists pg_cron;

-- Purges public chat plus common DM/private-message table names if present.
-- It deliberately only touches tables that have a created_at column.
create or replace function public.purge_flix2watch_chat_24h()
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_cutoff timestamptz := now() - interval '24 hours';
  v_table text;
  v_tables text[] := array[
    'chat_messages',
    'direct_messages',
    'private_messages',
    'dm_messages',
    'chat_direct_messages',
    'chat_dm_messages'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass('public.'||v_table) is not null
       and exists(
         select 1
         from information_schema.columns
         where table_schema='public'
           and table_name=v_table
           and column_name='created_at'
       )
    then
      execute format('delete from public.%I where created_at <= $1',v_table)
      using v_cutoff;
    end if;
  end loop;
end;
$$;

revoke all on function public.purge_flix2watch_chat_24h() from public;
grant execute on function public.purge_flix2watch_chat_24h() to service_role;

-- Purge anything already older than 24 hours immediately.
select public.purge_flix2watch_chat_24h();

-- Replace our named cron task if it already exists.
do $$
declare
  v_job bigint;
begin
  for v_job in
    select jobid from cron.job where jobname='flix2watch-hard-chat-24h-purge'
  loop
    perform cron.unschedule(v_job);
  end loop;
end $$;

-- Every minute: database age will stay within roughly 24h + scheduler latency.
select cron.schedule(
  'flix2watch-hard-chat-24h-purge',
  '* * * * *',
  $cron$select public.purge_flix2watch_chat_24h();$cron$
);

-- ------------------------------------------------------------
-- Legacy profile_comments compatibility.
-- Your database still has commenter_user_id from an older schema.
-- The current v17 RPC writes author_user_id, so make the old duplicate
-- column nullable and backfill it instead of allowing it to break inserts.
-- ------------------------------------------------------------
do $$
begin
  if exists(
    select 1 from information_schema.columns
    where table_schema='public'
      and table_name='profile_comments'
      and column_name='commenter_user_id'
  ) then
    execute 'update public.profile_comments
             set commenter_user_id=author_user_id
             where commenter_user_id is null
               and author_user_id is not null';
    execute 'alter table public.profile_comments
             alter column commenter_user_id drop not null';
  end if;
end $$;

notify pgrst,'reload schema';

-- f2w-force-save:chat24-comment-compat-v31:1788217048
 