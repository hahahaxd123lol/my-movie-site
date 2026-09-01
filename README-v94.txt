FLIX2WATCH v94 — DEDICATED GENRE PAGES

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

NEW REAL ROUTES
- /genre/action/
- /genre/comedy/
- /genre/horror/
- /genre/sci-fi/
- /genre/thriller/
- /genre/crime/
- /genre/romance/
- /genre/animation/
- /genre/documentary/
- /genre/fantasy/
- /genre/adventure/
- /genre/drama/
- /genre/family/
- /genre/mystery/
- /genre/history/
- /genre/music/
- /genre/war/
- /genre/western/

BEHAVIOR
- Every page is a real static GitHub Pages route with its own index.html.
- Each page has a fixed TMDB genre ID and loads discover/movie directly for that genre.
- Horror is permanently ID 27, Family 10751, Action 28, etc.
- Pagination stays inside the dedicated genre route: /genre/horror/?page=2.
- Site-wide top Genres menu links now point to these dedicated routes instead of /home/?genre=...
- Existing old programmatic genre navigation is also mapped to dedicated routes.
- Genre pages retain the normal site-wide header, auth, account, footer, role effects and title cards.
- The genre route cannot silently become Trending because its fixed genre ID is part of the page itself.

Everything from cumulative v93 is preserved.

f2w-force-save:readme-v94:1788280907
 