(()=>{
  'use strict';
  if (window.__f2wOauthFixV1) return;
  window.__f2wOauthFixV1 = true;

  function providerFromEl(el) {
    if (!el) return null;
    const btn = el.closest?.('button, a, [role="button"]') || el;
    const oc = (btn.getAttribute?.('onclick') || '');
    const cls = (btn.className || '').toString();
    const txt = (btn.textContent || '').toLowerCase();
    if (/google/i.test(oc) || /google/i.test(cls) || /google/i.test(txt)) return 'google';
    if (/discord/i.test(oc) || /discord/i.test(cls) || (/discord/i.test(txt) && /sign/i.test(txt))) return 'discord';
    return null;
  }

  async function runOAuth(provider) {
    if (!provider) return;
    if (typeof window.signInWithOAuthProvider === 'function') {
      try {
        await window.signInWithOAuthProvider(provider);
        return;
      } catch (e) {
        console.error('[f2w oauth fix] signInWithOAuthProvider failed', e);
      }
    }
    // Fallback: call supabase client directly
    const client = window.f2wSupabase || window.chatSupabase || window.supabaseClient;
    if (!client?.auth?.signInWithOAuth) {
      console.error('[f2w oauth fix] no supabase client');
      return;
    }
    try {
      sessionStorage.setItem('f2w_oauth_return', location.pathname + location.search + location.hash);
      const { error } = await client.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: location.origin + '/home/?oauth=complete',
          skipBrowserRedirect: false
        }
      });
      if (error) throw error;
    } catch (e) {
      console.error('[f2w oauth fix] direct oauth failed', e);
    }
  }

  // Capture-phase: win over rate-limiters / stopPropagation
  document.addEventListener('click', function(e) {
    const t = e.target;
    if (!t) return;
    // Only oauth buttons (modal + sidebar + any)
    const btn = t.closest?.('.f2w-oauth-btn, .f2w-quick-oauth button, [onclick*="signInWithOAuthProvider"]');
    if (!btn) return;
    const provider = providerFromEl(btn);
    if (!provider) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    runOAuth(provider);
  }, true);

  // Also bind on mousedown as backup (some scripts kill click)
  document.addEventListener('mousedown', function(e) {
    const t = e.target;
    if (!t) return;
    const btn = t.closest?.('.f2w-oauth-btn, [onclick*="signInWithOAuthProvider"]');
    if (!btn) return;
    // Mark so click handler still knows
    btn.dataset.f2wOauthPending = providerFromEl(btn) || '';
  }, true);

  console.info('[f2w] oauth fix v1 active');
})();
