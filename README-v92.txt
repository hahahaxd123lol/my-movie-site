FLIX2WATCH v92 — SITE-WIDE AUTH FEEDBACK + WATCH LOGIN STABILITY

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

SITE-WIDE LOGIN / SIGN UP
- Login button now visibly changes to "Logging in…" with a spinner.
- Sign Up changes to "Creating account…" with a spinner.
- Status text is always visible inside the auth card.
- Wrong username/email/password now shows:
  "Incorrect username/email or password."
- Email-not-confirmed, duplicate account, rate-limit and normal Supabase errors
  also show readable messages in the modal.
- Successful login no longer forces location.reload().
- Successful signup with an immediate session also avoids a page reload.
- One shared auth-success event updates page-specific UI.
- All historical modal/backdrop/body-scroll lock classes are cleared on close.

WATCH PAGE
- Successful login immediately hides the Login to Watch overlay.
- Account-modal blur/backdrop is forcibly cleared after session success.
- Current user/session is synchronized before revealing playback.
- Player is revealed/started after auth without reloading the Watch page.
- Existing duplicate iframe-src protection is preserved, so the fix does not
  intentionally restart playback by assigning the same source again.
- Auth state is rechecked on pageshow and on Supabase auth changes.

Everything from cumulative v91 is preserved.

f2w-force-save:readme-v92:1788228465
 