(()=>{
'use strict';if(window.__f2wV171Sitewide)return;window.__f2wV171Sitewide=true;
// Notifications now have one canonical page. Prevent legacy popover controllers from fighting over rows.
document.addEventListener('click',e=>{const b=e.target.closest?.('#notification-btn,[data-notifications-button]');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();location.href='/notifications/';},true);
window.toggleNotifications=e=>{e?.preventDefault?.();location.href='/notifications/'};
// /chat close: always leave chat immediately instead of relying on fragile legacy modal state.
document.addEventListener('click',e=>{const x=e.target.closest?.('#chat-modal .chat-close,[data-chat-close],.f2w-chat-page-close');if(!x)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();if(window.self!==window.top){try{parent.postMessage({type:'F2W_CHAT_CLOSE'},location.origin)}catch{}return}location.href='/home/';},true);
})();

(()=>{
'use strict';
if(window.__f2wV172DisplayNameGuard)return;
window.__f2wV172DisplayNameGuard=true;
const clean=v=>String(v??'').replace(/@/g,'');
const isDisplayNameInput=el=>{
  if(!el||!('value' in el))return false;
  const key=[el.id,el.name,el.className,el.getAttribute?.('data-field'),el.getAttribute?.('aria-label')].filter(Boolean).join(' ').toLowerCase();
  return key.includes('display-name')||key.includes('display_name')||key.includes('display name');
};
const scrubInput=el=>{
  if(!isDisplayNameInput(el)||!String(el.value||'').includes('@'))return;
  const start=el.selectionStart;
  const before=String(el.value||'');
  const removedBefore=before.slice(0,start??before.length).split('@').length-1;
  el.value=clean(before).slice(0,50);
  try{const p=Math.max(0,(start??el.value.length)-removedBefore);el.setSelectionRange(p,p)}catch{}
};
document.addEventListener('input',e=>scrubInput(e.target),true);
document.addEventListener('paste',e=>setTimeout(()=>scrubInput(e.target),0),true);
document.addEventListener('focusin',e=>scrubInput(e.target),true);
window.f2wCleanDisplayName=clean;
})();
