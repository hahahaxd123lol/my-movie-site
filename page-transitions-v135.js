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

  const prefetched=new Set();
  const isPrefetchable=u=>{
    if(!u||u.origin!==location.origin)return false;
    if(/\.(?:pdf|zip|mp4|webm|png|jpe?g|gif|webp|svg|woff2?|ttf|css|js)$/i.test(u.pathname))return false;
    if(/^\/(?:watch|logout|signout|api|auth)(?:\/|$)/i.test(u.pathname))return false;
    return true;
  };
  function prefetchUrl(u){
    if(!isPrefetchable(u))return;
    const key=u.pathname+u.search;
    if(prefetched.has(key))return;
    prefetched.add(key);
    const link=document.createElement('link');
    link.rel='prefetch';link.as='document';link.href=u.href;
    link.crossOrigin='anonymous';
    link.onerror=()=>prefetched.delete(key);
    (document.head||document.documentElement).appendChild(link);
  }
  const idle=window.requestIdleCallback||((fn)=>setTimeout(fn,700));
  // Warm up only likely navigation destinations, never every link on a large page.
  idle(()=>{
    document.querySelectorAll('header a[href], nav a[href], .bottom-nav a[href]').forEach(a=>{
      try{const u=new URL(a.href,location.href);if(isPrefetchable(u))prefetchUrl(u)}catch{}
    });
  });
  document.addEventListener('pointerover',e=>{
    const a=e.target.closest?.('a[href]');
    if(!a)return;
    try{prefetchUrl(new URL(a.href,location.href))}catch{}
  },{passive:true});
  document.addEventListener('focusin',e=>{
    const a=e.target.closest?.('a[href]');
    if(!a)return;
    try{prefetchUrl(new URL(a.href,location.href))}catch{}
  });
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
    setTimeout(()=>location.assign(u.href),70);
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

// f2w-force-save:v136-hover-prefetch-and-short-exit:20261012
