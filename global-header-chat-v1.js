(()=>{
  'use strict';

  const isChatPage=location.pathname.replace(/\/+$/,'')==='/chat';
  if(isChatPage)return;

  let frame=null;
  let shell=null;
  let previousOverflow='';
  let previousHtmlOverflow='';
  let open=false;
  let ready=false;

  function ensureShell(){
    if(shell)return shell;

    const style=document.createElement('style');
    style.id='f2w-global-chat-shell-style';
    style.textContent=`
      #f2w-global-chat-shell{
        position:fixed;inset:0;z-index:2147483000;
        display:flex;align-items:center;justify-content:center;
        background:rgba(0,0,0,.78);backdrop-filter:blur(9px);
        padding:18px;box-sizing:border-box;
        opacity:0;visibility:hidden;pointer-events:none;
        transition:opacity .12s ease,visibility 0s linear .12s;
        contain:layout paint style;
      }
      #f2w-global-chat-shell.open{
        opacity:1;visibility:visible;pointer-events:auto;
        transition:opacity .12s ease;
      }
      #f2w-global-chat-frame{
        width:min(1180px,96vw);height:min(780px,94vh);border:0;border-radius:14px;
        background:#09090e;box-shadow:0 28px 90px rgba(0,0,0,.72);
        opacity:1;
      }
      .f2w-global-chat-loading{
        position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:10px;
        color:#fff;font:600 14px/1.2 Inter,system-ui,sans-serif;pointer-events:none;
        background:#09090e;border-radius:14px;
      }
      #f2w-global-chat-shell.ready .f2w-global-chat-loading{display:none}
      @media(max-width:760px){
        #f2w-global-chat-shell{padding:0}
        #f2w-global-chat-frame{width:100vw;height:100vh;border-radius:0}
        .f2w-global-chat-loading{border-radius:0}
      }
    `;
    document.head.appendChild(style);

    shell=document.createElement('div');
    shell.id='f2w-global-chat-shell';
    shell.setAttribute('aria-hidden','true');
    shell.innerHTML='<div class="f2w-global-chat-loading"><i class="fa-solid fa-comments"></i><span>Loading chat…</span></div>';

    frame=document.createElement('iframe');
    frame.id='f2w-global-chat-frame';
    frame.src='/chat/?f2w_chat_embed=1&preload=1';
    frame.title='Flix2Watch Chat';
    frame.setAttribute('allow','clipboard-write');
    frame.setAttribute('loading','eager');
    frame.setAttribute('fetchpriority','high');
    frame.addEventListener('load',()=>{
      // The chat page will send F2W_CHAT_READY after its public + DM boot has run.
      // Keep the frame alive and fully laid out even while the overlay is invisible.
      setTimeout(()=>{
        if(!ready){ ready=true; shell?.classList.add('ready'); }
      },2500);
    });

    shell.appendChild(frame);
    document.body.appendChild(shell);

    shell.addEventListener('click',event=>{
      if(event.target===shell)closeChatOverlay();
    });
    return shell;
  }

  function openChatOverlay(){
    ensureShell();
    if(open)return;
    open=true;
    previousOverflow=document.body.style.overflow;
    previousHtmlOverflow=document.documentElement.style.overflow;
    shell.classList.add('open');
    shell.setAttribute('aria-hidden','false');
    document.documentElement.style.overflow='hidden';
    document.body.style.overflow='hidden';
    // Intentionally DO NOT push /chat/ into history here. The current page remains
    // exactly where it is, so headers/layout/auth scripts do not react as if a new
    // page was opened. /chat/ still works as a standalone URL when entered directly.
  }

  function closeChatOverlay(){
    if(!shell||!open)return;
    open=false;
    shell.classList.remove('open');
    shell.setAttribute('aria-hidden','true');
    document.documentElement.style.overflow=previousHtmlOverflow;
    document.body.style.overflow=previousOverflow;
  }

  window.openChat=openChatOverlay;
  window.closeGlobalChat=closeChatOverlay;

  // Eager background boot. The iframe is NOT display:none and is not detached,
  // which avoids browsers postponing layout/network work until the user clicks Chat.
  const preload=()=>ensureShell();
  if(document.body) preload();
  else document.addEventListener('DOMContentLoaded',preload,{once:true});

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('.chat-button');
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openChatOverlay();
  },true);

  window.addEventListener('message',event=>{
    if(event.origin!==location.origin)return;
    if(event.data?.type==='F2W_CHAT_CLOSE') closeChatOverlay();
    if(event.data?.type==='F2W_CHAT_READY'){
      ready=true;
      shell?.classList.add('ready');
    }
  });
})();
/* f2w-update-20260831-chat-eager-offscreen-v5 */
/* f2w-force-trailing-space-v5 */ 