FLIX2WATCH FULLSCREEN RESTORED

Fullscreen now works in both ways:

1. FLIX2WATCH FULLSCREEN
   - Use the Flix2Watch fullscreen button over the player.
   - Use the Fullscreen button in the player controls area.
   - Keyboard shortcut: F.
   - The parent page first tries to fullscreen the Flix2Watch player wrapper.
   - Cross-browser fallback methods are included.

2. PROVIDER FULLSCREEN
   - The streaming iframe has allowfullscreen/fullscreen permission restored.
   - If UEmbed or another source has its own fullscreen icon, it can work again.

The previous version blocked provider fullscreen permissions, which caused some
sources to be unable to enter fullscreen at all. That restriction is removed.

This pack is based on the latest full site and preserves:
- profile routing fixes
- normal-user role badge cleanup
- Owner/Staff role rules
- genre pagination scroll-to-top
- UEmbed first source
- all other existing site features
