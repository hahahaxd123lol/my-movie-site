FLIX2WATCH FULLSCREEN + ROLE COLOUR FIX

FULLSCREEN
- Removed the two-step requestFullscreen(options) retry that could consume user activation.
- Flix2Watch now makes exactly one native requestFullscreen() call.
- A guaranteed CSS full-viewport fallback activates immediately, so the button always visibly expands the player even if the browser denies native fullscreen.
- Provider iframe explicitly receives fullscreen * permission plus legacy allowfullscreen attributes.
- Provider fullscreen buttons remain allowed.
- F shortcut remains.
- Double-click/double-tap is supported whenever the event reaches the Flix2Watch wrapper.
- Cross-origin iframe clicks cannot be observed by the parent without blocking provider controls.

ROLE COLOURS
- Owner profile badge: red shield + red Owner text.
- Staff profile badge: purple shield + purple Staff text.
- Normal accounts still get no role badge.

All previous profile-routing, genre-pagination, UEmbed-first, security and site features are preserved.
