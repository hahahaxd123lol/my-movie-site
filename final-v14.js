
(() => {
  'use strict';

  const OAUTH_RETURN_KEY='flix2watch_oauth_return_v14';

  function getClient(){
    try{
      if(typeof chatSupabase!=='undefined')return chatSupabase;
      if(typeof db!=='undefined')return db;
      if(window.__flix2watchAccountGuardClient)return window.__flix2watchAccountGuardClient;
    }catch{}
    return null;
  }

  function closeMobileHeader(){
    document.querySelector('body.f2w-main-page > header')?.classList.remove('mobile-open');
    document.body?.classList.remove('f2w-mobile-menu-open');
  }

  const oldToggle=window.toggleF2WMobileMenu;
  window.toggleF2WMobileMenu=function(){
    const header=document.querySelector('body.f2w-main-page > header');
    if(!header){
      if(typeof oldToggle==='function')oldToggle();
      return;
    }
    header.classList.toggle('mobile-open');
    document.body?.classList.toggle(
      'f2w-mobile-menu-open',
      header.classList.contains('mobile-open')
    );
  };

  document.addEventListener('click',event=>{
    const header=document.querySelector('body.f2w-main-page > header');
    if(!header?.classList.contains('mobile-open'))return;

    const tools=header.querySelector('.header-tools');
    const toggle=header.querySelector('.f2w-mobile-nav-toggle');

    if(
      event.target===header ||
      (
        !tools?.contains(event.target) &&
        !toggle?.contains(event.target)
      )
    ){
      closeMobileHeader();
    }
  },true);

  document.addEventListener('keydown',event=>{
    if(event.key==='Escape')closeMobileHeader();
  });

  window.addEventListener('resize',()=>{
    if(window.innerWidth>1366)closeMobileHeader();
  });

  // Close drawer after a normal navigation/action button is used.
  document.addEventListener('click',event=>{
    const target=event.target.closest?.(
      '.f2w-nav-link,.f2w-auth-top-btn,#favorites-nav-btn,#profile-nav-btn,#support-nav-btn,#account-btn,#staff-control-nav'
    );
    if(target)setTimeout(closeMobileHeader,30);
  });

  function cleanUsernameCandidate(value){
    let clean=String(value||'')
      .normalize('NFKD')
      .replace(/[^A-Za-z0-9]/g,'')
      .slice(0,24);

    if(clean.length<2)clean='User';
    if(clean.toLowerCase()==='josh')clean='UserJosh';
    return clean;
  }

  function providerDisplayName(user){
    const m=user?.user_metadata||{};
    return String(
      m.full_name ||
      m.name ||
      m.global_name ||
      m.preferred_username ||
      m.user_name ||
      ''
    ).trim().slice(0,50);
  }

  function providerUsernameBase(user){
    const m=user?.user_metadata||{};
    return cleanUsernameCandidate(
      m.preferred_username ||
      m.user_name ||
      m.username ||
      m.global_name ||
      m.full_name ||
      m.name ||
      String(user?.email||'').split('@')[0] ||
      'User'
    );
  }

  async function ensureOAuthProfile(user){
    const client=getClient();
    if(!client||!user?.id)return null;

    try{
      const {data:existing,error:readError}=await client
        .from('profiles')
        .select('user_id,username,display_name')
        .eq('user_id',user.id)
        .maybeSingle();

      if(readError)throw readError;

      if(existing?.username){
        const meta=user.user_metadata||{};
        if(
          meta.username!==existing.username ||
          meta.chat_alias!==existing.username
        ){
          await client.auth.updateUser({
            data:{
              ...meta,
              username:existing.username,
              chat_alias:existing.username
            }
          });
        }
        return existing;
      }

      const base=providerUsernameBase(user);
      const displayName=providerDisplayName(user);
      const avatar=String(
        user?.user_metadata?.avatar_url ||
        user?.user_metadata?.picture ||
        ''
      ).trim();

      // Preferred V14 path: server-side RPC creates a unique permanent
      // username and profile for a first-time Google/Discord user.
      try{
        const {data:rpcProfile,error:rpcError}=await client.rpc(
          'ensure_my_oauth_profile',
          {
            p_username_base:base,
            p_display_name:displayName||null,
            p_avatar_url:avatar||null
          }
        );

        if(!rpcError&&rpcProfile?.username){
          return rpcProfile;
        }
      }catch{}

      // Backward-compatible fallback if the V14 SQL has not been run yet.
      const uuidSuffix=String(user.id).replace(/[^A-Za-z0-9]/g,'').slice(-5)||'01';

      let lastError=null;

      for(let attempt=0;attempt<20;attempt+=1){
        let candidate=base;

        if(attempt===1){
          candidate=cleanUsernameCandidate(`${base}${uuidSuffix}`);
        }else if(attempt>1){
          const suffix=`${uuidSuffix}${attempt}`;
          candidate=cleanUsernameCandidate(
            `${base.slice(0,Math.max(2,30-suffix.length))}${suffix}`
          );
        }

        const payload={
          user_id:user.id,
          username:candidate,
          display_name:displayName||candidate
        };

        if(avatar)payload.avatar_url=avatar;

        const {data:created,error:createError}=await client
          .from('profiles')
          .insert(payload)
          .select('user_id,username,display_name')
          .single();

        if(!createError&&created){
          await client.auth.updateUser({
            data:{
              ...(user.user_metadata||{}),
              username:created.username,
              chat_alias:created.username
            }
          });
          return created;
        }

        lastError=createError;
      }

      throw lastError||new Error('Could not create your Flix2Watch profile.');
    }catch(error){
      console.warn('OAuth profile bootstrap failed:',error);
      return null;
    }
  }

  window.signInWithOAuthProvider=async function(provider){
    const client=getClient();
    if(!client)return;

    const valid=new Set(['google','discord']);
    if(!valid.has(provider))return;

    const message=document.getElementById('account-message');

    try{
      if(message){
        message.textContent=`Opening ${provider==='google'?'Google':'Discord'}…`;
        message.classList.remove('error');
      }

      sessionStorage.setItem(
        OAUTH_RETURN_KEY,
        `${window.location.pathname}${window.location.search}${window.location.hash}`
      );

      const redirectTo=`${window.location.origin}/home/?oauth=complete`;

      const {error}=await client.auth.signInWithOAuth({
        provider,
        options:{
          redirectTo,
          skipBrowserRedirect:false
        }
      });

      if(error)throw error;
    }catch(error){
      console.error(`${provider} OAuth failed:`,error);
      if(message){
        message.textContent=
          error?.message ||
          `${provider==='google'?'Google':'Discord'} login failed.`;
        message.classList.add('error');
      }
    }
  };

  async function handleOAuthReturn(){
    const client=getClient();
    if(!client)return;

    let user=null;
    try{
      const {data}=await client.auth.getUser();
      user=data?.user||null;
    }catch{}

    if(!user)return;

    const provider=String(
      user?.app_metadata?.provider ||
      user?.app_metadata?.providers?.[0] ||
      ''
    ).toLowerCase();

    if(provider==='google'||provider==='discord'){
      await ensureOAuthProfile(user);
    }

    const params=new URLSearchParams(window.location.search);
    if(params.get('oauth')==='complete'){
      const target=sessionStorage.getItem(OAUTH_RETURN_KEY);
      sessionStorage.removeItem(OAUTH_RETURN_KEY);

      if(
        target &&
        target.startsWith('/') &&
        !target.startsWith('//')
      ){
        window.location.replace(target);
        return;
      }

      history.replaceState(null,'','/home/');
    }
  }

  function installOAuthAuthListener(){
    const client=getClient();
    if(!client)return;

    client.auth.onAuthStateChange(async(event,session)=>{
      if(
        session?.user &&
        (
          event==='SIGNED_IN' ||
          event==='INITIAL_SESSION'
        )
      ){
        const provider=String(
          session.user?.app_metadata?.provider ||
          session.user?.app_metadata?.providers?.[0] ||
          ''
        ).toLowerCase();

        if(provider==='google'||provider==='discord'){
          await ensureOAuthProfile(session.user);
        }
      }
    });
  }

  // Best-effort protection after removing iframe sandbox:
  // this blocks popup creation from Flix2Watch's own parent document.
  // Browser security prevents the parent from fully policing popup JS inside
  // an unsandboxed cross-origin provider iframe.
  if(document.body?.classList.contains('f2w-watch-page')){
    const nativeOpen=window.open?.bind(window);

    window.open=function(url,target,features){
      try{
        const parsed=new URL(String(url||''),window.location.href);

        if(parsed.origin!==window.location.origin){
          console.warn('Blocked parent-page external popup:',parsed.href);
          return null;
        }
      }catch{
        return null;
      }

      return nativeOpen?nativeOpen(url,target,features):null;
    };

    let iframeInteractionUntil=0;

    window.addEventListener('blur',()=>{
      const frame=document.getElementById('video-frame');
      if(frame&&document.activeElement===frame){
        iframeInteractionUntil=Date.now()+1800;
        setTimeout(()=>window.focus(),0);
      }
    });

    window.addEventListener('beforeunload',event=>{
      if(Date.now()<iframeInteractionUntil){
        event.preventDefault();
        event.returnValue='';
      }
    });
  }

  function boot(){
    installOAuthAuthListener();
    handleOAuthReturn();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  }else{
    boot();
  }
})();
