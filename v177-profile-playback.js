(()=>{
'use strict';
if(window.__f2wV177ProfilePlayback)return;window.__f2wV177ProfilePlayback=true;
if(!location.pathname.startsWith('/profile'))return;
const $=s=>document.querySelector(s);
let row=null,timer=0,busy=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function db(){return window.f2wSupabase||window.chatSupabase||window.supabaseClient||null}
function username(){try{return decodeURIComponent((location.pathname.match(/@([^/?#]+)/)||[])[1]||new URLSearchParams(location.search).get('user')||'').replace(/^@/,'')}catch{return ''}}
function fmt(sec){sec=Math.max(0,Math.floor(Number(sec)||0));const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function livePosition(){
  if(!row||row.position_seconds==null)return null;
  let p=Number(row.position_seconds)||0;
  const stamp=row.progress_updated_at?new Date(row.progress_updated_at).getTime():0;
  if(stamp&&['playing','active'].includes(String(row.playback_status||'').toLowerCase()))p+=(Date.now()-stamp)/1000;
  const d=Number(row.duration_seconds)||0;if(d>0)p=Math.min(p,d);return Math.max(0,p);
}
function paintClock(){
  const el=$('#f2w-v177-playback-clock');if(!el||!row)return;
  const p=livePosition(),d=Number(row.duration_seconds)||0;
  el.textContent=p==null?'Live timestamp unavailable for this source':`${fmt(p)}${d>0?' / '+fmt(d):''}`;
}
function render(){
  const host=$('#f2w-current-watching-card');if(!host)return;
  const seen=row?.last_seen_at?new Date(row.last_seen_at).getTime():0;
  if(!row?.media_id||!seen||Date.now()-seen>80000){host.className='f2w-current-watching-empty';host.innerHTML='Not watching anything right now.';host.onclick=null;host.style.cursor='';return}
  const poster=row.poster_path?`https://image.tmdb.org/t/p/w342${row.poster_path}`:'/flix2watch-logo-red-v34.png';
  const type=row.media_type==='tv'?'tv':'movie';
  host.className='f2w-current-watching-card';
  host.innerHTML=`<img src="${esc(poster)}" alt=""><div class="f2w-current-watching-copy"><strong>${esc(row.title||'Untitled')}</strong><span class="f2w-current-watching-live"><i class="fa-solid fa-circle"></i> Watching now</span><span id="f2w-v177-playback-clock" class="f2w-v177-playback-clock"></span><span class="f2w-v177-playback-source">${esc(type==='tv'?'TV Series':'Movie')}${row.source_key?' · '+esc(row.source_key):''}</span></div>`;
  host.onclick=()=>location.href=`/watch/?id=${encodeURIComponent(row.media_id)}&type=${type}`;host.style.cursor='pointer';paintClock();
}
async function refresh(){
  if(busy)return;const c=db(),u=username();if(!c?.rpc||!u)return;busy=true;
  try{const {data,error}=await c.rpc('get_public_current_watching_v177',{p_username:u});if(error)throw error;row=Array.isArray(data)?data[0]:data;render()}catch(e){console.warn('v177 profile playback unavailable:',e?.message||e)}finally{busy=false}
}
function start(){refresh();clearInterval(timer);timer=setInterval(paintClock,1000);setInterval(()=>{if(document.visibilityState==='visible')refresh()},30000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh()});
})();

// v177-force-refresh-2026-09-02
