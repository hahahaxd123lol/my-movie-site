(()=>{
'use strict';
if(window.__f2wV160Bootstrap)return;window.__f2wV160Bootstrap=true;
const URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
const KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';

/* V210: site-wide presence authority. This is deliberately independent from
   Currently Watching/playback. Any authenticated Flix2Watch page keeps the
   user online. */
window.__f2wGlobalPresenceAuthorityV210=true;
let presenceTimer=null;
let presenceClient=null;
let presenceSessionId='';
let presenceBusy=false;

function getPresenceSessionId(){
  if(presenceSessionId)return presenceSessionId;
  try{
    presenceSessionId=sessionStorage.getItem('f2w_presence_session_v210')||'';
    if(!presenceSessionId){
      presenceSessionId=crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem('f2w_presence_session_v210',presenceSessionId);
    }
  }catch{
    presenceSessionId=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return presenceSessionId;
}

async function touchSitePresence(){
  if(presenceBusy)return;
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
      /* Backward-compatible fallback only. */
      try{await client.rpc('touch_presence_v17',{p_session_id:sid});}catch{}
    }
  }catch{}finally{presenceBusy=false;}
}

function startSitePresence(client){
  if(client)presenceClient=client;
  if(presenceTimer)return;
  touchSitePresence();
  presenceTimer=setInterval(touchSitePresence,10000);
  window.__f2wTouchSitePresenceV210=touchSitePresence;
}

function stopSitePresence(){
  if(presenceTimer){clearInterval(presenceTimer);presenceTimer=null;}
}

function bindPresenceAuth(client){
  if(!client?.auth||client.__f2wV210PresenceBound)return;
  client.__f2wV210PresenceBound=true;
  presenceClient=client;
  try{
    client.auth.onAuthStateChange((event,session)=>{
      if(session?.user){
        startSitePresence(client);
        setTimeout(touchSitePresence,50);
      }else if(event==='SIGNED_OUT'){
        stopSitePresence();
      }
    });
  }catch{}
  startSitePresence(client);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')touchSitePresence();
  },{passive:true});
  window.addEventListener('focus',touchSitePresence,{passive:true});
  window.addEventListener('pageshow',touchSitePresence,{passive:true});
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
