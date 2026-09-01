(()=>{
  'use strict';
  let overlay=null,panel=null,frame=null,ready=false,userOpened=false;
  const CHAT_URL='/chat/?f2w_chat_embed=1';
  function ensureStyles(){
    if(document.getElementById('f2w-global-chat-runtime-style')) return;
    const s=document.createElement('style');
    s.id='f2w-global-chat-runtime-style';
    s.textContent=`
      #f2w-global-chat-overlay{position:fixed!important;inset:0!important;z-index:2147483000!important;display:flex!important;align-items:center!important;justify-content:center!important;padding:24px!important;background:rgba(1,5,12,.78)!important;backdrop-filter:blur(10px)!important;-webkit-backdrop-filter:blur(10px)!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;transition:opacity .12s ease!important}
      #f2w-global-chat-overlay.open{visibility:visible!important;opacity:1!important;pointer-events:auto!important}
      #f2w-global-chat-panel{position:relative!important;width:min(1180px,96vw)!important;height:min(820px,92vh)!important;border:1px solid rgba(229,9,20,.45)!important;border-radius:22px!important;overflow:hidden!important;background:#050a12!important;box-shadow:0 28px 90px rgba(0,0,0,.68)!important}
      #f2w-global-chat-frame{display:block!important;width:100%!important;height:100%!important;border:0!important;background:#050a12!important}
      #f2w-global-chat-close{position:absolute!important;right:12px!important;top:12px!important;z-index:8!important;width:42px!important;height:42px!important;border-radius:12px!important;border:1px solid rgba(255,255,255,.18)!important;background:rgba(5,10,18,.92)!important;color:#fff!important;cursor:pointer!important;font-size:18px!important;display:grid!important;place-items:center!important}
      #f2w-global-chat-loading{position:absolute!important;inset:0!important;display:grid!important;place-items:center!important;color:#cbd5e1!important;font:700 14px/1.4 Inter,system-ui,sans-serif!important;letter-spacing:.04em!important;background:#050a12!important;z-index:3!important}
      #f2w-global-chat-panel.ready #f2w-global-chat-loading{display:none!important}
      @media(max-width:760px){#f2w-global-chat-overlay{padding:0!important}#f2w-global-chat-panel{width:100vw!important;height:100dvh!important;border-radius:0!important;border:0!important}#f2w-global-chat-close{right:8px!important;top:8px!important}}
    `;
    document.head.appendChild(s);
  }
  function forceHidden(){
    if(!overlay||userOpened) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden','true');
    overlay.style.setProperty('visibility','hidden','important');
    overlay.style.setProperty('opacity','0','important');
    overlay.style.setProperty('pointer-events','none','important');
  }
  function build(){
    if(overlay) return;
    ensureStyles();
    overlay=document.createElement('div');
    overlay.id='f2w-global-chat-overlay';
    overlay.setAttribute('aria-hidden','true');
    overlay.style.cssText='visibility:hidden!important;opacity:0!important;pointer-events:none!important;';
    overlay.innerHTML=`<div id="f2w-global-chat-panel" role="dialog" aria-modal="true" aria-label="Flix2Watch chat"><div id="f2w-global-chat-loading"><span>Loading chat…</span></div><button id="f2w-global-chat-close" type="button" aria-label="Close chat">×</button><iframe id="f2w-global-chat-frame" title="Flix2Watch chat" src="${CHAT_URL}" loading="eager" fetchpriority="high"></iframe></div>`;
    document.body.appendChild(overlay);
    panel=overlay.querySelector('#f2w-global-chat-panel');
    frame=overlay.querySelector('#f2w-global-chat-frame');
    overlay.querySelector('#f2w-global-chat-close').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closeGlobalChat();});
    overlay.addEventListener('pointerdown',e=>{if(e.target===overlay)closeGlobalChat();});
    window.addEventListener('message',e=>{
      if(e.origin!==location.origin) return;
      const t=e.data?.type;
      if(t==='F2W_CHAT_READY'||t==='f2w:chat-ready'){ready=true;panel?.classList.add('ready');forceHidden();}
      if((t==='F2W_CHAT_CLOSE'||t==='f2w:chat-close')&&userOpened)closeGlobalChat();
    });
    forceHidden();
  }
  function openGlobalChat(){
    if(location.pathname==='/chat/'||location.pathname==='/chat')return true;
    location.assign('/chat/');
    return true;
  }
  function closeGlobalChat(){if(!overlay)return;userOpened=false;forceHidden();}
  function guardedLegacyOpen(){
    const active=!!(navigator.userActivation&&navigator.userActivation.isActive);
    if(!active)return false;
    if(location.pathname!=='/chat/'&&location.pathname!=='/chat')location.assign('/chat/');
    return true;
  }
  function installLegacyGuards(){
    try{window.openChat=guardedLegacyOpen;}catch{}
    try{window.closeChat=closeGlobalChat;}catch{}
    try{window.openGlobalChat=openGlobalChat;}catch{}
    try{window.closeGlobalChat=closeGlobalChat;}catch{}
  }
  function hijackChatTriggers(root=document){
    root.querySelectorAll('.chat-button,[data-open-chat],a[href="/chat/"],a[href="/chat"]').forEach(el=>{
      if(el.dataset.f2wChatBound==='1')return;
      el.dataset.f2wChatBound='1';
      el.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();location.assign('/chat/');},true);
    });
  }
  function boot(){
    build();hijackChatTriggers();installLegacyGuards();forceHidden();
    const mo=new MutationObserver(()=>{hijackChatTriggers();if(!userOpened)forceHidden();});
    mo.observe(document.documentElement,{subtree:true,childList:true});
    [0,100,300,750,1500,3000].forEach(ms=>setTimeout(()=>{installLegacyGuards();if(!userOpened)forceHidden();},ms));
  }
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&userOpened)closeGlobalChat();});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('load',()=>{installLegacyGuards();if(!userOpened)forceHidden();},{once:true});
})();
// f2w-update-marker: global-chat-v8-never-auto-open
// f2w-force-save:1788208311

