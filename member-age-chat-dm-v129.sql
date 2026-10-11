-- ============================================================
-- FLIX2WATCH v129 — ACCURATE MEMBER AGE + DM HOT-PATH FIXES
-- Run once in Supabase SQL Editor after v126. Safe to re-run.
-- ============================================================

-- 1) profiles.created_at is the site-wide public membership timestamp.
-- Backfill it from auth.users.created_at so old/migrated profile rows do not
-- make every account look the same age.
update public.profiles p
set created_at = u.created_at
from auth.users u
where p.user_id = u.id
  and p.created_at is distinct from u.created_at;

create or replace function public.f2w_keep_true_member_created_at_v129()
returns trigger
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_created timestamptz;
begin
  select created_at into v_created from auth.users where id=new.user_id;
  if v_created is not null then new.created_at:=v_created; end if;
  return new;
end $$;

drop trigger if exists f2w_true_member_created_at_v129 on public.profiles;
create trigger f2w_true_member_created_at_v129
before insert or update of created_at on public.profiles
for each row execute function public.f2w_keep_true_member_created_at_v129();

-- Lightweight authoritative accessor for profile shells/caches that need it.
create or replace function public.get_profile_member_since_v129(p_username text)
returns timestamptz
language sql
security definer
stable
set search_path=public,auth
as $$
  select u.created_at
  from public.profiles p
  join auth.users u on u.id=p.user_id
  where lower(p.username)=lower(trim(p_username))
  limit 1
$$;
grant execute on function public.get_profile_member_since_v129(text) to anon,authenticated;

-- 2) DM read path: do not UPDATE already-viewed rows on every refresh.
-- The old unconditional UPDATE could emit realtime UPDATE events that caused
-- another loadThread(), which then wrote again and made threads feel stuck.
create or replace function public.get_dm_messages_v126(p_conversation_id uuid,p_limit integer default 100)
returns table(id uuid,sender_user_id uuid,body text,kind text,created_at timestamptz,viewed_at timestamptz,retention text)
language plpgsql security definer set search_path=public
as $$
declare v_me uuid:=auth.uid(); v_ret text;
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  select c.retention into v_ret from public.f2w_dm_conversations_v126 c
  where c.id=p_conversation_id and (c.user_a=v_me or c.user_b=v_me);
  if v_ret is null then raise exception 'Conversation not found'; end if;

  update public.f2w_dm_messages_v126
  set viewed_at=now()
  where conversation_id=p_conversation_id
    and sender_user_id<>v_me
    and kind='message'
    and viewed_at is null;

  if v_ret='after_viewing' then
    delete from public.f2w_dm_messages_v126
    where conversation_id=p_conversation_id
      and sender_user_id<>v_me
      and kind='message'
      and viewed_at is not null;
  end if;

  return query
  select m.id,m.sender_user_id,m.body,m.kind,m.created_at,m.viewed_at,v_ret
  from public.f2w_dm_messages_v126 m
  where m.conversation_id=p_conversation_id
    and (m.expires_at is null or m.expires_at>now())
  order by m.created_at asc
  limit greatest(1,least(coalesce(p_limit,100),200));
end $$;
grant execute on function public.get_dm_messages_v126(uuid,integer) to authenticated;

-- Keep conversation ordering cheap as message volume grows.
create index if not exists f2w_dm_conv_updated_v129_idx
  on public.f2w_dm_conversations_v126(updated_at desc);

-- Make realtime publication resilient if these tables were created after
-- Realtime was originally configured. Duplicate-object errors are ignored.
do $$
begin
  begin alter publication supabase_realtime add table public.f2w_dm_messages_v126; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.f2w_dm_conversations_v126; exception when duplicate_object then null; end;
end $$;
