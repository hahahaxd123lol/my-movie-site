FLIX2WATCH BAN-EVASION GUARD v1

FILES
1) ban-evasion-guard.sql
2) rapid-worker.ts
3) final-v35.js

INSTALL
1. Supabase -> SQL Editor -> run ban-evasion-guard.sql ONCE.
2. Replace/redeploy the rapid-worker Edge Function with rapid-worker.ts.
3. Replace /final-v35.js in the GitHub repo.
4. Wait for GitHub Pages deployment to finish, then hard refresh.

OPTIONAL
For stronger separation of secrets, add an Edge Function secret named:
ABUSE_SIGNAL_SECRET
with a long random value.
If omitted, the worker safely falls back to CHAT_TOKEN_SECRET for hashing.

HOW IT WORKS
- The browser gets a random first-party device ID stored locally.
- A coarse browser fingerprint is generated from browser/device characteristics.
- The Edge Function sees the connecting IP and User-Agent.
- Raw device IDs, fingerprints and IPs are NEVER stored in the database.
  They are salted+hashed in the Edge Function first.
- When Staff/Owner bans an account, the SQL trigger copies that account's
  known device/fingerprint/network hashes into the evasion block list.
- Exact device-ID or browser-fingerprint matches are hard-blocked.
- IP + User-Agent matches are logged as lower-confidence evidence rather than
  hard-blocking by themselves, reducing the risk of banning a whole household.
- Email/password signup is checked before account creation.
- Google/Discord OAuth is checked before OAuth starts, then checked again
  immediately after authentication; a matching new account is auto-suspended.
- Existing password login is also checked.

IMPORTANT
No normal website can make ban evasion literally impossible. Users can change
devices, clear storage, spoof browser properties, use VPNs/proxies, or use
another network. This is a layered abuse-control system, not an unforgeable
hardware identity.

f2w-force-save:1788212206
 