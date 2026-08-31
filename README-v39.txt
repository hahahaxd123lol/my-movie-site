FLIX2WATCH v39 — PROFILE ACTIVITY / PRESENCE / STRICT BAN EVASION

THIS UPDATE REQUIRES SQL:
Run profile-presence-ban-v39.sql once.

EDGE FUNCTION:
Redeploy the included rapid-worker.ts.

PROFILE
- Social links are now directly under followers/following in the profile hero.
- The old separate social panel is removed, so Roles & Badges moves up.
- Recently Watched uses a security-definer RPC instead of direct table reads.
- Exactly 10 unique titles are kept per user in the database.
- Opening any /watch/ movie/TV page while logged in records immediately.
- Reopening a title updates its timestamp rather than creating duplicates.
- Profile activity remains subscribed to Supabase Realtime.

PRESENCE
- Browser heartbeat is 10 seconds.
- Online expiry is about 30 seconds.
- Multiple tabs/devices remain supported by per-tab presence sessions.
- Closing one tab does not incorrectly take another active tab offline.

BAN EVASION
- Fixes the missing block-seeding problem: when an account receives a login ban,
  every known device/fingerprint/IP+UA/IP signal is copied into ban_evasion_blocks.
- Existing active bans are retroactively seeded when you run the migration.
- rapid-worker now treats matching device, fingerprint, IP+UA, OR exact IP as a hard block.
- Signup preflight, login_identifier and post-auth abuse_register use this blocklist.
- This is intentionally strict. Shared/VPN/public IPs can cause false positives.
- Browser/IP-based anti-evasion can never be impossible to bypass against a user
  who changes device/network/browser characteristics.

DISPLAY NAMES
- Highest-role text color remains:
  Owner red, Staff purple, Moderator light blue, Support cyan,
  Developer teal, Verified blue, Contributor gold, Curator pink.
- Particles.gif is rendered without tint/filter so the particles stay white.

24H CHAT / DMs
- Existing v31/v37 database purge functions are invoked by this migration.
- Their scheduled pg_cron jobs remain the persistent deletion mechanism.

STAFF / REALTIME
- Existing Staff Control frontend is preserved.
- Common staff/support/activity tables are added to the realtime publication when present.

This build was source/syntax checked locally, not deployed live from this environment.

f2w-force-save:readme-v39:1788218599
 