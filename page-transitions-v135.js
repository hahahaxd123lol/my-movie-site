/* Flix2Watch v135 — fast, site-wide navigation fade */
(()=>{
  'use strict';
  const root=document.documentElement;
  let leaving=false;
  const ready=()=>{
    leaving=false;
    root.classList.remove('f2w-transition-boot','f2w-transition-leaving');
    root.classList.add('f2w-transition-ready');
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',ready,{once:true});
  else requestAnimationFrame(ready);
  addEventListener('pageshow',ready,{passive:true});

  const isPlainLeftClick=e=>e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey;
  const navigableAnchor=a=>{
    if(!a||!a.href||a.hasAttribute('download'))return null;
    if(a.target&&a.target.toLowerCase()!=='_self')return null;
    const raw=(a.getAttribute('href')||'').trim();
    if(!raw||raw.startsWith('#')||raw.startsWith('javascript:')||raw.startsWith('mailto:')||raw.startsWith('tel:'))return null;
    try{
      const u=new URL(a.href,location.href);
      if(u.origin!==location.origin)return null;
      if(u.pathname===location.pathname&&u.search===location.search&&u.hash)return null;
      return u;
    }catch{return null}
  };

  // Only hold a normal same-origin link for a tiny exit fade. Buttons/controls keep
  // their existing behaviour; their destination still gets the entrance fade.
  document.addEventListener('click',e=>{
    if(e.defaultPrevented||leaving||!isPlainLeftClick(e))return;
    const a=e.target.closest?.('a[href]');
    const u=navigableAnchor(a);
    if(!u)return;
    e.preventDefault();
    leaving=true;
    root.classList.remove('f2w-transition-ready');
    root.classList.add('f2w-transition-leaving');
    setTimeout(()=>location.assign(u.href),145);
  },true);

  // Give regular form navigations the same visual hand-off without changing submit logic.
  document.addEventListener('submit',e=>{
    if(e.defaultPrevented||leaving)return;
    const form=e.target;
    if(!(form instanceof HTMLFormElement))return;
    const target=(form.target||'_self').toLowerCase();
    if(target!=='_self')return;
    leaving=true;
    root.classList.remove('f2w-transition-ready');
    root.classList.add('f2w-transition-leaving');
  },true);
})();
// f2w-force-save:v183-page-transition-runtime:20260902
