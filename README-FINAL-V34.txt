FLIX2WATCH V34

New in V34:
- New approved popcorn/cinema logo forced site-wide with V34 cache-busted themed assets.
- Header logo slightly larger on desktop/tablet/mobile.
- Movie search works on every page with live TMDB previews and Enter-to-open.
- Movie/TV ratings from 0.5–5 stars, optional short reviews, public on profiles.
- Community forum with threads and replies, profile community activity.
- Dragging out of a modal/input card while holding the mouse no longer accidentally closes overlays.
- Strongest practical non-sandbox parent-page popup/new-tab protection retained and hardened; browser isolation still prevents a parent page from fully blocking window.open created inside an unsandboxed cross-origin player iframe.
- V33 chat blacklist/clickable links/support-ticket usernames preserved.
- Videasy4K remains Watch source #1.

SUPABASE:
Run v34_ratings_forum_setup.sql once.
Redeploy rapid-worker.ts if you have not already deployed the V33 chat-filter worker.

SERVICE WORKER: flix2watch-ultra-v34
