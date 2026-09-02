(()=>{
'use strict';
if(window.__f2wV159Core)return;window.__f2wV159Core=true;
const URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
const KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
const EDGE=`${URL}/functions/v1/rapid-worker`;
let client=null,authBusy=false,legacyOpenAuth=null;
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
function setAuthMode(next='login',animate=true){
  const m=modal();if(!m)return;const signup=next==='signup';m.dataset.v159Mode=signup?'signup':'login';
  const lt=m.querySelector('#account-login-tab'),st=m.querySelector('#account-signup-tab');
  lt?.classList.toggle('active',!signup);st?.classList.toggle('active',signup);
  lt?.classList.toggle('f2w-red-v159',!signup);st?.classList.toggle('f2w-red-v159',signup);
  const uw=m.querySelector('#account-username-wrap'),cw=m.querySelector('#account-confirm-wrap');
  if(uw)uw.style.display=signup?'block':'none';if(cw)cw.style.display=signup?'block':'none';
  const label=m.querySelector('#account-email-label');if(label)label.textContent=signup?'EMAIL':'USERNAME OR EMAIL';
  const submit=m.querySelector('#account-submit');if(submit)submit.textContent=signup?'Create Account':'Log In';
  if(animate){const pane=m.querySelector('.account-body,.f2w-auth-body');if(pane){pane.classList.remove('f2w-v159-auth-pane');void pane.offsetWidth;pane.classList.add('f2w-v159-auth-pane')}}
  authMessage('');normalizeRedButtons(m);
}
function openAuth(next='login'){
  try{legacyOpenAuth?.(next)}catch{}
  const m=modal();if(!m)return;
  m.classList.add('open','f2w-v159-auth-open');m.removeAttribute('inert');m.removeAttribute('aria-hidden');m.hidden=false;setAuthMode(next,false);
  setTimeout(()=>m.querySelector(next==='signup'?'#account-username':'#account-email')?.focus(),40);
}
function closeAuth(){const m=modal();if(!m)return;m.classList.remove('open','f2w-v159-auth-open','f2w-auth-hard-open-v58','f2w-auth-modal-open-v60');m.setAttribute('aria-hidden','true');}
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
      authMessage('Logged in. Loading…');window.dispatchEvent(new CustomEvent('flix2watch:auth-complete',{detail:{mode:'login'}}));setTimeout(()=>location.reload(),100);
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

/* ---------- low-cost chat prewarm: one cached RPC per 60 seconds ---------- */
async function prewarmChat(){
  if(location.pathname.startsWith('/chat'))return;let cached=null;try{cached=JSON.parse(sessionStorage.getItem('f2w_chat_snapshot_v159')||'null')}catch{}
  if(cached&&Date.now()-Number(cached.at||0)<60000){window.__flix2watchPreloadedChat=cached.snapshot;return}
  const c=db();if(!c?.rpc)return;
  try{const {data,error}=await timeout(c.rpc('get_public_chat_bootstrap'),2500);if(error)throw error;const snap=data||{};window.__flix2watchPreloadedChat=snap;sessionStorage.setItem('f2w_chat_snapshot_v159',JSON.stringify({at:Date.now(),snapshot:snap}))}catch{}
}

/* ---------- player connection warmup, zero Supabase cost ---------- */
function warmPlayer(){
  if(sessionStorage.getItem('f2w-player-warmed-v159'))return;sessionStorage.setItem('f2w-player-warmed-v159','1');
  for(const rel of ['preconnect','dns-prefetch']){const l=document.createElement('link');l.rel=rel;l.href='https://player.flix2watch.com';if(rel==='preconnect')l.crossOrigin='anonymous';document.head.appendChild(l)}
  try{fetch('https://player.flix2watch.com/',{mode:'no-cors',cache:'force-cache',priority:'low'}).catch(()=>{})}catch{}
}

/* ---------- event interception loaded LAST, so old page handlers cannot win ---------- */
document.addEventListener('click',e=>{
  const login=e.target.closest?.('#header-login-btn,[data-auth="login"],.login-btn');
  const signup=e.target.closest?.('#header-signup-btn,[data-auth="signup"],.signup-btn');
  if(login){e.preventDefault();e.stopImmediatePropagation();openAuth('login');return}
  if(signup){e.preventDefault();e.stopImmediatePropagation();openAuth('signup');return}
  const m=modal();if(m&&m.contains(e.target)){
    if(e.target.closest('#account-login-tab')){e.preventDefault();e.stopImmediatePropagation();setAuthMode('login');return}
    if(e.target.closest('#account-signup-tab')){e.preventDefault();e.stopImmediatePropagation();setAuthMode('signup');return}
    if(e.target.closest('.chat-close,.account-close,.f2w-auth-close-v56,[data-close-auth]')){e.preventDefault();e.stopImmediatePropagation();closeAuth();return}
    if(e.target.closest('#account-submit')){e.preventDefault();e.stopImmediatePropagation();submitAuth();return}
  }
},true);
document.addEventListener('keydown',e=>{
  const m=modal();if(e.key==='Escape'&&m?.classList.contains('f2w-v159-auth-open')){e.preventDefault();closeAuth();return}
  if(e.key==='Enter'&&m?.classList.contains('f2w-v159-auth-open')&&m.contains(e.target)&&!e.shiftKey){e.preventDefault();submitAuth()}
},true);

function boot(){
  legacyOpenAuth=(typeof window.openHeaderAuth==='function'&&window.openHeaderAuth!==openAuth)?window.openHeaderAuth.bind(window):null;
  window.openHeaderAuth=openAuth;
  window.openAccountModal=async()=>{try{const {data:{session}}=await db().auth.getSession();if(session?.user)location.href='/account/';else openAuth('login')}catch{openAuth('login')}};
  normalizeRedButtons();forumIcons();warmPlayer();setTimeout(prewarmChat,350);
  const mo=new MutationObserver(muts=>{for(const m of muts){for(const n of m.addedNodes){if(n.nodeType===1){normalizeRedButtons(n);if(false)forumIcons()}}}});mo.observe(document.documentElement,{childList:true,subtree:true});
  // Fix any leaderboard/page script that replaced auth/profile actions with Home redirects.
  window.openMyProfile=async()=>{try{const c=db();const {data:{user}}=await c.auth.getUser();if(!user)return openAuth('login');const {data:p}=await c.from('profiles').select('username').eq('user_id',user.id).maybeSingle();if(p?.username)location.href='/profile/@'+encodeURIComponent(p.username)}catch{}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.f2wV159={db,openAuth,closeAuth,setAuthMode,submitAuth,normalizeRedButtons,prewarmChat};
})();
