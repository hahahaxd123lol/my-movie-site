FLIX2WATCH v97 — GENRE CATALOGUE GRID RESTORED

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

ROOT CAUSE FOUND
The genre loader JavaScript was correctly fetching TMDB discover/movie results,
but the actual HTML elements it renders into had been removed from Home and all
dedicated genre pages:

- #movie-grid
- #catalog-pagination

That is why the page title could say "Sci-Fi Movies" or "Family Movies" while the
main area underneath stayed completely blank.

FIXED
- Restored #movie-grid on /home/.
- Restored #catalog-pagination on /home/.
- Restored both elements on every dedicated /genre/<slug>/ page.
- Dedicated genre pages reassert their fixed genre after legacy startup handlers.
- Genre pagination remains on the dedicated route, e.g.
  /genre/horror/?page=2
  /genre/sci-fi/?page=3
- Existing TMDB with_genres=<id> requests are preserved.
- Main genre grid has a minimum height and a visible Loading titles... state.

Everything else from cumulative v96 is preserved.

f2w-force-save:readme-v97:1788281880
 