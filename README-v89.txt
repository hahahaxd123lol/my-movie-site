FLIX2WATCH v89 — DM DISPLAY-NAME PARTICLES ONLY

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

FIXED
- In the Direct Messages conversation list, role particles now apply ONLY to
  the user's display-name text.
- The DM row, avatar, copy container, username/subtitle and time cannot render
  role particles.
- If old code decorates the whole conversation row, v89 automatically migrates
  that role class onto the display-name element and strips it from everything else.
- Display-name letters still use the account's highest-role colour.
- Particle GIF stays WHITE.
- Particles stay just around the display-name word and cannot spread across the
  DM conversation card.

Everything from cumulative v88 is preserved.

f2w-force-save:readme-v89:1788227613
 