(()=>{
'use strict';
if(window.__f2wV169Notifications)return;window.__f2wV169Notifications=true;
const URL='https://viqufxlcxwgboyxbdhjb.supabase.co',KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
let client=null,channel=null,timer=0,uid='',open=false,loading=false,rowsCache=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rel=v=>{const t=new Date(v).getTime(),d=Math.max(0,Date.now()-t);if(!Number.isFinite(t))return'';if(d<60000)return'just now';if(d<3600000)return Math.floor(d/60000)+'m ago';if(d<86400000)return Math.floor(d/3600000)+'h ago';return Math.floor(d/86400000)+'d ago'};
function db(){return client||(client=window.f2wSupabase||window.chatSupabase||window.supabaseClient||(window.supabase?.createClient?window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null))}
function els(){return{wrap:document.getElementById('notification-wrap'),btn:document.getElementById('notification-btn'),menu:document.getElementById('notification-menu'),list:document.getElementById('notification-list'),count:document.getElementById('notification-count')}}
function storageKey(){return 'f2w-notifications-v169:'+uid}
function save(){if(!uid)return;try{sessionStorage.setItem(storageKey(),JSON.stringify({rows:rowsCache,t:Date.now()}))}catch{}}
function restore(){if(!uid)return;try{const v=JSON.parse(sessionStorage.getItem(storageKey())||'null');if(v&&Array.isArray(v.rows)&&Date.now()-(v.t||0)<900000){rowsCache=v.rows;paint(rowsCache)}}catch{}}
function setOpen(v){open=!!v;const{menu,btn}=els();if(menu){menu.hidden=!open;menu.setAttribute('aria-hidden',open?'false':'true');menu.style.setProperty('display',open?'block':'none','important');menu.style.setProperty('visibility',open?'visible':'hidden','important');menu.style.setProperty('opacity',open?'1':'0','important');menu.style.setProperty('pointer-events',open?'auto':'none','important')}btn?.setAttribute('aria-expanded',open?'true':'false')}
function paint(rows){if(Array.isArray(rows))rowsCache=rows;const{list,count}=els();if(!list)return;const unread=rowsCache.filter(n=>!n.read_at).length;if(count){count.textContent=String(unread);count.hidden=unread===0}list.innerHTML=rowsCache.length?rowsCache.map(n=>`<a class="f2w-v169-note ${n.read_at?'read':'unread'}" href="${esc(n.link||'#')}" data-id="${esc(n.id)}"><strong>${esc(n.title||'Notification')}</strong><span>${esc(n.message||'')}</span><small>${esc(rel(n.created_at))}</small></a>`).join(''):'<div class="v17-notification-empty">No notifications yet.</div>'}
async function session(){try{return(await db()?.auth?.getSession())?.data?.session||null}catch{return null}}
async function query(){const c=db();if(!c?.rpc)return{data:null,error:new Error('Notifications unavailable')};for(const [fn,args] of [['get_my_notifications_v125',{p_limit:60}],['get_my_notifications_v166',{p_limit:60}],['get_my_notifications_v161',{p_limit:60}],['get_my_notifications_v160',{p_limit:60}]]){try{const out=await c.rpc(fn,args);if(!out?.error)return out;if(!['PGRST202','42883'].includes(out.error.code))return out}catch{}}return{data:null,error:new Error('No notification RPC available')}}
async function load({silent=false,allowEmpty=false}={}){if(loading)return;const{list}=els();if(!list)return;loading=true;try{const s=await session(),id=s?.user?.id||'';if(!id){if(!silent)list.innerHTML='<div class="v17-notification-empty">Sign in to view notifications.</div>';return}if(id!==uid){uid=id;restore()}const out=await query();if(out.error)throw out.error;const rows=Array.isArray(out.data)?out.data:[];
    // Never erase a non-empty visible/cache list because of a transient empty response.
    if(rows.length===0&&rowsCache.length&&!allowEmpty){save();return}
    paint(rows);save();
  }catch(e){console.warn('v169 notifications load',e);if(!silent&&!rowsCache.length)list.innerHTML='<div class="v17-notification-empty">Could not load notifications. Click Notifications to retry.</div>'}finally{loading=false;if(open)setOpen(true)}}
async function markAll(){const c=db();if(!c?.rpc)return;try{let ok=false;for(const fn of ['mark_my_notifications_read_v125','mark_my_notifications_read_v166','mark_my_notifications_read_v161','mark_my_notifications_read_v160']){try{const out=await c.rpc(fn);if(!out?.error){ok=true;break}if(!['PGRST202','42883'].includes(out.error.code))throw out.error}catch(e){if(fn==='mark_my_notifications_read_v160')throw e}}if(!ok)throw new Error('No mark-read RPC available');const now=new Date().toISOString();rowsCache=rowsCache.map(n=>({...n,read_at:n.read_at||now}));paint(rowsCache);save();setOpen(true);setTimeout(()=>load({silent:true,allowEmpty:false}),250)}catch(e){console.warn('v169 mark all read failed',e);setOpen(true)}}
async function bind(id){const c=db();if(channel){try{c.removeChannel(channel)}catch{}channel=null}clearInterval(timer);uid=id||'';if(!uid){rowsCache=[];paint([]);return}restore();try{channel=c.channel('f2w-v169-notify-'+uid).on('postgres_changes',{event:'*',schema:'public',table:'f2w_notifications_v125',filter:`user_id=eq.${uid}`},()=>load({silent:true})).subscribe()}catch(e){console.warn('v169 realtime',e)}timer=setInterval(()=>{if(open&&document.visibilityState==='visible')load({silent:true})},30000);load({silent:true})}
function wire(){
  // Replace old inline handlers and take final authority over the menu.
  document.querySelectorAll('#notification-btn').forEach(b=>b.removeAttribute('onclick'));
  document.addEventListener('click',e=>{const b=e.target.closest?.('#notification-btn');if(b){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();setOpen(!open);if(open){paint(rowsCache);load({silent:false})}return}const mark=e.target.closest?.('#notification-menu .v17-notification-head button,[data-notifications-mark-read]');if(mark){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();markAll();return}if(open&&!e.target.closest?.('#notification-menu')&&!e.target.closest?.('#notification-btn'))setOpen(false)},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open){e.preventDefault();setOpen(false)}},true);
  window.toggleNotifications=e=>{e?.preventDefault?.();e?.stopPropagation?.();setOpen(!open);if(open){paint(rowsCache);load({silent:false})}};
  window.markAllNotificationsRead=markAll;
  // If any legacy script writes "No notifications yet" over real rows, repaint ours immediately.
  const mo=new MutationObserver(()=>{const{menu,list}=els();if(open){setOpen(true);if(list&&rowsCache.length&&!list.querySelector('.f2w-v169-note'))paint(rowsCache)}});
  mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','style','class']});
}
async function boot(){wire();const s=await session(),id=s?.user?.id||'',{wrap}=els();if(wrap){wrap.hidden=!id;wrap.style.display=id?'block':'none'}if(id)bind(id);db()?.auth?.onAuthStateChange?.((_e,s2)=>{const n=s2?.user?.id||'';if(wrap){wrap.hidden=!n;wrap.style.display=n?'block':'none'}if(n!==uid)bind(n);if(!n)setOpen(false)})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
