-- ============================================================
-- FLIX2WATCH v34 — DATABASE PERFORMANCE INDEXES
-- Safe to rerun. Additive only.
-- ============================================================

-- Helper: create an index only when every referenced column exists.
do $$
declare
  r record;
begin
  -- table_name, index_name, index_sql, required_columns
  for r in
    select * from (values
      ('profiles','profiles_username_lower_v34_idx',
       'create index if not exists profiles_username_lower_v34_idx on public.profiles (lower(username))',
       array['username']::text[]),

      ('profiles','profiles_user_id_v34_idx',
       'create index if not exists profiles_user_id_v34_idx on public.profiles (user_id)',
       array['user_id']::text[]),

      ('user_presence','user_presence_user_id_v34_idx',
       'create index if not exists user_presence_user_id_v34_idx on public.user_presence (user_id)',
       array['user_id']::text[]),

      ('user_presence','user_presence_online_until_v34_idx',
       'create index if not exists user_presence_online_until_v34_idx on public.user_presence (online_until desc)',
       array['online_until']::text[]),

      ('user_presence_sessions','presence_sessions_user_seen_v34_idx',
       'create index if not exists presence_sessions_user_seen_v34_idx on public.user_presence_sessions (user_id,last_seen_at desc)',
       array['user_id','last_seen_at']::text[]),

      ('profile_title_activity','profile_title_activity_user_last_v34_idx',
       'create index if not exists profile_title_activity_user_last_v34_idx on public.profile_title_activity (user_id,last_opened_at desc)',
       array['user_id','last_opened_at']::text[]),

      ('profile_watch_time','profile_watch_time_user_v34_idx',
       'create index if not exists profile_watch_time_user_v34_idx on public.profile_watch_time (user_id)',
       array['user_id']::text[]),

      ('user_ratings','user_ratings_user_v34_idx',
       'create index if not exists user_ratings_user_v34_idx on public.user_ratings (user_id)',
       array['user_id']::text[]),

      ('profile_comments','profile_comments_profile_created_v34_idx',
       'create index if not exists profile_comments_profile_created_v34_idx on public.profile_comments (profile_user_id,created_at desc)',
       array['profile_user_id','created_at']::text[]),

      ('profile_comments','profile_comments_author_created_v34_idx',
       'create index if not exists profile_comments_author_created_v34_idx on public.profile_comments (author_user_id,created_at desc)',
       array['author_user_id','created_at']::text[]),

      ('profile_role_assignments','profile_roles_user_role_v34_idx',
       'create index if not exists profile_roles_user_role_v34_idx on public.profile_role_assignments (user_id,role_key)',
       array['user_id','role_key']::text[]),

      ('chat_messages','chat_messages_created_v34_idx',
       'create index if not exists chat_messages_created_v34_idx on public.chat_messages (created_at desc)',
       array['created_at']::text[]),

      ('chat_messages','chat_messages_alias_created_v34_idx',
       'create index if not exists chat_messages_alias_created_v34_idx on public.chat_messages (alias,created_at desc)',
       array['alias','created_at']::text[]),

      ('chat_notifications','chat_notifications_user_created_v34_idx',
       'create index if not exists chat_notifications_user_created_v34_idx on public.chat_notifications (user_id,created_at desc)',
       array['user_id','created_at']::text[]),

      ('notifications','notifications_user_created_v34_idx',
       'create index if not exists notifications_user_created_v34_idx on public.notifications (user_id,created_at desc)',
       array['user_id','created_at']::text[]),

      ('forum_threads','forum_threads_updated_v34_idx',
       'create index if not exists forum_threads_updated_v34_idx on public.forum_threads (updated_at desc,created_at desc)',
       array['updated_at','created_at']::text[]),

      ('forum_threads','forum_threads_category_updated_v34_idx',
       'create index if not exists forum_threads_category_updated_v34_idx on public.forum_threads (category,updated_at desc)',
       array['category','updated_at']::text[]),

      ('forum_replies','forum_replies_thread_created_v34_idx',
       'create index if not exists forum_replies_thread_created_v34_idx on public.forum_replies (thread_id,created_at)',
       array['thread_id','created_at']::text[]),

      ('favorites','favorites_user_created_v34_idx',
       'create index if not exists favorites_user_created_v34_idx on public.favorites (user_id,created_at desc)',
       array['user_id','created_at']::text[])
    ) as x(table_name,index_name,index_sql,required_columns)
  loop
    if to_regclass('public.'||r.table_name) is not null
       and not exists (
         select 1
         from unnest(r.required_columns) c
         where not exists (
           select 1
           from information_schema.columns
           where table_schema='public'
             and table_name=r.table_name
             and column_name=c
         )
       )
    then
      execute r.index_sql;
    end if;
  end loop;
end $$;

-- Remove old chat rows immediately, then let the existing v31 pg_cron job keep
-- enforcing the 24-hour deletion policy.
do $$
begin
  if to_regprocedure('public.purge_flix2watch_chat_24h()') is not null then
    perform public.purge_flix2watch_chat_24h();
  end if;
end $$;

-- Refresh planner statistics for hot tables that exist.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','user_presence','user_presence_sessions',
    'profile_title_activity','profile_watch_time','user_ratings',
    'profile_comments','profile_role_assignments',
    'chat_messages','chat_notifications','notifications',
    'forum_threads','forum_replies','favorites'
  ]
  loop
    if to_regclass('public.'||t) is not null then
      execute format('analyze public.%I',t);
    end if;
  end loop;
end $$;

notify pgrst,'reload schema';

-- f2w-force-save:database-performance-v34:1788217565
 