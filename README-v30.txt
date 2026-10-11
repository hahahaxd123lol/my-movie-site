FLIX2WATCH v30 — FORUM + ROLE NAME EFFECTS + HEADER LOCK

THIS UPDATE REQUIRES SQL FOR THE FORUM.
Run: forum-realtime-v30.sql

ROLE NAME EFFECTS
- No new Edge Function is required.
- No new SQL is required solely for Owner/Staff sparkle names if your successful
  realtime-profile-leaderboard-v17-fixed2.sql migration is already installed.
- The Account modal now uses the role already resolved by the existing auth/staff
  system, so Staff purple/particles do not wait for a public-role lookup.
- Other public names use get_public_name_effects(), which is included in the
  successful v17 fixed migration and also refreshed by forum-realtime-v30.sql.

FORUM
- New reference-style three-column forum layout.
- Real threads and replies.
- Realtime updates via Supabase publication.
- Search, categories, Hot/New sort, rankings, profile links, composer and replies.

HEADER / SPEED
- Final header geometry lock is the last CSS rule in every page head.
- No transform/position transitions are permitted in the desktop header.
- Existing v24 prefetch/profile caching and v26 fade transitions are preserved.

EDGE FUNCTION
- No rapid-worker / index.ts redeploy is needed for this update.

IMPORTANT
This package has been source-audited and syntax-checked locally. It has not been
deployed to flix2watch.com from this environment, so live end-to-end behavior
cannot be truthfully guaranteed until you upload it and run the SQL.

f2w-force-save:readme-v30:1788216738
 