FLIX2WATCH-OWNED FULLSCREEN

What changed:
- Streaming iframes no longer receive native fullscreen permission.
- All existing sources use the same iframe, so this applies to every source.
- Flix2Watch now provides its own Fullscreen button over the player and in the player header.
- Keyboard shortcut: F.
- The top-level flix2watch.com document requests fullscreen for the player container.
- This prevents the streaming provider iframe from owning native fullscreen.

Browser note:
The browser controls the exact wording of its fullscreen notification.
Because fullscreen is now requested by the Flix2Watch document rather than the third-party iframe,
the browser should identify the fullscreen page as flix2watch.com/Flix2Watch rather than the provider.

If a provider draws its own fake/in-player fullscreen UI without using the browser Fullscreen API,
that provider controls its own UI and the parent page cannot rewrite text inside a cross-origin iframe.
