(() => {
  'use strict';
  const params=new URLSearchParams(location.search);
  const EMBED=params.get('f2w_chat_embed')==='1';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  async function waitFor(test, timeout=15000){
    const start=Date.now();
    while(Date.now()-start<timeout){
      try{ const v=test(); if(v) return v; }catch{}
      await sleep(80);
    }
    return null;
  }

  async function prepareEmbeddedChat(){
    const modal=await waitFor(()=>document.getElementById('chat-modal'));
    const nativeOpen=await waitFor(()=>typeof window.openChat==='function' && window.openChat);
    if(!modal || !nativeOpen) return;
    try{ await nativeOpen(); }catch{ try{ nativeOpen(); }catch{} }
    const style=document.createElement('style');
    style.id='f2w-chat-embed-style';
    style.textContent=`
      html,body{margin:0!important;width:100%!important;height:100%!important;min-height:100%!important;background:#050a12!important;overflow:hidden!important}
      body>*:not(#chat-modal){display:none!important}
      #chat-modal{display:flex!important;position:fixed!important;inset:0!important;width:100%!important;height:100%!important;z-index:1!important;background:#050a12!important;padding:0!important;align-items:stretch!important;justify-content:stretch!important}
      #chat-modal .chat-card{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;border-radius:0!important;border:0!important}
      #chat-modal .chat-close{display:none!important}
    `;
    document.head.appendChild(style);
    modal.classList.add('open');
    try{
      const oldClose=window.closeChat;
      window.closeChat=()=>{ parent.postMessage({type:'f2w:chat-close'},location.origin); try{oldClose?.()}catch{} };
    }catch{}
    parent.postMessage({type:'f2w:chat-ready'},location.origin);
  }

  if(EMBED){
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',prepareEmbeddedChat,{once:true});
    else prepareEmbeddedChat();
    return;
  }

  let overlay, panel, frame, ready=false;
  function build(){
    if(document.getElementById('f2w-global-chat-overlay')) return;
    overlay=document.createElement('div');
    overlay.id='f2w-global-chat-overlay';
    overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML=`<div id="f2w-global-chat-panel" role="dialog" aria-modal="true" aria-label="Flix2Watch chat"><div id="f2w-global-chat-loading"><span><i class="fa-solid fa-comments"></i>&nbsp; Loading chat…</span></div><button id="f2w-global-chat-close" type="button" aria-label="Close chat"><i class="fa-solid fa-xmark"></i></button><iframe id="f2w-global-chat-frame" title="Flix2Watch chat" src="/home/?f2w_chat_embed=1" loading="eager"></iframe></div>`;
    document.body.appendChild(overlay);
    panel=overlay.querySelector('#f2w-global-chat-panel');
    frame=overlay.querySelector('#f2w-global-chat-frame');
    overlay.querySelector('#f2w-global-chat-close').addEventListener('click',closeGlobalChat);
    overlay.addEventListener('mousedown',e=>{if(e.target===overlay) closeGlobalChat();});
    window.addEventListener('message',e=>{
      if(e.origin!==location.origin) return;
      if(e.data?.type==='f2w:chat-ready'){ready=true;panel.classList.add('ready');}
      if(e.data?.type==='f2w:chat-close') closeGlobalChat();
    });
  }

  function openGlobalChat(){
    build();
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden','false');
    document.body.classList.add('f2w-global-chat-open');
    if(ready){ try{frame.contentWindow?.focus()}catch{} }
  }
  function closeGlobalChat(){
    if(!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden','true');
    document.body.classList.remove('f2w-global-chat-open');
  }
  window.openChat=openGlobalChat;
  window.closeGlobalChat=closeGlobalChat;
  window.addEventListener('keydown',e=>{if(e.key==='Escape' && overlay?.classList.contains('open')) closeGlobalChat();});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',build,{once:true}); else build();
})();
