(()=>{
'use strict';
if(window.__f2wV170Notifications)return;
window.__f2wV170Notifications=true;
// Stop older controllers if an old cached script happens to execute later.
window.__f2wV169Notifications=true;
window.__f2wV168Notifications=true;
window.__f2wV166Notifications=true;
window.__f2wV161Notifications=true;
const URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
const KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
let client=null,uid='',rows=[],open=false,loading=false,channel=null,timer=0,lastGoodAt=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rel=v=>{const t=new Date(v).getTime();if(!Number.isFinite(t))return'';const d=Math.max(0,Date.now()-t);if(d<60000)return'just now';if(d<3600000)return Math.floor(d/60000)+'m ago';if(d<86400000)return Math.floor(d/3600000)+'h ago';return Math.floor(d/86400000)+'d ago'};
function db(){
  if(client?.rpc)return client;
  client=window.f2wSupabase||window.chatSupabase||window.supabaseClient||window.__supabaseClient||null;
  if(!client?.rpc&&window.supabase?.createClient){
    try{client=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})}catch{}
  }
  return client;
}
function E(){return{wrap:document.getElementById('notification-wrap'),btn:document.getElementById('notification-btn'),menu:document.getElementById('notification-menu'),list:document.getElementById('notification-list'),count:document.getElementById('notification-count')}}
function key(){return uid?'f2w-notifications-v170:'+uid:''}
function save(){if(!uid)return;try{localStorage.setItem(key(),JSON.stringify({rows,t:Date.now()}))}catch{}}
function restore(){if(!uid)return;try{const x=JSON.parse(localStorage.getItem(key())||'null');if(x&&Array.isArray(x.rows)&&Date.now()-Number(x.t||0)<86400000){rows=x.rows;lastGoodAt=Number(x.t||Date.now());paint()}}catch{}}
function setOpen(v){open=!!v;const{menu,btn}=E();if(menu){menu.hidden=!open;menu.setAttribute('aria-hidden',open?'false':'true');menu.style.setProperty('display',open?'block':'none','important');menu.style.setProperty('visibility',open?'visible':'hidden','important');menu.style.setProperty('opacity',open?'1':'0','important');menu.style.setProperty('pointer-events',open?'auto':'none','important')}btn?.setAttribute('aria-expanded',String(open))}
function paint(){const{list,count}=E();if(!list)return;const unread=rows.filter(n=>!n.read_at).length;if(count){count.textContent=String(unread);count.hidden=unread===0}list.innerHTML=rows.length?rows.map(n=>`<a class="f2w-v170-note ${n.read_at?'read':'unread'}" href="${esc(n.link||'#')}" data-id="${esc(n.id)}"><strong>${esc(n.title||'Notification')}</strong><span>${esc(n.message||'')}</span><small>${esc(rel(n.created_at))}</small></a>`).join(''):'<div class="v17-notification-empty">No notifications yet.</div>'}
async function getSession(){const c=db();try{return(await c?.auth?.getSession?.())?.data?.session||null}catch{return null}}
async function load({quiet=false}={}){
  if(loading)return;const{list}=E();if(!list)return;loading=true;
  try{
    const s=await getSession();const id=s?.user?.id||'';
    if(!id){if(!quiet){rows=[];paint()}return}
    if(id!==uid){uid=id;rows=[];restore()}
    const c=db();const out=await c.rpc('get_my_notifications_v170',{p_limit:60});
    if(out?.error)throw out.error;
    const payload=out?.data&&typeof out.data==='object'?out.data:{};
    const fresh=Array.isArray(payload.rows)?payload.rows:[];
    // A successful canonical response is authoritative. Cache only after it arrives.
    rows=fresh;lastGoodAt=Date.now();paint();save();
  }catch(err){
    console.warn('v170 notifications load failed',err);
    if(!rows.length&&!quiet)list.innerHTML='<div class="v17-notification-empty">Could not load notifications. Click Notifications to retry.</div>';
  }finally{loading=false;if(open)setOpen(true)}
}
async function markAll(){
  const c=db();if(!c?.rpc)return;
  try{
    const out=await c.rpc('mark_my_notifications_read_v170');if(out?.error)throw out.error;
    const now=new Date().toISOString();rows=rows.map(n=>({...n,read_at:n.read_at||now}));paint();save();setOpen(true);
    setTimeout(()=>load({quiet:true}),200);
  }catch(err){console.warn('v170 mark-all-read failed',err);setOpen(true)}
}
async function bind(id){
  const c=db();if(channel){try{c?.removeChannel?.(channel)}catch{}channel=null}clearInterval(timer);uid=id||'';
  if(!uid){rows=[];paint();return}
  restore();
  try{channel=c.channel('f2w-v170-notify-'+uid).on('postgres_changes',{event:'*',schema:'public',table:'f2w_notifications_v125',filter:`user_id=eq.${uid}`},()=>load({quiet:true})).subscribe()}catch(e){console.warn('v170 notifications realtime',e)}
  timer=setInterval(()=>{if(open&&document.visibilityState==='visible')load({quiet:true})},30000);
  load({quiet:true});
}
function wire(){
  document.querySelectorAll('#notification-btn').forEach(b=>{b.removeAttribute('onclick');b.onclick=null});
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('#notification-btn');
    if(b){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();setOpen(!open);if(open){paint();load({quiet:false})}return}
    const mark=e.target.closest?.('#notification-menu .v17-notification-head button,[data-notifications-mark-read]');
    if(mark){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();markAll();return}
    if(open&&!e.target.closest?.('#notification-menu')&&!e.target.closest?.('#notification-btn'))setOpen(false);
  },true);
  document.addEventListener('keydown',e=>{if(open&&e.key==='Escape'){e.preventDefault();setOpen(false)}},true);
  window.toggleNotifications=e=>{e?.preventDefault?.();e?.stopPropagation?.();setOpen(!open);if(open){paint();load({quiet:false})}};
  window.markAllNotificationsRead=markAll;
  // Protect the content as well as the open state from legacy DOM writers.
  const mo=new MutationObserver(()=>{if(!open)return;const{list}=E();setOpen(true);if(list&&rows.length&&!list.querySelector('.f2w-v170-note'))paint()});
  mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','style','class']});
}
async function boot(){
  wire();const s=await getSession();const id=s?.user?.id||'';const{wrap}=E();if(wrap){wrap.hidden=!id;wrap.style.display=id?'block':'none'}if(id)bind(id);
  db()?.auth?.onAuthStateChange?.((_event,s2)=>{const n=s2?.user?.id||'';const{wrap}=E();if(wrap){wrap.hidden=!n;wrap.style.display=n?'block':'none'}if(n!==uid)bind(n);if(!n)setOpen(false)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
