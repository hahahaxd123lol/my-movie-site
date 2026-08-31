FLIX2WATCH REALTIME LEADERBOARD + PROFILE v17

IMPORTANT: THIS UPDATE REQUIRES SQL.

INSTALL ORDER
1. Supabase -> SQL Editor:
   run realtime-profile-leaderboard-v17.sql once.

2. GitHub repo:
   upload the contents of this ZIP, preserving folders.
   Important shared files:
   /final-v35.js
   /final-v35.css
   /profile/index.html
   /leaderboard/index.html
   /watch/index.html
   /staff/index.html

3. Rapid Worker:
   No NEW Edge Function logic is required specifically for leaderboard/profile/comments.
   rapid-worker.ts is included as the cumulative ban-evasion Worker from the previous update.
   If you already deployed that version, you do NOT need to redeploy it just for this batch.
   If you have not deployed the ban-evasion Worker yet, deploy the included rapid-worker.ts.

WHAT CHANGED
- Watch title opens are recorded once per title/account and deduplicated by database primary key.
- Active Watch-page time is flushed every ~15 seconds while a logged-in user has a player loaded,
  the tab is visible, and the window has focus. This covers every source because the tracker is
  source-agnostic. Cross-origin players do not expose exact play/pause state to the parent page.
- Ratings already stored in user_ratings now push leaderboard refreshes in realtime.
- Leaderboard listens to profiles, presence, title activity, watch time, ratings and role changes,
  plus a 15-second fallback refresh.
- Presence uses a per-tab session heartbeat. Closing a tab sends an immediate leave when possible;
  if a browser crashes, the online state expires automatically after about 45 seconds.
- Profile names get animated highest-role effects.
- Admin public role is deleted from every account and removed from the allowed role constraint.
- Role priority: Owner > Staff > Moderator > Support > Developer > Verified > Contributor > Curator.
- Profile editor is one modal with a left-side section list.
- Added status, pronouns, banner, favorite movie/TV, quote, social links and accent settings.
- Recently Watched is based on titles opened while logged in and has no duplicate titles.
- Removed the old Recent Profile Activity / Recent Saves blocks.
- Added realtime profile comments with profile-owner / comment-author deletion.
- Online/offline status is shown on every profile with last-online relative time.

TRACKING NOTE
For third-party cross-origin iframe sources, the parent website cannot reliably know the provider's
internal play/pause state. Watch time therefore measures active player-page time while the player is
loaded, visible and focused. Flix2Watch API player events can still save player progress separately.

Every edited code file ends with a literal trailing space.

f2w-force-save:1788213599
 