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
  mo.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

/* v178 auth/profile/nav/member-age hardening */
(()=>{
'use strict';
if(window.__f2wV178Hardening)return;window.__f2wV178Hardening=true;
const $=s=>document.querySelector(s);
function db(){return window.f2wSupabase||window.chatSupabase||window.supabaseClient||null}
function closeAccountModal(){
  const m=$('#account-modal');if(!m)return;
  m.classList.remove('open','f2w-auth-modal-open-v60','f2w-v159-auth-open','f2w-auth-hard-open-v58');
  m.style.removeProperty('display');m.setAttribute('aria-hidden','true');m.setAttribute('inert','');
  document.documentElement.classList.remove('f2w-auth-open-v56','f2w-auth-v67-open','f2w-popup-scroll-lock');
  document.body.classList.remove('f2w-auth-v67-open','f2w-popup-scroll-lock');
  for(const k of ['position','top','left','right','width','overflow'])document.body.style.removeProperty(k);
  document.documentElement.style.removeProperty('overflow');
}
function openLoggedOutAuth(mode='login'){
  const m=$('#account-modal');if(!m)return;
  try{window.showAccountMode?.(mode)}catch{}
  m.removeAttribute('inert');m.setAttribute('aria-hidden','false');m.classList.add('open');
  m.querySelectorAll('input,textarea,button,select').forEach(el=>{el.removeAttribute('inert');el.style.pointerEvents='auto'});
}
async function routeProfile(){
  const c=db();let user=null;
  try{user=(await c?.auth?.getSession?.())?.data?.session?.user||null}catch{}
  if(!user){openLoggedOutAuth('login');return}
  let u='';
  try{u=String(window.getAccountUsername?.()||'').replace(/^@/,'').trim()}catch{}
  if(!u)try{u=String(localStorage.getItem('f2w_profile_username_v24')||'').replace(/^@/,'').trim()}catch{}
  if(!u&&c?.from){
    try{const {data}=await c.from('profiles').select('username').eq('user_id',user.id).maybeSingle();u=String(data?.username||'').replace(/^@/,'').trim()}catch{}
  }
  if(u){try{localStorage.setItem('f2w_profile_username_v24',u)}catch{};location.href=`/profile/@${encodeURIComponent(u)}`;return}
  openLoggedOutAuth('login');
}
function ensureLeaderboard(){
  document.querySelectorAll('.f2w-primary-nav').forEach(nav=>{
    let existing=nav.querySelector('a[href="/leaderboard/"],[data-v35-leaderboard]');
    if(existing){existing.textContent='Leaderboard';return}
    const a=document.createElement('a');a.className='f2w-nav-link';a.href='/leaderboard/';a.dataset.v178Leaderboard='1';a.innerHTML='<i class="fa-solid fa-trophy"></i> Leaderboard';
    const genres=[...nav.querySelectorAll('a,button')].find(el=>/^genres$/i.test(String(el.textContent||'').trim()));
    if(genres?.nextSibling)nav.insertBefore(a,genres.nextSibling);else nav.appendChild(a);
  });
}
function ageLabel(ts){
  const t=new Date(ts).getTime();if(!Number.isFinite(t))return '—';
  const d=Math.max(0,Date.now()-t),min=60000,h=3600000,day=86400000,w=604800000,mo=2629800000,y=31557600000;
  let n,unit;
  if(d<min){n=Math.max(1,Math.floor(d/1000));unit='second'}
  else if(d<h){n=Math.max(1,Math.floor(d/min));unit='minute'}
  else if(d<day){n=Math.max(1,Math.floor(d/h));unit='hour'}
  else if(d<w){n=Math.max(1,Math.floor(d/day));unit='day'}
  else if(d<mo){n=Math.max(1,Math.floor(d/w));unit='week'}
  else if(d<y){n=Math.max(1,Math.floor(d/mo));unit='month'}
  else {n=Math.max(1,Math.floor(d/y));unit='year'}
  return `${n} ${unit}${n===1?'':'s'}`;
}
let ageStamp='';
function stabilizeProfileAge(){
  if(!location.pathname.startsWith('/profile'))return;
  let ts='';try{if(typeof viewedProfile!=='undefined'&&viewedProfile?.created_at)ts=viewedProfile.created_at}catch{}
  if(!ts)return;
  ageStamp=String(ts);
  const age=$('#v16-profile-age');if(age)age.textContent=ageLabel(ageStamp);
  const joined=$('#profile-joined');if(joined){joined.textContent=`Joined ${new Date(ageStamp).toLocaleDateString(undefined,{year:'numeric',month:'short'})}`;joined.style.display='inline-flex';joined.style.alignItems='center';joined.style.justifyContent='center'}
}
document.addEventListener('click',e=>{
  const close=e.target.closest?.('#account-modal .account-close,#account-modal .chat-close,#account-modal [data-close],#account-modal [aria-label="Close" i]');
  if(close){e.preventDefault();e.stopImmediatePropagation();closeAccountModal();return}
  const p=e.target.closest?.('#profile-nav-btn');if(p){e.preventDefault();e.stopImmediatePropagation();routeProfile();return}
},true);
function repair(){
  ensureLeaderboard();stabilizeProfileAge();
  const m=$('#account-modal');if(m){m.querySelectorAll('input,textarea,button,select').forEach(el=>el.removeAttribute('inert'))}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',repair,{once:true});else repair();
const mo=new MutationObserver(()=>repair());mo.observe(document.documentElement,{subtree:true,childList:true});
setInterval(()=>{if(document.visibilityState==='visible')stabilizeProfileAge()},5000);
window.addEventListener('pageshow',repair);
})();
// f2w-force-save:v178-hardening:20260902
