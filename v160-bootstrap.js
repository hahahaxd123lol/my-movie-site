(()=>{
'use strict';
if(window.__f2wV160Bootstrap)return;window.__f2wV160Bootstrap=true;
const URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
const KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';

/* V224: low-egress site-wide presence authority.
   - General Online presence stays completely separate from playback.
   - Only one visible Flix2Watch tab per browser sends Supabase heartbeats.
   - Hidden/background tabs send no periodic database traffic.
   - 30-second heartbeat; SQL keeps a 75-second online lease. */
window.__f2wGlobalPresenceAuthorityV210=true;
window.__f2wGlobalPresenceAuthorityV224=true;

const PRESENCE_HEARTBEAT_MS=30000;
const PRESENCE_LEADER_RENEW_MS=10000;
const PRESENCE_LEADER_LEASE_MS=45000;
const PRESENCE_LEADER_KEY='f2w_presence_leader_v224';
const PRESENCE_SESSION_KEY='f2w_presence_browser_session_v224';

let presenceTimer=null;
let presenceLeaderTimer=null;
let presenceClient=null;
let presenceSessionId='';
let presenceBusy=false;
let presenceLastSentAt=0;

const presenceTabId=(()=>{
  try{
    let id=sessionStorage.getItem('f2w_presence_tab_v224')||'';
    if(!id){
      id=crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem('f2w_presence_tab_v224',id);
    }
    return id;
  }catch{
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
})();

function getPresenceSessionId(){
  if(presenceSessionId)return presenceSessionId;
  try{
    presenceSessionId=localStorage.getItem(PRESENCE_SESSION_KEY)||'';
    if(!presenceSessionId){
      presenceSessionId=crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(PRESENCE_SESSION_KEY,presenceSessionId);
    }
  }catch{
    presenceSessionId=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return presenceSessionId;
}

function readPresenceLeader(){
  try{
    const row=JSON.parse(localStorage.getItem(PRESENCE_LEADER_KEY)||'null');
    return row&&row.id?row:null;
  }catch{return null}
}

function writePresenceLeader(){
  try{
    localStorage.setItem(PRESENCE_LEADER_KEY,JSON.stringify({
      id:presenceTabId,
      expires:Date.now()+PRESENCE_LEADER_LEASE_MS
    }));
    return true;
  }catch{return true}
}

function isPresenceLeader(){
  const row=readPresenceLeader();
  return Boolean(row&&row.id===presenceTabId&&Number(row.expires||0)>Date.now());
}

function claimPresenceLeadership(){
  if(document.visibilityState!=='visible')return false;
  const row=readPresenceLeader();
  const expired=!row||Number(row.expires||0)<=Date.now();
  if(expired||row.id===presenceTabId){
    writePresenceLeader();
    return true;
  }
  return false;
}

function releasePresenceLeadership(){
  try{
    const row=readPresenceLeader();
    if(row?.id===presenceTabId)localStorage.removeItem(PRESENCE_LEADER_KEY);
  }catch{}
}

async function touchSitePresence({force=false}={}){
  if(presenceBusy||document.visibilityState!=='visible')return;
  if(!claimPresenceLeadership()&&!isPresenceLeader())return;

  const now=Date.now();
  if(!force && now-presenceLastSentAt<PRESENCE_HEARTBEAT_MS-1500)return;

  const client=presenceClient||window.f2wSupabase||window.chatSupabase||window.supabaseClient;
  if(!client?.auth?.getSession||!client?.rpc)return;

  presenceBusy=true;
  try{
    const {data}=await client.auth.getSession();
    const session=data?.session||null;
    if(!session?.user)return;

    const sid=getPresenceSessionId();
    const {error}=await client.rpc('touch_presence_v203',{p_session_id:sid});
    if(error){
      try{await client.rpc('touch_presence_v17',{p_session_id:sid});}catch{}
    }else{
      presenceLastSentAt=Date.now();
    }
  }catch{}finally{
    presenceBusy=false;
  }
}

function schedulePresenceHeartbeat(){
  if(presenceTimer)clearInterval(presenceTimer);
  presenceTimer=setInterval(()=>{
    if(document.visibilityState==='visible'&&isPresenceLeader()){
      void touchSitePresence();
    }
  },PRESENCE_HEARTBEAT_MS);

  if(presenceLeaderTimer)clearInterval(presenceLeaderTimer);
  presenceLeaderTimer=setInterval(()=>{
    if(document.visibilityState!=='visible'){
      if(isPresenceLeader())releasePresenceLeadership();
      return;
    }
    if(claimPresenceLeadership()){
      writePresenceLeader();
      if(Date.now()-presenceLastSentAt>PRESENCE_HEARTBEAT_MS-1500){
        void touchSitePresence();
      }
    }
  },PRESENCE_LEADER_RENEW_MS);
}

function startSitePresence(client){
  if(client)presenceClient=client;
  schedulePresenceHeartbeat();
  if(claimPresenceLeadership())void touchSitePresence({force:true});
  window.__f2wTouchSitePresenceV210=()=>touchSitePresence({force:true});
  window.__f2wTouchSitePresenceV224=()=>touchSitePresence({force:true});
}

function stopSitePresence(){
  if(presenceTimer){clearInterval(presenceTimer);presenceTimer=null;}
  if(presenceLeaderTimer){clearInterval(presenceLeaderTimer);presenceLeaderTimer=null;}
  releasePresenceLeadership();
}

function bindPresenceAuth(client){
  if(!client?.auth||client.__f2wV224PresenceBound)return;
  client.__f2wV224PresenceBound=true;
  presenceClient=client;

  try{
    client.auth.onAuthStateChange((event,session)=>{
      if(session?.user){
        startSitePresence(client);
      }else if(event==='SIGNED_OUT'){
        stopSitePresence();
      }
    });
  }catch{}

  startSitePresence(client);

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'){
      if(claimPresenceLeadership())void touchSitePresence({force:true});
    }else if(isPresenceLeader()){
      releasePresenceLeadership();
    }
  },{passive:true});

  window.addEventListener('focus',()=>{
    if(claimPresenceLeadership())void touchSitePresence({force:true});
  },{passive:true});

  window.addEventListener('pageshow',()=>{
    if(claimPresenceLeadership())void touchSitePresence({force:true});
  },{passive:true});

  window.addEventListener('pagehide',()=>{
    releasePresenceLeadership();
  },{passive:true});

  window.addEventListener('storage',event=>{
    if(event.key!==PRESENCE_LEADER_KEY||document.visibilityState!=='visible')return;
    const row=readPresenceLeader();
    if(!row||Number(row.expires||0)<=Date.now()){
      if(claimPresenceLeadership())void touchSitePresence({force:true});
    }
  });
}

function install(){
  if(!window.supabase?.createClient)return false;
  if(window.__f2wOriginalCreateClient){
    const existing=window.f2wSupabase||window.chatSupabase||window.supabaseClient||null;
    if(existing)bindPresenceAuth(existing);
    return true;
  }
  const original=window.supabase.createClient.bind(window.supabase);
  window.__f2wOriginalCreateClient=original;
  let singleton=window.f2wSupabase||window.chatSupabase||window.supabaseClient||null;
  if(!singleton){
    try{singleton=original(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})}catch{}
  }
  if(singleton){
    window.f2wSupabase=singleton;window.chatSupabase=singleton;window.supabaseClient=singleton;window.__supabaseClient=singleton;
    bindPresenceAuth(singleton);
  }
  window.supabase.createClient=function(url,key,opts){
    if(String(url||'').replace(/\/$/,'')===URL && String(key||'')===KEY){
      if(singleton){bindPresenceAuth(singleton);return singleton;}
      singleton=original(url,key,{...(opts||{}),auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,...((opts||{}).auth||{})}});
      window.f2wSupabase=window.chatSupabase=window.supabaseClient=window.__supabaseClient=singleton;
      bindPresenceAuth(singleton);
      return singleton;
    }
    return original(url,key,opts);
  };
  try{singleton?.auth?.getSession?.().then(({data})=>window.dispatchEvent(new CustomEvent('f2w:v160-session',{detail:data?.session||null}))).catch(()=>{})}catch{}
  return true;
}
if(!install()){
  let tries=0;const t=setInterval(()=>{tries++;if(install()||tries>80)clearInterval(t)},25);
}
})();
// f2w-force-save:v210-sitewide-presence-authority:20260902

