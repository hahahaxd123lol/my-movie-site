-- ============================================================
-- FLIX2WATCH v37 — PUBLIC CHAT 5s SLOW MODE + HARD DM 24h PURGE
-- RUN ONCE IN SUPABASE SQL EDITOR
-- ============================================================

create extension if not exists pg_cron;

-- ------------------------------------------------------------
-- Public chat slow mode state.
-- DMs are intentionally NOT rate limited.
-- ------------------------------------------------------------
create table if not exists public.public_chat_slowmode_v37 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_sent_at timestamptz not null default to_timestamp(0)
);

alter table public.public_chat_slowmode_v37 enable row level security;

revoke all on table public.public_chat_slowmode_v37 from anon,authenticated;
grant select,insert,update,delete on table public.public_chat_slowmode_v37 to service_role;

create or replace function public.enforce_public_chat_slowmode_v37(p_user_id uuid)
returns table(allowed boolean,retry_after_seconds integer)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_last timestamptz;
  v_now timestamptz:=clock_timestamp();
  v_remaining numeric;
begin
  if p_user_id is null then
    return query select false,5;
    return;
  end if;

  -- Prevent simultaneous tabs/requests from both passing.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,37));

  select last_sent_at
    into v_last
  from public.public_chat_slowmode_v37
  where user_id=p_user_id
  for update;

  if v_last is not null then
    v_remaining:=5-extract(epoch from (v_now-v_last));
    if v_remaining>0 then
      return query select false,ceil(v_remaining)::integer;
      return;
    end if;
  end if;

  insert into public.public_chat_slowmode_v37(user_id,last_sent_at)
  values(p_user_id,v_now)
  on conflict(user_id) do update set last_sent_at=excluded.last_sent_at;

  return query select true,0;
end;
$$;

revoke all on function public.enforce_public_chat_slowmode_v37(uuid) from public;
grant execute on function public.enforce_public_chat_slowmode_v37(uuid) to service_role;


-- Keep every existing UI/config reader consistent with the permanent rule.
insert into public.site_settings(key,value,updated_at)
values('chat_slow_mode_seconds','5'::jsonb,now())
on conflict(key) do update
set value='5'::jsonb,updated_at=excluded.updated_at;

-- ------------------------------------------------------------
-- Hard 24-hour purge for direct/private messages.
-- This deletes rows from the database; it is not just a UI filter.
-- The function detects whichever DM table names exist in this project.
-- ------------------------------------------------------------
create or replace function public.purge_flix2watch_dm_24h_v37()
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_cutoff timestamptz:=clock_timestamp()-interval '24 hours';
  r record;
begin
  -- Explicit known names + automatic discovery for future DM/private-message tables.
  for r in
    select distinct c.table_name
    from information_schema.columns c
    where c.table_schema='public'
      and c.column_name='created_at'
      and (
        c.table_name in (
          'direct_messages','private_messages','dm_messages',
          'chat_direct_messages','chat_dm_messages',
          'direct_message_messages','user_direct_messages'
        )
        or c.table_name ~* '(^|_)(dm|direct|private).*message'
        or c.table_name ~* 'message.*(^|_)(dm|direct|private)'
      )
      -- Never touch the public chat table here.
      and c.table_name <> 'chat_messages'
  loop
    execute format('delete from public.%I where created_at <= $1',r.table_name)
    using v_cutoff;
  end loop;
end;
$$;

revoke all on function public.purge_flix2watch_dm_24h_v37() from public;
grant execute on function public.purge_flix2watch_dm_24h_v37() to service_role;

-- Purge old DMs immediately.
select public.purge_flix2watch_dm_24h_v37();

-- Recreate one named every-minute job.
do $$
declare
  v_job bigint;
begin
  for v_job in
    select jobid from cron.job where jobname='flix2watch-hard-dm-24h-purge-v37'
  loop
    perform cron.unschedule(v_job);
  end loop;
end $$;

select cron.schedule(
  'flix2watch-hard-dm-24h-purge-v37',
  '* * * * *',
  $cron$select public.purge_flix2watch_dm_24h_v37();$cron$
);

-- Keep public-chat slowmode table tiny.
do $$
declare
  v_job bigint;
begin
  for v_job in
    select jobid from cron.job where jobname='flix2watch-slowmode-state-clean-v37'
  loop
    perform cron.unschedule(v_job);
  end loop;
end $$;

select cron.schedule(
  'flix2watch-slowmode-state-clean-v37',
  '17 4 * * *',
  $cron$delete from public.public_chat_slowmode_v37 where last_sent_at < now()-interval '7 days';$cron$
);

notify pgrst,'reload schema';

-- f2w-force-save:chat-slowmode-dm24-sql-v37:1788218042
 