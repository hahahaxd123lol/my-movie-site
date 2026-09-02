(()=>{
'use strict';
if(window.__f2wV176Sitewide)return;window.__f2wV176Sitewide=true;

const now=()=>Date.now();
const RATE_WINDOW=30000, RATE_MAX=2;
const NAV_WORDS=/^(home|movies|tv shows|leaderboard|genres|chat|favorites|profile|support|account|notifications|login|log in|sign up|create account)$/i;
const EXCLUDE=/^(close|cancel|back|next|previous|prev|refresh|retry|understood|support)$/i;
const ACTION_HINT=/(send|post|save|update|delete|remove|dismiss|resolve|ban|mute|suspend|unsuspend|unban|follow|unfollow|report|submit|apply|grant|give|revoke|mark all read|create|login|log in|sign up|change|clear all restrictions)/i;
function normText(el){return String(el?.getAttribute?.('aria-label')||el?.title||el?.textContent||'').replace(/\s+/g,' ').trim()}
function actionKey(el){
  const txt=normText(el).toLowerCase().slice(0,90);
  const id=String(el?.id||'').toLowerCase();
  const form=el?.closest?.('form')?.id||'';
  return `f2w:v176:rate:${location.pathname}:${id||form||txt||el?.name||'action'}`;
}
function isNetworkAction(el){
  if(!el)return false;
  if(el.matches?.('a[href]')&&!el.matches?.('[role="button"]'))return false;
  const txt=normText(el);
  if(EXCLUDE.test(txt)||NAV_WORDS.test(txt))return false;
  if(el.matches?.('[data-f2w-no-rate],.chat-close,.account-close,.f2w-chat-page-close,[data-close],[aria-label*="close" i],[role="tab"],.account-tab,.v17-chat-mode'))return false;
  if(el.matches?.('button[type="submit"],input[type="submit"],[data-action],[data-command],[data-staff-action]'))return true;
  return ACTION_HINT.test(txt);
}
function readTimes(k){try{return JSON.parse(localStorage.getItem(k)||'[]').filter(t=>now()-Number(t)<RATE_WINDOW)}catch{return[]}}
function allowAction(el){
  const k=actionKey(el), arr=readTimes(k);
  if(arr.length>=RATE_MAX){
    const wait=Math.max(1,Math.ceil((RATE_WINDOW-(now()-arr[0]))/1000));
    try{window.showToast?.(`Please wait ${wait}s before trying that again.`,true)}catch{}
    el?.setAttribute?.('data-f2w-rate-wait',String(wait));
    return false;
  }
  arr.push(now());try{localStorage.setItem(k,JSON.stringify(arr))}catch{}
  return true;
}

// Notifications are a real page now. Never open the legacy dropdown.
document.addEventListener('click',e=>{
  const n=e.target.closest?.('#notification-btn,[data-notifications-link],a[href="/notifications/"]');
  if(n && !location.pathname.startsWith('/notifications')){
    e.preventDefault();e.stopImmediatePropagation();location.href='/notifications/';return;
  }
  if(location.pathname.startsWith('/chat')){
    const c=e.target.closest?.('.f2w-chat-page-close,#chat-modal .chat-close,.v17-chat-hub .chat-close');
    if(c){e.preventDefault();e.stopImmediatePropagation();location.href='/home/';return;}
  }
  const a=e.target.closest?.('button,input[type="submit"],[role="button"]');
  if(isNetworkAction(a) && !allowAction(a)){e.preventDefault();e.stopImmediatePropagation();}
},true);

document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.isComposing)return;
  if(e.repeat){e.preventDefault();e.stopImmediatePropagation();return;}
  const form=e.target?.closest?.('form');
  const btn=form?.querySelector?.('button[type="submit"],input[type="submit"]');
  if(btn&&isNetworkAction(btn)&&!allowAction(btn)){e.preventDefault();e.stopImmediatePropagation();}
},true);

function sanitizeProfileHero(){
  if(!location.pathname.startsWith('/profile/'))return;
  const name=document.getElementById('profile-name');
  if(name){
    const clean=String(name.textContent||'').replace(/@+/g,'').trim();
    if(clean&&clean!==name.textContent)name.textContent=clean;
  }
  const input=document.getElementById('profile-display-name-input');
  if(input&&!input.dataset.f2wNoAt176){
    input.dataset.f2wNoAt176='1';
    const clean=()=>{const v=String(input.value||'').replace(/@+/g,'');if(v!==input.value)input.value=v};
    input.addEventListener('input',clean,true);input.addEventListener('paste',()=>setTimeout(clean,0),true);clean();
  }
}

function wireNotifications(){
  document.querySelectorAll('#notification-btn').forEach(btn=>{
    btn.removeAttribute('onclick');btn.setAttribute('title','Notifications');btn.setAttribute('aria-label','Notifications');
  });
}

function boot(){
  wireNotifications();sanitizeProfileHero();
  const mo=new MutationObserver(()=>{wireNotifications();sanitizeProfileHero()});
  mo.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
