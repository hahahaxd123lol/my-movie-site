FLIX2WATCH v82 — USER SEARCH STABILITY + DISPLAY-NAME-ONLY PARTICLES

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

USER SEARCH
- Removed the older v76 Enter handler that was still registering BEFORE v79 and swallowing Enter.
- There is now ONE authoritative Enter/arrow handler.
- On /users/, Enter does NOT navigate/reload the page. It updates ?q= and loads matching profiles directly.
- Prefix semantics: K -> usernames beginning K; 6 -> usernames beginning 6; jo -> usernames beginning jo.
- 30 profiles per page.
- Query has an 8-second timeout so a failed request cannot leave Loading users forever.
- Clicking an autocomplete result still opens that selected profile.
- Enter never auto-opens the first autocomplete result.

ROLE PARTICLES
- White particle GIF is clipped INSIDE the exact display-name element.
- No particle pixels can spill across autocomplete cards, rankings rows, chat rows, comments, leaderboard, or profile.
- Same compact rule site-wide.
- Role text colour is preserved.

f2w-force-save:readme-v82:1788225709
 