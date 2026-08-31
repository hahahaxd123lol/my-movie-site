(() => {
  'use strict';

  const SUPABASE_URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
  const SUPABASE_KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
  const CHAT_API_URL=`${SUPABASE_URL}/functions/v1/rapid-worker`;
  const RED_LOGO='/flix2watch-logo-red-v34.png';
  const ROLE_PRIORITY=['owner','admin','staff','moderator','support','developer','verified','contributor','curator'];
  let fallbackClient=null;
  let authUser=null;
  let presenceTimer=null;
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

  async function worker(action,payload={}){
    const response=await fetch(CHAT_API_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      cache:'no-store',
      body:JSON.stringify({action,...payload})
    });
    const result=await response.json().catch(()=>({success:false,error:`HTTP ${response.status}`}));
    if(!response.ok||result?.success===false){
      throw new Error(result?.error||`Worker returned HTTP ${response.status}`);
    }
    return result;
  }

  /* ---------- LOGIN: preserve existing signup/session flow, add username ---------- */
  window.f2wLoginIdentifier=async function(identifier,password){
    const client=db();
    if(!client)return {data:null,error:new Error('Authentication is not ready.')};
    const clean=String(identifier||'').trim();
    try{
      const result=await worker('login_identifier',{identifier:clean,password:String(password||'')});
      const {data,error}=await client.auth.setSession({
        access_token:String(result.access_token||''),
        refresh_token:String(result.refresh_token||'')
      });
      if(error)throw error;
      return {data:{user:data?.user||result.user,session:data?.session||null},error:null};
    }catch(error){
      /* Email logins keep the old direct path as a deployment-safe fallback. */
      if(clean.includes('@')){
        const direct=await client.auth.signInWithPassword({email:clean,password:String(password||'')});
        if(!direct.error)return direct;
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
    try{ await rpc('touch_presence'); }catch{}
  }
  function startPresence(){
    if(presenceTimer)return;
    touchPresence();
    presenceTimer=setInterval(touchPresence,25000);
  }
  function stopPresence(){ if(presenceTimer){clearInterval(presenceTimer);presenceTimer=null;} }

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
  function applyRoleEffect(el,role){
    if(!el||!role)return;
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
    let title='';let poster='';
    for(let i=0;i<30&&!title;i++){
      title=String(document.getElementById('detail-title')?.textContent||document.querySelector('h1')?.textContent||'').trim();
      const img=document.querySelector('#detail-poster img,.detail-poster img,.poster img,img[alt*="poster" i]');
      poster=String(img?.getAttribute('src')||'');
      if(!title)await new Promise(resolve=>setTimeout(resolve,300));
    }
    if(!title||/loading/i.test(title))title=`${mediaType==='tv'?'TV':'Movie'} #${mediaId}`;
    let posterPath=null;
    const match=poster.match(/image\.tmdb\.org\/t\/p\/[^/]+(\/[^?]+)/i);if(match)posterPath=match[1];
    try{
      await rpc('record_title_open',{p_media_type:mediaType,p_media_id:mediaId,p_title:title.slice(0,250),p_poster_path:posterPath});
    }catch{}
  }

  function startWatchTime(){
    if(!authUser||!location.pathname.startsWith('/watch'))return;
    const params=new URLSearchParams(location.search);const mediaId=Number(params.get('id'));const mediaType=params.get('type')==='tv'?'tv':'movie';if(!mediaId)return;
    setInterval(async()=>{
      if(document.visibilityState!=='visible'||!authUser)return;
      const frame=document.querySelector('iframe[src]');if(!frame)return;
      try{await rpc('add_watch_seconds',{p_media_type:mediaType,p_media_id:mediaId,p_seconds:30});}catch{}
    },30000);
  }

  /* ---------- profile activity + richer profile editor ---------- */
  function viewedProfileObject(){try{return typeof viewedProfile!=='undefined'?viewedProfile:null}catch{return null}}
  function isOwnProfile(profile){return Boolean(profile&&authUser&&String(profile.user_id)===String(authUser.id));}

  async function renderProfileActivity(){
    if(!location.pathname.startsWith('/profile'))return;
    const profile=viewedProfileObject();if(!profile?.user_id)return;
    const hosts=[document.getElementById('v16-profile-activity'),document.getElementById('f2w-profile-activity')].filter(Boolean);
    if(!hosts.length)return;
    const client=db();if(!client)return;
    try{
      const {data,error}=await client.from('profile_title_activity').select('media_type,media_id,title,poster_path,last_opened_at,open_count').eq('user_id',profile.user_id).order('last_opened_at',{ascending:false}).limit(18);
      if(error)throw error;
      const html=(data||[]).length?`<div class="f2w-title-activity-grid">${data.map(row=>`<a class="f2w-title-activity-card" href="/watch/?id=${encodeURIComponent(row.media_id)}&type=${encodeURIComponent(row.media_type)}"><img src="${row.poster_path?`https://image.tmdb.org/t/p/w342${esc(row.poster_path)}`:RED_LOGO}" alt="" loading="lazy" onerror="this.src='${RED_LOGO}'"><div class="f2w-title-activity-copy"><strong>${esc(row.title)}</strong><small>${row.media_type==='tv'?'TV series':'Movie'} · opened ${formatRelative(row.last_opened_at)}</small></div></a>`).join('')}</div>`:'<div class="empty">No title activity yet.</div>';
      hosts.forEach(host=>{host.innerHTML=html});
      subscribeProfileActivity(profile.user_id);
    }catch(error){console.warn('Recent title activity unavailable:',error?.message||error);}
  }

  function subscribeProfileActivity(userId){
    const client=db();if(!client||activityChannel?.topic?.includes(userId))return;
    try{if(activityChannel)client.removeChannel(activityChannel)}catch{}
    try{activityChannel=client.channel(`v35-profile-activity-${userId}`).on('postgres_changes',{event:'*',schema:'public',table:'profile_title_activity',filter:`user_id=eq.${userId}`},()=>renderProfileActivity()).subscribe()}catch{}
  }

  function formatRelative(value){
    if(!value)return 'recently';const d=new Date(value);const diff=Math.max(0,Date.now()-d.getTime());
    if(diff<60000)return 'just now';if(diff<3600000)return `${Math.floor(diff/60000)}m ago`;if(diff<86400000)return `${Math.floor(diff/3600000)}h ago`;if(diff<604800000)return `${Math.floor(diff/86400000)}d ago`;
    return d.toLocaleDateString();
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
    if(!profile)return;
    let host=document.getElementById('v35-profile-extra');
    const anchor=document.querySelector('.profile-bio,.profile-identity,.profile-header-copy');
    if(!anchor)return;
    if(!host){host=document.createElement('div');host.id='v35-profile-extra';anchor.appendChild(host);}
    const genres=Array.isArray(profile.favorite_genres)?profile.favorite_genres:[];
    host.innerHTML=`<div class="f2w-profile-extra">${profile.location?`<span class="f2w-profile-chip"><i class="fa-solid fa-location-dot"></i>${esc(profile.location)}</span>`:''}${genres.slice(0,5).map(g=>`<span class="f2w-profile-chip">${esc(g)}</span>`).join('')}</div><div class="f2w-profile-socials">${profile.website_url?`<a href="${esc(profile.website_url)}" target="_blank" rel="noopener"><i class="fa-solid fa-link"></i> Website</a>`:''}${profile.instagram_username?`<a href="https://instagram.com/${encodeURIComponent(profile.instagram_username)}" target="_blank" rel="noopener"><i class="fa-brands fa-instagram"></i> ${esc(profile.instagram_username)}</a>`:''}${profile.discord_username?`<span class="f2w-profile-chip"><i class="fa-brands fa-discord"></i>${esc(profile.discord_username)}</span>`:''}</div>`;
  }

  function openProfileEditor(){
    const profile=viewedProfileObject();if(!isOwnProfile(profile))return;
    let modal=document.getElementById('v35-profile-modal');
    if(!modal){
      modal=document.createElement('div');modal.id='v35-profile-modal';modal.className='f2w-profile-modal';modal.onclick=e=>{if(e.target===modal)modal.hidden=true};document.body.appendChild(modal);
    }
    const genres=Array.isArray(profile.favorite_genres)?profile.favorite_genres.join(', '):'';
    modal.innerHTML=`<div class="f2w-profile-editor"><aside class="f2w-profile-editor-nav"><h3>Edit Profile</h3><button class="f2w-edit-nav active" data-tab="general">General</button><button class="f2w-edit-nav" data-tab="social">Social</button><button class="f2w-edit-nav" data-tab="preferences">Preferences</button><button class="f2w-edit-nav" data-tab="privacy">Privacy</button></aside><div class="f2w-profile-editor-body"><div class="f2w-editor-head"><div><h2 style="margin:0">Profile settings</h2><small style="color:#7186a4">Updates appear without a page refresh.</small></div><button class="f2w-editor-close" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div><section class="f2w-editor-section active" data-section="general"><div class="f2w-editor-grid"><div class="f2w-editor-field"><label>DISPLAY NAME</label><input id="v35-edit-display" maxlength="50" value="${esc(profile.display_name||'')}"></div><div class="f2w-editor-field"><label>LOCATION</label><input id="v35-edit-location" maxlength="80" value="${esc(profile.location||'')}"></div><div class="f2w-editor-field full"><label>BIO</label><textarea id="v35-edit-bio" maxlength="500">${esc(profile.bio||'')}</textarea></div><div class="f2w-editor-field full"><label>AVATAR URL</label><input id="v35-edit-avatar" maxlength="2048" value="${esc(profile.avatar_url||'')}"></div></div></section><section class="f2w-editor-section" data-section="social"><div class="f2w-editor-grid"><div class="f2w-editor-field full"><label>WEBSITE</label><input id="v35-edit-website" maxlength="2048" value="${esc(profile.website_url||'')}"></div><div class="f2w-editor-field"><label>INSTAGRAM</label><input id="v35-edit-instagram" maxlength="80" value="${esc(profile.instagram_username||'')}"></div><div class="f2w-editor-field"><label>DISCORD</label><input id="v35-edit-discord" maxlength="80" value="${esc(profile.discord_username||'')}"></div></div></section><section class="f2w-editor-section" data-section="preferences"><div class="f2w-editor-grid"><div class="f2w-editor-field full"><label>FAVORITE GENRES (comma separated)</label><input id="v35-edit-genres" maxlength="250" value="${esc(genres)}"></div><div class="f2w-editor-field"><label>PROFILE ACCENT</label><select id="v35-edit-accent"><option value="red">Netflix Red</option><option value="purple">Purple</option><option value="blue">Blue</option><option value="green">Green</option><option value="gold">Gold</option></select></div></div></section><section class="f2w-editor-section" data-section="privacy"><div class="f2w-editor-grid"><div class="f2w-editor-field"><label>PROFILE VISIBILITY</label><select id="v35-edit-private"><option value="false">Public</option><option value="true">Private</option></select></div></div><p style="color:#788da9">Private profiles keep favorites and recent title activity private from other users.</p></section><div class="f2w-editor-actions"><button class="f2w-editor-save" type="button" id="v35-profile-save">Save changes</button></div></div></div>`;
    modal.hidden=false;
    modal.querySelector('#v35-edit-private').value=String(Boolean(profile.is_private));
    modal.querySelector('#v35-edit-accent').value=profile.profile_accent||'red';
    modal.querySelector('.f2w-editor-close').onclick=()=>{modal.hidden=true};
    modal.querySelectorAll('.f2w-edit-nav').forEach(btn=>btn.onclick=()=>{
      modal.querySelectorAll('.f2w-edit-nav').forEach(x=>x.classList.toggle('active',x===btn));
      modal.querySelectorAll('.f2w-editor-section').forEach(sec=>sec.classList.toggle('active',sec.dataset.section===btn.dataset.tab));
    });
    modal.querySelector('#v35-profile-save').onclick=saveProfileEditor;
  }

  async function saveProfileEditor(){
    const button=document.getElementById('v35-profile-save');if(button)button.disabled=true;
    try{
      const genres=String(document.getElementById('v35-edit-genres')?.value||'').split(',').map(v=>v.trim()).filter(Boolean).slice(0,12);
      const result=await rpc('update_my_profile_v35',{
        p_display_name:String(document.getElementById('v35-edit-display')?.value||'').trim(),
        p_bio:String(document.getElementById('v35-edit-bio')?.value||'').trim(),
        p_avatar_url:String(document.getElementById('v35-edit-avatar')?.value||'').trim()||null,
        p_is_private:document.getElementById('v35-edit-private')?.value==='true',
        p_location:String(document.getElementById('v35-edit-location')?.value||'').trim()||null,
        p_favorite_genres:genres,
        p_website_url:String(document.getElementById('v35-edit-website')?.value||'').trim()||null,
        p_instagram_username:String(document.getElementById('v35-edit-instagram')?.value||'').trim().replace(/^@/,'')||null,
        p_discord_username:String(document.getElementById('v35-edit-discord')?.value||'').trim()||null,
        p_profile_accent:String(document.getElementById('v35-edit-accent')?.value||'red')
      });
      try{ if(typeof viewedProfile!=='undefined'&&result)Object.assign(viewedProfile,result); }catch{}
      document.getElementById('v35-profile-modal').hidden=true;
      toast('Profile updated');
      try{if(typeof renderProfile==='function')renderProfile()}catch{}
      setTimeout(()=>{installProfileEditor();renderProfileExtras(viewedProfileObject());decorateNames()},100);
    }catch(error){toast(error.message||'Could not update profile.');}
    finally{if(button)button.disabled=false;}
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
    const client=db();if(client){try{client.channel('v35-leader-live').on('postgres_changes',{event:'*',schema:'public',table:'user_presence'},()=>loadLeaderboard(leaderboardPage,leaderboardSort)).on('postgres_changes',{event:'*',schema:'public',table:'profile_title_activity'},()=>loadLeaderboard(leaderboardPage,leaderboardSort)).subscribe()}catch{}}
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
    await syncAuthUI();
    prewarmChat();
    setTimeout(()=>{recordWatchOpen();startWatchTime();renderProfileActivity();installProfileEditor();enrichForum();bootLeaderboard();decorateNames();installStaffQuickModeration()},350);
    roleDecorateTimer=setInterval(()=>{forceRedLogo();decorateNames();installDmSearch();installProfileEditor();renderProfileExtras(viewedProfileObject());installStaffQuickModeration()},2200);
    const client=db();
    try{client?.auth?.onAuthStateChange?.(()=>setTimeout(()=>{syncAuthUI();installProfileEditor();enrichForum()},0))}catch{}
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')touchPresence()});
    const observer=new MutationObserver(()=>{forceRedLogo();addLeaderboardNav();hardenRouting()});
    observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['src','hidden','style']});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
