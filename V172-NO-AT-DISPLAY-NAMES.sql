-- Flix2Watch v172: display names may never contain @.
-- Usernames/handles and /profile/@username routes are NOT changed.

begin;

update public.profiles
set display_name = nullif(trim(regexp_replace(coalesce(display_name,''), '@', '', 'g')), ''),
    updated_at = coalesce(updated_at, now())
where display_name is not null
  and position('@' in display_name) > 0;

update auth.users
set raw_user_meta_data = jsonb_set(
      coalesce(raw_user_meta_data, '{}'::jsonb),
      '{display_name}',
      to_jsonb(regexp_replace(coalesce(raw_user_meta_data->>'display_name',''), '@', '', 'g')),
      true
    )
where coalesce(raw_user_meta_data->>'display_name','') like '%@%';

create or replace function public.f2w_strip_at_from_display_name_v172()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.display_name is not null then
    new.display_name := nullif(trim(regexp_replace(new.display_name, '@', '', 'g')), '');
  end if;
  return new;
end;
$$;

drop trigger if exists f2w_strip_at_from_display_name_v172 on public.profiles;
create trigger f2w_strip_at_from_display_name_v172
before insert or update of display_name on public.profiles
for each row execute function public.f2w_strip_at_from_display_name_v172();

alter table public.profiles drop constraint if exists profiles_display_name_no_at_v172;
alter table public.profiles
  add constraint profiles_display_name_no_at_v172
  check (display_name is null or position('@' in display_name)=0) not valid;
alter table public.profiles validate constraint profiles_display_name_no_at_v172;

commit;
