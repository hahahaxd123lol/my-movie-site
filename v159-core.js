(()=>{
'use strict';
if(window.__f2wV159Core)return;window.__f2wV159Core=true;
const URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
const KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
const EDGE=`${URL}/functions/v1/rapid-worker`;
let client=null,authBusy=false,legacyOpenAuth=null,authIntent='';
const AUTH_RATE_KEY='f2w:v176:auth-attempts',AUTH_RATE_WINDOW=60000,AUTH_RATE_MAX=5;
function consumeAuthAttempt(){
  const t=Date.now();let a=[];try{a=JSON.parse(localStorage.getItem(AUTH_RATE_KEY)||'[]')}catch{}a=(Array.isArray(a)?a:[]).filter(x=>t-Number(x)<AUTH_RATE_WINDOW);
  if(a.length>=AUTH_RATE_MAX)return Math.max(1,Math.ceil((AUTH_RATE_WINDOW-(t-Number(a[0])))/1000));
  a.push(t);try{localStorage.setItem(AUTH_RATE_KEY,JSON.stringify(a))}catch{}return 0;
}
function db(){
  if(client)return client;
  client=window.chatSupabase||window.f2wSupabase||window.supabaseClient||window.__supabaseClient||null;
  if(!client&&window.supabase?.createClient){try{client=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})}catch{}}
  if(client&&!window.f2wSupabase)window.f2wSupabase=client;
  return client;
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const timeout=(p,ms,msg='Request timed out.')=>Promise.race([p,new Promise((_,r)=>setTimeout(()=>r(new Error(msg)),ms))]);

/* ---------- universal red controls ---------- */
function normalizeRedButtons(root=document){
  const sels=['button.red','.btn.red','.btn.primary','.account-primary','#account-submit','#forum-compose-submit','#forum-reply-submit','.hero-primary','.watch-primary','.staff-confirm-primary','[data-new-thread].red'];
  root.querySelectorAll?.(sels.join(',')).forEach(el=>el.classList.add('f2w-red-v159'));
  root.querySelectorAll?.('button,a').forEach(el=>{
    const cls=String(el.className||'');const bg=getComputedStyle(el).backgroundColor;
    if(/\b(red|danger|primary-red|accent-red)\b/i.test(cls)||/^rgb\((?:22[0-9]|23[0-9]|24[0-9]|25[0-5]),\s*(?:0|[1-4]?\d),\s*(?:0|[1-5]?\d)\)/.test(bg))el.classList.add('f2w-red-v159');
  });
}

/* ---------- canonical auth modal ---------- */
function modal(){return document.getElementById('account-modal')}
function authMessage(text,error=false){
  const m=modal();if(!m)return;let el=m.querySelector('#account-message,.account-message,.f2w-auth-message');
  if(!el){el=document.createElement('div');el.className='f2w-auth-message';m.querySelector('.account-body,.f2w-auth-body')?.appendChild(el)}
  if(el){el.textContent=text||'';el.style.color=error?'#ff6572':'#9fb2c8'}
}
function releaseAuthLocks(){
  for(const el of [document.documentElement,document.body]){
    if(!el)continue;
    ['f2w-auth-open-v56','f2w-auth-v67-open','f2w-auth-open-v60','f2w-auth-modal-open','f2w-auth-modal-open-v60','f2w-auth-hard-open','f2w-auth-hard-open-v58','f2w-popup-scroll-lock'].forEach(c=>el.classList.remove(c));
    for(const prop of ['overflow','height','position','top','left','right','width','pointer-events','filter','transform'])el.style.removeProperty(prop);
  }
}
function releaseAuthPortal(){
  const m=modal();if(!m)return;
  if(m.closest?.('#f2w-viewport-modal-portal')){try{document.body.appendChild(m)}catch{}}
  m.classList.remove('f2w-viewport-popup');
}
function setAuthMode(next='login',animate=true){
  const m=modal();if(!m)return;const signup=next==='signup';next=signup?'signup':'login';m.dataset.v159Mode=next;m.dataset.mode=next;m.dataset.f2wAuthMode=next;
  const lt=m.querySelector('#account-login-tab'),st=m.querySelector('#account-signup-tab');
  lt?.classList.toggle('active',!signup);st?.classList.toggle('active',signup);
  lt?.classList.toggle('f2w-red-v159',!signup);st?.classList.toggle('f2w-red-v159',signup);
  const uw=m.querySelector('#account-username-wrap'),cw=m.querySelector('#account-confirm-wrap');
  if(uw)uw.style.display=signup?'block':'none';if(cw)cw.style.display=signup?'block':'none';
  const label=m.querySelector('#account-email-label');if(label)label.textContent=signup?'EMAIL':'USERNAME OR EMAIL';
  const submit=m.querySelector('#account-submit');if(submit)submit.textContent=signup?'Create Account':'Log In';
  const pw=m.querySelector('#account-password');if(pw)pw.autocomplete=signup?'new-password':'current-password';
  if(animate){const pane=m.querySelector('#account-logged-out,.account-body,.f2w-auth-body');if(pane?.animate){try{pane.getAnimations?.().forEach(a=>a.cancel());pane.animate(signup?[{opacity:.72,transform:'translateX(32px)'},{opacity:1,transform:'translateX(0)'}]:[{opacity:.72,transform:'translateX(-32px)'},{opacity:1,transform:'translateX(0)'}],{duration:420,easing:'cubic-bezier(.2,.8,.2,1)'})}catch{}}}
  authMessage('');normalizeRedButtons(m);
}
function openAuth(next='login',intent=''){
  const m=modal();if(!m)return false;
  if(intent)authIntent=intent;
  releaseAuthPortal();releaseAuthLocks();
  m.hidden=false;m.removeAttribute('hidden');m.removeAttribute('inert');m.setAttribute('aria-hidden','false');m.dataset.f2wV183='open';
  m.classList.remove('f2w-viewport-popup');m.classList.add('open','f2w-v159-auth-open','f2w-v183-auth-open');
  m.style.setProperty('display','flex','important');m.style.setProperty('visibility','visible','important');m.style.setProperty('opacity','1','important');m.style.setProperty('pointer-events','auto','important');
  m.querySelectorAll('input,textarea,select,button,a').forEach(el=>{el.removeAttribute('inert');el.style.setProperty('pointer-events','auto','important')});
  setAuthMode(next,false);
  setTimeout(()=>{const el=m.querySelector(next==='signup'?'#account-username':'#account-email');try{el?.focus({preventScroll:true})}catch{el?.focus?.()}},60);
  return false;
}
function closeAuth(){
  const m=modal();if(!m)return false;
  m.dataset.f2wV183='closed';m.classList.remove('open','f2w-v159-auth-open','f2w-v183-auth-open','f2w-auth-hard-open-v58','f2w-auth-modal-open-v60','f2w-auth-v67','f2w-viewport-popup');
  m.setAttribute('aria-hidden','true');m.setAttribute('inert','');m.style.setProperty('display','none','important');m.style.setProperty('visibility','hidden','important');m.style.setProperty('opacity','0','important');m.style.setProperty('pointer-events','none','important');
  releaseAuthLocks();return false;
}
async function ownUsername(user){
  if(!user?.id)return '';const k=`f2w:v183:username:${user.id}`;try{const cached=sessionStorage.getItem(k);if(cached)return cached}catch{}
  try{const {data}=await db().from('profiles').select('username').eq('user_id',user.id).maybeSingle();const u=String(data?.username||'').replace(/^@/,'').trim();if(u)try{sessionStorage.setItem(k,u)}catch{};return u}catch{return ''}
}
async function routeOwnProfile(){
  try{const {data:{session}}=await db().auth.getSession();if(!session?.user){openAuth('login','profile');return}const u=await ownUsername(session.user);if(u)location.assign('/profile/@'+encodeURIComponent(u));else openAuth('login','profile')}catch{openAuth('login','profile')}
}
async function edgeLogin(identifier,password){
  const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),6500);
  try{
    const r=await fetch(EDGE,{method:'POST',headers:{'content-type':'application/json',apikey:KEY},body:JSON.stringify({action:'login_identifier',identifier,password}),signal:ctrl.signal,cache:'no-store'});
    const j=await r.json().catch(()=>({}));if(!r.ok||!j?.success)throw new Error(j?.error||'Login failed.');return j;
  }finally{clearTimeout(t)}
}
async function submitAuth(){
  if(authBusy)return;const m=modal(),c=db();if(!m||!c?.auth)return;
  const rateWait=consumeAuthAttempt();if(rateWait){authMessage(`Too many attempts. Try again in ${rateWait}s.`,true);return;}
  const signup=m.dataset.v159Mode==='signup';
  const email=String(m.querySelector('#account-email')?.value||'').trim();
  const username=String(m.querySelector('#account-username')?.value||'').trim();
  const password=String(m.querySelector('#account-password')?.value||'');
  const confirm=String(m.querySelector('#account-confirm')?.value||'');
  const btn=m.querySelector('#account-submit');
  try{
    authBusy=true;if(btn)btn.disabled=true;authMessage(signup?'Creating account…':'Logging in…');
    if(signup){
      if(!/^[A-Za-z0-9]{2,30}$/.test(username))throw new Error('Use 2–30 English letters or numbers for the username.');
      if(!/^\S+@\S+\.\S+$/.test(email))throw new Error('Enter a valid email address.');
      if(password.length<6)throw new Error('Password must be at least 6 characters.');
      if(password!==confirm)throw new Error('Passwords do not match.');
      const out=await timeout(c.auth.signUp({email,password,options:{data:{username,chat_alias:username}}}),8000,'Account creation timed out.');
      if(out.error)throw out.error;
      if(out.data?.session){try{await timeout(c.rpc('change_my_username_v145',{p_username:username}),3500)}catch{}}
      authMessage(out.data?.session?'Account created. Loading…':'Account created. Check your email if confirmation is enabled.');
      if(out.data?.session)setTimeout(()=>location.reload(),120);
    }else{
      if(!email||!password)throw new Error('Enter your username/email and password.');
      let out;
      if(email.includes('@')){
        out=await timeout(c.auth.signInWithPassword({email,password}),7500,'Login timed out.');if(out.error)throw out.error;
      }else{
        const token=await edgeLogin(email,password);out=await timeout(c.auth.setSession({access_token:String(token.access_token||''),refresh_token:String(token.refresh_token||'')}),4000);if(out.error)throw out.error;
      }
      authMessage('Logged in. Loading…');window.dispatchEvent(new CustomEvent('flix2watch:auth-complete',{detail:{mode:'login'}}));const intent=authIntent;authIntent='';if(intent==='profile'){const u=await ownUsername(out?.data?.user||out?.data?.session?.user);if(u){location.assign('/profile/@'+encodeURIComponent(u));return}}setTimeout(()=>location.reload(),100);
    }
  }catch(e){authMessage(e?.message||'Authentication failed.',true)}finally{authBusy=false;if(btn)btn.disabled=false;setAuthMode(signup?'signup':'login',false)}
}

