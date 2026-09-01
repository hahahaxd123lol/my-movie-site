FLIX2WATCH v59 — WHITE PLAIN USERNAMES + RECENTLY WATCHED 10

THIS UPDATE REQUIRES SQL:
Run recently-watched-v59.sql once.
If Supabase shows the generic RLS warning, choose Run without RLS.
The SQL explicitly enables/configures RLS on its own new table.

NO EDGE FUNCTION REDEPLOY NEEDED.

USERNAMES
- Users with no role now display as white site-wide.
- Owner/Staff/Moderator/Support/Developer/Verified/Contributor/Curator keep role colours.
- Role-name white Particles.gif remains.
- Online/offline/presence badges and lights are NOT changed.

RECENTLY WATCHED
- Uses a new clean profile_recent_views_v59 table so old v39 activity-schema problems do not matter.
- Logged-in users must remain on the actual /watch/ title page for 5+ visible seconds.
- Leaving before 5 seconds does not record the title.
- One row per account/title, so no duplicates.
- Reopening a title moves it to the newest position.
- Database hard-deletes anything beyond the newest 10 rows per user.
- Profile reads exactly 10 maximum.
- Realtime subscription updates the Profile panel as the table changes.

f2w-force-save:readme-v59:1788221542
 