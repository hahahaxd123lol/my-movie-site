FLIX2WATCH — FINAL V20

V20 fixes the current Support/Search/Watch-state issues.

SUPPORT
- Same exact Home header remains.
- Theme dropdown now always shows a visible colored dot beside every theme.
- Search Users now shows live profile previews underneath the header search.
- Support panels/hero/buttons/input sizing were tightened to match the Home UI.

SEARCH USERS / PASSWORD MANAGERS
- Search Users is treated as a search field, not a login credential field.
- Uses autocomplete=one-time-code, inputmode=search and password-manager ignore hints.
- Uses readonly during page/password-manager scanning and unlocks on real interaction.
- Field name is rotated at runtime so it does not match a learned username credential.
- Dark autofill styling remains.
- Third-party password managers ultimately control their own popup UI, so a site
  cannot mathematically guarantee that every extension will obey ignore hints,
  but V20 combines the strongest normal web-side mitigations.

MOVIES ICON
- Replaced the unsupported regular-film icon with Font Awesome solid film.
- The exact same corrected header is propagated across Home, Watch, Favorites,
  Profile, Users, Support and Staff.

WATCH / STAFF BLOCKS
- "Unavailable on Flix2Watch / disabled by Staff" is hidden by default.
- It appears only after get_public_content_blocks succeeds and returns an exact
  media_type + media_id match.
- RPC errors/unknown state are treated as NOT blocked.
- This applies whether the viewer is logged in or logged out.

WATCH SOURCES
- Sources and TV season/episode controls start hidden.
- They remain hidden until Supabase confirms a signed-in user.
- They are hidden again on logout.
- Public title information remains visible while logged out.

SUPABASE
- No new SQL for V20.
- No new rapid-worker deployment for V20.
- If V17 backend features are already installed, upload the V20 site only.

SERVICE WORKER
- Cache: flix2watch-ultra-v20