/* ---------- forum reliable SVG icons ---------- */
const icons={
  discuss:'<path d="M4 4h16v11H8l-4 4V4zm3 4h10v2H7V8zm0 4h7v2H7v-2z"/>',
  plus:'<path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4z"/>',
  trophy:'<path d="M7 3h10v3h4v3c0 3-2 5-5 5h-.3A6 6 0 0113 17v2h4v2H7v-2h4v-2a6 6 0 01-2.7-3H8c-3 0-5-2-5-5V6h4V3zm0 5H5v1c0 1.7 1 2.7 2.5 3A10 10 0 017 8zm10 0a10 10 0 01-.5 4C18 11.7 19 10.7 19 9V8h-2z"/>',
  user:'<path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9a7 7 0 0114 0H5z"/>',
  film:'<path d="M3 5h18v14H3V5zm2 2v2h2V7H5zm4 0v10h6V7H9zm8 0v2h2V7h-2zM5 11v2h2v-2H5zm12 0v2h2v-2h-2zM5 15v2h2v-2H5zm12 0v2h2v-2h-2z"/>',
  tag:'<path d="M3 4h8l10 10-7 7L4 11V4zm5 2a2 2 0 100 4 2 2 0 000-4z"/>'
};
function svg(kind){return `<svg class="forum-v159-icon" viewBox="0 0 24 24" aria-hidden="true">${icons[kind]||icons.discuss}</svg>`}
function forumIcons(){if(!false)return;
  document.querySelectorAll('.forum-v30-nav,[data-new-thread],a[href*="/movies"],button').forEach(el=>{
    if(!el.closest('main,.forum-v30-layout,.forum-v30-sidebar,.forum-v30-hero'))return;
    const text=(el.textContent||'').trim().toLowerCase();let kind='discuss';
    if(/new discussion|new thread|start a thread/.test(text))kind='plus';else if(/ranking/.test(text))kind='trophy';else if(/my profile/.test(text))kind='user';else if(/browse titles|movie|tv show/.test(text))kind='film';else if(/categor|discussion|general/.test(text))kind='tag';
    const old=el.querySelector('i');if(old)old.outerHTML=svg(kind);else if(!el.querySelector('.forum-v159-icon'))el.insertAdjacentHTML('afterbegin',svg(kind));
  });
}

