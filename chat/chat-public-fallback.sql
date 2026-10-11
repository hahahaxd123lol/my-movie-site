-- Flix2Watch public chat bootstrap fallback
-- Run in Supabase SQL Editor once.
-- This does NOT replace rapid-worker for posting/moderation; it only gives the chat page
-- a resilient public-read fallback when the Edge Function cannot be reached.

create or replace function public.get_public_chat_bootstrap()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_messages jsonb := '[]'::jsonb;
  v_announcement jsonb := null;
  v_config jsonb := '{}'::jsonb;
  v_pinned jsonb := null;
  v_pinned_id text := null;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'alias', q.alias,
        'message', q.message,
        'created_at', q.created_at,
        'owner', q.owner,
        'moderator', q.moderator
      ) order by q.created_at asc
    ),
    '[]'::jsonb
  )
  into v_messages
  from (
    select
      cm.id,
      cm.alias,
      cm.message,
      cm.created_at,
      (lower(coalesce(cm.alias,'')) = 'josh' or cm.owner_id is not null) as owner,
      (
        lower(coalesce(cm.alias,'')) <> 'josh'
        and cm.owner_id is null
        and exists (
          select 1
          from public.chat_moderators m
          where lower(coalesce(m.alias,'')) = lower(coalesce(cm.alias,''))
        )
      ) as moderator
    from public.chat_messages cm
    where cm.created_at > now() - interval '24 hours'
    order by cm.created_at asc
    limit 200
  ) q;

  select to_jsonb(a)
  into v_announcement
  from (
    select id, message, created_at, starts_at, expires_at
    from public.site_announcements
    where active = true
      and starts_at <= now()
      and (expires_at is null or expires_at > now())
    order by created_at desc
    limit 1
  ) a;

  select value #>> '{}'
  into v_pinned_id
  from public.site_settings
  where key = 'chat_pinned_message_id'
  limit 1;

  v_config := jsonb_build_object(
    'chat_locked', coalesce((select value from public.site_settings where key='chat_locked' limit 1), 'false'::jsonb),
    'chat_slow_mode_seconds', coalesce((select value from public.site_settings where key='chat_slow_mode_seconds' limit 1), '0'::jsonb),
    'chat_uploads_enabled', coalesce((select value from public.site_settings where key='chat_uploads_enabled' limit 1), 'true'::jsonb),
    'chat_pinned_message_id', case when v_pinned_id is null or v_pinned_id = '' then 'null'::jsonb else to_jsonb(v_pinned_id) end
  );

  if v_pinned_id is not null and v_pinned_id <> '' then
    select jsonb_build_object(
      'id', cm.id,
      'alias', cm.alias,
      'message', cm.message,
      'created_at', cm.created_at
    )
    into v_pinned
    from public.chat_messages cm
    where cm.id::text = v_pinned_id
    limit 1;
  end if;

  return jsonb_build_object(
    'messages', coalesce(v_messages, '[]'::jsonb),
    'announcement', v_announcement,
    'config', coalesce(v_config, '{}'::jsonb),
    'pinned_message', v_pinned
  );
end;
$$;

revoke all on function public.get_public_chat_bootstrap() from public;
grant execute on function public.get_public_chat_bootstrap() to anon, authenticated;

notify pgrst, 'reload schema';

-- F2W_UPDATE_MARKER chat-public-fallback-20260831
 