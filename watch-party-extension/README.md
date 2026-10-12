# Flix2Watch Watch Party Controls (experimental)

This extension is a proof-of-concept control bridge for the existing Watch Party API. It does not replace the Flix2Watch website or its room service.

## Install in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Select **Load unpacked** and choose this `watch-party-extension` folder.
4. Open the Flix2Watch watch page using the **Flix2Watch API** player.
5. Create or join a Watch Party in the site's Watch Party panel.
6. Click the extension icon, enter the same six-character room code and a display name, then select **Join room**.
7. Install and join with the extension in every participant's browser. Keep the movie tab open.

## What it attempts to sync

- Play
- Pause
- Seek

The extension connects to the existing room WebSocket and injects a content script into frames whose origin is `player.flix2watch.com`. It controls a normal HTML `<video>` element when one is present in that frame.

## Important limitations

This is an experimental first pass, not a verified fix. The player may delegate video playback to a nested iframe on a different origin, use a protected player, or not expose an HTML `<video>` element to the Flix2Watch frame. In those cases this content script will not see or control the actual video. The extension currently targets only `player.flix2watch.com` frames, intentionally avoiding broad access to unrelated sites.

Browser autoplay policies may also reject remote play until a user has interacted with the player once. This implementation must be tested with two browsers before being treated as working.

## Troubleshooting

- Confirm the page is using the Flix2Watch API source.
- Refresh the movie tab after installing/updating the extension.
- Make sure both people joined the same room code in the site panel and extension popup.
- If room connection succeeds but playback does not follow, the player likely lives in a nested third-party frame or doesn't expose a controllable HTML video element. Check the player frame origin and video element in DevTools before broadening extension permissions.
