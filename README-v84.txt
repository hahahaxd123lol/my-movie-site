FLIX2WATCH v84 — MOVIE SEARCH RESULTS PAGE

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

SITE-WIDE SEARCH MOVIES
- Type a movie/title query and press Enter.
- Enter NEVER auto-opens the first/top autocomplete result anymore.
- Enter always goes to:
    /home/?search=<query>&page=1
- The Home catalogue then shows all matching movie/TV title results.
- Existing title cards remain individually clickable.
- Existing catalogue pagination is used for page 1, 2, 3, etc.

HOME SEARCH RESULTS
- ?search= is now a proper startup catalogue mode.
- It no longer loads Trending first and then switches to search afterward.
- Search text is placed back into the shared Search Movies box.
- Search pagination preserves the search query in the URL.
- If already on Home with the same query, Enter refreshes page 1 in-place.

OLD CONFLICT
- Removed the old Leaderboard movie-search Enter handler that used /home/?q=.
- Shared capture handler now owns Enter site-wide, preventing older autocomplete
  handlers from sucking the user onto result #1.

f2w-force-save:readme-v84:1788226452
 