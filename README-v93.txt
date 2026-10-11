FLIX2WATCH v93 — TV AUTH / WATCH / GENRE STABILITY

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

1) AUTH FEEDBACK — FIXED FOR BOTH BOXES
The Home quick-login UI had JavaScript that wrote to:
  #home-quick-login-message
  #home-quick-signup-message
but those elements did not exist in the HTML. That is why nothing appeared.

v93 adds the missing status elements and shows:
- Logging in…
- Logged in successfully.
- Incorrect username/email or password.
- Confirm your email address before logging in.
- Account already exists.
- rate-limit/general errors.

The full site Account modal now has a CAPTURE-phase submit controller, so old
page-local onclick handlers cannot silently bypass the status UI.

2) LONG-LIVED SESSIONS
All browser Supabase clients now explicitly use:
- persistSession: true
- autoRefreshToken: true
- detectSessionInUrl: true

The existing/default Supabase storage key is preserved, so existing stored
sessions are not intentionally invalidated. Session recovery runs on page load,
pageshow, tab focus and visibility return, and starts token auto-refresh.

This keeps users signed in as long as the browser keeps its site storage and
Supabase refresh-token policy allows it. Clearing browser/site data can still
remove the session; no website can preserve login after its browser storage is deleted.

3) GREY/DIM SCREEN / WATCH LOGIN GATE
- A valid restored session clears every historical auth lock class.
- Clears body position:fixed / overflow:hidden leftovers.
- Account modal is forcibly hidden when it is not actually open.
- Watch Login to Watch overlay is hidden and made non-interactive immediately
  once a valid session exists.
- No forced page reload after login.
- Watch page becomes normally scrollable again after authentication.
- Fullscreen control is made visible/focusable for authenticated TV/browser use.
- Removed site-wide contain:paint on the ready body because it was interfering
  with fixed overlays and some TV-browser scroll/focus behavior.

4) GENRES / FAMILY BLANK GRID
The old catalogue loader ignored newer requests while catalogLoading was true.
So a Trending request could win while Family/Horror/etc changed the heading,
leaving a blank/wrong grid.

v93 changes the Home catalogue to latest-request-wins:
- every request gets a generation ID
- stale Trending/search responses cannot overwrite a newer genre
- Family uses TMDB genre 10751
- Horror uses 27, Action 28, etc.
- requests use cache:no-store
- selected genre renders only its winning response

Everything else from cumulative v92 is preserved.

f2w-force-save:readme-v93:1788229371
 