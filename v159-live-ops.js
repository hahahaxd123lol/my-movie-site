(()=>{
'use strict';
if(window.__f2wV159LiveOps)return;window.__f2wV159LiveOps=true;
const URL='https://viqufxlcxwgboyxbdhjb.supabase.co',KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
let c=null,user=null,ch=null,timer=0,lastKey='',announceTimer=0,streamTimer=0;
const db=()=>c||(c=window.f2wSupabase||window.chatSupabase||window.supabaseClient||(window.supabase?.createClient?window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null));
const timeout=(p,ms)=>Promise.race([p,new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),ms))]);

function announcementEl(){let el=document.getElementById('f2w-v146-announcement');if(el)return el;el=document.createElement('div');el.id='f2w-v146-announcement';el.hidden=true;el.innerHTML='<strong>ANNOUNCEMENT</strong><span></span><button type="button" aria-label="Dismiss">×</button>';el.querySelector('button').onclick=()=>{el.hidden=true;el.classList.remove('show')};document.body.appendChild(el);return el}
async function refreshAnnouncement(){const x=db();if(!x?.rpc)return;try{const {data,error}=await timeout(x.rpc('get_active_announcement_v146'),1800);if(error)return;const el=announcementEl();const msg=String(data?.message||'').trim();el.querySelector('span').textContent=msg;el.hidden=!msg;el.classList.toggle('show',!!msg)}catch{}}
function boundedOps(){
  refreshAnnouncement();clearInterval(announceTimer);announceTimer=setInterval(()=>{if(document.visibilityState==='visible')refreshAnnouncement()},60000);
  if(location.pathname.startsWith('/watch')){try{window.loadPublicStreamOperations?.()}catch{};clearInterval(streamTimer);streamTimer=setInterval(()=>{if(document.visibilityState==='visible')try{window.loadPublicStreamOperations?.()}catch{}},60000)}
}

function overlay(){let el=document.getElementById('f2w-v159-enforcement');if(el)return el;el=document.createElement('div');el.id='f2w-v159-enforcement';el.innerHTML='<div class="panel"><div class="icon">!</div><h1></h1><p></p><div class="actions"><a href="/support/">Contact Support</a><button type="button" data-v159-logout>Log out</button></div></div>';document.body.appendChild(el);el.querySelector('[data-v159-logout]').onclick=async()=>{try{await db()?.auth?.signOut()}catch{}location.assign('/home/')};return el}
function stopPlayback(){try{if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{})}catch{}document.querySelectorAll('video,audio').forEach(v=>{try{v.pause()}catch{}});document.querySelectorAll('iframe').forEach(f=>{if(/player\.flix2watch\.com|vidsrc|vidcore|ezvid|movie-src|vidlink|embed/i.test(f.src||'')){try{f.src='about:blank'}catch{}}})}
function apply(state,{realtime=false}={}){
  const el=overlay();const active=!!(state?.site_suspended||state?.account_banned);const uid=String(state?.user_id||user?.id||'');const key=JSON.stringify([uid,active,!!state?.site_suspended,!!state?.account_banned,state?.reason||'',state?.expires_at||'']);
  window.__flix2watchAccountGuardReady=true;
  window.__flix2watchAccountState={user_id:uid,banned:active,site_suspended:!!state?.site_suspended,account_banned:!!state?.account_banned,reason:state?.reason||'',expires_at:state?.expires_at||null};
  if(!active){el.classList.remove('show');el.hidden=true;document.documentElement.classList.remove('f2w-enforced');lastKey=key;window.dispatchEvent(new CustomEvent('flix2watch:enforcement-cleared'));return}
  stopPlayback();el.hidden=false;el.classList.add('show');document.documentElement.classList.add('f2w-enforced');el.querySelector('h1').textContent=state.account_banned?'Account login banned':'Site access suspended';el.querySelector('p').textContent=state.reason||'Staff have restricted this account. Contact Support if you believe this is an error.';
  if(realtime&&key!==lastKey){try{el.querySelector('.panel').animate([{transform:'scale(.96)',opacity:.4},{transform:'scale(1)',opacity:1}],{duration:180,easing:'ease-out'})}catch{}}
  lastKey=key;window.dispatchEvent(new CustomEvent('flix2watch:enforcement-active',{detail:window.__flix2watchAccountState}));
}
async function refresh(opts={}){const x=db();if(!x?.auth){window.__flix2watchAccountGuardReady=true;return}let s;try{s=(await timeout(x.auth.getSession(),1600)).data?.session}catch{}user=s?.user||null;if(!user){apply({user_id:null,site_suspended:false,account_banned:false});return}try{const {data,error}=await timeout(x.rpc('get_my_account_enforcement_v159'),2200);if(error)throw error;apply(data||{},opts)}catch{window.__flix2watchAccountGuardReady=true}}
function sub(){const x=db();if(!x?.channel||!user)return;try{if(ch)x.removeChannel(ch)}catch{};try{ch=x.channel('f2w-v159-enforcement-'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'account_enforcement_v146',filter:`user_id=eq.${user.id}`},()=>refresh({realtime:true})).subscribe()}catch{}}
async function boot(){boundedOps();window.__flix2watchAccountGuardReady=false;setTimeout(()=>{window.__flix2watchAccountGuardReady=true},180);await refresh();sub();const x=db();x?.auth?.onAuthStateChange?.(()=>setTimeout(async()=>{await refresh();sub()},0));clearInterval(timer);timer=setInterval(()=>{if(document.visibilityState==='visible')refresh()},60000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh()},{passive:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
