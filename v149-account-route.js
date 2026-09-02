(()=>{
  'use strict';
  if(window.__f2wAccountRouteV149)return;
  window.__f2wAccountRouteV149=true;

  const ACCOUNT_PATH='/account/';

  function go(){
    if(location.pathname==='/account/'||location.pathname==='/account')return false;
    location.assign(ACCOUNT_PATH);
    return false;
  }

  // Only redirect the signed-in Account action. Authentication modals remain available
  // through the site's existing Login / Create Account controls.
  window.openAccountPage=go;

  function normalizeElement(el){
    if(!el || el.dataset.f2wAccountRoute149==='1') return;
    el.dataset.f2wAccountRoute149='1';

    if(el.id==='account-btn'){
      // Do not rewrite innerHTML repeatedly: that caused the v148 MutationObserver loop
      // that could lock the main thread before any page painted.
      const wanted='Account';
      el.setAttribute('aria-label',wanted);
      el.title=wanted;
      const text=(el.textContent||'').trim().toLowerCase();
      if(text && text!=='account'){
        const icon=el.querySelector('i');
        // Preserve existing icon nodes/listeners where possible.
        if(icon){
          Array.from(el.childNodes).forEach(n=>{ if(n!==icon) n.remove(); });
          el.append(document.createTextNode(' Account'));
        }
      }
    }

    // Remove only inline account-modal routing from the actual Account button/link.
    if(el.tagName==='A') el.setAttribute('href',ACCOUNT_PATH);
    else el.dataset.f2wAccountLink='1';
  }

  function normalize(root=document){
    if(root.nodeType===1 && root.matches?.('#account-btn,[data-f2w-account-link]')) normalizeElement(root);
    root.querySelectorAll?.('#account-btn,[data-f2w-account-link]').forEach(normalizeElement);
  }

  document.addEventListener('click',event=>{
    const trigger=event.target?.closest?.('#account-btn,[data-f2w-account-link]');
    if(!trigger)return;
    // Login/signup controls don't use these selectors, so this is safe site-wide.
    event.preventDefault();
    event.stopImmediatePropagation();
    go();
  },true);

  function boot(){
    normalize(document);
    // Watch only newly-added nodes and normalize each node once. Never rewrite the same
    // Account element in response to mutations created by our own normalization.
    const mo=new MutationObserver(records=>{
      for(const record of records){
        for(const node of record.addedNodes){
          if(node.nodeType===1) normalize(node);
        }
      }
    });
    mo.observe(document.documentElement,{subtree:true,childList:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
