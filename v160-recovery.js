(()=>{
'use strict';
if(window.__f2wV162Recovery)return;window.__f2wV162Recovery=true;
const URL='https://viqufxlcxwgboyxbdhjb.supabase.co',KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
let client=null,notifyChannel=null,enforcementChannel=null,profileRoleChannel=null,enforcementUserId='',notifyUserId='',notifyTimer=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function db(){return client||(client=window.f2wSupabase||window.chatSupabase||window.supabaseClient||(window.supabase?.createClient?window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null))}
const timeout=(p,ms,msg='Request timed out')=>Promise.race([p,new Promise((_,r)=>setTimeout(()=>r(new Error(msg)),ms))]);
function setAuthHeader(session){
  const logged=!!session?.user;document.body?.classList.toggle('f2w-authenticated',logged);
  const login=document.getElementById('header-login-btn'),signup=document.getElementById('header-signup-btn'),account=document.getElementById('account-btn'),notify=document.getElementById('notification-wrap');
  if(login){login.hidden=logged;login.style.display=logged?'none':'flex'}
  if(signup){signup.hidden=logged;signup.style.display=logged?'none':'flex'}
  if(account){account.hidden=!logged;account.style.display=logged?'flex':'none'}
  if(notify){notify.hidden=!logged;notify.style.display=logged?'block':'none'}
  for(const id of ['favorites-nav-btn','profile-nav-btn','support-nav-btn']){const el=document.getElementById(id);if(el){el.hidden=false;el.style.display='flex'}}
  window.dispatchEvent(new CustomEvent('f2w:v160-auth-ui',{detail:{logged,user:session?.user||null}}));
}
function ensureChatDot(){
  document.querySelectorAll('body.f2w-main-page > header a[href^="/chat"],body.f2w-main-page > header .chat-button,body.f2w-main-page > header [onclick*="chat"]').forEach(btn=>{
    if(!btn.querySelector('.chat-online-dot,.f2w-v160-chat-dot')){const dot=document.createElement('span');dot.className='f2w-v160-chat-dot';dot.setAttribute('aria-hidden','true');btn.appendChild(dot)}
  });
  const header=document.querySelector('body.f2w-main-page > header');if(header){const actions=header.querySelector('.header-actions,.nav-actions,.top-actions,.header-right')||[...header.children].find(x=>x.querySelector?.('#favorites-nav-btn,#profile-nav-btn,#account-btn'));actions?.classList?.add('f2w-v160-actions-gap')}
}
function normalizeRed(root=document){
  const selectors=['.btn.primary','.btn.red','.account-primary','.hero-primary','.watch-primary','#account-submit','#forum-compose-submit','#forum-reply-submit','[data-new-thread]','.staff-role-toggle.active'];
  root.querySelectorAll?.(selectors.join(',')).forEach(x=>x.classList.add('f2w-red-v160'));
}
function fixAuthTabs(){
  const m=document.getElementById('account-modal');if(!m)return;
  const sync=()=>{const mode=m.dataset.v159Mode||m.dataset.mode||m.dataset.v160Mode||'login';m.dataset.v160Mode=mode;normalizeRed(m)};sync();
  new MutationObserver(sync).observe(m,{attributes:true,attributeFilter:['data-v159-mode','data-mode','class']});
}
function relative(v){const t=new Date(v).getTime(),ms=Math.max(0,Date.now()-t);if(!Number.isFinite(t))return'';if(ms<60000)return'just now';if(ms<3600000)return Math.floor(ms/60000)+'m ago';if(ms<86400000)return Math.floor(ms/3600000)+'h ago';return Math.floor(ms/86400000)+'d ago'}
async function loadNotifications(){
  const c=db(),list=document.getElementById('notification-list'),count=document.getElementById('notification-count');if(!c?.rpc||!list)return;
  try{const {data,error}=await timeout(c.rpc('get_my_notifications_v160',{p_limit:60}),2500,'Notifications timed out');if(error)throw error;const rows=Array.isArray(data)?data:[];const unread=rows.filter(n=>!n.read_at).length;if(count){count.textContent=String(unread);count.hidden=!unread}
    list.innerHTML=rows.length?rows.map(n=>`<a class="f2w-v160-notification ${n.read_at?'read':'unread'}" href="${esc(n.link||'#')}"><strong>${esc(n.title||'Notification')}</strong><span>${esc(n.message||'')}</span><small>${esc(relative(n.created_at))}</small></a>`).join(''):'<div class="v17-notification-empty">No notifications yet.</div>';
  }catch(e){console.warn('v160 notification load',e);list.innerHTML='<div class="v17-notification-empty">Could not refresh notifications. Tap Notifications to retry.</div>'}
}
async function bindNotifications(session){
  const c=db(),uid=session?.user?.id||'';if(!c)return;
  if(notifyChannel){try{c.removeChannel(notifyChannel)}catch{}notifyChannel=null}notifyUserId=uid;clearInterval(notifyTimer);
  if(!uid)return;
  try{notifyChannel=c.channel('f2w-v160-notify-'+uid).on('postgres_changes',{event:'INSERT',schema:'public',table:'f2w_notifications_v125',filter:`user_id=eq.${uid}`},()=>loadNotifications()).on('postgres_changes',{event:'UPDATE',schema:'public',table:'f2w_notifications_v125',filter:`user_id=eq.${uid}`},()=>loadNotifications()).subscribe()}catch{}
  loadNotifications();notifyTimer=setInterval(()=>{const menu=document.getElementById('notification-menu');if(document.visibilityState==='visible'&&menu&&!menu.hidden)loadNotifications()},30000);
}
window.toggleNotifications=function(e){e?.preventDefault?.();e?.stopPropagation?.();const menu=document.getElementById('notification-menu');if(!menu)return;menu.hidden=!menu.hidden;if(!menu.hidden)loadNotifications()};
window.markAllNotificationsRead=async function(){const c=db();if(!c?.rpc)return;try{await c.rpc('mark_my_notifications_read_v160');await loadNotifications()}catch{}};
function enforcementCacheKey(uid){return `f2w_enforcement_v162:${String(uid||'')}`}
function readCachedEnforcement(uid){
  if(!uid)return null;
  try{const raw=localStorage.getItem(enforcementCacheKey(uid));if(!raw)return null;const v=JSON.parse(raw);if(!v||String(v.user_id||'')!==String(uid))return null;return v}catch{return null}
}
function writeCachedEnforcement(uid,state){
  if(!uid)return;
  try{
    if(state?.site_suspended||state?.account_banned)localStorage.setItem(enforcementCacheKey(uid),JSON.stringify({...state,user_id:uid,_cached_at:Date.now()}));
    else localStorage.removeItem(enforcementCacheKey(uid));
  }catch{}
}
function removeLegacyEnforcement(){
  for(const id of ['f2w-v146-enforcement','f2w-v159-enforcement']){const x=document.getElementById(id);if(x)x.remove()}
  document.querySelectorAll('.f2w-enforcement-overlay,[data-f2w-enforcement]').forEach(x=>{if(x.id!=='f2w-v160-enforcement')x.remove()});
  document.body?.style?.removeProperty('filter');
}
function enforcementOverlay(){
  let el=document.getElementById('f2w-v160-enforcement');
  if(el)return el;
  el=document.createElement('div');el.id='f2w-v160-enforcement';el.setAttribute('role','alertdialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-live','assertive');el.hidden=true;
  el.innerHTML='<div class="panel" tabindex="-1"><div class="icon">!</div><div class="eyebrow">FLIX2WATCH ACCESS NOTICE</div><h1></h1><p></p><small class="hint">This restriction updates automatically. You do not need to refresh.</small></div>';
  document.body.appendChild(el);return el
}
function clearEnforcement(uid=''){
  const el=document.getElementById('f2w-v160-enforcement');if(el){el.classList.remove('show');el.hidden=true}
  removeLegacyEnforcement();
  document.documentElement.classList.remove('f2w-enforced');document.body?.classList.remove('f2w-enforced-body');
  if(uid)writeCachedEnforcement(uid,{site_suspended:false,account_banned:false});
  try{document.documentElement.style.removeProperty('overflow');document.body?.style.removeProperty('overflow')}catch{}
  window.__flix2watchAccountState={banned:false,site_suspended:false,account_banned:false,user_id:uid||null};
  window.dispatchEvent(new CustomEvent('flix2watch:enforcement-cleared'));
}
function stopPlayback(){
  try{if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{})}catch{}
  document.querySelectorAll('video,audio').forEach(v=>{try{v.pause()}catch{}});
  document.querySelectorAll('iframe').forEach(f=>{if(/player\.flix2watch\.com|vidsrc|vidcore|ezvid|movie-src|vidlink|embed/i.test(f.src||'')){try{f.src='about:blank'}catch{}}});
}
function applyEnforcement(uid,state,{realtime=false,cached=false}={}){
  if(String(state?.user_id||uid)!==String(uid)){clearEnforcement(uid);return false}
  const active=!!(state?.site_suspended||state?.account_banned);
  window.__flix2watchAccountGuardReady=true;window.__flix2watchAccountState={...state,user_id:uid,banned:active};
  if(!active){clearEnforcement(uid);return false}
  writeCachedEnforcement(uid,state);removeLegacyEnforcement();stopPlayback();
  const el=enforcementOverlay();el.hidden=false;el.classList.add('show');
  el.querySelector('h1').textContent=state.account_banned?'Account login banned':'Site access suspended';
  el.querySelector('p').textContent=state.reason||'Staff have temporarily suspended access to Flix2Watch for this account.';
  document.documentElement.classList.add('f2w-enforced');document.body?.classList.add('f2w-enforced-body');
  try{document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';document.activeElement?.blur?.();el.querySelector('.panel')?.focus({preventScroll:true})}catch{}
  if(realtime&&!cached){try{el.querySelector('.panel')?.animate([{transform:'scale(.97)',opacity:.6},{transform:'scale(1)',opacity:1}],{duration:170,easing:'ease-out'})}catch{}}
  window.dispatchEvent(new CustomEvent('flix2watch:enforcement-active',{detail:window.__flix2watchAccountState}));return true
}
async function refreshEnforcement(session,{realtime=false}={}){
  const c=db(),uid=session?.user?.id||'';if(!uid){clearEnforcement();return}
  try{
    const {data,error}=await timeout(c.rpc('get_my_account_enforcement_v160'),2200);if(error)throw error;const state=data||{};
    if(String(state.user_id||'')&&String(state.user_id)!==String(uid)){clearEnforcement(uid);return}
    applyEnforcement(uid,state,{realtime});
  }catch(e){
    console.warn('v162 enforcement refresh',e);
    // Fail closed only when this exact signed-in account already has a cached active restriction.
    const cached=readCachedEnforcement(uid);if(cached?.site_suspended||cached?.account_banned)applyEnforcement(uid,cached,{cached:true});
  }
}
async function bindEnforcement(session){
  const c=db(),uid=session?.user?.id||'';
  if(enforcementChannel){try{c?.removeChannel(enforcementChannel)}catch{}enforcementChannel=null}
  enforcementUserId=uid;
  if(!uid){clearEnforcement();return}
  // Make a refresh/navigation remain blocked instantly for an already-suspended account.
  const cached=readCachedEnforcement(uid);if(cached?.site_suspended||cached?.account_banned)applyEnforcement(uid,cached,{cached:true});else clearEnforcement(uid);
  await refreshEnforcement(session);
  try{enforcementChannel=c.channel('f2w-v162-enforce-'+uid).on('postgres_changes',{event:'*',schema:'public',table:'account_enforcement_v146',filter:`user_id=eq.${uid}`},payload=>{
    const row=payload?.new||payload?.old||null;
    if(row&&String(row.user_id||'')!==String(uid))return;
    c.auth.getSession().then(({data})=>refreshEnforcement(data?.session||null,{realtime:true}));
  }).subscribe()}catch{}
}
function blockWhileEnforced(e){
  if(!document.documentElement.classList.contains('f2w-enforced'))return;
  const overlay=document.getElementById('f2w-v160-enforcement');if(overlay?.contains(e.target))return;
  e.preventDefault();e.stopImmediatePropagation();
}
for(const evt of ['click','pointerdown','mousedown','touchstart','submit','keydown'])document.addEventListener(evt,blockWhileEnforced,true);

async function bindViewedProfileRoleRealtime(){
  if(!location.pathname.startsWith('/profile/'))return;
  const c=db();if(!c?.rpc||!c?.channel)return;
  const m=location.pathname.match(/^\/profile\/@([A-Za-z0-9]+)\/?$/);const q=new URLSearchParams(location.search).get('user');const username=(m?.[1]||q||'').replace(/[^A-Za-z0-9]/g,'');if(!username)return;
  try{const {data,error}=await c.rpc('get_public_profile_v160',{p_username:username});if(error||!data?.user_id)return;const uid=data.user_id;
    if(profileRoleChannel){try{c.removeChannel(profileRoleChannel)}catch{}profileRoleChannel=null}
    profileRoleChannel=c.channel('f2w-v160-profile-role-'+uid).on('postgres_changes',{event:'*',schema:'public',table:'profile_role_assignments',filter:`user_id=eq.${uid}`},()=>{
      try{localStorage.removeItem(`f2w_profile_role_v110:${username.toLowerCase()}`)}catch{}
      try{window.refreshPublicProfileRoleBadge?.()}catch{}
      try{window.loadViewedProfileRoleBadge?.()}catch{}
    }).subscribe();
  }catch{}
}

function fixSocial(){
  const modal=document.getElementById('social-modal');if(!modal)return;modal.style.backdropFilter='none';
  const old=window.openSocialList;if(typeof old==='function'&&!old.__v160){window.openSocialList=async function(type){try{return await old(type)}catch(e){console.warn(e)}};window.openSocialList.__v160=true}
}
function forumIcons(){if(!location.pathname.startsWith('/forum'))return;const svg=(d)=>`<svg class="forum-v159-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;const map=[[/new discussion|start a thread/i,'M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4z'],[/browse titles/i,'M3 5h18v14H3V5zm3 3h4v8H6V8zm8 0h4v8h-4V8z'],[/rankings/i,'M7 3h10v3h4v3c0 3-2 5-5 5h-1v3h3v2H6v-2h3v-3H8c-3 0-5-2-5-5V6h4V3z'],[/my profile/i,'M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0H5z']];document.querySelectorAll('button,a').forEach(el=>{const t=(el.textContent||'').trim();for(const [re,d] of map){if(re.test(t)){el.querySelectorAll('i[class*="fa-"]').forEach(i=>i.remove());if(!el.querySelector('svg.forum-v159-icon'))el.insertAdjacentHTML('afterbegin',svg(d));break}}})}
async function sync(session){setAuthHeader(session);ensureChatDot();normalizeRed();fixAuthTabs();fixSocial();forumIcons();await Promise.allSettled([bindNotifications(session),bindEnforcement(session),bindViewedProfileRoleRealtime()])}
async function boot(){const c=db();if(!c?.auth)return;let session=null;try{session=(await timeout(c.auth.getSession(),1800)).data?.session||null}catch{}await sync(session);c.auth.onAuthStateChange?.((_e,s)=>{clearEnforcement();setTimeout(()=>sync(s),0)});const mo=new MutationObserver(m=>{ensureChatDot();normalizeRed();fixAuthTabs();forumIcons()});mo.observe(document.documentElement,{subtree:true,childList:true});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')c.auth.getSession().then(({data})=>{setAuthHeader(data?.session||null);refreshEnforcement(data?.session||null)})},{passive:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
