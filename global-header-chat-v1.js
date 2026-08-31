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
 