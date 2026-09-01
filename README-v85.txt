FLIX2WATCH v85 — GUEST DIRECT MESSAGES STABILITY

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

ROOT CAUSE
An old guest-DM v50 capture listener was still attached to the Direct Messages tab.
For logged-out users it called stopImmediatePropagation(), preventing the newer
switchChatMode implementation from running. It also searched for the wrong thread
pane selector, so the user could click Direct Messages and see nothing happen.

FIXED
- Removed the obsolete v50 guest-DM interception script.
- Removed the older duplicate guest-DM controller.
- One authoritative DM switch controller now owns Public/Direct Messages.
- Logged-out Direct Messages opens immediately.
- The left conversation/user rail stays on the LEFT and is only dimmed/inert.
- The red padlock + Login/Create Account card is rendered ONLY in the RIGHT DM thread pane.
- Login and Create Account use the exact site-wide auth popup (blurred background + swipe modes).
- Logged-in users go straight into normal DMs.
- Session hydration is checked before deciding guest vs logged-in.
- Rapid Public <-> Direct Messages clicking uses a generation token, so stale async
  session checks cannot flip the UI back or break the tabs.
- Auth-state changes while DM is open update the pane safely.

Everything else from cumulative v84 is preserved.

f2w-force-save:readme-v85:1788226556
 