/* ---------- low-cost chat prewarm: user-intent only, never automatic ---------- */
async function prewarmChat(){
  if(location.pathname.startsWith('/chat'))return;let cached=null;try{cached=JSON.parse(sessionStorage.getItem('f2w_chat_snapshot_v159')||'null')}catch{}
  if(cached&&Date.now()-Number(cached.at||0)<300000){window.__flix2watchPreloadedChat=cached.snapshot;return}
  const c=db();if(!c?.rpc)return;
  try{const {data,error}=await timeout(c.rpc('get_public_chat_bootstrap'),2500);if(error)throw error;const snap=data||{};window.__flix2watchPreloadedChat=snap;sessionStorage.setItem('f2w_chat_snapshot_v159',JSON.stringify({at:Date.now(),snapshot:snap}))}catch{}
}

/* ---------- player connection warmup, zero Supabase cost ---------- */
function warmPlayer(){
  if(sessionStorage.getItem('f2w-player-warmed-v159'))return;sessionStorage.setItem('f2w-player-warmed-v159','1');
  for(const rel of ['preconnect','dns-prefetch']){const l=document.createElement('link');l.rel=rel;l.href='https://player.flix2watch.com';if(rel==='preconnect')l.crossOrigin='anonymous';document.head.appendChild(l)}
  try{fetch('https://player.flix2watch.com/',{mode:'no-cors',cache:'force-cache',priority:'low'}).catch(()=>{})}catch{}
}

