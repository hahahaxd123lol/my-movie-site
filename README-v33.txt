FLIX2WATCH v33 — PERFORMANCE + 1.35s FADE

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

CHANGES
- Site-wide page fade increased to 1.35 seconds.
- Fade is now one root opacity transition only.
- Removed per-section fade animations that caused repaint/jank.
- Header is excluded from the view-transition animation so it stays locked.
- Disabled nonessential CSS animations site-wide.
- Static status lights from v32 remain static.
- Role-name Particles.gif remains the only intentional visual animation.
- Removed persistent backdrop-filter blur from header/dropdowns/notifications.
- Added stronger same-origin prefetch warmup.
- Reduced profile movie autocomplete delay to 120ms.
- Added role-decoration debounce.
- Added content-visibility for large off-screen sections.
- Existing v24 profile cache/prefetch and later cumulative fixes are preserved.

This is a source/performance pass; it has not been deployed to flix2watch.com
from this environment, so live network/server latency depends on hosting,
Supabase response time, third-party APIs, and the visitor's device/network.

f2w-force-save:readme-v33:1788217440
 