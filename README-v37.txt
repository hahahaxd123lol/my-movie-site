FLIX2WATCH v37 — PUBLIC CHAT SLOW MODE + DM 24H PURGE

THIS UPDATE REQUIRES SQL.
Run chat-slowmode-dm24-v37.sql once.

EDGE FUNCTION
Redeploy the included rapid-worker.ts.

PUBLIC CHAT
- Permanent 5-second slow mode.
- Enforced on the server/database path, not only in JavaScript.
- Uses a PostgreSQL advisory transaction lock, so multiple tabs cannot bypass
  the 5-second interval by sending at the same time.
- UI also shows the cooldown when a public message has been sent.

DIRECT MESSAGES
- NO slow mode.
- DMs are intentionally unrestricted by this v37 feature.
- Database rows older than 24 hours are purged every minute.
- The purge checks known DM table names AND automatically discovers public
  tables whose names match DM/direct/private-message patterns.

IMPORTANT
The SQL cron job is what makes DM deletion happen even when nobody visits Chat.
The Edge Function is what enforces public-chat slow mode before inserts.

f2w-force-save:readme-v37:1788218042
 