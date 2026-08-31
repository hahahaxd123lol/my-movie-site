(()=>{
  'use strict';

  // Shared chat shell. Preload silently; never auto-open.
  let overlay=null, panel=null, frame=null, ready=false, userOpened=false;
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

  function build(){
    if(overlay) return;
    ensureStyles();
    overlay=document.createElement('div');
    overlay.id='f2w-global-chat-overlay';
    overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML=`<div id="f2w-global-chat-panel" role="dialog" aria-modal="true" aria-label="Flix2Watch chat"><div id="f2w-global-chat-loading"><span>Loading chat…</span></div><button id="f2w-global-chat-close" type="button" aria-label="Close chat">×</button><iframe id="f2w-global-chat-frame" title="Flix2Watch chat" src="${CHAT_URL}" loading="eager" fetchpriority="high"></iframe></div>`;
    document.body.appendChild(overlay);
    panel=overlay.querySelector('#f2w-global-chat-panel');
    frame=overlay.querySelector('#f2w-global-chat-frame');

    overlay.querySelector('#f2w-global-chat-close').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();closeGlobalChat();});
    overlay.addEventListener('pointerdown',e=>{if(e.target===overlay) closeGlobalChat();});

    window.addEventListener('message',e=>{
      if(e.origin!==location.origin) return;
      const t=e.data?.type;
      if(t==='F2W_CHAT_READY'||t==='f2w:chat-ready'){
        ready=true;
        panel?.classList.add('ready');
      }
      if((t==='F2W_CHAT_CLOSE'||t==='f2w:chat-close')&&userOpened) closeGlobalChat();
    });
  }

  function openGlobalChat(){
    build();
    userOpened=true;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden','false');
    if(ready){try{frame.contentWindow?.focus();}catch{}}
  }

  function closeGlobalChat(){
    if(!overlay) return;
    userOpened=false;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden','true');
    // Deliberately do not touch location/history/body overflow.
  }

  function hijackChatTriggers(root=document){
    root.querySelectorAll('.chat-button,[data-open-chat],a[href="/chat/"],a[href="/chat"]').forEach(el=>{
      if(el.dataset.f2wChatBound==='1') return;
      el.dataset.f2wChatBound='1';
      el.addEventListener('click',e=>{
        e.preventDefault();
        e.stopImmediatePropagation();
        openGlobalChat();
      },true);
    });
  }

  function boot(){
    build(); // creates a live hidden iframe immediately so Public + DMs can warm in background
    hijackChatTriggers();
    // Keep newly-rendered headers/buttons wired without navigating to /chat/.
    const mo=new MutationObserver(()=>hijackChatTriggers());
    mo.observe(document.documentElement,{subtree:true,childList:true});

    // Explicitly keep the overlay shut until a real user click.
    closeGlobalChat();
    setTimeout(()=>{if(!userOpened) closeGlobalChat();},250);
    setTimeout(()=>{if(!userOpened) closeGlobalChat();},1000);
  }

  window.openChat=openGlobalChat;
  window.closeChat=closeGlobalChat;
  window.openGlobalChat=openGlobalChat;
  window.closeGlobalChat=closeGlobalChat;
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&userOpened) closeGlobalChat();});

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
// f2w-update-marker: global-chat-v7-silent-preload-20260831
// f2w-force-save: 20260831-2110
 