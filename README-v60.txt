FLIX2WATCH v60 — AUTH POPUP / SCROLL LOCK FIX

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

FIXED SITE-WIDE
- Login opens as a fixed centered popup.
- Sign Up opens as the same centered popup.
- Watch-page Login/Create Account uses the exact same popup.
- Background dims and cannot scroll/move while auth is open.
- Opening the auth popup preserves the user's current page scroll position.
- Closing restores the exact same scroll position.
- Focus uses preventScroll where supported, so the browser does not jump.
- Swipe left/right switches Login/Create Account inside the card.
- Swipe animation happens inside the popup only; the page behind it stays still.
- Escape closes the modal.
- Mobile safe-area handling included.

ROOT CAUSE
The auth opener was focusing fields and applying modal state without a true
body scroll lock. Browsers can auto-scroll focused inputs into view, which made
the page jump before/while the modal appeared.

f2w-force-save:readme-v60:1788221799
 