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

async function bounded(run,ms,label){
  let timer=0;
  try{
    return await Promise.race([
      Promise.resolve().then(run),
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' timed out')),ms)})
    ]);
  }finally{clearTimeout(timer)}
}
function profileStillLoading(){
  const n=document.getElementById('profile-name')?.textContent?.trim()||'';
  const b=document.getElementById('profile-bio')?.textContent?.trim()||'';
  return /^(loading\.{0,3}|profile unavailable)$/i.test(n)||/^loading profile\.{0,3}$/i.test(b);
}
function markProfileUnavailable(){
  if(!profileStillLoading())return;
  const n=document.getElementById('profile-name');
  const b=document.getElementById('profile-bio');
  const g=document.getElementById('profile-favorites-grid');
  if(n)n.textContent='Profile unavailable';
  if(b){b.textContent='This profile is taking longer than expected to load. Please try again.';b.classList.add('empty')}
  if(g){
    g.innerHTML='<div class="profile-state">Profile data is temporarily unavailable. <button type="button" id="f2w-profile-recovery-retry" style="margin:10px auto 0;padding:8px 12px;border:1px solid rgba(255,255,255,.2);border-radius:8px;background:#18181b;color:#fff;cursor:pointer">Try again</button></div>';
    document.getElementById('f2w-profile-recovery-retry')?.addEventListener('click',()=>location.reload(),{once:true});
  }
}
async function queryProfile(run,label){
  const result=await bounded(run,6000,label);
  if(result?.error)throw result.error;
  const row=Array.isArray(result?.data)?result.data[0]:result?.data;
  if(!row)throw new Error(label+' returned no profile');
  return row;
}
async function recoverStuckProfile(){
  const u=username(),c=db();
  if(!u||!c?.rpc||!profileStillLoading())return;
  const key=u.toLowerCase();
  if(window.__f2wProfileRecoveryAttempted===key)return;
  window.__f2wProfileRecoveryAttempted=key;
  let profile=null;
  try{
    // Race the public RPC against the legacy public-table path. This runs only
    // when the normal profile renderer has left its initial placeholders on screen.
    profile=await Promise.any([
      queryProfile(()=>c.rpc('get_public_profile_v160',{p_username:u}),'Public profile RPC'),
      queryProfile(()=>c.from('profiles').select('*').ilike('username',u).maybeSingle(),'Public profile fallback')
    ]);
  }catch(error){
    console.warn('Profile recovery failed:',error?.message||error);
    markProfileUnavailable();
    return;
  }
  if(!profileStillLoading())return;
  const normalized={
    ...profile,
    username:String(profile.username||u).replace(/^@/,''),
    display_name:profile.display_name??null,
    bio:profile.bio??'',
    avatar_url:profile.avatar_url??null,
    is_private:Boolean(profile.is_private),
    favorite_genres:profile.favorite_genres??[],
    website_url:profile.website_url??'',
    instagram_username:profile.instagram_username??'',
    discord_username:profile.discord_username??'',
    snapchat_username:profile.snapchat_username??'',
    reddit_username:profile.reddit_username??'',
    steam_profile:profile.steam_profile??'',
    tiktok_username:profile.tiktok_username??'',
    letterboxd_username:profile.letterboxd_username??'',
    status_text:profile.status_text??'',
    pronouns:profile.pronouns??'',
    favorite_movie_text:profile.favorite_movie_text??'',
    favorite_movie_tmdb_id:profile.favorite_movie_tmdb_id??null,
    favorite_movie_poster_path:profile.favorite_movie_poster_path??'',
    favorite_tv_text:profile.favorite_tv_text??'',
    profile_quote:profile.profile_quote??''
  };
  try{if(typeof viewedProfile!=='undefined')viewedProfile=normalized}catch{}
  try{if(typeof f2wProfileResolvedUsername!=='undefined')f2wProfileResolvedUsername=key}catch{}
  try{if(typeof f2wProfilePendingUsername!=='undefined')f2wProfilePendingUsername=''}catch{}
  try{if(typeof renderViewedProfile==='function')renderViewedProfile()}catch(error){console.warn('Profile fallback render:',error?.message||error)}
  const displayName=String(normalized.display_name||'').trim()||'@'+normalized.username;
  const nameEl=document.getElementById('profile-name');
  const usernameEl=document.getElementById('profile-username-line');
  const bioEl=document.getElementById('profile-bio');
  if(nameEl&&/^loading/i.test(nameEl.textContent.trim()))nameEl.textContent=displayName;
  if(usernameEl&&!usernameEl.textContent.trim())usernameEl.textContent='@'+normalized.username;
  if(bioEl&&/^loading profile/i.test(bioEl.textContent.trim())){bioEl.textContent=String(normalized.bio||'').trim()||'No bio yet.';bioEl.classList.toggle('empty',!String(normalized.bio||'').trim())}
  const avatar=document.getElementById('profile-avatar'),fallback=document.getElementById('profile-avatar-fallback');
  if(normalized.avatar_url&&avatar){avatar.src=normalized.avatar_url;avatar.alt=displayName+' avatar';avatar.style.display='block';if(fallback)fallback.style.display='none'}
  else if(fallback){fallback.textContent=(normalized.username||'?').slice(0,2).toUpperCase();fallback.style.display='grid'}
  if(normalized.created_at){
    const joined=document.getElementById('profile-joined');
    if(joined)joined.textContent='Joined '+new Date(normalized.created_at).toLocaleDateString(undefined,{year:'numeric',month:'short'});
  }
  try{
    const cacheKey='f2w_profile_cache_v24:'+key;
    const old=JSON.parse(localStorage.getItem(cacheKey)||'null');
    const cached=Array.isArray(old?.favorites)?old.favorites:[];
    if(typeof viewedProfileFavorites!=='undefined')viewedProfileFavorites=cached;
    localStorage.setItem('f2w_profile_username_v24',normalized.username);
    localStorage.setItem(cacheKey,JSON.stringify({profile:normalized,favorites:cached,savedAt:Date.now()}));
    if(cached.length&&typeof renderViewedFavorites==='function')renderViewedFavorites();
  }catch{}
  try{if(typeof loadViewedProfileRoleBadge==='function')void loadViewedProfileRoleBadge()}catch{}
  try{if(typeof loadProfileSocial==='function')void loadProfileSocial()}catch{}
  try{if(typeof loadAge==='function')void loadAge()}catch{}
  const grid=document.getElementById('profile-favorites-grid');
  if(normalized.is_private){
    try{if(typeof renderViewedFavorites==='function')renderViewedFavorites()}catch{}
    return;
  }
  try{
    const result=await bounded(()=>c.rpc('get_public_profile_favorites_v228',{p_username:normalized.username}),6000,'Public favorites');
    if(result?.error)throw result.error;
    const favorites=Array.isArray(result?.data)?result.data:[];
    try{if(typeof viewedProfileFavorites!=='undefined')viewedProfileFavorites=favorites}catch{}
    if(typeof renderViewedFavorites==='function'){
      try{renderViewedFavorites()}catch{}
    }
    const favoriteCount=document.getElementById('profile-favorite-count');
    if(favoriteCount)favoriteCount.textContent=favorites.length+' favorite'+(favorites.length===1?'':'s');
    const movies=favorites.filter(x=>x.media_type==='movie').length;
    const tv=favorites.filter(x=>x.media_type==='tv').length;
    const totalEl=document.getElementById('profile-stat-total'),movieEl=document.getElementById('profile-stat-movies'),tvEl=document.getElementById('profile-stat-tv');
    if(totalEl)totalEl.textContent=String(favorites.length);
    if(movieEl)movieEl.textContent=String(movies);
    if(tvEl)tvEl.textContent=String(tv);
    if(grid&&/^loading favorites/i.test(grid.textContent.trim())){
      grid.innerHTML=favorites.length?favorites.map(item=>{
        const title=esc(item.title||'Untitled');
        const poster=item.poster_path?'https://image.tmdb.org/t/p/w500'+item.poster_path:'/flix2watch-logo-red-v34.png';
        return '<article class="profile-fav-card" onclick="window.location.href=\'/watch/?id='+encodeURIComponent(item.media_id)+'&type='+encodeURIComponent(item.media_type)+'\'"><div class="profile-fav-poster-shell"><img class="profile-fav-poster" src="'+esc(poster)+'" alt="'+title+' poster" loading="lazy"></div><div class="profile-fav-title">'+title+'</div><div class="profile-fav-type">'+(item.media_type==='tv'?'TV SERIES':'MOVIE')+'</div></article>';
      }).join(''):'<div class="profile-state">No public favorites yet.</div>';
    }
    try{
      localStorage.setItem('f2w_profile_cache_v24:'+key,JSON.stringify({profile:normalized,favorites,savedAt:Date.now()}));
    }catch{}
    try{if(typeof updateViewedProfileStats==='function')updateViewedProfileStats()}catch{}
  }catch(error){
    console.warn('Profile favorites recovery failed:',error?.message||error);
    if(grid&&/^loading favorites/i.test(grid.textContent.trim()))grid.innerHTML='<div class="profile-state">Favorites are temporarily unavailable. Please try again shortly.</div>';
  }
}

function start(){
  fetchLive();
  setTimeout(()=>{if(profileStillLoading())void recoverStuckProfile()},8500);
  clearInterval(poll);
  poll=setInterval(()=>{if(document.visibilityState==='visible')fetchLive()},30000);
  clearInterval(tick);
  tick=setInterval(()=>paint(false),1000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')fetchLive()});
  window.addEventListener('focus',()=>{if(!snapshot||Date.now()-receivedAt>120000)fetchLive()},{passive:true});
  window.addEventListener('pagehide',()=>{clearInterval(poll);clearInterval(tick);try{if(channel)db()?.removeChannel?.(channel)}catch{}},{passive:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
// f2w-force-save:v205-profile-live-authority:20260902

// f2w-force-save:v224-profile-live-realtime-plus-30s-fallback:20260903
