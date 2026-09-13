/* Flix2Watch Live Sports event expiry manager — v220 */
(function(){
  'use strict';
  const EVENTS = {
    'jordan-mccann-vs-big-stacks': {
      sport: 'boxing',
      title: 'Jordan McCann vs Big Stacks',
      endsAt: '2026-09-12T23:15:00+01:00'
    },
    'garcia-vs-benn': {
      sport: 'boxing',
      title: 'Garcia vs Benn',
      endsAt: '2026-09-13T05:30:00+01:00'
    },
    'manchester-united-vs-manchester-city': {
      sport: 'football',
      title: 'Manchester United vs Manchester City',
      startsAt: '2026-09-13T16:30:00+01:00',
      endsAt: '2026-09-13T19:30:00+01:00'
    }
  };

  const SPORT_META = {
    boxing: {label:'Boxing', href:'/live/boxing/'},
    football: {label:'Football', href:'/live/football/'}
  };

  function isExpired(id, now){
    const ev=EVENTS[id];
    if(!ev || !ev.endsAt) return false;
    const t=Date.parse(ev.endsAt);
    return Number.isFinite(t) && (now || Date.now()) >= t;
  }

  function activeForSport(sport, now){
    now=now || Date.now();
    return Object.entries(EVENTS).filter(([id,ev])=>ev.sport===sport && !isExpired(id,now));
  }

  function updateCategoryPage(now){
    document.querySelectorAll('[data-live-event-id]').forEach(card=>{
      const id=card.getAttribute('data-live-event-id');
      if(isExpired(id,now)) card.remove();
    });

    const grid=document.querySelector('.event-grid');
    if(!grid || grid.querySelector('[data-live-event-id]')) return;
    if(grid.querySelector('.f2w-no-live-events')) return;
    const sport=(document.body && document.body.getAttribute('data-live-sport-page')) || 'live';
    const meta=SPORT_META[sport] || {label:'Live Sports'};
    const empty=document.createElement('div');
    empty.className='f2w-no-live-events';
    empty.style.cssText='grid-column:1/-1;padding:28px;border:1px solid #1e2d40;border-radius:17px;background:#081321;color:#91a0b5;text-align:center';
    empty.innerHTML='<i class="fa-regular fa-clock" style="font-size:1.4rem;margin-bottom:10px;display:block;color:#ff3342"></i><strong style="display:block;color:#fff;margin-bottom:5px">No live '+meta.label.toLowerCase()+' events right now</strong><span>Finished events are removed automatically.</span>';
    grid.appendChild(empty);
    const lead=document.querySelector('.lead');
    if(lead) lead.textContent='No live '+meta.label.toLowerCase()+' events right now.';
  }

  function updateSportsHome(now){
    Object.keys(SPORT_META).forEach(sport=>{
      const card=document.querySelector('[data-live-sport="'+sport+'"]');
      if(!card) return;
      const count=activeForSport(sport,now).length;
      const countEl=card.querySelector('[data-live-count]');
      if(countEl) countEl.textContent=count ? `${count} live event${count===1?'':'s'}` : 'No live events';
      if(count===0){
        card.classList.add('disabled');
        card.removeAttribute('href');
        card.setAttribute('aria-disabled','true');
      } else {
        card.classList.remove('disabled');
        card.setAttribute('href',SPORT_META[sport].href);
        card.removeAttribute('aria-disabled');
      }
    });
  }

  function stopPlayer(){
    try{ if(typeof window.stopPlayer==='function') window.stopPlayer(); }catch(_){ }
    document.querySelectorAll('.live-player-mount iframe,.player-wrap iframe').forEach(f=>{ try{f.src='about:blank'}catch(_){} f.remove(); });
  }

  function showEndedEvent(id){
    if(!isExpired(id)) return false;
    stopPlayer();
    const ev=EVENTS[id] || {};
    const meta=SPORT_META[ev.sport] || {label:'Live Sports',href:'/live/'};
    document.querySelectorAll('.live-pill,.live').forEach(el=>{el.textContent='ENDED'; el.style.animation='none';});
    const sub=document.querySelector('.sub');
    if(sub) sub.textContent=meta.label+' • Event ended';
    const panel=document.querySelector('.watch-panel');
    if(panel && !panel.dataset.expiredRendered){
      panel.dataset.expiredRendered='1';
      panel.innerHTML='<div style="padding:44px 24px;text-align:center;background:#081321;border:1px solid #1e2d40;border-radius:18px"><i class="fa-solid fa-flag-checkered" style="font-size:2rem;color:#ff3342;margin-bottom:14px"></i><h2 style="margin:0 0 8px">This live event has ended</h2><p style="margin:0 0 20px;color:#91a0b5">It has been removed from the live listings.</p><a href="'+meta.href+'" style="display:inline-flex;align-items:center;gap:8px;padding:11px 16px;border-radius:10px;background:#e50914;color:#fff;text-decoration:none;font-weight:700"><i class="fa-solid fa-arrow-left"></i> Back to '+meta.label+'</a></div>';
    }
    return true;
  }

  function refresh(){
    const now=Date.now();
    updateCategoryPage(now);
    updateSportsHome(now);
    const pageId=document.body && document.body.getAttribute('data-live-event-page');
    if(pageId) showEndedEvent(pageId);
  }

  window.F2WLiveEvents={events:EVENTS,isExpired,refresh};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',refresh,{once:true}); else refresh();
  setInterval(refresh,30000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();
