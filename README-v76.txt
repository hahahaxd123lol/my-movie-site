FLIX2WATCH v76 — USER SEARCH ENTER FIX

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

FIXED
- Pressing Enter in Search Users now has exactly ONE action:
  /users/?q=<username>&page=1
- The old autocomplete Enter handler can no longer open the first profile at
  the same time as the directory navigation.
- Competing/double navigation is blocked.
- Search suggestion dropdown closes before navigation.
- Search Users arrow/buttons use the same single navigation path.
- Clicking an autocomplete result still opens that specific public profile.
- On /users/, pressing Enter for the exact same query/page refreshes results
  in place instead of starting a pointless second page navigation.

ROOT CAUSE
Multiple old keydown handlers were attached to #user-search. One could open
the first autocomplete result while another attempted the users-directory
navigation. That race could leave Chromium showing a permanent loading state.

f2w-force-save:readme-v76:1788224745
 