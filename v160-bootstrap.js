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


/* V246 — authoritative site-wide Discord header link.
   Built from the working Profile V211 social-link pattern. */
(()=>{
  'use strict';
  if(window.__f2wDiscordV246)return;
  window.__f2wDiscordV246=true;

  const INVITE='https://discord.gg/q5k46TpxUk';
  const BUTTON_ID='f2w-discord-join-v246';

  /*
    Profile V211 captures the opener before older site routers can interfere.
    v160 loads later on some routes, so prefer the native Window prototype
    method (which avoids an instance-level window.open wrapper), then use the
    same about:blank -> _blank -> location.replace flow.
  */
  const nativeOpen=(()=>{
    try{
      if(typeof Window!=='undefined' && typeof Window.prototype?.open==='function')
        return Window.prototype.open;
    }catch{}
    try{
      if(typeof window.open==='function')return window.open;
    }catch{}
    return null;
  })();

  function anchorFrom(target){
    try{return target?.closest?.(`#${BUTTON_ID}[href]`)||null}catch{return null}
  }

  function openExternal(event){
    const a=anchorFrom(event.target); if(!a)return;
    const href=String(a.href||'').trim(); if(!/^https?:\/\//i.test(href))return;

    // Same authority pattern as the working Profile social links.
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();

    try{
      const tab=nativeOpen ? Reflect.apply(nativeOpen,window,['about:blank','_blank']) : null;
      if(tab){
        try{tab.opener=null}catch{}
        try{tab.location.replace(href)}catch{try{tab.location.href=href}catch{}}
        return;
      }
    }catch{}

    // New-tab only. Never replace the current Flix2Watch tab.
  }

  // Window capture: runs before document-level legacy routers.
  window.addEventListener('click',openExternal,true);

  const ICON='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19.54 5.34A16.8 16.8 0 0 0 15.44 4l-.2.4a15.6 15.6 0 0 1 3.62 1.14 12.5 12.5 0 0 0-13.7 0A15.8 15.8 0 0 1 8.8 4.4L8.6 4a16.9 16.9 0 0 0-4.12 1.35C1.88 9.17 1.18 12.9 1.53 16.58a16.4 16.4 0 0 0 5.03 2.55l1.22-1.67a10.6 10.6 0 0 1-1.93-.92l.47-.36a11.9 11.9 0 0 0 11.36 0l.47.36c-.62.36-1.27.67-1.94.92l1.23 1.67a16.4 16.4 0 0 0 5.03-2.55c.42-4.26-.72-7.96-2.91-11.24ZM8.88 14.83c-1.2 0-2.18-1.1-2.18-2.45s.96-2.45 2.18-2.45c1.23 0 2.2 1.11 2.18 2.45 0 1.35-.96 2.45-2.18 2.45Zm6.24 0c-1.2 0-2.18-1.1-2.18-2.45s.96-2.45 2.18-2.45c1.23 0 2.2 1.11 2.18 2.45 0 1.35-.95 2.45-2.18 2.45Z"/></svg>';

  function makeButton(){
    const a=document.createElement('a');
    a.id=BUTTON_ID;
    a.className='tool-btn f2w-discord-header-link';
    a.href=INVITE;
    a.target='_blank';
    a.rel='noopener noreferrer external';
    a.title='Join the Flix2Watch Discord';
    a.setAttribute('aria-label','Join the Flix2Watch Discord');
    a.innerHTML=ICON+'<span>Join Discord</span>';
    return a;
  }

  function putImportant(el,prop,value){
    try{el.style.setProperty(prop,value,'important')}catch{}
  }

  function styleButton(a){
    const rules={
      'display':'inline-flex',
      'align-items':'center',
      'justify-content':'center',
      'gap':'6px',
      'width':'116px',
      'min-width':'116px',
      'max-width':'116px',
      'height':'40px',
      'min-height':'40px',
      'max-height':'40px',
      'flex':'0 0 116px',
      'padding':'0 9px',
      'margin':'0',
      'box-sizing':'border-box',
      'border':'1px solid rgba(88,101,242,.72)',
      'border-radius':'9px',
      'background':'rgba(88,101,242,.14)',
      'color':'#fff',
      'text-decoration':'none',
      'white-space':'nowrap',
      'overflow':'hidden',
      'font-size':'10px',
      'font-weight':'850',
      'line-height':'1',
      'cursor':'pointer',
      'pointer-events':'auto',
      'position':'relative',
      'z-index':'2147483000',
      'touch-action':'manipulation',
      'grid-column':'auto',
      'grid-row':'auto'
    };
    for(const [k,v] of Object.entries(rules))putImportant(a,k,v);
    a.querySelectorAll('*').forEach(el=>putImportant(el,'pointer-events','none'));
    const svg=a.querySelector('svg');
    if(svg){
      putImportant(svg,'width','17px');
      putImportant(svg,'height','17px');
      putImportant(svg,'flex','0 0 17px');
      putImportant(svg,'fill','currentColor');
    }
  }

  function styleCluster(cluster){
    // Flex prevents every old 7-column grid lock from placing Discord on top of Chat.
    putImportant(cluster,'display','flex');
    putImportant(cluster,'flex-direction','row');
    putImportant(cluster,'flex-wrap','nowrap');
    putImportant(cluster,'align-items','center');
    putImportant(cluster,'justify-content','flex-end');
    putImportant(cluster,'gap','6px');
    putImportant(cluster,'width','auto');
    putImportant(cluster,'min-width','0');
    putImportant(cluster,'max-width','none');
    putImportant(cluster,'height','40px');
    putImportant(cluster,'margin-left','auto');
    putImportant(cluster,'overflow','visible');

    const widths=new Map([
      ['.chat-button','92px'],
      ['#favorites-nav-btn','92px'],
      ['#profile-nav-btn','82px'],
      ['#support-nav-btn','88px'],
      ['#header-login-btn','82px'],
      ['#header-signup-btn','88px'],
      ['#account-btn','90px'],
      ['#notification-wrap','126px'],
      ['#staff-control-nav','116px']
    ]);

    cluster.querySelectorAll(':scope > *').forEach(el=>{
      putImportant(el,'grid-column','auto');
      putImportant(el,'grid-row','auto');
      for(const [selector,w] of widths){
        try{
          if(el.matches(selector)){
            putImportant(el,'flex',`0 0 ${w}`);
            putImportant(el,'width',w);
            putImportant(el,'min-width',w);
            putImportant(el,'max-width',w);
            break;
          }
        }catch{}
      }
    });
  }

  function install(){
    // Remove every older Discord experiment if a cached page still contains one.
    document.querySelectorAll('[id^="f2w-discord-join-v"]').forEach(el=>{
      if(el.id!==BUTTON_ID)el.remove();
    });

    const chat=document.querySelector('header .chat-button');
    const cluster=chat?.parentElement || document.querySelector('header .f2w-action-cluster');
    if(!cluster)return false;

    styleCluster(cluster);

    let a=document.getElementById(BUTTON_ID);
    if(!a)a=makeButton();
    styleButton(a);

    // Always physically place it immediately before Chat when Chat exists.
    if(chat){
      if(a.parentElement!==cluster || a.nextElementSibling!==chat)
        cluster.insertBefore(a,chat);
    }else if(a.parentElement!==cluster){
      cluster.prepend(a);
    }

    return true;
  }

  function start(){
    install();

    let queued=false;
    const repair=()=>{
      if(queued)return;
      queued=true;
      requestAnimationFrame(()=>{
        queued=false;
        install();
      });
    };

    try{
      new MutationObserver(repair).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class','hidden']});
    }catch{}

    // Auth/header code on some routes performs delayed rebuilds.
    let count=0;
    const fast=setInterval(()=>{
      install();
      if(++count>=40)clearInterval(fast);
    },250);

    // Keep it present after later login/logout header state changes.
    setInterval(install,3000);
  }

  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',start,{once:true});
  else
    start();
})();
// f2w-force-save:v246-discord-authority-sitewide:20260904
