FLIX2WATCH v96 — CHAT AUTH POPUP HARD CLOSE

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

WHY v95 COULD STILL FAIL
- Multiple legacy auth controllers still exist on /chat/.
- A close could be followed by another old DM/auth handler immediately reopening it.
- The old close path also called switchChatMode('dm') after closing, which could
  run legacy DM logic again and bring the account modal straight back.

v96 FIX
- The actual X button is hard-wired directly to f2wHardCloseAccountModalV96().
- pointerdown is captured before legacy click handlers.
- Clicking anywhere on the dimmed backdrop outside the account card closes it.
- Clicking inside the card does not close it.
- Escape/BrowserBack closes it.
- Close removes every historical auth open/scroll-lock class and inline body lock.
- Modal gets hidden + inert + pointer-events:none immediately.
- A 700ms reopen guard blocks legacy code from reopening it from the same gesture.
- MutationObserver kills any stale script that re-adds the open class during that window.
- Direct Messages remains selected and the existing RIGHT-PANE guest padlock is
  rendered directly — switchChatMode('dm') is NOT called during close.

Everything else from cumulative v95 is preserved.

f2w-force-save:readme-v96:1788281466
 