(()=>{
'use strict';
if(window.__f2wV182ProfilePlayback)return;window.__f2wV182ProfilePlayback=true;
window.__f2wV177ProfilePlayback=true;
if(!location.pathname.startsWith('/profile'))return;

const $=s=>document.querySelector(s);
let row=null,clockTimer=0,pollTimer=0,busy=false,channel=null,subscribedUser='',posterHydratingKey='';
let bc=null;
try{bc=new BroadcastChannel('f2w-playback-v182')}catch{}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function db(){return window.f2wSupabase||window.chatSupabase||window.supabaseClient||null}
function username(){try{return decodeURIComponent((location.pathname.match(/@([^/?#]+)/)||[])[1]||new URLSearchParams(location.search).get('user')||'').replace(/^@/,'')}catch{return ''}}
function fmt(sec){sec=Math.max(0,Math.floor(Number(sec)||0));const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function status(){return String(row?.playback_status||'unknown').toLowerCase()}
function livePosition(){
  if(!row||row.position_seconds==null)return null;
  let p=Number(row.position_seconds)||0;
  const stamp=row.progress_updated_at?new Date(row.progress_updated_at).getTime():0;
  if(stamp&&status()==='playing')p+=(Date.now()-stamp)/1000;
  const d=Number(row.duration_seconds)||0;if(d>0)p=Math.min(p,d);return Math.max(0,p);
}
function clockText(){
  if(!row)return '';
  const st=status(),p=livePosition(),d=Number(row.duration_seconds)||0;
  if(st==='unknown'||p==null)return 'Live timestamp unavailable for this source';
  const time=`${fmt(p)}${d>0?' / '+fmt(d):''}`;
  if(st==='paused')return `Paused · ${time}`;
  if(st==='buffering')return `Buffering · ${time}`;
  if(st==='completed')return `Finished · ${time}`;
  if(st==='stopped')return `Stopped · ${time}`;
  return time;
}
function paintClock(){const el=$('#f2w-v177-playback-clock');if(el&&row)el.textContent=clockText()}
function render(){
  const host=$('#f2w-current-watching-card');if(!host)return;
  const seen=row?.last_seen_at?new Date(row.last_seen_at).getTime():0;
  if(!row?.media_id||!seen||Date.now()-seen>80000){
    host.className='f2w-current-watching-empty';host.innerHTML='Not watching anything right now.';host.onclick=null;host.style.cursor='';return;
  }
  const poster=row.poster_path?`https://image.tmdb.org/t/p/w342${row.poster_path}`:'/flix2watch-logo-red-v34.png';
  const type=row.media_type==='tv'?'tv':'movie';
  host.className='f2w-current-watching-card';
  host.innerHTML=`<img src="${esc(poster)}" alt="" onerror="this.onerror=null;this.src='/flix2watch-logo-red-v34.png'">
    <div class="f2w-current-watching-copy">
      <strong>${esc(row.title||'Untitled')}</strong>
      <span class="f2w-current-watching-live"><i class="fa-solid fa-circle"></i> Watching now</span>
      <span id="f2w-v177-playback-clock" class="f2w-v177-playback-clock"></span>
      <span class="f2w-v177-playback-source">${esc(type==='tv'?'TV Series':'Movie')}${row.source_key?' · '+esc(row.source_key):''}</span>
    </div>`;
  host.onclick=()=>location.href=`/watch/?id=${encodeURIComponent(row.media_id)}&type=${type}`;host.style.cursor='pointer';paintClock();
  if(!row.poster_path)void hydrateMissingPoster();
}
async function hydrateMissingPoster(){
  if(!row?.media_id||row.poster_path)return;
  const type=row.media_type==='tv'?'tv':'movie',key=`${type}:${row.media_id}`;
  if(posterHydratingKey===key)return;posterHydratingKey=key;
  try{
    const cached=sessionStorage.getItem(`f2w:v183:poster:${key}`)||sessionStorage.getItem(`f2w:v182:poster:${key}`);
    if(cached){row.poster_path=cached;render();return}
    const c=db();
    if(c?.rpc&&row?.user_id){
      try{const {data}=await c.rpc('get_profile_recent_views_v59',{p_user_id:row.user_id,p_limit:10});const hit=(Array.isArray(data)?data:[]).find(x=>String(x.media_id)===String(row.media_id)&&String(x.media_type||'movie')===type);if(hit?.poster_path){row.poster_path=hit.poster_path;try{sessionStorage.setItem(`f2w:v183:poster:${key}`,hit.poster_path)}catch{};render();return}}catch{}
    }
    const r=await fetch(`https://api.themoviedb.org/3/${type}/${encodeURIComponent(row.media_id)}?api_key=925c48dd6e24fd5e975fe224238bbb45`,{cache:'force-cache'});
    if(!r.ok)return;const data=await r.json();
    if(data?.poster_path){row.poster_path=data.poster_path;try{sessionStorage.setItem(`f2w:v183:poster:${key}`,data.poster_path)}catch{};render()}
  }catch{}finally{if(posterHydratingKey===key)posterHydratingKey=''}
}
function mergeRealtime(next){
  if(!next||!next.media_id)return;
  const prior=row||{};row={...prior,...next};
  if(!row.poster_path&&prior.poster_path)row.poster_path=prior.poster_path;
  render();
}
function bindRealtime(userId){
  const c=db();if(!c?.channel||!userId||subscribedUser===String(userId))return;
  try{if(channel)c.removeChannel(channel)}catch{}
  subscribedUser=String(userId);
  try{
    channel=c.channel(`v182-profile-playback-${subscribedUser}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'current_watching_v125',filter:`user_id=eq.${subscribedUser}`},payload=>{
        if(payload?.new)mergeRealtime(payload.new);
      })
      .subscribe();
  }catch(e){console.warn('v182 playback realtime unavailable:',e?.message||e)}
}
async function refresh(){
  if(busy)return;const c=db(),u=username();if(!c?.rpc||!u)return;busy=true;
  try{
    const {data,error}=await c.rpc('get_public_current_watching_v177',{p_username:u});if(error)throw error;
    row=Array.isArray(data)?data[0]:data;render();if(row?.user_id)bindRealtime(row.user_id);
  }catch(e){console.warn('v182 profile playback unavailable:',e?.message||e)}finally{busy=false}
}
function start(){
  refresh();
  clearInterval(clockTimer);clockTimer=setInterval(paintClock,1000);
  clearInterval(pollTimer);pollTimer=setInterval(()=>{if(document.visibilityState==='visible')refresh()},30000);
  if(bc){bc.onmessage=e=>{
    const data=e.data;if(!data||data.type!=='f2w-playback-v182')return;
    const c=db();
    Promise.resolve(c?.auth?.getSession?.()).then(res=>{
      const me=res?.data?.session?.user?.id;if(me&&row?.user_id&&String(me)===String(row.user_id))mergeRealtime({...data,user_id:me});
    }).catch(()=>{});
  }}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh()});
window.addEventListener('pagehide',()=>{try{const c=db();if(channel)c?.removeChannel?.(channel)}catch{};try{bc?.close()}catch{}});
})();
// f2w-force-save:v182-profile-playback-realtime-pause:20260902

// f2w-force-save:v183-profile-playback-poster-stability:20260902
