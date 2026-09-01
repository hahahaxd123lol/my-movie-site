FLIX2WATCH v88 — STATIC PROFILE CAMERA + 30 SECOND PRESENCE

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

PROFILE CAMERA
- Camera/edit-avatar control no longer animates, fades, transforms, or blinks.
- The control keeps a fixed visual slot.
- It starts invisibly and becomes visible once owner authorization resolves.
- Removed the repeated hide-before-auth-check cycle on pageshow.
- Actual owner authorization is still required before the camera becomes usable.

PROFILE STATUS
- Online / Last online badge now exists directly in the profile HTML from first paint.
- It never disappears while status is being refreshed.
- It shows Checking status… until the first live result arrives.
- Realtime Supabase user_presence subscription is preserved.
- Fallback status refresh is now exactly every 30 seconds.
- Focus/return-to-tab triggers an immediate refresh.

SITE-WIDE PRESENCE
- Logged-in account heartbeat is now every 30 seconds.
- Existing touch_presence_v17 session heartbeat is preserved.
- Leaderboard realtime presence subscription is preserved.
- Leaderboard fallback refresh/heartbeat is normalized to 30 seconds.
- Presence dots/badges are static: no pulse, blink, transform, or transition.

BACKEND
The existing presence backend already keeps online_until and supports realtime.
A 30-second heartbeat fits the existing expiry model, so no schema/function change is required.

f2w-force-save:readme-v88:1788227370
 