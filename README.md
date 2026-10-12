# Flix2Watch

Flix2Watch is a static website published from the `main` branch with GitHub Pages. Most routes are folders containing an `index.html`; shared styles and scripts live at the repository root or beside the relevant page.

## Main areas

- `home/`, `movies/`, `genre/`, and `watch/`: catalogue and playback pages.
- `profile/`, `users/`, `favorites/`, `notifications/`, and `leaderboard/`: account and community features.
- `chat/`, `staff/`, `support/`, and the legal/support pages: community and administration pages.
- `supabase/functions/rapid-worker/index.ts`: current Supabase Edge Function source.
- Root `*.sql` files: database migrations and operational fixes. These are retained intentionally; do not run every SQL file in sequence. Run a migration only when its release instructions or a specific fix calls for it.

## Deployment and testing

Pushing to `main` triggers the GitHub Pages deployment workflow. Check **Actions** for the deployment result. The site currently uses static HTML, CSS, and JavaScript rather than a local npm build.

When changing shared assets, search page markup and the shared scripts for direct and dynamically constructed references before deleting files. The canonical sitewide service worker is `sw.js`; `sw-v34.js` remains as a small compatibility bridge for pages that may still have the older header cached.

## Security

Frontend Supabase publishable keys are public by design. Never commit a service-role key, database password, chat secret, or other private credential. Keep Supabase CLI-generated state under `supabase/.temp/` out of Git; the repository `.gitignore` now enforces this.
