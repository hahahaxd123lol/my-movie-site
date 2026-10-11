-- Flix2Watch v159 — full recovery + low-usage backend
-- Safe to re-run after v158. This migration is intentionally consolidated so
-- the site uses fewer RPCs/subscriptions while keeping realtime where it matters.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) ACCOUNT-SCOPED REALTIME MODERATION
-- ---------------------------------------------------------------------------
create table if not exists public.account_enforcement_v146 (
  user_id uuid primary key references auth.users(id) on delete cascade,
  site_suspended boolean not null default false,
  account_banned boolean not null default false,
  reason text,
  expires_at timestamptz,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

alter table public.account_enforcement_v146 enable row level security;
drop policy if exists "users read own enforcement v146" on public.account_enforcement_v146;
create policy "users read own enforcement v146" on public.account_enforcement_v146
for select using (auth.uid()=user_id);
grant select on public.account_enforcement_v146 to authenticated;

create or replace function public.get_my_account_enforcement_v159()
returns jsonb
language plpgsql security definer stable set search_path=public
as $$
declare r public.account_enforcement_v146%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('signed_in',false,'user_id',null,'site_suspended',false,'account_banned',false);
  end if;
  select * into r from public.account_enforcement_v146 where user_id=auth.uid();
  if not found or (r.expires_at is not null and r.expires_at<=now()) then
    return jsonb_build_object('signed_in',true,'user_id',auth.uid(),'site_suspended',false,'account_banned',false,'reason',null,'expires_at',null);
  end if;
  return jsonb_build_object(
    'signed_in',true,'user_id',r.user_id,
    'site_suspended',coalesce(r.site_suspended,false),
    'account_banned',coalesce(r.account_banned,false),
    'reason',r.reason,'expires_at',r.expires_at,'updated_at',r.updated_at
  );
end $$;
grant execute on function public.get_my_account_enforcement_v159() to authenticated;

create or replace function public.staff_set_account_enforcement_v159(
  p_user_id uuid,p_kind text,p_enabled boolean,p_minutes integer default null,p_reason text default null
)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_kind text:=lower(trim(coalesce(p_kind,'')));
  v_exp timestamptz;
  v_owner constant uuid:='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid;
  v_allowed boolean:=false;
begin
  v_allowed := auth.uid()=v_owner
    or exists(select 1 from public.chat_moderators m where m.user_id=auth.uid());
  if not v_allowed then raise exception 'Owner/Staff permission required'; end if;
  if p_user_id is null then raise exception 'Target account required'; end if;
  if p_user_id=v_owner then raise exception 'Owner cannot be restricted'; end if;
  if v_kind not in ('site-suspension','account-ban') then raise exception 'Unsupported enforcement type'; end if;
  v_exp:=case when coalesce(p_enabled,false) and coalesce(p_minutes,0)>0 then now()+make_interval(mins=>p_minutes) else null end;

  insert into public.account_enforcement_v146(user_id,site_suspended,account_banned,reason,expires_at,updated_by,updated_at)
  values(
    p_user_id,
    v_kind='site-suspension' and coalesce(p_enabled,false),
    v_kind='account-ban' and coalesce(p_enabled,false),
    case when p_enabled then nullif(trim(coalesce(p_reason,'')),'') else null end,
    v_exp,auth.uid(),now()
  )
  on conflict(user_id) do update set
    site_suspended=case when v_kind='site-suspension' then coalesce(p_enabled,false) else account_enforcement_v146.site_suspended end,
    account_banned=case when v_kind='account-ban' then coalesce(p_enabled,false) else account_enforcement_v146.account_banned end,
    reason=case when p_enabled then nullif(trim(coalesce(p_reason,'')),'')
                when v_kind='site-suspension' and not account_enforcement_v146.account_banned then null
                when v_kind='account-ban' and not account_enforcement_v146.site_suspended then null
                else account_enforcement_v146.reason end,
    expires_at=case when p_enabled then v_exp
                    when (v_kind='site-suspension' and not account_enforcement_v146.account_banned)
                      or (v_kind='account-ban' and not account_enforcement_v146.site_suspended) then null
                    else account_enforcement_v146.expires_at end,
    updated_by=auth.uid(),updated_at=now();

  return jsonb_build_object('ok',true,'user_id',p_user_id,'kind',v_kind,'enabled',coalesce(p_enabled,false),'expires_at',v_exp);
end $$;
grant execute on function public.staff_set_account_enforcement_v159(uuid,text,boolean,integer,text) to authenticated;

create or replace function public.staff_clear_account_restrictions_v159(p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_owner constant uuid:='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid;
  v_allowed boolean:=false;
begin
  v_allowed := auth.uid()=v_owner
    or exists(select 1 from public.chat_moderators m where m.user_id=auth.uid());
  if not v_allowed then raise exception 'Owner/Staff permission required'; end if;
  if p_user_id is null then raise exception 'Target account required'; end if;

  update public.account_enforcement_v146
     set site_suspended=false,account_banned=false,reason=null,expires_at=null,updated_by=auth.uid(),updated_at=now()
   where user_id=p_user_id;

  -- Remove the old login-ban mirror if that older table is installed. This is
  -- what previously kept test accounts blocked after Site Suspension was removed.
  if to_regclass('public.account_login_bans') is not null then
    execute 'delete from public.account_login_bans where user_id=$1' using p_user_id;
  end if;

  return jsonb_build_object('ok',true,'user_id',p_user_id);
end $$;
grant execute on function public.staff_clear_account_restrictions_v159(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) OWNER -> STAFF, NO ALIAS-ONLY STATE
-- ---------------------------------------------------------------------------
create table if not exists public.staff_permission_overrides (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null,
  allowed boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(user_id,permission)
);

create or replace function public.owner_set_staff_v159(p_username text,p_enabled boolean)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_owner constant uuid:='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid;
  v_uid uuid; v_username text;
begin
  if auth.uid() is distinct from v_owner then raise exception 'Owner permission required'; end if;
  select p.user_id,p.username into v_uid,v_username
  from public.profiles p where lower(p.username)=lower(trim(coalesce(p_username,''))) limit 1;
  if v_uid is null then raise exception 'User not found'; end if;
  if v_uid=v_owner then raise exception 'Owner role cannot be changed'; end if;

  delete from public.chat_moderators where user_id=v_uid or lower(coalesce(alias,''))=lower(v_username);
  if coalesce(p_enabled,false) then
    insert into public.chat_moderators(alias,user_id) values(lower(v_username),v_uid);
  else
    delete from public.staff_permission_overrides where user_id=v_uid;
  end if;
  return jsonb_build_object('ok',true,'user_id',v_uid,'username',v_username,'staff',coalesce(p_enabled,false));
end $$;
grant execute on function public.owner_set_staff_v159(text,boolean) to authenticated;

create or replace function public.owner_set_staff_permission_v159(p_username text,p_permission text,p_allowed boolean)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare
  v_owner constant uuid:='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid;
  v_uid uuid; v_perm text:=lower(trim(coalesce(p_permission,'')));
begin
  if auth.uid() is distinct from v_owner then raise exception 'Owner permission required'; end if;
  select user_id into v_uid from public.profiles where lower(username)=lower(trim(coalesce(p_username,''))) limit 1;
  if v_uid is null then raise exception 'User not found'; end if;
  if v_perm='' then raise exception 'Permission required'; end if;
  insert into public.staff_permission_overrides(user_id,permission,allowed,updated_at)
  values(v_uid,v_perm,coalesce(p_allowed,false),now())
  on conflict(user_id,permission) do update set allowed=excluded.allowed,updated_at=now();
  return jsonb_build_object('ok',true,'user_id',v_uid,'permission',v_perm,'allowed',coalesce(p_allowed,false));
end $$;
grant execute on function public.owner_set_staff_permission_v159(text,text,boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) FAST USER SEARCH (single indexed RPC; no exact-count scan from browser)
-- ---------------------------------------------------------------------------
create index if not exists profiles_username_lower_v159_idx on public.profiles(lower(username));
create or replace function public.search_public_users_v159(p_query text,p_page integer default 1,p_page_size integer default 30)
returns table(user_id uuid,username text,display_name text,avatar_url text,bio text,total_count bigint)
language sql security definer stable set search_path=public
as $$
with q as (
  select lower(regexp_replace(trim(coalesce(p_query,'')),'[^A-Za-z0-9]','','g')) as s,
         greatest(1,coalesce(p_page,1)) as pg,
         greatest(1,least(coalesce(p_page_size,30),30)) as sz
), rows as (
  select p.user_id,p.username,p.display_name,p.avatar_url,p.bio,
         count(*) over()::bigint as total_count
  from public.profiles p,q
  where q.s<>'' and lower(p.username) like q.s||'%'
  order by case when lower(p.username)=q.s then 0 else 1 end,lower(p.username)
  limit (select sz from q)
  offset ((select pg from q)-1)*(select sz from q)
)
select * from rows;
$$;
grant execute on function public.search_public_users_v159(text,integer,integer) to anon,authenticated;

-- ---------------------------------------------------------------------------
-- 4) FAST LEADERBOARD BUNDLE: ONE RPC EVERY 30 SECONDS, XP ORDER ONLY
-- ---------------------------------------------------------------------------
create or replace function public.get_public_leaderboard_bundle_v159(p_page integer default 1,p_page_size integer default 25)
returns jsonb
language sql security definer stable set search_path=public
as $$
with title_keys as (
  select a.user_id,coalesce(a.media_type,'')::text media_type,a.media_id::text media_id
  from public.profile_title_activity a
  union
  select w.user_id,coalesce(w.media_type,'')::text,w.media_id::text
  from public.profile_watch_time w where greatest(coalesce(w.seconds,0),0)>0
), activity as (
  select user_id,count(*)::bigint titles_watched from title_keys group by user_id
), watchtime as (
  select user_id,floor(sum(greatest(coalesce(seconds,0),0))/60.0)::bigint watch_minutes
  from public.profile_watch_time group by user_id
), ratings as (
  select user_id,count(*)::bigint ratings_count from public.user_ratings group by user_id
), base0 as (
  select p.user_id,p.username,p.display_name,p.avatar_url,pr.last_seen_at,
    coalesce(pr.online_until>now(),false) online,
    coalesce(a.titles_watched,0)::bigint titles_watched,
    coalesce(w.watch_minutes,0)::bigint watch_minutes,
    coalesce(r.ratings_count,0)::bigint ratings_count,
    public.resolve_public_top_role(p.user_id,p.username) top_role,
    p.bio
  from public.profiles p
  left join public.user_presence pr on pr.user_id=p.user_id
  left join activity a on a.user_id=p.user_id
  left join watchtime w on w.user_id=p.user_id
  left join ratings r on r.user_id=p.user_id
  where nullif(trim(coalesce(p.username,'')),'') is not null
), base as (
  select b.*,
    ((case when nullif(trim(coalesce(b.avatar_url,'')),'') is not null then 1 else 0 end)+
     (case when nullif(trim(coalesce(b.bio,'')),'') is not null then 1 else 0 end)+
     (case when nullif(trim(coalesce(b.display_name,'')),'') is not null then 1 else 0 end)+
     (case when b.titles_watched>=1 then 1 else 0 end)+
     (case when b.titles_watched>=10 then 1 else 0 end)+
     (case when b.ratings_count>=1 then 1 else 0 end)+
     (case when b.top_role is not null then 1 else 0 end))::integer achievements
  from base0 b
), ranked as (
  select b.*,
    (b.watch_minutes*20+b.titles_watched*5+b.ratings_count*10+b.achievements*25)::bigint score,
    row_number() over(order by (b.watch_minutes*20+b.titles_watched*5+b.ratings_count*10+b.achievements*25) desc,b.watch_minutes desc,b.titles_watched desc,lower(b.username))::bigint rank_no,
    count(*) over()::bigint total_count
  from base b
), page_rows as (
  select * from ranked
  order by rank_no
  limit greatest(1,least(coalesce(p_page_size,25),100))
  offset (greatest(coalesce(p_page,1),1)-1)*greatest(1,least(coalesce(p_page_size,25),100))
)
select jsonb_build_object(
  'rows',coalesce((select jsonb_agg(jsonb_build_object(
    'rank_no',x.rank_no,'user_id',x.user_id,'username',x.username,'display_name',x.display_name,'avatar_url',x.avatar_url,
    'last_seen_at',x.last_seen_at,'online',x.online,'titles_watched',x.titles_watched,'watch_minutes',x.watch_minutes,
    'ratings_count',x.ratings_count,'achievements',x.achievements,'score',x.score,'top_role',x.top_role,'total_count',x.total_count
  ) order by x.rank_no) from page_rows x),'[]'::jsonb),
  'stats',jsonb_build_object(
    'registered_players',(select count(*)::bigint from base),
    'online_now',(select count(*)::bigint from base where online),
    'combined_watch_minutes',coalesce((select sum(watch_minutes)::bigint from base),0)
  )
);
$$;
grant execute on function public.get_public_leaderboard_bundle_v159(integer,integer) to anon,authenticated;

-- ---------------------------------------------------------------------------
-- 5) CHAT BOOTSTRAP IN ONE RPC. Images are disabled.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_chat_bootstrap()
returns jsonb
language plpgsql security definer stable set search_path=public
as $$
declare v_messages jsonb:='[]'::jsonb; v_announcement jsonb:='null'::jsonb;
begin
  if to_regclass('public.chat_messages') is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',m.id,'alias',m.alias,'message',m.message,'created_at',m.created_at,
      'owner',(lower(coalesce(m.alias,''))='josh' or m.owner_id is not null),
      'moderator',exists(select 1 from public.chat_moderators cm where lower(cm.alias)=lower(m.alias))
    ) order by m.created_at asc),'[]'::jsonb)
    into v_messages
    from (
      select * from public.chat_messages
      where created_at>now()-interval '24 hours'
      order by created_at desc limit 200
    ) m;
  end if;

  if to_regprocedure('public.get_active_announcement_v146()') is not null then
    execute 'select public.get_active_announcement_v146()' into v_announcement;
  end if;

  return jsonb_build_object(
    'success',true,
    'messages',coalesce(v_messages,'[]'::jsonb),
    'announcement',v_announcement,
    'config',jsonb_build_object('chat_locked',false,'chat_slow_mode_seconds',0,'chat_uploads_enabled',false,'chat_pinned_message_id',null),
    'pinned_message',null
  );
