FLIX2WATCH ULTRA UPGRADE

This pack is built on top of the finished clean-URL/@username site.
Existing pages/features were preserved and the new features were layered on top.

NEW GLOBAL FEATURES
- Discover dropdown in the existing top bar
- Ctrl/Cmd + K quick-command palette
- scroll progress indicator
- back-to-top control
- online/offline status
- PWA/install support
- service-worker caching for static files + TMDB responses
- image lazy-loading/async decoding
- robots.txt + sitemap.xml
- reduced-motion accessibility support
- toast feedback system

HOME
- Trending This Week shelf
- Mood Mixer genre shortcuts
- Highly Rated Picks shelf
- Upcoming Movies shelf
- sections lazy-load only near the viewport

WATCH
- title metadata panel
- rating/year/runtime/status
- overview/tagline/genres/cast
- More Like This recommendations
- fullscreen player button
- cinema dim-lights mode
- copy watch link

FAVORITES
- export favorites as JSON
- copy title list
- random saved-title picker
- recent/A-Z smart sorting
- extra live library stats

PROFILE
- profile level
- taste score
- member-since display
- profile completeness
- achievements
- recent-save activity shelf
- respects private-profile favorite visibility

CHAT
- image upload button
- PNG/JPG/WEBP/GIF support
- 5 MB limit
- image preview before sending
- inline image display
- click-to-open image lightbox
- character counter
- images are stored in a dedicated Supabase Storage bucket

REQUIRED FOR CHAT IMAGES
Run chat_media_setup.sql once in Supabase SQL Editor.

UPLOAD
Upload this entire folder to your GitHub repo root, preserving:
home/index.html
watch/index.html
favorites/index.html
profile/index.html

The existing CNAME and @username profile routing remain included.


STAFF / OWNER PROFILE BADGES
- Owner profiles show a red Owner badge next to the name.
- Existing moderator accounts are now shown publicly as Staff.
- Staff profiles show the existing purple moderation color.
- Internal permissions/commands remain unchanged.
- Run profile_role_badges.sql once so public profiles can resolve Staff badges safely.


FULL-PAGE PROFILE BACKGROUNDS
- Profile owners can upload a JPG/PNG/WEBP background up to 8 MB.
- The image skins the entire public profile page.
- It extends behind the top navigation/search area.
- A dark cinematic overlay keeps text and controls readable.
- Avatar remains separate.
- Backgrounds are public when visiting the profile.
- Owner can replace/remove the background.
- Run profile_backgrounds_setup.sql once in Supabase SQL Editor.
