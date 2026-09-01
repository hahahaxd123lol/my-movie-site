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
        fallbackClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
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

  window.f2wSetAuthMessage=setMessage;

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

    if(modal){
      modal.classList.remove(
        'open',
        'f2w-auth-v67',
        'f2w-auth-hard-open-v58',
        'f2w-auth-modal-open-v60'
      );
      modal.style.removeProperty('display');
      modal.setAttribute('aria-hidden','true');
      modal.setAttribute('inert','');
    }

    // Clean every historical auth scroll/backdrop lock.
    document.documentElement.classList.remove(
      'f2w-auth-open-v56',
      'f2w-auth-v67-open'
    );
    document.body?.classList.remove(
      'f2w-auth-v67-open'
    );

    document.documentElement.style.removeProperty('overflow');
    document.documentElement.style.removeProperty('height');

    if(document.body){
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('position');
      document.body.style.removeProperty('top');
      document.body.style.removeProperty('left');
      document.body.style.removeProperty('right');
      document.body.style.removeProperty('width');
      document.body.style.removeProperty('min-height');
    }

    // /users/ can place the account modal in a native top-layer dialog.
    const dialog=document.getElementById('f2w-users-auth-dialog-v73');
    if(dialog){
      try{ if(dialog.open) dialog.close(); }catch{}
      dialog.removeAttribute('open');
    }
  }

  async function submit(){
    const c=client();
    if(!c?.auth){
      setMessage('Authentication is still loading. Try again in a moment.',true);
      return;
    }

    const identifier=String(document.getElementById('account-email')?.value||'').trim();
    const password=String(document.getElementById('account-password')?.value||'');
    const confirm=String(document.getElementById('account-confirm')?.value||'');
    const username=String(document.getElementById('account-username')?.value||'').trim();
    const button=document.getElementById('account-submit');

    if(mode==='signup'){
      if(!/^[A-Za-z0-9]{2,30}$/.test(username)){
        setMessage('Username must be 2–30 letters or numbers.',true);return;
      }
      if(!identifier.includes('@')){
        setMessage('Enter a valid email address.',true);return;
      }
      if(password.length<6){
        setMessage('Password must be at least 6 characters.',true);return;
      }
      if(password!==confirm){
        setMessage('Passwords do not match.',true);return;
      }
    }else{
      if(!identifier||!password){
        setMessage('Enter your username/email and password.',true);return;
      }
    }

    if(button){
      button.disabled=true;
      button.dataset.f2wBusy='1';
      button.dataset.f2wOriginalText=button.textContent||'';
      button.innerHTML=mode==='signup'
        ? '<i class="fa-solid fa-circle-notch fa-spin"></i> Creating account…'
        : '<i class="fa-solid fa-circle-notch fa-spin"></i> Logging in…';
    }

    setMessage(mode==='signup'?'Creating your account…':'Logging you in…');

    try{
      let authenticatedUser=null;
      let authenticatedSession=null;

      if(mode==='login'){
        let result;
        if(typeof window.f2wLoginIdentifier==='function'){
          result=await window.f2wLoginIdentifier(identifier,password);
        }else{
          result=await c.auth.signInWithPassword({email:identifier,password});
        }

        if(result?.error)throw result.error;

        authenticatedUser=result?.data?.user||null;
        authenticatedSession=result?.data?.session||null;

        if(!authenticatedUser){
          const sessionResult=await c.auth.getSession();
          authenticatedSession=authenticatedSession||sessionResult?.data?.session||null;
          authenticatedUser=authenticatedSession?.user||null;
        }

        if(!authenticatedUser){
          throw new Error('Login succeeded but the account session could not be loaded.');
        }

        setMessage('Logged in successfully.');
      }else{
        const guard=window.__f2wAbuseGuard;
        if(guard?.preflight)await guard.preflight();

        const {data,error}=await c.auth.signUp({
          email:identifier,
          password,
          options:{data:{username,chat_alias:username}}
        });
        if(error)throw error;

        authenticatedUser=data?.user||null;
        authenticatedSession=data?.session||null;

        if(data?.session){
          try{
            await c.from('profiles').upsert({
              user_id:data.user.id,
              username,
              display_name:username
            },{onConflict:'user_id'});
          }catch{}

          setMessage('Account created and signed in.');
        }else{
          setMessage('Account created. Check your email if confirmation is required.');
          return;
        }
      }

      // Sync every site-wide auth UI BEFORE closing the modal.
      try{ window.currentUser=authenticatedUser||authenticatedSession?.user||null; }catch{}
      try{ await window.f2wRefreshAccountV70?.(); }catch{}
      try{ window.refreshAccountUI?.(); }catch{}

      // Notify page-specific gates (Watch, Chat, Favorites, etc.).
      window.dispatchEvent(new CustomEvent('f2w:auth-success',{
        detail:{
          mode,
          user:authenticatedUser||authenticatedSession?.user||null,
          session:authenticatedSession||null
        }
      }));

      // Do not reload the page. Reloading was racing the Watch overlay/player.
      closeAuth();

      // A second session read after close keeps auth state deterministic.
      try{
        const {data}=await c.auth.getSession();
        if(data?.session?.user){
          window.currentUser=data.session.user;
          window.dispatchEvent(new CustomEvent('f2w:auth-session-ready',{
            detail:{user:data.session.user,session:data.session}
          }));
        }
      }catch{}
    }catch(error){
      console.error('Flix2Watch authentication error:',error);

      const raw=String(error?.message||'').trim();
      let message=raw||'Authentication failed.';

      if(/invalid login credentials|invalid credentials|email or password/i.test(raw)){
        message='Incorrect username/email or password.';
      }else if(/email not confirmed/i.test(raw)){
        message='Confirm your email address before logging in.';
      }else if(/user already registered|already been registered/i.test(raw)){
        message='An account with that email already exists.';
      }else if(/rate limit|too many requests/i.test(raw)){
        message='Too many attempts. Wait a moment and try again.';
      }

      setMessage(message,true);
    }finally{
      if(button){
        button.disabled=false;
        delete button.dataset.f2wBusy;
        button.textContent=mode==='signup'?'Create Account':'Log In';
      }
    }
  }
  window.submitAccountAuth=submit;

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
        fallbackClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
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
        .select('username,display_name,avatar_url')
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
        const displayName=String(profile.display_name||username||'Member').trim();
        return `<button class="user-search-result" type="button" role="option" data-username="${safe}">
          ${avatar}
          <span class="user-search-copy">
            <strong class="user-search-name" data-f2w-username="${safe}">${esc(displayName)}</strong>
            <span class="user-search-handle">@${safe}</span>
            <span class="user-search-sub">View public profile</span>
          </span>
          <i class="fa-solid fa-arrow-right"></i>
        </button>`;
      }).join('');

      try{window.f2wDecorateAutocompleteRolesV112?.(results);}catch{}

      results.querySelectorAll('.user-search-result').forEach(button=>{
        button.addEventListener('pointerdown',e=>{
          e.preventDefault();
          openProfile(button.dataset.username);
        });
      });

      // v64: role users get their role colour/particles; everyone else stays white.
      try{
        if(typeof window.decorateNames==='function')window.decorateNames();
      }catch{}
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
      if(e.key==='Enter'&&!e.isComposing){
        e.preventDefault();
        window.submitUserDirectorySearch?.();
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

/* ============================================================
   F2W v63 — HARD SEARCH / PASSWORD-MANAGER ISOLATION
   ============================================================ */
(() => {
  'use strict';
  if(window.__f2wSearchPasswordIsolationV63)return;
  window.__f2wSearchPasswordIsolationV63=true;

  const SEARCH_SELECTOR = [
    '#movie-search',
    '#user-search',
    '#forum-search',
    '#forum-search-input',
    '#v35-dm-user-search',
    '.movie-search-container input',
    '.user-search-container input',
    '.forum-v30-toolbar input',
    '.forum-search input',
    'input[data-f2w-search]',
    'input[type="search"]'
  ].join(',');

  function ensureIsolationForm(){
    let form=document.getElementById('f2w-search-isolation-form-v63');
    if(form)return form;

    form=document.createElement('form');
    form.id='f2w-search-isolation-form-v63';
    form.autocomplete='off';
    form.setAttribute('aria-hidden','true');
    form.style.display='none';
    document.body.appendChild(form);
    return form;
  }

  function isolateSearch(input,index=0){
    if(!input || input.closest?.('#account-modal'))return;
    if(input.matches?.('input[type="password"],input[type="email"]'))return;

    const form=ensureIsolationForm();

    input.type='search';
    input.setAttribute('role','searchbox');
    input.setAttribute('inputmode','search');
    input.setAttribute('autocomplete','one-time-code');
    input.setAttribute('autocapitalize','none');
    input.setAttribute('spellcheck','false');
    input.setAttribute('enterkeyhint','search');

    // Strong hints for common password managers.
    input.setAttribute('data-lpignore','true');
    input.setAttribute('data-1p-ignore','true');
    input.setAttribute('data-bwignore','true');
    input.setAttribute('data-form-type','other');
    input.setAttribute('data-protonpass-ignore','true');

    // Isolate search controls from any auth form present elsewhere in the DOM.
    input.setAttribute('form',form.id);

    // Credential-looking names are a common reason browsers attach password UI.
    input.setAttribute(
      'name',
      `f2w_query_${String(input.id||index).replace(/[^A-Za-z0-9]/g,'_')}_v63`
    );

    // Ensure this never inherits username/email semantics from older markup.
    input.removeAttribute('aria-haspopup');
    input.dataset.f2wSearchIsolatedV63='1';
  }

  function isolateAll(){
    [...document.querySelectorAll(SEARCH_SELECTOR)].forEach(isolateSearch);
    dehydrateClosedAuth();
  }

  /*
   * When the auth modal is closed, disable its credential controls.
   * This keeps hidden login/password fields from causing Chrome/Brave password
   * manager heuristics to associate unrelated search boxes with the login form.
   * They are re-enabled immediately when the auth popup opens.
   */
  function authFields(){
    return [...document.querySelectorAll(
      '#account-modal #account-username,'+
      '#account-modal #account-email,'+
      '#account-modal #account-password,'+
      '#account-modal #account-confirm'
    )];
  }

  function dehydrateClosedAuth(){
    const modal=document.getElementById('account-modal');
    if(!modal)return;
    const open=modal.classList.contains('open') ||
      modal.classList.contains('f2w-auth-modal-open-v60') ||
      modal.classList.contains('f2w-auth-hard-open-v58');

    authFields().forEach(field=>{
      if(open){
        field.disabled=false;
        field.removeAttribute('data-f2w-auth-disabled-v63');
      }else{
        field.disabled=true;
        field.setAttribute('data-f2w-auth-disabled-v63','1');
      }
    });
  }

  function enableAuthFields(){
    authFields().forEach(field=>{
      field.disabled=false;
      field.removeAttribute('data-f2w-auth-disabled-v63');
    });
  }

  // Wrap the existing auth opener so fields are enabled only when actually needed.
  const installAuthWrapper=()=>{
    if(typeof window.openHeaderAuth==='function' && !window.openHeaderAuth.__f2wV63Wrapped){
      const original=window.openHeaderAuth;
      const wrapped=function(...args){
        enableAuthFields();
        return original.apply(this,args);
      };
      wrapped.__f2wV63Wrapped=true;
      window.openHeaderAuth=wrapped;
      window.f2wOpenAuth=wrapped;
    }
  };

  document.addEventListener('pointerdown',e=>{
    const input=e.target.closest?.(SEARCH_SELECTOR);
    if(input)isolateSearch(input);
  },{capture:true,passive:true});

  document.addEventListener('focusin',e=>{
    const input=e.target.closest?.(SEARCH_SELECTOR);
    if(input)isolateSearch(input);
  },true);

  document.addEventListener('click',e=>{
    if(e.target.closest?.('#header-login-btn,#header-signup-btn,#watch-login-overlay .watch-login-actions button')){
      enableAuthFields();
    }
  },true);

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{
      isolateAll();
      installAuthWrapper();
    },{once:true});
  }else{
    isolateAll();
    installAuthWrapper();
  }

  new MutationObserver(()=>{
    isolateAll();
    installAuthWrapper();
  }).observe(document.documentElement,{childList:true,subtree:true});

  window.addEventListener('pageshow',()=>{
    isolateAll();
    installAuthWrapper();
  },{passive:true});
})();
// f2w-force-save:search-password-isolation-v63:1788222324
// f2w-force-save:user-search-role-decoration-v64:1788222358

