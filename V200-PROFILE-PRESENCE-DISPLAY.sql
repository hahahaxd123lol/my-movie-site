-- FLIX2WATCH V200 — profile presence + display-name cleanup + profile editor backend.
-- Safe to re-run in Supabase SQL Editor.

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists bio text not null default '',
  add column if not exists is_private boolean not null default false,
  add column if not exists favorite_genres text[] not null default '{}'::text[],
  add column if not exists website_url text,
  add column if not exists instagram_username text,
  add column if not exists discord_username text,
  add column if not exists snapchat_username text,
  add column if not exists steam_profile text,
  add column if not exists tiktok_username text;

-- Remove @ from every existing display name. Usernames are untouched.
update public.profiles
set display_name = nullif(trim(replace(coalesce(display_name,''),'@','')),'')
where display_name is not null and position('@' in display_name)>0;

-- Keep display names clean for all future inserts/updates, regardless of which code path writes them.
create or replace function public.f2w_clean_display_name_v200()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.display_name is not null then
    new.display_name := nullif(left(trim(replace(new.display_name,'@','')),50),'');
  end if;
  return new;
end
$$;

drop trigger if exists f2w_clean_display_name_v200_trg on public.profiles;
create trigger f2w_clean_display_name_v200_trg
before insert or update of display_name on public.profiles
for each row execute function public.f2w_clean_display_name_v200();

create or replace function public.get_profile_member_since_v200(p_username text)
returns timestamptz
language sql
security definer
stable
set search_path=public,auth
as $$
  select u.created_at
  from public.profiles p
  join auth.users u on u.id=p.user_id
  where lower(p.username)=lower(trim(regexp_replace(coalesce(p_username,''),'[^A-Za-z0-9]','','g')))
  limit 1
$$;
grant execute on function public.get_profile_member_since_v200(text) to anon,authenticated;

create or replace function public.touch_presence_v200()
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_me uuid:=auth.uid(); v_now timestamptz:=clock_timestamp();
begin
  if v_me is null then return; end if;
  insert into public.user_presence(user_id,last_seen_at,updated_at,online_until)
  values(v_me,v_now,v_now,v_now+interval '70 seconds')
  on conflict(user_id) do update
  set last_seen_at=excluded.last_seen_at,
      updated_at=excluded.updated_at,
      online_until=excluded.online_until;
end
$$;
grant execute on function public.touch_presence_v200() to authenticated;

create or replace function public.get_public_profile_presence_v200(p_username text)
returns table(user_id uuid,last_seen_at timestamptz,online boolean)
language sql
security definer
stable
set search_path=public
as $$
  select p.user_id,
         greatest(up.last_seen_at,cw.last_seen_at) as last_seen_at,
         coalesce(up.online_until>clock_timestamp(),false)
         or coalesce(up.last_seen_at>clock_timestamp()-interval '70 seconds',false)
         or coalesce(cw.last_seen_at>clock_timestamp()-interval '75 seconds',false) as online
  from public.profiles p
  left join public.user_presence up on up.user_id=p.user_id
  left join lateral (
    select max(x.last_seen_at) as last_seen_at
    from public.current_watching_v125 x
    where x.user_id=p.user_id
  ) cw on true
  where lower(p.username)=lower(trim(regexp_replace(coalesce(p_username,''),'[^A-Za-z0-9]','','g')))
  limit 1
$$;
grant execute on function public.get_public_profile_presence_v200(text) to anon,authenticated;

create or replace function public.change_my_username_v200(p_username text)
returns text
language plpgsql
security definer
set search_path=public,auth
as $$
declare v_me uuid:=auth.uid(); v_next text:=trim(coalesce(p_username,''));
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if v_next !~ '^[A-Za-z0-9]{2,30}$' then raise exception 'Use 2-30 English letters or numbers.'; end if;
  if exists(select 1 from public.profiles p where p.user_id<>v_me and lower(p.username)=lower(v_next)) then raise exception 'That username is already taken.'; end if;
  update public.profiles set username=v_next,updated_at=clock_timestamp() where user_id=v_me;
  update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)||jsonb_build_object('username',v_next,'chat_alias',v_next),updated_at=clock_timestamp() where id=v_me;
  return v_next;
end
$$;
grant execute on function public.change_my_username_v200(text) to authenticated;

create or replace function public.update_my_profile_v200(
  p_display_name text default null,
  p_bio text default null,
  p_favorite_genres text[] default '{}'::text[],
  p_website_url text default null,
  p_instagram_username text default null,
  p_discord_username text default null,
  p_snapchat_username text default null,
  p_steam_profile text default null,
  p_tiktok_username text default null,
  p_is_private boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_me uuid:=auth.uid(); v_result jsonb; v_site text; v_steam text; v_display text;
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  v_display:=nullif(left(trim(replace(coalesce(p_display_name,''),'@','')),50),'');
  v_site:=nullif(left(trim(coalesce(p_website_url,'')),2048),'');
  if v_site is not null and v_site !~* '^https?://' then v_site:='https://'||v_site; end if;
  v_steam:=nullif(left(trim(coalesce(p_steam_profile,'')),2048),'');
  update public.profiles
  set display_name=v_display,
      bio=left(trim(coalesce(p_bio,'')),500),
      is_private=coalesce(p_is_private,false),
      favorite_genres=(select coalesce(array_agg(distinct left(trim(g),40)),'{}'::text[]) from unnest((coalesce(p_favorite_genres,'{}'::text[]))[1:19]) g where trim(g)<>''),
      website_url=v_site,
      instagram_username=nullif(left(trim(leading '@' from coalesce(p_instagram_username,'')),80),''),
      discord_username=nullif(left(trim(leading '@' from coalesce(p_discord_username,'')),80),''),
      snapchat_username=nullif(left(trim(leading '@' from coalesce(p_snapchat_username,'')),80),''),
      steam_profile=v_steam,
      tiktok_username=nullif(left(trim(leading '@' from coalesce(p_tiktok_username,'')),80),''),
      updated_at=clock_timestamp()
  where user_id=v_me;
  if not found then raise exception 'Profile not found'; end if;
  select to_jsonb(p) into v_result from public.profiles p where p.user_id=v_me;
  return v_result;
end
$$;
grant execute on function public.update_my_profile_v200(text,text,text[],text,text,text,text,text,text,boolean) to authenticated;

notify pgrst,'reload schema';
