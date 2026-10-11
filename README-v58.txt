FLIX2WATCH v58 — HARD SITE-WIDE AUTH FIX

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

AUTH FIX
- Login and Sign Up are bound directly inside EVERY HTML page.
- They no longer depend on global-header-chat-v1.js reaching a later runtime block.
- window.openHeaderAuth is defined unconditionally on every page.
- Existing Account modal is reused when present.
- Missing Account modal is injected automatically.
- Login/Create Account tabs work.
- Swipe left/right between Login and Create Account works.
- Watch-page center Login/Create Account buttons are bound to the same modal.
- The modal explicitly forces display:flex with the dimmed backdrop when opened.

IMPORTANT CACHE FIX
- The old v34 Service Worker used cache-first HTML navigation.
- That could keep serving an older broken HTML page even AFTER you uploaded a fix.
- v58 changes page navigation to NETWORK-FIRST with cache fallback.
- Static asset caching remains available.
- Service Worker cache version and registration query are bumped so browsers install it.

MERGED WATCH PAGE
- The cumulative tree now includes the latest standalone Watch v55 auth/button fixes.

f2w-force-save:readme-v58:1788221340
 