/* ---------- event interception: authoritative account modal ---------- */
function isAuthClose(target){
  const m=modal();if(!m||!m.contains(target))return false;const b=target.closest?.('.chat-close,.account-close,.f2w-auth-close-v56,[data-close-auth],[data-close],[aria-label*="close" i],button');if(!b)return false;
  return b.matches('.chat-close,.account-close,.f2w-auth-close-v56,[data-close-auth],[data-close]')||/close|dismiss/i.test(String(b.getAttribute('aria-label')||b.title||''))||!!b.querySelector?.('.fa-xmark,.fa-times');
}
function closeChatShell(){for(const sel of ['#chat-modal','.v17-chat-hub','.chat-modal']){const el=document.querySelector(sel);if(!el)continue;el.classList.remove('open','show','active');el.setAttribute('aria-hidden','true');if(el.id==='chat-modal')el.style.setProperty('display','none','important')}}
document.addEventListener('pointerdown',e=>{if(window.__f2wV190CanonicalAuth)return;if(isAuthClose(e.target)){e.preventDefault();e.stopImmediatePropagation();closeAuth()}},true);
document.addEventListener('click',e=>{
  // v190: the newer site-wide controller owns modal open/close/routing. Do not
  // stop propagation here or it can permanently block the newer handler.
  if(window.__f2wV190CanonicalAuth)return;
  const login=e.target.closest?.('#header-login-btn,[data-auth="login"],[data-f2w-auth="login"],.login-btn');
  const signup=e.target.closest?.('#header-signup-btn,[data-auth="signup"],[data-f2w-auth="signup"],.signup-btn');
  if(login){e.preventDefault();e.stopImmediatePropagation();openAuth('login');return}
  if(signup){e.preventDefault();e.stopImmediatePropagation();openAuth('signup');return}
  if(e.target.closest?.('#profile-nav-btn')){e.preventDefault();e.stopImmediatePropagation();void routeOwnProfile();return}
  if(location.pathname.startsWith('/watch')){
    const gate=e.target.closest?.('#watch-login-overlay button,.watch-login-actions button,[data-watch-auth]');
    if(gate){e.preventDefault();e.stopImmediatePropagation();openAuth(/create|sign\s*up|register/i.test(String(gate.textContent||''))?'signup':'login');return}
  }
  if(location.pathname.startsWith('/chat')&&e.target.closest?.('#v17-chat-dm-tab,[data-chat-mode="dm"],.v17-chat-dm-tab')){e.preventDefault();e.stopImmediatePropagation();void (async()=>{try{const {data:{session}}=await db().auth.getSession();if(session?.user){window.switchChatMode?.('dm');return}}catch{}closeChatShell();openAuth('login')})();return}
  const m=modal();if(m&&m.contains(e.target)){
    if(isAuthClose(e.target)){e.preventDefault();e.stopImmediatePropagation();closeAuth();return}
    if(e.target.closest('#account-login-tab')){e.preventDefault();e.stopImmediatePropagation();setAuthMode('login',true);return}
    if(e.target.closest('#account-signup-tab')){e.preventDefault();e.stopImmediatePropagation();setAuthMode('signup',true);return}
    if(e.target.closest('#account-submit')){e.preventDefault();e.stopImmediatePropagation();submitAuth();return}
  }
  if(m&&e.target===m&&m.classList.contains('open')){e.preventDefault();e.stopImmediatePropagation();closeAuth()}
},true);
document.addEventListener('keydown',e=>{
  if(window.__f2wV190CanonicalAuth)return;
  const m=modal();if(e.key==='Escape'&&m?.classList.contains('open')){e.preventDefault();e.stopImmediatePropagation();closeAuth();return}
  if(e.key==='Enter'&&m?.classList.contains('open')&&m.contains(e.target)&&!e.shiftKey){e.preventDefault();submitAuth()}
},true);

