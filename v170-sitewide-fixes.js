(()=>{
'use strict';
if(window.__f2wV170SiteFixes)return;window.__f2wV170SiteFixes=true;

// Keep leaderboard selection visually singular even if the global red-button scanner tagged the initial XP button.
function fixLeaderboard(){
  document.querySelectorAll('.lb140-tab').forEach(btn=>{
    const active=btn.classList.contains('active');
    btn.setAttribute('aria-pressed',active?'true':'false');
  });
}
document.addEventListener('click',e=>{if(e.target.closest?.('.lb140-tab'))setTimeout(fixLeaderboard,0)},true);

// Some legacy account-action notices were positioned against the document and could appear far above/below the user's viewport.
// Detect those specific dialogs and center the overlay against the viewport they are currently looking at.
const accountPhrases=['account suspended','account banned','account has been unbanned','account has been banned','account action'];
function centerAccountNotices(root=document){
  const all=root.querySelectorAll?.('div,section,aside,dialog')||[];
  for(const el of all){
    if(el.id==='f2w-v165-enforcement')continue;
    const text=(el.textContent||'').trim().toLowerCase();
    if(!text||text.length>1800||!accountPhrases.some(p=>text.includes(p)))continue;
    // Find a likely backdrop/overlay ancestor. Prefer a large fixed/absolute parent; otherwise use the dialog itself.
    let dialog=el,overlay=el.parentElement;
    while(overlay&&overlay!==document.body){
      const r=overlay.getBoundingClientRect();
      const cs=getComputedStyle(overlay);
      if((cs.position==='fixed'||cs.position==='absolute')&&(r.width>innerWidth*.7||r.height>innerHeight*.7))break;
      overlay=overlay.parentElement;
    }
    if(!overlay||overlay===document.body){overlay=el.parentElement||el;dialog=el}else{
      let candidate=el;
      while(candidate.parentElement&&candidate.parentElement!==overlay)candidate=candidate.parentElement;
      dialog=candidate;
    }
    overlay.classList.add('f2w-v170-viewport-overlay');
    dialog.classList.add('f2w-v170-viewport-dialog');
  }
}
function boot(){fixLeaderboard();centerAccountNotices();const mo=new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1)centerAccountNotices(n)});mo.observe(document.documentElement,{subtree:true,childList:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
