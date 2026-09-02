(()=>{
'use strict';
if(window.__f2wV201Enforcement)return;window.__f2wV201Enforcement=true;
window.__f2wV165Enforcement=true;
const URL='https://viqufxlcxwgboyxbdhjb.supabase.co',KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
let client=null,notifyChannel=null,enforcementChannel=null,profileRoleChannel=null,enforcementUserId='',notifyUserId='',notifyTimer=0,enforcementTimer=0;
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
function relative(v){return ''}
async function loadNotifications(){}
async function bindNotifications(){}
function enforcementCacheKey(uid){return `f2w_enforcement_v165:${String(uid||'')}`}
function legacyEnforcementKeys(uid){return [`f2w_enforcement_v162:${String(uid||'')}`,`f2w_enforcement_v160:${String(uid||'')}`,`f2w_enforcement_v159:${String(uid||'')}`,`f2w_enforcement_v146:${String(uid||'')}`]}
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
  for(const id of ['f2w-v146-enforcement','f2w-v159-enforcement','f2w-v160-enforcement','v35-account-ban']){const x=document.getElementById(id);if(x)x.remove()}
  document.querySelectorAll('.f2w-enforcement-overlay,[data-f2w-enforcement]').forEach(x=>{x.remove()});
}
function scrubEnforcementVisuals(uid=''){
  removeLegacyEnforcement();
  document.documentElement.classList.remove('f2w-enforced','f2w-site-suspended','f2w-account-banned','site-suspended','account-banned');
  document.body?.classList.remove('f2w-enforced-body','f2w-enforced','f2w-site-suspended','f2w-account-banned','site-suspended','account-banned');
  for(const el of [document.documentElement,document.body]){if(!el)continue;for(const prop of ['filter','backdrop-filter','-webkit-backdrop-filter','pointer-events','user-select'])el.style.removeProperty(prop);el.style.removeProperty('overflow')}
  if(uid){try{for(const k of legacyEnforcementKeys(uid))localStorage.removeItem(k)}catch{}}
}
function ensureEnforcementStyle(){
  if(document.getElementById('f2w-v201-enforcement-style'))return;
  const st=document.createElement('style');st.id='f2w-v201-enforcement-style';st.textContent=`
#f2w-v165-enforcement{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;margin:0!important;padding:20px!important;border:0!important;background:rgba(0,0,0,.72)!important;backdrop-filter:blur(18px)!important;-webkit-backdrop-filter:blur(18px)!important;z-index:2147483647!important;place-items:center!important;overflow:auto!important;color:#fff!important}
#f2w-v165-enforcement[open]{display:grid!important}
#f2w-v165-enforcement .panel{width:min(560px,calc(100vw - 40px))!important;max-height:calc(100dvh - 40px)!important;overflow:auto!important;background:#07111e!important;border:1px solid rgba(255,35,62,.55)!important;border-radius:18px!important;padding:28px!important;box-shadow:0 28px 90px rgba(0,0,0,.72),0 0 42px rgba(229,9,20,.22)!important;color:#fff!important;outline:none!important}
#f2w-v165-enforcement h1,#f2w-v165-enforcement p,#f2w-v165-enforcement small{color:#fff!important}
#f2w-v165-enforcement .actions{display:flex!important;gap:10px!important;flex-wrap:wrap!important;margin-top:20px!important}
#f2w-v165-enforcement .actions a,#f2w-v165-enforcement .actions button{pointer-events:auto!important}
`;
  document.head.appendChild(st);
}
function enforcementOverlay(){
  ensureEnforcementStyle();
  let el=document.getElementById('f2w-v165-enforcement');
  if(el)return el;
  el=document.createElement('dialog');el.id='f2w-v165-enforcement';el.setAttribute('role','alertdialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-live','assertive');el.hidden=true;
  el.innerHTML='<div class="panel" tabindex="-1"><div class="icon">!</div><div class="eyebrow">FLIX2WATCH ACCESS NOTICE</div><h1></h1><p></p><div class="actions"><a class="support" href="/support/">Support</a><button class="logout" type="button">Log Out</button></div><small class="hint">This restriction updates automatically. You do not need to refresh.</small></div>';
  el.querySelector('.logout')?.addEventListener('click',async()=>{try{await db()?.auth?.signOut?.({scope:'local'})}catch{}try{localStorage.removeItem(enforcementCacheKey(enforcementUserId))}catch{}location.replace('/home/')});
  document.body.appendChild(el);return el
}
function clearEnforcement(uid=''){
  const el=document.getElementById('f2w-v165-enforcement');if(el){try{if(el.open)el.close()}catch{}el.remove()}
  scrubEnforcementVisuals(uid);
  if(uid)writeCachedEnforcement(uid,{site_suspended:false,account_banned:false});
  window.__flix2watchAccountState={banned:false,site_suspended:false,account_banned:false,user_id:uid||null};
  try{enforcementBus?.postMessage({user_id:uid,active:false})}catch{}window.dispatchEvent(new CustomEvent('flix2watch:enforcement-cleared'));
}
function stopPlayback(){
  try{
    const exit=document.exitFullscreen||document.webkitExitFullscreen||document.mozCancelFullScreen||document.msExitFullscreen;
    if((document.fullscreenElement||document.webkitFullscreenElement||document.mozFullScreenElement||document.msFullscreenElement)&&exit){
      try{const r=exit.call(document);r?.catch?.(()=>{})}catch{}
    }
  }catch{}
  try{
    document.documentElement.classList.remove('flix-viewport-fullscreen-open');
    document.body?.classList.remove('flix-viewport-fullscreen-open');
    document.querySelectorAll('.flix-viewport-fullscreen,.flix-fullscreen-active').forEach(el=>el.classList.remove('flix-viewport-fullscreen','flix-fullscreen-active'));
  }catch{}
  document.querySelectorAll('video,audio').forEach(v=>{try{v.pause()}catch{}});
  document.querySelectorAll('iframe').forEach(f=>{if(/player\.flix2watch\.com|vidsrc|vidcore|ezvid|movie-src|vidlink|embed/i.test(f.src||'')){try{f.src='about:blank'}catch{}}});
}
function applyEnforcement(uid,state,{realtime=false,cached=false}={}){
  if(String(state?.user_id||uid)!==String(uid)){clearEnforcement(uid);return false}
  const supportExempt=location.pathname.startsWith('/support')&&!!(state?.site_suspended||state?.account_banned);
  if(supportExempt){scrubEnforcementVisuals();window.__flix2watchAccountGuardReady=true;window.__flix2watchAccountState={...state,user_id:uid,banned:false,support_exempt:true};writeCachedEnforcement(uid,state);return false}
  const active=!!(state?.site_suspended||state?.account_banned);
  window.__flix2watchAccountGuardReady=true;window.__flix2watchAccountState={...state,user_id:uid,banned:active};
  if(!active){clearEnforcement(uid);return false}
  writeCachedEnforcement(uid,state);
  const kind=state.account_banned?'account-ban':'site-suspension';
  const reason=state.reason||(state.account_banned?'This account has been banned. Please contact Support if you believe this is a mistake.':'Your access to Flix2Watch has been suspended. Please contact Support if you need help.');
  let el=document.getElementById('f2w-v165-enforcement');
  const same=!!(el&&el.open&&el.dataset.kind===kind&&el.dataset.reason===reason);
  if(!same){scrubEnforcementVisuals();stopPlayback();el=enforcementOverlay();el.hidden=false;el.classList.add('show');try{if(!el.open)el.showModal()}catch{}}
  el.querySelector('h1').textContent=state.account_banned?'Account banned':'Account suspended';
  el.querySelector('p').textContent=reason;
  el.dataset.kind=kind;el.dataset.reason=reason;
  document.documentElement.classList.add('f2w-enforced');document.body?.classList.add('f2w-enforced-body');
  try{document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';document.activeElement?.blur?.();el.querySelector('.panel')?.focus({preventScroll:true})}catch{}
  if(realtime&&!cached){try{el.querySelector('.panel')?.animate([{transform:'scale(.97)',opacity:.6},{transform:'scale(1)',opacity:1}],{duration:170,easing:'ease-out'})}catch{}}
  try{enforcementBus?.postMessage({user_id:uid,active:true,state:window.__flix2watchAccountState})}catch{}window.dispatchEvent(new CustomEvent('flix2watch:enforcement-active',{detail:window.__flix2watchAccountState}));return true
}
async function refreshEnforcement(session,{realtime=false}={}){
  const c=db(),uid=session?.user?.id||'';if(!uid){clearEnforcement();return}
  try{
    const {data,error}=await timeout(c.rpc('get_my_account_enforcement_v160'),2200);if(error)throw error;const state=data||{};
    if(String(state.user_id||'')&&String(state.user_id)!==String(uid)){clearEnforcement(uid);return}
    applyEnforcement(uid,state,{realtime});
  }catch(e){
    console.warn('v165 enforcement refresh',e);
    // Fail closed only when this exact signed-in account already has a cached active restriction.
    const cached=readCachedEnforcement(uid);if(cached?.site_suspended||cached?.account_banned)applyEnforcement(uid,cached,{cached:true});
  }
}
async function bindEnforcement(session){
  const c=db(),uid=session?.user?.id||'';
  if(enforcementChannel){try{c?.removeChannel(enforcementChannel)}catch{}enforcementChannel=null}
  clearInterval(enforcementTimer);enforcementTimer=0;
  enforcementUserId=uid;
  if(!uid){clearEnforcement();return}
  const cached=readCachedEnforcement(uid);if(cached?.site_suspended||cached?.account_banned)applyEnforcement(uid,cached,{cached:true});else clearEnforcement(uid);
  await refreshEnforcement(session);
  enforcementTimer=setInterval(()=>{if(document.visibilityState==='visible')c.auth.getSession().then(({data})=>refreshEnforcement(data?.session||null)).catch(()=>{})},120000);
  try{enforcementChannel=c.channel('f2w-v165-enforce-'+uid).on('postgres_changes',{event:'*',schema:'public',table:'account_enforcement_v146',filter:`user_id=eq.${uid}`},payload=>{
    const evt=String(payload?.eventType||'').toUpperCase();
    const row=payload?.new||payload?.old||null;
    if(row&&String(row.user_id||'')!==String(uid))return;
    if(evt==='DELETE'||!row){clearEnforcement(uid);return}
    const exp=row.expires_at?new Date(row.expires_at).getTime():0;
    const valid=!exp||exp>Date.now();
    applyEnforcement(uid,{...row,user_id:uid,site_suspended:valid&&!!row.site_suspended,account_banned:valid&&!!row.account_banned},{realtime:true});
  }).subscribe()}catch{}
}
function blockWhileEnforced(e){
  if(!document.documentElement.classList.contains('f2w-enforced'))return;
  const overlay=document.getElementById('f2w-v165-enforcement');if(overlay?.contains(e.target))return;
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
function forumIcons(){if(!false)return;const svg=(d)=>`<svg class="forum-v159-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;const map=[[/new discussion|start a thread/i,'M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4z'],[/browse titles/i,'M3 5h18v14H3V5zm3 3h4v8H6V8zm8 0h4v8h-4V8z'],[/rankings/i,'M7 3h10v3h4v3c0 3-2 5-5 5h-1v3h3v2H6v-2h3v-3H8c-3 0-5-2-5-5V6h4V3z'],[/my profile/i,'M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0H5z']];document.querySelectorAll('button,a').forEach(el=>{const t=(el.textContent||'').trim();for(const [re,d] of map){if(re.test(t)){el.querySelectorAll('i[class*="fa-"]').forEach(i=>i.remove());if(!el.querySelector('svg.forum-v159-icon'))el.insertAdjacentHTML('afterbegin',svg(d));break}}})}

const roleClasses=['f2w-role-owner','f2w-role-staff','f2w-role-moderator','f2w-role-support','f2w-role-developer','f2w-role-verified','f2w-role-contributor','f2w-role-curator'];
let staffRoleChannel=null,publicRoleChannel=null,currentAuthUserId='',currentAuthUsername='';
function clearRolePaint(node){if(!node?.classList)return;node.classList.remove('f2w-role-name',...roleClasses);node.removeAttribute('data-f2w-role');node.removeAttribute('data-f2w-role-decorated');node.style.removeProperty('color');node.style.removeProperty('-webkit-text-fill-color');node.style.removeProperty('text-shadow')}
function applyRolePaint(node,role){clearRolePaint(node);role=String(role||'').toLowerCase();if(!role)return;const cls='f2w-role-'+role;if(!roleClasses.includes(cls))return;node.classList.add('f2w-role-name',cls);node.dataset.f2wRole=role;node.dataset.f2wRoleDecorated='1'}
function visibleUsername(){const m=location.pathname.match(/^\/profile\/@([A-Za-z0-9]+)\/?$/);return (m?.[1]||new URLSearchParams(location.search).get('user')||'').replace(/[^A-Za-z0-9]/g,'')}
async function repaintUsername(username){username=String(username||'').replace(/[^A-Za-z0-9]/g,'');if(!username)return;const c=db();let role='';try{const {data}=await c.rpc('get_public_profile_role',{p_username:username});role=String(data||'').toLowerCase()}catch{}try{localStorage.removeItem(`f2w_profile_role_v110:${username.toLowerCase()}`)}catch{}const sel=`[data-f2w-username="${CSS.escape(username)}"],[data-username="${CSS.escape(username)}"]`;document.querySelectorAll(sel).forEach(n=>applyRolePaint(n,role));if(visibleUsername().toLowerCase()===username.toLowerCase()){const n=document.getElementById('profile-name')||document.querySelector('.profile-name');if(n)applyRolePaint(n,role)}try{window.refreshPublicProfileRoleBadge?.()}catch{}try{window.loadViewedProfileRoleBadge?.()}catch{}}
async function refreshOwnStaffContext(){const c=db();if(!c?.rpc||!currentAuthUserId)return;try{const {data}=await c.rpc('get_staff_context_v160');const role=String(data?.role||'member').toLowerCase();const nav=document.getElementById('staff-control-nav');const allowed=['owner','staff','moderator','support','developer'].includes(role);if(nav){nav.hidden=!allowed;nav.style.display=allowed?'flex':'none'}window.dispatchEvent(new CustomEvent('f2w:staff-role-changed',{detail:{role,permissions:data?.permissions||[]}}));if(location.pathname.startsWith('/staff/')){try{window.resolveStaffAccessV123?.()}catch{}}if(currentAuthUsername)await repaintUsername(currentAuthUsername)}catch(e){console.warn('v165 staff context refresh',e)}}
async function bindRoleRealtime(session){const c=db(),uid=session?.user?.id||'';currentAuthUserId=uid;currentAuthUsername='';if(staffRoleChannel){try{c?.removeChannel(staffRoleChannel)}catch{}staffRoleChannel=null}if(publicRoleChannel){try{c?.removeChannel(publicRoleChannel)}catch{}publicRoleChannel=null}if(!uid)return;try{const {data}=await c.from('profiles').select('username').eq('user_id',uid).maybeSingle();currentAuthUsername=String(data?.username||'')}catch{}try{staffRoleChannel=c.channel('f2w-v165-staff-role').on('postgres_changes',{event:'*',schema:'public',table:'chat_moderators'},async()=>{await refreshOwnStaffContext();const u=visibleUsername();if(u)await repaintUsername(u)}).subscribe()}catch{}try{publicRoleChannel=c.channel('f2w-v165-public-role-'+uid).on('postgres_changes',{event:'*',schema:'public',table:'profile_role_assignments'},async()=>{await refreshOwnStaffContext();const u=visibleUsername();if(u)await repaintUsername(u)}).subscribe()}catch{}await refreshOwnStaffContext();const u=visibleUsername();if(u)await repaintUsername(u)}
let enforcementBus=null;try{enforcementBus=new BroadcastChannel('f2w-enforcement-v165');enforcementBus.onmessage=e=>{const d=e.data||{};if(String(d.user_id||'')!==String(enforcementUserId||''))return;if(d.active)applyEnforcement(enforcementUserId,d.state||d,{cached:true});else clearEnforcement(enforcementUserId)}}catch{}

async function sync(session){setAuthHeader(session);ensureChatDot();normalizeRed();fixAuthTabs();fixSocial();forumIcons();await Promise.allSettled([bindNotifications(session),bindEnforcement(session),bindViewedProfileRoleRealtime(),bindRoleRealtime(session)])}
async function boot(){scrubEnforcementVisuals();const c=db();if(!c?.auth)return;let session=null;try{session=(await timeout(c.auth.getSession(),1800)).data?.session||null}catch{}await sync(session);c.auth.onAuthStateChange?.((_e,s)=>{const next=String(s?.user?.id||'');const current=String(enforcementUserId||'');if(!next){if(current)clearEnforcement(current);setTimeout(()=>sync(s),0);return}if(next!==current){if(current)clearEnforcement(current);setTimeout(()=>sync(s),0);return}setAuthHeader(s);setTimeout(()=>refreshEnforcement(s),0)});const mo=new MutationObserver(m=>{ensureChatDot();normalizeRed();fixAuthTabs();forumIcons()});mo.observe(document.documentElement,{subtree:true,childList:true});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')c.auth.getSession().then(({data})=>{setAuthHeader(data?.session||null);refreshEnforcement(data?.session||null)})},{passive:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

// f2w-force-save:v183-enforcement-no-flash-support-exemption:20260902

// f2w-force-save:v201-enforcement-viewport:20260902

// f2w-force-save:v209-support-exempt-account-ban:20260902