function boot(){
  legacyOpenAuth=null;window.openHeaderAuth=openAuth;window.f2wOpenAuth=openAuth;window.closeAccountModal=closeAuth;window.showAccountMode=setAuthMode;
  window.openAccountModal=async()=>{try{const {data:{session}}=await db().auth.getSession();if(session?.user)location.href='/account/';else openAuth('login')}catch{openAuth('login')}};
  normalizeRedButtons();forumIcons();warmPlayer();
  // Chat bootstrap is fetched only when the user actually heads for Chat, not on every page load.
  let warmed=false;const warm=()=>{if(warmed)return;warmed=true;void prewarmChat()};
  document.querySelectorAll('a[href^="/chat"],.chat-button,[data-chat-link]').forEach(el=>{el.addEventListener('pointerenter',warm,{once:true,passive:true});el.addEventListener('focus',warm,{once:true,passive:true});el.addEventListener('touchstart',warm,{once:true,passive:true})});
  const mo=new MutationObserver(muts=>{for(const m of muts){for(const n of m.addedNodes){if(n.nodeType===1)normalizeRedButtons(n)}}});mo.observe(document.documentElement,{childList:true,subtree:true});
  window.openMyProfile=routeOwnProfile;
  releaseAuthPortal();if(modal()&&!modal().classList.contains('open'))closeAuth();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('pageshow',()=>{releaseAuthPortal();releaseAuthLocks();if(modal()&&!modal().classList.contains('open'))closeAuth()},{passive:true});
window.f2wV159={db,openAuth,closeAuth,setAuthMode,submitAuth,normalizeRedButtons,prewarmChat};
})();

// f2w-force-save:v183-canonical-auth-low-egress:20260902

// f2w-force-save:v190-yield-auth-events-to-canonical-controller:20260902
