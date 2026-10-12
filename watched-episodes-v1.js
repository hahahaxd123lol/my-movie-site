/* Flix2Watch watched episodes v1 — UID-linked episode completion */
(()=>{
  'use strict';
  if(window.__f2wWatchedEpisodesV1)return;
  window.__f2wWatchedEpisodesV1=true;

  const params=new URLSearchParams(location.search);
  const mediaId=Number(params.get('id')||0);
  const mediaType=params.get('type')==='tv'?'tv':'movie';
  if(!Number.isSafeInteger(mediaId)||mediaId<=0)return;

  const TMDB_KEY='925c48dd6e24fd5e975fe224238bbb45';
  const seasonSelect=()=>document.getElementById('season-select');
  const episodeSelect=()=>document.getElementById('episode-select');
  const watched=new Set();
  const markInFlight=new Set();
  const retryAfter=new Map();
  let client=null, activeUid='', authSubscription=null, seasonCounts={};
  let countsLoaded=false, renderTimer=0, warnedMigration=false;

  const episodeKey=(season,episode)=>String(Number(season))+':'+String(Number(episode));
  const escapeText=s=>String(s??'');
  function db(){
    return window.f2wSupabase||window.chatSupabase||window.supabaseClient||window.__supabaseClient||null;
  }
  function setUid(uid){
    uid=String(uid||'');
    if(uid===activeUid)return;
    activeUid=uid;
    watched.clear();
    markInFlight.clear();
    retryAfter.clear();
    renderLabels();
    if(uid)void loadWatched(uid);
  }
  async function loadWatched(uid){
    const c=client||db();
    if(!c?.rpc||!uid)return;
    try{
      const {data,error}=await c.rpc('get_my_watched_media_v1',{p_media_id:mediaId,p_media_type:mediaType});
      if(error)throw error;
      if(uid!==activeUid)return;
      watched.clear();
      for(const row of Array.isArray(data)?data:[]){
        const season=Number(row.season),episode=Number(row.episode);
        if(mediaType==='movie')watched.add(episodeKey(0,0));
        else if(season>0&&episode>0)watched.add(episodeKey(season,episode));
      }
      renderLabels();
    }catch(error){
      if(!warnedMigration){
        warnedMigration=true;
        console.warn('Watched episodes are waiting for the Supabase migration watched-episodes-v1.sql:',error?.message||error);
      }
    }
  }
  async function initialiseAuth(){
    client=db();
    if(!client?.auth){
      setTimeout(initialiseAuth,300);
      return;
    }
    try{
      const {data,error}=await client.auth.getSession();
      if(!error)setUid(data?.session?.user?.id||'');
    }catch{}
    try{
      const sub=client.auth.onAuthStateChange((_event,session)=>{
        setTimeout(()=>setUid(session?.user?.id||''),0);
      });
      authSubscription=sub?.data?.subscription||null;
    }catch{}
  }

  async function loadSeasonCounts(){
    if(countsLoaded)return;
    countsLoaded=true;
    const cacheKey='f2w_watched_episode_counts_v1_'+mediaId;
    try{
      const cached=JSON.parse(sessionStorage.getItem(cacheKey)||'null');
      if(cached&&Date.now()-Number(cached.at)<86400000&&cached.counts){
        seasonCounts=cached.counts;
        renderLabels();
        return;
      }
    }catch{}
    try{
      const response=await fetch('https://api.themoviedb.org/3/tv/'+mediaId+'?api_key='+encodeURIComponent(TMDB_KEY),{cache:'force-cache'});
      if(!response.ok)return;
      const data=await response.json();
      const counts={};
      for(const season of Array.isArray(data.seasons)?data.seasons:[]){
        const n=Number(season.season_number),count=Number(season.episode_count);
        if(n>0&&count>0)counts[n]=count;
      }
      seasonCounts=counts;
      try{sessionStorage.setItem(cacheKey,JSON.stringify({at:Date.now(),counts}))}catch{}
      renderLabels();
    }catch{}
  }

  function baseLabel(option){
    if(!option.dataset.f2wWatchedBase)option.dataset.f2wWatchedBase=option.textContent||'';
    return option.dataset.f2wWatchedBase;
  }
  function renderLabels(){
    if(mediaType==='movie'){
      const badge=document.getElementById('f2w-movie-watched-badge-v1');
      if(badge){const isWatched=Boolean(activeUid&&watched.has(episodeKey(0,0)));badge.hidden=!isWatched;badge.style.display=isWatched?'inline-flex':'none';}
      return;
    }
    const badge=document.getElementById('f2w-movie-watched-badge-v1');
    if(badge)badge.hidden=true;
    const ss=seasonSelect(),es=episodeSelect();
    if(ss){
      for(const option of ss.options){
        const base=baseLabel(option),season=Number(option.value),count=Number(seasonCounts[season]||0);
        const allWatched=count>0&&Array.from({length:count},(_,i)=>watched.has(episodeKey(season,i+1))).every(Boolean);
        const next=base+(activeUid&&allWatched?'  ✓ Watched':'');
        if(option.textContent!==next)option.textContent=next;
      }
    }
    if(es){
      const season=Number(ss?.value||params.get('season')||1);
      for(const option of es.options){
        const base=baseLabel(option),episode=Number(option.value);
        const isWatched=activeUid&&watched.has(episodeKey(season,episode));
        const next=base+(isWatched?'  ✓ Watched':'');
        if(option.textContent!==next)option.textContent=next;
      }
    }
  }
  function scheduleRender(){
    if(renderTimer)return;
    renderTimer=setTimeout(()=>{renderTimer=0;renderLabels()},40);
  }
  function thresholdReached(position,duration){
    if(!Number.isFinite(position)||!Number.isFinite(duration)||duration<=0||position<0)return false;
    // Movies and episodes become watched with five minutes remaining.
    // For shorter titles, use halfway so they are not marked at 0 seconds.
    const threshold=duration>300?duration-300:duration*0.5;
    return position>=threshold;
  }
  async function markWatched(season,episode,position,duration){
    const uid=activeUid,c=client||db();
    if(!uid||!c?.rpc||(mediaType==='tv'&&(season<=0||episode<=0)))return;
    const key=mediaType==='movie'?episodeKey(0,0):episodeKey(season,episode);
    if(watched.has(key)||markInFlight.has(key)||(retryAfter.get(key)||0)>Date.now())return;
    markInFlight.add(key);
    try{
      const {error}=await c.rpc('mark_my_watched_media_v1',{
        p_media_id:mediaId,p_media_type:mediaType,
        p_season:mediaType==='tv'?season:0,p_episode:mediaType==='tv'?episode:0,
        p_position_seconds:Math.floor(position),p_duration_seconds:Math.floor(duration)
      });
      if(error)throw error;
      if(uid!==activeUid)return;
      retryAfter.delete(key);
      watched.add(key);
      renderLabels();
    }catch(error){
      retryAfter.set(key,Date.now()+30000);
      console.warn('Could not save watched episode:',error?.message||error);
    }finally{
      markInFlight.delete(key);
    }
  }
  function onPlayerEvent(event){
    if(event.origin!=='https://player.flix2watch.com')return;
    const payload=event.data;
    if(!payload||payload.type!=='PLAYER_EVENT'||!payload.data)return;
    const data=payload.data,info=data.player_info||{};
    const reportedType=String(info.mediaType||mediaType).toLowerCase();
    if((reportedType==='tv'||reportedType==='series'||reportedType==='show'?'tv':'movie')!==mediaType)return;
    const pos=Number(data.player_progress);
    const dur=Number(data.player_duration||data.duration||info.duration||0);
    if(!thresholdReached(pos,dur))return;
    const season=mediaType==='tv'?Number(info.season||seasonSelect()?.value||params.get('season')||1):0;
    const episode=mediaType==='tv'?Number(info.episode||episodeSelect()?.value||params.get('episode')||1):0;
    void markWatched(season,episode,pos,dur);
  }

  document.addEventListener('change',event=>{
    if(event.target===seasonSelect()||event.target===episodeSelect())scheduleRender();
  });
  window.addEventListener('message',onPlayerEvent);

  // The shared watch-page bridge normalizes progress messages from whichever
  // provider is active into #f2w-premid-state. Avoid tying watched state to
  // Flix2Watch API's PLAYER_EVENT payload only.
  function onUnifiedTelemetry(){
    const node=document.getElementById('f2w-premid-state');
    const state=node?.dataset;
    if(!state||Number(state.mediaId)!==mediaId)return;
    const stateType=String(state.mediaType||'').toLowerCase();
    if((stateType==='tv'?'tv':'movie')!==mediaType)return;
    const updatedAt=Number(state.updatedAt||0);
    if(updatedAt&&Date.now()-updatedAt>15000)return;
    const position=Number(state.position),duration=Number(state.duration);
    if(!thresholdReached(position,duration))return;
    const season=mediaType==='tv'?Number(state.season||seasonSelect()?.value||params.get('season')||1):0;
    const episode=mediaType==='tv'?Number(state.episode||episodeSelect()?.value||params.get('episode')||1):0;
    void markWatched(season,episode,position,duration);
  }
  setInterval(onUnifiedTelemetry,1000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')onUnifiedTelemetry()});
  const observer=new MutationObserver(scheduleRender);
  const attachObserver=()=>{
    const ss=seasonSelect(),es=episodeSelect();
    if(ss)observer.observe(ss,{childList:true});
    if(es)observer.observe(es,{childList:true});
    scheduleRender();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attachObserver,{once:true});
  else attachObserver();
  window.addEventListener('pageshow',()=>{renderLabels();if(activeUid)void loadWatched(activeUid)},{passive:true});
  window.addEventListener('flix2watch:media-ready',scheduleRender);
  const titleObserverTarget=document.getElementById('detail-title');
  if(titleObserverTarget)new MutationObserver(scheduleRender).observe(titleObserverTarget,{childList:true,characterData:true,subtree:true});
  void initialiseAuth();
  if(mediaType==='tv')void loadSeasonCounts();
})();
// f2w-force-save: watched all-source telemetry 2026-10-12
