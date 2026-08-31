FLIX2WATCH PROFILE ROUTING + ROLE FIX

ROOT CAUSE FIXED
The old /profile/@username path relied on a GitHub Pages 404 shell that could load
an older cached copy of the profile HTML. That could cause:
- Profile Not Found when clicking a valid account
- old/static shield icons reappearing

NEW ROUTING
- Search/profile/chat clicks load /profile/?user=USERNAME (a real GitHub Pages route).
- The profile page immediately changes the visible address to /profile/@USERNAME
  with history.replaceState, so the clean URL remains.
- Directly typing /profile/@USERNAME is handled by 404.html, which redirects once
  to the real /profile/ page. No document.write and no duplicate profile HTML.

ROLE RULES
- Normal profile: no static icon beside the name.
- Owner: red Owner badge only when profile user_id == OWNER_UUID.
- Staff: purple Staff badge only when the public role RPC returns exactly "staff".
- Profile Not Found: role badge is forcibly cleared.

CACHE
- Service worker cache bumped to flix2watch-ultra-v2.
- HTML-like requests are never cached.
- Activation deletes the previous v1 cache.

The genre pagination scroll-to-top fix remains included.