end $$;
grant execute on function public.get_public_chat_bootstrap() to anon,authenticated;

-- ---------------------------------------------------------------------------
-- 6) FORUM LEGACY AUTHOR COLUMN REPAIR + WORKING POST RPCS
-- ---------------------------------------------------------------------------
create or replace function public.f2w_forum_sync_author_v159()
returns trigger language plpgsql as $$
begin
  begin
    if new.author_user_id is null then new.author_user_id:=new.author_id; end if;
    if new.author_id is null then new.author_id:=new.author_user_id; end if;
  exception when undefined_column then null;
  end;
  return new;
end $$;

do $$
begin
  if to_regclass('public.forum_threads') is not null then
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name='forum_threads' and column_name='author_id')
       and exists(select 1 from information_schema.columns where table_schema='public' and table_name='forum_threads' and column_name='author_user_id') then
      execute 'update public.forum_threads set author_user_id=coalesce(author_user_id,author_id), author_id=coalesce(author_id,author_user_id) where author_user_id is null or author_id is null';
      execute 'drop trigger if exists f2w_forum_thread_sync_author_v159 on public.forum_threads';
      execute 'create trigger f2w_forum_thread_sync_author_v159 before insert or update on public.forum_threads for each row execute function public.f2w_forum_sync_author_v159()';
    end if;
  end if;
  if to_regclass('public.forum_replies') is not null then
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name='forum_replies' and column_name='author_id')
       and exists(select 1 from information_schema.columns where table_schema='public' and table_name='forum_replies' and column_name='author_user_id') then
      execute 'update public.forum_replies set author_user_id=coalesce(author_user_id,author_id), author_id=coalesce(author_id,author_user_id) where author_user_id is null or author_id is null';
      execute 'drop trigger if exists f2w_forum_reply_sync_author_v159 on public.forum_replies';
      execute 'create trigger f2w_forum_reply_sync_author_v159 before insert or update on public.forum_replies for each row execute function public.f2w_forum_sync_author_v159()';
    end if;
  end if;
end $$;

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

-- ---------------------------------------------------------------------------
-- 7) KEEP ONLY THE TABLES THAT ACTUALLY NEED REALTIME PUBLICATION
-- ---------------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.account_enforcement_v146; exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.chat_messages; exception when duplicate_object then null; when undefined_object then null; end;
  -- Presence/current-watching may already be published; do not add forum,
  -- announcements or leaderboard tables here. Those use bounded 30/60s refreshes.
end $$;

-- Primary stream remains enabled and #1.
do $$
begin
  if to_regclass('public.stream_source_status_v146') is not null then
    update public.stream_source_status_v146 set enabled=true,priority=1,updated_at=now() where source_name='flix2watchapi';
    update public.stream_source_status_v146 set priority=greatest(priority,2),updated_at=now() where source_name<>'flix2watchapi' and priority<=1;
  end if;
end $$;

notify pgrst,'reload schema';
