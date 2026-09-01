FLIX2WATCH v54 — ACCOUNT DETAILS RESTORE

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

FIXED SITE-WIDE
- Restored account email field.
- Restored @username field.
- Existing role field remains.
- Account modal now refreshes details from the active Supabase session.
- Username also refreshes from profiles so OAuth/email accounts show the real username.
- Existing Owner/Staff/etc role-name particle/color logic is preserved.
- Added null guards so missing/stale account fields cannot crash refreshAccountUI.

ROOT CAUSE
The account modal markup had lost account-user-email and account-user-username,
while refreshAccountUI still tried to write to them. That caused the account
refresh function to throw before the real role/details could finish rendering.

f2w-force-save:readme-v54:1788220759
 