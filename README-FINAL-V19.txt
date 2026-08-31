FLIX2WATCH — FINAL V19
WATCH PLAYER LOCK + THEME MENU + USER SEARCH AUTOFILL + TRANSPARENT LOGO + FEATURED CAROUSEL

============================================================
WATCH PAGE — LOGGED OUT
============================================================

The logged-out player no longer paints an about:blank iframe.

V19 now does this:
- player container stays true black
- third-party iframe is display:none while logged out
- internal placeholder is a black data document, not about:blank
- centered login card stays inside the player
- Log In button
- Create Account button
- player-only dimming
- the rest of the movie/TV page remains fully scrollable
- plot, cast, title info, recommendations and other public details remain visible
- sources/TV controls remain hidden until login
- after Supabase confirms a session, iframe is shown and normal playback starts

No page-wide login overlay was added.

============================================================
SEARCH USERS — PASSWORD MANAGER / AUTOFILL FIX
============================================================

The shared Search Users field is now clearly separated from account login.

Changes:
- type="search"
- unique non-credential field name:
    flix2watch_member_lookup_query
- autocomplete="off"
- inputmode="search"
- enterkeyhint="search"
- aria-autocomplete="none"
- LastPass / 1Password / Bitwarden / Proton Pass / Keeper ignore hints
- data-form-type="other"
- readonly during initial password-manager page scanning
- automatically unlocks on real pointer/touch/focus interaction
- restores readonly after leaving the field
- strong dark autofill CSS so browser autofill cannot turn it white

This is intended to stop saved login usernames/password-manager suggestions from
treating Search Users as the account username field.

Browser/password-manager extensions ultimately control their own UI, so no
website can force every third-party extension to obey ignore hints, but V19
uses the standard/common defensive techniques together.

============================================================
THEME DROPDOWN
============================================================

The Theme list no longer appears by itself.

V19 uses:
- hidden HTML state on initial load
- aria-hidden / aria-expanded state
- class + hidden state together
- final CSS that refuses to show the menu unless it has .show and is not hidden
- final JavaScript dropdown logic
- outside-click closes the menu
- choosing a theme closes the menu

This specifically fixes the raw list of:
Netflix Red / Cyber Blue / Emerald Green / etc.
appearing on page load without clicking Theme.

============================================================
LOGIN / CREATE ACCOUNT THEME
============================================================

The account modal Login tab and primary login controls now always follow the
selected site accent instead of staying red.

Theme-controlled:
- active Log In / Create Account tab
- account submit button
- Home quick Login button
- guest Login button
- Watch player Log In button
- existing normal accent controls

Owner profile role remains intentionally red.
Staff core role remains intentionally purple.

============================================================
TRANSPARENT FLIX2WATCH LOGO
============================================================

The opaque near-black rectangle behind the popcorn artwork was removed from all
12 theme logos.

New files:
- flix2watch-logo-red-v19.png
- flix2watch-logo-blue-v19.png
- flix2watch-logo-green-v19.png
- flix2watch-logo-purple-v19.png
- flix2watch-logo-amber-v19.png
- flix2watch-logo-matrix-v19.png
- flix2watch-logo-cyan-v19.png
- flix2watch-logo-pink-v19.png
- flix2watch-logo-orange-v19.png
- flix2watch-logo-ice-v19.png
- flix2watch-logo-gold-v19.png
- flix2watch-logo-midnight-v19.png

The popcorn box/"2"/underline still follow the selected theme.
The logo artwork itself now sits transparently on the site header/card
background instead of displaying a black rectangle.

============================================================
FEATURED — REAL FIVE-TITLE CAROUSEL
============================================================

The five Featured dots are no longer fake/static decoration.

V19 now loads five current Featured titles and supports:
- five clickable dots
- Previous arrow on PC
- Next arrow on PC
- automatic rotation every 8 seconds
- pause on mouse hover / keyboard focus
- swipe left/right on phones and tablets
- vertical page scrolling remains normal while swiping
- View Details updates to the active featured movie/TV title
- backdrop, title, overview and metadata all update

The original:
  Loading Spotlight...
placeholder is still preserved while the Featured data is loading.

============================================================
PRESERVED
============================================================

- V18 exact shared sticky Home header across every app page
- V18 HTTPS redirect fallback
- V17 Notifications
- Public Chat + Direct Messages
- username OR email account login
- Google / Discord OAuth
- profile report modal
- Staff Control Center
- Staff profile management / public roles
- user directory pagination
- theme system / 12 themes
- login-only playback/sources
- UEmbed first
- unsandboxed provider iframe
- fullscreen/F/double tap
- public title browsing while logged out
- Staff collections above Spotlight
- Trending Today
- Recently Viewed
- 24-hour public chat cleanup
- private DM persistence
- no visible account-checking screen

============================================================
SUPABASE
============================================================

V19 adds:
- NO new SQL
- NO new database tables
- NO new Edge Function action
- NO new secrets

If V17/V18 backend work is already deployed:
  upload the full V19 site only.

If you still have NOT installed V17 backend features, the V17 SQL/worker files
remain included in the full pack.

============================================================
SERVICE WORKER
============================================================

Cache:
  flix2watch-ultra-v19

This cache bump ensures browsers replace V18 CSS/JS and load the new:
- Theme dropdown fix
- Watch player lock fix
- Search Users autofill protection
- transparent theme logos
- Featured carousel

============================================================
DEPLOYMENT
============================================================

Replace/upload the ENTIRE V19 ZIP.

No Supabase action is required specifically for V19.
