
-- ============================================================
-- FLIX2WATCH BAN-EVASION GUARD v1
-- RUN THIS WHOLE FILE ONCE IN SUPABASE SQL EDITOR.
--
-- Purpose:
--   Link known banned accounts to high-confidence device/browser signals.
--   New accounts from a previously banned device can be blocked automatically.
--
-- Privacy:
--   Raw IP addresses, raw browser fingerprints and raw device IDs are NOT stored.
--   The Edge Function hashes them before they reach these tables.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.account_device_signals (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  signal_key text not null,
  device_hash text,
  fingerprint_hash text,
  ua_hash text,
  ip_hash text,
  ip_ua_hash text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, signal_key)
);

create index if not exists account_device_signals_user_idx
  on public.account_device_signals(user_id);
create index if not exists account_device_signals_device_idx
  on public.account_device_signals(device_hash) where device_hash is not null;
create index if not exists account_device_signals_fp_idx
  on public.account_device_signals(fingerprint_hash) where fingerprint_hash is not null;
create index if not exists account_device_signals_ipua_idx
  on public.account_device_signals(ip_ua_hash) where ip_ua_hash is not null;

create table if not exists public.ban_evasion_blocks (
  id bigserial primary key,
  source_user_id uuid references auth.users(id) on delete cascade,
  signal_type text not null check (signal_type in ('device','fingerprint','ip_ua')),
  signal_hash text not null,
  reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ban_evasion_blocks_lookup_idx
  on public.ban_evasion_blocks(signal_type, signal_hash);
create index if not exists ban_evasion_blocks_source_idx
  on public.ban_evasion_blocks(source_user_id);
create index if not exists ban_evasion_blocks_expiry_idx
  on public.ban_evasion_blocks(expires_at);

create table if not exists public.ban_evasion_hits (
  id bigserial primary key,
  attempted_user_id uuid references auth.users(id) on delete set null,
  source_user_id uuid references auth.users(id) on delete set null,
  matched_signal_type text,
  matched_signal_hash text,
  device_hash text,
  fingerprint_hash text,
  ip_ua_hash text,
  outcome text not null default 'blocked',
  created_at timestamptz not null default now()
);

create index if not exists ban_evasion_hits_created_idx
  on public.ban_evasion_hits(created_at desc);

alter table public.account_device_signals enable row level security;
alter table public.ban_evasion_blocks enable row level security;
alter table public.ban_evasion_hits enable row level security;

revoke all on public.account_device_signals from anon, authenticated;
revoke all on public.ban_evasion_blocks from anon, authenticated;
revoke all on public.ban_evasion_hits from anon, authenticated;

create or replace function public.block_known_signals_for_user(
  p_user_id uuid,
  p_reason text default null,
  p_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;

  insert into public.ban_evasion_blocks(source_user_id, signal_type, signal_hash, reason, expires_at)
  select p_user_id, 'device', s.device_hash, p_reason, p_expires_at
  from public.account_device_signals s
  where s.user_id = p_user_id and s.device_hash is not null
    and not exists (
      select 1 from public.ban_evasion_blocks b
      where b.source_user_id = p_user_id
        and b.signal_type = 'device'
        and b.signal_hash = s.device_hash
    );

  insert into public.ban_evasion_blocks(source_user_id, signal_type, signal_hash, reason, expires_at)
  select p_user_id, 'fingerprint', s.fingerprint_hash, p_reason, p_expires_at
  from public.account_device_signals s
  where s.user_id = p_user_id and s.fingerprint_hash is not null
    and not exists (
      select 1 from public.ban_evasion_blocks b
      where b.source_user_id = p_user_id
        and b.signal_type = 'fingerprint'
        and b.signal_hash = s.fingerprint_hash
    );

  -- Network+browser is retained as a lower-confidence signal for staff/audit.
  insert into public.ban_evasion_blocks(source_user_id, signal_type, signal_hash, reason, expires_at)
  select p_user_id, 'ip_ua', s.ip_ua_hash, p_reason, p_expires_at
  from public.account_device_signals s
  where s.user_id = p_user_id and s.ip_ua_hash is not null
    and not exists (
      select 1 from public.ban_evasion_blocks b
      where b.source_user_id = p_user_id
        and b.signal_type = 'ip_ua'
        and b.signal_hash = s.ip_ua_hash
    );
end;
$$;

create or replace function public.unblock_known_signals_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.ban_evasion_blocks where source_user_id = p_user_id;
end;
$$;

create or replace function public.f2w_account_login_ban_signal_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.unblock_known_signals_for_user(old.user_id);
    return old;
  end if;

  if new.expires_at is null or new.expires_at > now() then
    perform public.block_known_signals_for_user(
      new.user_id,
      coalesce(new.reason, 'Account login ban'),
      new.expires_at
    );
  else
    perform public.unblock_known_signals_for_user(new.user_id);
  end if;

  return new;
end;
$$;

drop trigger if exists f2w_account_login_ban_signal_trg on public.account_login_bans;
create trigger f2w_account_login_ban_signal_trg
after insert or update or delete on public.account_login_bans
for each row execute function public.f2w_account_login_ban_signal_trigger();

create or replace function public.f2w_site_ban_signal_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_alias text;
begin
  v_alias := case when tg_op = 'DELETE' then old.alias else new.alias end;

  select p.user_id
    into v_user_id
  from public.profiles p
  where lower(p.username) = lower(v_alias)
  limit 1;

  if v_user_id is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    perform public.unblock_known_signals_for_user(v_user_id);
    return old;
  end if;

  if new.expires_at is null or new.expires_at > now() then
    perform public.block_known_signals_for_user(
      v_user_id,
      coalesce(new.reason, 'Site suspension'),
      new.expires_at
    );
  else
    perform public.unblock_known_signals_for_user(v_user_id);
  end if;

  return new;
end;
$$;

drop trigger if exists f2w_site_ban_signal_trg on public.chat_bans;
create trigger f2w_site_ban_signal_trg
after insert or update or delete on public.chat_bans
for each row execute function public.f2w_site_ban_signal_trigger();

-- Seed block rows for accounts that are already banned right now.
do $$
declare
  r record;
  v_user_id uuid;
begin
  if to_regclass('public.account_login_bans') is not null then
    for r in
      select user_id, reason, expires_at
      from public.account_login_bans
      where expires_at is null or expires_at > now()
    loop
      perform public.block_known_signals_for_user(r.user_id, r.reason, r.expires_at);
    end loop;
  end if;

  if to_regclass('public.chat_bans') is not null then
    for r in
      select alias, reason, expires_at
      from public.chat_bans
      where expires_at is null or expires_at > now()
    loop
      select p.user_id into v_user_id
      from public.profiles p
      where lower(p.username) = lower(r.alias)
      limit 1;

      if v_user_id is not null then
        perform public.block_known_signals_for_user(v_user_id, r.reason, r.expires_at);
      end if;
    end loop;
  end if;
end;
$$;

select pg_notify('pgrst', 'reload schema');

-- f2w-force-save:ban-evasion-sql-v1
-- f2w-force-save:1788212206
 