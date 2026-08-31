FLIX2WATCH v40

THIS UPDATE REQUIRES SQL:
Run mandatory-usernames-v40.sql once.

NO EDGE FUNCTION REDEPLOY IS REQUIRED FOR THIS v40 UPDATE.

FORUM
- New Discussion and Browse Titles are locked to the same line/height.
- Mobile can wrap them when necessary.

ROLE PARTICLES
- Same white Particles.gif effect site-wide.
- Compact names (Forum rankings, chat, comments, leaderboard) use a smaller particle scale.
- Old pseudo/fairy particle layers are disabled so role-colored blobs do not appear.
- Role colors affect the letters only.

MANDATORY USERNAMES
- Every authenticated session is checked site-wide.
- Google/Discord OAuth users with no valid username get a blocking username chooser.
- Email/password users are checked too.
- The gate cannot be dismissed; users can either choose a username or log out.
- Usernames are 2–30 letters/numbers.
- Case-insensitive uniqueness is enforced by PostgreSQL.
- The chosen username is written to profiles and auth user metadata.

f2w-force-save:readme-v40:1788218691
 