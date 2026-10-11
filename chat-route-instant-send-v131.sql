-- Flix2Watch v131 — route-only chat + fast authenticated public sends
-- Run in Supabase SQL Editor after the earlier chat/account SQL migrations.

create or replace function public.send_public_chat_message_v131(p_message text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_uid uuid := auth.uid();
  v_alias text;
  v_message text := trim(coalesce(p_message,''));
  v_allowed boolean := true;
  v_retry integer := 0;
  v_banned boolean := false;
  v_muted boolean := false;
  v_owner boolean := false;
  v_moderator boolean := false;
  v_row record;
begin
  if v_uid is null then
    return jsonb_build_object('success',false,'error','Sign in to send a message.');
  end if;

  if v_message='' then
    return jsonb_build_object('success',false,'error','Message cannot be empty.');
  end if;
  if length(v_message)>500 then
    return jsonb_build_object('success',false,'error','Message must be 500 characters or less.');
  end if;
  if left(v_message,1)='/' then
    return jsonb_build_object('success',false,'error','Commands must use the secure chat worker.');
  end if;
  if position('[[image:' in v_message)>0 then
    return jsonb_build_object('success',false,'error','Image messages must use the secure chat worker.');
  end if;

  select nullif(trim(p.username),'')
    into v_alias
  from public.profiles p
  where p.user_id=v_uid
  limit 1;

  if v_alias is null then
    return jsonb_build_object('success',false,'error','Account username required.');
  end if;

  v_owner := v_uid='f5454804-a2a6-4602-9086-51cf51f11c77'::uuid;

  select exists(
    select 1 from public.public_chat_bans b
    where b.user_id=v_uid and (b.expires_at is null or b.expires_at>now())
  ) into v_banned;
  if v_banned and not v_owner then
    return jsonb_build_object('success',false,'error','You are banned from sending messages.','banned',true);
  end if;

  if to_regclass('public.user_mutes') is not null then
    execute 'select exists(select 1 from public.user_mutes where user_id=$1 and (expires_at is null or expires_at>now()))'
      into v_muted using v_uid;
  end if;
  if v_muted and not v_owner then
    return jsonb_build_object('success',false,'error','You are currently muted by Staff.');
  end if;

  if to_regprocedure('public.enforce_public_chat_slowmode_v37(uuid)') is not null then
    select x.allowed,x.retry_after_seconds
      into v_allowed,v_retry
    from public.enforce_public_chat_slowmode_v37(v_uid) x
    limit 1;
    if not coalesce(v_allowed,false) then
      return jsonb_build_object('success',false,'error',format('Slow mode: wait %s second%s.',greatest(v_retry,1),case when greatest(v_retry,1)=1 then '' else 's' end));
    end if;
  end if;

  if to_regclass('public.chat_moderators') is not null then
    execute 'select exists(select 1 from public.chat_moderators where user_id=$1)'
      into v_moderator using v_uid;
  end if;

  insert into public.chat_messages(alias,message,user_token_hash,owner_id)
  values(v_alias,v_message,'auth:'||v_uid::text,case when v_owner then v_uid else null end)
  returning id,alias,message,created_at,owner_id into v_row;

  return jsonb_build_object(
    'success',true,
    'message',jsonb_build_object(
      'id',v_row.id,
      'alias',v_row.alias,
      'message',v_row.message,
      'created_at',v_row.created_at,
      'owner',v_owner or v_row.owner_id is not null,
      'moderator',v_moderator
    )
  );
exception
  when others then
    return jsonb_build_object('success',false,'error',sqlerrm);
end;
$$;

revoke all on function public.send_public_chat_message_v131(text) from public;
grant execute on function public.send_public_chat_message_v131(text) to authenticated;

-- Ensure realtime INSERT/DELETE events can reach open chat clients.
do $$
begin
  begin
    alter publication supabase_realtime add table public.chat_messages;
  exception when duplicate_object then null;
  end;
end $$;
