/* Flix2Watch v142 — lightweight site-wide player warmup */
(()=>{
  if(window.__f2wPlayerWarm142)return; window.__f2wPlayerWarm142=true;
  const ORIGIN='https://player.flix2watch.com';
  const warm=()=>{
    if(window.__f2wPlayerOriginWarmed)return; window.__f2wPlayerOriginWarmed=true;
    try{ fetch(ORIGIN+'/',{mode:'no-cors',credentials:'omit',cache:'force-cache',priority:'low'}).catch(()=>{}); }catch(_){}
  };
  if('requestIdleCallback' in window) requestIdleCallback(warm,{timeout:1200}); else setTimeout(warm,250);
  document.addEventListener('pointerover',e=>{ if(e.target?.closest?.('a[href*="/watch/"]')) warm(); },{passive:true,capture:true});
  document.addEventListener('touchstart',e=>{ if(e.target?.closest?.('a[href*="/watch/"]')) warm(); },{passive:true,capture:true});
})();
