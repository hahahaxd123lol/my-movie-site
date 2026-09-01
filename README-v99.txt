FLIX2WATCH v99 — TRENDING / GENRE LOAD STABILITY

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

ROOT CAUSE
The main catalogue loader was awaiting ensurePublicContentOps() before it even
started the TMDB Trending/genre fetch. That staff-curation helper calls two
Supabase RPCs. On some logged-out/TV browser sessions those optional RPC calls
could stall, leaving the main grid stuck forever on "Loading titles...".

FIXED
- Trending/genre/search catalogue no longer waits for staff-curation RPCs.
- Staff curation loads in the background and is optional.
- Staff-curation RPCs now time out after 3.5 seconds and fall back to empty data.
- TMDB catalogue fetches now have a 9-second AbortController timeout.
- If the grid is still stuck on "Loading titles..." after 10 seconds, a one-time
  watchdog retries the active catalogue/genre.
- Applied to Home and all dedicated genre pages.
- Existing latest-request-wins logic is preserved.

Everything else from cumulative v98 is preserved.

f2w-force-save:readme-v99:1788282758
 