-- Flix2Watch V228 — reliable public profile favorites.
-- Run once. Does not alter existing favorite rows.

begin;

create or replace function public.get_public_profile_favorites_v228(
  p_username text
)
returns table(
  media_id bigint,
  media_type text,
  title text,
  poster_path text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare
  v_user uuid;
  v_private boolean;
begin
  select p.user_id,coalesce(p.is_private,false)
    into v_user,v_private
  from public.profiles p
  where lower(p.username)=lower(trim(regexp_replace(coalesce(p_username,''),'[^A-Za-z0-9]','','g')))
  limit 1;

  if v_user is null then
    return;
  end if;

  -- Private profiles expose favorites only to their owner.
  if v_private and auth.uid() is distinct from v_user then
    return;
  end if;

  return query
  select
    f.media_id,
    lower(f.media_type)::text,
    f.title,
    f.poster_path,
    f.created_at
  from public.user_favorites f
  where f.user_id=v_user
    and lower(f.media_type) in ('movie','tv')
  order by f.created_at desc;
end;
$$;

revoke all on function public.get_public_profile_favorites_v228(text) from public;
grant execute on function public.get_public_profile_favorites_v228(text) to anon,authenticated;

notify pgrst,'reload schema';

commit;

-- f2w-force-save:v228-public-favorites-sql:20260903
