FLIX2WATCH v50 — GUEST DM LOCK RESTORE + CHAT PRELOAD

NO SQL NEEDED.
NO EDGE FUNCTION REDEPLOY NEEDED.

DIRECT MESSAGES WHEN LOGGED OUT
- Direct Messages tab remains clickable.
- Right-hand thread pane shows a red padlock.
- Message explains Login/Create Account is required.
- Public/DM tabs remain clickable.
- Left conversation/sidebar layout is not replaced by the lock.

CHAT PRELOAD
- /chat/ document is prefetched site-wide.
- Supabase DNS/TLS is preconnected site-wide.
- Auth session lookup is warmed in idle time.
- A lightweight Supabase REST HEAD request warms the connection.
- Hover/touch on Chat triggers immediate warmup again before navigation.
- Clicking Chat still navigates to /chat/ as previously requested.

This reduces the visible 'Connecting...' delay but live Realtime subscription
handshake latency still depends on browser/network/Supabase.

f2w-force-save:readme-v50:1788220357
 