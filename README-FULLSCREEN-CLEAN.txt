FLIX2WATCH FULLSCREEN CLEANUP

Visible fullscreen UI:
- Only one Fullscreen button remains: bottom-right of the player.
- The redundant grey header Fullscreen button was removed.
- The extra Fullscreen Player button in Title Intelligence was removed.

Still supported:
- Bottom-right Fullscreen button
- F shortcut
- Double-click/double-tap handling when the event reaches the Flix2Watch player wrapper
- Provider fullscreen permission remains enabled

DOMAIN MESSAGE LIMITATION:
If Flix2Watch's own fullscreen control enters native fullscreen, the fullscreen owner
is the flix2watch.com parent document/player wrapper.

If a third-party source itself enters fullscreen from inside its cross-origin iframe,
Chrome/Edge/Safari controls the security notification and can display that source's
real origin. A parent website cannot rewrite or spoof another origin in browser
fullscreen security UI.

Changing that browser security message across provider-owned fullscreen controls is
not possible from normal website JavaScript.
