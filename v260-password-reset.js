(()=>{
  'use strict';
  if (window.__f2wPasswordResetV269) return;
  window.__f2wPasswordResetV269 = true;

  const FORGOT_URL = '/forgot-password/';

  function ensureStyle() {
    if (document.getElementById('f2w-forgot-pw-v266-css')) return;
    const s = document.createElement('style');
    s.id = 'f2w-forgot-pw-v266-css';
    s.textContent = `
      a.f2w-forgot-pw-btn, .f2w-forgot-pw-btn {
        display: block !important; width: 100% !important; margin: 2px 0 10px !important;
        padding: 0 !important; border: none !important; background: transparent !important;
        color: #94a3b8 !important; font-size: 0.82rem !important; font-weight: 600 !important;
        text-align: right !important; cursor: pointer !important; text-decoration: underline !important;
        text-underline-offset: 2px !important; line-height: 1.3 !important; font-family: inherit !important;
      }
      a.f2w-forgot-pw-btn:hover, .f2w-forgot-pw-btn:hover { color: #e50914 !important; }
      #home-quick-signup-pane .f2w-forgot-pw-btn,
      #account-modal.f2w-signup-mode .f2w-forgot-pw-btn { display: none !important; }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  function makeLink(id) {
    const a = document.createElement('a');
    a.id = id;
    a.className = 'f2w-forgot-pw-btn';
    a.href = FORGOT_URL;
    a.textContent = 'Forgot password?';
    a.addEventListener('click', function() {
      try {
        const email = (document.getElementById('account-email')?.value
          || document.getElementById('home-quick-email')?.value || '').trim();
        a.href = email.includes('@') ? FORGOT_URL + '?email=' + encodeURIComponent(email) : FORGOT_URL;
      } catch { a.href = FORGOT_URL; }
    }, true);
    return a;
  }

  function injectModal() {
    const modal = document.getElementById('account-modal');
    const passwordInput = document.getElementById('account-password');
    if (!modal || !passwordInput) return;
    modal.querySelectorAll('.f2w-forgot-pw-btn, [id^="account-forgot-btn"]').forEach(el => { try { el.remove(); } catch {} });
    passwordInput.insertAdjacentElement('afterend', makeLink('account-forgot-btn-v266'));
    if (typeof window.showAccountMode === 'function' && !window.showAccountMode.__f2wV266) {
      const original = window.showAccountMode;
      window.showAccountMode = function(mode) {
        original.apply(this, arguments);
        modal.classList.toggle('f2w-signup-mode', mode === 'signup');
        modal.classList.toggle('f2w-login-mode', mode !== 'signup');
      };
      window.showAccountMode.__f2wV266 = true;
    }
  }

  function injectHomeSidebar() {
    const pw = document.getElementById('home-quick-password');
    if (!pw) return;
    const pane = document.getElementById('home-quick-login-pane') || pw.parentElement || document;
    pane.querySelectorAll('.f2w-forgot-pw-btn, [id^="home-forgot-btn"]').forEach(el => { try { el.remove(); } catch {} });
    const link = makeLink('home-forgot-btn-v266');
    const label = pw.closest('label');
    if (label) label.insertAdjacentElement('afterend', link);
    else pw.insertAdjacentElement('afterend', link);
  }

  function injectAll() { ensureStyle(); injectModal(); injectHomeSidebar(); }

  function start() {
    injectAll();
    let tries = 0;
    const t = setInterval(() => {
      const modalMissing = document.getElementById('account-password') && !document.getElementById('account-forgot-btn-v266');
      const homeMissing = document.getElementById('home-quick-password') && !document.getElementById('home-forgot-btn-v266');
      if (modalMissing || homeMissing) injectAll();
      if (++tries > 30) clearInterval(t);
    }, 400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

/* Boot extras — unique URLs beat Cloudflare cache */
(()=>{
  function load(src, flag){
    if (flag && window[flag]) return;
    const s=document.createElement('script');
    s.src=src; s.defer=true;
    (document.head||document.documentElement).appendChild(s);
  }
  load('/f2w-oauth-fix-v1.js?v=1', '__f2wOauthFixV1');
  load('/f2w-halloween-v3.js?v=3', '__f2wHalloweenV3');
  load('/f2w-continue-watching-v1.js?v=2', '__f2wContinueWatchingV2');
})();
