(()=>{
  'use strict';

  const isChatPage=location.pathname.replace(/\/+$/,'')==='/chat';
  if(isChatPage)return;

  let frame=null;
  let shell=null;
  let open=false;
  let ready=false;
  let lastTrustedChatIntent=0;
  const CHAT_INTENT_WINDOW_MS=1500;

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

  function openChatOverlay(force=false){
    // Only allow the overlay to become visible after an actual user Chat click.
    // This blocks legacy page scripts from calling openChat() during boot and
    // accidentally dragging visitors straight into chat on normal page loads.
    if(!force && Date.now()-lastTrustedChatIntent>CHAT_INTENT_WINDOW_MS) return false;
    ensureShell();
    if(open)return true;
    open=true;
    shell.classList.add('open');
    shell.setAttribute('aria-hidden','false');
    // Deliberately do not change body/html overflow or history. Keeping the host
    // page completely untouched prevents header/content jumps when chat opens.
    return true;
  }

  function closeChatOverlay(){
    if(!shell||!open)return;
    open=false;
    shell.classList.remove('open');
    shell.setAttribute('aria-hidden','true');
  }

  window.openChat=()=>openChatOverlay(false);
  window.closeGlobalChat=closeChatOverlay;

  // Eager background boot. The iframe is NOT display:none and is not detached,
  // which avoids browsers postponing layout/network work until the user clicks Chat.
  const preload=()=>ensureShell();
  if(document.body) preload();
  else document.addEventListener('DOMContentLoaded',preload,{once:true});

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('.chat-button');
    if(!button)return;
    // A trusted click is the ONLY thing that may reveal the preloaded chat shell.
    if(event.isTrusted) lastTrustedChatIntent=Date.now();
    event.preventDefault();
    event.stopImmediatePropagation();
    openChatOverlay(true);
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
/* f2w-update-20260831-silent-preload-no-auto-open-v6 */
 