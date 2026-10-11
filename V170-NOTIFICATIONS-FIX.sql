-- Flix2Watch v170: canonical notifications payload, schema-safe (UUID/bigint agnostic)
-- Uses JSONB so PostgreSQL does not have to match a declared notification id type.

create index if not exists f2w_notifications_v170_user_idx
  on public.f2w_notifications_v125(user_id, created_at desc);

alter table public.f2w_notifications_v125 enable row level security;

drop function if exists public.get_my_notifications_v170(integer);
create function public.get_my_notifications_v170(p_limit integer default 60)
returns jsonb
language sql
security definer
stable
set search_path=public
as $$
  with picked as (
    select n.id::text as id,
           n.title,
           n.message,
           n.link,
           n.created_at,
           n.read_at
    from public.f2w_notifications_v125 n
    where n.user_id = auth.uid()
    order by n.created_at desc
    limit greatest(1, least(coalesce(p_limit,60),100))
  )
  select jsonb_build_object(
    'rows', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'title', p.title,
          'message', p.message,
          'link', p.link,
          'created_at', p.created_at,
          'read_at', p.read_at
        ) order by p.created_at desc
      ), '[]'::jsonb
    ),
    'unread_count', count(*) filter (where p.read_at is null)
  )
  from picked p;
$$;
revoke all on function public.get_my_notifications_v170(integer) from public;
grant execute on function public.get_my_notifications_v170(integer) to authenticated;

drop function if exists public.mark_my_notifications_read_v170();
create function public.mark_my_notifications_read_v170()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_count integer := 0;
begin
  update public.f2w_notifications_v125
     set read_at = coalesce(read_at, now())
   where user_id = auth.uid()
     and read_at is null;
  get diagnostics v_count = row_count;
  return jsonb_build_object('updated', v_count, 'ok', true);
end;
$$;
revoke all on function public.mark_my_notifications_read_v170() from public;
grant execute on function public.mark_my_notifications_read_v170() to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='f2w_notifications_v125'
  ) then
    alter publication supabase_realtime add table public.f2w_notifications_v125;
  end if;
end $$;
