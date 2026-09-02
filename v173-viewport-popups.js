(()=>{
'use strict';
if(window.__f2wViewportPopupsV173)return;
window.__f2wViewportPopupsV173=true;

const PORTAL_ID='f2w-viewport-modal-portal';
const OPEN_CLASS='f2w-viewport-popup';
const EXCLUDE=/notification|announcement|toast|tooltip|dropdown|menu|popover|autocomplete|suggest/i;
const INCLUDE=/modal|overlay|dialog|lightbox|viewer|sheet|popup|followers|following|social-modal|enforcement|suspend|ban|ticket/i;

function portal(){
  let p=document.getElementById(PORTAL_ID);
  if(p)return p;
  p=document.createElement('div');p.id=PORTAL_ID;p.setAttribute('aria-hidden','true');
  document.documentElement.appendChild(p);
  return p;
}
function signature(el){return [el.id,el.className,el.getAttribute?.('role'),el.getAttribute?.('data-modal'),el.getAttribute?.('aria-modal')].filter(Boolean).join(' ')}
function isCandidate(el){
  if(!(el instanceof HTMLElement))return false;
  if(el.id===PORTAL_ID||el.closest?.('#'+PORTAL_ID))return false;
  if(el.tagName==='DIALOG')return true;
  const s=signature(el);
  if(EXCLUDE.test(s))return false;
  if(el.getAttribute('aria-modal')==='true'||el.getAttribute('role')==='dialog'||el.getAttribute('role')==='alertdialog')return true;
  return INCLUDE.test(s);
}
function isVisible(el){
  if(el.hidden)return false;
  if(el.tagName==='DIALOG')return el.open||el.classList.contains('show')||el.classList.contains('open');
  const cs=getComputedStyle(el);
  if(cs.display==='none'||cs.visibility==='hidden'||Number(cs.opacity)===0)return false;
  if(el.classList.contains('open')||el.classList.contains('show')||el.classList.contains('active')||el.getAttribute('aria-hidden')==='false')return true;
  const r=el.getBoundingClientRect();
  return r.width>0&&r.height>0&&(cs.position==='fixed'||cs.position==='absolute')&&(/rgba?\(/.test(cs.backgroundColor)||parseFloat(cs.zIndex)>100);
}
function lock(){document.documentElement.classList.add('f2w-popup-scroll-lock')}
function unlockIfNone(){
  const p=document.getElementById(PORTAL_ID);if(!p)return document.documentElement.classList.remove('f2w-popup-scroll-lock');
  const any=[...p.children].some(el=>isVisible(el));
  if(!any)document.documentElement.classList.remove('f2w-popup-scroll-lock');
}
function promote(el){
  if(!isCandidate(el)||!isVisible(el))return;
  if(el.tagName==='DIALOG'){
    el.classList.add('f2w-viewport-dialog');
    // showModal() guarantees the browser top-layer instead of a transformed document containing block.
    if(!el.open){try{el.showModal()}catch{}}
    lock();return;
  }
  const p=portal();
  if(el.parentElement!==p){
    try{p.appendChild(el)}catch{return}
  }
  el.classList.add(OPEN_CLASS);
  lock();
}
function scan(root=document){
  const els=[];
  if(root instanceof HTMLElement&&isCandidate(root))els.push(root);
  root.querySelectorAll?.('dialog,[aria-modal="true"],[role="dialog"],[role="alertdialog"],[class*="modal"],[class*="overlay"],[id*="modal"],[id*="overlay"],[class*="lightbox"],[class*="popup"],[id*="enforcement"],[class*="social-modal"]').forEach(el=>els.push(el));
  els.forEach(promote);
  unlockIfNone();
}

// Capture clicks so newly-opened legacy popups are promoted on the same frame.
document.addEventListener('click',()=>{requestAnimationFrame(()=>scan(document))},true);
document.addEventListener('keydown',()=>{requestAnimationFrame(()=>scan(document))},true);
window.addEventListener('f2w:modal-open',()=>scan(document));

const mo=new MutationObserver(muts=>{
  let needed=false;
  for(const m of muts){
    if(m.type==='attributes'){if(isCandidate(m.target)){needed=true;break}}
    for(const n of m.addedNodes||[]){if(n.nodeType===1){needed=true;break}}
    if(needed)break;
  }
  if(needed)requestAnimationFrame(()=>scan(document));else unlockIfNone();
});
function start(){
  mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open','style','aria-hidden']});
  scan(document);
  // Profiles specifically: make Followers/Following open directly in the viewport portal.
  ['openSocialList','showFollowers','showFollowing'].forEach(name=>{
    const old=window[name];if(typeof old!=='function'||old.__f2w173)return;
    const wrap=function(...args){const out=old.apply(this,args);requestAnimationFrame(()=>scan(document));return out};wrap.__f2w173=true;window[name]=wrap;
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();

window.__f2wPromoteViewportPopups=()=>scan(document);
})();
