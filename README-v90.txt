FLIX2WATCH v90 — DISPLAY-NAME-ONLY PARTICLES

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

ROOT CAUSE
- The global role decorator was scanning every [data-username] and
  [data-f2w-username] element.
- Those attributes also exist on autocomplete rows/cards/containers.
- A whole result row could therefore receive .f2w-role-name and the particle GIF,
  creating the wide banner shown in the screenshot.

FIX
- Removed broad [data-username] / [data-f2w-username] selectors from role decoration.
- Role effect is now restricted to actual visible display-name elements.
- Search autocomplete:
    Display Name = highest-role colour + white particles
    @username = plain
    View public profile = plain
    row/card/avatar = particle-free
- Old accidental role classes are stripped from rows/cards/containers every pass.
- Direct Messages display-name-only normalization from v89 is preserved.
- Profile/forum/leaderboard/chat/comment display names remain compact word-bound effects.
- Account @username is no longer decorated because it is a username, not a display name.

Everything from cumulative v89 is preserved.

f2w-force-save:readme-v90:1788227716
 