-- Flix2Watch v161 — site-wide notifications hotfix
-- Safe to run after v160/v160.1/v160.2, even if earlier migrations only partially ran.

create table if not exists public.f2w_notifications_v125(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists f2w_notifications_v161_user_idx on public.f2w_notifications_v125(user_id,created_at desc);
alter table public.f2w_notifications_v125 enable row level security;

-- Drop first so PostgreSQL can never reject a changed return signature.
drop function if exists public.get_my_notifications_v161(integer);
create function public.get_my_notifications_v161(p_limit integer default 60)
returns table(id uuid,title text,message text,link text,read_at timestamptz,created_at timestamptz)
language sql security definer stable set search_path=public as $$
  select n.id,n.title,n.message,n.link,n.read_at,n.created_at
  from public.f2w_notifications_v125 n
  where n.user_id=auth.uid()
  order by n.created_at desc
  limit greatest(1,least(coalesce(p_limit,60),100));
$$;
revoke all on function public.get_my_notifications_v161(integer) from public;
grant execute on function public.get_my_notifications_v161(integer) to authenticated;

drop function if exists public.mark_my_notifications_read_v161();
create function public.mark_my_notifications_read_v161()
returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
  update public.f2w_notifications_v125
  set read_at=coalesce(read_at,now())
  where user_id=auth.uid() and read_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.mark_my_notifications_read_v161() from public;
grant execute on function public.mark_my_notifications_read_v161() to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.f2w_notifications_v125;
exception when duplicate_object then null; end $$;
