(() => {
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
        fallbackClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
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
    presenceTimer=setInterval(touchPresence,15000);
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

  async function decorateNames(){
    const targets=[...document.querySelectorAll('[data-f2w-username]')];
    /* Current profile heading is not data-tagged in older markup. */
    try{
      if(typeof viewedProfile!=='undefined'&&viewedProfile?.username){
        const nameEl=document.getElementById('profile-display-name')||document.querySelector('.profile-name,.profile-identity h1');
        if(nameEl){nameEl.dataset.f2wUsername=viewedProfile.username;targets.push(nameEl);}
      }
    }catch{}
    const pending=targets.filter(el=>!el.dataset.f2wRoleChecked&&el.dataset.f2wUsername);
    if(!pending.length)return;
    const names=[...new Set(pending.map(el=>String(el.dataset.f2wUsername||'').replace(/^@/,'').toLowerCase()).filter(Boolean))];
    if(!names.length)return;
    try{
      const rows=await rpc('get_public_name_effects',{p_usernames:names});
      const map=new Map((rows||[]).map(row=>[String(row.username||'').toLowerCase(),row.top_role]));
      pending.forEach(el=>{
        const role=map.get(String(el.dataset.f2wUsername||'').replace(/^@/,'').toLowerCase());
        if(role)applyRoleEffect(el,role);
        el.dataset.f2wRoleChecked='1';
      });
    }catch{
      pending.forEach(el=>{el.dataset.f2wRoleChecked='1'});
    }
  }

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

    let title='',poster='';
    for(let i=0;i<40&&!title;i++){
      title=String(document.getElementById('detail-title')?.textContent||'').trim();
      const img=document.querySelector('#detail-poster img,.detail-poster img,.poster img,img[alt*="poster" i]');
      poster=String(img?.getAttribute('src')||'');
      if(!title||/loading title|loading\.\.\./i.test(title)){
        title='';
        await new Promise(resolve=>setTimeout(resolve,250));
      }
    }
    if(!title)title=`${mediaType==='tv'?'TV':'Movie'} #${mediaId}`;

    let posterPath=null;
    const match=poster.match(/image\.tmdb\.org\/t\/p\/[^/]+(\/[^?]+)/i);
    if(match)posterPath=match[1];

    try{
      await rpc('record_title_open',{
        p_media_type:mediaType,
        p_media_id:mediaId,
        p_title:title.slice(0,250),
        p_poster_path:posterPath
      });
      watchOpenRecordedKey=key;
    }catch(error){
      console.warn('Title-open tracking unavailable:',error?.message||error);
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
    const href=socialHref(kind,value);
    const text=kind==='website'?'Website':(label||cleanSocialHandle(value));
    return `<a class="f2w-profile-social-link f2w-social-${kind}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">
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
      },180);
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
    const client=db();if(!client)return;

    if(profile.is_private&&!isOwnProfile(profile)){
      host.innerHTML='<div class="f2w-profile-empty">Recently watched is private.</div>';
      return;
    }

    try{
      const {data,error}=await client
        .from('profile_title_activity')
        .select('media_type,media_id,title,poster_path,last_opened_at,open_count')
        .eq('user_id',profile.user_id)
        .order('last_opened_at',{ascending:false})
        .limit(12);
      if(error)throw error;

      host.innerHTML=(data||[]).length
        ? `<div class="f2w-recently-watched-grid">${data.map(row=>`
            <a class="f2w-recent-watch-card" href="/watch/?id=${encodeURIComponent(row.media_id)}&type=${encodeURIComponent(row.media_type)}">
              <img src="${row.poster_path?`https://image.tmdb.org/t/p/w342${esc(row.poster_path)}`:RED_LOGO}" alt="" loading="lazy" onerror="this.src='${RED_LOGO}'">
              <div>
                <strong>${esc(row.title)}</strong>
                <span>${row.media_type==='tv'?'TV':'Movie'} · ${formatRelative(row.last_opened_at)}</span>
              </div>
            </a>`).join('')}</div>`
        : '<div class="f2w-profile-empty">No titles opened yet.</div>';
    }catch(error){
      host.innerHTML='<div class="f2w-profile-empty">Recently watched is unavailable right now.</div>';
      console.warn('Recently watched unavailable:',error?.message||error);
    }
  }

  function subscribeProfileActivity(userId){
    const client=db();if(!client||activityChannel?.topic?.includes(userId))return;
    try{if(activityChannel)client.removeChannel(activityChannel)}catch{}
    try{activityChannel=client.channel(`v35-profile-activity-${userId}`).on('postgres_changes',{event:'*',schema:'public',table:'profile_title_activity',filter:`user_id=eq.${userId}`},()=>renderProfileActivity()).subscribe()}catch{}
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
    const anchor=document.querySelector('#profile-hero > div:last-child,.profile-bio,.profile-identity,.profile-header-copy');
    if(!anchor)return;

    let host=document.getElementById('v17-profile-extra');
    if(!host){
      host=document.createElement('div');
      host.id='v17-profile-extra';
      anchor.appendChild(host);
    }

    const genres=Array.isArray(profile.favorite_genres)?profile.favorite_genres:[];
    const status=String(profile.status_text||'').trim();
    const pronouns=String(profile.pronouns||'').trim();
    const quote=String(profile.profile_quote||'').trim();

    host.innerHTML=`
      ${status?`<div class="f2w-profile-status-text"><i class="fa-solid fa-message"></i>${esc(status)}</div>`:''}
      <div class="f2w-profile-extra">
        ${pronouns?`<span class="f2w-profile-chip"><i class="fa-solid fa-id-card"></i>${esc(pronouns)}</span>`:''}
        ${profile.location?`<span class="f2w-profile-chip"><i class="fa-solid fa-location-dot"></i>${esc(profile.location)}</span>`:''}
        ${genres.slice(0,8).map(g=>`<span class="f2w-profile-chip">${esc(g)}</span>`).join('')}
        ${profile.favorite_movie_text?`<a class="f2w-profile-chip f2w-favorite-movie-chip" href="${profile.favorite_movie_tmdb_id?`/watch/?id=${encodeURIComponent(profile.favorite_movie_tmdb_id)}&type=movie`:'#'}"><i class="fa-solid fa-film"></i>${esc(profile.favorite_movie_text)}</a>`:''}
      </div>
      ${quote?`<blockquote class="f2w-profile-quote">“${esc(quote)}”</blockquote>`:''}
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

  function openProfileEditor(){
    const profile=viewedProfileObject();if(!isOwnProfile(profile))return;
    let modal=document.getElementById('v35-profile-modal');
    if(!modal){
      modal=document.createElement('div');
      modal.id='v35-profile-modal';
      modal.className='f2w-profile-modal';
      modal.onclick=e=>{if(e.target===modal)modal.hidden=true};
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

    modal.hidden=false;
    modal.querySelector('.f2w-editor-close').onclick=()=>{modal.hidden=true};
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
        modal.hidden=true;
        try{renderViewedProfile?.();}catch{}
        renderProfileExtras(viewedProfileObject());
        decorateNames();
      },180);
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
        <span>Titles opened on Flix2Watch · no duplicates</span>
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

  async function renderProfilePresence(){
    if(!location.pathname.startsWith('/profile'))return;
    const profile=viewedProfileObject();if(!profile?.user_id)return;
    ensureProfileRealtimePanels();

    const badge=document.getElementById('v17-profile-presence');if(!badge)return;
    try{
      const rows=await rpc('get_public_profile_presence',{p_user_id:profile.user_id});
      const row=Array.isArray(rows)?rows[0]:rows;
      const online=Boolean(row?.online);
      badge.classList.toggle('online',online);
      badge.classList.toggle('offline',!online);
      badge.querySelector('span').textContent=online?'Online':row?.last_seen_at?`Last online ${formatRelative(row.last_seen_at)}`:'Offline';
    }catch{
      badge.classList.remove('online');
      badge.classList.add('offline');
      badge.querySelector('span').textContent='Offline';
    }
  }

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
        .on('postgres_changes',{event:'*',schema:'public',table:'profiles',filter:`user_id=eq.${profile.user_id}`},()=>setTimeout(()=>location.reload(),180))
        .on('postgres_changes',{event:'*',schema:'public',table:'profile_role_assignments',filter:`user_id=eq.${profile.user_id}`},()=>{
          document.querySelectorAll('[data-f2w-role-checked]').forEach(el=>delete el.dataset.f2wRoleChecked);
          decorateNames();
        })
        .subscribe();
    }catch{}

    if(profileUiTimer)clearInterval(profileUiTimer);
    profileUiTimer=setInterval(()=>{
      renderProfilePresence();
      renderProfileActivity();
    },15000);
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
    setInterval(refresh,20000);
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

  /* ---------- boot ---------- */
  async function boot(){
    forceRedLogo();addLeaderboardNav();hardenRouting();installDmSearch();reorderSourceButtons();
    installAuthAbuseGuard();
    await syncAuthUI();
    registerCurrentAbuseSignals();
    prewarmChat();
    setTimeout(()=>{recordWatchOpen();startWatchTime();renderProfileActivity();installProfileEditor();bootProfileRealtime();enrichForum();bootLeaderboard();decorateNames();installStaffQuickModeration()},350);
    roleDecorateTimer=setInterval(()=>{forceRedLogo();decorateNames();installDmSearch();installProfileEditor();renderProfileExtras(viewedProfileObject());installStaffQuickModeration()},5000);
    const client=db();
    try{client?.auth?.onAuthStateChange?.(()=>setTimeout(()=>{installAuthAbuseGuard();syncAuthUI();registerCurrentAbuseSignals();recordWatchOpen();startWatchTime();installProfileEditor();bootProfileRealtime();renderProfileComments();enrichForum()},0))}catch{}
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){touchPresence();recordWatchOpen();}else{leavePresence();}});
    window.addEventListener('pagehide',()=>{leavePresence()});
    const observer=new MutationObserver(()=>{forceRedLogo();addLeaderboardNav();hardenRouting()});
    observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','hidden','style']});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
// f2w-force-save:ban-evasion-final-v35-v1:1788212206
// f2w-force-save:realtime-profile-leaderboard-v17:1788213599
// f2w-force-save:profile-editor-v22:1788214990
 