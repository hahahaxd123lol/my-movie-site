FLIX2WATCH — FINAL V21

V21 fixes the oversized/two-row Watch header shown in the supplied screenshot.

WHAT CHANGED
- Home remains the canonical header markup.
- Home, Watch, Favorites, Profile, Users, Support and Staff still use the exact same header HTML.
- Added a final inline critical header stylesheet after every other stylesheet.
- On desktop (>1180px), the header is hard-locked to one compact 82px row.
- Logo is hard-locked to 158px (145px on medium desktop/laptops).
- Navigation, movie search, user search and account/action buttons cannot wrap into a second row.
- Old Watch-specific inline `header`, `.logo`, and `.header-tools` CSS can no longer enlarge the header.
- Dropdowns still open beneath their proper buttons.
- Mobile/iPad keeps the existing hamburger layout.

WHY THIS FIX IS DIFFERENT
The Watch HTML still contained legacy page-specific header CSS from the original Watch design.
Earlier versions depended on shared external CSS winning the cascade. V21 places the final
header authority inline at the very end of <head> with stronger selectors and !important,
so stale/legacy Watch CSS cannot create the giant header shown in the screenshot.

SUPABASE
- No new SQL.
- No Edge Function redeploy.
- Upload the V21 site only.

SERVICE WORKER
- flix2watch-ultra-v21
