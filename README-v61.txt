FLIX2WATCH v61 — LEADERBOARD NULL FIX

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

ROOT CAUSE
The Leaderboard JavaScript called:
  $('#pager').innerHTML = ...
but the page had no #pager element.
That threw:
  Cannot set properties of null (setting 'innerHTML')

The Supabase leaderboard RPCs were already returning data — the screenshot
showing registered players/watch time confirmed the backend was responding.
The frontend catch block incorrectly labelled every JavaScript error as a
backend migration problem.

FIXED
- Added the missing #pager element.
- Made pager/stat/list/podium/update writes null-safe.
- Removed the misleading forced "run v17 SQL" error message.
- Real backend/RPC failures now show their actual error instead.
- Existing live/realtime leaderboard behavior is preserved.

f2w-force-save:readme-v61:1788221928
 