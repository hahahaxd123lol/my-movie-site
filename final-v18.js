
(() => {
  'use strict';

  /* ==========================================================
     ONE GLOBAL HEADER SEARCH HANDLER
     ========================================================== */
  window.v18HeaderMovieSearch=function(value){
    const query=String(value||'');

    try{
      if(document.body?.classList.contains('f2w-home-page')){
        if(typeof window.scheduleMediaSearch==='function'){
          window.scheduleMediaSearch(query);
        }
        return;
      }

      if(document.body?.classList.contains('f2w-watch-page')){
        if(typeof window.searchMediaWatch==='function'){
          window.searchMediaWatch(query);
        }
        return;
      }

      if(
        document.body?.classList.contains('f2w-favorites-page')
        ||document.body?.classList.contains('f2w-profile-page')
      ){
        if(typeof window.searchMedia==='function'){
          window.searchMedia(query);
        }
      }
    }catch(error){
      console.warn('Header movie search:',error);
    }
  };

  /* ==========================================================
     REMOVE LEGACY TOP-RIGHT/NAVIGATOR SURFACES
     ========================================================== */
  function removeLegacyHeaderJunk(){
    const header=document.querySelector('body.f2w-main-page > header');
    if(!header)return;

    header.querySelectorAll(
      '.f2w-discover-wrap,#f2w-discover-menu,[onclick*="toggleUltraDiscover"],[onclick*="openUltraCommand"]'
    ).forEach(node=>node.remove());

    [...header.querySelectorAll('*')].forEach(node=>{
      const copy=String(node.textContent||'').trim().toLowerCase();

      if(
        copy.includes('quick commands ctrl k')
        ||copy.includes('install flix2watch')
      ){
        const legacy=node.closest(
          '.f2w-discover-menu,.f2w-discover-wrap,.ultra-menu,.quick-command-menu'
        )||node.parentElement;

        if(legacy&&legacy!==header)legacy.remove();
      }
    });
  }

  /* ==========================================================
     PROFILE REPORT MUST LIVE DIRECTLY UNDER BODY
     This prevents old transformed/profile containers from turning
     position:fixed into a bottom-left page element.
     ========================================================== */
  function normalizeProfileReport(){
    if(!document.body?.classList.contains('f2w-profile-page'))return;

    const modal=document.getElementById('report-modal');
    if(!modal)return;

    if(modal.parentElement!==document.body){
      document.body.appendChild(modal);
    }

    const update=()=>{
      const open=!modal.hidden;
      document.body.classList.toggle('v18-report-open',open);
      modal.setAttribute('aria-hidden',open?'false':'true');
    };

    update();

    new MutationObserver(update).observe(modal,{
      attributes:true,
      attributeFilter:['hidden','class','style']
    });
  }

  /* Keep body state correct even when old inline functions open/close it. */
  const oldOpenReport=window.openModerationReport;
  if(typeof oldOpenReport==='function'){
    window.openModerationReport=function(...args){
      const result=oldOpenReport.apply(this,args);
      setTimeout(()=>{
        normalizeProfileReport();
        const modal=document.getElementById('report-modal');
        if(modal&&!modal.hidden){
          document.body.classList.add('v18-report-open');
        }
      },0);
      return result;
    };
  }

  const oldCloseReport=window.closeModerationReport;
  if(typeof oldCloseReport==='function'){
    window.closeModerationReport=function(...args){
      const result=oldCloseReport.apply(this,args);
      document.body.classList.remove('v18-report-open');
      return result;
    };
  }

  function boot(){
    removeLegacyHeaderJunk();
    normalizeProfileReport();

    /* Old service-worker HTML can briefly reinsert stale legacy controls.
       Remove them again if that occurs. */
    new MutationObserver(()=>{
      removeLegacyHeaderJunk();
    }).observe(document.body,{subtree:true,childList:true});
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  }else{
    boot();
  }
})();
