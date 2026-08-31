-- ============================================================
-- FLIX2WATCH SECURITY HARDENING - FINAL
-- Run this whole script once in Supabase SQL Editor.
--
-- The browser UI is NOT the security boundary.
-- These RLS/storage rules are.
-- ============================================================

-- ---------------- PROFILES ----------------
alter table public.profiles enable row level security;

drop policy if exists "Public can read profiles" on public.profiles;
create policy "Public can read profiles"
on public.profiles
for select
to anon, authenticated
using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

revoke insert, update, delete on table public.profiles from anon;
grant select on table public.profiles to anon;
grant select, insert, update on table public.profiles to authenticated;

-- ---------------- FAVORITES ----------------
alter table public.user_favorites enable row level security;

drop policy if exists "Users can insert own favorites" on public.user_favorites;
create policy "Users can insert own favorites"
on public.user_favorites
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own favorites" on public.user_favorites;
create policy "Users can delete own favorites"
on public.user_favorites
for delete
to authenticated
using (auth.uid() = user_id);

revoke insert, update, delete on table public.user_favorites from anon;
grant select on table public.user_favorites to anon, authenticated;
grant insert, delete on table public.user_favorites to authenticated;

-- ---------------- PROFILE AVATARS ----------------
drop policy if exists "Public can view profile avatars" on storage.objects;
create policy "Public can view profile avatars"
on storage.objects
for select
to public
using (bucket_id='profile-avatars');

drop policy if exists "Users upload own profile avatars" on storage.objects;
create policy "Users upload own profile avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id='profile-avatars'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "Users update own profile avatars" on storage.objects;
create policy "Users update own profile avatars"
on storage.objects
for update
to authenticated
using (
  bucket_id='profile-avatars'
  and (storage.foldername(name))[1]=auth.uid()::text
)
with check (
  bucket_id='profile-avatars'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "Users delete own profile avatars" on storage.objects;
create policy "Users delete own profile avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id='profile-avatars'
  and (storage.foldername(name))[1]=auth.uid()::text
);

-- ---------------- PROFILE BACKGROUNDS ----------------
drop policy if exists "Public can view profile backgrounds" on storage.objects;
create policy "Public can view profile backgrounds"
on storage.objects
for select
to public
using (bucket_id='profile-backgrounds');

drop policy if exists "Users upload own profile backgrounds" on storage.objects;
create policy "Users upload own profile backgrounds"
on storage.objects
for insert
to authenticated
with check (
  bucket_id='profile-backgrounds'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "Users update own profile backgrounds" on storage.objects;
create policy "Users update own profile backgrounds"
on storage.objects
for update
to authenticated
using (
  bucket_id='profile-backgrounds'
  and (storage.foldername(name))[1]=auth.uid()::text
)
with check (
  bucket_id='profile-backgrounds'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "Users delete own profile backgrounds" on storage.objects;
create policy "Users delete own profile backgrounds"
on storage.objects
for delete
to authenticated
using (
  bucket_id='profile-backgrounds'
  and (storage.foldername(name))[1]=auth.uid()::text
);

-- ---------------- CHAT MEDIA ----------------
drop policy if exists "Public can view chat media" on storage.objects;
create policy "Public can view chat media"
on storage.objects
for select
to public
using (bucket_id='chat-media');

drop policy if exists "Authenticated users upload own chat media" on storage.objects;
create policy "Authenticated users upload own chat media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id='chat-media'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists "Users delete own chat media" on storage.objects;
create policy "Users delete own chat media"
on storage.objects
for delete
to authenticated
using (
  bucket_id='chat-media'
  and (storage.foldername(name))[1]=auth.uid()::text
);

-- ---------------- FOLLOWING ----------------
alter table public.profile_follows enable row level security;

drop policy if exists "Users can follow other users" on public.profile_follows;
create policy "Users can follow other users"
on public.profile_follows
for insert
to authenticated
with check (
  auth.uid()=follower_user_id
  and follower_user_id<>followed_user_id
);

drop policy if exists "Users can unfollow" on public.profile_follows;
create policy "Users can unfollow"
on public.profile_follows
for delete
to authenticated
using (auth.uid()=follower_user_id);

revoke insert, update, delete on table public.profile_follows from anon;
grant select on table public.profile_follows to authenticated;
grant insert, delete on table public.profile_follows to authenticated;