/* ============================================================
   F2W v65 — SEARCH FIELDS MUST NEVER ACT LIKE LOGIN FIELDS
   ============================================================ */
(() => {
  'use strict';
  if(window.__f2wSearchNoPasswordV65)return;
  window.__f2wSearchNoPasswordV65=true;

  const SEARCH_SELECTOR = [
    '#movie-search',
    '#user-search',
    '#forum-search',
    '#forum-search-input',
    '#v35-dm-user-search',
    '.movie-search-container input',
    '.user-search-container input',
    '.forum-v30-toolbar input',
    '.forum-search input',
    'input[type="search"]'
  ].join(',');

  function randomName(input){
    if(input.dataset.f2wRandomSearchNameV65)return;
    input.dataset.f2wRandomSearchNameV65='1';
    const seed=Math.random().toString(36).slice(2,10);
    input.name=`f2w_q_${seed}`;
  }

  function harden(input){
    if(!input || input.closest?.('#account-modal'))return;
    if(input.matches?.('input[type="password"],input[type="email"]'))return;

    input.type='search';
    input.autocomplete='off';
    input.setAttribute('role','searchbox');
    input.setAttribute('inputmode','search');
    input.setAttribute('autocapitalize','none');
    input.setAttribute('spellcheck','false');
    input.setAttribute('enterkeyhint','search');

    input.setAttribute('data-lpignore','true');
    input.setAttribute('data-1p-ignore','true');
    input.setAttribute('data-bwignore','true');
    input.setAttribute('data-form-type','other');
    input.setAttribute('data-protonpass-ignore','true');

    randomName(input);

    // Keep readonly until the real pointer interaction. This prevents Chromium
    // from pre-classifying the field as a username/login autofill target.
    if(document.activeElement!==input && !input.dataset.f2wSearchActivatedV65){
      input.readOnly=true;
    }
  }

  function activate(input,e){
    if(!input)return;
    e?.preventDefault?.();
    input.dataset.f2wSearchActivatedV65='1';
    input.readOnly=false;
    randomName(input);
    try{input.focus({preventScroll:true})}catch{input.focus()}
    const len=String(input.value||'').length;
    try{input.setSelectionRange(len,len)}catch{}
  }

  function lockClosedAuth(){
    const modal=document.getElementById('account-modal');
    if(!modal)return;
    const isOpen=modal.classList.contains('open') ||
      modal.classList.contains('f2w-auth-modal-open-v60') ||
      modal.classList.contains('f2w-auth-hard-open-v58');

    if(!isOpen){
      modal.setAttribute('inert','');
      modal.setAttribute('aria-hidden','true');
    }else{
      modal.removeAttribute('inert');
      modal.setAttribute('aria-hidden','false');
    }
  }

  function scan(){
    document.querySelectorAll(SEARCH_SELECTOR).forEach(harden);
    lockClosedAuth();
  }

  document.addEventListener('pointerdown',e=>{
    const input=e.target.closest?.(SEARCH_SELECTOR);
    if(input && !input.closest('#account-modal'))activate(input,e);
  },true);

  document.addEventListener('keydown',e=>{
    const input=e.target.closest?.(SEARCH_SELECTOR);
    if(input && input.readOnly){
      input.readOnly=false;
      input.dataset.f2wSearchActivatedV65='1';
    }
  },true);

  document.addEventListener('blur',e=>{
    const input=e.target.closest?.(SEARCH_SELECTOR);
    if(input){
      input.dataset.f2wSearchActivatedV65='';
      setTimeout(()=>{ if(document.activeElement!==input) input.readOnly=true; },0);
    }
  },true);

  document.addEventListener('click',e=>{
    if(e.target.closest?.('#header-login-btn,#header-signup-btn,#watch-login-overlay .watch-login-actions button')){
      document.getElementById('account-modal')?.removeAttribute('inert');
    }
  },true);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan,{once:true});
  else scan();

  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('pageshow',scan,{passive:true});
})();
// f2w-force-save:search-no-password-v65:1788222474

