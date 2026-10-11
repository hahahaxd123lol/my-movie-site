-- Flix2Watch v164 - authoritative site suspension/account-ban setter + stale legacy cleanup
-- Safe to rerun.

drop function if exists public.staff_set_account_enforcement_v164(uuid,text,boolean,integer,text);
create function public.staff_set_account_enforcement_v164(
  p_user_id uuid,
  p_kind text,
  p_enabled boolean,
  p_minutes integer default null,
  p_reason text default null
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare
  v_actor uuid:=auth.uid();
  v_role text;
  v_exp timestamptz;
  v_row public.account_enforcement_v146%rowtype;
begin
  if v_actor is null then raise exception 'Not signed in'; end if;
  select lower(coalesce(role,'member')) into v_role from public.profiles where user_id=v_actor;
  if v_role not in ('owner','staff') then raise exception 'Owner or Staff required'; end if;
  if p_user_id is null then raise exception 'Missing target user'; end if;
  if p_kind not in ('site-suspension','account-ban') then raise exception 'Invalid enforcement kind'; end if;
  if coalesce(p_enabled,false) and coalesce(p_minutes,0)>0 then v_exp:=now()+make_interval(mins=>p_minutes); else v_exp:=null; end if;

  insert into public.account_enforcement_v146(user_id,site_suspended,account_banned,reason,expires_at,updated_at,updated_by)
  values(
    p_user_id,
    case when p_kind='site-suspension' then coalesce(p_enabled,false) else false end,
    case when p_kind='account-ban' then coalesce(p_enabled,false) else false end,
    case when p_enabled then nullif(trim(p_reason),'') else null end,
    v_exp,now(),v_actor
  )
  on conflict(user_id) do update set
    site_suspended=case when p_kind='site-suspension' then coalesce(p_enabled,false) else account_enforcement_v146.site_suspended end,
    account_banned=case when p_kind='account-ban' then coalesce(p_enabled,false) else account_enforcement_v146.account_banned end,
    reason=case when p_enabled then nullif(trim(p_reason),'') when p_kind in ('site-suspension','account-ban') then null else account_enforcement_v146.reason end,
    expires_at=case when p_enabled then v_exp else null end,
    updated_at=now(),updated_by=v_actor
  returning * into v_row;

  -- Turning either restriction off must also clear the stale legacy mirrors that caused old clients to remain blocked.
  if not coalesce(p_enabled,false) then
    begin
      update public.account_login_bans set enabled=false, expires_at=now(), updated_at=now() where user_id=p_user_id;
    exception when undefined_table or undefined_column then null;
    end;
    begin
      update public.staff_bans set banned=false, expires_at=now(), updated_at=now() where user_id=p_user_id;
    exception when undefined_table or undefined_column then null;
    end;
  end if;

  return jsonb_build_object(
    'ok',true,'user_id',v_row.user_id,'site_suspended',v_row.site_suspended,
    'account_banned',v_row.account_banned,'reason',v_row.reason,'expires_at',v_row.expires_at,'updated_at',v_row.updated_at
  );
end $$;
grant execute on function public.staff_set_account_enforcement_v164(uuid,text,boolean,integer,text) to authenticated;

-- Repair rows that are already fully disabled but still carry stale metadata.
update public.account_enforcement_v146
set reason=null,expires_at=null,updated_at=now()
where coalesce(site_suspended,false)=false and coalesce(account_banned,false)=false
  and (reason is not null or expires_at is not null);
