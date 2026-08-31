FLIX2WATCH v31

THIS UPDATE REQUIRES SQL.
Run chat-24h-and-comments-v31.sql once.

CHAT 24-HOUR WIPE
- public.chat_messages is deleted from the database at 24 hours.
- The SQL also purges these tables if they exist:
  direct_messages, private_messages, dm_messages,
  chat_direct_messages, chat_dm_messages.
- A pg_cron job runs every minute.
- rapid-worker.ts cleanup batch capacity was increased too.
- If you deploy the included rapid-worker.ts, media cleanup on worker-driven
  public-chat cleanup is also retained.
- SQL is the part that makes database deletion scheduled and independent of traffic.

PROFILE COMMENTS
- Fixes the legacy commenter_user_id NOT NULL error by backfilling it from
  author_user_id and dropping the obsolete NOT NULL requirement.

ROLE NAMES
- No new SQL is needed for role colours themselves.
- No wrapper replacement anymore.
- Existing display-name element gets one stable role class.
- Staff = purple, Owner = red, then Moderator, Support, Developer,
  Verified, Contributor, Curator by the existing priority resolver.
- Uses the Particles.gif effect supplied by the site owner.

NOTIFICATIONS
- Dropdown and text are moderately larger.
- Header-button geometry remains unchanged.

EDGE FUNCTION
- SQL alone handles the scheduled database purge.
- Redeploying the included rapid-worker.ts is recommended because its
  request-time public-chat cleanup batch was strengthened, but it is not
  required for pg_cron itself.

f2w-force-save:readme-v31:1788217048
 