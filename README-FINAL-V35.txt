FLIX2WATCH V35 — REALTIME / LOGIN / COMMUNITY RECOVERY
======================================================
Base used: flix2watch_final_v34_social_rankings_forum_full(1).zip (the only website ZIP attached in this turn).

IMPORTANT DEPLOYMENT ORDER
1) Upload/replace the website files from this ZIP.
2) In Supabase SQL Editor, make sure the older migrations already used by V34 are installed, then run:
   v35_realtime_social_setup.sql
3) Redeploy rapid-worker.ts to the existing Supabase Edge Function named rapid-worker.
4) Hard refresh once after deployment. sw.js now uses cache flix2watch-ultra-v35 so old V34 static assets are discarded.

V35 CHANGES
- Username OR email + password login: frontend now uses rapid-worker action login_identifier and preserves the existing Supabase session/signup flow. Email login has a direct fallback.
- Chat reads support POST action=list, while GET remains supported. Pages preload the chat snapshot in the background.
- Staff Control link is hidden unless get_staff_context returns owner/staff. CSS prevents desktop header rules from accidentally revealing it.
- Home authenticated layout removes the guest-login rail and restores full-width featured content; login/modal inputs are viewport-safe.
- Profile and Support header routing hardened.
- One red logo asset (flix2watch-logo-red-v34.png) is forced site-wide.
- New /leaderboard/ with all profiles, 25 per page, pagination, profile pictures, online/offline/last-seen, titles, watch time, ratings, achievements, score and live updates.
- Realtime user presence heartbeat.
- Recent Profile Activity now records opened titles, stores title + poster, updates the existing record on repeat opens (no duplicate title cards), and updates profile activity via realtime.
- Rich Edit Profile modal: General, Social, Preferences and Privacy sections.
- Role-powered animated display-name glow/sparkles. Priority: Owner > Admin > Staff > Moderator > Support > Developer > Verified > Contributor > Curator.
- Direct Messages sidebar gets a user search so a conversation can be started without opening a profile first.
- Community page gains live metrics and a ranking summary.
- Staff user inspection gains autosaving quick switches: Public chat ban, Public chat mute, Site suspension and Account ban. Site suspension blocks the page immediately; Account ban writes Supabase auth banned_until, sends a realtime ban row and signs the active account out.
- New /privacy/ page.
- VidEasy 4K and VidFast 4K are moved to the front of the configured fallback source order.
- Parent-page popup protection from V34 is preserved. Third-party cross-origin iframe popups cannot be guaranteed blocked without sandboxing the iframe, which can break those players.

FLIX2WATCH API SOURCE
The exact Flix2Watch API embed URL/template containing the example IMDb ID tt278383 was not present in the ZIP or screenshots available to this build, so V35 does NOT invent an endpoint. Add the exact template when available; the Watch page needs that actual provider URL to replace the sample IMDb ID safely.

SUPABASE REALTIME
v35_realtime_social_setup.sql adds user_presence, profile_title_activity, profile_watch_time, public_chat_bans and account_login_bans to supabase_realtime. Existing account_events/profile role realtime remains in the older migrations.

LOGIN NOTE
For username login, rapid-worker.ts must be redeployed because it resolves username -> auth user email server-side using the service-role key, then returns a normal Supabase password session. No service-role secret is exposed in the browser.
