FLIX2WATCH v63 — SEARCH / PASSWORD MANAGER HARD ISOLATION

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

FIXED SITE-WIDE
- Forum search is explicitly a normal search field.
- Header movie search is explicitly a normal search field.
- Header user search is explicitly a normal search field.
- DM user search and other search inputs are isolated too.
- Uses autocomplete=one-time-code rather than autocomplete=off because
  Chromium browsers commonly ignore "off" on fields they think are credentials.
- Search inputs are attached to a separate hidden autocomplete=off form.
- Credential-looking field names are removed/replaced.
- Added ignore hints for LastPass, 1Password, Bitwarden and Proton Pass.
- Hidden Login/Signup credential inputs are DISABLED while the auth popup is closed.
- Auth credential fields are immediately re-enabled when Login/Sign Up is clicked.
- Real Login/Sign Up fields still retain their proper authentication behaviour.

WHY v62 WAS NOT ENOUGH
Chrome/Brave password manager can ignore autocomplete=off and extension-specific
ignore flags if the page also contains hidden username/password fields. v63
separates the search controls from the auth form and disables hidden auth
credentials until the actual auth popup opens.

f2w-force-save:readme-v63:1788222324
 