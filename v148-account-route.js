(()=>{
  'use strict';
  if(window.__f2wAccountRouteV148)return;
  window.__f2wAccountRouteV148=true;

  const go=()=>{
    if(location.pathname==='/account/'||location.pathname==='/account')return false;
    location.href='/account/';
    return false;
  };

  // v148: Account is a real route, not a page-local modal. Keep login/create-account
  // on the existing auth flow, but every signed-in Account trigger goes to /account/.
  window.openAccountModal=go;
  window.openAccountPage=go;

  function normalize(){
    document.querySelectorAll('#account-btn,[data-f2w-account-link]').forEach(el=>{
      if(el.id==='account-btn'){
        el.innerHTML='<i class="fa-regular fa-user"></i> Account';
        el.setAttribute('aria-label','Account');
        el.title='Account';
      }
      el.removeAttribute('onclick');
      if(el.tagName==='A')el.setAttribute('href','/account/');
      else el.dataset.f2wAccountLink='1';
    });
  }

  document.addEventListener('click',event=>{
    const trigger=event.target?.closest?.('#account-btn,[data-f2w-account-link]');
    if(!trigger)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    go();
  },true);

  function boot(){
    normalize();
    const mo=new MutationObserver(normalize);
    mo.observe(document.documentElement,{subtree:true,childList:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
