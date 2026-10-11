FLIX2WATCH v95 — CHAT GUEST-DM AUTH MODAL CLOSE FIX

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

FIXED ON /chat/
- Guest Direct Messages still opens the normal site-wide Login/Create Account modal.
- The X button now has an authoritative capture-phase close handler.
- Clicking the dimmed area outside the account card closes the modal.
- Clicking inside the account card does NOT close it.
- Escape also closes it for keyboard/TV browsers.
- Every old auth/body scroll lock is cleared when closing.
- If Direct Messages is still selected, closing the auth modal returns to the
  existing right-pane red padlock/login-required state instead of breaking tabs.

Everything else from cumulative v94 is preserved.

f2w-force-save:readme-v95:1788281037
 