FLIX2WATCH v57 — SITE-WIDE USER SEARCH AUTOCOMPLETE

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

FIXED
- Typing in the top Search users box now opens live suggestions underneath.
- Works on every page that has the shared header.
- Creates the missing results dropdown automatically.
- Removes stale readonly state from the user search field.
- Searches profiles by username prefix.
- Shows avatar, @username and View public profile.
- Clicking a suggestion opens that user's public profile.
- Enter opens the first suggestion.
- Escape closes the dropdown.
- Uses a 90ms debounce for responsive search without hammering Supabase.
- Works independently of old page-local/no-op search functions.

ROOT CAUSE
Several pages still had the Search users input and oninput handler, but the
actual #user-search-results dropdown was missing. Some pages also had stale
or no-op handleUserSearchInput implementations.

f2w-force-save:readme-v57:1788221142
 