/* F2W responsive navigation stability v9 */
(()=>{
  'use strict';
  function tools(){return document.querySelector('body.f2w-main-page > header > .header-tools')||document.querySelector('header > .header-tools');}
  function toggle(){
    const el=tools(); if(!el)return;
    const on=!el.classList.contains('mobile-open');
    el.classList.toggle('mobile-open',on);
    const b=document.querySelector('.f2w-mobile-nav-toggle');
    if(b)b.setAttribute('aria-expanded',on?'true':'false');
  }
  function close(){
    const el=tools(); if(el)el.classList.remove('mobile-open');
    const b=document.querySelector('.f2w-mobile-nav-toggle');
    if(b)b.setAttribute('aria-expanded','false');
  }
  window.toggleF2WMobileMenu=toggle;
  window.closeF2WMobileMenu=close;
  let lastWide=innerWidth>1180;
  const settle=()=>{
    const wide=innerWidth>1180;
    if(wide!==lastWide || wide) close();
    lastWide=wide;
  };
  addEventListener('orientationchange',()=>{close();setTimeout(settle,80);setTimeout(settle,350);},{passive:true});
  addEventListener('resize',settle,{passive:true});
  document.addEventListener('click',e=>{
    if(innerWidth>1180)return;
    const el=tools(); if(!el?.classList.contains('mobile-open'))return;
    if(e.target.closest('.f2w-mobile-nav-toggle'))return;
    if(e.target.closest('.header-tools a')) close();
  },true);
})();

// f2w-force-save:device-stability-v9:20260831-205349
 

/* F2W v13 — mobile auth handoff
   Close hamburger dropdown immediately before the site's existing auth handler runs. */
