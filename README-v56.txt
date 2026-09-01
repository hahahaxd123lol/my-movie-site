FLIX2WATCH v56 — SITE-WIDE LOGIN/SIGNUP RESTORE

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

FIX
- Restores window.openHeaderAuth(), which the header buttons were calling but no longer had.
- Login works site-wide.
- Create Account works site-wide.
- Pages that already have the Account modal reuse it.
- Pages without an Account modal get the shared modal injected automatically.
- Login/Create Account tabs work.
- Swipe left/right between Login and Create Account is restored on touch devices.
- Google and Discord OAuth buttons work through Supabase.
- Email/password login uses the existing f2wLoginIdentifier moderation-aware path when available.
- Signup keeps username + email + password + confirm fields.
- Existing abuse preflight hook is respected when available.

ROOT CAUSE
The header still had onclick="openHeaderAuth(...)" everywhere, but the global
openHeaderAuth function itself was missing. So every Login/Sign Up click threw
before opening anything.

f2w-force-save:readme-v56:1788221054
 