FLIX2WATCH MAX POPUP SHIELD — v4 MAX FINAL
==========================================

WHAT THIS PACKAGE DOES
----------------------
This is the strongest practical no-sandbox setup in this package:

1) Cloudflare Worker protects player.flix2watch.com inside the player origin.
2) GitHub-root popup-protection-v34.js protects the Flix2Watch parent page.
3) Your existing watch/index.html already loads /popup-protection-v34.js,
   so you do NOT need to edit watch/index.html for the parent shield.

IMPORTANT LIMIT
---------------
There is no website-only way to mathematically guarantee zero popups from a
separate cross-origin nested iframe without sandboxing that iframe, controlling
that origin, or using a browser extension/native app shell. This package pushes
all practical no-sandbox controls available to the player origin + parent page.

STEP 1 — UPDATE THE CLOUDFLARE WORKER
-------------------------------------
1. Cloudflare -> Workers & Pages -> flix2watch-player.
2. Click Edit code.
3. Delete the current Worker code.
4. Open:
   cloudflare-worker/flix2watch-player-worker-v4-max.js
5. Copy ALL of it into the Cloudflare editor.
6. Click Deploy.

Keep the existing Worker route:
   player.flix2watch.com/* -> flix2watch-player

Keep DNS:
   player -> CNAME -> vidsrc-ip.com -> Proxied

Keep the hostname SSL Configuration Rule:
   Hostname = player.flix2watch.com
   SSL = Flexible

STEP 2 — UPDATE THE GITHUB ROOT FILE
------------------------------------
1. In your GitHub site repository root, find the existing:
   popup-protection-v34.js
2. Replace that file with:
   github-root/popup-protection-v34.js
3. Commit/deploy normally.

You do NOT need to change watch/index.html because it already references:
   /popup-protection-v34.js

The popup-protection-v4-max.js file is included only as a clearly named copy.
The v34-named copy is the drop-in replacement your current Watch page expects.

STEP 3 — VERIFY THE WORKER
--------------------------
Open:
   https://player.flix2watch.com/__f2w_guard_status

Expected JSON includes:
   "ok": true
   "version": "v4-max-final"
   "sandbox": false

Then test a direct player URL, for example:
   https://player.flix2watch.com/embed/movie/tt1300854

In DevTools -> Network -> main HTML response, look for:
   x-flix2watch-player-guard: v4-max-final

In the player frame console you should see:
   [Flix2Watch] player popup guard v4-max-final active

In the Flix2Watch parent console you should see:
   [Flix2Watch] parent popup shield v4-max-final active

STEP 4 — TEST HARD
------------------
Hard refresh the Watch page (Ctrl+Shift+R), then test:
- Play
- Pause
- Play again
- Seek forward/back
- Volume
- Fullscreen
- Repeated clicks on the player controls
- Several different movies/episodes

ROLLBACK
--------
If v4 MAX breaks the provider/session/player, paste the included rollback Worker:
   rollback/flix2watch-player-worker-v3-hard.js

If the GitHub parent shield causes a site-side issue, restore your previous
popup-protection-v34.js file.

DO NOT change your GitHub Pages A records, your www record, or your player CNAME
just to roll back the Worker.
