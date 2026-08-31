
(() => {
  'use strict';

  /*
    V32 parent-page popup protection.

    This deliberately does NOT attempt to evade anti-adblock detection.
    It also cannot control window.open() executed inside a cross-origin
    third-party player iframe when that iframe is unsandboxed.
  */

  const nativeOpen=window.open.bind(window);

  function parsed(url){
    try{
      return new URL(String(url||''),location.href);
    }catch{
      return null;
    }
  }

  function allowedPopup(url){
    const u=parsed(url);
    if(!u)return false;

    if(u.origin===location.origin)return true;

    // Allow normal authentication destinations in case OAuth uses a popup.
    const host=u.hostname.toLowerCase();
    if(
      host==='viqufxlcxwgboyxbdhjb.supabase.co'
      ||host==='accounts.google.com'
      ||host==='discord.com'
      ||host==='www.discord.com'
    ){
      return true;
    }

    return false;
  }

  window.open=function(url,target,features){
    if(allowedPopup(url)){
      const opened=nativeOpen(url,target,features);
      try{
        if(opened)opened.opener=null;
      }catch{}
      return opened;
    }

    console.info('[Flix2Watch] Blocked a top-level popup:',url);
    return null;
  };

  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[target="_blank"]');
    if(!link)return;

    link.rel='noopener noreferrer';

    if(
      link.dataset.f2wAllowPopup==='true'
      ||allowedPopup(link.href)
    ){
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    console.info('[Flix2Watch] Blocked an external popup link:',link.href);
  },true);

  // Ensure existing/new top-level blank links cannot retain window.opener.
  function hardenLinks(root=document){
    root.querySelectorAll?.('a[target="_blank"]').forEach(link=>{
      const rel=new Set(String(link.rel||'').split(/\s+/).filter(Boolean));
      rel.add('noopener');
      rel.add('noreferrer');
      link.rel=[...rel].join(' ');
    });
  }

  hardenLinks();

  const observer=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){
        if(node?.nodeType===1){
          if(node.matches?.('a[target="_blank"]'))hardenLinks(node.parentElement||document);
          else hardenLinks(node);
        }
      }
    }
  });

  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
