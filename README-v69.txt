FLIX2WATCH v69 — SITE-WIDE HEADER HARD LOCK

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

THIS FIX IS SPECIFICALLY FOR THE BROKEN LOGGED-IN TOP BAR.

ROOT CAUSE
Multiple old header generations were still competing:
- old fixed action grids
- newer flex header rules
- v67 shell rules
- auth-state-specific display rules
They all used !important, so page/auth state could produce impossible mixed layouts
like Support appearing inside the movie-search area and Owner appearing inside
the user-search area.

V69
- Adds ONE final authoritative geometry layer after every page's previous CSS.
- Header structure is forced to:
  Logo | Main nav | Movie/User searches | Action buttons
- The real .header-tools container is explicitly laid out, fixing the v67 mistake.
- Logged-in action slots are fixed:
  Chat | Favorites | Profile | Support | Account/Owner | Notifications | Staff
- Logged-out Login/Sign Up occupy the exact same Account/Notifications slots.
- Switching auth state cannot move the earlier buttons.
- Search fields cannot stretch across the header.
- Search-user arrow remains inside its own field.
- Header positions/transforms are reset site-wide.
- Latest /users/ v68 page cleanup is merged into this cumulative build.

f2w-force-save:readme-v69:1788223204
 