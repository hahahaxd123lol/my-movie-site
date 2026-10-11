FLIX2WATCH v71 — USERS PAGE AUTH + RESULT CARD FIX

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

USERS PAGE AUTH
- Fixes the half-rendered / clipped Login/Create Account popup on /users/.
- The old body position:fixed scroll lock was the problem on this short page.
- /users/ now locks scroll without turning the body itself into a fixed containing block.
- Account modal covers the entire real viewport at the highest z-index.
- Background is fully dimmed + blurred.
- Card stays centered.
- Existing Login/Create Account swipe animation is preserved.

USER RESULTS
- Result card is larger/readable.
- Avatar is forced to an 80x80 true circle and cannot stretch into an oval.
- Profile picture uses object-fit:cover and centered crop.
- Display name is larger.
- @username is larger.
- Bio is more readable.
- Results stay 30 per page.
- Existing numbered pagination is preserved.
- Directory page still has no stray/floating search arrow.

Only /users/index.html behavior/layout was changed for these issues.
Everything else from cumulative v70 is preserved.

f2w-force-save:readme-v71:1788223881
 