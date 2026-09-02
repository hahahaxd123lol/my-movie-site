(()=>{
'use strict';
if(window.__f2wV160Bootstrap)return;window.__f2wV160Bootstrap=true;
const URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
const KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
function install(){
  if(!window.supabase?.createClient)return false;
  if(window.__f2wOriginalCreateClient)return true;
  const original=window.supabase.createClient.bind(window.supabase);
  window.__f2wOriginalCreateClient=original;
  let singleton=window.f2wSupabase||window.chatSupabase||window.supabaseClient||null;
  if(!singleton){
    try{singleton=original(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})}catch{}
  }
  if(singleton){window.f2wSupabase=singleton;window.chatSupabase=singleton;window.supabaseClient=singleton;window.__supabaseClient=singleton;}
  window.supabase.createClient=function(url,key,opts){
    if(String(url||'').replace(/\/$/,'')===URL && String(key||'')===KEY){
      if(singleton)return singleton;
      singleton=original(url,key,{...(opts||{}),auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,...((opts||{}).auth||{})}});
      window.f2wSupabase=window.chatSupabase=window.supabaseClient=window.__supabaseClient=singleton;
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
