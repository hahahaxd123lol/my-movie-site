-- Flix2Watch V201 — enforcement notification compatibility + public playback telemetry
-- Safe to rerun.
begin;

-- -----------------------------------------------------------------------------
-- 1) STAFF ENFORCEMENT FIX
-- Older installs created a hardcoded notification_type CHECK. Newer moderation
-- events can legitimately use additional notification labels, so that old CHECK
-- can roll back the entire suspension/ban transaction. Keep notification_type
-- NOT NULL, but remove the obsolete enum-like constraint.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.user_notifications') is not null then
    alter table public.user_notifications
      drop constraint if exists user_notifications_notification_type_check;
  end if;
end $$;

-- Re-install one canonical enforcement notification trigger. This uses stable
-- notification types that every existing notification UI already understands.
create or replace function public.f2w_notify_enforcement_change_v201()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_actor uuid := new.updated_by;
  v_old_site boolean := case when tg_op='INSERT' then false else coalesce(old.site_suspended,false) end;
  v_old_ban  boolean := case when tg_op='INSERT' then false else coalesce(old.account_banned,false) end;
  v_new_site boolean := coalesce(new.site_suspended,false);
  v_new_ban  boolean := coalesce(new.account_banned,false);
  v_reason text := nullif(trim(coalesce(new.reason,'')),'');
begin
  if to_regclass('public.user_notifications') is null then
    return new;
  end if;

  if v_old_site is distinct from v_new_site then
    insert into public.user_notifications(user_id,actor_user_id,notification_type,title,body,link)
    select
      new.user_id,
      v_actor,
      'system',
      case when v_new_site then 'Site suspension applied' else 'Site suspension removed' end,
      case
        when v_new_site and v_reason is not null then 'Your site access was suspended. Reason: '||v_reason
        when v_new_site then 'Your site access was suspended.'
        else 'Your site suspension was removed.'
      end,
      '/support/'
    where not exists (
      select 1 from public.user_notifications n
      where n.user_id=new.user_id
        and n.title=(case when v_new_site then 'Site suspension applied' else 'Site suspension removed' end)
        and n.created_at>clock_timestamp()-interval '6 seconds'
    );
  end if;

  if v_old_ban is distinct from v_new_ban then
    insert into public.user_notifications(user_id,actor_user_id,notification_type,title,body,link)
    select
      new.user_id,
      v_actor,
      case when v_new_ban then 'ban' else 'unban' end,
      case when v_new_ban then 'Account login ban applied' else 'Account login ban removed' end,
      case
        when v_new_ban and v_reason is not null then 'Your account login was banned. Reason: '||v_reason
        when v_new_ban then 'Your account login was banned.'
        else 'Your account login ban was removed.'
      end,
      '/account/'
    where not exists (
      select 1 from public.user_notifications n
      where n.user_id=new.user_id
        and n.title=(case when v_new_ban then 'Account login ban applied' else 'Account login ban removed' end)
        and n.created_at>clock_timestamp()-interval '6 seconds'
    );
  end if;

  return new;
end;
$$;

-- Remove the previous canonical trigger so one moderation change creates one
-- notification, not two competing notifications.
do $$
begin
  if to_regclass('public.account_enforcement_v146') is not null then
    execute 'drop trigger if exists f2w_notify_enforcement_change_v183 on public.account_enforcement_v146';
    execute 'drop trigger if exists f2w_notify_enforcement_change_v201 on public.account_enforcement_v146';
    execute 'create trigger f2w_notify_enforcement_change_v201 after insert or update of site_suspended,account_banned,reason on public.account_enforcement_v146 for each row execute function public.f2w_notify_enforcement_change_v201()';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2) PROFILE CURRENTLY-WATCHING TELEMETRY
-- The Watch page writes one consolidated row. Profile clients fetch the snapshot
-- and animate the clock locally every second. Pause/play/seek changes can be
-- persisted immediately without doing one database write per displayed second.
-- -----------------------------------------------------------------------------
alter table if exists public.current_watching_v125
  add column if not exists source_key text,
  add column if not exists position_seconds integer,
  add column if not exists duration_seconds integer,
  add column if not exists playback_status text,
  add column if not exists progress_updated_at timestamptz;

create or replace function public.get_public_current_watching_v201(p_username text)
returns table(
  user_id uuid,
  media_type text,
  media_id bigint,
  title text,
  poster_path text,
  last_seen_at timestamptz,
  source_key text,
  position_seconds integer,
  duration_seconds integer,
  playback_status text,
  progress_updated_at timestamptz
)
language sql
security definer
stable
set search_path=public
as $$
  select
    c.user_id,
    c.media_type,
    c.media_id,
    c.title,
    coalesce(c.poster_path,r.poster_path),
    c.last_seen_at,
    c.source_key,
    c.position_seconds,
    c.duration_seconds,
    coalesce(nullif(c.playback_status,''),'unknown'),
    c.progress_updated_at
  from public.current_watching_v125 c
  join public.profiles p on p.user_id=c.user_id
  left join public.profile_recent_views_v59 r
    on r.user_id=c.user_id
   and r.media_type=c.media_type
   and r.media_id=c.media_id
  where lower(p.username)=lower(trim(p_username))
    and c.last_seen_at>clock_timestamp()-interval '75 seconds'
    and (coalesce(p.is_private,false)=false or auth.uid()=p.user_id)
  limit 1;
$$;

revoke all on function public.get_public_current_watching_v201(text) from public;
grant execute on function public.get_public_current_watching_v201(text) to anon,authenticated;

-- Needed for immediate pause/play snapshots on open profile pages.
do $$
begin
  if to_regclass('public.current_watching_v125') is not null
     and not exists (
       select 1 from pg_publication_tables
       where pubname='supabase_realtime'
         and schemaname='public'
         and tablename='current_watching_v125'
     ) then
    alter publication supabase_realtime add table public.current_watching_v125;
  end if;
end $$;

commit;
