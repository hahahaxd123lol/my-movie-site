FLIX2WATCH v62 — NORMAL TEXT/SEARCH INPUTS

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

FIXED SITE-WIDE
- Movie search, user search, forum search and DM user search are explicitly normal search fields.
- Password managers are told to ignore them.
- Removed credential-like autocomplete behaviour from non-auth fields.
- Added data-lpignore, data-1p-ignore, data-bwignore and data-form-type=other hints.
- Auth modal email/password fields are NOT touched.
- User autocomplete still works normally.

NOTE
Browsers/password managers can still choose to ignore hints in some cases, but
these fields are now marked as strongly as possible as ordinary search inputs.

f2w-force-save:readme-v62:1788221977
 