-- Flix2Watch v177 — permanent removal of the retired forum/community feature.
-- Deploy the frontend first, then run this once.

drop function if exists public.get_forum_threads_v137(integer) cascade;
drop function if exists public.get_forum_thread_v137(uuid) cascade;
drop function if exists public.create_forum_thread_v137(text,text,text,boolean) cascade;
drop function if exists public.create_forum_reply_v137(uuid,text) cascade;
drop function if exists public.get_forum_threads_v30(integer) cascade;
drop function if exists public.get_forum_thread_v30(uuid) cascade;
drop function if exists public.create_forum_thread_v30(text,text,text,boolean) cascade;
drop function if exists public.create_forum_reply_v30(uuid,text) cascade;
drop function if exists public.f2w_forum_sync_author_v145() cascade;
drop function if exists public.f2w_forum_sync_author_v159() cascade;
drop table if exists public.forum_posts cascade;
drop table if exists public.forum_threads cascade;
