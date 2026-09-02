(()=>{
'use strict';
if(window.__f2wV177WatchRealtime)return;window.__f2wV177WatchRealtime=true;
if(!location.pathname.startsWith('/watch'))return;

const $=s=>document.querySelector(s);
const frame=()=>$('#video-frame');
let telemetry={position:0,duration:0,status:'',at:0,source:'',available:false};
let heartbeatTimer=0,busy=false,lastWatchCreditAt=Date.now();

function client(){return window.f2wSupabase||window.chatSupabase||window.supabaseClient||null}
function identity(){const q=new URLSearchParams(location.search);return {id:Number(q.get('id')||0),type:q.get('type')==='tv'?'tv':'movie'}}
function titleInfo(){
  const title=String($('#detail-title')?.textContent||document.title||'').replace(/\s*[|•].*$/,'').trim();
  const img=$('#detail-poster img,.detail-poster img,.poster img');
  const src=String(img?.getAttribute('src')||'');
  const m=src.match(/image\.tmdb\.org\/t\/p\/[^/]+(\/[^?]+)/i);
  return {title:title.slice(0,250),poster:m?.[1]||null};
}
function sourceKey(){return String(window.currentServer||document.querySelector('.server-btn.active')?.dataset?.server||'unknown').slice(0,80)}
function visiblePlayback(){const f=frame();return !!(f&&document.visibilityState==='visible'&&!f.hidden&&getComputedStyle(f).display!=='none'&&String(f.getAttribute('src')||'').startsWith('http'))}

// v174's generic popup portal must never take ownership of the Watch auth modal.
function releaseViewportPortal(){
  const modal=$('#account-modal');
  if(modal&&modal.closest('#f2w-viewport-modal-portal'))document.body.appendChild(modal);
  document.documentElement.classList.remove('f2w-popup-scroll-lock');
  document.body.classList.remove('f2w-popup-scroll-lock');
}
function closeAuth(){
  const modal=$('#account-modal');if(!modal)return;
  modal.classList.remove('open','f2w-auth-modal-open-v60','f2w-v159-auth-open');
  modal.style.removeProperty('display');modal.setAttribute('aria-hidden','true');modal.setAttribute('inert','');
  document.documentElement.classList.remove('f2w-auth-open-v56','f2w-auth-v67-open','f2w-popup-scroll-lock');
  document.body.classList.remove('f2w-auth-v67-open','f2w-popup-scroll-lock');
  for(const p of ['position','top','left','right','width','overflow'])document.body.style.removeProperty(p);
  document.documentElement.style.removeProperty('overflow');
}
function bindAuthRepair(){
  releaseViewportPortal();
  const modal=$('#account-modal');
  if(modal&&!modal.dataset.f2w177){
    modal.dataset.f2w177='1';
    modal.querySelector('.account-close,.chat-close,[data-close]')?.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();closeAuth()},true);
    modal.addEventListener('click',e=>{if(e.target===modal)closeAuth()});
    modal.querySelectorAll('input,textarea').forEach(el=>{el.removeAttribute('inert');el.style.pointerEvents='auto'});
  }
  const gate=$('#watch-login-overlay');
  if(gate){
    gate.style.position='absolute';gate.style.inset='0';
    gate.querySelectorAll('button').forEach(b=>b.style.pointerEvents='auto');
  }
}

function readTelemetry(data){
  if(!data||typeof data!=='object')return null;
  const root=data.data&&typeof data.data==='object'?data.data:data;
  const pos=[root.player_progress,root.currentTime,root.current_time,root.position,root.progressSeconds,root.progress_seconds].map(Number).find(Number.isFinite);
  const dur=[root.player_duration,root.duration,root.totalDuration,root.total_duration,root.duration_seconds].map(Number).find(Number.isFinite);
  const status=String(root.player_status||root.status||root.state||'').toLowerCase();
  if(!Number.isFinite(pos)&&!Number.isFinite(dur))return null;
  return {position:Math.max(0,Number.isFinite(pos)?pos:telemetry.position),duration:Math.max(0,Number.isFinite(dur)?dur:telemetry.duration),status,at:Date.now(),source:sourceKey(),available:true};
}
window.addEventListener('message',e=>{
  const f=frame();if(!f||e.source!==f.contentWindow)return;
  const t=readTelemetry(e.data);if(t)telemetry=t;
});

async function heartbeat(){
  if(busy||!visiblePlayback())return;
  const c=client();if(!c?.rpc||!c?.auth)return;
  const {id,type}=identity();if(!id)return;
  busy=true;
  try{
    const {data}=await c.auth.getSession();if(!data?.session?.user)return;
    const now=Date.now();const credit=Math.max(0,Math.min(45,Math.round((now-lastWatchCreditAt)/1000)));lastWatchCreditAt=now;
    const d=titleInfo();
    const p=telemetry.available?Math.max(0,Math.floor(telemetry.position+((telemetry.status==='playing'&&telemetry.at)?(now-telemetry.at)/1000:0))):null;
    const dur=telemetry.available&&telemetry.duration>0?Math.floor(telemetry.duration):null;
    const {error}=await c.rpc('touch_playback_session_v177',{
      p_media_type:type,p_media_id:id,p_title:d.title||`${type==='tv'?'TV':'Movie'} #${id}`,p_poster_path:d.poster,
      p_source_key:sourceKey(),p_position_seconds:p,p_duration_seconds:dur,p_playback_status:telemetry.status||'active',p_watch_seconds:credit
    });
    if(error)throw error;
  }catch(err){console.warn('v177 playback heartbeat unavailable:',err?.message||err)}finally{busy=false}
}
function start(){
  bindAuthRepair();
  // Disable the broken old 15s watch-time guard by making its stale selector irrelevant;
  // v177 owns consolidated watch-time + current-watching persistence.
  heartbeat();clearInterval(heartbeatTimer);heartbeatTimer=setInterval(heartbeat,30000);
  const mo=new MutationObserver(bindAuthRepair);mo.observe(document.body,{subtree:true,childList:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.addEventListener('pageshow',()=>{bindAuthRepair();heartbeat()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){lastWatchCreditAt=Date.now();heartbeat()}});
})();
