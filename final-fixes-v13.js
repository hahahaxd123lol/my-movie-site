
(() => {
  'use strict';

  const THEMES=new Set([
    'theme-red','theme-blue','theme-green',
    'theme-purple','theme-amber','theme-matrix','theme-cyan','theme-pink','theme-orange','theme-ice','theme-gold','theme-midnight'
  ]);

  function currentSavedTheme(){
    const saved=
      localStorage.getItem('flix2watch_theme')
      || localStorage.getItem('josh_site_theme')
      || document.documentElement.dataset.flix2watchTheme
      || 'theme-red';
    return THEMES.has(saved)?saved:'theme-red';
  }

  function applyTheme(theme,save=false){
    const value=THEMES.has(theme)?theme:'theme-red';

    document.documentElement.dataset.flix2watchTheme=value;

    if(document.body){
      for(const item of THEMES)document.body.classList.remove(item);
      document.body.classList.add(value);
    }

    if(save){
      localStorage.setItem('flix2watch_theme',value);
      localStorage.setItem('josh_site_theme',value);
    }

    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta){
      const map={
        'theme-red':'#e50914',
        'theme-blue':'#3b82f6',
        'theme-green':'#10b981',
        'theme-purple':'#8b5cf6',
        'theme-amber':'#f59e0b',
        'theme-matrix':'#00ff66'
      };
      meta.setAttribute('content',map[value]||'#e50914');
    }
  }

  window.setTheme=function(_name,themeClass){
    applyTheme(themeClass,true);
    document.querySelectorAll('.dropdown-menu').forEach(menu=>menu.classList.remove('show'));
  };

  window.toggleDropdown=function(id){
    const menu=document.getElementById(id);
    if(!menu)return;

    document.querySelectorAll('.dropdown-menu').forEach(other=>{
      if(other!==menu)other.classList.remove('show');
    });

    menu.classList.toggle('show');
  };

  window.submitUserDirectorySearch=function(value){
    const input=document.getElementById('user-search');
    const clean=String(value??input?.value??'')
      .trim()
      .replace(/[^A-Za-z0-9]/g,'');

    if(!clean){
      input?.focus();
      return;
    }

    window.location.href=`/users/?q=${encodeURIComponent(clean)}&page=1`;
  };

  function syncHeaderForSession(session){
    const loggedIn=Boolean(session?.user);

    document.body?.classList.toggle('f2w-authenticated',loggedIn);

    const login=document.getElementById('header-login-btn');
    const signup=document.getElementById('header-signup-btn');
    const favorites=document.getElementById('favorites-nav-btn');
    const profile=document.getElementById('profile-nav-btn');
    const support=document.getElementById('support-nav-btn');
    const account=document.getElementById('account-btn');

    if(login)login.style.display=loggedIn?'none':'inline-flex';
    if(signup)signup.style.display=loggedIn?'none':'inline-flex';

    if(favorites)favorites.style.display=loggedIn?'inline-flex':'none';
    if(profile)profile.style.display=loggedIn?'inline-flex':'none';
    if(support)support.style.display=loggedIn?'inline-flex':'none';
    if(account)account.style.display=loggedIn?'inline-flex':'none';
  }

  async function installAuthSync(){
    let client=null;
    try{
      if(typeof chatSupabase!=='undefined')client=chatSupabase;
      else if(typeof db!=='undefined')client=db;
      else if(window.__flix2watchAccountGuardClient)client=window.__flix2watchAccountGuardClient;
    }catch{}

    if(!client)return;

    try{
      const {data}=await client.auth.getSession();
      syncHeaderForSession(data?.session||null);
    }catch(error){
      console.warn('Header auth-state lookup failed:',error);
    }

    if(!window.__f2wV13AuthListenerInstalled){
      window.__f2wV13AuthListenerInstalled=true;
      client.auth.onAuthStateChange((_event,session)=>{
        syncHeaderForSession(session||null);
      });
    }
  }

  // Fallbacks used by the dedicated /users/ directory page.
  if(typeof window.openChat!=='function'){
    window.openChat=()=>{window.location.href='/home/?open=chat'};
  }

  const oldOpenHeaderAuth=window.openHeaderAuth;
  window.openHeaderAuth=function(mode='login'){
    if(typeof window.showAccountMode==='function'&&typeof window.openAccountModal==='function'){
      window.showAccountMode(mode);
      window.openAccountModal();
      return;
    }

    window.location.href=`/home/?account=${encodeURIComponent(mode)}`;
  };

  if(typeof window.openAccountModal!=='function'){
    window.openAccountModal=()=>{window.location.href='/home/?account=login'};
  }

  if(typeof window.toggleUltraDiscover!=='function'){
    window.toggleUltraDiscover=function(event){
      event?.stopPropagation?.();
      document.getElementById('f2w-discover-menu')?.classList.toggle('show');
    };
  }

  if(typeof window.installFlix2Watch!=='function'){
    window.installFlix2Watch=()=>{};
  }

  async function fallbackMyProfile(){
    let client=null;
    try{
      if(typeof chatSupabase!=='undefined')client=chatSupabase;
      else if(typeof db!=='undefined')client=db;
      else if(window.__flix2watchAccountGuardClient)client=window.__flix2watchAccountGuardClient;
    }catch{}
    if(!client)return;

    const {data:userData}=await client.auth.getUser();
    const user=userData?.user;
    if(!user){
      window.openHeaderAuth('login');
      return;
    }

    const {data}=await client
      .from('profiles')
      .select('username')
      .eq('user_id',user.id)
      .maybeSingle();

    if(data?.username){
      window.location.href=`/profile/?user=${encodeURIComponent(data.username)}`;
    }
  }

  if(typeof window.openMyProfile!=='function'){
    window.openMyProfile=fallbackMyProfile;
  }

  // Make the user-search field strict ASCII and keep live suggestions if the
  // existing page has its original search function.
  if(typeof window.protectUserSearchField!=='function'){
    window.protectUserSearchField=function(input){
      if(!input)return;
      const clean=String(input.value||'').replace(/[^A-Za-z0-9]/g,'');
      if(input.value!==clean)input.value=clean;
    };
  }

  if(typeof window.handleUserSearchInput!=='function'){
    let timer=null;
    window.handleUserSearchInput=function(input){
      window.protectUserSearchField(input);
      clearTimeout(timer);
      timer=setTimeout(()=>{
        if(typeof window.loadDirectoryResults==='function'){
          // On /users/, typing updates only after explicit Enter/Search.
          return;
        }
      },120);
    };
  }

  function installUserSearchEnter(){
    const input=document.getElementById('user-search');
    if(!input||input.dataset.v13DirectoryEnter==='1')return;
    input.dataset.v13DirectoryEnter='1';
    input.enterKeyHint='search';

    input.addEventListener('keydown',event=>{
      if(
        event.key==='Enter' &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.isComposing
      ){
        event.preventDefault();
        event.stopImmediatePropagation();
        window.submitUserDirectorySearch(input.value);
      }
    },true);
  }

  async function syncStaffButton(){
    const button=document.getElementById('staff-control-nav');
    if(!button)return;

    button.hidden=true;
    button.style.setProperty('display','none','important');
    button.onclick=null;

    let client=null;
    try{
      if(typeof chatSupabase!=='undefined')client=chatSupabase;
      else if(typeof db!=='undefined')client=db;
      else if(window.__flix2watchAccountGuardClient)client=window.__flix2watchAccountGuardClient;
    }catch{}
    if(!client)return;

    try{
      const {data:userData}=await client.auth.getUser();
      if(!userData?.user)return;

      const {data,error}=await client.rpc('get_staff_context');
      if(error)throw error;

      if(['owner','staff'].includes(data?.role)){
        button.hidden=false;
        button.style.removeProperty('display');
        button.removeAttribute('aria-disabled');
        button.removeAttribute('tabindex');
        button.onclick=()=>{window.location.href='/staff/'};
      }
    }catch{}
  }

  function boot(){
    applyTheme(currentSavedTheme(),false);
    installUserSearchEnter();
    installAuthSync();
    setTimeout(syncStaffButton,120);
  }

  window.addEventListener('storage',event=>{
    if(event.key==='flix2watch_theme'||event.key==='josh_site_theme'){
      applyTheme(currentSavedTheme(),false);
    }
  });

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  }else{
    boot();
  }
})();
