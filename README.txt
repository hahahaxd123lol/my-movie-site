Flix2Watch unified header + instant chat update

What changed:
- All listed pages now use the exact <header> markup copied from the current /watch/index.html.
- global-header-v1.css contains the same Watch-page critical header CSS.
- global-header-chat-v1.js preloads the real Home chat in a hidden same-origin iframe as soon as each page loads.
- Clicking Chat opens that already-loaded chat in a modal over the current page, so the page remains visible behind it.

Upload:
1. Put global-header-v1.css and global-header-chat-v1.js in your repository root.
2. Replace the index.html files in index(root), favorites, forum, home, leaderboard, privacy, profile, staff, support, users, and watch with the files in this package.
3. Hard refresh after GitHub Pages updates.

SQL: NONE required for this header/chat update.
