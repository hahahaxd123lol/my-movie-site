(()=>{
'use strict';
if(window.__f2wV176Sitewide)return;window.__f2wV176Sitewide=true;

const now=()=>Date.now();
const RATE_WINDOW=30000, RATE_MAX=2;
const NAV_WORDS=/^(home|movies|tv shows|leaderboard|genres|chat|favorites|profile|support|account|notifications|login|log in|sign up|create account)$/i;
const EXCLUDE=/^(close|cancel|back|next|previous|prev|refresh|retry|understood|support)$/i;
const ACTION_HINT=/(send|post|save|update|delete|remove|dismiss|resolve|ban|mute|suspend|unsuspend|unban|follow|unfollow|report|submit|apply|grant|give|revoke|mark all read|create|login|log in|sign up|change|clear all restrictions)/i;
function normText(el){return String(el?.getAttribute?.('aria-label')||el?.title||el?.textContent||'').replace(/\s+/g,' ').trim()}
function actionKey(el){
  const txt=normText(el).toLowerCase().slice(0,90);
  const id=String(el?.id||'').toLowerCase();
  const form=el?.closest?.('form')?.id||'';
  return `f2w:v176:rate:${location.pathname}:${id||form||txt||el?.name||'action'}`;
}
function isNetworkAction(el){
  if(!el)return false;
  if(el.matches?.('a[href]')&&!el.matches?.('[role="button"]'))return false;
  const txt=normText(el);
  if(EXCLUDE.test(txt)||NAV_WORDS.test(txt))return false;
  if(el.matches?.('[data-f2w-no-rate],.chat-close,.account-close,.f2w-chat-page-close,[data-close],[aria-label*="close" i],[role="tab"],.account-tab,.v17-chat-mode'))return false;
  if(el.matches?.('button[type="submit"],input[type="submit"],[data-action],[data-command],[data-staff-action]'))return true;
  return ACTION_HINT.test(txt);
}
function readTimes(k){try{return JSON.parse(localStorage.getItem(k)||'[]').filter(t=>now()-Number(t)<RATE_WINDOW)}catch{return[]}}
function allowAction(el){
  const k=actionKey(el), arr=readTimes(k);
  if(arr.length>=RATE_MAX){
    const wait=Math.max(1,Math.ceil((RATE_WINDOW-(now()-arr[0]))/1000));
    try{window.showToast?.(`Please wait ${wait}s before trying that again.`,true)}catch{}
    el?.setAttribute?.('data-f2w-rate-wait',String(wait));
    return false;
  }
  arr.push(now());try{localStorage.setItem(k,JSON.stringify(arr))}catch{}
  return true;
}

// Notifications are a real page now. Never open the legacy dropdown.
document.addEventListener('click',e=>{
  const n=e.target.closest?.('#notification-btn,[data-notifications-link],a[href="/notifications/"]');
  if(n && !location.pathname.startsWith('/notifications')){
    e.preventDefault();e.stopImmediatePropagation();location.href='/notifications/';return;
  }
  if(location.pathname.startsWith('/chat')){
    const c=e.target.closest?.('.f2w-chat-page-close,#chat-modal .chat-close,.v17-chat-hub .chat-close');
    if(c){e.preventDefault();e.stopImmediatePropagation();location.href='/home/';return;}
  }
  const a=e.target.closest?.('button,input[type="submit"],[role="button"]');
  if(isNetworkAction(a) && !allowAction(a)){e.preventDefault();e.stopImmediatePropagation();}
},true);

document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.isComposing)return;
  if(e.repeat){e.preventDefault();e.stopImmediatePropagation();return;}
  const form=e.target?.closest?.('form');
  const btn=form?.querySelector?.('button[type="submit"],input[type="submit"]');
  if(btn&&isNetworkAction(btn)&&!allowAction(btn)){e.preventDefault();e.stopImmediatePropagation();}
},true);

function sanitizeProfileHero(){
  if(!location.pathname.startsWith('/profile/'))return;
  const name=document.getElementById('profile-name');
  if(name){
    const clean=String(name.textContent||'').replace(/@+/g,'').trim();
    if(clean&&clean!==name.textContent)name.textContent=clean;
  }
  const input=document.getElementById('profile-display-name-input');
  if(input&&!input.dataset.f2wNoAt176){
    input.dataset.f2wNoAt176='1';
    const clean=()=>{const v=String(input.value||'').replace(/@+/g,'');if(v!==input.value)input.value=v};
    input.addEventListener('input',clean,true);input.addEventListener('paste',()=>setTimeout(clean,0),true);clean();
  }
}

function wireNotifications(){
  document.querySelectorAll('#notification-btn').forEach(btn=>{
    btn.removeAttribute('onclick');btn.setAttribute('title','Notifications');btn.setAttribute('aria-label','Notifications');
  });
}

