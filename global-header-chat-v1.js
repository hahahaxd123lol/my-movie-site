(()=>{
  'use strict';

  const isChatPage=location.pathname.replace(/\/+$/,'')==='/chat';
  if(isChatPage)return;

  let frame=null;
  let shell=null;
  let previousUrl='';
  let open=false;

  function ensureShell(){
    if(shell)return shell;

    shell=document.createElement('div');
    shell.id='f2w-global-chat-shell';
    shell.setAttribute('aria-hidden','true');
    shell.innerHTML='<div class="f2w-global-chat-loading"><i class="fa-solid fa-comments"></i><span>Loading chat…</span></div>';

    const style=document.createElement('style');
    style.id='f2w-global-chat-shell-style';
    style.textContent=`
      #f2w-global-chat-shell{position:fixed;inset:0;z-index:2147483000;display:none;background:rgba(0,0,0,.78);backdrop-filter:blur(9px);padding:18px;box-sizing:border-box}
      #f2w-global-chat-shell.open{display:flex;align-items:center;justify-content:center}
      #f2w-global-chat-shell iframe{width:min(1180px,96vw);height:min(780px,94vh);border:0;border-radius:14px;background:#09090e;box-shadow:0 28px 90px rgba(0,0,0,.72)}
      .f2w-global-chat-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:10px;color:#fff;font:600 14px/1.2 Inter,system-ui,sans-serif;pointer-events:none}
      #f2w-global-chat-shell.ready .f2w-global-chat-loading{display:none}
      @media(max-width:760px){#f2w-global-chat-shell{padding:0}#f2w-global-chat-shell iframe{width:100vw;height:100vh;border-radius:0}}
    `;
    document.head.appendChild(style);
    document.body.appendChild(shell);

    // Preload the one canonical chat page immediately in the background.
    // Public chat + DMs initialize inside this iframe before the button is used.
    frame=document.createElement('iframe');
    frame.id='f2w-global-chat-frame';
    frame.src='/chat/?f2w_chat_embed=1';
    frame.title='Flix2Watch Chat';
    frame.setAttribute('allow','clipboard-write');
    frame.style.visibility='hidden';
    frame.addEventListener('load',()=>{
      shell.classList.add('ready');
      frame.style.visibility='visible';
    });
    shell.appendChild(frame);

    shell.addEventListener('click',event=>{
      if(event.target===shell)closeChatOverlay();
    });
    return shell;
  }

  function openChatOverlay(){
    ensureShell();
    if(open)return;
    open=true;
    previousUrl=location.href;
    shell.classList.add('open');
    shell.setAttribute('aria-hidden','false');
    document.documentElement.style.overflow='hidden';
    document.body.style.overflow='hidden';
    try{history.pushState({f2wChat:true},'', '/chat/');}catch{}
  }

  function closeChatOverlay(){
    if(!shell||!open)return;
    open=false;
    shell.classList.remove('open');
    shell.setAttribute('aria-hidden','true');
    document.documentElement.style.overflow='';
    document.body.style.overflow='';
    try{
      if(previousUrl)history.replaceState({},'',previousUrl);
    }catch{}
  }

  window.openChat=openChatOverlay;
  window.closeGlobalChat=closeChatOverlay;

  // Start the preload as soon as the page has a body, not when Chat is clicked.
  const preload=()=>ensureShell();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',preload,{once:true});
  else preload();

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('.chat-button');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openChatOverlay();
  },true);

  window.addEventListener('message',event=>{
    if(event.origin!==location.origin)return;
    if(event.data?.type==='F2W_CHAT_CLOSE')closeChatOverlay();
  });

  window.addEventListener('popstate',()=>{
    if(open)closeChatOverlay();
  });
})();
/* f2w-update-20260831-global-chat-preload-dm-v3 */ 
