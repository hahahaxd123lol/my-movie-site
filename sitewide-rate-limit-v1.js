/* Staff/owner bypass for the sitewide 30-second interaction lock. */
/* Flix2Watch sitewide interaction rate limiter.
 * Client-side deterrence only; enforce sensitive-operation limits on the server too.
 */
(()=>{
  'use strict';
  if(window.__f2wSitewideRateLimitV1)return;
  window.__f2wSitewideRateLimitV1=true;

  const KEY='f2w_sitewide_rate_limit_v1';
  const LIMIT=5, WINDOW_MS=10000, LOCK_MS=30000;
  let memory={events:[],until:0};
  let notice=null, ticker=null;
  let staffStatus='checking';
  let staffBypass=false;
  let staffCheckPromise=null;

  function getClient(){
    return window.f2wSupabase||window.chatSupabase||window.supabaseClient||window.__supabaseClient||null;
  }
  async function resolveStaffBypass(){
    if(staffCheckPromise)return staffCheckPromise;
    staffCheckPromise=(async()=>{
      let client=null;
      for(let i=0;i<40;i++){
        client=getClient();
        if(client?.auth?.getSession&&client?.from)break;
        await new Promise(resolve=>setTimeout(resolve,250));
      }
      if(!client?.auth?.getSession){staffStatus='ready';render();return false;}
      try{
        const {data,error}=await client.auth.getSession();
        const user=data?.session?.user;
        if(error||!user){staffStatus='ready';render();return false;}
        let isStaff=(String(user.id).toLowerCase()==='f5454804-a2a6-4602-9086-51cf51f11c77');
        try{
          const result=await client.from('chat_moderators').select('user_id').eq('user_id',user.id).maybeSingle();
          if(!result.error&&result.data)isStaff=true;
        }catch{}
        if(!isStaff&&client.rpc){
          try{
            const {data:access,error:rpcError}=await client.rpc('get_staff_page_access_v123');
            if(!rpcError&&access&&['owner','staff'].includes(String(access.role||'').toLowerCase()))isStaff=true;
          }catch{}
        }
        staffBypass=isStaff;
      }catch{}
      staffStatus='ready';
      if(staffBypass){
        writeState({events:[],until:0});
        if(notice)notice.style.display='none';
        if(ticker){clearInterval(ticker);ticker=null;}
      }else render();
      return staffBypass;
    })();
    try{return await staffCheckPromise;}finally{staffCheckPromise=null;}
  }
  function bindStaffAuth(){
    const client=getClient();
    if(client?.auth?.onAuthStateChange&&!client.__f2wRateLimitStaffAuthBound){
      client.__f2wRateLimitStaffAuthBound=true;
      client.auth.onAuthStateChange((_event,session)=>{
        staffStatus='checking';
        staffBypass=false;
        staffCheckPromise=null;
        if(!session?.user){staffStatus='ready';render();return;}
        void resolveStaffBypass();
      });
    }
  }
  function bypassActive(){return staffBypass;}

  function readState(){
    try{
      const v=JSON.parse(localStorage.getItem(KEY)||'null');
      if(v&&Array.isArray(v.events))return {events:v.events.filter(Number.isFinite),until:Number(v.until)||0};
    }catch{}
    return memory;
  }
  function writeState(state){
    memory=state;
    try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}
  }
  function secondsLeft(){
    const s=readState();
    return Math.max(0,Math.ceil((s.until-Date.now())/1000));
  }
  function ensureNotice(){
    if(notice||!document.body)return notice;
    notice=document.createElement('div');
    notice.id='f2w-sitewide-rate-limit-notice-v1';
    notice.setAttribute('role','alert');
    notice.setAttribute('aria-live','assertive');
    notice.style.cssText='position:fixed;z-index:2147483647;top:12px;left:50%;transform:translateX(-50%);width:min(560px,calc(100vw - 24px));padding:14px 18px;border:1px solid #ff5267;border-radius:12px;background:#170b12;color:#fff;box-shadow:0 12px 40px #0009;font:700 14px/1.45 system-ui,sans-serif;text-align:center;display:none;pointer-events:none';
    document.body.appendChild(notice);
    return notice;
  }
  function render(){
    const left=secondsLeft();
    const n=ensureNotice();
    if(n){
      n.style.display=left>0?'block':'none';
      n.textContent=left>0?'Too many actions in a short time. Sitewide rate limit active — wait '+left+'s before trying again.':'';
    }
    if(left>0&&!ticker)ticker=setInterval(()=>{
      if(secondsLeft()<=0){clearInterval(ticker);ticker=null;}
      render();
    },1000);
    if(left<=0&&ticker){clearInterval(ticker);ticker=null;}
  }
  function locked(){return !bypassActive()&&secondsLeft()>0}
  function startLock(){
    writeState({events:[],until:Date.now()+LOCK_MS});
    render();
  }
  function recordAction(){
    if(bypassActive())return true;
    const now=Date.now(),state=readState();
    if(state.until>now){render();return false}
    const events=state.events.filter(t=>now-t>=0&&now-t<WINDOW_MS);
    events.push(now);
    if(events.length>LIMIT){startLock();return false}
    writeState({events,until:0});
    return true;
  }
  function stop(event){
    try{event.preventDefault()}catch{}
    try{event.stopImmediatePropagation()}catch{}
    try{event.stopPropagation()}catch{}
  }
  function targetElement(target){
    return target&&target.nodeType===1?target:target?.parentElement||null;
  }
  function isSubmitControl(el){
    if(!el)return false;
    if(el.matches('input[type="submit"],input[type="image"]'))return true;
    if(el.matches('button')&&el.form){
      const type=(el.getAttribute('type')||'submit').toLowerCase();
      return type==='submit';
    }
    return false;
  }
  const actionable='a[href],button,input[type="button"],input[type="submit"],input[type="image"],[role="button"],[role="tab"],[role="menuitem"],[data-rate-limit-action]';
  document.addEventListener('click',event=>{
    if(locked()){stop(event);return}
    const el=targetElement(event.target)?.closest?.(actionable);
    if(!el||el.disabled||el.getAttribute('aria-disabled')==='true')return;
    if(isSubmitControl(el))return;
    if(el.matches('input[type="checkbox"],input[type="radio"],select'))return;
    if(!recordAction())stop(event);
  },true);
  document.addEventListener('submit',event=>{
    if(locked()||!recordAction())stop(event);
  },true);
  document.addEventListener('change',event=>{
    const el=targetElement(event.target);
    if(!el||!el.matches('input[type="checkbox"],input[type="radio"],select'))return;
    if(locked()||!recordAction()){
      if(el.matches('input[type="checkbox"],input[type="radio"]'))el.checked=!el.checked;
      stop(event);
    }
  },true);
  window.addEventListener('storage',event=>{if(event.key===KEY&&!bypassActive())render()});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});
  else render();
  void resolveStaffBypass();
})();
