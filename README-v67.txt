FLIX2WATCH v67 — STRICT SITE-WIDE HEADER + AUTH POPUP

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

WHAT THIS FIX DOES
- Every page uses one final header geometry layer.
- Search pair and top action buttons keep the same positions/sizing on desktop.
- Chat width remains large enough for icon/text/status light.
- Login/Sign Up use one final auth popup design on every page.
- The auth modal is physically moved to document.body before opening so page-specific
  stacking contexts can no longer cover or clip it.
- Auth popup always sits above page content with the same full-screen dim backdrop.
- Background scroll position is locked and restored.
- Login/Create Account tabs use the same swipe transition on every page.
- Watch-page Log In/Create Account buttons open this same site-wide popup.
- Close button, tabs, fields, spacing and card size are normalized everywhere.

ROOT CAUSE OF THE /users/ SCREENSHOT
The /users/ page had its own page/stacking styles around the account modal.
The modal existed, but part of the page could render above it, producing the
half-covered popup shown in the screenshot. v67 promotes the modal to the body
and gives it a single authoritative viewport-level stacking layer.

f2w-force-save:readme-v67:1788222795
 