(() => {
  'use strict';

  function isAuthTrigger(el) {
    if (!el) return false;
    if (el.matches('#header-login-btn,#header-signup-btn')) return true;
    const oc = el.getAttribute?.('onclick') || '';
    return /openHeaderAuth\s*\(\s*['"](?:login|signup)['"]\s*\)/i.test(oc);
  }

  function closeMenuNow() {
    try {
      if (typeof window.closeF2WMobileMenu === 'function') {
        window.closeF2WMobileMenu();
      } else {
        document.querySelectorAll('.header-tools.mobile-open').forEach(el => el.classList.remove('mobile-open'));
        document.querySelectorAll('.f2w-mobile-nav-toggle').forEach(btn => btn.setAttribute('aria-expanded','false'));
      }
    } catch (_) {}
  }

  // Capture phase = dropdown disappears before the existing button onclick opens the modal.
  document.addEventListener('pointerdown', e => {
    const trigger = e.target.closest?.('button,a');
    if (isAuthTrigger(trigger)) closeMenuNow();
  }, true);

  document.addEventListener('click', e => {
    const trigger = e.target.closest?.('button,a');
    if (isAuthTrigger(trigger)) closeMenuNow();
  }, true);
})();

// f2w-force-save:mobile-auth-handoff-v13:1788211530
// f2w-force-save:remove-nettools-v14:1788211808:global-header-chat-v1.js
 

/* F2W v15 — universal bottom legal navigation */
(() => {
  'use strict';
  const links = [
    ['/privacy/','Privacy'],
    ['/terms/','Terms & Conditions'],
    ['/removal-requests/','Removal Requests'],
    ['/law-enforcement/','Law Enforcement'],
    ['/copyright/','Copyright / DMCA'],
    ['/support/','Support']
  ];
  function mountLegalFooter() {
    if (document.getElementById('f2w-legal-footer')) return;
    const footer=document.createElement('footer');
    footer.id='f2w-legal-footer';
    footer.className='f2w-legal-footer';
    footer.innerHTML=`<div class="f2w-legal-footer-inner">
      <div class="f2w-legal-footer-brand">
        <img src="/flix2watch-logo-red-v34.png" alt="">
        <span>© ${new Date().getFullYear()} Flix2Watch</span>
      </div>
      <nav class="f2w-legal-footer-links" aria-label="Legal and policy links">
        ${links.map(([href,label])=>`<a href="${href}">${label}</a>`).join('')}
      </nav>
    </div>`;
    document.body.appendChild(footer);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mountLegalFooter,{once:true});
  else mountLegalFooter();
})();
// f2w-force-save:universal-legal-footer-v15:1788212347
// f2w-force-save:chat-route-v16:1788212934
 

 

/* F2W v19 — non-mutating header stability */
(() => {
  'use strict';
  document.addEventListener('pointerdown',e=>{
    const control=e.target.closest?.('body.f2w-main-page > header a, body.f2w-main-page > header button');
    if(!control)return;
    control.style.transform='none';
  },true);
})();
// f2w-force-save:header-stability-v19:1788214305
 

/* F2W v23 — guarantee Chat pulse exists on every header instance */
(() => {
  'use strict';
  function ensureChatDot() {
    document.querySelectorAll('body.f2w-main-page > header .chat-button').forEach(button=>{
      if(button.querySelector('.chat-online-dot'))return;
      const dot=document.createElement('span');
      dot.className='chat-online-dot';
      dot.setAttribute('aria-hidden','true');
      button.appendChild(dot);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureChatDot,{once:true});
  else ensureChatDot();
  new MutationObserver(ensureChatDot).observe(document.documentElement,{childList:true,subtree:true});
})();
// f2w-force-save:chat-dot-guard-v23:178821-v23-dot-guard
 

/* F2W v24 — instant top-navigation prefetch */
(() => {
  'use strict';
  const prefetched=new Set();

  function prefetch(url) {
    try {
      const u=new URL(url,location.href);
      if(u.origin!==location.origin||u.href===location.href||prefetched.has(u.href))return;
      prefetched.add(u.href);
      const link=document.createElement('link');
      link.rel='prefetch';
      link.href=u.href;
      link.as='document';
      document.head.appendChild(link);
    } catch {}
  }

  function headerTargets() {
    document.querySelectorAll('body.f2w-main-page > header a[href]').forEach(a=>prefetch(a.href));
    ['/home/','/favorites/','/support/','/profile/','/chat/','/leaderboard/','/forum/'].forEach(prefetch);
    try {
      const username=localStorage.getItem('f2w_profile_username_v24');
      if(username)prefetch(`/profile/?user=${encodeURIComponent(username)}`);
    } catch {}
  }

  document.addEventListener('pointerover',e=>{
    const link=e.target.closest?.('body.f2w-main-page > header a[href]');
    if(link)prefetch(link.href);
  },{passive:true});

  document.addEventListener('pointerdown',e=>{
    const btn=e.target.closest?.('#favorites-nav-btn,#support-nav-btn,#profile-nav-btn');
    if(!btn)return;
    if(btn.id==='favorites-nav-btn')prefetch('/favorites/');
    if(btn.id==='support-nav-btn')prefetch('/support/');
    if(btn.id==='profile-nav-btn'){
      try {
        const username=localStorage.getItem('f2w_profile_username_v24');
        if(username)prefetch(`/profile/?user=${encodeURIComponent(username)}`);
      } catch {}
    }
  },{passive:true,capture:true});

  if('requestIdleCallback' in window)requestIdleCallback(headerTargets,{timeout:900});
  else setTimeout(headerTargets,250);
})();

// f2w-force-save:fast-nav-prefetch-v24:1788215534
 

/* F2W v26 — page fade state recovery */
(() => {
  'use strict';
  const ready=()=>{
    const root=document.documentElement;
    root.classList.remove('f2w-page-enter');
    root.classList.add('f2w-page-ready');
  };
  window.addEventListener('pageshow',ready,{passive:true});
  if(document.readyState!=='loading')ready();
})();
// f2w-force-save:fade-state-v26:1788216027
 

/* F2W v33 — navigation warmup + low-overhead performance */
(() => {
  'use strict';

  const warmed=new Set();
  function warm(href){
    try{
      const u=new URL(href,location.href);
      if(u.origin!==location.origin || warmed.has(u.pathname+u.search) || u.href===location.href)return;
      warmed.add(u.pathname+u.search);

      const link=document.createElement('link');
      link.rel='prefetch';
      link.href=u.href;
      link.fetchPriority='low';
      document.head.appendChild(link);
    }catch{}
  }

  const common=[
    '/home/','/watch/','/favorites/','/profile/','/support/',
    '/chat/','/leaderboard/','/forum/','/users/'
  ];

  const run=()=>{
    common.forEach(warm);
    document.querySelectorAll('body.f2w-main-page > header a[href]').forEach(a=>warm(a.href));
  };

  if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:800});
  else setTimeout(run,180);

  document.addEventListener('pointerover',e=>{
    const a=e.target.closest?.('a[href]');
    if(a)warm(a.href);
  },{passive:true});

  // Let the browser reuse already-loaded documents/resources when navigating back/forward.
  window.addEventListener('pageshow',()=>{
    document.documentElement.classList.remove('f2w-page-enter');
    document.documentElement.classList.add('f2w-page-ready');
  },{passive:true});
})();
// f2w-force-save:navigation-warmup-v33:1788217440
 

/* F2W v34 — service worker navigation accelerator */
(() => {
  'use strict';
  if(!('serviceWorker' in navigator))return;
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('/sw-v34.js?v=60-1788221799',{scope:'/'})
      .catch(error=>console.warn('F2W service worker registration failed:',error));
  },{once:true,passive:true});
})();
// f2w-force-save:service-worker-register-v34:1788217565
 

