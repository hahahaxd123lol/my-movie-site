-- Flix2Watch v171: permanent Staff dismiss/resolve deletes

drop function if exists public.staff_delete_report_v171(text);
create function public.staff_delete_report_v171(p_report_id text)
returns boolean language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); owner constant uuid:='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid;
begin
  if me is null or not (me=owner or exists(select 1 from public.chat_moderators m where m.user_id=me)) then raise exception 'Staff permission required'; end if;
  delete from public.moderation_reports where id::text=p_report_id;
  return found;
end$$;
revoke all on function public.staff_delete_report_v171(text) from public; grant execute on function public.staff_delete_report_v171(text) to authenticated;

drop function if exists public.staff_delete_ticket_v171(text);
create function public.staff_delete_ticket_v171(p_ticket_id text)
returns boolean language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); owner constant uuid:='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid;
begin
  if me is null or not (me=owner or exists(select 1 from public.chat_moderators m where m.user_id=me)) then raise exception 'Staff permission required'; end if;
  delete from public.support_ticket_messages where ticket_id::text=p_ticket_id;
  delete from public.support_tickets where id::text=p_ticket_id;
  return found;
end$$;
revoke all on function public.staff_delete_ticket_v171(text) from public; grant execute on function public.staff_delete_ticket_v171(text) to authenticated;
