(() => {

function f2wDebounce(fn,wait=140){
  let t=null;
  return function(...args){
    clearTimeout(t);
    t=setTimeout(()=>fn.apply(this,args),wait);
  };
}
  'use strict';

  const SUPABASE_URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
  const SUPABASE_KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
  const CHAT_API_URL=`${SUPABASE_URL}/functions/v1/rapid-worker`;
  const RED_LOGO='/flix2watch-logo-red-v34.png';
  const ROLE_PRIORITY=['owner','staff','moderator','support','developer','verified','contributor','curator'];
  let fallbackClient=null;
  let authUser=null;
  let presenceTimer=null;
  let presenceSessionId='';
  let watchTimeTimer=null;
  let watchOpenRecordedKey='';
  let profileRealtimeChannel=null;
  let profileUiTimer=null;
  let accountBanChannel=null;
  let activityChannel=null;
  let roleDecorateTimer=null;
  let staffSnapshotId='';

  function db(){
    try{ if(typeof chatSupabase!=='undefined'&&chatSupabase)return chatSupabase; }catch{}
    try{ if(typeof window.db!=='undefined'&&window.db)return window.db; }catch{}
    try{ if(typeof globalThis.db!=='undefined'&&globalThis.db)return globalThis.db; }catch{}
    if(fallbackClient)return fallbackClient;
    try{
      if(window.supabase?.createClient){
        fallbackClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
        return fallbackClient;
      }
    }catch{}
    return null;
  }

  function esc(value=''){
    return String(value).replace(/[&<>"']/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[ch]));
  }

  function initials(value='?'){
    return String(value||'?').trim().replace(/^@/,'').slice(0,2).toUpperCase()||'?';
  }

  function toast(message){
    try{ if(typeof window.toast==='function'){ window.toast(String(message)); return; } }catch{}
    try{ if(typeof window.f2wToast==='function'){ window.f2wToast(String(message),'fa-bolt'); return; } }catch{}
    document.querySelector('.f2w-toast')?.remove();
    const el=document.createElement('div');
    el.className='f2w-toast';
    el.textContent=String(message||'Updated');
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),3200);
  }

  async function rpc(name,args={}){
    const client=db();
    if(!client)throw new Error('Site database is not ready.');
    const {data,error}=await client.rpc(name,args);
    if(error)throw error;
    return data;
  }

  async function worker(action,payload={},accessToken=''){
    const headers={'Content-Type':'application/json'};
    if(accessToken)headers.Authorization=`Bearer ${accessToken}`;
    const response=await fetch(CHAT_API_URL,{
      method:'POST',
      headers,
      cache:'no-store',
      body:JSON.stringify({action,...payload})
    });
    const result=await response.json().catch(()=>({success:false,error:`HTTP ${response.status}`}));
    if(!response.ok||result?.success===false){
      const error=new Error(result?.error||`Worker returned HTTP ${response.status}`);
      error.code=result?.code||'';
      error.status=response.status;
      throw error;
    }
    return result;
  }


  /* ---------- BAN-EVASION / DEVICE SIGNAL GUARD ---------- */
  function f2wDeviceId(){
    const key='f2w_device_id_v1';
    try{
      let value=localStorage.getItem(key);
      if(!value){
        value=(crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
        localStorage.setItem(key,value);
      }
      return value;
    }catch{
      return 'storage-unavailable';
    }
  }

  function f2wBrowserFingerprint(){
    const s=window.screen||{};
    const n=window.navigator||{};
    const parts=[
      n.userAgent||'',
      n.platform||'',
      n.language||'',
      Array.isArray(n.languages)?n.languages.join(','):'',
      String(n.hardwareConcurrency||''),
      String(n.deviceMemory||''),
      String(n.maxTouchPoints||''),
      `${s.width||0}x${s.height||0}x${s.colorDepth||0}`,
      Intl.DateTimeFormat().resolvedOptions().timeZone||'',
      String(window.devicePixelRatio||1)
    ];
    return parts.join('|');
  }

  function abusePayload(){
    return {
      device_id:f2wDeviceId(),
      fingerprint:f2wBrowserFingerprint()
    };
  }

  async function abusePreflight(){
    return worker('abuse_preflight',abusePayload());
  }

  async function registerCurrentAbuseSignals(){
    const client=db();
    if(!client)return;
    const {data:{session}}=await client.auth.getSession();
    if(!session?.access_token)return;
    try{
      await worker('abuse_register',abusePayload(),session.access_token);
    }catch(error){
      if(error?.code==='BAN_EVASION_BLOCKED'){
        try{await client.auth.signOut()}catch{}
        try{toast(error.message||'This device is blocked from creating another account.')}catch{}
        try{window.openHeaderAuth?.('login')}catch{}
      }
    }
  }

  let abuseGuardInstalled=false;
  function installAuthAbuseGuard(){
    if(abuseGuardInstalled)return;
    const client=db();
    if(!client?.auth)return;

    abuseGuardInstalled=true;

    if(typeof client.auth.signUp==='function'&&!client.auth.signUp.__f2wGuarded){
      const originalSignUp=client.auth.signUp.bind(client.auth);
      const guarded=async(credentials)=>{
        try{
          await abusePreflight();
        }catch(error){
          return {data:{user:null,session:null},error};
        }
        const result=await originalSignUp(credentials);
        if(!result?.error)setTimeout(registerCurrentAbuseSignals,250);
        return result;
      };
      guarded.__f2wGuarded=true;
      client.auth.signUp=guarded;
    }

    if(typeof client.auth.signInWithOAuth==='function'&&!client.auth.signInWithOAuth.__f2wGuarded){
      const originalOAuth=client.auth.signInWithOAuth.bind(client.auth);
      const guardedOAuth=async(options)=>{
        try{
          await abusePreflight();
        }catch(error){
          return {data:{provider:null,url:null},error};
        }
        try{sessionStorage.setItem('f2w_abuse_oauth_pending','1')}catch{}
        return originalOAuth(options);
      };
      guardedOAuth.__f2wGuarded=true;
      client.auth.signInWithOAuth=guardedOAuth;
    }
  }

  window.__f2wAbuseGuard={
    deviceId:f2wDeviceId,
    fingerprint:f2wBrowserFingerprint,
    preflight:abusePreflight,
    register:registerCurrentAbuseSignals
  };

  /* ---------- LOGIN: preserve existing signup/session flow, add username ---------- */
  window.f2wLoginIdentifier=async function(identifier,password){
    const client=db();
    if(!client)return {data:null,error:new Error('Authentication is not ready.')};
    const clean=String(identifier||'').trim();
    try{
      const result=await worker('login_identifier',{identifier:clean,password:String(password||''),...abusePayload()});
      const {data,error}=await client.auth.setSession({
        access_token:String(result.access_token||''),
        refresh_token:String(result.refresh_token||'')
      });
      if(error)throw error;
      return {data:{user:data?.user||result.user,session:data?.session||null},error:null};
    }catch(error){
      /* Never bypass a deliberate moderation / ban-evasion decision. */
      if(error?.code==='BAN_EVASION_BLOCKED'||error?.code==='ACCOUNT_BANNED'||error?.status===403){
        return {data:null,error};
      }
      /* Email logins keep the old direct path only for genuine deployment/network failures. */
      if(clean.includes('@')){
        try{
          await abusePreflight();
          const direct=await client.auth.signInWithPassword({email:clean,password:String(password||'')});
          if(!direct.error){
            setTimeout(registerCurrentAbuseSignals,250);
            return direct;
          }
        }catch(policyError){
          return {data:null,error:policyError};
        }
      }
      return {data:null,error};
    }
  };

  /* ---------- brand / nav ---------- */
  function forceRedLogo(){
    document.querySelectorAll('img').forEach(img=>{
      const src=String(img.getAttribute('src')||'');
      if(/flix2watch-logo-(red|blue|green|purple|amber|matrix|cyan|pink|orange|ice|gold|midnight)-v\d+\.png/i.test(src)||/flix2watch-logo\.png$/i.test(src)){
        if(img.getAttribute('src')!==RED_LOGO)img.setAttribute('src',RED_LOGO);
        img.dataset.f2wLogo='red';
      }
    });
  }

  function addLeaderboardNav(){
    document.querySelectorAll('.f2w-primary-nav').forEach(nav=>{
      if(nav.querySelector('[data-v35-leaderboard]'))return;
      const a=document.createElement('a');
      a.className='f2w-nav-link';
      a.href='/leaderboard/';
      a.dataset.v35Leaderboard='1';
      a.innerHTML='<i class="fa-solid fa-trophy"></i> Leaderboard';
      const forum=nav.querySelector('#f2w-nav-forum');
      nav.insertBefore(a,forum||null);
    });
    document.querySelectorAll('footer').forEach(footer=>{
      if(footer.querySelector('[data-v35-privacy]'))return;
      const a=document.createElement('a');
      a.href='/privacy/';a.textContent='Privacy';a.dataset.v35Privacy='1';
      a.style.marginLeft='12px';
      footer.appendChild(a);
    });
  }

  function setStaffNav(allowed){
    document.querySelectorAll('#staff-control-nav,#account-staff-control').forEach(el=>{
      if(allowed){
        el.hidden=false;el.removeAttribute('aria-disabled');el.removeAttribute('tabindex');
        el.style.removeProperty('display');
        if(el.id==='staff-control-nav')el.onclick=()=>{window.location.href='/staff/'};
      }else{
        el.hidden=true;el.setAttribute('aria-disabled','true');el.setAttribute('tabindex','-1');
        el.style.setProperty('display','none','important');
      }
    });
  }

  async function syncAuthUI(){
    const client=db();
    if(!client)return;
    const {data}=await client.auth.getUser();
    authUser=data?.user||null;
    document.body?.classList.toggle('f2w-authenticated',Boolean(authUser));
    if(!authUser){
      setStaffNav(false);
      stopPresence();

      // v44: logged-out header still exposes useful navigation.
      const fav=document.getElementById('favorites-nav-btn');
      const profile=document.getElementById('profile-nav-btn');
      const support=document.getElementById('support-nav-btn');
      if(fav){fav.style.removeProperty('display');fav.hidden=false;}
      if(profile){profile.style.removeProperty('display');profile.hidden=false;}
      if(support){support.style.removeProperty('display');support.hidden=false;}
      return;
    }
    startPresence();
    subscribeAccountLoginBan();
    try{
      const context=await rpc('get_staff_context');
      setStaffNav(['owner','staff'].includes(context?.role));
    }catch{ setStaffNav(false); }
  }

  /* ---------- chat pre-load and POST list compatibility ---------- */
  async function prewarmChat(){
    try{
      const snapshot=await worker('list');
      sessionStorage.setItem('f2w_chat_snapshot_v35',JSON.stringify({at:Date.now(),snapshot}));
      window.__flix2watchPreloadedChat=snapshot;
      window.dispatchEvent(new CustomEvent('flix2watch:chat-preloaded',{detail:snapshot}));
    }catch(error){
      console.warn('Chat pre-load unavailable:',error?.message||error);
    }
  }

  /* ---------- presence ---------- */
  async function touchPresence(){
    if(!authUser||document.visibilityState==='hidden')return;
    const client=db();if(!client)return;
    if(!presenceSessionId){
      try{
        presenceSessionId=sessionStorage.getItem('f2w_presence_session_v17')||'';
        if(!presenceSessionId){
          presenceSessionId=crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
          sessionStorage.setItem('f2w_presence_session_v17',presenceSessionId);
        }
      }catch{
        presenceSessionId=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
    }
    try{await client.rpc('touch_presence_v17',{p_session_id:presenceSessionId});}
    catch{try{await client.rpc('touch_presence');}catch{}}
  }
  function startPresence(){
    if(presenceTimer)return;
    touchPresence();
    presenceTimer=setInterval(touchPresence,30000);
  }
  function stopPresence(){
    if(presenceTimer){clearInterval(presenceTimer);presenceTimer=null;}
  }

  async function leavePresence(){
    if(!authUser||!presenceSessionId)return;
    const client=db();if(!client)return;
    try{
      await client.rpc('leave_presence_v17',{p_session_id:presenceSessionId});
    }catch{}
  }

  /* ---------- account login ban realtime ---------- */
  function subscribeAccountLoginBan(){
    const client=db();
    if(!client||!authUser)return;
    try{ if(accountBanChannel)client.removeChannel(accountBanChannel); }catch{}
    try{
      accountBanChannel=client.channel(`v35-login-ban-${authUser.id}`)
        .on('postgres_changes',{event:'*',schema:'public',table:'account_login_bans',filter:`user_id=eq.${authUser.id}`},async payload=>{
          if(payload.eventType==='DELETE')return;
          const row=payload.new||{};
          if(row.expires_at&&new Date(row.expires_at)<=new Date())return;
          showAccountBanScreen(row.reason||'This account has been banned.');
          try{await client.auth.signOut();}catch{}
        }).subscribe();
    }catch{}
  }

  function showAccountBanScreen(reason){
    let overlay=document.getElementById('v35-account-ban');
    if(!overlay){
      overlay=document.createElement('div');overlay.id='v35-account-ban';
      overlay.style.cssText='position:fixed;inset:0;z-index:100500;background:#03060b;display:grid;place-items:center;padding:20px';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML=`<div style="width:min(520px,100%);border:1px solid #6d1018;border-radius:20px;background:linear-gradient(145deg,#13070a,#07111d);padding:34px;text-align:center;color:#fff"><div style="margin:auto;width:72px;height:72px;border:1px solid #e50914;border-radius:20px;display:grid;place-items:center;color:#ff2532;font-size:30px"><i class="fa-solid fa-lock"></i></div><h1 style="margin:22px 0 9px">Account banned</h1><p style="color:#9aaabd;line-height:1.65">${esc(reason)}</p><p style="color:#64748b;font-size:.8rem">Contact Support if you believe this was applied in error.</p></div>`;
  }

  /* ---------- role name effects ---------- */
  window.__f2wRoleCacheV103=window.__f2wRoleCacheV103||new Map();

  function roleClass(role){return ROLE_PRIORITY.includes(role)?`f2w-role-${role}`:'';}
  function clearRoleEffect(el){
    if(!el)return;
    el.classList.remove('f2w-role-name',...ROLE_PRIORITY.map(role=>`f2w-role-${role}`));
    delete el.dataset.f2wRole;
  }
  function applyRoleEffect(el,role){
    if(!el)return;
    clearRoleEffect(el);
    if(!role)return;
    el.classList.add('f2w-role-name',roleClass(role));
    el.dataset.f2wRole=role;
  }
  function paintRoleName(el,role,username){
    if(!el||!role)return;
    role=String(role||'').trim().toLowerCase();

    const aliases={
      'website owner':'owner','site owner':'owner','owner':'owner',
      'staff':'staff','moderator':'moderator','mod':'moderator',
      'support':'support','developer':'developer','verified':'verified',
      'contributor':'contributor','curator':'curator'
    };
    role=aliases[role]||role;

    const allowed=['owner','staff','moderator','support','developer','verified','contributor','curator'];
    if(!allowed.includes(role))return;

    // Undo older wrapper-based versions once, then never rebuild the text again.
    const oldText=el.querySelector?.('.f2w-role-name-text')?.textContent;
    if(oldText){
      el.textContent=oldText;
    }

    allowed.forEach(r=>el.classList.remove(`f2w-role-${r}`));

    // v83: a name may have been painted white while role data was still loading.
    // Remove those old inline !important values BEFORE applying the real role.
    el.style.removeProperty('color');
    el.style.removeProperty('-webkit-text-fill-color');
    el.style.removeProperty('text-shadow');
    el.style.removeProperty('background');
    el.style.removeProperty('background-image');
    el.style.removeProperty('filter');

    el.classList.remove('f2w-no-role-name');
    el.classList.add('f2w-role-name',`f2w-role-${role}`);
    el.dataset.f2wRoleDecorated='1';
    el.dataset.f2wResolvedRole=role;
    try{
      const key=String(username||el.dataset.username||el.dataset.f2wUsername||'').trim().toLowerCase();
      if(key)window.__f2wRoleCacheV103?.set(key,role);
    }catch{}
    el.dataset.f2wRole=role;
    if(username)el.dataset.username=String(username).replace(/^@/,'');
    el.style.setProperty('--f2w-particles-url','url("https://i.ibb.co/HC3GW9B/Particles.gif")');
  }
  window.f2wPaintRoleName=paintRoleName;
  async function decorateNames(){
    const selector=[
      '#profile-name',
      '#profile-username-line',
      '#account-user-username',
      '.chat-user',
      '.chat-username',
      '.comment-author',
      '.leaderboard-username',
      '.user-name',
      '.username',
      '.display-name',
      '.f2w-user-handle',
      '.user-search-name',
      '.user-search-sub',
      '.forum-v30-author',
      '.forum-v30-rank-name',
      '[data-f2w-dm-display-name]'
    ].join(',');

    // v90: role particles belong ONLY to display-name leaf elements.
    // Strip old accidental role decoration from rows/cards/containers first.
    const forbidden=[
      '.user-search-result',
      '.user-search-copy',
      '.v17-dm-conversation',
      '.v17-dm-conversation-copy',
      '.v17-dm-conversation-meta',
      '.f2w-user-card',
      '.forum-v30-rank-row',
      '.leaderboard-row',
      '[data-username]:not(.user-search-name):not(.user-search-sub):not(.display-name):not(.username):not(.f2w-user-handle):not(.chat-user):not(.chat-username):not(.comment-author):not(.leaderboard-username):not(.forum-v30-author):not(.forum-v30-rank-name):not(#profile-name):not(#profile-username-line):not(#account-user-username):not([data-f2w-dm-display-name])',
      '[data-f2w-username]:not(.user-search-name):not(.user-search-sub):not(.display-name):not(.username):not(.f2w-user-handle):not(.chat-user):not(.chat-username):not(.comment-author):not(.leaderboard-username):not(.forum-v30-author):not(.forum-v30-rank-name):not(#profile-name):not(#profile-username-line):not(#account-user-username):not([data-f2w-dm-display-name])'
    ].join(',');

    document.querySelectorAll(forbidden).forEach(node=>{
      clearRoleEffect(node);
      node.classList.remove('f2w-no-role-name');
      node.removeAttribute('data-f2w-role-decorated');
      node.style.removeProperty('--f2w-particles-url');
      node.style.removeProperty('background');
      node.style.removeProperty('background-image');
      node.style.removeProperty('filter');
    });

    const nodes=[...document.querySelectorAll(selector)].filter(Boolean);
    if(!nodes.length)return;

    const accountName=document.getElementById('account-user-username');
    const accountRole=String(document.getElementById('account-user-role')?.textContent||'').trim().toLowerCase();
    if(accountName && ['owner','staff','moderator','support','developer','verified','contributor','curator'].includes(accountRole)){
      const username=String(accountName.dataset.username||accountName.textContent||'').trim().replace(/^@/,'');
      accountName.classList.remove('f2w-no-role-name');
      if(!accountName.dataset.f2wRoleDecorated || accountName.dataset.f2wRole!==accountRole){
        accountName.dataset.f2wPlainText=accountName.querySelector('.f2w-role-name-text')?.textContent||accountName.textContent;
        paintRoleName(accountName,accountRole,username);
      }
    }

    const pending=[...document.querySelectorAll(selector)].filter(el=>!el.dataset.f2wRoleDecorated);
    if(!pending.length)return;

    const usernames=[...new Set(pending.map(el=>String(
      el.dataset.username||
      el.dataset.f2wUsername||
      el.getAttribute('data-user')||
      el.textContent||
      ''
    ).trim().replace(/^@/,'').split(/\s+/)[0]).filter(Boolean))];

    let effects={};
    if(usernames.length){
      try{
        const client=db();
        if(client){
          const {data,error}=await client.rpc('get_public_name_effects',{p_usernames:usernames});
          if(error)throw error;
          if(Array.isArray(data)){
            data.forEach(row=>{
              const key=String(row.username||'').trim().toLowerCase();
              if(key)effects[key]=String(row.top_role||'').trim().toLowerCase();
            });
          }
        }
      }catch(error){
        console.warn('Could not load public name effects:',error);
      }
    }

    pending.forEach(el=>{
      const username=String(
        el.dataset.username||
        el.dataset.f2wUsername||
        el.getAttribute('data-user')||
        el.textContent||
        ''
      ).trim().replace(/^@/,'').split(/\s+/)[0];

      let role=String(el.dataset.role||effects[username.toLowerCase()]||'').trim().toLowerCase();
      if(String(el.dataset.userId||el.getAttribute('data-user-id')||'')==='f5454804-a2a6-4602-9086-51cf51f11c77')role='owner';

      if(role){
        el.classList.remove('f2w-no-role-name');
        paintRoleName(el,role,username);
      }else{
        el.classList.remove(
          'f2w-role-name','f2w-role-owner','f2w-role-staff','f2w-role-moderator',
          'f2w-role-support','f2w-role-developer','f2w-role-verified',
          'f2w-role-contributor','f2w-role-curator'
        );
        el.classList.add('f2w-no-role-name');
        el.style.setProperty('color','#fff','important');
        el.style.setProperty('-webkit-text-fill-color','#fff','important');
        el.style.setProperty('text-shadow','none','important');
        el.style.setProperty('background','none','important');
        el.removeAttribute('data-f2w-role-decorated');
        el.removeAttribute('data-f2w-role');
      }
    });
  }
  window.decorateNames=decorateNames;

  /* ---------- direct-message search ---------- */
  function installDmSearch(){
    const sidebar=document.querySelector('.v17-dm-sidebar');
    if(!sidebar||sidebar.querySelector('.f2w-dm-search-wrap'))return;
    const wrap=document.createElement('div');wrap.className='f2w-dm-search-wrap';
    wrap.innerHTML='<input id="v35-dm-user-search" type="search" placeholder="Search people to message…" autocomplete="off"><div class="f2w-dm-search-results" id="v35-dm-user-results"></div>';
    const head=sidebar.querySelector('.v17-dm-list-head');
    sidebar.insertBefore(wrap,head||sidebar.firstChild);
    const input=wrap.querySelector('input');let timer=null;
    input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>searchDmUsers(input.value),220)});
  }

  async function searchDmUsers(raw){
    const host=document.getElementById('v35-dm-user-results');if(!host)return;
    const q=String(raw||'').trim().replace(/[^A-Za-z0-9]/g,'');
    if(q.length<1){host.innerHTML='';return;}
    const client=db();if(!client)return;
    host.innerHTML='<div class="v17-dm-empty">Searching…</div>';
    try{
      const {data,error}=await client.from('profiles').select('user_id,username,display_name,avatar_url').ilike('username',`%${q}%`).limit(8);
      if(error)throw error;
      const rows=(data||[]).filter(row=>row.user_id!==authUser?.id);
      host.innerHTML=rows.map(row=>`<button class="f2w-dm-result" type="button" data-user="${esc(row.username)}"><img src="${esc(row.avatar_url||RED_LOGO)}" alt="" onerror="this.src='${RED_LOGO}'"><span><b data-f2w-username="${esc(row.username)}">${esc(row.display_name||`@${row.username}`)}</b><small>@${esc(row.username)}</small></span></button>`).join('')||'<div class="v17-dm-empty">No matching users.</div>';
      host.querySelectorAll('.f2w-dm-result').forEach(btn=>btn.addEventListener('click',()=>{
        if(typeof window.openDirectMessage==='function')window.openDirectMessage(btn.dataset.user);
        inputValueClear();
      }));
      decorateNames();
      function inputValueClear(){const input=document.getElementById('v35-dm-user-search');if(input)input.value='';host.innerHTML='';}
    }catch(error){host.innerHTML=`<div class="v17-dm-empty">${esc(error.message||'Search failed.')}</div>`;}
  }

  /* ---------- watch: record clicked titles, no duplicates + watch time ---------- */
  async function recordWatchOpen(){
    if(!authUser||!location.pathname.startsWith('/watch'))return;

    const params=new URLSearchParams(location.search);
    const mediaId=Number(params.get('id'));
    const mediaType=params.get('type')==='tv'?'tv':'movie';
    if(!mediaId)return;

    const key=`${authUser.id}:${mediaType}:${mediaId}`;
    if(watchOpenRecordedKey===key)return;

    const startPath=location.pathname+location.search;
    let visibleMs=0;
    let last=performance.now();

    // Count time only while this Watch page is actually visible.
    // A quick click-through will not enter Recently Watched.
    await new Promise(resolve=>{
      const timer=setInterval(()=>{
        const now=performance.now();
        if(document.visibilityState==='visible' && (location.pathname+location.search)===startPath){
          visibleMs+=Math.max(0,now-last);
        }
        last=now;

        if(visibleMs>=30000 || (location.pathname+location.search)!==startPath){
          clearInterval(timer);
          resolve();
        }
      },250);
    });

    if(visibleMs<30000 || !authUser || (location.pathname+location.search)!==startPath)return;

    let title=String(document.getElementById('detail-title')?.textContent||'').trim();
    if(!title||/loading title|loading\.\.\./i.test(title)){
      title=`${mediaType==='tv'?'TV':'Movie'} #${mediaId}`;
    }

    const img=document.querySelector('#detail-poster img,.detail-poster img,.poster img,img[alt*="poster" i]');
    const poster=String(img?.getAttribute('src')||'');
    let posterPath=null;
    const match=poster.match(/image\.tmdb\.org\/t\/p\/[^/]+(\/[^?]+)/i);
    if(match)posterPath=match[1];

    try{
      await rpc('record_recent_view_v59',{
        p_media_type:mediaType,
        p_media_id:mediaId,
        p_title:title.slice(0,250),
        p_poster_path:posterPath
      });
      watchOpenRecordedKey=key;
    }catch(error){
      console.warn('Recently Watched tracking unavailable:',error?.message||error);
    }
  }

  function startWatchTime(){
    if(!location.pathname.startsWith('/watch'))return;
    if(watchTimeTimer)return;

    const params=new URLSearchParams(location.search);
    const mediaId=Number(params.get('id'));
    const mediaType=params.get('type')==='tv'?'tv':'movie';
    if(!mediaId)return;

    let lastTick=Date.now();
    watchTimeTimer=setInterval(async()=>{
      const now=Date.now();
      const elapsed=Math.max(1,Math.min(15,Math.round((now-lastTick)/1000)));
      lastTick=now;

      if(!authUser||document.visibilityState!=='visible'||!document.hasFocus())return;

      const frame=document.querySelector('#player-frame,iframe[src]');
      if(!frame||!String(frame.getAttribute('src')||'').trim())return;

      try{
        await rpc('add_watch_seconds',{
          p_media_type:mediaType,
          p_media_id:mediaId,
          p_seconds:elapsed
        });
      }catch(error){
        console.warn('Watch-time tracking unavailable:',error?.message||error);
      }
    },15000);
  }


  /* ---------- profile editor v22 helpers ---------- */
  const PROFILE_TMDB_KEY='925c48dd6e24fd5e975fe224238bbb45';
  const PROFILE_GENRES=[
    'Action','Adventure','Animation','Comedy','Crime','Documentary','Drama','Family',
    'Fantasy','History','Horror','Music','Mystery','Romance','Science Fiction',
    'TV Movie','Thriller','War','Western'
  ];

  function cleanSocialHandle(value){
    return String(value||'').trim().replace(/^@/,'');
  }

  function socialHref(kind,value){
    const raw=String(value||'').trim();
    const v=cleanSocialHandle(raw);
    if(!raw)return '';
    if(kind==='website')return /^https?:\/\//i.test(raw)?raw:`https://${raw}`;
    if(kind==='instagram')return `https://instagram.com/${encodeURIComponent(v)}`;
    if(kind==='snapchat')return `https://www.snapchat.com/add/${encodeURIComponent(v)}`;
    if(kind==='reddit')return `https://www.reddit.com/user/${encodeURIComponent(v)}`;
    if(kind==='tiktok')return `https://www.tiktok.com/@${encodeURIComponent(v)}`;
    if(kind==='steam'){
      if(/^https?:\/\//i.test(raw))return raw;
      return `https://steamcommunity.com/id/${encodeURIComponent(v)}`;
    }
    if(kind==='discord'){
      if(/^\d{8,24}$/.test(v))return `https://discord.com/users/${v}`;
      return 'https://discord.com/';
    }
    return '';
  }
  function socialLink(kind,value,label,icon){
    if(!value)return '';
    const text=kind==='website'?'Website':(label||cleanSocialHandle(value));
    if(kind==='discord'){
      return `<span class="f2w-profile-social-link f2w-social-discord f2w-social-disabled" title="Discord username">
        <i class="${icon}"></i><span>${esc(text)}</span>
      </span>`;
    }
    const href=socialHref(kind,value);
    return `<a class="f2w-profile-social-link f2w-social-${kind}" href="${esc(href)}" target="_blank" rel="noopener noreferrer external">
      <i class="${icon}"></i><span>${esc(text)}</span><i class="fa-solid fa-arrow-up-right-from-square f2w-social-out"></i>
    </a>`;
  }

  let profileMovieSearchTimer=null;
  let profileMovieAbort=null;

  function selectedGenreValues(modal){
    return [...modal.querySelectorAll('.f2w-genre-choice.active')].map(btn=>btn.dataset.genre).filter(Boolean);
  }

  function bindGenreChoices(modal){
    modal.querySelectorAll('.f2w-genre-choice').forEach(btn=>{
      btn.onclick=()=>{
        const active=btn.classList.toggle('active');
        btn.setAttribute('aria-pressed',active?'true':'false');
      };
    });
  }

  async function searchProfileMovies(query){
    const q=String(query||'').trim();
    if(q.length<2)return [];
    if(profileMovieAbort)profileMovieAbort.abort();
    profileMovieAbort=new AbortController();
    const url=`https://api.themoviedb.org/3/search/movie?api_key=${PROFILE_TMDB_KEY}&language=en-US&include_adult=false&query=${encodeURIComponent(q)}&page=1`;
    const response=await fetch(url,{signal:profileMovieAbort.signal});
    if(!response.ok)throw new Error('Movie search unavailable');
    const payload=await response.json();
    return (payload?.results||[]).slice(0,8);
  }

  function renderMovieSearchResults(modal,items){
    const host=modal.querySelector('#v22-movie-results');if(!host)return;
    if(!items.length){
      host.innerHTML='<div class="f2w-movie-search-empty">No matching movies found.</div>';
      host.hidden=false;
      return;
    }
    host.innerHTML=items.map(item=>{
      const title=String(item.title||item.original_title||'Untitled');
      const year=item.release_date?String(item.release_date).slice(0,4):'';
      const poster=item.poster_path?`https://image.tmdb.org/t/p/w92${item.poster_path}`:'/flix2watch-logo-red-v34.png';
      return `<button type="button" class="f2w-movie-result"
        data-id="${Number(item.id)||0}"
        data-title="${esc(title)}"
        data-poster="${esc(item.poster_path||'')}">
        <img src="${poster}" alt="" loading="lazy">
        <span><strong>${esc(title)}</strong><small>${esc(year||'Movie')}</small></span>
        <i class="fa-solid fa-plus"></i>
      </button>`;
    }).join('');
    host.hidden=false;

    host.querySelectorAll('.f2w-movie-result').forEach(btn=>btn.onclick=()=>{
      const input=modal.querySelector('#v22-edit-favorite-movie');
      input.value=btn.dataset.title||'';
      input.dataset.movieId=btn.dataset.id||'';
      input.dataset.posterPath=btn.dataset.poster||'';
      modal.querySelector('#v22-movie-selected').innerHTML=`<i class="fa-solid fa-circle-check"></i> Selected: <strong>${esc(btn.dataset.title||'')}</strong>`;
      host.hidden=true;
    });
  }

  function bindMovieAutocomplete(modal){
    const input=modal.querySelector('#v22-edit-favorite-movie');
    const host=modal.querySelector('#v22-movie-results');
    if(!input||!host)return;

    input.addEventListener('input',()=>{
      input.dataset.movieId='';
      input.dataset.posterPath='';
      modal.querySelector('#v22-movie-selected').textContent='';
      clearTimeout(profileMovieSearchTimer);
      const query=input.value.trim();
      if(query.length<2){host.hidden=true;host.innerHTML='';return;}
      host.hidden=false;
      host.innerHTML='<div class="f2w-movie-search-empty"><i class="fa-solid fa-circle-notch fa-spin"></i> Searching movies…</div>';
      profileMovieSearchTimer=setTimeout(async()=>{
        try{renderMovieSearchResults(modal,await searchProfileMovies(query));}
        catch(error){if(error?.name!=='AbortError')host.innerHTML='<div class="f2w-movie-search-empty">Movie search unavailable right now.</div>';}
      },120);
    });

    input.addEventListener('focus',()=>{
      if(host.innerHTML.trim())host.hidden=false;
    });
  }

  /* ---------- profile activity + richer profile editor ---------- */
  function viewedProfileObject(){try{return typeof viewedProfile!=='undefined'?viewedProfile:null}catch{return null}}
  function isOwnProfile(profile){return Boolean(profile&&authUser&&String(profile.user_id)===String(authUser.id));}
  async function renderProfileActivity(){
    if(!location.pathname.startsWith('/profile'))return;
    const profile=viewedProfileObject();if(!profile?.user_id)return;
    const host=document.getElementById('v17-profile-recently-watched');if(!host)return;

    if(profile.is_private&&!isOwnProfile(profile)){
      host.innerHTML='<div class="f2w-profile-empty">Recently watched is private.</div>';
      return;
    }

    try{
      const rows=await rpc('get_profile_recent_views_v59',{
        p_user_id:profile.user_id,
        p_limit:10
      });
      const data=Array.isArray(rows)?rows:[];

      host.innerHTML=data.length
        ? `<div class="f2w-recently-watched-grid">${data.map(row=>`
            <a class="f2w-recent-watch-card" href="/watch/?id=${encodeURIComponent(row.media_id)}&type=${encodeURIComponent(row.media_type)}">
              <img src="${row.poster_path?`https://image.tmdb.org/t/p/w342${esc(row.poster_path)}`:RED_LOGO}" alt="" loading="lazy" decoding="async" onerror="this.src='${RED_LOGO}'">
              <div>
                <strong>${esc(row.title||`${row.media_type==='tv'?'TV':'Movie'} #${row.media_id}`)}</strong>
                <span>${row.media_type==='tv'?'TV':'Movie'} · ${formatRelative(row.viewed_at)}</span>
              </div>
            </a>`).join('')}</div>`
        : '<div class="f2w-profile-empty">No recently viewed titles yet.</div>';
    }catch(error){
      host.innerHTML='<div class="f2w-profile-empty">Recently watched is unavailable right now.</div>';
      console.warn('Recently watched unavailable:',error?.message||error);
    }
  }
  function subscribeProfileActivity(userId){
    const client=db();if(!client||activityChannel?.topic?.includes(userId))return;
    try{if(activityChannel)client.removeChannel(activityChannel)}catch{}
    try{
      activityChannel=client
        .channel(`v59-profile-recent-${userId}`)
        .on('postgres_changes',{
          event:'*',
          schema:'public',
          table:'profile_recent_views_v59',
          filter:`user_id=eq.${userId}`
        },()=>renderProfileActivity())
        .subscribe();
    }catch{}
  }

  function formatRelative(value){
    if(!value)return 'never';
    const diff=Math.max(0,Date.now()-new Date(value).getTime());
    const minute=60000,hour=3600000,day=86400000,week=604800000,month=2629800000,year=31557600000;
    if(diff<minute)return 'just now';
    if(diff<hour){const n=Math.floor(diff/minute);return `${n} minute${n===1?'':'s'} ago`;}
    if(diff<day){const n=Math.floor(diff/hour);return `${n} hour${n===1?'':'s'} ago`;}
    if(diff<week){const n=Math.floor(diff/day);return `${n} day${n===1?'':'s'} ago`;}
    if(diff<month){const n=Math.floor(diff/week);return `${n} week${n===1?'':'s'} ago`;}
    if(diff<year){const n=Math.floor(diff/month);return `${n} month${n===1?'':'s'} ago`;}
    const n=Math.floor(diff/year);return `${n} year${n===1?'':'s'} ago`;
  }

  function installProfileEditor(){
    if(!location.pathname.startsWith('/profile'))return;
    const profile=viewedProfileObject();if(!isOwnProfile(profile))return;
    if(document.getElementById('v35-edit-profile'))return;
    const target=document.querySelector('.profile-actions,.profile-owner-actions,.profile-social-actions,.profile-identity')||document.querySelector('main');if(!target)return;
    const button=document.createElement('button');button.id='v35-edit-profile';button.className='f2w-edit-profile-btn';button.type='button';button.innerHTML='<i class="fa-solid fa-pen-to-square"></i> Edit Profile';button.onclick=openProfileEditor;
    target.appendChild(button);
    renderProfileExtras(profile);
  }
  function renderProfileExtras(profile){
    if(!profile||!location.pathname.startsWith('/profile'))return;

    const heroCopy=document.querySelector('#profile-hero > div:last-child');
    const rolesPanel=document.getElementById('v16-profile-badges-panel');
    if(!heroCopy)return;

    const genres=Array.isArray(profile.favorite_genres)?profile.favorite_genres:[];
    const status=String(profile.status_text||'').trim();
    const pronouns=String(profile.pronouns||'').trim();
    const quote=String(profile.profile_quote||'').trim();

    // Bottom-of-hero profile details (this is where socials used to render).
    let host=document.getElementById('v17-profile-extra');
    if(!host){
      host=document.createElement('div');
      host.id='v17-profile-extra';
      host.className='f2w-profile-bottom-details';
      heroCopy.appendChild(host);
    }

    host.innerHTML=`
      ${status?`<div class="f2w-profile-status-text"><i class="fa-solid fa-message"></i>${esc(status)}</div>`:''}
      <div class="f2w-profile-extra">
        ${pronouns?`<span class="f2w-profile-chip"><i class="fa-solid fa-id-card"></i>${esc(pronouns)}</span>`:''}
        ${profile.location?`<span class="f2w-profile-chip"><i class="fa-solid fa-location-dot"></i>${esc(profile.location)}</span>`:''}
        ${genres.slice(0,8).map(g=>`<span class="f2w-profile-chip">${esc(g)}</span>`).join('')}
        ${profile.favorite_movie_text?`<a class="f2w-profile-chip f2w-favorite-movie-chip" href="${profile.favorite_movie_tmdb_id?`/watch/?id=${encodeURIComponent(profile.favorite_movie_tmdb_id)}&type=movie`:'#'}"><i class="fa-solid fa-film"></i>${esc(profile.favorite_movie_text)}</a>`:''}
      </div>
      ${quote?`<blockquote class="f2w-profile-quote">“${esc(quote)}”</blockquote>`:''}`;

    const meta=document.querySelector('#profile-hero .profile-meta');
    if(meta && meta.parentElement!==host){
      host.appendChild(meta);
    }

    // Dedicated social panel between Edit Profile area and Roles & Badges.
    let socialPanel=document.getElementById('v32-profile-social-panel');
    if(!socialPanel){
      socialPanel=document.createElement('section');
      socialPanel.id='v32-profile-social-panel';
      socialPanel.className='profile-v16-panel f2w-profile-social-panel-v32';
      if(rolesPanel?.parentNode)rolesPanel.parentNode.insertBefore(socialPanel,rolesPanel);
      else document.getElementById('profile-root')?.appendChild(socialPanel);
    }

    socialPanel.innerHTML=`
      <div class="profile-v16-panel-head">
        <h2><i class="fa-solid fa-share-nodes" style="color:var(--accent)"></i> Social Links</h2>
        <span>Public links</span>
      </div>
      <div class="f2w-profile-socials f2w-profile-socials-v22">
        ${socialLink('website',profile.website_url,'Website','fa-solid fa-globe')}
        ${socialLink('instagram',profile.instagram_username,cleanSocialHandle(profile.instagram_username),'fa-brands fa-instagram')}
        ${socialLink('discord',profile.discord_username,cleanSocialHandle(profile.discord_username),'fa-brands fa-discord')}
        ${socialLink('snapchat',profile.snapchat_username,cleanSocialHandle(profile.snapchat_username),'fa-brands fa-snapchat')}
        ${socialLink('reddit',profile.reddit_username,cleanSocialHandle(profile.reddit_username),'fa-brands fa-reddit-alien')}
        ${socialLink('steam',profile.steam_profile,cleanSocialHandle(profile.steam_profile),'fa-brands fa-steam')}
        ${socialLink('tiktok',profile.tiktok_username,cleanSocialHandle(profile.tiktok_username),'fa-brands fa-tiktok')}
      </div>`;
  }

  function openProfileEditorV87(modal){
    if(!modal)return;
    document.documentElement.classList.add('f2w-profile-editor-open-v87');
    document.body.classList.add('f2w-profile-editor-open-v87');
    modal.hidden=false;
    modal.setAttribute('aria-hidden','false');
    requestAnimationFrame(()=>{
      modal.classList.add('f2w-profile-modal-open-v87');
    });
  }

  function closeProfileEditorV87(){
    const modal=document.getElementById('v35-profile-modal');
    if(modal){
      modal.classList.remove('f2w-profile-modal-open-v87');
      modal.hidden=true;
      modal.setAttribute('aria-hidden','true');
    }
    document.documentElement.classList.remove('f2w-profile-editor-open-v87');
    document.body.classList.remove('f2w-profile-editor-open-v87');
  }
  window.closeProfileEditorV87=closeProfileEditorV87;

  function openProfileEditor(){
    const profile=viewedProfileObject();if(!isOwnProfile(profile))return;
    let modal=document.getElementById('v35-profile-modal');
    if(!modal){
      modal=document.createElement('div');
      modal.id='v35-profile-modal';
      modal.className='f2w-profile-modal';
      modal.onclick=e=>{if(e.target===modal)closeProfileEditorV87()};
      document.body.appendChild(modal);
    }

    const activeGenres=new Set(Array.isArray(profile.favorite_genres)?profile.favorite_genres:[]);
    modal.innerHTML=`<div class="f2w-profile-editor f2w-profile-editor-v22">
      <aside class="f2w-profile-editor-nav">
        <div class="f2w-editor-brand">
          <div class="f2w-editor-brand-icon"><i class="fa-solid fa-user-pen"></i></div>
          <div><strong>Edit Profile</strong><span>@${esc(profile.username||'you')}</span></div>
        </div>
        <nav>
          <button class="f2w-edit-nav active" data-tab="identity"><i class="fa-solid fa-user"></i><span>Profile</span></button>
          <button class="f2w-edit-nav" data-tab="favorites"><i class="fa-solid fa-heart"></i><span>Favorites</span></button>
          <button class="f2w-edit-nav" data-tab="social"><i class="fa-solid fa-share-nodes"></i><span>Social</span></button>
          <button class="f2w-edit-nav" data-tab="privacy"><i class="fa-solid fa-shield-halved"></i><span>Privacy</span></button>
        </nav>
      </aside>

      <div class="f2w-profile-editor-body">
        <div class="f2w-editor-head">
          <div>
            <span class="f2w-editor-eyebrow">PROFILE SETTINGS</span>
            <h2>Make your profile yours.</h2>
            <p>Clean settings, useful details, no theme clutter.</p>
          </div>
          <button class="f2w-editor-close" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div class="f2w-editor-scroll">
          <section class="f2w-editor-section active" data-section="identity">
            <div class="f2w-section-title"><i class="fa-solid fa-user"></i><div><h3>Profile</h3><p>Your public identity on Flix2Watch.</p></div></div>
            <div class="f2w-editor-grid">
              <div class="f2w-editor-field"><label>DISPLAY NAME</label><input id="v35-edit-display" maxlength="50" value="${esc(profile.display_name||'')}" placeholder="Display name"></div>
              <div class="f2w-editor-field"><label>PRONOUNS <em>OPTIONAL</em></label><input id="v17-edit-pronouns" maxlength="40" value="${esc(profile.pronouns||'')}" placeholder="e.g. he/him"></div>
              <div class="f2w-editor-field full"><label>STATUS</label><input id="v17-edit-status" maxlength="80" value="${esc(profile.status_text||'')}" placeholder="What are you watching?"></div>
              <div class="f2w-editor-field full"><label>BIO</label><textarea id="v35-edit-bio" maxlength="500" placeholder="Tell people a little about yourself…">${esc(profile.bio||'')}</textarea><small>Up to 500 characters.</small></div>
              <div class="f2w-editor-field"><label>LOCATION <em>OPTIONAL</em></label><input id="v35-edit-location" maxlength="80" value="${esc(profile.location||'')}" placeholder="City / Country"></div>
              <div class="f2w-editor-field"><label>PROFILE QUOTE <em>OPTIONAL</em></label><input id="v17-edit-quote" maxlength="180" value="${esc(profile.profile_quote||'')}" placeholder="A short quote"></div>
            </div>
          </section>

          <section class="f2w-editor-section" data-section="favorites">
            <div class="f2w-section-title"><i class="fa-solid fa-heart"></i><div><h3>Favorites</h3><p>Pick genres and search the actual movie database.</p></div></div>

            <div class="f2w-editor-field full">
              <label>FAVORITE GENRES</label>
              <div class="f2w-genre-picker" id="v22-genre-picker">
                ${PROFILE_GENRES.map(g=>`<button type="button" class="f2w-genre-choice ${activeGenres.has(g)?'active':''}" data-genre="${esc(g)}" aria-pressed="${activeGenres.has(g)?'true':'false'}">${esc(g)}</button>`).join('')}
              </div>
              <small>Tap to select or deselect.</small>
            </div>

            <div class="f2w-editor-field full f2w-movie-autocomplete">
              <label>FAVORITE MOVIE</label>
              <div class="f2w-movie-search-input">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input id="v22-edit-favorite-movie"
                  autocomplete="off"
                  value="${esc(profile.favorite_movie_text||'')}"
                  data-movie-id="${esc(profile.favorite_movie_tmdb_id||'')}"
                  data-poster-path="${esc(profile.favorite_movie_poster_path||'')}"
                  placeholder="Start typing a movie…">
              </div>
              <div id="v22-movie-results" class="f2w-movie-results" hidden></div>
              <div id="v22-movie-selected" class="f2w-movie-selected">${profile.favorite_movie_text?`<i class="fa-solid fa-circle-check"></i> Selected: <strong>${esc(profile.favorite_movie_text)}</strong>`:''}</div>
            </div>
          </section>

          <section class="f2w-editor-section" data-section="social">
            <div class="f2w-section-title"><i class="fa-solid fa-share-nodes"></i><div><h3>Social</h3><p>Links appear as clickable social buttons on your profile.</p></div></div>
            <div class="f2w-editor-grid f2w-social-editor-grid">
              <div class="f2w-editor-field full f2w-icon-field"><label><i class="fa-solid fa-globe"></i> WEBSITE</label><input id="v35-edit-website" maxlength="2048" value="${esc(profile.website_url||'')}" placeholder="yourwebsite.com"></div>
              <div class="f2w-editor-field f2w-icon-field"><label><i class="fa-brands fa-instagram"></i> INSTAGRAM</label><input id="v35-edit-instagram" maxlength="80" value="${esc(profile.instagram_username||'')}" placeholder="@username"></div>
              <div class="f2w-editor-field f2w-icon-field"><label><i class="fa-brands fa-discord"></i> DISCORD</label><input id="v35-edit-discord" maxlength="80" value="${esc(profile.discord_username||'')}" placeholder="username or user ID"></div>
              <div class="f2w-editor-field f2w-icon-field"><label><i class="fa-brands fa-snapchat"></i> SNAPCHAT</label><input id="v22-edit-snapchat" maxlength="80" value="${esc(profile.snapchat_username||'')}" placeholder="@username"></div>
              <div class="f2w-editor-field f2w-icon-field"><label><i class="fa-brands fa-reddit-alien"></i> REDDIT</label><input id="v22-edit-reddit" maxlength="80" value="${esc(profile.reddit_username||'')}" placeholder="u/username"></div>
              <div class="f2w-editor-field f2w-icon-field"><label><i class="fa-brands fa-steam"></i> STEAM</label><input id="v22-edit-steam" maxlength="2048" value="${esc(profile.steam_profile||'')}" placeholder="Vanity name or Steam profile URL"></div>
              <div class="f2w-editor-field f2w-icon-field"><label><i class="fa-brands fa-tiktok"></i> TIKTOK</label><input id="v22-edit-tiktok" maxlength="80" value="${esc(profile.tiktok_username||'')}" placeholder="@username"></div>
            </div>
          </section>

          <section class="f2w-editor-section" data-section="privacy">
            <div class="f2w-section-title"><i class="fa-solid fa-shield-halved"></i><div><h3>Privacy</h3><p>Control your personal profile activity.</p></div></div>
            <div class="f2w-privacy-choice">
              <div><strong>Private profile</strong><span>Hide favorites and recently watched from other users.</span></div>
              <label class="f2w-switch"><input id="v35-edit-private" type="checkbox" ${profile.is_private?'checked':''}><span></span></label>
            </div>
          </section>
        </div>

        <div class="f2w-editor-footer">
          <span id="v22-profile-save-state">Changes are saved when you press Save Profile.</span>
          <button class="f2w-editor-save" type="button" id="v35-profile-save"><i class="fa-solid fa-floppy-disk"></i> Save Profile</button>
        </div>
      </div>
    </div>`;

    openProfileEditorV87(modal);
    modal.querySelector('.f2w-editor-close').onclick=closeProfileEditorV87;
    modal.querySelectorAll('.f2w-edit-nav').forEach(btn=>btn.onclick=()=>{
      modal.querySelectorAll('.f2w-edit-nav').forEach(x=>x.classList.toggle('active',x===btn));
      modal.querySelectorAll('.f2w-editor-section').forEach(sec=>sec.classList.toggle('active',sec.dataset.section===btn.dataset.tab));
    });
    bindGenreChoices(modal);
    bindMovieAutocomplete(modal);
    modal.querySelector('#v35-profile-save').onclick=saveProfileEditor;
  }

  async function saveProfileEditor(){
    const modal=document.getElementById('v35-profile-modal');
    const button=document.getElementById('v35-profile-save');
    const state=document.getElementById('v22-profile-save-state');
    if(button)button.disabled=true;
    if(state)state.textContent='Saving…';

    try{
      const movieInput=document.getElementById('v22-edit-favorite-movie');
      const result=await rpc('update_my_profile_v22',{
        p_display_name:String(document.getElementById('v35-edit-display')?.value||'').trim(),
        p_bio:String(document.getElementById('v35-edit-bio')?.value||'').trim(),
        p_is_private:Boolean(document.getElementById('v35-edit-private')?.checked),
        p_location:String(document.getElementById('v35-edit-location')?.value||'').trim()||null,
        p_favorite_genres:selectedGenreValues(modal),
        p_website_url:String(document.getElementById('v35-edit-website')?.value||'').trim()||null,
        p_instagram_username:cleanSocialHandle(document.getElementById('v35-edit-instagram')?.value)||null,
        p_discord_username:cleanSocialHandle(document.getElementById('v35-edit-discord')?.value)||null,
        p_snapchat_username:cleanSocialHandle(document.getElementById('v22-edit-snapchat')?.value)||null,
        p_reddit_username:String(document.getElementById('v22-edit-reddit')?.value||'').trim().replace(/^u\//i,'').replace(/^@/,'')||null,
        p_steam_profile:String(document.getElementById('v22-edit-steam')?.value||'').trim()||null,
        p_tiktok_username:cleanSocialHandle(document.getElementById('v22-edit-tiktok')?.value)||null,
        p_status_text:String(document.getElementById('v17-edit-status')?.value||'').trim()||null,
        p_pronouns:String(document.getElementById('v17-edit-pronouns')?.value||'').trim()||null,
        p_favorite_movie_text:String(movieInput?.value||'').trim()||null,
        p_favorite_movie_tmdb_id:Number(movieInput?.dataset.movieId)||null,
        p_favorite_movie_poster_path:String(movieInput?.dataset.posterPath||'').trim()||null,
        p_profile_quote:String(document.getElementById('v17-edit-quote')?.value||'').trim()||null
      });

      try{if(typeof viewedProfile!=='undefined'&&viewedProfile)viewedProfile=Object.assign(viewedProfile,result||{});}catch{}
      if(state)state.textContent='Saved';
      toast('Profile updated');
      setTimeout(()=>{
        closeProfileEditorV87();
        try{renderViewedProfile?.();}catch{}
        renderProfileExtras(viewedProfileObject());
        decorateNames();
      },120);
    }catch(error){
      if(state)state.textContent=error.message||'Could not save profile.';
      toast(error.message||'Could not update profile.');
    }finally{
      if(button)button.disabled=false;
    }
  }


  /* ---------- profile realtime presence + comments ---------- */
  function ensureProfileRealtimePanels(){
    if(!location.pathname.startsWith('/profile'))return;
    const profile=viewedProfileObject();if(!profile?.user_id)return;

    const nameRow=document.querySelector('#profile-hero .profile-name-row');
    if(nameRow&&!document.getElementById('v17-profile-presence')){
      const badge=document.createElement('span');
      badge.id='v17-profile-presence';
      badge.className='f2w-profile-presence offline';
      badge.innerHTML='<i class="f2w-profile-presence-dot"></i><span>Checking status…</span>';
      nameRow.appendChild(badge);
    }

    const badges=document.getElementById('v16-profile-badges-panel');
    if(badges&&!document.getElementById('v17-profile-recent-panel')){
      const section=document.createElement('section');
      section.className='profile-v16-panel';
      section.id='v17-profile-recent-panel';
      section.innerHTML=`<div class="profile-v16-panel-head">
        <h2><i class="fa-solid fa-clock-rotate-left" style="color:var(--accent)"></i> Recently Watched</h2>
        <span>Titles viewed for 5+ seconds · latest 10 only</span>
      </div>
      <div id="v17-profile-recently-watched"><div class="f2w-profile-empty">Loading recent titles…</div></div>`;
      badges.after(section);
    }

    const main=document.getElementById('profile-root')||document.querySelector('main');
    if(main&&!document.getElementById('v17-profile-comments-panel')){
      const section=document.createElement('section');
      section.className='profile-v16-panel f2w-profile-comments-panel';
      section.id='v17-profile-comments-panel';
      section.innerHTML=`<div class="profile-v16-panel-head">
        <h2><i class="fa-solid fa-comments" style="color:var(--accent)"></i> Profile Comments</h2>
        <span>Public wall</span>
      </div>
      <div class="f2w-profile-comment-compose" id="v17-profile-comment-compose"></div>
      <div class="f2w-profile-comments" id="v17-profile-comments"><div class="f2w-profile-empty">Loading comments…</div></div>`;
      main.appendChild(section);
    }
  }

  let f2wProfilePresenceGenerationV108=0;
  const f2wProfilePresenceCacheV108=new Map();
  const F2W_PRESENCE_CACHE_PREFIX='f2w_presence_snapshot_v128:';

  function profilePresenceStateV128(row){
    const lastSeen=row?.last_seen_at||null;
    const onlineUntil=row?.online_until||null;
    const online=Boolean(row?.online ?? (onlineUntil && new Date(onlineUntil).getTime()>Date.now()));
    const text=online
      ? 'Online'
      : lastSeen
        ? `Last online ${formatRelative(lastSeen)}`
        : 'Offline';
    return {online,text,last_seen_at:lastSeen,online_until:onlineUntil};
  }

  function paintProfilePresenceV128(badge,state){
    if(!badge||!state)return;
    badge.classList.toggle('online',Boolean(state.online));
    badge.classList.toggle('offline',!state.online);
    const label=badge.querySelector('span');
    if(label)label.textContent=state.text;
  }

  function cachedProfilePresenceV128(userId){
    let state=f2wProfilePresenceCacheV108.get(userId)||null;
    if(state)return state;
    try{
      const raw=localStorage.getItem(F2W_PRESENCE_CACHE_PREFIX+userId);
      if(!raw)return null;
      const saved=JSON.parse(raw);
      // Recalculate online from online_until so a stale cached "Online" never
      // stays online after its heartbeat window has expired.
      state=profilePresenceStateV128(saved);
      f2wProfilePresenceCacheV108.set(userId,state);
      return state;
    }catch{return null}
  }

  function saveProfilePresenceV128(userId,state){
    f2wProfilePresenceCacheV108.set(userId,state);
    try{
      localStorage.setItem(F2W_PRESENCE_CACHE_PREFIX+userId,JSON.stringify({
        last_seen_at:state.last_seen_at||null,
        online_until:state.online_until||null,
        saved_at:Date.now()
      }));
    }catch{}
  }

  async function fetchProfilePresenceV128(profile){
    const client=db();
    if(client){
      // Fast path: user_presence is publicly readable and indexed by user_id.
      // This avoids waiting on an RPC just to paint one tiny profile badge.
      try{
        const {data,error}=await client
          .from('user_presence')
          .select('last_seen_at,online_until')
          .eq('user_id',profile.user_id)
          .maybeSingle();
        if(!error)return data||{last_seen_at:null,online_until:null};
      }catch{}
    }

    // Compatibility fallback for installations that only expose the RPC.
    const rows=await rpc('get_public_profile_presence',{p_user_id:profile.user_id});
    return Array.isArray(rows)?(rows[0]||null):rows;
  }

  async function renderProfilePresence(){
    if(!location.pathname.startsWith('/profile'))return;
    const profile=viewedProfileObject();if(!profile?.user_id)return;
    ensureProfileRealtimePanels();

    const badge=document.getElementById('v17-profile-presence');if(!badge)return;
    const userId=String(profile.user_id);
    const requestId=++f2wProfilePresenceGenerationV108;

    // Paint the last known state synchronously. On repeat visits this removes
    // the visible "Checking status…" wait completely.
    const cached=cachedProfilePresenceV128(userId);
    if(cached)paintProfilePresenceV128(badge,cached);

    try{
      const row=await fetchProfilePresenceV128(profile);
      if(requestId!==f2wProfilePresenceGenerationV108)return;

      const state=profilePresenceStateV128(row);
      saveProfilePresenceV128(userId,state);
      paintProfilePresenceV128(badge,state);
    }catch{
      if(requestId!==f2wProfilePresenceGenerationV108)return;

      // Never turn a temporary network error into a false Offline state.
      const previous=cachedProfilePresenceV128(userId);
      if(previous){
        paintProfilePresenceV128(badge,previous);
      }else{
        badge.classList.remove('online','offline');
        const label=badge.querySelector('span');
        if(label)label.textContent='Status unavailable';
      }
    }
  }

  window.renderProfilePresence=renderProfilePresence;

  async function renderProfileComments(){
    if(!location.pathname.startsWith('/profile'))return;
    const profile=viewedProfileObject();if(!profile?.user_id)return;
    ensureProfileRealtimePanels();

    const compose=document.getElementById('v17-profile-comment-compose');
    const host=document.getElementById('v17-profile-comments');
    if(!compose||!host)return;

    if(authUser){
      compose.innerHTML=`<textarea id="v17-profile-comment-input" maxlength="500" placeholder="Leave a comment on @${esc(profile.username)}'s profile…"></textarea>
        <div><span id="v17-profile-comment-status"></span><button type="button" id="v17-profile-comment-send"><i class="fa-solid fa-paper-plane"></i> Post comment</button></div>`;
      compose.querySelector('#v17-profile-comment-send').onclick=postProfileComment;
    }else{
      compose.innerHTML='<div class="f2w-comment-login"><i class="fa-solid fa-lock"></i><span>Sign in to leave a profile comment.</span><button type="button">Sign In</button></div>';
      compose.querySelector('button').onclick=()=>{try{window.openHeaderAuth?.('login')}catch{}};
    }

    try{
      const rows=await rpc('get_profile_comments_v17',{p_profile_user_id:profile.user_id,p_limit:60});
      const list=Array.isArray(rows)?rows:[];
      host.innerHTML=list.length?list.map(row=>`
        <article class="f2w-profile-comment">
          <img src="${esc(row.avatar_url||RED_LOGO)}" alt="" onerror="this.src='${RED_LOGO}'">
          <div class="f2w-profile-comment-main">
            <div class="f2w-profile-comment-head">
              <a href="/profile/?user=${encodeURIComponent(row.username)}" data-f2w-username="${esc(row.username)}" class="${roleClass(row.top_role)}">${esc(row.display_name||`@${row.username}`)}</a>
              <span>${formatRelative(row.created_at)}</span>
              ${row.can_delete?`<button type="button" data-delete-comment="${esc(row.id)}" title="Delete comment"><i class="fa-solid fa-trash"></i></button>`:''}
            </div>
            <p>${esc(row.body)}</p>
          </div>
        </article>`).join(''):'<div class="f2w-profile-empty">No comments yet. Be the first.</div>';

      host.querySelectorAll('[data-delete-comment]').forEach(btn=>btn.onclick=()=>deleteProfileComment(btn.dataset.deleteComment));
      decorateNames();
    }catch(error){
      host.innerHTML='<div class="f2w-profile-empty">Comments are unavailable right now.</div>';
      console.warn('Profile comments unavailable:',error?.message||error);
    }
  }

  async function postProfileComment(){
    const profile=viewedProfileObject();if(!profile?.user_id||!authUser)return;
    const input=document.getElementById('v17-profile-comment-input');
    const button=document.getElementById('v17-profile-comment-send');
    const status=document.getElementById('v17-profile-comment-status');
    const body=String(input?.value||'').trim();
    if(!body)return;
    if(button)button.disabled=true;
    try{
      await rpc('add_profile_comment_v17',{p_profile_user_id:profile.user_id,p_body:body});
      if(input)input.value='';
      if(status)status.textContent='Posted';
      await renderProfileComments();
    }catch(error){
      if(status)status.textContent=error.message||'Could not post comment';
    }finally{
      if(button)button.disabled=false;
    }
  }

  async function deleteProfileComment(id){
    if(!id)return;
    try{
      await rpc('delete_profile_comment_v17',{p_comment_id:id});
      await renderProfileComments();
    }catch(error){toast(error.message||'Could not delete comment.');}
  }

  function subscribeProfileRealtime(){
    if(!location.pathname.startsWith('/profile'))return;
    const profile=viewedProfileObject();if(!profile?.user_id)return;
    const client=db();if(!client)return;

    try{if(profileRealtimeChannel)client.removeChannel(profileRealtimeChannel);}catch{}
    try{
      profileRealtimeChannel=client.channel(`v17-profile-live-${profile.user_id}`)
        .on('postgres_changes',{event:'*',schema:'public',table:'user_presence',filter:`user_id=eq.${profile.user_id}`},()=>renderProfilePresence())
        .on('postgres_changes',{event:'*',schema:'public',table:'profile_title_activity',filter:`user_id=eq.${profile.user_id}`},()=>renderProfileActivity())
        .on('postgres_changes',{event:'*',schema:'public',table:'profile_comments',filter:`profile_user_id=eq.${profile.user_id}`},()=>renderProfileComments())
        .on('postgres_changes',{event:'*',schema:'public',table:'profiles',filter:`user_id=eq.${profile.user_id}`},()=>{
          // Never hard-reload a profile just because its avatar/profile changed.
          // That reload race was producing the blank Offline-only profile screen.
          setTimeout(()=>{ try{ window.loadViewedProfile?.(); }catch{}; try{ renderProfilePresence(); }catch{} },80);
        })
        .on('postgres_changes',{event:'*',schema:'public',table:'profile_role_assignments',filter:`user_id=eq.${profile.user_id}`},()=>{
          document.querySelectorAll('[data-f2w-role-checked]').forEach(el=>delete el.dataset.f2wRoleChecked);
          decorateNames();
        })
        .subscribe();
    }catch{}

    if(profileUiTimer)clearInterval(profileUiTimer);
    profileUiTimer=setInterval(()=>{
      renderProfilePresence();
    },30000);
  }

  function bootProfileRealtime(){
    if(!location.pathname.startsWith('/profile'))return;
    ensureProfileRealtimePanels();
    renderProfilePresence();
    renderProfileActivity();
    renderProfileComments();
    subscribeProfileRealtime();
    renderProfileExtras(viewedProfileObject());

    const profile=viewedProfileObject();
    if(profile?.username){
      const name=document.getElementById('profile-name');
      if(name){
        name.dataset.f2wUsername=profile.username;
        delete name.dataset.f2wRoleChecked;
      }
      decorateNames();
    }
  }

  /* ---------- leaderboard ---------- */
  let leaderboardPage=1;let leaderboardSort='overall';
  async function loadLeaderboard(page=leaderboardPage,sort=leaderboardSort){
    const host=document.getElementById('v35-leaderboard-list');if(!host)return;
    leaderboardPage=page;leaderboardSort=sort;host.innerHTML='<div class="empty">Loading live ranking…</div>';
    try{
      const rows=await rpc('get_public_leaderboard',{p_page:page,p_page_size:25,p_sort:sort});
      const list=Array.isArray(rows)?rows:[];const total=Number(list[0]?.total_count||0);const pageCount=Math.max(1,Math.ceil(total/25));
      const count=document.getElementById('v35-registered-count');if(count)count.textContent=String(total);
      const showing=document.getElementById('v35-showing');if(showing)showing.textContent=total?`${(page-1)*25+1}–${Math.min(page*25,total)}`:'0';
      const pageText=document.getElementById('v35-page-stat');if(pageText)pageText.textContent=`${page} / ${pageCount}`;
      host.innerHTML=list.map(row=>leaderboardRow(row)).join('')||'<div class="empty">No accounts yet.</div>';
      const pager=document.getElementById('v35-pagination');if(pager)renderPager(pager,page,pageCount);
      decorateNames();
    }catch(error){host.innerHTML=`<div class="empty">Leaderboard needs the V35 Supabase migration. ${esc(error.message||'')}</div>`;}
  }

  function leaderboardRow(row){
    const online=Boolean(row.online);const last=online?'Online':row.last_seen_at?`Last online ${formatRelative(row.last_seen_at)}`:'Offline';
    return `<article class="f2w-leader-row ${Number(row.rank_no)<=3?'top':''}"><div class="f2w-rank">#${Number(row.rank_no||0)}</div><div class="f2w-leader-user"><img class="f2w-leader-avatar" src="${esc(row.avatar_url||RED_LOGO)}" alt="" onerror="this.src='${RED_LOGO}'"><div class="f2w-leader-copy"><strong data-f2w-username="${esc(row.username)}" class="${roleClass(row.top_role)}">${esc(row.display_name||`@${row.username}`)}</strong><small>@${esc(row.username)} · <span class="f2w-presence ${online?'online':'offline'}"><i class="f2w-presence-dot"></i>${esc(last)}</span></small></div></div><div class="f2w-leader-metric"><b>${Number(row.titles_watched||0)}</b><span>Titles</span></div><div class="f2w-leader-metric"><b>${Number(row.watch_minutes||0)}</b><span>Minutes</span></div><div class="f2w-leader-metric"><b>${Number(row.ratings_count||0)}</b><span>Ratings</span></div><div class="f2w-leader-metric"><b>${Number(row.achievements||0)}</b><span>Achievements</span></div><div class="f2w-score">${Number(row.score||0)}</div><button class="f2w-leader-open" type="button" title="Open profile" onclick="location.href='/profile/?user=${encodeURIComponent(row.username)}'"><i class="fa-solid fa-chevron-right"></i></button></article>`;
  }

  function renderPager(host,page,count){
    const parts=[];parts.push(`<button class="f2w-page-btn" ${page<=1?'disabled':''} data-page="${page-1}"><i class="fa-solid fa-chevron-left"></i></button>`);
    const start=Math.max(1,Math.min(page-2,count-4));const end=Math.min(count,start+4);
    for(let i=start;i<=end;i++)parts.push(`<button class="f2w-page-btn ${i===page?'active':''}" data-page="${i}">${i}</button>`);
    parts.push(`<button class="f2w-page-btn" ${page>=count?'disabled':''} data-page="${page+1}"><i class="fa-solid fa-chevron-right"></i></button>`);
    host.innerHTML=parts.join('');host.querySelectorAll('[data-page]').forEach(btn=>btn.onclick=()=>{const p=Number(btn.dataset.page);if(p>=1&&p<=count){loadLeaderboard(p,leaderboardSort);scrollTo({top:0,behavior:'smooth'})}});
  }

  function bootLeaderboard(){
    if(document.body?.dataset.f2wPage!=='leaderboard')return;
    document.querySelectorAll('.f2w-leader-tab').forEach(btn=>btn.onclick=()=>{
      document.querySelectorAll('.f2w-leader-tab').forEach(x=>x.classList.toggle('active',x===btn));
      loadLeaderboard(1,btn.dataset.sort||'overall');
    });
    loadLeaderboard(1,'overall');

    const refresh=()=>loadLeaderboard(leaderboardPage,leaderboardSort);
    const client=db();
    if(client){
      try{
        client.channel('v17-leader-live')
          .on('postgres_changes',{event:'*',schema:'public',table:'user_presence'},refresh)
          .on('postgres_changes',{event:'*',schema:'public',table:'profile_title_activity'},refresh)
          .on('postgres_changes',{event:'*',schema:'public',table:'profile_watch_time'},refresh)
          .on('postgres_changes',{event:'*',schema:'public',table:'user_ratings'},refresh)
          .on('postgres_changes',{event:'*',schema:'public',table:'profile_role_assignments'},refresh)
          .on('postgres_changes',{event:'*',schema:'public',table:'profiles'},refresh)
          .subscribe();
      }catch{}
    }
    setInterval(refresh,30000);
  }

  /* ---------- community/forum additions ---------- */
  async function enrichForum(){
    if(!location.pathname.startsWith('/forum'))return;
    const main=document.querySelector('main,.forum-main,.v34-forum-shell');if(!main)return;
    if(!document.getElementById('v35-community-metrics')){
      const metrics=document.createElement('div');metrics.id='v35-community-metrics';metrics.className='f2w-community-metrics';metrics.innerHTML='<div class="f2w-community-metric"><b id="v35-thread-count">—</b><span>Discussions</span></div><div class="f2w-community-metric"><b>½–5★</b><span>Rating scale</span></div><div class="f2w-community-metric"><b>Public</b><span>Anyone can read</span></div><div class="f2w-community-metric"><b id="v35-community-user">Guest</b><span>Your account</span></div>';
      main.insertBefore(metrics,main.firstChild);
    }
    const user=document.getElementById('v35-community-user');if(user)user.textContent=authUser?'Member':'Guest';
    try{
      const client=db();const [{count},{data:leaders}]=await Promise.all([
        client.from('forum_threads').select('*',{count:'exact',head:true}),
        client.rpc('get_public_leaderboard',{p_page:1,p_page_size:5,p_sort:'overall'})
      ]);
      const countEl=document.getElementById('v35-thread-count');if(countEl)countEl.textContent=String(count||0);
      let rankbox=document.getElementById('v35-forum-rankbox');
      if(!rankbox){rankbox=document.createElement('aside');rankbox.id='v35-forum-rankbox';rankbox.className='f2w-forum-rankbox';main.appendChild(rankbox);}
      rankbox.innerHTML=`<h3><i class="fa-solid fa-trophy"></i> Community rankings</h3>${(leaders||[]).map(row=>`<div class="f2w-forum-rankline"><a href="/profile/?user=${encodeURIComponent(row.username)}" data-f2w-username="${esc(row.username)}">#${Number(row.rank_no)} ${esc(row.display_name||row.username)}</a><b>${Number(row.score||0)}</b></div>`).join('')}<div style="margin-top:9px"><a href="/leaderboard/" style="color:#ff4852">View full leaderboard →</a></div>`;
      decorateNames();
    }catch{}
  }

  /* ---------- staff instant quick moderation ---------- */
  function currentStaffSnapshot(){try{return typeof currentSnapshot!=='undefined'?currentSnapshot:null}catch{return null}}
  function installStaffQuickModeration(){
    if(!location.pathname.startsWith('/staff'))return;
    const snap=currentStaffSnapshot();const userId=String(snap?.profile?.user_id||'');if(!userId||userId===staffSnapshotId)return;
    staffSnapshotId=userId;
    const host=document.getElementById('user-snapshot');if(!host)return;
    let box=document.getElementById('v35-quick-mod');if(box)box.remove();
    box=document.createElement('div');box.id='v35-quick-mod';box.className='f2w-quick-mod';
    box.innerHTML=`<h3><i class="fa-solid fa-bolt"></i> Instant account moderation</h3><p>Each switch saves immediately and is pushed to the target account in realtime.</p>${quickRow('public-chat-ban','Public chat ban','Blocks sending public chat messages.')}${quickRow('public-chat-mute','Public chat mute','Temporarily blocks sending chat messages.')}${quickRow('site-suspension','Site suspension','Immediately blocks normal site use while the account remains signed in.')}${quickRow('account-ban','Account ban','Immediately signs the user out and blocks future password login.')}<input class="f2w-quick-reason" id="v35-mod-reason" maxlength="500" placeholder="Reason shown to user / Staff audit"><div class="f2w-quick-expiry"><select id="v35-mod-expiry"><option value="0">No expiry</option><option value="60">1 hour</option><option value="1440">24 hours</option><option value="10080">7 days</option><option value="43200">30 days</option></select><button class="btn" type="button" id="v35-clear-restrictions">Clear all restrictions</button></div>`;
    host.after(box);
    box.querySelectorAll('input[type="checkbox"]').forEach(input=>input.onchange=()=>saveQuickModeration(input));
    box.querySelector('#v35-clear-restrictions').onclick=clearQuickModeration;
    loadQuickModeration(userId);
  }

  function quickRow(id,title,desc){return `<div class="f2w-quick-mod-row"><div class="f2w-quick-mod-copy"><strong>${title}</strong><span>${desc}</span></div><label class="f2w-switch"><input type="checkbox" id="v35-${id}"><span></span></label></div>`;}

  async function loadQuickModeration(userId){
    try{
      const state=await rpc('staff_get_quick_moderation',{p_user_id:userId});
      [['public-chat-ban','public_chat_banned'],['public-chat-mute','muted'],['site-suspension','site_suspended'],['account-ban','account_banned']].forEach(([id,key])=>{const el=document.getElementById(`v35-${id}`);if(el)el.checked=Boolean(state?.[key])});
    }catch(error){console.warn(error)}
  }

  async function saveQuickModeration(input){
    const snap=currentStaffSnapshot();const userId=snap?.profile?.user_id;const username=snap?.profile?.username;if(!userId)return;
    const enabled=input.checked;const reason=String(document.getElementById('v35-mod-reason')?.value||'').trim()||null;const minutes=Number(document.getElementById('v35-mod-expiry')?.value||0)||null;
    input.disabled=true;
    try{
      if(input.id==='v35-public-chat-ban')await rpc('staff_set_public_chat_ban',{p_user_id:userId,p_enabled:enabled,p_minutes:minutes,p_reason:reason});
      else if(input.id==='v35-public-chat-mute'){
        if(enabled)await rpc('staff_set_mute',{p_username:username,p_minutes:minutes||60,p_reason:reason});
        else await rpc('staff_clear_mute',{p_username:username});
      }
      else if(input.id==='v35-site-suspension')await rpc('staff_set_ban',{p_username:username,p_banned:enabled,p_minutes:minutes,p_reason:reason});
      else if(input.id==='v35-account-ban')await rpc('staff_set_account_login_ban',{p_user_id:userId,p_enabled:enabled,p_minutes:minutes,p_reason:reason});
      toast(`${input.closest('.f2w-quick-mod-row')?.querySelector('strong')?.textContent||'Restriction'} ${enabled?'enabled':'cleared'} — live update sent`);
    }catch(error){input.checked=!enabled;toast(error.message||'Update failed');}
    finally{input.disabled=false;}
  }

  async function clearQuickModeration(){
    const snap=currentStaffSnapshot();const userId=snap?.profile?.user_id;const username=snap?.profile?.username;if(!userId)return;
    try{
      await Promise.all([
        rpc('staff_set_public_chat_ban',{p_user_id:userId,p_enabled:false,p_minutes:null,p_reason:null}),
        rpc('staff_clear_mute',{p_username:username}),
        rpc('staff_set_ban',{p_username:username,p_banned:false,p_minutes:null,p_reason:null}),
        rpc('staff_set_account_login_ban',{p_user_id:userId,p_enabled:false,p_minutes:null,p_reason:null})
      ]);
      document.querySelectorAll('#v35-quick-mod input[type="checkbox"]').forEach(x=>x.checked=false);toast('All restrictions cleared — live update sent');
    }catch(error){toast(error.message||'Could not clear restrictions');}
  }

  /* ---------- profile/support navigation hardening ---------- */
  window.f2wOpenMyProfile=async function(){
    const client=db();if(!client)return location.assign('/home/');
    const {data:{user}}=await client.auth.getUser();if(!user){try{window.openAccountModal?.();return}catch{}location.assign('/home/');return;}
    try{
      const {data,error}=await client.from('profiles').select('username').eq('user_id',user.id).maybeSingle();if(error)throw error;
      if(data?.username){location.assign(`/profile/?user=${encodeURIComponent(data.username)}`);return;}
    }catch{}
    location.assign('/profile/');
  };

  function hardenRouting(){
    document.querySelectorAll('#profile-nav-btn').forEach(btn=>{btn.onclick=e=>{e.preventDefault();window.f2wOpenMyProfile()}});
    document.querySelectorAll('#support-nav-btn,#account-support-btn').forEach(btn=>{btn.onclick=e=>{e.preventDefault();location.assign('/support/')}});
  }

  /* ---------- source ordering: existing reliable providers ---------- */
  function reorderSourceButtons(){
    if(!location.pathname.startsWith('/watch'))return;
    const host=document.querySelector('.server-list,.server-buttons,.source-list,[id*="server-list"],#servers');if(!host)return;
    const buttons=[...host.querySelectorAll('button')];
    const videasy=buttons.find(b=>/videasy/i.test(b.textContent));const vidfast=buttons.find(b=>/vid\s*fast/i.test(b.textContent));
    if(videasy)host.prepend(videasy);if(vidfast){if(videasy?.nextSibling)host.insertBefore(vidfast,videasy.nextSibling);else host.appendChild(vidfast)}
  }


  function installRoleNameWatcher(){
    if(window.__f2wRoleNameWatcherInstalled)return;
    window.__f2wRoleNameWatcherInstalled=true;

    let timer=null;
    const refresh=()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>decorateNames(),25);
    };

    const observer=new MutationObserver(mutations=>{
      if(mutations.some(m=>{
        const node=m.target?.nodeType===1?m.target:m.target?.parentElement;
        return node?.closest?.('#account-user-role,#account-user-username,#profile-name,[data-username],[data-f2w-username]');
      }))refresh();
    });
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    refresh();
  }


  function openProfileAvatarViewer(){
    const img=document.getElementById('profile-avatar');
    if(!img||img.style.display==='none'||!img.src)return;
    let modal=document.getElementById('f2w-avatar-viewer-v32');
    if(!modal){
      modal=document.createElement('div');
      modal.id='f2w-avatar-viewer-v32';
      modal.className='f2w-avatar-viewer';
      modal.innerHTML='<button type="button" class="f2w-avatar-viewer-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button><img alt="Profile picture">';
      modal.onclick=e=>{if(e.target===modal)modal.hidden=true};
      modal.querySelector('button').onclick=()=>{modal.hidden=true};
      document.body.appendChild(modal);
    }
    modal.querySelector('img').src=img.src;
    modal.hidden=false;
  }

  function installProfileAvatarViewer(){
    const shell=document.getElementById('profile-avatar-shell');
    if(!shell||shell.dataset.f2wAvatarViewer)return;
    shell.dataset.f2wAvatarViewer='1';
    shell.classList.add('f2w-avatar-clickable');
    shell.setAttribute('role','button');
    shell.setAttribute('tabindex','0');
    shell.setAttribute('aria-label','Open profile picture');
    shell.addEventListener('click',e=>{
      if(e.target.closest?.('.avatar-edit-label'))return;
      openProfileAvatarViewer();
    });
    shell.addEventListener('keydown',e=>{
      if(e.key==='Enter'||e.key===' '){e.preventDefault();openProfileAvatarViewer();}
    });
  }


  /* ---------- v40 mandatory username gate ---------- */
  let usernameGateRunning=false;

  function usernameGateMarkup(){
    return `<div class="f2w-username-gate-card">
      <div class="f2w-username-gate-icon"><i class="fa-solid fa-at"></i></div>
      <span class="f2w-username-gate-kicker">USERNAME REQUIRED</span>
      <h2>Choose your Flix2Watch username</h2>
      <p>Every account needs a unique username. This is separate from your display name.</p>
      <label>USERNAME
        <div class="f2w-username-gate-input"><span>@</span><input id="f2w-required-username" maxlength="30" autocomplete="username" placeholder="username"></div>
      </label>
      <div class="f2w-username-gate-help">2–30 letters or numbers only.</div>
      <div id="f2w-username-gate-status" class="f2w-username-gate-status"></div>
      <button type="button" id="f2w-username-gate-save"><i class="fa-solid fa-check"></i> Continue</button>
      <button type="button" id="f2w-username-gate-logout" class="secondary"><i class="fa-solid fa-right-from-bracket"></i> Log out</button>
    </div>`;
  }

  function showUsernameGate(){
    let gate=document.getElementById('f2w-username-required-gate');
    if(!gate){
      gate=document.createElement('div');
      gate.id='f2w-username-required-gate';
      gate.className='f2w-username-required-gate';
      gate.innerHTML=usernameGateMarkup();
      document.body.appendChild(gate);
    }
    gate.hidden=false;
    document.documentElement.classList.add('f2w-username-gated');

    const input=gate.querySelector('#f2w-required-username');
    const save=gate.querySelector('#f2w-username-gate-save');
    const status=gate.querySelector('#f2w-username-gate-status');
    const logout=gate.querySelector('#f2w-username-gate-logout');

    const submit=async()=>{
      const username=String(input?.value||'').trim();
      if(username.length<2||username.length>30||!/^[A-Za-z0-9]+$/.test(username)){
        status.textContent='Use 2–30 letters or numbers only.';
        status.classList.add('error');
        return;
      }
      save.disabled=true;
      status.classList.remove('error');
      status.textContent='Checking username…';
      try{
        const result=await rpc('claim_my_username_v40',{p_username:username});
        const claimed=String(result?.username||username);
        try{localStorage.setItem('f2w_profile_username_v24',claimed)}catch{}
        status.textContent=`@${claimed} saved.`;
        setTimeout(()=>{
          gate.hidden=true;
          document.documentElement.classList.remove('f2w-username-gated');
          location.reload();
        },180);
      }catch(error){
        status.textContent=error?.message||'That username is unavailable.';
        status.classList.add('error');
      }finally{
        save.disabled=false;
      }
    };

    save.onclick=submit;
    input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();submit();}};
    logout.onclick=async()=>{
      try{await db()?.auth?.signOut()}catch{}
      location.href='/home/';
    };
    setTimeout(()=>input?.focus(),40);
  }

  async function enforceUsernameGate(){
    if(usernameGateRunning)return;
    usernameGateRunning=true;
    try{
      const client=db();if(!client)return;
      const {data:{session}}=await client.auth.getSession();
      const user=session?.user;
      if(!user?.id){
        document.getElementById('f2w-username-required-gate')?.setAttribute('hidden','');
        document.documentElement.classList.remove('f2w-username-gated');
        return;
      }

      const {data,error}=await client
        .from('profiles')
        .select('username')
        .eq('user_id',user.id)
        .maybeSingle();

      if(error)throw error;
      const username=String(data?.username||'').trim();
      const invalid=!username || username.length<2 || username.length>30 || !/^[A-Za-z0-9]+$/.test(username);

      if(invalid){
        showUsernameGate();
      }else{
        try{localStorage.setItem('f2w_profile_username_v24',username)}catch{}
        const gate=document.getElementById('f2w-username-required-gate');
        if(gate)gate.hidden=true;
        document.documentElement.classList.remove('f2w-username-gated');
      }
    }catch(error){
      console.warn('Username requirement check failed:',error?.message||error);
    }finally{
      usernameGateRunning=false;
    }
  }

  /* ---------- boot ---------- */
  function bootProfilePresenceFastV128(){
    if(!location.pathname.startsWith('/profile'))return;
    let attempts=0;
    const tryPaint=()=>{
      attempts++;
      const profile=viewedProfileObject();
      if(profile?.user_id){
        renderProfilePresence();
        return true;
      }
      return false;
    };
    if(tryPaint())return;
    const timer=setInterval(()=>{
      if(tryPaint()||attempts>=120)clearInterval(timer);
    },25);
  }

  async function boot(){
    forceRedLogo();addLeaderboardNav();hardenRouting();installDmSearch();reorderSourceButtons();
    // Presence is public data. Do not make the profile badge wait behind auth
    // hydration, username checks, chat prewarming, or the old 350ms boot delay.
    bootProfilePresenceFastV128();
    installAuthAbuseGuard();
    await syncAuthUI();
    await enforceUsernameGate();
    registerCurrentAbuseSignals();
    prewarmChat();
    setTimeout(()=>{recordWatchOpen();startWatchTime();renderProfileActivity();installProfileEditor();bootProfileRealtime();enrichForum();bootLeaderboard();decorateNames();installStaffQuickModeration()},350);
    roleDecorateTimer=null;
    const client=db();
    try{client?.auth?.onAuthStateChange?.(()=>setTimeout(()=>{installAuthAbuseGuard();syncAuthUI();enforceUsernameGate();registerCurrentAbuseSignals();recordWatchOpen();startWatchTime();installProfileEditor();bootProfileRealtime();renderProfileComments();enrichForum()},0))}catch{}
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){touchPresence();recordWatchOpen();}else{leavePresence();}});
    window.addEventListener('pagehide',()=>{leavePresence()});
    let f2wDomRefreshTimer=null;
    const observer=new MutationObserver(()=>{
      clearTimeout(f2wDomRefreshTimer);
      f2wDomRefreshTimer=setTimeout(()=>{
        forceRedLogo();
        addLeaderboardNav();
        hardenRouting();
        decorateNames();
      },80);
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
// f2w-force-save:ban-evasion-final-v35-v1:1788212206
// f2w-force-save:realtime-profile-leaderboard-v17:1788213599
// f2w-force-save:profile-editor-v22:1788214990
// f2w-force-save:role-name-fairy-dust-v25:1788215879
// f2w-force-save:role-sparkle-stability-v27:1788216279
// f2w-force-save:role-name-effects-v30:1788216738
// f2w-force-save:stable-role-name-v31:1788217048
// f2w-force-save:profile-social-static-status-v32:1788217362
 

/* F2W v33 — debounce repeated role decoration bursts */
(() => {
  'use strict';
  if(typeof window.decorateNames!=='function'||window.__f2wDecorateNamesDebounced)return;
  window.__f2wDecorateNamesDebounced=true;
  const raw=window.decorateNames;
  window.decorateNames=f2wDebounce(()=>raw(),70);
})();
// f2w-force-save:debounce-role-decorate-v33:1788217440
// f2w-force-save:mandatory-username-v40:1788218691
// f2w-force-save:guest-header-sync-v44:1788219651

/* ============================================================
   F2W v54 — ACCOUNT IDENTITY RESTORE
   ============================================================ */
(() => {
  'use strict';
  let running=false;

  async function refreshAccountIdentityV54(){
    if(running)return;
    running=true;
    try{
      const client=(typeof db==='function'?db():null) || window.f2wSupabase || window.supabaseClient;
      if(!client?.auth)return;

      const {data:{session}}=await client.auth.getSession();
      const user=session?.user;
      if(!user)return;

      const emailEl=document.getElementById('account-user-email');
      const usernameEl=document.getElementById('account-user-username');
      const roleEl=document.getElementById('account-user-role');

      if(emailEl)emailEl.textContent=user.email||user.user_metadata?.email||'Signed-in user';

      let username=String(
        user.user_metadata?.username ||
        user.user_metadata?.chat_alias ||
        localStorage.getItem('f2w_profile_username_v24') ||
        ''
      ).trim().replace(/^@/,'');

      try{
        const {data:profile}=await client
          .from('profiles')
          .select('username,display_name')
          .eq('user_id',user.id)
          .maybeSingle();

        if(profile?.username){
          username=String(profile.username).trim().replace(/^@/,'');
          try{localStorage.setItem('f2w_profile_username_v24',username)}catch{}
        }
      }catch{}

      if(usernameEl){
        usernameEl.textContent=username?`@${username}`:'@username';
        usernameEl.dataset.username=username;
        usernameEl.dataset.f2wPlainText=usernameEl.textContent;
      }

      // Do not overwrite the role resolver; just repaint the name once its role is known.
      const roleLabel=String(roleEl?.textContent||'').trim().toLowerCase();
      const role=
        roleLabel.includes('owner')?'owner':
        roleLabel.includes('staff')?'staff':
        roleLabel.includes('moderator')?'moderator':
        roleLabel.includes('support')?'support':
        roleLabel.includes('developer')?'developer':
        roleLabel.includes('verified')?'verified':
        roleLabel.includes('contributor')?'contributor':
        roleLabel.includes('curator')?'curator':'';

      if(usernameEl && role && typeof window.f2wPaintRoleName==='function'){
        window.f2wPaintRoleName(usernameEl,role,username);
      }
    }catch(error){
      console.warn('Account identity refresh failed:',error?.message||error);
    }finally{
      running=false;
    }
  }

  window.refreshAccountIdentityV54=refreshAccountIdentityV54;

  document.addEventListener('click',e=>{
    if(e.target.closest?.('#account-btn'))setTimeout(refreshAccountIdentityV54,0);
  },{capture:true,passive:true});

  window.addEventListener('pageshow',()=>setTimeout(refreshAccountIdentityV54,0),{passive:true});
})();
// f2w-force-save:account-identity-js-v54:1788220759
// f2w-force-save:white-usernames-recent10-v59:1788221542
// f2w-force-save:roleless-inline-white-v64:1788222358
// f2w-force-save:profile-links-stable-v70:1788223711
// f2w-force-save:role-inline-reset-v83:1788226300
// f2w-force-save:profile-edit-centering-js-v87:1788227242

/* ============================================================
   F2W v88 — 30 SECOND PRESENCE STABILITY
   ============================================================ */
(() => {
  'use strict';
  if(window.__f2wPresenceStabilityV88)return;
  window.__f2wPresenceStabilityV88=true;

  const REFRESH_MS=30000;

  // Keep visible presence labels stable: update text/content, never remove the slot.
  function ensureProfilePresenceSlot(){
    if(!location.pathname.startsWith('/profile'))return;
    const row=document.querySelector('#profile-hero .profile-name-row');
    if(!row)return;

    let badge=document.getElementById('v17-profile-presence');
    if(!badge){
      badge=document.createElement('span');
      badge.id='v17-profile-presence';
      badge.className='f2w-profile-presence offline';
      badge.setAttribute('aria-live','polite');
      badge.innerHTML='<i class="f2w-profile-presence-dot"></i><span>Checking status…</span>';
      row.appendChild(badge);
    }
  }

  function refreshVisiblePresence(){
    ensureProfilePresenceSlot();
    try{window.renderProfilePresence?.()}catch{}
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>{
      ensureProfilePresenceSlot();
      refreshVisiblePresence();
    },{once:true});
  }else{
    ensureProfilePresenceSlot();
    refreshVisiblePresence();
  }

  // Re-check immediately when the tab becomes active, while normal polling remains 30s.
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')refreshVisiblePresence();
  },{passive:true});

  window.addEventListener('focus',refreshVisiblePresence,{passive:true});
})();
// f2w-force-save:presence-stability-v88:1788227370
// f2w-force-save:presence-v88:1788227370

