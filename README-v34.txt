FLIX2WATCH v34 — BACKEND + NAVIGATION PERFORMANCE

THIS UPDATE REQUIRES SQL.
Run performance-v34.sql once.

EDGE FUNCTION
Redeploy the included rapid-worker.ts.

WHY THE WORKER IS FASTER
- Previous builds awaited cleanupOldMessages() before EVERY chat request.
- v31 already installed a database pg_cron purge every minute.
- v34 removes that duplicate cleanup scan from the request hot path.
- Public/private chat data remains Cache-Control: no-store.

SERVICE WORKER
- /sw-v34.js caches the main same-origin page shells and static assets.
- Repeat page visits can render from cache immediately and refresh in background.
- Cache version changes on deployment, so old v34 caches are removed.
- Supabase/API/auth requests are not cached.

SQL
- Adds conditional indexes to common profile/presence/watch/rating/comment/chat/
  notification/forum/favorites query paths.
- ANALYZE refreshes PostgreSQL planner statistics.
- Safe to rerun and skips optional tables/columns that do not exist.

IMPORTANT REAL-WORLD LIMIT
No SQL or Edge Function can make the FIRST uncached GitHub Pages download
instant. These changes reduce database latency, remove a major chat request
bottleneck, and make repeat/same-site navigation much faster. Network latency,
third-party APIs, GitHub/Cloudflare edge delivery and the visitor's device still
set the physical lower bound.

f2w-force-save:readme-v34:1788217565
 