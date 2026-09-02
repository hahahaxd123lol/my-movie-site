(()=>{
'use strict';
if(window.__f2wV201WatchRealtime)return;window.__f2wV201WatchRealtime=true;
window.__f2wV182WatchRealtime=true;
window.__f2wV177WatchRealtime=true;
if(!location.pathname.startsWith('/watch'))return;

const $=s=>document.querySelector(s);
const frame=()=>$('#video-frame');
let telemetry={position:0,duration:0,status:'unknown',positionAt:0,statusKnown:false,positionKnown:false,source:'',updatedAt:0};
let heartbeatTimer=0,busy=false,immediateTimer=0,lastImmediateAt=0,telemetryWatchdog=0,lastPositionSample=null,lastPositionSampleAt=0,stablePositionSince=0;
let creditBucket=0,lastCreditSampleAt=Date.now();
let bc=null;
try{bc=new BroadcastChannel('f2w-playback-v182')}catch{}
let presenceTimer=0,presenceSessionId='';

function client(){return window.f2wSupabase||window.chatSupabase||window.supabaseClient||null}
function identity(){const q=new URLSearchParams(location.search);return {id:Number(q.get('id')||0),type:q.get('type')==='tv'?'tv':'movie'}}
function titleInfo(){
  const title=String($('#detail-title')?.textContent||document.title||'').replace(/\s*[|•].*$/,'').trim();
  const posterRoot=$('#detail-poster');
  const img=(posterRoot?.tagName==='IMG'?posterRoot:null)||posterRoot?.querySelector?.('img')||$('.detail-poster img,.poster img,img[alt*="poster" i]');
  const src=String(img?.currentSrc||img?.getAttribute?.('src')||img?.getAttribute?.('data-src')||'');
  const m=src.match(/image\.tmdb\.org\/t\/p\/[^/]+(\/[^?]+)/i);
  return {title:title.slice(0,250),poster:m?.[1]||null};
}
function sourceKey(){return String(window.currentServer||document.querySelector('.server-btn.active')?.dataset?.server||'unknown').slice(0,80)}
function visiblePlayback(){
  const f=frame();if(!f||document.visibilityState!=='visible'||f.hidden)return false;
  try{if(getComputedStyle(f).display==='none')return false}catch{}
  return /^https?:/i.test(String(f.getAttribute('src')||''));
}
function normalizeStatus(raw){
  const s=String(raw??'').trim().toLowerCase();if(!s)return '';
  if(/(^|[^a-z])(pause|paused)([^a-z]|$)/.test(s))return 'paused';
  if(/(^|[^a-z])(complete|completed|ended|end|finished|finish)([^a-z]|$)/.test(s))return 'completed';
  if(/(^|[^a-z])(buffer|buffering|waiting|wait|loading)([^a-z]|$)/.test(s))return 'buffering';
  if(/(^|[^a-z])(play|playing|resume|resumed|started|start)([^a-z]|$)/.test(s))return 'playing';
  if(/(^|[^a-z])(stop|stopped|idle)([^a-z]|$)/.test(s))return 'stopped';
  if(/seek/.test(s))return 'seeked';
  return '';
}
function numFrom(obj,keys){for(const k of keys){const n=Number(obj?.[k]);if(Number.isFinite(n))return n}return null}
function stringFrom(obj,keys){for(const k of keys){const v=obj?.[k];if(v!==undefined&&v!==null&&String(v).trim())return String(v)}return ''}
function rootsOf(data){
  if(typeof data==='string'){try{data=JSON.parse(data)}catch{return []}}
  if(!data||typeof data!=='object')return [];
  const roots=[data];
  for(const k of ['data','payload','detail','player','event','message','info']){const v=data[k];if(v&&typeof v==='object')roots.push(v)}
  for(const root of [...roots])for(const k of ['data','payload','detail','player','player_info','info']){const v=root?.[k];if(v&&typeof v==='object'&&!roots.includes(v))roots.push(v)}
  return roots;
}
function readTelemetry(data){
  const roots=rootsOf(data);if(!roots.length)return null;
  let pos=null,dur=null,status='',eventName='';
  for(const root of roots){
    if(pos===null)pos=numFrom(root,['player_progress','currentTime','current_time','position','position_seconds','progressSeconds','progress_seconds','current','time','seconds']);
    if(dur===null)dur=numFrom(root,['player_duration','duration','totalDuration','total_duration','duration_seconds','length']);
    if(!status){
      if(root.paused===true||root.isPaused===true||root.is_paused===true)status='paused';
      else if(root.playing===true||root.isPlaying===true||root.is_playing===true)status='playing';
      else {
        const numeric=numFrom(root,['playerState','player_state','stateCode','state_code']);
        if(numeric===1)status='playing';else if(numeric===2)status='paused';else if(numeric===0)status='completed';else if(numeric===3)status='buffering';
        if(!status)status=normalizeStatus(stringFrom(root,['player_status','status','state','playback_status']));
      }
    }
    if(!eventName)eventName=normalizeStatus(stringFrom(root,['event','eventType','event_type','action','type','name','method','command']));
  }
  const important=eventName==='seeked'||eventName==='paused'||eventName==='playing'||eventName==='completed';
  if(status==='seeked')status='';
  if(pos===null&&dur===null&&!status&&!important)return null;
  return {position:pos,duration:dur,status,eventName,important};
}
function estimatedPosition(at=Date.now()){
  if(!telemetry.positionKnown)return null;
  let p=Math.max(0,Number(telemetry.position)||0);
  if(telemetry.status==='playing'&&telemetry.positionAt)p+=(at-telemetry.positionAt)/1000;
  if(telemetry.duration>0)p=Math.min(p,telemetry.duration);
  return p;
}
function accrue(at=Date.now()){
  const elapsed=Math.max(0,Math.min(45,(at-lastCreditSampleAt)/1000));
  if(visiblePlayback()){
    const count=telemetry.statusKnown?telemetry.status==='playing':true;
    if(count)creditBucket=Math.min(90,creditBucket+elapsed);
  }
  lastCreditSampleAt=at;
}
function broadcast(extra={}){
  const {id,type}=identity();const info=titleInfo();
  const payload={type:'f2w-playback-v182',media_id:id,media_type:type,title:info.title,poster_path:info.poster,source_key:sourceKey(),
    position_seconds:estimatedPosition(),duration_seconds:telemetry.positionKnown||telemetry.duration>0?telemetry.duration:null,
    playback_status:telemetry.statusKnown?telemetry.status:'unknown',progress_updated_at:new Date().toISOString(),last_seen_at:new Date().toISOString(),...extra};
  try{bc?.postMessage(payload)}catch{}
}
function scheduleImmediateHeartbeat(){
  clearTimeout(immediateTimer);const wait=Math.max(80,1000-(Date.now()-lastImmediateAt));
  immediateTimer=setTimeout(()=>{lastImmediateAt=Date.now();void heartbeat(true)},wait);
}
function applyTelemetry(next){
  const now=Date.now();accrue(now);
  const prevStatus=telemetry.status,prevKnown=telemetry.statusKnown,priorPosition=estimatedPosition(now);
  if(Number.isFinite(next.position)){
    const sample=Math.max(0,next.position),had=Number.isFinite(lastPositionSample),delta=had?sample-lastPositionSample:0,elapsed=lastPositionSampleAt?now-lastPositionSampleAt:0;
    if(!next.status&&had&&elapsed>0){
      if(delta>.18){next.status='playing';stablePositionSince=0}
      else if(Math.abs(delta)<.08){if(!stablePositionSince)stablePositionSince=lastPositionSampleAt||now;if(now-stablePositionSince>=2500)next.status='paused'}
      else stablePositionSince=0;
    }
    lastPositionSample=sample;lastPositionSampleAt=now;
    telemetry.position=sample;telemetry.positionKnown=true;telemetry.positionAt=now;
  }
  else if(priorPosition!==null&&telemetry.positionKnown){telemetry.position=priorPosition;telemetry.positionAt=now}
  if(Number.isFinite(next.duration)&&next.duration>=0)telemetry.duration=next.duration;
  if(next.status){telemetry.status=next.status;telemetry.statusKnown=true}
  else if(next.eventName==='seeked'&&prevKnown){telemetry.status=prevStatus}
  telemetry.source=sourceKey();telemetry.updatedAt=now;
  const statusChanged=next.status&&(!prevKnown||next.status!==prevStatus);
  broadcast();if(statusChanged||next.important)scheduleImmediateHeartbeat();
}
function resetTelemetry(){
  accrue();telemetry={position:0,duration:0,status:'unknown',positionAt:0,statusKnown:false,positionKnown:false,source:sourceKey(),updatedAt:Date.now()};lastPositionSample=null;lastPositionSampleAt=0;stablePositionSince=0;
  broadcast({source_changed:true});scheduleImmediateHeartbeat();
}
window.addEventListener('message',e=>{
  const f=frame();if(!f||e.source!==f.contentWindow)return;
  const t=readTelemetry(e.data);if(t)applyTelemetry(t);
});

function bindNativeVideos(){
  document.querySelectorAll('video').forEach(v=>{
    if(v.dataset.f2wTelemetryV183)return;v.dataset.f2wTelemetryV183='1';
    const sample=(status='')=>applyTelemetry({position:Number(v.currentTime)||0,duration:Number.isFinite(v.duration)?v.duration:0,status,eventName:status,important:!!status});
    v.addEventListener('play',()=>sample('playing'),{passive:true});
    v.addEventListener('playing',()=>sample('playing'),{passive:true});
    v.addEventListener('pause',()=>sample(v.ended?'completed':'paused'),{passive:true});
    v.addEventListener('ended',()=>sample('completed'),{passive:true});
    v.addEventListener('waiting',()=>sample('buffering'),{passive:true});
    v.addEventListener('seeking',()=>sample('seeked'),{passive:true});
    v.addEventListener('timeupdate',()=>sample(v.paused?'paused':'playing'),{passive:true});
  });
}
function watchdogTelemetry(){
  if(!telemetry.statusKnown||telemetry.status!=='playing'||!telemetry.positionKnown)return;
  // Players that expose telemetry normally send progress repeatedly. If that stream
  // goes silent, freeze the public clock instead of pretending playback continued.
  if(telemetry.updatedAt&&Date.now()-telemetry.updatedAt>10000){
    const p=estimatedPosition(telemetry.updatedAt+10000);
    telemetry.position=Math.max(0,Number(p)||0);telemetry.positionAt=Date.now();telemetry.status='paused';telemetry.updatedAt=Date.now();
    broadcast({telemetry_stale:true});scheduleImmediateHeartbeat();
  }
}
function releaseViewportPortal(){
  const modal=$('#account-modal');if(modal&&modal.closest('#f2w-viewport-modal-portal'))document.body.appendChild(modal);
  document.documentElement.classList.remove('f2w-popup-scroll-lock');document.body.classList.remove('f2w-popup-scroll-lock');
}
function bindAuthRepair(){
  releaseViewportPortal();const gate=$('#watch-login-overlay');
  if(gate){gate.style.position='absolute';gate.style.inset='0';gate.querySelectorAll('button').forEach(b=>b.style.pointerEvents='auto')}
  const m=$('#account-modal');if(m&&m.classList.contains('open'))m.querySelectorAll('input,textarea,select,button').forEach(el=>el.removeAttribute('inert'));
}
async function touchWatchPresence(){
  const c=client();if(!c?.rpc||!c?.auth)return;
  try{
    const {data}=await c.auth.getSession();if(!data?.session?.user)return;
    if(!presenceSessionId){
      try{presenceSessionId=sessionStorage.getItem('f2w_presence_session_v17')||'';if(!presenceSessionId){presenceSessionId=crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;sessionStorage.setItem('f2w_presence_session_v17',presenceSessionId)}}catch{presenceSessionId=`${Date.now()}-${Math.random().toString(36).slice(2)}`}
    }
    await c.rpc('touch_presence_v203',{p_session_id:presenceSessionId});
  }catch(e){console.warn('v205 watch presence unavailable:',e?.message||e)}
}
async function leaveWatchPresence(){const c=client();if(!presenceSessionId||!c?.rpc)return;try{await c.rpc('leave_presence_v203',{p_session_id:presenceSessionId})}catch{}}
async function heartbeat(force=false){
  if(busy||(!force&&!visiblePlayback()))return;
  const c=client();if(!c?.rpc||!c?.auth)return;const {id,type}=identity();if(!id)return;busy=true;
  try{
    accrue();const {data}=await c.auth.getSession();if(!data?.session?.user)return;
    const info=titleInfo(),now=Date.now();const credit=Math.max(0,Math.min(45,Math.floor(creditBucket)));creditBucket=Math.max(0,creditBucket-credit);
    const pos=telemetry.positionKnown?Math.max(0,Math.floor(estimatedPosition(now))):null;
    const dur=telemetry.duration>0?Math.floor(telemetry.duration):null;
    const status=telemetry.statusKnown?telemetry.status:'unknown';
    const {error}=await c.rpc('touch_playback_session_v177',{
      p_media_type:type,p_media_id:id,p_title:info.title||`${type==='tv'?'TV':'Movie'} #${id}`,p_poster_path:info.poster,
      p_source_key:sourceKey(),p_position_seconds:pos,p_duration_seconds:dur,p_playback_status:status,p_watch_seconds:credit
    });
    if(error)throw error;broadcast({persisted:true});
  }catch(err){console.warn('v182 playback heartbeat unavailable:',err?.message||err)}finally{busy=false}
}

let statePollTimer=0;
function requestPlayerTelemetry(){
  const f=frame();
  const w=f?.contentWindow;
  if(!w||!visiblePlayback())return;
  let target='*';
  try{target=new URL(String(f.src||''),location.href).origin}catch{}
  const probes=[
    {type:'PLAYER_COMMAND',action:'get_state'},
    {type:'PLAYER_COMMAND',command:'get_state'},
    {type:'PLAYER_COMMAND',action:'get_progress'},
    {type:'PLAYER_COMMAND',command:'get_progress'},
    {type:'GET_PLAYER_STATE'},
    {type:'GET_PLAYBACK_STATE'}
  ];
  for(const probe of probes){try{w.postMessage(probe,target)}catch{}}
}
function start(){
  bindAuthRepair();lastCreditSampleAt=Date.now();heartbeat();clearInterval(heartbeatTimer);heartbeatTimer=setInterval(()=>heartbeat(),10000);
  window.__f2wV205WatchPresenceAuthority=true;touchWatchPresence();clearInterval(presenceTimer);presenceTimer=setInterval(touchWatchPresence,10000);
  const f=frame();f?.addEventListener('load',()=>{resetTelemetry();bindAuthRepair();bindNativeVideos()});
  bindNativeVideos();clearInterval(telemetryWatchdog);telemetryWatchdog=setInterval(watchdogTelemetry,2000);
  clearInterval(statePollTimer);statePollTimer=setInterval(requestPlayerTelemetry,2000);setTimeout(requestPlayerTelemetry,900);
  const posterRoot=$('#detail-poster'),poster=(posterRoot?.tagName==='IMG'?posterRoot:null)||posterRoot?.querySelector?.('img');
  poster?.addEventListener('load',()=>{broadcast();scheduleImmediateHeartbeat()},{passive:true});
  if(poster){const posterMo=new MutationObserver(()=>{broadcast();scheduleImmediateHeartbeat()});posterMo.observe(poster,{attributes:true,attributeFilter:['src','data-src']})}
  document.addEventListener('click',e=>{if(e.target.closest?.('.server-btn[data-server]'))setTimeout(resetTelemetry,0)},true);
  const mo=new MutationObserver(()=>{bindAuthRepair();bindNativeVideos()});mo.observe(document.body,{subtree:true,childList:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.addEventListener('pageshow',()=>{bindAuthRepair();lastCreditSampleAt=Date.now();touchWatchPresence();heartbeat()});
document.addEventListener('visibilitychange',()=>{accrue();lastCreditSampleAt=Date.now();if(document.visibilityState==='visible')heartbeat()});
window.addEventListener('pagehide',()=>{accrue();clearInterval(telemetryWatchdog);clearInterval(statePollTimer);clearInterval(presenceTimer);void heartbeat(true);void leaveWatchPresence()});
})();
// f2w-force-save:v182-watch-telemetry-pause-poster:20260902

// f2w-force-save:v183-watch-pause-all-supported-sources:20260902

// f2w-force-save:v201-playback-profile-clock:20260902

// f2w-force-save:v205-watch-presence-playback-10s:20260902