/* ============================================================
   F2W v66 — REMOVE LEGACY FLOATING USER SEARCH ARROWS
   ============================================================ */
(() => {
  'use strict';
  if(window.__f2wUserSearchArrowFixV66)return;
  window.__f2wUserSearchArrowFixV66=true;

  function fixArrow(){
    document.querySelectorAll('.f2w-search-pair').forEach(pair=>{
      const container=pair.querySelector('.user-search-container');
      if(!container)return;

      // Any submit control intended for user search must live inside the container.
      [...pair.querySelectorAll(
        '.user-search-submit,[data-user-search-submit],button[onclick*="submitUserDirectorySearch"]'
      )].forEach(btn=>{
        if(container.contains(btn))return;

        // If the container has no in-box submit button, move the legacy one in.
        const inBox=container.querySelector(
          '.user-search-submit,[data-user-search-submit],button[onclick*="submitUserDirectorySearch"]'
        );
        if(!inBox){
          container.appendChild(btn);
        }else{
          btn.remove();
        }
      });
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',fixArrow,{once:true});
  }else{
    fixArrow();
  }

  new MutationObserver(fixArrow).observe(document.documentElement,{childList:true,subtree:true});
})();
// f2w-force-save:user-search-arrow-js-v66:1788222669

/* ============================================================
   F2W v70 — SITE-WIDE REAL ACCOUNT STATE
   ============================================================ */
(() => {
  'use strict';
  if(window.__f2wAccountStateV70)return;
  window.__f2wAccountStateV70=true;

  const SUPABASE_URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
  const SUPABASE_KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
  const OWNER_ID='f5454804-a2a6-4602-9086-51cf51f11c77';
  let client=null;
  let lastUser=null;

  function db(){
    try{if(window.chatSupabase?.auth)return window.chatSupabase;}catch{}
    try{if(window.f2wSupabase?.auth)return window.f2wSupabase;}catch{}
    try{if(window.supabaseClient?.auth)return window.supabaseClient;}catch{}
    try{
      if(!client && window.supabase?.createClient){
        client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      }
    }catch{}
    return client;
  }

  function ensureLoggedInMarkup(){
    const host=document.getElementById('account-logged-in');
    if(!host)return null;

    // Keep the richer canonical account box if it already exists.
    if(document.getElementById('account-user-email') &&
       document.getElementById('account-user-username') &&
       document.getElementById('account-user-role')) return host;

    host.innerHTML=`
      <div class="account-user-box">
        <div class="account-user-avatar"><i class="fa-solid fa-user"></i></div>
        <div>
          <div class="account-user-email" id="account-user-email">Signed-in user</div>
          <div class="account-user-username" id="account-user-username">@username</div>
          <div class="account-role" id="account-user-role">MEMBER</div>
        </div>
      </div>

      <div class="account-username-change" id="account-username-change-box">
        <div class="account-username-change-head">
          <div>
            <strong><i class="fa-solid fa-at"></i> CHANGE USERNAME</strong>
            <span>You can change it whenever you want.</span>
          </div>
        </div>
        <div class="account-username-change-row">
          <input class="account-input" id="account-change-username" type="text"
            inputmode="text" pattern="[A-Za-z0-9]+" minlength="2" maxlength="30"
            autocomplete="off" placeholder="New username">
          <button class="account-secondary account-change-username-btn" type="button"
            onclick="changeFlix2WatchUsername()">Update Username</button>
        </div>
        <div class="account-username-change-note">
          2–30 English letters or numbers only. Your old usernames may stay reserved,
          and account restrictions follow your account.
        </div>
      </div>

      <button class="account-secondary" id="account-support-btn" type="button"
        onclick="window.location.href='/support/'">
        <i class="fa-solid fa-life-ring"></i> Support
      </button>
      <button class="account-secondary" id="account-staff-control" type="button" hidden>
        <i class="fa-solid fa-shield-halved"></i> Staff Control Center
      </button>
      <button class="account-secondary" type="button" onclick="signOutAccount()">Log Out</button>
    `;
    return host;
  }

  async function resolveRole(user, username){
    if(!user)return {key:'member',label:'MEMBER'};
    if(String(user.id)===OWNER_ID)return {key:'owner',label:'OWNER'};

    const c=db();
    try{
      const {data}=await c.rpc('get_staff_context');
      const role=String(data?.role||'').toLowerCase();
      if(role==='staff')return {key:'staff',label:'STAFF'};
      if(role==='owner')return {key:'owner',label:'OWNER'};
    }catch{}

    if(username){
      try{
        const {data}=await c.rpc('get_public_profile_role',{p_username:username});
        const row=Array.isArray(data)?data[0]:data;
        const role=String(row?.top_role||row?.role_key||row?.role||'').toLowerCase();
        if(role)return {key:role,label:role.toUpperCase()};
      }catch{}
    }

    return {key:'member',label:'MEMBER'};
  }

  async function readProfile(user){
    if(!user)return null;
    const c=db();
    if(!c?.from)return null;
    try{
      const {data}=await c.from('profiles')
        .select('username,display_name')
        .eq('user_id',user.id)
        .maybeSingle();
      return data||null;
    }catch{return null}
  }

  function setHeaderState(user, roleKey){
    const logged=Boolean(user);
    document.body?.classList.toggle('f2w-authenticated',logged);

    const login=document.getElementById('header-login-btn');
    const signup=document.getElementById('header-signup-btn');
    const fav=document.getElementById('favorites-nav-btn');
    const profile=document.getElementById('profile-nav-btn');
    const support=document.getElementById('support-nav-btn');
    const account=document.getElementById('account-btn');
    const notify=document.getElementById('notification-wrap');
    const staff=document.getElementById('staff-control-nav');

    if(login)login.style.display=logged?'none':'flex';
    if(signup)signup.style.display=logged?'none':'flex';

    [fav,profile,support].forEach(el=>{
      if(el)el.style.display='flex';
    });

    if(account){
      account.style.display=logged?'flex':'none';
      if(logged){
        account.innerHTML=roleKey==='owner'
          ? '<i class="fa-solid fa-crown"></i> Owner'
          : '<i class="fa-regular fa-user"></i> Account';
      }
    }

    if(notify)notify.style.display=logged?'block':'none';

    const canStaff=['owner','staff','moderator','support','developer'].includes(roleKey);
    if(staff){
      staff.hidden=!canStaff;
      staff.style.display=canStaff?'flex':'none';
      if(canStaff){
        staff.removeAttribute('aria-disabled');
        staff.removeAttribute('tabindex');
        staff.onclick=()=>{location.href='/staff/'};
      }
    }
  }

  async function refresh(){
    const c=db();
    if(!c?.auth)return null;

    let session=null;
    try{
      const {data}=await c.auth.getSession();
      session=data?.session||null;
    }catch{}

    const user=session?.user||null;
    lastUser=user;

    const loggedOut=document.getElementById('account-logged-out');
    const loggedIn=ensureLoggedInMarkup();

    if(!user){
      if(loggedOut)loggedOut.style.display='block';
      if(loggedIn)loggedIn.style.display='none';
      setHeaderState(null,'member');
      return null;
    }

    const profile=await readProfile(user);
    const username=String(
      profile?.username ||
      user.user_metadata?.username ||
      user.user_metadata?.chat_alias ||
      ''
    ).trim().replace(/^@/,'');

    const role=await resolveRole(user,username);

    if(loggedOut)loggedOut.style.display='none';
    if(loggedIn)loggedIn.style.display='block';

    const emailEl=document.getElementById('account-user-email');
    const usernameEl=document.getElementById('account-user-username');
    const roleEl=document.getElementById('account-user-role');
    const changeInput=document.getElementById('account-change-username');
    const staffBtn=document.getElementById('account-staff-control');
    const supportBtn=document.getElementById('account-support-btn');

    if(emailEl)emailEl.textContent=user.email||'Signed-in user';
    if(usernameEl){
      usernameEl.textContent=username?`@${username}`:'@username';
      usernameEl.dataset.username=username;
      usernameEl.dataset.f2wUsername=username;
    }
    if(roleEl){
      roleEl.textContent=role.label;
      roleEl.dataset.role=role.key;
    }
    if(changeInput && !changeInput.matches(':focus'))changeInput.value=username;
    if(supportBtn){
      supportBtn.hidden=false;
      supportBtn.style.removeProperty('display');
    }
    if(staffBtn){
      const allowed=['owner','staff','moderator','support','developer'].includes(role.key);
      staffBtn.hidden=!allowed;
      staffBtn.style.display=allowed?'flex':'none';
      staffBtn.onclick=()=>{location.href='/staff/'};
    }

    setHeaderState(user,role.key);

    try{window.refreshAccountIdentityV54?.()}catch{}
    try{window.decorateNames?.()}catch{}

    return {user,profile,username,role};
  }

  function openModalVisual(){
    const m=document.getElementById('account-modal');
    if(!m)return;
    m.removeAttribute('inert');
    m.hidden=false;
    m.classList.add('open','f2w-auth-v67');
    m.setAttribute('aria-hidden','false');

    // Use the established v67 background lock when available.
    document.documentElement.classList.add('f2w-auth-v67-open');
    document.body.classList.add('f2w-auth-v67-open');
  }

  window.openAccountModal=async function(){
    const state=await refresh();
    if(!state?.user){
      try{window.openHeaderAuth?.('login')}catch{}
      return false;
    }
    openModalVisual();
    return false;
  };

  window.signOutAccount=async function(){
    const c=db();
    if(!c?.auth)return;
    try{await c.auth.signOut();}catch{}
    try{
      const m=document.getElementById('account-modal');
      m?.classList.remove('open');
      m?.setAttribute('aria-hidden','true');
    }catch{}
    location.href='/home/';
  };

  window.changeFlix2WatchUsername=async function(){
    const c=db();
    const input=document.getElementById('account-change-username');
    const next=String(input?.value||'').trim();
    if(!/^[A-Za-z0-9]{2,30}$/.test(next)){
      if(input){
        input.setCustomValidity('Use 2–30 English letters or numbers.');
        input.reportValidity();
        input.setCustomValidity('');
      }
      return;
    }

    const {data:{session}}=await c.auth.getSession();
    const user=session?.user;
    if(!user)return window.openHeaderAuth?.('login');

    try{
      const {error}=await c.from('profiles').update({username:next}).eq('user_id',user.id);
      if(error)throw error;
      try{
        await c.auth.updateUser({data:{username:next,chat_alias:next}});
      }catch{}
      await refresh();
    }catch(error){
      alert(error?.message||'Could not update username.');
    }
  };

  async function boot(){
    await refresh();
    const c=db();
    try{
      c?.auth?.onAuthStateChange?.(()=>setTimeout(refresh,0));
    }catch{}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.addEventListener('pageshow',()=>setTimeout(refresh,0),{passive:true});
  window.f2wRefreshAccountV70=refresh;
})();
// f2w-force-save:account-state-v70:1788223711
 

/* ============================================================
   F2W v74 — REMOVE LEGACY LOOSE PRIVACY LINKS
   ============================================================ */
(() => {
  'use strict';
  if(window.__f2wPrivacyCleanupV74)return;
  window.__f2wPrivacyCleanupV74=true;

  function cleanup(){
    document.querySelectorAll('a[href="/privacy/"],a[href="/privacy"]').forEach(link=>{
      if(link.closest('.f2w-site-footer'))return;
      link.remove();
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',cleanup,{once:true});
  }else{
    cleanup();
  }
  new MutationObserver(cleanup).observe(document.documentElement,{childList:true,subtree:true});
})();
// f2w-force-save:privacy-cleanup-js-v74:1788224239


/* ============================================================
   F2W v82 — ONE USER SEARCH ENTER/ARROW HANDLER ONLY
   ============================================================ */
(() => {
  'use strict';
  if(window.__f2wUserSearchV82)return;
  window.__f2wUserSearchV82=true;

  let busy=false;

  function clean(value){
    return String(value||'').trim().replace(/[^A-Za-z0-9]/g,'').slice(0,30);
  }

  function hideAutocomplete(input){
    const host=input?.closest?.('.user-search-container')?.querySelector('.user-search-results')
      || document.getElementById('user-search-results');
    if(host){ host.classList.remove('show'); host.innerHTML=''; }
  }

  async function runDirectorySearch(){
    const input=document.getElementById('user-search');
    const query=clean(input?.value);
    if(!query || busy)return false;

    hideAutocomplete(input);
    busy=true;

    try{
      // v104: user searches always use their own real page.
      // No in-place /users/ mutation, no loader race, no infinite tab state.
      location.assign(`/users/search/?q=${encodeURIComponent(query)}&page=1`);
    }finally{
      // pageshow resets this after navigation; timeout protects cancelled navs.
      setTimeout(()=>{busy=false},1200);
    }
    return false;
  }

  window.submitUserDirectorySearch=runDirectorySearch;
  window.addEventListener('pageshow',()=>{busy=false;},{passive:true});

  // Capture Enter before any older target-level autocomplete listener.
  document.addEventListener('keydown',event=>{
    const input=event.target?.closest?.('#user-search,.user-search-container input');
    if(!input || event.key!=='Enter' || event.isComposing)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    runDirectorySearch();
  },true);

  // Arrow/button uses the exact same function.
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('.user-search-submit,[data-user-search-submit],button[onclick*="submitUserDirectorySearch"]');
    if(!button)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    runDirectorySearch();
  },true);
})();
// f2w-force-save:user-search-single-handler-v82:1788225709
// f2w-force-save:user-search-v82:1788225709
// f2w-force-save:autocomplete-display-name-v83:1788226300

/* ============================================================
   F2W v111 — DEDICATED SITE-WIDE MOVIE SEARCH PAGE
   ============================================================ */
(() => {
  'use strict';
  if(window.__f2wMovieSearchV111)return;
  window.__f2wMovieSearchV111=true;

  let navigating=false;

  function clean(value){
    return String(value||'').trim().replace(/\s+/g,' ').slice(0,120);
  }

  function findInput(){
    return document.getElementById('movie-search')
      || document.querySelector('.movie-search-container input[type="search"],.movie-search-container input');
  }

  function hideAutocomplete(input){
    try{
      const host=input?.closest?.('.movie-search-container')?.querySelector('.movie-search-results')
        || document.getElementById('movie-search-results');
      if(host){
        host.classList.remove('show');
        host.innerHTML='';
      }
    }catch{}
  }

  function submit(){
    if(navigating)return false;

    const input=findInput();
    const query=clean(input?.value);
    if(!query)return false;

    hideAutocomplete(input);
    navigating=true;

    // Real dedicated page. Same tab/window.
    location.assign(`/movies/search/?q=${encodeURIComponent(query)}&page=1`);
    return false;
  }

  window.submitMovieDirectorySearch=submit;

  document.addEventListener('keydown',event=>{
    const input=event.target?.closest?.('#movie-search,.movie-search-container input');
    if(!input || event.key!=='Enter' || event.isComposing)return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    submit();
  },true);

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.(
      '.movie-search-submit,[data-movie-search-submit],button[onclick*="submitMovieDirectorySearch"]'
    );
    if(!button)return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    submit();
  },true);

  window.addEventListener('pageshow',()=>{navigating=false;},{passive:true});
})();
// f2w-force-save:dedicated-movie-search-v111:1788290601

/* ============================================================
   F2W v91 — SITE-WIDE GENRE NAVIGATION
   ============================================================ */
(() => {
  'use strict';
  if(window.__f2wGenreNavigationV91)return;
  window.__f2wGenreNavigationV91=true;

  const GENRES = new Set([
    '28','35','27','878','53','80','10749','16','99',
    '14','12','18','10751','9648','36','10402','10752','37'
  ]);

  const GENRE_PATHS = {
    '28':'/genre/action/',
    '35':'/genre/comedy/',
    '27':'/genre/horror/',
    '878':'/genre/sci-fi/',
    '53':'/genre/thriller/',
    '80':'/genre/crime/',
    '10749':'/genre/romance/',
    '16':'/genre/animation/',
    '99':'/genre/documentary/',
    '14':'/genre/fantasy/',
    '12':'/genre/adventure/',
    '18':'/genre/drama/',
    '10751':'/genre/family/',
    '9648':'/genre/mystery/',
    '36':'/genre/history/',
    '10402':'/genre/music/',
    '10752':'/genre/war/',
    '37':'/genre/western/'
  };

  function openGenre(id){
    id=String(id||'').replace(/[^0-9]/g,'');
    if(!GENRES.has(id))return false;

    const target=GENRE_PATHS[id]||`/home/?genre=${encodeURIComponent(id)}&page=1`;
    location.href=target;
    return false;
  }

  window.f2wNavigateGenreV91=openGenre;

  document.addEventListener('click',event=>{
    const link=event.target?.closest?.(
      '.f2w-genre-menu a[href*="genre="], .f2w-genre-menu a[href^="/genre/"], a[data-f2w-genre]'
    );
    if(!link)return;

    let genre='';
    try{
      const url=new URL(link.href,location.origin);
      genre=url.searchParams.get('genre')||link.dataset.f2wGenre||'';
      if(!genre && url.pathname.startsWith('/genre/')){
        const entry=Object.entries(GENRE_PATHS).find(([,path])=>path===url.pathname);
        genre=entry?.[0]||'';
      }
    }catch{
      genre=link.dataset.f2wGenre||'';
    }

    genre=String(genre).replace(/[^0-9]/g,'');
    if(!GENRES.has(genre))return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    openGenre(genre);
  },true);
})();
// f2w-force-save:genre-navigation-v91:1788228094
// f2w-force-save:auth-session-stability-v92:1788228465

/* ============================================================
   F2W v93 — ONE AUTH SUBMIT PATH + DURABLE SESSION RECOVERY
   ============================================================ */
(() => {
  'use strict';
  if(window.__f2wAuthAuthorityV93)return;
  window.__f2wAuthAuthorityV93=true;

  let busy=false;

  function client(){
    try{if(window.chatSupabase?.auth)return window.chatSupabase;}catch{}
    try{if(window.f2wSupabase?.auth)return window.f2wSupabase;}catch{}
    try{if(window.supabaseClient?.auth)return window.supabaseClient;}catch{}
    try{
      if(window.supabase?.createClient){
        window.__f2wPersistentClientV93 ||= window.supabase.createClient(
          'https://viqufxlcxwgboyxbdhjb.supabase.co',
          'sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge',
          {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}
        );
        return window.__f2wPersistentClientV93;
      }
    }catch{}
    return null;
  }

  function modalMode(){
    return document.getElementById('account-signup-tab')?.classList.contains('active')
      ? 'signup' : 'login';
  }

  function message(text,error=false,success=false){
    const el=document.getElementById('account-message');
    if(!el)return;
    el.textContent=String(text||'');
    el.dataset.state=error?'error':(success?'success':'working');
    el.style.color=error?'#ff6977':(success?'#53e39b':'#9aadc1');
    el.style.display='block';
    el.style.visibility='visible';
    el.style.opacity='1';
  }

  function clearAllAuthLocks({closeModal=false}={}){
    const root=document.documentElement;
    const body=document.body;

    [
      'f2w-auth-open-v56','f2w-auth-v67-open','f2w-auth-open-v60',
      'f2w-auth-modal-open','f2w-auth-hard-open'
    ].forEach(cls=>{
      root.classList.remove(cls);
      body?.classList.remove(cls);
    });

    root.style.removeProperty('overflow');
    root.style.removeProperty('height');

    if(body){
      ['overflow','position','top','left','right','width','height','min-height']
        .forEach(prop=>body.style.removeProperty(prop));
    }

    if(closeModal){
      const modal=document.getElementById('account-modal');
      if(modal){
        modal.classList.remove('open','f2w-auth-v67','f2w-auth-hard-open-v58','f2w-auth-modal-open-v60');
        modal.setAttribute('aria-hidden','true');
        modal.setAttribute('inert','');
        modal.style.removeProperty('display');
      }

      const dialog=document.getElementById('f2w-users-auth-dialog-v73');
      try{if(dialog?.open)dialog.close();}catch{}
    }
  }

  function friendly(error){
    const raw=String(error?.message||error||'').trim();
    if(/invalid login credentials|invalid credentials|email or password/i.test(raw))
      return 'Incorrect username/email or password.';
    if(/email not confirmed/i.test(raw))
      return 'Confirm your email address before logging in.';
    if(/already registered|already been registered|user already registered/i.test(raw))
      return 'An account with that email already exists.';
    if(/rate limit|too many requests/i.test(raw))
      return 'Too many attempts. Wait a moment and try again.';
    return raw||'Authentication failed.';
  }

  async function submit(){
    if(busy)return false;
    const c=client();
    if(!c?.auth){
      message('Authentication is still loading. Try again in a moment.',true);
      return false;
    }

    const mode=modalMode();
    const identifier=String(document.getElementById('account-email')?.value||'').trim();
    const password=String(document.getElementById('account-password')?.value||'');
    const username=String(document.getElementById('account-username')?.value||'').trim();
    const confirm=String(document.getElementById('account-confirm')?.value||'');
    const button=document.getElementById('account-submit');

    if(mode==='login' && (!identifier||!password)){
      message('Enter your username/email and password.',true);
      return false;
    }
    if(mode==='signup'){
      if(!/^[A-Za-z0-9]{2,30}$/.test(username)){
        message('Username must be 2–30 letters or numbers.',true);return false;
      }
      if(!identifier.includes('@')){message('Enter a valid email address.',true);return false;}
      if(password.length<6){message('Password must be at least 6 characters.',true);return false;}
      if(password!==confirm){message('Passwords do not match.',true);return false;}
    }

    busy=true;
    if(button){
      button.disabled=true;
      button.dataset.f2wBusy='1';
      button.innerHTML=mode==='signup'
        ? '<i class="fa-solid fa-circle-notch fa-spin"></i> Creating account…'
        : '<i class="fa-solid fa-circle-notch fa-spin"></i> Logging in…';
    }
    message(mode==='signup'?'Creating your account…':'Logging in…');

    try{
      let result;

      if(mode==='login'){
        if(typeof window.f2wLoginIdentifier==='function'){
          result=await window.f2wLoginIdentifier(identifier,password);
        }else{
          result=await c.auth.signInWithPassword({email:identifier,password});
        }
        if(result?.error)throw result.error;
      }else{
        try{await window.__f2wAbuseGuard?.preflight?.();}catch(error){throw error;}
        const {data,error}=await c.auth.signUp({
          email:identifier,
          password,
          options:{data:{username,chat_alias:username}}
        });
        if(error)throw error;
        result={data,error:null};
        if(!data?.session){
          message('Account created. Check your email if confirmation is required.',false,true);
          return false;
        }
      }

      const sessionResult=await c.auth.getSession();
      const session=sessionResult?.data?.session||result?.data?.session||null;
      const user=session?.user||result?.data?.user||null;
      if(!user)throw new Error('The account session could not be restored.');

      try{window.currentUser=user;}catch{}
      try{window.currentUser=user;}catch{}

      message(mode==='signup'?'Account created and signed in.':'Logged in successfully.',false,true);

      window.dispatchEvent(new CustomEvent('f2w:auth-success',{
        detail:{mode,user,session}
      }));
      window.dispatchEvent(new CustomEvent('f2w:auth-session-ready',{
        detail:{user,session}
      }));

      try{await window.f2wRefreshAccountV70?.();}catch{}
      try{window.refreshAccountUI?.();}catch{}

      // Give TVs/slow browsers one paint showing success, then remove all dimming.
      setTimeout(()=>{
        clearAllAuthLocks({closeModal:true});
      },220);

      return false;
    }catch(error){
      console.error('Auth failed:',error);
      message(friendly(error),true);
      return false;
    }finally{
      busy=false;
      if(button){
        button.disabled=false;
        delete button.dataset.f2wBusy;
        button.textContent=modalMode()==='signup'?'Create Account':'Log In';
      }
    }
  }

  // CAPTURE phase wins over every legacy onclick/page-local submit function.
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('#account-submit');
    if(!button)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    submit();
  },true);

  document.addEventListener('keydown',event=>{
    if(event.key!=='Enter'||event.isComposing)return;
    if(!event.target?.closest?.('#account-modal'))return;
    if(event.target?.tagName==='TEXTAREA')return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    submit();
  },true);

  async function recoverSession(){
    const c=client();
    if(!c?.auth)return null;

    try{c.auth.startAutoRefresh?.();}catch{}

    try{
      const {data}=await c.auth.getSession();
      const session=data?.session||null;
      if(session?.user){
        try{window.currentUser=session.user;}catch{}

        // On page boot a valid session must NEVER leave a stale grey auth layer.
        clearAllAuthLocks({closeModal:true});

        document.body?.classList.add('f2w-authenticated');
        window.dispatchEvent(new CustomEvent('f2w:auth-session-ready',{
          detail:{user:session.user,session}
        }));
        try{await window.f2wRefreshAccountV70?.();}catch{}
        try{window.refreshAccountUI?.();}catch{}
      }
      return session;
    }catch(error){
      console.warn('Session recovery failed:',error);
      return null;
    }
  }

  function boot(){
    recoverSession();
    const c=client();
    if(c?.auth?.onAuthStateChange && !window.__f2wAuthStateV93){
      window.__f2wAuthStateV93=true;
      c.auth.onAuthStateChange((event,session)=>{
        if(session?.user){
          try{window.currentUser=session.user;}catch{}
          if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED'||event==='INITIAL_SESSION'){
            clearAllAuthLocks({closeModal:event!=='SIGNED_IN'});
          }
        }
      });
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.addEventListener('pageshow',recoverSession,{passive:true});
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')recoverSession();
  },{passive:true});
  window.addEventListener('focus',recoverSession,{passive:true});

  window.f2wSubmitAuthV93=submit;
  window.f2wClearAuthLocksV93=clearAllAuthLocks;
})();
// f2w-force-save:auth-authority-v93:1788229371
// f2w-force-save:dedicated-genres-v94:1788280907