// f2w-force-save:v224-low-egress-presence-leader:20260903


/* V242 — clean native Join Discord header button.
   Rewritten from scratch. No click interception. */
(()=>{
  'use strict';
  if(window.__f2wDiscordNativeV242)return;
  window.__f2wDiscordNativeV242=true;

  const INVITE='https://discord.gg/q5k46TpxUk';

  function ensureStyle(){
    if(document.getElementById('f2w-discord-v242-css'))return;
    const style=document.createElement('style');
    style.id='f2w-discord-v242-css';
    style.textContent=`
      #f2w-discord-join-v242{
        display:inline-flex!important;
        align-items:center!important;
        justify-content:center!important;
        gap:6px!important;
        width:116px!important;
        min-width:116px!important;
        max-width:116px!important;
        height:40px!important;
        min-height:40px!important;
        padding:0 10px!important;
        box-sizing:border-box!important;
        border:1px solid rgba(88,101,242,.72)!important;
        border-radius:9px!important;
        background:rgba(88,101,242,.14)!important;
        color:#fff!important;
        text-decoration:none!important;
        white-space:nowrap!important;
        font-size:10px!important;
        font-weight:850!important;
        line-height:1!important;
        cursor:pointer!important;
        pointer-events:auto!important;
        position:relative!important;
        z-index:50!important;
        flex:0 0 116px!important;
      }
      #f2w-discord-join-v242:hover{
        background:rgba(88,101,242,.28)!important;
        border-color:#5865f2!important;
        color:#fff!important;
        text-decoration:none!important;
      }
      #f2w-discord-join-v242 svg{
        width:17px!important;
        height:17px!important;
        flex:0 0 17px!important;
        fill:currentColor!important;
        pointer-events:none!important;
      }
      #f2w-discord-join-v242 span{
        display:block!important;
        pointer-events:none!important;
      }

      /* Desktop: add a dedicated column before Chat and push existing buttons right. */
      @media (min-width:1181px){
        body.f2w-main-page>header .f2w-action-cluster,
        header .f2w-action-cluster{
          grid-template-columns:116px 58px 82px 72px 76px 78px 112px 116px!important;
          flex-basis:752px!important;
          width:752px!important;
          min-width:752px!important;
          max-width:752px!important;
        }
        body.f2w-main-page>header #f2w-discord-join-v242,
        header #f2w-discord-join-v242{
          grid-column:1!important;
          grid-row:1!important;
        }
        body.f2w-main-page>header .chat-button,
        header .chat-button{
          grid-column:2!important;
          grid-row:1!important;
        }
        body.f2w-main-page>header #header-login-btn,
        body.f2w-main-page>header #favorites-nav-btn,
        header #header-login-btn,
        header #favorites-nav-btn{
          grid-column:3!important;
          grid-row:1!important;
        }
        body.f2w-main-page>header #header-signup-btn,
        body.f2w-main-page>header #profile-nav-btn,
        header #header-signup-btn,
        header #profile-nav-btn{
          grid-column:4!important;
          grid-row:1!important;
        }
        body.f2w-main-page>header #support-nav-btn,
        header #support-nav-btn{
          grid-column:5!important;
          grid-row:1!important;
        }
        body.f2w-main-page>header #account-btn,
        header #account-btn{
          grid-column:6!important;
          grid-row:1!important;
        }
        body.f2w-main-page>header #notification-wrap,
        header #notification-wrap{
          grid-column:7!important;
          grid-row:1!important;
        }
        body.f2w-main-page>header #staff-control-nav,
        header #staff-control-nav{
          grid-column:8!important;
          grid-row:1!important;
        }
      }

      @media (max-width:1180px){
        #f2w-discord-join-v242{
          order:-60!important;
          width:116px!important;
          min-width:116px!important;
          max-width:116px!important;
        }
      }
    `;
    (document.head||document.documentElement).appendChild(style);
  }

  function makeButton(){
    const a=document.createElement('a');
    a.id='f2w-discord-join-v242';
    a.href=INVITE;
    a.target='_blank';
    a.rel='noopener noreferrer external';
    a.title='Join the Flix2Watch Discord';
    a.setAttribute('aria-label','Join the Flix2Watch Discord');
    a.innerHTML=`
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M19.54 5.34A16.8 16.8 0 0 0 15.44 4l-.2.4a15.6 15.6 0 0 1 3.62 1.14 12.5 12.5 0 0 0-13.7 0A15.8 15.8 0 0 1 8.8 4.4L8.6 4a16.9 16.9 0 0 0-4.12 1.35C1.88 9.17 1.18 12.9 1.53 16.58a16.4 16.4 0 0 0 5.03 2.55l1.22-1.67a10.6 10.6 0 0 1-1.93-.92l.47-.36a11.9 11.9 0 0 0 11.36 0l.47.36c-.62.36-1.27.67-1.94.92l1.23 1.67a16.4 16.4 0 0 0 5.03-2.55c.42-4.26-.72-7.96-2.91-11.24ZM8.88 14.83c-1.2 0-2.18-1.1-2.18-2.45s.96-2.45 2.18-2.45c1.23 0 2.2 1.11 2.18 2.45 0 1.35-.96 2.45-2.18 2.45Zm6.24 0c-1.2 0-2.18-1.1-2.18-2.45s.96-2.45 2.18-2.45c1.23 0 2.2 1.11 2.18 2.45 0 1.35-.95 2.45-2.18 2.45Z"/>
      </svg>
      <span>Join Discord</span>
    `;
    return a;
  }

  function install(){
    ensureStyle();

    // Remove every older Discord version so there is only one button.
    document.getElementById('f2w-discord-join-v232')?.remove();
    document.getElementById('f2w-discord-join-v233')?.remove();

    let a=document.getElementById('f2w-discord-join-v242');
    const chat=document.querySelector('header .chat-button');
    const cluster=document.querySelector('header .f2w-action-cluster');

    if(chat?.parentElement){
      if(!a)a=makeButton();
      if(a.parentElement!==chat.parentElement || a.nextElementSibling!==chat)
        chat.parentElement.insertBefore(a,chat);
      return true;
    }

    // Logged-out/auth-transition fallback.
    if(cluster){
      if(!a)a=makeButton();
      if(a.parentElement!==cluster)cluster.prepend(a);
      return true;
    }

    return false;
  }

  function start(){
    install();
    let queued=false;
    const obs=new MutationObserver(()=>{
      if(queued)return;
      queued=true;
      requestAnimationFrame(()=>{
        queued=false;
        install();
      });
    });
    if(document.body)obs.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',start,{once:true});
  else
    start();
})();
// f2w-force-save:v242-clean-native-discord:20260904

// f2w-force-save:v243-force-discord-new-tab:20260904
