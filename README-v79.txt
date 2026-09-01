FLIX2WATCH v79 — USERS PREFIX SEARCH

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

BEHAVIOR
- Type K + Enter -> usernames beginning with K.
- Type 6 + Enter -> usernames beginning with 6.
- Type jo + Enter -> usernames beginning with jo.
- Matching remains case-insensitive.
- The query is a strict prefix search: username ILIKE 'query%'.
- 30 results maximum per page.

IMPORTANT FIX
- When already on /users/, Enter no longer reloads/navigates the page at all.
- It updates ?q= and ?page=1 with history.replaceState, then calls the existing
  Supabase directory loader directly.
- This removes the navigation/service-worker race responsible for the permanent
  loading spinner/frozen Users page.
- Users-page pagination also updates in place instead of performing a full page load.
- Other pages still navigate once to /users/?q=<query>&page=1.

f2w-force-save:readme-v79:1788225124
 