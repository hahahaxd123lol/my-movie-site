FLIX2WATCH v64 — ROLELESS USERNAMES WHITE

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

FIXED SITE-WIDE
- Users with NO assigned role are plain white.
- Header Search Users results are white instead of red.
- Forum usernames with no role are white.
- Chat/DM usernames with no role are white.
- Comments, profile, leaderboard and other username surfaces are white when roleless.
- Owner/Staff/Moderator/Support/Developer/Verified/Contributor/Curator still use their role colour.
- Role particles remain white.
- Online/offline indicators are untouched.

ROOT CAUSE
The shared header autocomplete CSS still had an old hard-coded red rule for
.user-search-name. That rule overrode the newer roleless-name styling.

f2w-force-save:readme-v64:1788222358
 