/* ============================================================
   F2W v98 — SITE-WIDE AUTH OPENER FOR GUEST DM LOCK
   ============================================================ */
window.f2wOpenGuestDmAuthV98=function(mode){
  const normalized=mode==='signup'?'signup':'login';
  if(typeof window.openHeaderAuth==='function')return window.openHeaderAuth(normalized);
  if(typeof window.f2wOpenAuth==='function')return window.f2wOpenAuth(normalized);
  return false;
};
// f2w-force-save:guest-dm-auth-opener-v98:1788282202
// f2w-force-save:dedicated-user-search-route-v104:1788289281
// f2w-force-save:user-search-route-v106:1788289648
// f2w-force-save:movie-search-sitewide-v107:1788289786
// f2w-force-save:movie-search-route-v111:1788290601

/* ============================================================
   F2W v112 — USER AUTOCOMPLETE ROLE COLOR / WHITE PARTICLES
   ============================================================ */
(() => {
  'use strict';
  if(window.__f2wAutocompleteRoleV112)return;
  window.__f2wAutocompleteRoleV112=true;

  const OWNER_ID='f5454804-a2a6-4602-9086-51cf51f11c77';
  const ROLE_ORDER=['owner','staff','moderator','support','developer','verified','contributor','curator'];
  const ROLE_COLORS={
    owner:'#ff2638',
    staff:'#c05cff',
    moderator:'#62b4ff',
    support:'#32c8ff',
    developer:'#31d9ad',
    verified:'#579dff',
    contributor:'#ffc13d',
    curator:'#ff6be1'
  };

  const cache=new Map();

  function client(){
    try{if(window.chatSupabase?.rpc)return window.chatSupabase;}catch{}
    try{if(window.f2wSupabase?.rpc)return window.f2wSupabase;}catch{}
    try{if(window.supabaseClient?.rpc)return window.supabaseClient;}catch{}
    return null;
  }

  function validRole(value){
    value=String(value||'').toLowerCase();
    return ROLE_ORDER.includes(value)?value:'';
  }

  function paint(nameEl,role){
    role=validRole(role);
    if(!nameEl||!role)return;

    ROLE_ORDER.forEach(r=>nameEl.classList.remove(`f2w-role-${r}`));
    nameEl.classList.remove('f2w-no-role-name');
    nameEl.classList.add('f2w-role-name',`f2w-role-${role}`);
    nameEl.dataset.f2wRole=role;
    nameEl.dataset.f2wRoleDecorated='1';
    const color=ROLE_COLORS[role];
    nameEl.style.setProperty('--f2w-role-color',color);
    nameEl.style.setProperty('color',color,'important');
    nameEl.style.setProperty('-webkit-text-fill-color',color,'important');
  }

  async function resolveRole(username){
    const key=String(username||'').trim().toLowerCase();
    if(!key)return '';
    if(cache.has(key))return cache.get(key);

    if(key==='josh'){
      cache.set(key,'owner');
      return 'owner';
    }

    const c=client();
    if(!c)return '';

    try{
      const {data,error}=await c.rpc('get_public_name_effects',{p_usernames:[username]});
      if(!error && Array.isArray(data)){
        const row=data.find(item=>String(item?.username||'').toLowerCase()===key)||data[0];
        const role=validRole(row?.top_role||row?.role_key||row?.role);
        if(role){
          cache.set(key,role);
          return role;
        }
      }
    }catch{}

    try{
      const {data,error}=await c.rpc('get_public_profile_role',{p_username:username});
      if(!error){
        const row=Array.isArray(data)?data[0]:data;
        const role=validRole(row?.top_role||row?.role_key||row?.role||row);
        if(role){
          cache.set(key,role);
          return role;
        }
      }
    }catch{}

    cache.set(key,'');
    return '';
  }

  async function decorateAutocomplete(root=document){
    const rows=[...root.querySelectorAll?.('.user-search-result')||[]];
    await Promise.all(rows.map(async row=>{
      const username=String(row.dataset.username||'').trim();
      const name=row.querySelector('.user-search-name');
      if(!username||!name)return;

      const cached=cache.get(username.toLowerCase());
      if(cached){
        paint(name,cached);
        return;
      }

      const role=await resolveRole(username);
      if(role)paint(name,role);
    }));
  }

  window.f2wDecorateAutocompleteRolesV112=decorateAutocomplete;

  const observer=new MutationObserver(mutations=>{
    for(const m of mutations){
      for(const node of m.addedNodes){
        if(!(node instanceof Element))continue;
        if(node.matches?.('.user-search-result') || node.querySelector?.('.user-search-result')){
          decorateAutocomplete(node.parentElement||document);
        }
      }
    }
  });

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{
      observer.observe(document.documentElement,{childList:true,subtree:true});
    },{once:true});
  }else{
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }
})();
// f2w-force-save:autocomplete-role-v112:1788290771
// f2w-force-save:operational-staff-nav-v116:1788295578
 