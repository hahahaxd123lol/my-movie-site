(() => {
  'use strict';
  const isChatPage=location.pathname.replace(/\/+$/,'')==='/chat';
  if(isChatPage) return;
  const goToChat=()=>{ window.location.assign('/chat/'); };
  window.openChat=goToChat;
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('.chat-button');
    if(!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    goToChat();
  },true);
})();
 