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
if(window.__f2wV183Sitewide)return;window.__f2wV183Sitewide=true;
const URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
const KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
const $=s=>document.querySelector(s);
let fallback=null,authRouting=false,repairQueued=false;
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
    el.style.removeProperty('overflow');el.style.removeProperty('pointer-events');el.style.removeProperty('height');el.style.removeProperty('position');
  }
}
function detachFromPortal(){
  const m=accountModal();if(!m)return;
  const portal=m.closest?.('#f2w-viewport-modal-portal');
  if(portal&&m.parentElement===portal){try{document.body.appendChild(m)}catch{}}
  m.classList.remove('f2w-viewport-popup');
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
  const m=accountModal();if(!m)return false;
  detachFromPortal();releaseAuthLocks();
  m.removeAttribute('inert');m.hidden=false;m.removeAttribute('hidden');m.setAttribute('aria-hidden','false');m.dataset.f2wV183='open';
  m.classList.add('open','f2w-v183-auth-open');
  m.style.setProperty('display','flex','important');m.style.setProperty('visibility','visible','important');m.style.setProperty('opacity','1','important');m.style.setProperty('pointer-events','auto','important');
  m.querySelectorAll('input,textarea,select,button,a').forEach(el=>{el.removeAttribute('inert');el.style.setProperty('pointer-events','auto','important')});
  setMode(mode,true);
  setTimeout(()=>{const t=$(mode==='signup'?'#account-username':'#account-email');try{t?.focus({preventScroll:true})}catch{try{t?.focus()}catch{}}},90);
  return false;
}
function closeAuth(e){
  if(e){e.preventDefault?.();e.stopPropagation?.();e.stopImmediatePropagation?.()}
  const m=accountModal();if(!m)return false;
  m.dataset.f2wV183='closed';m.classList.remove('open','f2w-v183-auth-open','f2w-auth-modal-open-v60','f2w-v159-auth-open','f2w-auth-hard-open-v58','f2w-auth-v67','f2w-viewport-popup');
  m.setAttribute('aria-hidden','true');m.setAttribute('inert','');
  m.style.setProperty('display','none','important');m.style.setProperty('visibility','hidden','important');m.style.setProperty('opacity','0','important');m.style.setProperty('pointer-events','none','important');
  releaseAuthLocks();
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
function hideChatForAuth(){const chat=$('#chat-modal');if(chat){chat.classList.remove('open','show','active');chat.setAttribute('aria-hidden','true');chat.style.setProperty('display','none','important');chat.style.setProperty('pointer-events','none','important')}}
async function dmClick(){const user=await sessionUser();if(user){try{window.switchChatMode?.('dm')}catch{};return}hideChatForAuth();openAuth('login')}
function ensureLeaderboard(){
  document.querySelectorAll('.f2w-primary-nav').forEach(nav=>{
    let a=nav.querySelector('a[href="/leaderboard/"],a[href="/leaderboard"],[data-f2w-v183-leaderboard]');
    if(!a){a=document.createElement('a');a.className='f2w-nav-link';a.href='/leaderboard/';a.dataset.f2wV183Leaderboard='1';a.innerHTML='<i class="fa-solid fa-trophy"></i> Leaderboard'}
    const genreWrap=nav.querySelector('.f2w-genre-wrap');
    if(genreWrap){if(a.parentElement!==nav||a.previousElementSibling!==genreWrap)genreWrap.insertAdjacentElement('afterend',a)}
    else if(a.parentElement!==nav)nav.appendChild(a);
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
  const login=t.closest('#header-login-btn,[data-f2w-auth="login"]');if(login){e.preventDefault();e.stopImmediatePropagation();openAuth('login');return}
  const signup=t.closest('#header-signup-btn,[data-f2w-auth="signup"]');if(signup){e.preventDefault();e.stopImmediatePropagation();openAuth('signup');return}
  if(t.closest('#account-login-tab')&&authOpen()){e.preventDefault();e.stopImmediatePropagation();setMode('login',true);return}
  if(t.closest('#account-signup-tab')&&authOpen()){e.preventDefault();e.stopImmediatePropagation();setMode('signup',true);return}
  if(t.closest('#profile-nav-btn')){e.preventDefault();e.stopImmediatePropagation();void routeOwnProfile();return}
  if(location.pathname.startsWith('/watch')){const gate=t.closest('#watch-login-overlay button,.watch-login-actions button');if(gate){e.preventDefault();e.stopImmediatePropagation();openAuth(/create|sign\s*up/i.test(gate.textContent||'')?'signup':'login');return}}
  if(location.pathname.startsWith('/chat')&&t.closest('#v17-chat-dm-tab,[data-chat-mode="dm"],.v17-chat-dm-tab')){e.preventDefault();e.stopImmediatePropagation();void dmClick();return}
}
document.addEventListener('pointerdown',e=>{const c=isCloseControl(e.target);if(c)closeAuth(e)},true);
document.addEventListener('click',capture,true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&authOpen())closeAuth(e)},true);
window.openHeaderAuth=openAuth;window.f2wOpenAuth=openAuth;window.closeAccountModal=closeAuth;window.showAccountMode=(m='login')=>setMode(m,true);window.__f2wRouteOwnProfileV183=routeOwnProfile;
function boot(){repair();void stabilizeMemberAge();void syncEditProfile();const mo=new MutationObserver(queueRepair);mo.observe(document.documentElement,{subtree:true,childList:true});const c=db();try{c?.auth?.onAuthStateChange?.((event,session)=>{if(event==='SIGNED_OUT'){releaseAuthLocks()}if(session?.user&&authOpen())closeAuth();if(location.pathname.startsWith('/profile'))setTimeout(syncEditProfile,50)})}catch{}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('pageshow',()=>{repair();void stabilizeMemberAge();void syncEditProfile()},{passive:true});
})();
// f2w-force-save:v183-sitewide-auth-nav-profile:20260902