function boot(){
  wireNotifications();sanitizeProfileHero();
  const mo=new MutationObserver(()=>{wireNotifications();sanitizeProfileHero()});
  mo.observe(document.documentElement,{subtree:true,childList:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

/* v183 site-wide auth / profile / navigation hardening */
(()=>{
'use strict';
if(window.__f2wV185Sitewide)return;window.__f2wV185Sitewide=true;window.__f2wV190CanonicalAuth=true;
const URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
const KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
const $=s=>document.querySelector(s);
let fallback=null,authRouting=false,repairQueued=false;
let f2wPostLoginCloseUntil=0;
let f2wPostLoginCloseTimers=[];
function db(){
  const existing=window.f2wSupabase||window.chatSupabase||window.supabaseClient;
  if(existing)return existing;
  try{if(!fallback&&window.supabase?.createClient)fallback=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})}catch{}
  return fallback;
}
function accountModal(){return $('#account-modal')}
function accountCard(){return accountModal()?.querySelector('.account-card,#account-logged-out,.account-shell,.account-panel')}
function releaseAuthLocks(){
  const root=document.documentElement,body=document.body;
  for(const el of [root,body]){
    if(!el)continue;
    ['f2w-auth-open-v56','f2w-auth-v67-open','f2w-auth-open-v60','f2w-auth-modal-open','f2w-auth-hard-open','f2w-popup-scroll-lock','f2w-auth-hard-open-v58'].forEach(c=>el.classList.remove(c));
    el.style.removeProperty('overflow');el.style.removeProperty('pointer-events');el.style.removeProperty('height');el.style.removeProperty('position');el.style.removeProperty('top');el.style.removeProperty('left');el.style.removeProperty('right');el.style.removeProperty('width');
  }
  document.documentElement.classList.remove('f2w-transition-leaving');
  document.documentElement.classList.add('f2w-transition-ready');
  document.documentElement.removeAttribute('inert');
  document.body?.removeAttribute('inert');
  document.documentElement.style.setProperty('pointer-events','auto','important');
  document.body?.style.setProperty('pointer-events','auto','important');
}
function detachFromPortal(){
  const m=accountModal();if(!m)return;
  const portal=m.closest?.('#f2w-viewport-modal-portal');
  if(portal&&m.parentElement===portal){try{document.body.appendChild(m)}catch{}}
  m.classList.remove('f2w-viewport-popup');
}
function legacyControlReset(){
  const m=accountModal();if(!m||m.dataset.f2wV185Controls==='1')return;
  m.dataset.f2wV185Controls='1';
  for(const sel of ['.chat-close,.account-close','#account-login-tab','#account-signup-tab']){
    const old=m.querySelector(sel);if(!old||old.dataset.f2wV185Clean==='1')continue;
    const fresh=old.cloneNode(true);fresh.dataset.f2wV185Clean='1';old.replaceWith(fresh);
  }
}
function setPortalSuppressed(on){
  const p=document.getElementById('f2w-viewport-modal-portal');if(!p)return;
  if(on){try{if(p.matches(':popover-open'))p.hidePopover()}catch{};p.dataset.f2wAuthSuppressed='1'}
  else if(p.dataset.f2wAuthSuppressed==='1'){delete p.dataset.f2wAuthSuppressed;try{if(!p.matches(':popover-open'))p.showPopover()}catch{};try{window.__f2wPromoteViewportPopups?.()}catch{}}
}
function authOpen(){const m=accountModal();return !!(m&&m.classList.contains('open')&&m.getAttribute('aria-hidden')!=='true')}
function modeAnimation(mode){
  const c=accountCard();if(!c?.animate)return;
  try{c.getAnimations?.().forEach(a=>a.cancel());c.animate(mode==='signup'?[{opacity:.76,transform:'translateX(34px)'},{opacity:1,transform:'translateX(0)'}]:[{opacity:.76,transform:'translateX(-34px)'},{opacity:1,transform:'translateX(0)'}],{duration:420,easing:'cubic-bezier(.2,.8,.2,1)'})}catch{}
}
function setMode(mode='login',animate=true){
  mode=mode==='signup'?'signup':'login';const m=accountModal();if(!m)return;
  m.dataset.v159Mode=mode;m.dataset.mode=mode;m.dataset.v160Mode=mode;m.dataset.f2wAuthMode=mode;
  const signup=mode==='signup';
  $('#account-login-tab')?.classList.toggle('active',!signup);$('#account-signup-tab')?.classList.toggle('active',signup);
  const uw=$('#account-username-wrap'),cw=$('#account-confirm-wrap');if(uw)uw.style.display=signup?'block':'none';if(cw)cw.style.display=signup?'block':'none';
  const lab=$('#account-email-label');if(lab)lab.textContent=signup?'EMAIL':'USERNAME OR EMAIL';
  const submit=$('#account-submit');if(submit)submit.textContent=signup?'Create Account':'Log In';
  const pass=$('#account-password');if(pass)pass.autocomplete=signup?'new-password':'current-password';
  document.querySelectorAll('#account-modal .f2w-oauth-btn.google .f2w-oauth-label').forEach(x=>x.textContent=signup?'Sign up with Google':'Sign in with Google');
  document.querySelectorAll('#account-modal .f2w-oauth-btn.discord .f2w-oauth-label').forEach(x=>x.textContent=signup?'Sign up with Discord':'Sign in with Discord');
  if(animate)modeAnimation(mode);
}
function openAuth(mode='login'){
  if(Date.now()<f2wPostLoginCloseUntil)return false;
  const m=accountModal();if(!m)return false;
  // v190: Account is the only interactive overlay here. Keep it directly under body and
  // remove stale inert/top-layer/transition state before any field can receive focus.
  try{if(m.parentElement!==document.body)document.body.appendChild(m)}catch{}
  document.documentElement.removeAttribute('inert');document.body?.removeAttribute('inert');
  document.documentElement.style.setProperty('pointer-events','auto','important');
  document.body?.style.setProperty('pointer-events','auto','important');
  legacyControlReset();detachFromPortal();releaseAuthLocks();setPortalSuppressed(true);
  document.documentElement.classList.remove('f2w-transition-leaving');document.documentElement.classList.add('f2w-transition-ready');
  m.removeAttribute('inert');m.hidden=false;m.removeAttribute('hidden');m.setAttribute('aria-hidden','false');m.dataset.f2wV185='open';
  m.classList.add('open','f2w-v183-auth-open','f2w-v185-auth-open');
  m.style.setProperty('position','fixed','important');m.style.setProperty('inset','0','important');m.style.setProperty('z-index','2147483646','important');m.style.setProperty('display','flex','important');m.style.setProperty('visibility','visible','important');m.style.setProperty('opacity','1','important');m.style.setProperty('pointer-events','auto','important');
  const card=m.querySelector('.account-card');if(card){card.removeAttribute('inert');card.style.setProperty('pointer-events','auto','important')}
  m.querySelectorAll('input,textarea,select,button,a').forEach(el=>{el.removeAttribute('inert');el.style.setProperty('pointer-events','auto','important')});
  ['account-email','account-password','account-username','account-confirm'].forEach(id=>{const el=document.getElementById(id);if(el){el.disabled=false;el.readOnly=false;el.tabIndex=0;}});
  setMode(mode,true);
  setTimeout(()=>{const t=$(mode==='signup'?'#account-username':'#account-email');try{t?.focus({preventScroll:true})}catch{try{t?.focus()}catch{}}},60);
  return false;
}
function closeAuth(e){
  if(e){e.preventDefault?.();e.stopPropagation?.();e.stopImmediatePropagation?.()}
  const m=accountModal();if(!m)return false;
  m.dataset.f2wV183='closed';m.dataset.f2wV185='closed';m.classList.remove('open','f2w-v183-auth-open','f2w-v185-auth-open','f2w-auth-modal-open-v60','f2w-v159-auth-open','f2w-auth-hard-open-v58','f2w-auth-v67','f2w-viewport-popup');
  m.setAttribute('aria-hidden','true');m.setAttribute('inert','');
  m.style.setProperty('display','none','important');m.style.setProperty('visibility','hidden','important');m.style.setProperty('opacity','0','important');m.style.setProperty('pointer-events','none','important');
  releaseAuthLocks();setPortalSuppressed(false);
  document.documentElement.style.removeProperty('pointer-events');document.body?.style.removeProperty('pointer-events');
  return false;
}
function isCloseControl(t){
  const m=accountModal();if(!m||!m.contains(t))return null;
  const b=t.closest?.('button,[role="button"],.chat-close,.account-close,.f2w-auth-close-v56,[data-close],[aria-label*="close" i]');if(!b)return null;
  const txt=(b.getAttribute('aria-label')||b.title||b.textContent||'').trim();
  return /close|dismiss/i.test(txt)||b.matches('.chat-close,.account-close,.f2w-auth-close-v56,[data-close]')||!!b.querySelector?.('.fa-xmark,.fa-times,[class*="xmark"]')?b:null;
}
async function sessionUser(){try{return (await db()?.auth?.getSession?.())?.data?.session?.user||null}catch{return null}}
async function ownUsername(user){
  if(!user?.id)return '';
  const key=`f2w:v183:username:${user.id}`;try{const c=sessionStorage.getItem(key);if(c)return c}catch{}
  try{const {data}=await db().from('profiles').select('username').eq('user_id',user.id).maybeSingle();const u=String(data?.username||'').replace(/^@/,'').trim();if(u){try{sessionStorage.setItem(key,u)}catch{};return u}}catch{}
  return '';
}
async function routeOwnProfile(){
  if(authRouting)return;authRouting=true;
  try{const user=await sessionUser();if(!user){openAuth('login');return}const u=await ownUsername(user);if(u){location.assign('/profile/@'+encodeURIComponent(u));return}openAuth('login')}finally{authRouting=false}
}
function hideChatForAuth(){
  const chat=$('#chat-modal');
  // v200: never call /chat/'s closeChat() here because that function navigates to /home/.
  // Guest Direct Messages must close the chat UI in place, then open auth on the same page.
  if(chat){chat.classList.remove('open','show','active','f2w-viewport-popup');chat.setAttribute('aria-hidden','true');chat.style.setProperty('display','none','important');chat.style.setProperty('visibility','hidden','important');chat.style.setProperty('opacity','0','important');chat.style.setProperty('pointer-events','none','important')}
  document.documentElement.classList.remove('chat-open','f2w-chat-open','f2w-popup-scroll-lock');
  document.body?.classList.remove('chat-open','f2w-chat-open','f2w-popup-scroll-lock');
  const portal=document.getElementById('f2w-viewport-modal-portal');
  if(portal&&chat?.parentElement===portal){try{document.body.appendChild(chat)}catch{}}
}
function dmClick(){
  if(window.currentUser||document.body?.classList.contains('f2w-authenticated')){try{window.switchChatMode?.('dm')}catch{};return}
  // Guest path is synchronous: close Chat first, then open Account on the next paint.
  hideChatForAuth();
  requestAnimationFrame(()=>openAuth('login'));
}
function ensureLeaderboard(){
  document.querySelectorAll('.f2w-primary-nav').forEach(nav=>{
    let a=nav.querySelector('a[href="/leaderboard/"],a[href="/leaderboard"],[data-f2w-v183-leaderboard]');
    if(!a){a=document.createElement('a');a.className='f2w-nav-link';a.href='/leaderboard/';a.dataset.f2wV183Leaderboard='1';a.innerHTML='<i class="fa-solid fa-trophy"></i> Leaderboard'}
    const genreWrap=nav.querySelector('.f2w-genre-wrap');
    const search=nav.querySelector('.f2w-search-wrap,.header-search,.search-wrap,input[type="search"]')?.closest?.('.f2w-search-wrap,.header-search,.search-wrap')||null;
    if(genreWrap){if(a.parentElement!==nav||a.previousElementSibling!==genreWrap)genreWrap.insertAdjacentElement('afterend',a)}
    else if(search){if(a.parentElement!==nav||a.nextElementSibling!==search)search.insertAdjacentElement('beforebegin',a)}
    else if(a.parentElement!==nav)nav.appendChild(a);
  });
  // A couple of utility pages use a compact topbar instead of f2w-primary-nav.
  document.querySelectorAll('header.topbar').forEach(bar=>{
    if(bar.querySelector('a[href="/leaderboard/"],a[href="/leaderboard"],[data-f2w-v183-leaderboard]'))return;
    const a=document.createElement('a');a.href='/leaderboard/';a.dataset.f2wV183Leaderboard='1';a.className=bar.querySelector('.toplink')?'toplink':'top-link';a.innerHTML='<i class="fa-solid fa-trophy"></i> Leaderboard';
    const account=bar.querySelector('a[href="/account/"],a[href="/account"]');if(account)account.insertAdjacentElement('beforebegin',a);else bar.appendChild(a);
  });
}
function viewedUsername(){try{return decodeURIComponent((location.pathname.match(/^\/profile\/@([^/?#]+)/)||[])[1]||new URLSearchParams(location.search).get('user')||'').replace(/^@/,'')}catch{return ''}}
function ageLabel(ts){
  const t=new Date(ts).getTime();if(!Number.isFinite(t))return '—';const d=Math.max(0,Date.now()-t),min=60000,h=3600000,day=86400000,w=604800000,mo=2629800000,y=31557600000;let n,u;
  if(d<min){n=Math.max(1,Math.floor(d/1000));u='second'}else if(d<h){n=Math.max(1,Math.floor(d/min));u='minute'}else if(d<day){n=Math.max(1,Math.floor(d/h));u='hour'}else if(d<w){n=Math.max(1,Math.floor(d/day));u='day'}else if(d<mo){n=Math.max(1,Math.floor(d/w));u='week'}else if(d<y){n=Math.max(1,Math.floor(d/mo));u='month'}else{n=Math.max(1,Math.floor(d/y));u='year'}return `${n} ${u}${n===1?'':'s'}`;
}
let ageLockObserver=null;
function lockMemberAge(ts){
  if(!ts)return;window.__F2W_MEMBER_SINCE_V139=ts;
  const paint=()=>{const a=$('#v16-profile-age');if(a){const v=ageLabel(ts);if(a.textContent!==v)a.textContent=v;a.classList.add('f2w-member-age-ready');a.style.setProperty('visibility','visible','important')}const j=$('#profile-joined');if(j){const v='Joined '+new Date(ts).toLocaleDateString(undefined,{year:'numeric',month:'short'});if(j.textContent!==v)j.textContent=v}};
  paint();try{ageLockObserver?.disconnect()}catch{};const a=$('#v16-profile-age'),j=$('#profile-joined');if(a||j){let busy=false;ageLockObserver=new MutationObserver(()=>{if(busy)return;busy=true;queueMicrotask(()=>{paint();busy=false})});if(a)ageLockObserver.observe(a,{childList:true,characterData:true,subtree:true});if(j)ageLockObserver.observe(j,{childList:true,characterData:true,subtree:true})}
}
async function stabilizeMemberAge(){
  if(!location.pathname.startsWith('/profile'))return;const u=viewedUsername();if(!u)return;const a=$('#v16-profile-age');if(a&&!window.__F2W_MEMBER_SINCE_V139)a.style.setProperty('visibility','hidden','important');
  const k='f2w:v183:member-since:'+u.toLowerCase();try{const cached=localStorage.getItem(k);if(cached){lockMemberAge(cached);return}}catch{}
  try{const {data,error}=await db()?.rpc?.('get_profile_member_since_v139',{p_username:u});if(error)throw error;if(data){try{localStorage.setItem(k,data)}catch{};lockMemberAge(data)}}catch{if(a){a.textContent='—';a.style.setProperty('visibility','visible','important')}}
}
async function syncEditProfile(){
  if(!location.pathname.startsWith('/profile'))return;const btn=$('#v35-edit-profile'),copy=$('#copy-profile-link-btn'),actions=copy?.parentElement||$('.profile-actions');if(!actions)return;
  let b=btn;if(!b){b=document.createElement('button');b.id='v35-edit-profile';b.type='button';b.className='profile-action-btn f2w-edit-profile-btn';b.innerHTML='<i class="fa-solid fa-pen-to-square"></i> <span>Edit Profile</span>';actions.insertBefore(b,copy||actions.firstChild)}else if(copy&&b.nextElementSibling!==copy)actions.insertBefore(b,copy);
  b.hidden=true;b.style.display='none';
  try{const user=await sessionUser();if(!user)return;const u=viewedUsername();if(!u)return;const key='f2w:v183:viewed-profile:'+u.toLowerCase();let uid='';try{uid=sessionStorage.getItem(key)||''}catch{}if(!uid){const {data}=await db()?.from?.('profiles')?.select?.('user_id')?.ilike?.('username',u)?.maybeSingle?.();uid=String(data?.user_id||'');if(uid)try{sessionStorage.setItem(key,uid)}catch{}}
    if(uid&&uid===String(user.id)){b.hidden=false;b.style.display='inline-flex';b.onclick=e=>{e.preventDefault();if(typeof window.f2wOpenProfileEditorV182==='function')window.f2wOpenProfileEditorV182();else setTimeout(()=>window.f2wOpenProfileEditorV182?.(),120)}}
  }catch{}
}
function repair(){ensureLeaderboard();detachFromPortal();if(accountModal()&&!authOpen()&&accountModal().dataset.f2wV183==='closed')closeAuth();}
function queueRepair(){if(repairQueued)return;repairQueued=true;setTimeout(()=>{repairQueued=false;repair()},80)}
function capture(e){
  const t=e.target;if(!t?.closest)return;
  const close=isCloseControl(t);if(close){closeAuth(e);return}
  if(e.type!=='click')return;
  if(accountModal()&&authOpen()&&t===accountModal()){closeAuth(e);return}
  const login=t.closest('#header-login-btn,[data-f2w-auth="login"],[data-auth="login"],.login-btn');if(login){e.preventDefault();e.stopImmediatePropagation();openAuth('login');return}
  const signup=t.closest('#header-signup-btn,[data-f2w-auth="signup"],[data-auth="signup"],.signup-btn');if(signup){e.preventDefault();e.stopImmediatePropagation();openAuth('signup');return}
  if(t.closest('#account-login-tab')&&authOpen()){e.preventDefault();e.stopImmediatePropagation();setMode('login',true);return}
  if(t.closest('#account-signup-tab')&&authOpen()){e.preventDefault();e.stopImmediatePropagation();setMode('signup',true);return}
  if(t.closest('#profile-nav-btn')){e.preventDefault();e.stopImmediatePropagation();void routeOwnProfile();return}
  if(location.pathname.startsWith('/watch')){const gate=t.closest('#watch-login-overlay button,.watch-login-actions button');if(gate){e.preventDefault();e.stopImmediatePropagation();openAuth(/create|sign\s*up/i.test(gate.textContent||'')?'signup':'login');return}}
  if(location.pathname.startsWith('/chat')&&t.closest('#v17-chat-dm-tab,[data-chat-mode="dm"],.v17-chat-dm-tab')){e.preventDefault();e.stopImmediatePropagation();dmClick();return}
}
document.addEventListener('pointerdown',e=>{const c=isCloseControl(e.target);if(c)closeAuth(e)},true);
document.addEventListener('click',capture,true);
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&authOpen()){closeAuth(e);return}
  if(e.key==='Enter'&&authOpen()&&accountModal()?.contains(e.target)&&!e.shiftKey){
    const tag=String(e.target?.tagName||'');if(tag==='TEXTAREA')return;
    e.preventDefault();e.stopImmediatePropagation();
    try{if(typeof window.f2wV159?.submitAuth==='function')window.f2wV159.submitAuth();else window.submitAccountAuth?.()}catch{}
  }
},true);
function successfulLoginCloseShield(){
  f2wPostLoginCloseUntil=Date.now()+2600;
  for(const t of f2wPostLoginCloseTimers)clearTimeout(t);
  f2wPostLoginCloseTimers=[];
  const shut=()=>{
    if(Date.now()>f2wPostLoginCloseUntil)return;
    try{closeAuth()}catch{}
    try{releaseAuthLocks()}catch{}
    const m=accountModal();
    if(m){
      m.classList.remove('open','show','active','f2w-v183-auth-open','f2w-v185-auth-open','f2w-auth-modal-open-v60','f2w-v159-auth-open','f2w-auth-hard-open-v58','f2w-auth-v67','f2w-viewport-popup');
      m.setAttribute('aria-hidden','true');
      m.setAttribute('inert','');
      m.style.setProperty('display','none','important');
      m.style.setProperty('visibility','hidden','important');
      m.style.setProperty('opacity','0','important');
      m.style.setProperty('pointer-events','none','important');
    }
  };
  shut();
  for(const ms of [0,40,100,220,450,900,1500,2400])f2wPostLoginCloseTimers.push(setTimeout(shut,ms));
}

window.openHeaderAuth=openAuth;window.f2wOpenAuth=openAuth;window.closeAccountModal=closeAuth;window.showAccountMode=(m='login')=>setMode(m,true);window.__f2wRouteOwnProfileV183=routeOwnProfile;
function boot(){legacyControlReset();repair();void stabilizeMemberAge();void syncEditProfile();window.addEventListener('f2w:auth-success',successfulLoginCloseShield);const mo=new MutationObserver(queueRepair);mo.observe(document.documentElement,{subtree:true,childList:true});const c=db();try{c?.auth?.onAuthStateChange?.((event,session)=>{if(event==='SIGNED_OUT'){releaseAuthLocks()}if(event==='SIGNED_IN'&&session?.user){successfulLoginCloseShield()}else if(session?.user&&authOpen()){closeAuth()}if(location.pathname.startsWith('/profile'))setTimeout(syncEditProfile,50)})}catch{}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('pageshow',()=>{repair();void stabilizeMemberAge();void syncEditProfile()},{passive:true});
// v196: bounded auth repair. The previous observer watched the whole document and
// rewrote the same observed attributes from inside its callback, which could create
// an endless MutationObserver microtask loop as soon as Account opened.
let authRepairScheduled=false;
function repairOpenAuthInteractivity(){
  authRepairScheduled=false;
  if(!authOpen())return;
  const m=accountModal();if(!m)return;

  // Temporarily disconnect so our own corrective writes can never recurse.
  try{authGuard.disconnect()}catch{}
  try{
    if(m.hasAttribute('inert'))m.removeAttribute('inert');
    if(document.documentElement.hasAttribute('inert'))document.documentElement.removeAttribute('inert');
    if(document.body?.hasAttribute('inert'))document.body.removeAttribute('inert');

    if(m.style.getPropertyValue('pointer-events')!=='auto' || m.style.getPropertyPriority('pointer-events')!=='important')
      m.style.setProperty('pointer-events','auto','important');

    const card=m.querySelector('.account-card');
    if(card && (card.style.getPropertyValue('pointer-events')!=='auto' || card.style.getPropertyPriority('pointer-events')!=='important'))
      card.style.setProperty('pointer-events','auto','important');

    m.querySelectorAll('input,textarea,select,button,a').forEach(el=>{
      if(el.hasAttribute('inert'))el.removeAttribute('inert');
      if(el.style.getPropertyValue('pointer-events')!=='auto' || el.style.getPropertyPriority('pointer-events')!=='important')
        el.style.setProperty('pointer-events','auto','important');
      if('disabled' in el && ['INPUT','TEXTAREA','SELECT'].includes(el.tagName) && el.disabled)el.disabled=false;
    });

    document.documentElement.classList.remove('f2w-transition-leaving','f2w-popup-scroll-lock');
    if(!document.documentElement.classList.contains('f2w-transition-ready'))document.documentElement.classList.add('f2w-transition-ready');
    document.body?.classList.remove('f2w-popup-scroll-lock');
  }finally{
    // Watch only Account + the two roots. Do not observe every style mutation site-wide.
    try{
      authGuard.observe(m,{subtree:true,attributes:true,attributeFilter:['class','style','inert','aria-hidden','hidden','disabled']});
      authGuard.observe(document.documentElement,{attributes:true,attributeFilter:['class','style','inert']});
      if(document.body)authGuard.observe(document.body,{attributes:true,attributeFilter:['class','style','inert']});
    }catch{}
  }
}
const authGuard=new MutationObserver(()=>{
  if(!authOpen()||authRepairScheduled)return;
  authRepairScheduled=true;
  requestAnimationFrame(repairOpenAuthInteractivity);
});
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{
    const m=accountModal();
    if(m)authGuard.observe(m,{subtree:true,attributes:true,attributeFilter:['class','style','inert','aria-hidden','hidden','disabled']});
    authGuard.observe(document.documentElement,{attributes:true,attributeFilter:['class','style','inert']});
    if(document.body)authGuard.observe(document.body,{attributes:true,attributeFilter:['class','style','inert']});
  },{once:true});
}else{
  const m=accountModal();
  if(m)authGuard.observe(m,{subtree:true,attributes:true,attributeFilter:['class','style','inert','aria-hidden','hidden','disabled']});
  authGuard.observe(document.documentElement,{attributes:true,attributeFilter:['class','style','inert']});
  if(document.body)authGuard.observe(document.body,{attributes:true,attributeFilter:['class','style','inert']});
}
})();
// f2w-force-save:v190-auth-modal-canonical-authority:20260902

/* v187 TV header layout — injected after page-local legacy styles so they cannot override it. */
(() => {
  'use strict';
  if (window.__f2wTvHeaderV187) return;
  window.__f2wTvHeaderV187 = true;

  const css = `
/* F2W v187 — stable desktop/TV header */
@media (min-width:1181px) and (max-width:1740px) {
  body.f2w-main-page > header {
    display:flex!important;
    flex-wrap:wrap!important;
    align-items:center!important;
    align-content:center!important;
    height:auto!important;
    min-height:124px!important;
    padding:8px 14px 10px!important;
    column-gap:10px!important;
    row-gap:8px!important;
    overflow:visible!important;
  }

  body.f2w-main-page > header > .logo {
    order:1!important;
    flex:0 0 126px!important;
  }

  body.f2w-main-page > header .f2w-primary-nav {
    order:2!important;
    flex:0 1 auto!important;
    min-width:0!important;
    margin:0!important;
  }

  body.f2w-main-page > header .f2w-search-pair {
    order:3!important;
    display:grid!important;
    grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
    flex:1 1 380px!important;
    width:auto!important;
    min-width:320px!important;
    max-width:none!important;
    height:40px!important;
    margin:0 0 0 auto!important;
    gap:8px!important;
    overflow:visible!important;
    position:relative!important;
    z-index:5!important;
  }

  body.f2w-main-page > header .search-container,
  body.f2w-main-page > header .user-search-container {
    width:100%!important;
    min-width:0!important;
    max-width:none!important;
    height:40px!important;
    position:relative!important;
    overflow:visible!important;
    box-sizing:border-box!important;
  }

  body.f2w-main-page > header .search-bar,
  body.f2w-main-page > header .user-search-bar {
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    height:40px!important;
    box-sizing:border-box!important;
  }

  body.f2w-main-page > header .user-search-bar {
    padding-right:48px!important;
  }

  body.f2w-main-page > header .user-search-submit {
    position:absolute!important;
    right:4px!important;
    top:50%!important;
    transform:translateY(-50%)!important;
    width:36px!important;
    min-width:36px!important;
    max-width:36px!important;
    height:32px!important;
    margin:0!important;
    z-index:7!important;
  }

  body.f2w-main-page > header .f2w-action-cluster {
    order:4!important;
    display:flex!important;
    flex:0 0 100%!important;
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    height:40px!important;
    min-height:40px!important;
    margin:0!important;
    gap:7px!important;
    align-items:center!important;
    justify-content:flex-end!important;
    overflow:visible!important;
    position:relative!important;
    z-index:4!important;
  }

  body.f2w-main-page > header .f2w-action-cluster > button,
  body.f2w-main-page > header .f2w-action-cluster > a,
  body.f2w-main-page > header .f2w-action-cluster > .v17-notification-wrap {
    position:relative!important;
    inset:auto!important;
    flex:0 0 auto!important;
    width:auto!important;
    min-width:0!important;
    max-width:none!important;
    height:40px!important;
    margin:0!important;
    transform:none!important;
    translate:none!important;
  }

  body.f2w-main-page > header .f2w-action-cluster .tool-btn,
  body.f2w-main-page > header .f2w-action-cluster .f2w-auth-top-btn {
    min-width:0!important;
    width:auto!important;
    padding-left:12px!important;
    padding-right:12px!important;
    white-space:nowrap!important;
  }

  body.f2w-main-page > header .chat-button {
    min-width:88px!important;
    width:auto!important;
    max-width:none!important;
    padding:0 13px!important;
  }

  body.f2w-main-page > header #notification-wrap {
    width:auto!important;
    min-width:0!important;
    max-width:none!important;
  }

  body.f2w-main-page > header #notification-wrap > button {
    width:auto!important;
    min-width:0!important;
    padding-left:12px!important;
    padding-right:12px!important;
  }
}

/* Extremely constrained desktop/TV browser viewport: keep the same two-row shell,
   but let primary navigation compress before either search box can overlap actions. */
@media (min-width:1181px) and (max-width:1360px) {
  body.f2w-main-page > header > .logo {
    flex-basis:112px!important;
    width:112px!important;
    min-width:112px!important;
    max-width:112px!important;
  }
  body.f2w-main-page > header .f2w-primary-nav {
    gap:6px!important;
  }
  body.f2w-main-page > header .f2w-search-pair {
    min-width:290px!important;
    flex-basis:330px!important;
  }
  body.f2w-main-page > header .f2w-action-cluster {
    gap:5px!important;
  }
  body.f2w-main-page > header .f2w-action-cluster .tool-btn,
  body.f2w-main-page > header .f2w-action-cluster .f2w-auth-top-btn {
    padding-left:10px!important;
    padding-right:10px!important;
  }
}
`;

  function install() {
    let style = document.getElementById('f2w-tv-header-v187');
    if (!style) {
      style = document.createElement('style');
      style.id = 'f2w-tv-header-v187';
      document.head.appendChild(style);
    }
    if (style.textContent !== css) style.textContent = css;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once:true });
  } else {
    install();
  }
  window.addEventListener('pageshow', install, { passive:true });
})();
// f2w-force-save:v187-tv-header-final-layer:20260902

/* v189 — TV header collision repair. Latches only when the fully-loaded header actually overlaps. */
(() => {
  'use strict';
  if (window.__f2wTvHeaderV189) return;
  window.__f2wTvHeaderV189 = true;

  const STYLE_ID = 'f2w-tv-header-v189';
  const CLASS = 'f2w-tv-header-safe-v189';
  const css = `
@media (min-width:1181px) {
  body.${CLASS}.f2w-main-page > header {
    height:auto!important;
    min-height:124px!important;
    max-height:none!important;
    padding:9px 14px 10px!important;
    align-items:flex-start!important;
    overflow:visible!important;
  }
  body.${CLASS}.f2w-main-page > header > .header-tools {
    position:relative!important;
    display:flex!important;
    flex:1 1 auto!important;
    flex-flow:row wrap!important;
    align-items:center!important;
    align-content:flex-start!important;
    width:auto!important;
    min-width:0!important;
    height:auto!important;
    min-height:94px!important;
    max-height:none!important;
    gap:8px 10px!important;
    overflow:visible!important;
  }
  body.${CLASS}.f2w-main-page > header .f2w-primary-nav {
    order:1!important;
    display:flex!important;
    flex:0 1 auto!important;
    min-width:0!important;
    width:auto!important;
    height:40px!important;
    margin:0!important;
  }
  body.${CLASS}.f2w-main-page > header .f2w-search-pair {
    order:2!important;
    display:grid!important;
    grid-template-columns:minmax(180px,1fr) minmax(180px,1fr)!important;
    flex:1 1 440px!important;
    width:auto!important;
    min-width:370px!important;
    max-width:none!important;
    height:40px!important;
    margin:0 0 0 auto!important;
    gap:8px!important;
    position:relative!important;
    z-index:5!important;
    overflow:visible!important;
  }
  body.${CLASS}.f2w-main-page > header .search-container,
  body.${CLASS}.f2w-main-page > header .user-search-container {
    position:relative!important;
    display:block!important;
    width:100%!important;
    min-width:0!important;
    max-width:none!important;
    height:40px!important;
    margin:0!important;
    overflow:visible!important;
  }
  body.${CLASS}.f2w-main-page > header .search-bar,
  body.${CLASS}.f2w-main-page > header .user-search-bar {
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    height:40px!important;
    margin:0!important;
    box-sizing:border-box!important;
  }
  body.${CLASS}.f2w-main-page > header .user-search-bar { padding-right:48px!important; }
  body.${CLASS}.f2w-main-page > header .user-search-submit {
    position:absolute!important;
    right:4px!important;
    left:auto!important;
    top:50%!important;
    bottom:auto!important;
    transform:translateY(-50%)!important;
    width:36px!important;
    min-width:36px!important;
    max-width:36px!important;
    height:32px!important;
    margin:0!important;
    z-index:9!important;
  }
  body.${CLASS}.f2w-main-page > header .f2w-action-cluster {
    order:3!important;
    display:flex!important;
    flex:1 0 100%!important;
    width:100%!important;
    min-width:100%!important;
    max-width:100%!important;
    height:40px!important;
    min-height:40px!important;
    margin:0!important;
    gap:7px!important;
    align-items:center!important;
    justify-content:flex-end!important;
    overflow:visible!important;
    position:relative!important;
    z-index:4!important;
    grid-template-columns:none!important;
    grid-template-rows:none!important;
  }
  body.${CLASS}.f2w-main-page > header .f2w-action-cluster > button,
  body.${CLASS}.f2w-main-page > header .f2w-action-cluster > a,
  body.${CLASS}.f2w-main-page > header .f2w-action-cluster > .v17-notification-wrap,
  body.${CLASS}.f2w-main-page > header .f2w-action-cluster #notification-wrap,
  body.${CLASS}.f2w-main-page > header .f2w-action-cluster #staff-control-nav {
    position:relative!important;
    inset:auto!important;
    grid-column:auto!important;
    grid-row:auto!important;
    flex:0 0 auto!important;
    width:auto!important;
    min-width:0!important;
    max-width:none!important;
    height:40px!important;
    margin:0!important;
    transform:none!important;
    translate:none!important;
  }
  body.${CLASS}.f2w-main-page > header .f2w-action-cluster .tool-btn,
  body.${CLASS}.f2w-main-page > header .f2w-action-cluster .f2w-auth-top-btn {
    width:auto!important;
    min-width:0!important;
    max-width:none!important;
    padding-left:12px!important;
    padding-right:12px!important;
    white-space:nowrap!important;
    overflow:visible!important;
  }
  body.${CLASS}.f2w-main-page > header .chat-button {
    width:auto!important;
    min-width:82px!important;
    max-width:none!important;
    padding:0 13px!important;
  }
  body.${CLASS}.f2w-main-page > header #notification-wrap,
  body.${CLASS}.f2w-main-page > header #notification-wrap > button {
    width:auto!important;
    min-width:0!important;
    max-width:none!important;
  }
  body.${CLASS}.f2w-main-page > header #staff-control-nav[hidden] {
    display:none!important;
    visibility:hidden!important;
    opacity:0!important;
    pointer-events:none!important;
  }
}
`;

  function installStyle(){
    let s=document.getElementById(STYLE_ID);
    if(!s){s=document.createElement('style');s.id=STYLE_ID;document.head.appendChild(s)}
    if(s.textContent!==css)s.textContent=css;
  }
  function overlap(a,b){
    if(!a||!b)return false;
    const A=a.getBoundingClientRect(),B=b.getBoundingClientRect();
    return A.width>0&&B.width>0&&A.left < B.right-2&&A.right > B.left+2&&A.top < B.bottom-2&&A.bottom > B.top+2;
  }
  function shouldLatch(){
    if(innerWidth<1181)return false;
    const h=document.querySelector('body.f2w-main-page > header');
    if(!h)return false;
    const tools=h.querySelector('.header-tools');
    const pair=h.querySelector('.f2w-search-pair');
    const user=h.querySelector('.user-search-container');
    const actions=h.querySelector('.f2w-action-cluster');
    const chat=h.querySelector('.chat-button');
    if(!tools||!pair||!actions||!chat)return false;
    const tr=tools.getBoundingClientRect(), ar=actions.getBoundingClientRect();
    return overlap(user,chat) || overlap(pair,actions) || ar.right>innerWidth+2 || tr.right>innerWidth+2 || actions.scrollWidth>actions.clientWidth+4;
  }
  function latch(){
    installStyle();
    if(document.body?.classList.contains(CLASS))return;
    if(shouldLatch()) document.body.classList.add(CLASS);
  }

  const run=()=>{installStyle();latch()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  [80,220,500,900,1500,2500,4000].forEach(ms=>setTimeout(latch,ms));
  window.addEventListener('load',()=>{latch();setTimeout(latch,400);setTimeout(latch,1200)},{once:true});
  window.addEventListener('pageshow',()=>setTimeout(latch,100),{passive:true});
  window.addEventListener('resize',()=>{if(innerWidth<1181)document.body?.classList.remove(CLASS);else setTimeout(latch,80)},{passive:true});

  const mo=new MutationObserver(()=>{ if(!document.body?.classList.contains(CLASS)) requestAnimationFrame(latch); });
  if(document.documentElement)mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','hidden']});
})();
// f2w-force-save:v189-tv-header-inner-container-latch:20260902

// f2w-force-save:v196-stop-auth-mutationobserver-freeze:20260902


/* v200 site-wide presence heartbeat: low-cost, visible-tab only. */
(()=>{
  if(window.__f2wPresenceV200)return;window.__f2wPresenceV200=true;
  const KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge',URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
  let c=null,busy=false,timer=null;
  const db=()=>c||(c=window.chatSupabase||window.supabase?.createClient?.(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
  async function ping(){
    if(busy||document.visibilityState!=='visible')return;
    busy=true;
    try{const x=db();if(!x)return;const {data}=await x.auth.getSession();if(data?.session?.user)await x.rpc('touch_presence_v200')}catch{}finally{busy=false}
  }
  function start(){clearInterval(timer);ping();timer=setInterval(ping,30000)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')ping()});
  window.addEventListener('focus',ping,{passive:true});
})();
/* f2w-force-save:v200-presence-and-dm:20260902 */

// f2w-force-save:v208-post-login-close-shield:20260902
