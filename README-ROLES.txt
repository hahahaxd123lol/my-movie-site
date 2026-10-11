FLIX2WATCH ROLE UPDATE

- @josh shows a red Owner badge directly next to the display name.
- Staff profiles show a purple Staff badge directly next to the display name.
- Badges are public for logged-in and logged-out visitors.
- Direct /profile/@username routing now uses the exact same latest profile page.
- Logged-in Owner/Staff role shows next to Theme in the top bar.
- Account modal shows role under email and @username.
- Visible role name is Staff everywhere.

OWNER CHAT COMMANDS:
  /staff ALIAS
  /unstaff ALIAS

Old /mod and /unmod remain accepted only as hidden backward-compatible aliases.

SETUP:
1. Upload the whole pack.
2. Run profile_roles_staff_setup.sql once.
3. Redeploy Supabase Edge Function using rapid-worker.ts.
