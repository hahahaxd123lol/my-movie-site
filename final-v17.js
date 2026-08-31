
(() => {
  'use strict';

  const WORKER_URL='https://viqufxlcxwgboyxbdhjb.supabase.co/functions/v1/rapid-worker';

  const THEME_LOGOS={
    'theme-red':'/flix2watch-logo-red-v34.png',
    'theme-blue':'/flix2watch-logo-blue-v34.png',
    'theme-green':'/flix2watch-logo-green-v34.png',
    'theme-purple':'/flix2watch-logo-purple-v34.png',
    'theme-amber':'/flix2watch-logo-amber-v34.png',
    'theme-matrix':'/flix2watch-logo-matrix-v34.png',
    'theme-cyan':'/flix2watch-logo-cyan-v34.png',
    'theme-pink':'/flix2watch-logo-pink-v34.png',
    'theme-orange':'/flix2watch-logo-orange-v34.png',
    'theme-ice':'/flix2watch-logo-ice-v34.png',
    'theme-gold':'/flix2watch-logo-gold-v34.png',
    'theme-midnight':'/flix2watch-logo-midnight-v34.png'
  };

  let v17SessionUser=null;
  let notificationChannel=null;
  let dmPollTimer=null;
  let activeDmConversationId='';
  let activeDmUsername='';
  let activeDmUserId='';
  let directMessageRows=[];

  function getClient(){
    try{
      if(typeof chatSupabase!=='undefined')return chatSupabase;
      if(typeof db!=='undefined')return db;
      if(window.__flix2watchAccountGuardClient)return window.__flix2watchAccountGuardClient;
    }catch{}
    return null;
  }

  function escapeHTML(value=''){
    return String(value).replace(/[&<>"']/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[ch]));
  }

  function timeAgo(value){
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return '';
    const seconds=Math.max(0,Math.floor((Date.now()-date.getTime())/1000));
    if(seconds<60)return 'now';
    const minutes=Math.floor(seconds/60);
    if(minutes<60)return `${minutes}m`;
    const hours=Math.floor(minutes/60);
    if(hours<24)return `${hours}h`;
    const days=Math.floor(hours/24);
    if(days<30)return `${days}d`;
    return date.toLocaleDateString();
  }

  /* ========================================================
     THEME + EXACT BRAND ASSET
     ======================================================== */

  function currentTheme(){
    const saved=
      localStorage.getItem('flix2watch_theme')
      ||localStorage.getItem('josh_site_theme')
      ||document.documentElement.dataset.flix2watchTheme
      ||'theme-red';

    return THEME_LOGOS[saved]?saved:'theme-red';
  }

  function applyExactThemeLogo(theme=currentTheme()){
    const src=THEME_LOGOS[theme]||THEME_LOGOS['theme-red'];

    document.querySelectorAll(
      'img[src*="flix2watch-logo-"],.logo-image,.f2w-guest-brand img,.f2w-account-brand img,.support-v16-brand img,.staff-page-toolbar .logo img,.footer-brand img'
    ).forEach(img=>{
      if(img.getAttribute('src')!==src)img.setAttribute('src',src);
    });
  }

  const previousSetTheme=window.setTheme;
  window.setTheme=function(name,themeClass){
    if(typeof previousSetTheme==='function'){
      try{previousSetTheme(name,themeClass)}catch{}
    }

    localStorage.setItem('flix2watch_theme',themeClass);
    localStorage.setItem('josh_site_theme',themeClass);
    document.documentElement.dataset.flix2watchTheme=themeClass;

    if(document.body){
      Object.keys(THEME_LOGOS).forEach(value=>document.body.classList.remove(value));
      document.body.classList.add(themeClass);
    }

    applyExactThemeLogo(themeClass);
    document.querySelectorAll('.dropdown-menu').forEach(menu=>menu.classList.remove('show'));
  };

  /* ========================================================
     USERNAME OR EMAIL LOGIN
     ======================================================== */

  async function loginWithIdentifier(identifier,password){
    const client=getClient();
    if(!client)throw new Error('Authentication is unavailable.');

    const value=String(identifier||'').trim();
    if(!value||!password)throw new Error('Enter your username/email and password.');

    try{
      const response=await fetch(WORKER_URL,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          action:'login_identifier',
          identifier:value,
          password
        })
      });

      const data=await response.json().catch(()=>({}));

      if(!response.ok||!data?.access_token||!data?.refresh_token){
        throw new Error(data?.error||'Invalid username/email or password.');
      }

      const {data:sessionData,error}=await client.auth.setSession({
        access_token:data.access_token,
        refresh_token:data.refresh_token
      });

      if(error)throw error;
      return sessionData;
    }catch(error){
      // Backward-compatible direct email login if the new worker has not yet
      // been deployed. Username login still requires the V17 worker.
      if(value.includes('@')){
        const {data,error:directError}=await client.auth.signInWithPassword({
          email:value,
          password
        });
        if(directError)throw directError;
        return data;
      }
      throw error;
    }
  }

  window.loginWithIdentifier=loginWithIdentifier;

  const originalShowAccountMode=window.showAccountMode;
  window.showAccountMode=function(mode){
    if(typeof originalShowAccountMode==='function'){
      originalShowAccountMode(mode);
    }

    const signup=mode==='signup';
    const label=document.getElementById('account-email-label');
    const input=document.getElementById('account-email');

    if(label)label.textContent=signup?'EMAIL':'USERNAME OR EMAIL';

    if(input){
      input.type=signup?'email':'text';
      input.autocomplete=signup?'email':'username';
      input.placeholder=signup?'you@example.com':'Username or email';
    }
  };

  const originalSubmitAccountAuth=window.submitAccountAuth;
  window.submitAccountAuth=async function(){
    const signup=document.getElementById('account-signup-tab')?.classList.contains('active');

    if(signup){
      if(typeof originalSubmitAccountAuth==='function'){
        return originalSubmitAccountAuth();
      }
      return;
    }

    const identifier=document.getElementById('account-email')?.value.trim()||'';
    const password=document.getElementById('account-password')?.value||'';

    if(!identifier||!password){
      if(typeof setAccountMessage==='function'){
        setAccountMessage('Enter your username/email and password.',true);
      }
      return;
    }

    if(typeof setAccountMessage==='function')setAccountMessage('Signing in…');

    try{
      await loginWithIdentifier(identifier,password);

      if(typeof refreshAccountUI==='function')await refreshAccountUI();
      if(typeof closeAccountModal==='function')closeAccountModal();

      try{
        if(typeof ensureChatIdentity==='function')await ensureChatIdentity();
        if(typeof loadChatMessages==='function')await loadChatMessages();
      }catch{}
    }catch(error){
      if(typeof setAccountMessage==='function'){
        setAccountMessage(error?.message||'Invalid username/email or password.',true);
      }
    }
  };

  window.quickHomeLogin=async function(){
    const identifier=document.getElementById('home-quick-email')?.value.trim()||'';
    const password=document.getElementById('home-quick-password')?.value||'';
    const message=document.getElementById('home-quick-login-message');
    const button=document.getElementById('home-quick-login-btn');

    if(!identifier||!password){
      if(message){
        message.textContent='Enter your username/email and password.';
        message.classList.add('error');
      }
      return;
    }

    if(button)button.disabled=true;
    if(message){
      message.textContent='Signing in…';
      message.classList.remove('error');
    }

    try{
      await loginWithIdentifier(identifier,password);
      if(message)message.textContent='Logged in.';
    }catch(error){
      if(message){
        message.textContent=error?.message||'Login failed.';
        message.classList.add('error');
      }
    }finally{
      if(button)button.disabled=false;
    }
  };

  /* ========================================================
     NOTIFICATIONS
     ======================================================== */

  function notificationIcon(type){
    return {
      follow:'fa-user-plus',
      warning:'fa-triangle-exclamation',
      ban:'fa-ban',
      unban:'fa-unlock',
      mute:'fa-volume-xmark',
      unmute:'fa-volume-high',
      staff_granted:'fa-shield-halved',
      staff_revoked:'fa-shield',
      dm:'fa-paper-plane',
      system:'fa-bell'
    }[type]||'fa-bell';
  }

  async function loadNotifications(){
    const client=getClient();
    const wrap=document.getElementById('notification-wrap');
    const list=document.getElementById('notification-list');
    const count=document.getElementById('notification-count');

    if(!client||!v17SessionUser){
      if(wrap)wrap.style.display='none';
      return;
    }

    if(wrap)wrap.style.display='inline-flex';

    try{
      const {data,error}=await client.rpc('get_my_notifications',{p_limit:50});
      if(error)throw error;

      const rows=Array.isArray(data)?data:[];
      const unread=rows.filter(row=>!row.read_at).length;

      if(count){
        count.textContent=unread>99?'99+':String(unread);
        count.hidden=unread===0;
      }

      if(!list)return;

      if(!rows.length){
        list.innerHTML='<div class="v17-notification-empty">No notifications yet.</div>';
        return;
      }

      list.innerHTML=rows.map(row=>`
        <button
          class="v17-notification-item ${row.read_at?'':'unread'}"
          type="button"
          data-id="${escapeHTML(row.id)}"
          data-link="${escapeHTML(row.link||'')}"
          data-type="${escapeHTML(row.notification_type||'system')}"
          data-actor="${escapeHTML(row.actor_username||'')}"
        >
          <span class="v17-notification-icon"><i class="fa-solid ${notificationIcon(row.notification_type)}"></i></span>
          <span class="v17-notification-copy">
            <strong>${escapeHTML(row.title||'Notification')}</strong>
            <span>${escapeHTML(row.body||'')}</span>
            <small>${timeAgo(row.created_at)}</small>
          </span>
        </button>
      `).join('');

      list.querySelectorAll('.v17-notification-item').forEach(button=>{
        button.addEventListener('click',async()=>{
          await markNotificationRead(button.dataset.id);
          const type=button.dataset.type||'';
          const actor=button.dataset.actor||'';
          const link=button.dataset.link||'';

          document.getElementById('notification-menu').hidden=true;

          if(type==='dm'&&actor){
            window.openDirectMessage(actor);
          }else if(link){
            window.location.href=link;
          }
        });
      });
    }catch(error){
      console.warn('Notifications unavailable:',error);
      if(list)list.innerHTML='<div class="v17-notification-empty">Notifications are unavailable until the V17 database update is installed.</div>';
    }
  }

  async function markNotificationRead(id){
    const client=getClient();
    if(!client||!id)return;
    try{
      await client.rpc('mark_notification_read',{p_notification_id:id});
    }catch{}
    loadNotifications();
  }

  window.toggleNotifications=function(event){
    event?.stopPropagation?.();
    const menu=document.getElementById('notification-menu');
    if(!menu)return;
    menu.hidden=!menu.hidden;
    if(!menu.hidden)loadNotifications();
  };

  window.markAllNotificationsRead=async function(){
    const client=getClient();
    if(!client)return;
    try{
      await client.rpc('mark_all_notifications_read');
    }catch{}
    loadNotifications();
  };

  function installNotificationRealtime(userId){
    const client=getClient();
    if(!client||!userId)return;

    if(notificationChannel){
      try{client.removeChannel(notificationChannel)}catch{}
      notificationChannel=null;
    }

    try{
      notificationChannel=client
        .channel(`flix2watch-notifications-v17-${userId}`)
        .on(
          'postgres_changes',
          {
            event:'*',
            schema:'public',
            table:'user_notifications',
            filter:`user_id=eq.${userId}`
          },
          ()=>{
            loadNotifications();
            refreshDirectMessages();
          }
        )
        .subscribe();
    }catch{}
  }

  /* ========================================================
     DIRECT MESSAGES
     ======================================================== */

  function initials(username='?'){
    return String(username||'?').slice(0,2).toUpperCase();
  }

  function setDmUnread(countValue){
    const el=document.getElementById('v17-dm-unread');
    const count=Number(countValue||0);
    if(!el)return;
    el.textContent=count>99?'99+':String(count);
    el.hidden=count<=0;
  }

  function renderConversationList(rows){
    const host=document.getElementById('v17-dm-conversations');
    if(!host)return;

    directMessageRows=Array.isArray(rows)?rows:[];
    setDmUnread(directMessageRows.reduce((sum,row)=>sum+Number(row.unread_count||0),0));

    if(!directMessageRows.length){
      host.innerHTML='<div class="v17-dm-empty">No private conversations yet. Open someone’s profile and press Message.</div>';
      return;
    }

    host.innerHTML=directMessageRows.map(row=>{
      const avatar=row.avatar_url
        ?`<img src="${escapeHTML(row.avatar_url)}" alt="">`
        :escapeHTML(initials(row.username));

      return `
        <button class="v17-dm-conversation ${row.conversation_id===activeDmConversationId?'active':''}" type="button" data-id="${escapeHTML(row.conversation_id)}" data-username="${escapeHTML(row.username||'')}" data-user-id="${escapeHTML(row.other_user_id||'')}">
          <span class="v17-dm-avatar">${avatar}</span>
          <span class="v17-dm-conversation-copy">
            <strong>${escapeHTML(row.display_name||row.username||'User')}</strong>
            <span>${escapeHTML(row.last_message||'Start a conversation')}</span>
          </span>
          <span class="v17-dm-conversation-meta">
            <small>${row.last_message_at?timeAgo(row.last_message_at):''}</small>
            ${Number(row.unread_count||0)>0?`<b class="v17-dm-badge">${Number(row.unread_count)}</b>`:''}
          </span>
        </button>`;
    }).join('');

    host.querySelectorAll('.v17-dm-conversation').forEach(button=>{
      button.addEventListener('click',()=>{
        activeDmConversationId=button.dataset.id||'';
        activeDmUsername=button.dataset.username||'';
        activeDmUserId=button.dataset.userId||'';
        loadDirectMessageThread();
        renderConversationList(directMessageRows);
      });
    });
  }

  window.refreshDirectMessages=async function(){
    const client=getClient();
    if(!client||!v17SessionUser){
      renderConversationList([]);
      return;
    }

    try{
      const {data,error}=await client.rpc('dm_list_conversations');
      if(error)throw error;
      renderConversationList(Array.isArray(data)?data:[]);
    }catch(error){
      console.warn('Direct message list unavailable:',error);
      const host=document.getElementById('v17-dm-conversations');
      if(host)host.innerHTML='<div class="v17-dm-empty">Direct messages need the V17 Supabase migration before they can be used.</div>';
    }
  };

  async function loadDirectMessageThread(){
    const client=getClient();
    const host=document.getElementById('v17-dm-messages');
    const head=document.getElementById('v17-dm-thread-head');
    const input=document.getElementById('v17-dm-input');
    const send=document.getElementById('v17-dm-send');

    if(!client||!activeDmConversationId||!activeDmUsername){
      if(host)host.innerHTML='<div class="v17-dm-empty">Choose a conversation.</div>';
      if(input)input.disabled=true;
      if(send)send.disabled=true;
      return;
    }

    if(head){
      head.innerHTML=`
        <div>
          <strong>@${escapeHTML(activeDmUsername)}</strong>
          <span>Private, participant-only conversation · encrypted at rest</span>
        </div>`;
    }

    if(input)input.disabled=false;
    if(send)send.disabled=false;

    try{
      const {data,error}=await client.rpc('dm_get_messages',{
        p_conversation_id:activeDmConversationId,
        p_limit:150
      });
      if(error)throw error;

      const rows=Array.isArray(data)?data:[];

      if(host){
        host.innerHTML=rows.length
          ?rows.map(row=>`
            <div class="v17-dm-message ${row.mine?'mine':''}">
              ${row.mine?`<button class="v17-dm-delete" type="button" title="Delete your message" onclick="deleteDirectMessage('${escapeHTML(row.id)}')"><i class="fa-solid fa-trash"></i></button>`:''}
              <div>${escapeHTML(row.body||'')}</div>
              <small>${new Date(row.created_at).toLocaleString()}${row.read_at&&row.mine?' · read':''}</small>
            </div>`).join('')
          :'<div class="v17-dm-empty">No messages yet. Say hello.</div>';

        host.scrollTop=host.scrollHeight;
      }

      refreshDirectMessages();
      loadNotifications();
    }catch(error){
      if(host)host.innerHTML=`<div class="v17-dm-empty">${escapeHTML(error?.message||'Could not load this conversation.')}</div>`;
    }
  }

  window.sendDirectMessage=async function(){
    const client=getClient();
    const input=document.getElementById('v17-dm-input');
    const button=document.getElementById('v17-dm-send');
    const body=String(input?.value||'').trim();

    if(!client||!activeDmUsername||!body)return;

    if(button)button.disabled=true;

    try{
      const {error}=await client.rpc('dm_send_message',{
        p_target_username:activeDmUsername,
        p_body:body
      });
      if(error)throw error;
      if(input)input.value='';
      await loadDirectMessageThread();
    }catch(error){
      alert(error?.message||'Could not send private message.');
    }finally{
      if(button)button.disabled=false;
      input?.focus();
    }
  };

  window.deleteDirectMessage=async function(messageId){
    const client=getClient();
    if(!client||!messageId)return;

    try{
      const {error}=await client.rpc('dm_delete_message',{
        p_message_id:messageId
      });
      if(error)throw error;
      await loadDirectMessageThread();
    }catch(error){
      alert(error?.message||'Could not delete that message.');
    }
  };

  window.switchChatMode=async function(mode){
    const publicPanel=document.getElementById('v17-public-chat-panel');
    const dmPanel=document.getElementById('v17-dm-panel');
    const publicTab=document.getElementById('v17-chat-public-tab');
    const dmTab=document.getElementById('v17-chat-dm-tab');

    const dm=mode==='dm';

    if(dm&&!v17SessionUser){
      if(typeof showAccountMode==='function')showAccountMode('login');
      if(typeof openAccountModal==='function')openAccountModal();
      return;
    }

    if(publicPanel)publicPanel.hidden=dm;
    if(dmPanel)dmPanel.hidden=!dm;
    publicTab?.classList.toggle('active',!dm);
    dmTab?.classList.toggle('active',dm);

    if(dm){
      await refreshDirectMessages();
      if(activeDmConversationId)await loadDirectMessageThread();
    }
  };

  window.openDirectMessage=async function(username){
    const cleanUsername=String(username||'').trim();

    if(!document.getElementById('chat-modal')){
      if(cleanUsername){
        sessionStorage.setItem('flix2watch_dm_target_v17',cleanUsername);
        window.location.href=`/home/?dm=${encodeURIComponent(cleanUsername)}`;
      }
      return;
    }

    const client=getClient();
    if(!client)return;

    if(!v17SessionUser){
      try{
        const {data}=await client.auth.getUser();
        v17SessionUser=data?.user||null;
      }catch{}
    }

    if(!v17SessionUser){
      if(typeof showAccountMode==='function')showAccountMode('login');
      if(typeof openAccountModal==='function')openAccountModal();
      return;
    }

    try{
      const {data,error}=await client.rpc('dm_get_or_create_conversation',{
        p_target_username:cleanUsername
      });
      if(error)throw error;

      activeDmConversationId=data?.conversation_id||'';
      activeDmUsername=data?.username||cleanUsername;
      activeDmUserId=data?.user_id||'';

      if(typeof window.__v17OriginalOpenChat==='function'){
        window.__v17OriginalOpenChat();
      }else if(typeof openChat==='function'){
        openChat();
      }

      await window.switchChatMode('dm');
      await loadDirectMessageThread();
    }catch(error){
      alert(error?.message||'Could not open that private conversation.');
    }
  };

  function wrapPublicChatOpen(){
    if(window.__v17ChatWrapped)return;
    if(typeof window.openChat!=='function')return;

    window.__v17OriginalOpenChat=window.openChat;
    window.openChat=function(){
      window.__v17OriginalOpenChat();
      setTimeout(()=>window.switchChatMode('public'),0);
    };
    window.__v17ChatWrapped=true;
  }

  /* ========================================================
     WATCH LOCK GUARANTEE
     ======================================================== */

  async function guaranteeWatchLock(){
    if(!document.body?.classList.contains('f2w-watch-page'))return;

    const client=getClient();
    let user=null;

    try{
      if(client){
        const {data}=await client.auth.getUser();
        user=data?.user||null;
      }
    }catch{}

    const overlay=document.getElementById('watch-login-overlay');
    const frame=document.getElementById('video-frame');

    if(!user){
      document.body.classList.add('watch-locked');
      document.body.classList.remove('watch-authenticated');

      if(overlay){
        overlay.hidden=false;
        overlay.setAttribute('aria-hidden','false');
      }

      if(frame){
        frame.src='data:text/html,%3Cbody%20style%3D%22margin%3A0%3Bbackground%3A%23000%22%3E';
        frame.setAttribute('aria-hidden','true');
      }
    }
  }

  /* ========================================================
     AUTH SESSION SYNC
     ======================================================== */

  async function syncSession(){
    const client=getClient();
    if(!client)return;

    try{
      const {data}=await client.auth.getSession();
      v17SessionUser=data?.session?.user||null;
    }catch{
      v17SessionUser=null;
    }

    const wrap=document.getElementById('notification-wrap');
    if(wrap)wrap.style.display=v17SessionUser?'inline-flex':'none';

    if(v17SessionUser){
      installNotificationRealtime(v17SessionUser.id);
      loadNotifications();
      refreshDirectMessages();

      clearInterval(dmPollTimer);
      dmPollTimer=setInterval(()=>{
        const panel=document.getElementById('v17-dm-panel');
        if(panel&&!panel.hidden){
          refreshDirectMessages();
          if(activeDmConversationId)loadDirectMessageThread();
        }
      },10000);
    }else{
      clearInterval(dmPollTimer);
      dmPollTimer=null;
      setDmUnread(0);
    }

    try{
      client.auth.onAuthStateChange((_event,session)=>{
        v17SessionUser=session?.user||null;
        const notificationWrap=document.getElementById('notification-wrap');
        if(notificationWrap)notificationWrap.style.display=v17SessionUser?'inline-flex':'none';

        if(v17SessionUser){
          installNotificationRealtime(v17SessionUser.id);
          loadNotifications();
          refreshDirectMessages();
        }else{
          setDmUnread(0);
        }

        guaranteeWatchLock();
      });
    }catch{}
  }

  function installDmEnter(){
    const input=document.getElementById('v17-dm-input');
    if(!input||input.dataset.v17Enter==='1')return;
    input.dataset.v17Enter='1';
    input.addEventListener('keydown',event=>{
      if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){
        event.preventDefault();
        window.sendDirectMessage();
      }
    });
  }

  function boot(){
    applyExactThemeLogo(currentTheme());
    wrapPublicChatOpen();
    installDmEnter();
    syncSession();
    guaranteeWatchLock();

    const dmParam=new URLSearchParams(window.location.search).get('dm');
    const storedDm=sessionStorage.getItem('flix2watch_dm_target_v17');
    const dmTarget=String(dmParam||storedDm||'').replace(/[^A-Za-z0-9]/g,'');

    if(dmTarget&&document.getElementById('chat-modal')){
      sessionStorage.removeItem('flix2watch_dm_target_v17');

      const cleanUrl=new URL(window.location.href);
      cleanUrl.searchParams.delete('dm');
      history.replaceState(null,'',cleanUrl);

      setTimeout(()=>window.openDirectMessage(dmTarget),450);
    }

    // Normalize login UI on first open.
    setTimeout(()=>{
      const loginTab=document.getElementById('account-login-tab');
      if(loginTab?.classList.contains('active')){
        window.showAccountMode('login');
      }
    },0);
  }

  document.addEventListener('click',event=>{
    if(!event.target.closest('.v17-notification-wrap')){
      const menu=document.getElementById('notification-menu');
      if(menu)menu.hidden=true;
    }
  });

  window.addEventListener('storage',event=>{
    if(event.key==='flix2watch_theme'||event.key==='josh_site_theme'){
      applyExactThemeLogo(currentTheme());
    }
  });

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  }else{
    boot();
  }
})();
