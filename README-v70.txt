FLIX2WATCH v70 — ACCOUNT / STAFF / PROFILE STABILITY

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

ACCOUNT / AUTH — SITE-WIDE
- Every page now uses the same canonical Account modal markup copied from Home.
- Real Supabase session is checked site-wide.
- Logged-in users see their email, @username and role instead of Login/Create Account tabs.
- Owner account shows Owner; Staff resolves Staff where available.
- Logged-out users still get the Login/Create Account swipe auth flow.
- Account opens as the same dimmed centered box everywhere.
- Support, Staff Control and Log Out are restored in the logged-in account box.
- Username field is populated from profiles.
- Header logged-in/logged-out state is synchronized from the real Supabase session.

HEADER
- Fixed the 1181–1600px action-grid width math.
- Notification and Staff Control Panel now have a real 6px gap instead of overflowing/touching.
- Wide desktop spacing is also increased safely.

STAFF CONTROL
- Restored the missing Staff access screen.
- Restored role-chip text, stats grid, username autofind results, user snapshot,
  permissions grid, collections list, profile manager metadata, dialog copy/input host,
  toast stacks and missing ticket-modal text containers.
- Boot visibility writes are now null-safe.
- Prevents "Cannot set properties of null (setting 'hidden')" from blanking the page.

PROFILE / OFFLINE
- Profile pages no longer rewrite themselves to /profile/@username.
- Canonical static-safe URL is /profile/?user=username.
- Legacy /profile/@username URLs redirect to the stable query URL.
- Offline status stays INSIDE the full profile page with the red presence dot / last-online text.
- Presence realtime logic itself is preserved.

f2w-force-save:readme-v70:1788223711
 