/* ============================================================
   F2W v89 — NORMALIZE DM ROLE DECORATION TO DISPLAY NAME ONLY
   ============================================================ */
(() => {
  'use strict';
  if(window.__f2wDmRoleNameNormalizerV89)return;
  window.__f2wDmRoleNameNormalizerV89=true;

  const ROLE_CLASSES = [
    'f2w-role-owner','f2w-role-staff','f2w-role-moderator',
    'f2w-role-support','f2w-role-developer','f2w-role-verified',
    'f2w-role-contributor','f2w-role-curator'
  ];

  function roleFrom(node){
    if(!node?.classList)return '';
    return ROLE_CLASSES.find(cls=>node.classList.contains(cls)) || '';
  }

  function clearRoleEffect(node){
    if(!node?.classList)return;
    node.classList.remove('f2w-role-name', ...ROLE_CLASSES);
    node.removeAttribute('data-f2w-role-decorated');
    node.removeAttribute('data-f2w-role');

    node.style.removeProperty('color');
    node.style.removeProperty('-webkit-text-fill-color');
    node.style.removeProperty('text-shadow');
    node.style.removeProperty('background');
    node.style.removeProperty('background-image');
    node.style.removeProperty('filter');
  }

  function normalizeRow(row){
    if(!row)return;

    const copy=row.querySelector('.v17-dm-conversation-copy');
    if(!copy)return;

    const name =
      copy.querySelector(':scope > strong') ||
      copy.querySelector(':scope > b') ||
      copy.firstElementChild;

    if(!name)return;

    name.setAttribute('data-f2w-dm-display-name','1');

    let foundRole = roleFrom(name);

    // Older code sometimes decorated the whole row/copy/avatar.
    // Capture that role before stripping those containers.
    const containers = [
      row,
      copy,
      row.querySelector('.v17-dm-conversation-meta'),
      row.querySelector('.v17-dm-avatar'),
      row.querySelector('img')
    ].filter(Boolean);

    for(const node of containers){
      foundRole = foundRole || roleFrom(node);
    }

    // The role effect must exist nowhere except the display-name element.
    for(const node of containers){
      if(node!==name)clearRoleEffect(node);
    }

    // Strip accidental decoration from siblings (subtitle, time, etc).
    [...copy.children].forEach(child=>{
      if(child!==name)clearRoleEffect(child);
    });

    if(foundRole){
      clearRoleEffect(name);
      name.classList.add('f2w-role-name',foundRole);
      name.dataset.f2wRoleDecorated='1';
      name.dataset.f2wRole=foundRole.replace('f2w-role-','');
    }
  }

  function normalizeAll(){
    document.querySelectorAll('#v17-dm-conversations .v17-dm-conversation')
      .forEach(normalizeRow);
  }

  function boot(){
    normalizeAll();

    const host=document.getElementById('v17-dm-conversations');
    if(!host || host.dataset.f2wDmRoleObserverV89)return;
    host.dataset.f2wDmRoleObserverV89='1';

    new MutationObserver(()=>{
      normalizeAll();
    }).observe(host,{
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['class','data-f2w-role','data-f2w-role-decorated']
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  }else{
    boot();
  }

  window.addEventListener('pageshow',boot,{passive:true});
})();
// f2w-force-save:dm-display-name-particles-js-v89:1788227613
// f2w-force-save:display-name-only-role-decoration-v90:1788227716
// f2w-force-save:role-stability-v103:1788289090
// f2w-force-save:profile-presence-stable-v108:1788290088
// f2w-force-save:sitewide-user-identities-v116:1788295578
// f2w-force-save:profile-bio-v124:1788299294

/* ============================================================
   F2W v125 — FRIENDLY PROFILE LINKS + LOCAL RECENT VIEWED
   ============================================================ */
(() => {
  'use strict';
  if(window.__f2wV125Shared)return;
  window.__f2wV125Shared=true;

  function friendlyProfileHref(href){
    try{
      const url=new URL(href,location.origin);
      if(url.origin!==location.origin)return href;
      if(url.pathname!=='/profile/'&&url.pathname!=='/profile')return href;
      const username=String(url.searchParams.get('user')||'').trim();
      if(!/^[A-Za-z0-9]+$/.test(username))return href;
      return `/profile/@${encodeURIComponent(username)}`;
    }catch{return href}
  }

  function rewriteProfileLinks(root=document){
    root.querySelectorAll?.('a[href*="/profile/?user="],a[href*="/profile?user="]').forEach(a=>{
      const next=friendlyProfileHref(a.getAttribute('href')||'');
      if(next)a.setAttribute('href',next);
    });
  }

  rewriteProfileLinks();
  const linkObserver=new MutationObserver(muts=>{
    for(const m of muts){
      for(const node of m.addedNodes){
        if(node instanceof Element){
          if(node.matches?.('a[href*="/profile/?user="],a[href*="/profile?user="]')){
            const next=friendlyProfileHref(node.getAttribute('href')||'');
            if(next)node.setAttribute('href',next);
          }
          rewriteProfileLinks(node);
        }
      }
    }
  });
  if(document.documentElement)linkObserver.observe(document.documentElement,{subtree:true,childList:true});

  document.addEventListener('click',event=>{
    const a=event.target?.closest?.('a[href*="/profile/?user="],a[href*="/profile?user="]');
    if(!a)return;
    const next=friendlyProfileHref(a.href);
    if(next&&next!==a.getAttribute('href'))a.setAttribute('href',next);
  },true);

  function localRecentKey(){return 'flix2watch_recently_viewed'}

  function storeLocalRecent(){
    if(!location.pathname.startsWith('/watch'))return;
    const params=new URLSearchParams(location.search);
    const id=Number(params.get('id')||0);
    const type=params.get('type')==='tv'?'tv':'movie';
    if(!id)return;

    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      const title=String(
        document.getElementById('detail-title')?.textContent||
        document.querySelector('h1')?.textContent||
        ''
      ).trim();
      const img=document.querySelector('#detail-poster img,.detail-poster img,#detail-poster,.poster img');
      const src=String(img?.getAttribute?.('src')||'');
      const match=src.match(/image\.tmdb\.org\/t\/p\/[^/]+(\/[^?]+)/i);
      const poster_path=match?.[1]||'';

      if(title && !/loading/i.test(title)){
        clearInterval(timer);
        try{
          const rows=JSON.parse(localStorage.getItem(localRecentKey())||'[]');
          const list=Array.isArray(rows)?rows:[];
          const next={
            id,type,title:title.slice(0,250),poster_path,
            viewed_at:new Date().toISOString()
          };
          const dedup=list.filter(x=>!(String(x.id)===String(id)&&String(x.type)===type));
          localStorage.setItem(localRecentKey(),JSON.stringify([next,...dedup].slice(0,24)));
        }catch{}
      }else if(tries>=12){
        clearInterval(timer);
      }
    },250);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',storeLocalRecent,{once:true});
  }else{
    storeLocalRecent();
  }
})();
// f2w-force-save:v125-shared:1788300576

 

