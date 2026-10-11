-- ============================================================
-- FLIX2WATCH CHAT IMAGE UPLOADS
-- Run once in Supabase SQL Editor.
-- Images are public to view but only authenticated users can upload.
-- Users can only write inside their own UUID folder.
-- ============================================================

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public=true,
  file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'];

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
