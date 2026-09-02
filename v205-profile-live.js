(()=>{
'use strict';
if(window.__f2wV205ProfileLiveStarted)return;
window.__f2wV205ProfileLiveStarted=true;
window.__f2wV205ProfileLiveAuthority=true;
if(!location.pathname.startsWith('/profile'))return;

const URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
const KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
let supa=null,snapshot=null,receivedAt=0,poll=0,tick=0,channel=null,busy=false,currentUid='';
function db(){return supa||(supa=window.f2wSupabase||window.chatSupabase||window.supabaseClient||(window.supabase?.createClient?window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null))}
function username(){const m=location.pathname.match(/^\/profile\/@([A-Za-z0-9]+)\/?$/);return (m?.[1]||new URLSearchParams(location.search).get('user')||'').replace(/[^A-Za-z0-9]/g,'')}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function rel(ts){const t=new Date(ts).getTime();if(!Number.isFinite(t)||t<=0)return 'not recorded yet';const s=Math.max(0,Math.floor((Date.now()-t)/1000));if(s<15)return 'just now';if(s<60)return `${s} seconds ago`;const m=Math.floor(s/60);if(m<60)return `${m} minute${m===1?'':'s'} ago`;const h=Math.floor(m/60);if(h<24)return `${h} hour${h===1?'':'s'} ago`;const d=Math.floor(h/24);return `${d} day${d===1?'':'s'} ago`}
function fmt(v){let n=Math.max(0,Math.floor(Number(v)||0));const h=Math.floor(n/3600),m=Math.floor((n%3600)/60),s=n%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`}
function status(v){v=String(v||'unknown').toLowerCase();if(v==='seeked')return 'playing';return ['playing','paused','buffering','completed','stopped'].includes(v)?v:'unknown'}
function stateLabel(v){return v==='playing'?'Playing':v==='paused'?'Paused':v==='buffering'?'Buffering':v==='completed'?'Finished':v==='stopped'?'Stopped':'Live'}
function stateIcon(v){return v==='paused'?'fa-pause':v==='buffering'?'fa-spinner fa-spin':v==='completed'?'fa-check':'fa-play'}
function paintPresence(){const badge=document.getElementById('v17-profile-presence');if(!badge||!snapshot)return;const label=badge.querySelector('span');const on=Boolean(snapshot.online);badge.classList.toggle('online',on);badge.classList.toggle('offline',!on);if(label)label.textContent=on?'Online':`Last online ${rel(snapshot.last_seen_at)}`}
function position(){if(!snapshot||snapshot.watching_position_seconds==null)return null;let p=Math.max(0,Number(snapshot.watching_position_seconds)||0);const st=status(snapshot.watching_playback_status);if(st==='playing'){
  const base=snapshot.watching_progress_updated_at?new Date(snapshot.watching_progress_updated_at).getTime():receivedAt;
  if(Number.isFinite(base)&&base>0)p+=Math.max(0,(Date.now()-base)/1000);
}
const d=Math.max(0,Number(snapshot.watching_duration_seconds)||0);return d?Math.min(p,d):p}
function hasWatch(){return Boolean(snapshot?.watching_media_id)}
function paintWatch(full=false){const host=document.getElementById('f2w-current-watching-card');if(!host)return;if(!hasWatch()){
  host.className='f2w-current-watching-empty';host.removeAttribute('data-v205-live');host.innerHTML='Not watching anything right now.';host.onclick=null;host.style.cursor='';return;
}
const st=status(snapshot.watching_playback_status),dur=Math.max(0,Number(snapshot.watching_duration_seconds)||0),pos=position();
if(full||host.dataset.v205Live!=='1'){
  const poster=snapshot.watching_poster_path?`https://image.tmdb.org/t/p/w342${String(snapshot.watching_poster_path).replace(/^https?:\/\/image\.tmdb\.org\/t\/p\/[^/]+/i,'')}`:'/flix2watch-logo-red-v34.png';
  const type=snapshot.watching_media_type==='tv'?'tv':'movie';
  host.className='f2w-current-watching-card';host.dataset.v205Live='1';host.innerHTML=`<img src="${esc(poster)}" alt="${esc(snapshot.watching_title||'Currently watching')} poster" onerror="this.src='/flix2watch-logo-red-v34.png'"><div class="f2w-current-watching-copy"><strong>${esc(snapshot.watching_title||'Untitled')}</strong><span class="f2w-current-watching-live"><i class="fa-solid fa-circle"></i> Watching now</span><div class="f2w-v201-progress"><span class="f2w-v201-clock"></span><span class="f2w-v201-state"></span></div>${snapshot.watching_source_key?`<span class="f2w-v201-source">Source: ${esc(snapshot.watching_source_key)}</span>`:''}</div>`;
  host.onclick=()=>location.href=`/watch/?id=${encodeURIComponent(snapshot.watching_media_id)}&type=${type}`;host.style.cursor='pointer';
}
const clock=host.querySelector('.f2w-v201-clock'),badge=host.querySelector('.f2w-v201-state');
if(clock)clock.textContent=pos==null?(dur?`— / ${fmt(dur)}`:'Timestamp unavailable'):`${fmt(pos)}${dur?` / ${fmt(dur)}`:''}`;
if(badge){badge.className=`f2w-v201-state ${st}`;badge.innerHTML=`<i class="fa-solid ${stateIcon(st)}"></i> ${stateLabel(st)}`}
}
function paint(full=false){paintPresence();paintWatch(full)}
function bindRealtime(){const c=db(),uid=String(snapshot?.user_id||'');if(!c?.channel||!uid||uid===currentUid)return;currentUid=uid;if(channel){try{c.removeChannel(channel)}catch{}channel=null}
try{channel=c.channel('f2w-v205-profile-live-'+uid)
.on('postgres_changes',{event:'*',schema:'public',table:'user_presence',filter:`user_id=eq.${uid}`},()=>setTimeout(fetchLive,30))
.on('postgres_changes',{event:'*',schema:'public',table:'current_watching_v125',filter:`user_id=eq.${uid}`},()=>setTimeout(fetchLive,30))
.subscribe()}catch{}}
async function fetchLive(){if(busy)return;const c=db(),u=username();if(!c?.rpc||!u)return;busy=true;try{const {data,error}=await c.rpc('get_public_profile_live_v205',{p_username:u});if(error)throw error;const row=Array.isArray(data)?data[0]:data;snapshot=row||{user_id:null,last_seen_at:null,online:false};receivedAt=Date.now();paint(true);bindRealtime()}catch(e){console.warn('v205 live profile unavailable:',e?.message||e)}finally{busy=false}}
function start(){fetchLive();clearInterval(poll);poll=setInterval(fetchLive,10000);clearInterval(tick);tick=setInterval(()=>paint(false),1000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')fetchLive()});window.addEventListener('focus',fetchLive,{passive:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
// f2w-force-save:v205-profile-live-authority:20260902