/* F2W v44 — useful logged-out header buttons */
(() => {
  'use strict';

  function guestHeaderActions(){
    const body=document.body;
    if(!body||body.classList.contains('f2w-authenticated'))return;

    const fav=document.getElementById('favorites-nav-btn');
    const profile=document.getElementById('profile-nav-btn');
    const support=document.getElementById('support-nav-btn');

    if(fav){
      fav.style.removeProperty('display');
      fav.hidden=false;
      fav.onclick=(event)=>{
        event.preventDefault();
        if(typeof window.openHeaderAuth==='function')window.openHeaderAuth('login');
      };
    }

    if(profile){
      profile.style.removeProperty('display');
      profile.hidden=false;
      profile.onclick=(event)=>{
        event.preventDefault();
        if(typeof window.openHeaderAuth==='function')window.openHeaderAuth('login');
      };
    }

    if(support){
      support.style.removeProperty('display');
      support.hidden=false;
      support.onclick=()=>{ location.href='/support/'; };
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',guestHeaderActions,{once:true});
  }else{
    guestHeaderActions();
  }

  window.addEventListener('pageshow',guestHeaderActions,{passive:true});
})();
// f2w-force-save:guest-header-actions-v44:1788219651
 

/* ============================================================
   F2W v50 — SITEWIDE CHAT PRELOAD / CONNECTION WARMUP
   ============================================================ */
(() => {
  'use strict';
  if(window.__f2wChatWarmupV50)return;
  window.__f2wChatWarmupV50=true;

  const addLink=(rel,href,extra={})=>{
    try{
      if(document.head.querySelector(`link[rel="${rel}"][href="${href}"]`))return;
      const l=document.createElement('link');
      l.rel=rel;l.href=href;
      Object.assign(l,extra);
      document.head.appendChild(l);
    }catch{}
  };

  function warmChat(){
    // Warm the chat page HTML + shared same-origin resources.
    addLink('prefetch','/chat/');
    addLink('prefetch','/chat/index.html');

    // Warm Supabase DNS/TLS early.
    addLink('preconnect','https://viqufxlcxwgboyxbdhjb.supabase.co',{crossOrigin:'anonymous'});
    addLink('dns-prefetch','//viqufxlcxwgboyxbdhjb.supabase.co');

    // Resolve auth session early so /chat/ doesn't spend the first seconds discovering auth.
    try{
      const client=window.chatSupabase||window.supabaseClient||window.f2wSupabase;
      client?.auth?.getSession?.().catch?.(()=>{});
    }catch{}

    // Lightweight network warmup to Supabase REST endpoint.
    fetch('https://viqufxlcxwgboyxbdhjb.supabase.co/rest/v1/',{
      method:'HEAD',
      mode:'cors',
      cache:'no-store',
      credentials:'omit',
      headers:{apikey:'sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge'}
    }).catch(()=>{});
  }

  if('requestIdleCallback' in window)requestIdleCallback(warmChat,{timeout:700});
  else setTimeout(warmChat,120);

  // Hover/touch on Chat forces another warm pass immediately.
  document.addEventListener('pointerover',e=>{
    if(e.target.closest?.('.chat-button,[href="/chat/"],[href="/chat"]'))warmChat();
  },{passive:true});

  document.addEventListener('pointerdown',e=>{
    if(e.target.closest?.('.chat-button,[href="/chat/"],[href="/chat"]'))warmChat();
  },{capture:true,passive:true});
})();
// f2w-force-save:chat-preload-v50:1788220357

/* ============================================================
   F2W v56 — SITE-WIDE AUTH RESTORE
   One working Login/Create Account flow on every page.
   ============================================================ */
(() => {
  'use strict';
  if(window.__f2wAuthRestoreV56)return;
  window.__f2wAuthRestoreV56=true;

  const SUPABASE_URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
  const SUPABASE_KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
  let fallbackClient=null;
  let mode='login';
  let swipeStartX=null;

  function client(){
    try{if(window.chatSupabase?.auth)return window.chatSupabase;}catch{}
    try{if(window.f2wSupabase?.auth)return window.f2wSupabase;}catch{}
    try{if(window.supabaseClient?.auth)return window.supabaseClient;}catch{}
    try{
      if(!fallbackClient && window.supabase?.createClient){
        fallbackClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
      }
    }catch{}
    return fallbackClient;
  }

  function ensureModal(){
    let modal=document.getElementById('account-modal');
    if(modal)return modal;

    modal=document.createElement('div');
    modal.className='account-modal f2w-auth-modal-v56';
    modal.id='account-modal';
    modal.innerHTML=`
      <div class="account-card f2w-auth-card-v56" role="dialog" aria-modal="true" aria-labelledby="f2w-auth-title-v56">
        <div class="account-header">
          <div>
            <div class="account-title" id="f2w-auth-title-v56"><i class="fa-solid fa-user"></i> Account</div>
            <div class="account-subtitle">FLIX2WATCH ACCOUNT</div>
          </div>
          <button class="chat-close f2w-auth-close-v56" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="account-body">
          <div id="account-logged-out">
            <div class="account-tabs f2w-auth-tabs-v56">
              <button class="account-tab active" id="account-login-tab" type="button">Log In</button>
              <button class="account-tab" id="account-signup-tab" type="button">Create Account</button>
            </div>
            <div class="f2w-auth-slider-v56">
              <div class="f2w-auth-pane-v56" id="f2w-auth-pane-v56">
                <div id="account-username-wrap" style="display:none">
                  <label class="account-label">USERNAME</label>
                  <input class="account-input" id="account-username" maxlength="30" autocomplete="username" placeholder="Choose your username">
                  <div class="f2w-auth-hint-v56">2–30 letters or numbers only.</div>
                </div>
                <label class="account-label" id="account-email-label">USERNAME OR EMAIL</label>
                <input class="account-input" id="account-email" type="text" autocomplete="username" placeholder="Username or email">
                <label class="account-label">PASSWORD</label>
                <input class="account-input" id="account-password" type="password" autocomplete="current-password" placeholder="Password">
                <div id="account-confirm-wrap" style="display:none">
                  <label class="account-label">CONFIRM PASSWORD</label>
                  <input class="account-input" id="account-confirm" type="password" autocomplete="new-password" placeholder="Repeat password">
                </div>
                <button class="account-primary" id="account-submit" type="button">Log In</button>
                <div class="f2w-oauth-block">
                  <div class="f2w-oauth-divider"><span>or continue with</span></div>
                  <div class="f2w-oauth-grid">
                    <button class="f2w-oauth-btn google" type="button" data-provider="google"><i class="fa-brands fa-google"></i> <span class="f2w-oauth-label">Sign in with Google</span></button>
                    <button class="f2w-oauth-btn discord" type="button" data-provider="discord"><i class="fa-brands fa-discord"></i> <span class="f2w-oauth-label">Sign in with Discord</span></button>
                  </div>
                </div>
                <div class="account-message" id="account-message"></div>
              </div>
            </div>
          </div>
          <div id="account-logged-in" style="display:none"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);
    bindModal(modal);
    return modal;
  }

  function setMessage(message,error=false){
    const el=document.getElementById('account-message');
    if(!el)return;
    el.textContent=String(message||'');
    el.style.color=error?'#ff7782':'#94a3b8';
  }

  function setMode(next){
    mode=next==='signup'?'signup':'login';
    const login=document.getElementById('account-login-tab');
    const signup=document.getElementById('account-signup-tab');
    const userWrap=document.getElementById('account-username-wrap');
    const confirmWrap=document.getElementById('account-confirm-wrap');
    const emailLabel=document.getElementById('account-email-label');
    const submit=document.getElementById('account-submit');
    const password=document.getElementById('account-password');

    login?.classList.toggle('active',mode==='login');
    signup?.classList.toggle('active',mode==='signup');
    if(userWrap)userWrap.style.display=mode==='signup'?'block':'none';
    if(confirmWrap)confirmWrap.style.display=mode==='signup'?'block':'none';
    if(emailLabel)emailLabel.textContent=mode==='signup'?'EMAIL':'USERNAME OR EMAIL';
    if(submit)submit.textContent=mode==='signup'?'Create Account':'Log In';
    if(password)password.autocomplete=mode==='signup'?'new-password':'current-password';

    document.querySelectorAll('#account-modal .f2w-oauth-btn.google .f2w-oauth-label')
      .forEach(el=>el.textContent=mode==='signup'?'Sign up with Google':'Sign in with Google');
    document.querySelectorAll('#account-modal .f2w-oauth-btn.discord .f2w-oauth-label')
      .forEach(el=>el.textContent=mode==='signup'?'Sign up with Discord':'Sign in with Discord');

    const pane=document.getElementById('f2w-auth-pane-v56');
    if(pane){
      pane.classList.remove('swipe-left','swipe-right');
      pane.classList.add(mode==='signup'?'swipe-left':'swipe-right');
      setTimeout(()=>pane.classList.remove('swipe-left','swipe-right'),220);
    }
    setMessage('');
  }

  function openAuth(next='login'){
    const modal=ensureModal();
    setMode(next);
    modal.classList.add('open');
    modal.removeAttribute('hidden');
    modal.style.display='flex';
    document.documentElement.classList.add('f2w-auth-open-v56');
    setTimeout(()=>{
      const id=mode==='signup'?'account-username':'account-email';
      document.getElementById(id)?.focus();
    },60);
  }

  function closeAuth(){
    const modal=document.getElementById('account-modal');
    modal?.classList.remove('open');
    if(modal)modal.style.removeProperty('display');
    document.documentElement.classList.remove('f2w-auth-open-v56');
  }

  async function submit(){
    const c=client();
    if(!c?.auth){
      setMessage('Authentication is still loading. Try again in a moment.',true);
      return;
    }

    const email=String(document.getElementById('account-email')?.value||'').trim();
    const password=String(document.getElementById('account-password')?.value||'');
    const confirm=String(document.getElementById('account-confirm')?.value||'');
    const username=String(document.getElementById('account-username')?.value||'').trim();
    const button=document.getElementById('account-submit');

    if(mode==='signup'){
      if(!/^[A-Za-z0-9]{2,30}$/.test(username)){
        setMessage('Username must be 2–30 letters or numbers.',true);return;
      }
      if(!email.includes('@')){setMessage('Enter a valid email address.',true);return;}
      if(password.length<6){setMessage('Password must be at least 6 characters.',true);return;}
      if(password!==confirm){setMessage('Passwords do not match.',true);return;}
    }else{
      if(!email||!password){setMessage('Enter your username/email and password.',true);return;}
    }

    if(button)button.disabled=true;
    setMessage(mode==='signup'?'Creating account…':'Logging in…');

    try{
      if(mode==='login'){
        let result;
        if(typeof window.f2wLoginIdentifier==='function'){
          result=await window.f2wLoginIdentifier(email,password);
        }else{
          result=await c.auth.signInWithPassword({email,password});
        }
        if(result?.error)throw result.error;
        setMessage('Logged in.');
        setTimeout(()=>location.reload(),180);
      }else{
        const guard=window.__f2wAbuseGuard;
        if(guard?.preflight)await guard.preflight();

        const {data,error}=await c.auth.signUp({
          email,
          password,
          options:{data:{username,chat_alias:username}}
        });
        if(error)throw error;

        if(data?.session){
          try{
            await c.from('profiles').upsert({
              user_id:data.user.id,
              username,
              display_name:username
            },{onConflict:'user_id'});
          }catch{}
          setMessage('Account created.');
          setTimeout(()=>location.reload(),220);
        }else{
          setMessage('Account created. Check your email if confirmation is required.');
        }
      }
    }catch(error){
      setMessage(error?.message||'Authentication failed.',true);
    }finally{
      if(button)button.disabled=false;
    }
  }

  async function oauth(provider){
    const c=client();
    if(!c?.auth){setMessage('Authentication is still loading.',true);return;}
    try{
      const guard=window.__f2wAbuseGuard;
      if(guard?.preflight)await guard.preflight();
      const {error}=await c.auth.signInWithOAuth({
        provider,
        options:{redirectTo:location.href}
      });
      if(error)throw error;
    }catch(error){
      setMessage(error?.message||`${provider} login failed.`,true);
    }
  }

  function bindModal(modal){
    if(!modal||modal.dataset.f2wAuthBoundV56)return;
    modal.dataset.f2wAuthBoundV56='1';

    modal.addEventListener('click',e=>{
      if(e.target===modal)closeAuth();
    });
    modal.querySelector('.f2w-auth-close-v56,.chat-close')?.addEventListener('click',e=>{e.preventDefault();closeAuth();});
    modal.querySelector('#account-login-tab')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();setMode('login');},true);
    modal.querySelector('#account-signup-tab')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();setMode('signup');},true);
    modal.querySelector('#account-submit')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();submit();},true);

    modal.querySelectorAll('.f2w-oauth-btn').forEach(btn=>{
      btn.addEventListener('click',e=>{
        e.preventDefault();e.stopImmediatePropagation();
        const provider=btn.dataset.provider || (btn.classList.contains('discord')?'discord':'google');
        oauth(provider);
      },true);
    });

    const card=modal.querySelector('.account-card');
    card?.addEventListener('touchstart',e=>{swipeStartX=e.touches?.[0]?.clientX??null;},{passive:true});
    card?.addEventListener('touchend',e=>{
      if(swipeStartX==null)return;
      const end=e.changedTouches?.[0]?.clientX??swipeStartX;
      const dx=end-swipeStartX;swipeStartX=null;
      if(Math.abs(dx)<55)return;
      setMode(dx<0?'signup':'login');
    },{passive:true});
  }

  // This is the missing global function all header buttons already call.
  window.openHeaderAuth=openAuth;
  window.openAccountModal=window.openAccountModal || (()=>openAuth('login'));
  window.showAccountMode=window.showAccountMode || setMode;
  window.closeAccountModal=window.closeAccountModal || closeAuth;

  function bindSitewide(){
    const existing=document.getElementById('account-modal');
    if(existing)bindModal(existing);

    document.querySelectorAll('#header-login-btn').forEach(btn=>{
      btn.onclick=null;
      btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openAuth('login');},true);
    });
    document.querySelectorAll('#header-signup-btn').forEach(btn=>{
      btn.onclick=null;
      btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();openAuth('signup');},true);
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bindSitewide,{once:true});
  else bindSitewide();

  window.addEventListener('pageshow',bindSitewide,{passive:true});
})();
// f2w-force-save:sitewide-auth-restore-v56:1788221054

/* ============================================================
   F2W v57 — SITE-WIDE USER SEARCH AUTOCOMPLETE
   Independent of page-local search functions.
   ============================================================ */
(() => {
  'use strict';
  if(window.__f2wUserAutocompleteV57)return;
  window.__f2wUserAutocompleteV57=true;

  const SUPABASE_URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
  const SUPABASE_KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
  let fallbackClient=null;
  let timer=null;
  let requestSeq=0;

  function client(){
    try{if(window.chatSupabase?.from)return window.chatSupabase;}catch{}
    try{if(window.f2wSupabase?.from)return window.f2wSupabase;}catch{}
    try{if(window.supabaseClient?.from)return window.supabaseClient;}catch{}
    try{
      if(!fallbackClient && window.supabase?.createClient){
        fallbackClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
      }
    }catch{}
    return fallbackClient;
  }

  function esc(value=''){
    return String(value).replace(/[&<>"']/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    })[ch]);
  }

  function initials(value=''){
    const clean=String(value||'?').trim();
    return clean.slice(0,2).toUpperCase();
  }

  function ensureResults(input){
    const container=input.closest('.user-search-container') || input.parentElement;
    if(!container)return null;

    let results=container.querySelector('.user-search-results');
    if(!results){
      results=document.createElement('div');
      results.className='user-search-results f2w-user-search-results-v57';
      results.id=input.id==='user-search'?'user-search-results':'';
      results.setAttribute('role','listbox');
      results.setAttribute('aria-label','User search suggestions');
      container.appendChild(results);
    }
    return results;
  }

  function hideResults(input){
    const results=ensureResults(input);
    if(!results)return;
    results.classList.remove('show');
    results.innerHTML='';
  }

  function openProfile(username){
    const clean=String(username||'').trim().replace(/^@/,'');
    if(clean)location.href=`/profile/?user=${encodeURIComponent(clean)}`;
  }

  async function runSearch(input){
    const results=ensureResults(input);
    if(!results)return;

    const query=String(input.value||'').trim().replace(/[^A-Za-z0-9]/g,'');
    if(input.value!==query)input.value=query;

    const seq=++requestSeq;
    if(!query){
      hideResults(input);
      return;
    }

    results.classList.add('show');
    results.innerHTML='<div class="user-search-empty">Searching users…</div>';

    const c=client();
    if(!c?.from){
      results.innerHTML='<div class="user-search-empty">User search is loading…</div>';
      return;
    }

    try{
      const {data,error}=await c
        .from('profiles')
        .select('username,avatar_url')
        .not('username','is',null)
        .ilike('username',`${query}%`)
        .order('username',{ascending:true})
        .limit(8);

      if(seq!==requestSeq)return;
      if(error)throw error;

      if(!data?.length){
        results.innerHTML='<div class="user-search-empty">No users found.</div>';
        return;
      }

      results.innerHTML=data.map(profile=>{
        const username=String(profile.username||'').trim();
        const safe=esc(username);
        const avatar=profile.avatar_url
          ? `<img class="user-search-avatar" src="${esc(profile.avatar_url)}" alt="" loading="lazy" decoding="async">`
          : `<span class="user-search-avatar fallback">${esc(initials(username))}</span>`;
        return `<button class="user-search-result" type="button" role="option" data-username="${safe}">
          ${avatar}
          <span class="user-search-copy">
            <strong class="user-search-name" data-f2w-username="${safe}">@${safe}</strong>
            <span class="user-search-sub">View public profile</span>
          </span>
          <i class="fa-solid fa-arrow-right"></i>
        </button>`;
      }).join('');

      results.querySelectorAll('.user-search-result').forEach(button=>{
        button.addEventListener('pointerdown',e=>{
          e.preventDefault();
          openProfile(button.dataset.username);
        });
      });
    }catch(error){
      console.warn('User autocomplete failed:',error?.message||error);
      if(seq===requestSeq){
        results.innerHTML='<div class="user-search-empty">Could not search users right now.</div>';
      }
    }
  }

  function schedule(input){
    clearTimeout(timer);
    timer=setTimeout(()=>runSearch(input),90);
  }

  function activateInput(input){
    if(!input || input.dataset.f2wAutocompleteV57)return;
    input.dataset.f2wAutocompleteV57='1';

    // The old password-manager protection left these readonly on some pages.
    input.removeAttribute('readonly');
    input.setAttribute('autocomplete','off');
    input.setAttribute('aria-autocomplete','list');

    ensureResults(input);

    input.addEventListener('input',()=>schedule(input),{passive:true});
    input.addEventListener('focus',()=>{
      input.removeAttribute('readonly');
      if(input.value.trim())schedule(input);
    },{passive:true});

    input.addEventListener('keydown',e=>{
      if(e.key==='Escape')hideResults(input);
      if(e.key==='Enter'){
        const first=ensureResults(input)?.querySelector('.user-search-result');
        if(first){
          e.preventDefault();
          openProfile(first.dataset.username);
        }
      }
    });

    input.addEventListener('blur',()=>setTimeout(()=>hideResults(input),160),{passive:true});
  }

  function bindAll(){
    document.querySelectorAll('.user-search-container input[type="search"],#user-search')
      .forEach(activateInput);
  }

  // Capture input before any stale page-local no-op handler can interfere.
  document.addEventListener('input',e=>{
    const input=e.target.closest?.('.user-search-container input,#user-search');
    if(input)schedule(input);
  },true);

  document.addEventListener('pointerdown',e=>{
    const input=e.target.closest?.('.user-search-container input,#user-search');
    if(input)input.removeAttribute('readonly');
  },{capture:true,passive:true});

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',bindAll,{once:true});
  }else{
    bindAll();
  }

  new MutationObserver(bindAll).observe(document.documentElement,{childList:true,subtree:true});
})();
// f2w-force-save:user-autocomplete-v57:1788221142
// f2w-force-save:sw-v58-register:1788221340
// f2w-force-save:user-search-role-hook-v59:1788221542
// f2w-force-save:auth-modal-lock-register-v60:1788221799

/* ============================================================
   F2W v62 — NORMAL TEXT INPUTS / NO PASSWORD-MANAGER MISCLASSIFICATION
   ============================================================ */
(() => {
  'use strict';
  if(window.__f2wTextInputGuardV62)return;
  window.__f2wTextInputGuardV62=true;

  const NON_AUTH_SELECTORS = [
    '#movie-search',
    '#user-search',
    '#forum-search',
    '#forum-search-input',
    '#v35-dm-user-search',
    '.movie-search-container input',
    '.user-search-container input',
    '.forum-search input',
    'input[data-f2w-search]',
    'input[type="search"]'
  ].join(',');

  function harden(input){
    if(!input || input.closest?.('#account-modal'))return;
    if(input.matches?.('input[type="password"],input[type="email"]'))return;

    // These are ordinary search/text fields, not credentials.
    input.type = 'search';
    input.autocomplete = 'off';
    input.setAttribute('autocapitalize','none');
    input.setAttribute('spellcheck','false');
    input.setAttribute('data-lpignore','true');
    input.setAttribute('data-1p-ignore','true');
    input.setAttribute('data-bwignore','true');
    input.setAttribute('data-form-type','other');
    input.setAttribute('aria-autocomplete', input.id==='user-search' ? 'list' : 'none');

    // Remove credential-ish names that trigger browser password managers.
    const name=String(input.getAttribute('name')||'').toLowerCase();
    if(/user|email|login|pass|account/.test(name)){
      input.setAttribute('name',`f2w_search_${input.id||'field'}`);
    }
  }

  function hardenAll(){
    document.querySelectorAll(NON_AUTH_SELECTORS).forEach(harden);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',hardenAll,{once:true});
  } else {
    hardenAll();
  }

  new MutationObserver(hardenAll).observe(document.documentElement,{childList:true,subtree:true});

  document.addEventListener('focusin',e=>{
    const input=e.target.closest?.(NON_AUTH_SELECTORS);
    if(input)harden(input);
  },true);
})();
// f2w-force-save:text-input-guard-v62:1788221977
 