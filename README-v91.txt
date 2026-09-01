FLIX2WATCH v91 — GENRE NAVIGATION FIX

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

FIXED SITE-WIDE
- Top-bar Genres links now have one shared navigation handler.
- Horror -> /home/?genre=27&page=1
- Action -> /home/?genre=28&page=1
- Comedy -> /home/?genre=35&page=1
- etc.

HOME GENRE CATALOGUE
- Added one authoritative f2wOpenGenreV91() genre loader.
- It forces catalogueMode='genre' and the selected TMDB genre ID.
- It removes conflicting search/tab URL state.
- It loads TMDB discover/movie with with_genres=<selected genre>.
- If an older Trending request is still running, the genre loader waits for it
  to finish, then loads the selected genre instead of silently dropping the request.
- Genre URL startup, top-bar genre links, bottom Browse by Genre tiles, and
  genre pagination/sort all use the same genre state.
- Added a small post-DOMContentLoaded reassertion so older homepage startup
  listeners cannot reset a requested genre back to Trending.

Everything else from cumulative v90 is preserved.

f2w-force-save:readme-v91:1788228094
 