/* ============================================================
   F2W v126 — FAST DIRECT MESSAGES + SHARED DELETION TIMER
   ============================================================ */
(() => {
  'use strict';
  if(window.__f2wDmV126)return;
  window.__f2wDmV126=true;

  const URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
  const KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
  let client=null, me=null, activeId='', activeOther=null, dmChannel=null, sending=false;

  function db(){
    if(client)return client;
    try{client=window.supabase?.createClient?.(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})||null}catch{}
    return client;
  }
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const rel=v=>{const d=Math.max(0,Date.now()-new Date(v).getTime());if(d<60000)return'now';if(d<3600000)return`${Math.floor(d/60000)}m`;if(d<86400000)return`${Math.floor(d/3600000)}h`;return`${Math.floor(d/86400000)}d`};
  const label=v=>({after_viewing:'After viewing','24h':'24 hours','1w':'1 week','1m':'1 month'}[v]||'24 hours');

  async function session(){
    const c=db();if(!c)return null;
    const {data}=await c.auth.getSession();me=data?.session?.user||null;return me;
  }
  async function call(name,args={}){const c=db();if(!c)throw new Error('Database unavailable');const {data,error}=await c.rpc(name,args);if(error)throw error;return data}

  function ensureRetentionUI(){
    const head=document.getElementById('v17-dm-thread-head');if(!head||document.getElementById('f2w-dm-retention-v126'))return;
    const wrap=document.createElement('div');wrap.id='f2w-dm-retention-v126';wrap.style.cssText='margin-left:auto;display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end';
    wrap.innerHTML='<label style="font-size:.58rem;opacity:.7;text-transform:uppercase;letter-spacing:.08em">Delete</label><select id="f2w-dm-retention-select-v126" style="background:#111827;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px 8px;font-size:.7rem"><option value="after_viewing">After viewing</option><option value="24h">24 hours</option><option value="1w">1 week</option><option value="1m">1 month</option></select>';
    head.appendChild(wrap);
    wrap.querySelector('select').addEventListener('change',async e=>{
      if(!activeId)return;
      e.target.disabled=true;
      try{await call('set_dm_retention_v126',{p_conversation_id:activeId,p_retention:e.target.value});await loadThread()}catch(err){alert(err.message||'Could not change deletion time')}
      finally{e.target.disabled=false}
    });
  }

  function subscribe(){
    const c=db();if(!c||!activeId)return;
    try{if(dmChannel)c.removeChannel(dmChannel)}catch{}
    dmChannel=c.channel(`f2w-dm-v126-${activeId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'f2w_dm_messages_v126',filter:`conversation_id=eq.${activeId}`},()=>{loadThread();refreshDirectMessages()})
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'f2w_dm_conversations_v126',filter:`id=eq.${activeId}`},()=>{loadThread();refreshDirectMessages()})
      .subscribe();
  }

  async function loadThread(){
    if(!activeId)return;
    ensureRetentionUI();
    const host=document.getElementById('v17-dm-messages');if(!host)return;
    try{
      const rows=await call('get_dm_messages_v126',{p_conversation_id:activeId,p_limit:120});
      const list=Array.isArray(rows)?rows:[];
      const retention=list[0]?.retention||activeOther?.retention||'24h';
      const sel=document.getElementById('f2w-dm-retention-select-v126');if(sel)sel.value=retention;
      const sub=document.querySelector('#v17-dm-thread-head span');if(sub)sub.textContent=`Messages delete ${label(retention).toLowerCase()}. This setting applies to both people.`;
      host.innerHTML=list.length?list.map(m=>m.kind==='system'
        ? `<div class="v17-dm-empty" style="margin:7px auto;max-width:90%">${esc(m.body)}</div>`
        : `<div class="v17-dm-message ${String(m.sender_user_id)===String(me?.id)?'own':''}" data-id="${esc(m.id)}"><div>${esc(m.body)}</div><small>${rel(m.created_at)}</small></div>`).join('')
        : '<div class="v17-dm-empty">No messages yet. Say hello.</div>';
      host.scrollTop=host.scrollHeight;
    }catch(err){host.innerHTML=`<div class="v17-dm-empty">${esc(err.message||'Messages unavailable')}</div>`}
  }

  async function selectConversation(row){
    activeId=row.conversation_id;activeOther=row;
    const head=document.getElementById('v17-dm-thread-head');
    if(head){const d=head.querySelector(':scope > div');if(d)d.innerHTML=`<strong>${esc(row.display_name||'@'+row.username)}</strong><span>@${esc(row.username)}</span>`}
    ensureRetentionUI();
    const input=document.getElementById('v17-dm-input'),send=document.getElementById('v17-dm-send');if(input)input.disabled=false;if(send)send.disabled=false;
    document.querySelectorAll('#v17-dm-conversations .v17-dm-conversation').forEach(x=>x.classList.toggle('active',x.dataset.id===activeId));
    subscribe();await loadThread();input?.focus();
  }

  async function refreshDirectMessages(){
    await session();
    const host=document.getElementById('v17-dm-conversations');if(!host)return;
    if(!me){host.innerHTML='<div class="v17-dm-empty">Sign in to use direct messages.</div>';return}
    try{
      const rows=await call('get_my_dm_conversations_v126');const list=Array.isArray(rows)?rows:[];
      host.innerHTML=list.length?list.map(r=>`<button type="button" class="v17-dm-conversation ${r.conversation_id===activeId?'active':''}" data-id="${esc(r.conversation_id)}"><span class="v17-dm-avatar">${r.avatar_url?`<img src="${esc(r.avatar_url)}" alt="" loading="lazy" decoding="async">`:'<i class="fa-solid fa-user"></i>'}</span><span class="v17-dm-conversation-copy"><strong data-f2w-dm-display-name="1">${esc(r.display_name||'@'+r.username)}</strong><span>${esc(r.last_message||'No messages yet')}</span></span><span class="v17-dm-conversation-meta"><small>${r.last_message_at?rel(r.last_message_at):''}</small></span></button>`).join(''):'<div class="v17-dm-empty">No conversations yet.</div>';
      host.querySelectorAll('.v17-dm-conversation').forEach((el,i)=>el.onclick=()=>selectConversation(list[i]));
    }catch(err){host.innerHTML=`<div class="v17-dm-empty">${esc(err.message||'Could not load messages')}</div>`}
  }

  async function openDirectMessage(username){
    if(!await session()){try{window.openAccountModal?.()}catch{};return}
    try{await window.openChat?.()}catch{}
    try{window.switchChatMode?.('dm')}catch{}
    const id=await call('open_dm_conversation_v126',{p_other_username:String(username||'').replace(/^@/,'')});
    await refreshDirectMessages();
    const rows=await call('get_my_dm_conversations_v126');const row=(rows||[]).find(r=>r.conversation_id===id);if(row)await selectConversation(row);
  }

  async function sendDirectMessage(){
    const input=document.getElementById('v17-dm-input');const button=document.getElementById('v17-dm-send');
    const body=String(input?.value||'').trim();if(!activeId||!body||sending)return;
    sending=true;if(button)button.disabled=true;
    const optimisticId='local-'+Date.now();
    const host=document.getElementById('v17-dm-messages');
    if(host){if(host.querySelector('.v17-dm-empty'))host.innerHTML='';host.insertAdjacentHTML('beforeend',`<div class="v17-dm-message own" data-id="${optimisticId}"><div>${esc(body)}</div><small>sending…</small></div>`);host.scrollTop=host.scrollHeight}
    if(input)input.value='';
    try{await call('send_dm_message_v126',{p_conversation_id:activeId,p_body:body});await loadThread();refreshDirectMessages()}
    catch(err){host?.querySelector(`[data-id="${optimisticId}"]`)?.remove();if(input)input.value=body;alert(err.message||'Message failed')}
    finally{sending=false;if(button)button.disabled=false;input?.focus()}
  }

  window.refreshDirectMessages=refreshDirectMessages;
  window.openDirectMessage=openDirectMessage;
  window.sendDirectMessage=sendDirectMessage;
  document.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&document.activeElement?.id==='v17-dm-input'){e.preventDefault();sendDirectMessage()}});
  document.addEventListener('click',e=>{if(e.target.closest?.('#v17-chat-dm-tab'))setTimeout(refreshDirectMessages,0)});
})();

/* ============================================================
   F2W v126 — LOW-COST NAVIGATION PREWARM
   Prefetch likely next pages on intent/idle, not every page at once.
   ============================================================ */
(() => {
  'use strict';
  if(window.__f2wPrefetchV126)return;window.__f2wPrefetchV126=true;
  const seen=new Set(), MAX=8;
  function prefetch(href){
    if(seen.size>=MAX)return;
    try{const u=new URL(href,location.href);if(u.origin!==location.origin||u.href===location.href||seen.has(u.href))return;seen.add(u.href);const l=document.createElement('link');l.rel='prefetch';l.as='document';l.href=u.href;document.head.appendChild(l)}catch{}
  }
  document.addEventListener('pointerover',e=>{const a=e.target.closest?.('a[href]');if(a)prefetch(a.href)},{passive:true});
  document.addEventListener('touchstart',e=>{const a=e.target.closest?.('a[href]');if(a)prefetch(a.href)},{passive:true});
  const idle=window.requestIdleCallback||((fn)=>setTimeout(fn,1200));
  idle(()=>['/home/','/movies/','/tv/','/chat/','/profile/'].forEach(prefetch));
})();
// f2w-force-save:v126-dm-presence-performance

// f2w-force-save:v128-instant-profile-presence:1788304200
