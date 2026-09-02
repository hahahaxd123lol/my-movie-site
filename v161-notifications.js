(()=>{
'use strict';
if(window.__f2wV161Notifications)return;window.__f2wV161Notifications=true;
const URL='https://viqufxlcxwgboyxbdhjb.supabase.co',KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
let channel=null,timer=0,currentUid='',loading=false,menuOpen=false,client=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rel=v=>{const t=new Date(v).getTime(),d=Math.max(0,Date.now()-t);if(!Number.isFinite(t))return'';if(d<60000)return'just now';if(d<3600000)return Math.floor(d/60000)+'m ago';if(d<86400000)return Math.floor(d/3600000)+'h ago';return Math.floor(d/86400000)+'d ago'};
function db(){return client||(client=window.f2wSupabase||window.chatSupabase||window.supabaseClient||(window.supabase?.createClient?window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null))}
function els(){return {wrap:document.getElementById('notification-wrap'),btn:document.getElementById('notification-btn'),menu:document.getElementById('notification-menu'),list:document.getElementById('notification-list'),count:document.getElementById('notification-count')}}
function paintOpen(open){const {menu,btn}=els();menuOpen=!!open;if(menu){menu.hidden=!menuOpen;menu.style.display=menuOpen?'block':'none';menu.setAttribute('aria-hidden',menuOpen?'false':'true')}if(btn)btn.setAttribute('aria-expanded',menuOpen?'true':'false')}
async function session(){try{return (await db()?.auth?.getSession())?.data?.session||null}catch{return null}}
async function load({quiet=false}={}){if(loading)return;const c=db(),{list,count}=els();if(!c?.rpc||!list)return;loading=true;try{
  let out=await c.rpc('get_my_notifications_v161',{p_limit:60});
  if(out?.error?.code==='PGRST202'||out?.error?.code==='42883')out=await c.rpc('get_my_notifications_v160',{p_limit:60});
  if(out?.error)throw out.error;
  const rows=Array.isArray(out.data)?out.data:[];const unread=rows.reduce((n,x)=>n+(!x.read_at?1:0),0);
  if(count){count.textContent=String(unread);count.hidden=unread===0}
  list.innerHTML=rows.length?rows.map(n=>`<a class="f2w-v161-notification ${n.read_at?'read':'unread'}" data-notification-id="${esc(n.id)}" href="${esc(n.link||'#')}"><strong>${esc(n.title||'Notification')}</strong><span>${esc(n.message||'')}</span><small>${esc(rel(n.created_at))}</small></a>`).join(''):'<div class="v17-notification-empty">No notifications yet.</div>';
}catch(e){console.warn('v161 notifications load',e);if(!quiet)list.innerHTML='<div class="v17-notification-empty">Could not load notifications. Click Notifications to retry.</div>'}finally{loading=false;if(menuOpen)paintOpen(true)}}
async function markAll(){const c=db();if(!c?.rpc)return;const {btn}=els();btn?.setAttribute('aria-busy','true');try{
  let out=await c.rpc('mark_my_notifications_read_v161');
  if(out?.error?.code==='PGRST202'||out?.error?.code==='42883')out=await c.rpc('mark_my_notifications_read_v160');
  if(out?.error)throw out.error;await load();paintOpen(true);
}catch(e){console.warn('v161 mark read',e)}finally{btn?.removeAttribute('aria-busy')}}
async function bind(uid){const c=db();if(!c)return;if(channel){try{c.removeChannel(channel)}catch{}channel=null}clearInterval(timer);currentUid=uid||'';if(!currentUid)return;
 try{channel=c.channel('f2w-v161-notifications-'+currentUid).on('postgres_changes',{event:'*',schema:'public',table:'f2w_notifications_v125',filter:`user_id=eq.${currentUid}`},()=>load({quiet:true})).subscribe()}catch(e){console.warn('v161 realtime notifications',e)}
 timer=setInterval(()=>{if(document.visibilityState==='visible'&&menuOpen)load({quiet:true})},30000);load({quiet:true});
}
async function syncAuth(){const s=await session(),logged=!!s?.user,uid=s?.user?.id||'';const {wrap}=els();if(wrap){wrap.hidden=!logged;wrap.style.display=logged?'block':'none'}if(!logged){paintOpen(false);if(currentUid)bind('');return}if(uid!==currentUid)bind(uid)}
function wire(){document.querySelectorAll('#notification-btn').forEach(b=>b.removeAttribute('onclick'));document.querySelectorAll('#notification-menu .v17-notification-head button').forEach(b=>b.removeAttribute('onclick'));
 document.addEventListener('click',e=>{
   const btn=e.target.closest?.('#notification-btn');if(btn){e.preventDefault();e.stopImmediatePropagation();paintOpen(!menuOpen);if(menuOpen)load();return}
   const mark=e.target.closest?.('#notification-menu .v17-notification-head button');if(mark){e.preventDefault();e.stopImmediatePropagation();markAll();return}
   if(menuOpen&&!e.target.closest?.('#notification-wrap'))paintOpen(false);
 },true);
 window.toggleNotifications=e=>{e?.preventDefault?.();e?.stopPropagation?.();paintOpen(!menuOpen);if(menuOpen)load()};
 window.markAllNotificationsRead=markAll;
 const mo=new MutationObserver(()=>{const {menu}=els();if(menu&&menuOpen&&menu.hidden)paintOpen(true)});mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','style']});
}
async function boot(){wire();await syncAuth();const c=db();c?.auth?.onAuthStateChange?.((_e,s)=>{const uid=s?.user?.id||'';const {wrap}=els();if(wrap){wrap.hidden=!uid;wrap.style.display=uid?'block':'none'}if(uid!==currentUid)bind(uid);if(!uid)paintOpen(false)});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){syncAuth();if(menuOpen)load({quiet:true})}},{passive:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
