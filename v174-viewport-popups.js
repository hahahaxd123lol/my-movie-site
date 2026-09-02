(()=>{
'use strict';
if(window.__f2wViewportPopupsV174)return;
window.__f2wViewportPopupsV174=true;

const PORTAL_ID='f2w-viewport-modal-portal';
const OPEN_CLASS='f2w-viewport-popup';
const EXCLUDE=/notification|announcement|toast|tooltip|dropdown|menu|autocomplete|suggest/i;
const INCLUDE=/modal|overlay|dialog|lightbox|viewer|sheet|popup|followers|following|social-modal|enforcement|suspend|ban|ticket|account-action/i;

function portal(){
  let p=document.getElementById(PORTAL_ID);
  if(!p){
    p=document.createElement('div');
    p.id=PORTAL_ID;
    p.setAttribute('popover','manual');
    p.setAttribute('aria-hidden','false');
    document.body.appendChild(p);
  }
  // A popover is promoted to the browser top-layer. That makes it viewport-relative
  // even if the site shell/body has transforms, filters or page-transition wrappers.
  try{if(!p.matches(':popover-open'))p.showPopover()}catch{}
  return p;
}
function sig(el){return [el.id,typeof el.className==='string'?el.className:'',el.getAttribute?.('role'),el.getAttribute?.('aria-modal')].filter(Boolean).join(' ')}
function candidate(el){
  if(!(el instanceof HTMLElement))return false;
  // Account auth and the Watch login gate are interactive app UI, not generic
  // viewport popups. Promoting either into the top-layer portal fights the site's
  // auth controller, traps focus/pointer events and can lock document scrolling.
  if(el.id==='account-modal'||el.closest?.('#account-modal'))return false;
  // Normal Chat and Account UI are interactive app shells, not enforcement/top-layer dialogs.
  // Moving Chat into the generic popover portal can strand its backdrop above Account and trap input.
  if(el.id==='chat-modal'||el.closest?.('#chat-modal'))return false;
  // Support owns its ticket modal. Never portal/promote it: doing so breaks its X/backdrop close handlers.
  if(el.id==='support-ticket-modal'||el.closest?.('#support-ticket-modal'))return false;
  if(el.id==='watch-login-overlay'||el.closest?.('#watch-login-overlay'))return false;
  if(el.id===PORTAL_ID||el.closest?.('#'+PORTAL_ID))return false;
  if(el.tagName==='DIALOG')return true;
  const s=sig(el); if(EXCLUDE.test(s))return false;
  return el.getAttribute('aria-modal')==='true'||['dialog','alertdialog'].includes(el.getAttribute('role'))||INCLUDE.test(s);
}
function visible(el){
  if(el.hidden)return false;
  if(el.tagName==='DIALOG')return el.open||el.classList.contains('show')||el.classList.contains('open')||el.classList.contains('active');
  const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden'||Number(cs.opacity)===0)return false;
  if(el.classList.contains('open')||el.classList.contains('show')||el.classList.contains('active')||el.getAttribute('aria-hidden')==='false')return true;
  const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(cs.position==='fixed'||cs.position==='absolute'||parseFloat(cs.zIndex)>100);
}
function lock(on){document.documentElement.classList.toggle('f2w-popup-scroll-lock',!!on);document.body?.classList.toggle('f2w-popup-scroll-lock',!!on)}
function promote(el){
  if(!candidate(el)||!visible(el))return false;
  if(el.tagName==='DIALOG'){
    el.classList.add('f2w-viewport-dialog');
    // Force a fresh top-layer placement. Existing open non-modal dialogs can otherwise
    // remain document-positioned on some browsers.
    try{
      if(el.open && !el.matches(':modal')) el.close();
      if(!el.open) el.showModal();
    }catch{}
    lock(true); return true;
  }
  const p=portal();
  if(el.parentElement!==p){try{p.appendChild(el)}catch{return false}}
  el.classList.add(OPEN_CLASS);
  lock(true);return true;
}
function scan(root=document){
  let any=false;const list=[];
  if(root instanceof HTMLElement&&candidate(root))list.push(root);
  root.querySelectorAll?.('dialog,[aria-modal="true"],[role="dialog"],[role="alertdialog"],[class*="modal"],[class*="overlay"],[id*="modal"],[id*="overlay"],[class*="lightbox"],[class*="popup"],[id*="enforcement"],[class*="social-modal"],[class*="ticket"]').forEach(x=>list.push(x));
  list.forEach(x=>{if(promote(x))any=true});
  const p=document.getElementById(PORTAL_ID); if(p&&[...p.children].some(visible))any=true;
  if(!any)lock(false);
}
function schedule(root=document){requestAnimationFrame(()=>scan(root))}

document.addEventListener('click',()=>schedule(document),true);
document.addEventListener('keydown',()=>schedule(document),true);
window.addEventListener('f2w:modal-open',()=>schedule(document));
window.addEventListener('scroll',()=>{ // keep top-layer portal alive; native dialogs need no coordinates
  const p=document.getElementById(PORTAL_ID);if(p)try{if(!p.matches(':popover-open'))p.showPopover()}catch{}
},{passive:true,capture:true});

const mo=new MutationObserver(ms=>{for(const m of ms){if(m.type==='attributes'&&candidate(m.target)){schedule(m.target);return}for(const n of m.addedNodes||[])if(n.nodeType===1){schedule(n);return}}});
function start(){
  portal();
  // Recover from an older cached viewport-popup build that may already have moved
  // the auth modal before this script loaded. Auth must stay directly under body.
  const account=document.getElementById('account-modal');
  if(account?.closest?.('#'+PORTAL_ID)){try{document.body.appendChild(account)}catch{}}
  account?.classList.remove(OPEN_CLASS);
  mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open','style','aria-hidden']});
  scan(document);
  ['openSocialList','showFollowers','showFollowing'].forEach(name=>{
    const old=window[name];if(typeof old!=='function'||old.__f2w174)return;
    const wrap=function(...args){const out=old.apply(this,args);schedule(document);return out};wrap.__f2w174=true;window[name]=wrap;
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.__f2wPromoteViewportPopups=()=>scan(document);
})();

// f2w-force-save:v182-auth-portal-exclusion:20260902

// f2w-force-save:v190-exclude-chat-auth-shells:20260902

// f2w-force-save:v192-support-ticket-popup-exclusion:20260902
