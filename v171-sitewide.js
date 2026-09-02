(()=>{
'use strict';if(window.__f2wV171Sitewide)return;window.__f2wV171Sitewide=true;
// Notifications now have one canonical page. Prevent legacy popover controllers from fighting over rows.
document.addEventListener('click',e=>{const b=e.target.closest?.('#notification-btn,[data-notifications-button]');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();location.href='/notifications/';},true);
window.toggleNotifications=e=>{e?.preventDefault?.();location.href='/notifications/'};
// /chat close: always leave chat immediately instead of relying on fragile legacy modal state.
document.addEventListener('click',e=>{const x=e.target.closest?.('#chat-modal .chat-close,[data-chat-close],.f2w-chat-page-close');if(!x)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(window.self!==window.top){try{parent.postMessage({type:'F2W_CHAT_CLOSE'},location.origin)}catch{}return}location.href='/home/';},true);
})();