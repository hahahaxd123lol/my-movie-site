(()=>{
  'use strict';

  const PROJECT_REF='viqufxlcxwgboyxbdhjb';
  const SUPABASE_URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
  const SUPABASE_KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
  let fallbackClient=null;
  let signingOut=false;

  function getClient(){
    const candidates=[
      window.chatSupabase,
      window.supabaseClient,
      window.__supabaseClient,
      window.f2wSupabase,
      window.__f2wPersistentClientV93
    ];
    for(const c of candidates){
      try{ if(c?.auth?.signOut) return c; }catch{}
    }
    try{
      if(!fallbackClient && window.supabase?.createClient){
        fallbackClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
          auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
        });
      }
    }catch{}
    return fallbackClient;
  }

  function authStorageKeys(storage){
    const out=[];
    if(!storage) return out;
    try{
      for(let i=0;i<storage.length;i++){
        const k=storage.key(i);
        if(!k) continue;
        if(
          k===`sb-${PROJECT_REF}-auth-token` ||
          (/^sb-.*-auth-token$/i.test(k) && k.includes(PROJECT_REF))
        ) out.push(k);
      }
    }catch{}
    return out;
  }

  function clearLocalAuthState(){
    try{ authStorageKeys(localStorage).forEach(k=>localStorage.removeItem(k)); }catch{}
    try{ authStorageKeys(sessionStorage).forEach(k=>sessionStorage.removeItem(k)); }catch{}
    try{ localStorage.removeItem('josh_chat_token'); }catch{}
    try{ localStorage.removeItem('f2w_chat_token'); }catch{}
    try{ sessionStorage.removeItem('josh_chat_token'); }catch{}
    try{ sessionStorage.removeItem('f2w_chat_token'); }catch{}
  }

  function markLoggedOut(){
    try{ localStorage.setItem('f2w-force-logout-at',String(Date.now())); }catch{}
  }

  function setBusy(busy){
    document.querySelectorAll('[data-f2w-logout], .account-secondary').forEach(btn=>{
      const text=(btn.textContent||'').trim().toLowerCase();
      if(btn.hasAttribute('data-f2w-logout') || /^(log out|logout|sign out)$/.test(text)){
        btn.disabled=busy;
        if(busy){
          btn.dataset.f2wLogoutOriginal=btn.innerHTML;
          btn.innerHTML='<i class="fa-solid fa-arrow-right-from-bracket"></i> Logging out…';
        }else if(btn.dataset.f2wLogoutOriginal){
          btn.innerHTML=btn.dataset.f2wLogoutOriginal;
          delete btn.dataset.f2wLogoutOriginal;
        }
      }
    });
  }

  async function forceLogout(){
    if(signingOut) return false;
    signingOut=true;
    setBusy(true);

    const client=getClient();
    try{
      // Use the authenticated client first so Supabase revokes/clears the current browser session
      // and broadcasts the auth-state change normally.
      if(client?.auth?.signOut){
        const result=await Promise.race([
          client.auth.signOut({scope:'local'}),
          new Promise(resolve=>setTimeout(()=>resolve({error:new Error('logout timeout')}),4500))
        ]);
        if(result?.error) console.warn('[F2W v147] Supabase signOut fallback:',result.error.message||result.error);
      }
    }catch(err){
      console.warn('[F2W v147] Supabase signOut failed, clearing local session:',err);
    }

    // Logout must still work if a page has a stale/duplicated Supabase client or the network is down.
    clearLocalAuthState();
    markLoggedOut();

    try{
      document.querySelectorAll('#account-modal,.account-modal').forEach(m=>{
        m.classList.remove('open');
        m.setAttribute('aria-hidden','true');
      });
      document.documentElement.classList.remove('f2w-auth-v67-open');
      document.body?.classList.remove('f2w-auth-v67-open','f2w-authenticated');
    }catch{}

    // replace() prevents Back from resurrecting a protected page with stale account UI.
    location.replace('/home/');
    return false;
  }

  // Make this the canonical site-wide function. This file is loaded last, after old inline page code.
  window.signOutAccount=forceLogout;
  window.logoutAccount=forceLogout;
  window.f2wLogout=forceLogout;

  function normalizeAccountButton(){
    const btn=document.getElementById('account-btn');
    if(!btn) return;
    const current=(btn.textContent||'').trim();
    if(current!=='Account' || !btn.querySelector('.fa-user')){
      btn.innerHTML='<i class="fa-regular fa-user"></i> Account';
    }
    btn.setAttribute('aria-label','Account');
    btn.title='Account';
  }

  function markLogoutButtons(root=document){
    root.querySelectorAll?.('.account-secondary,button,a').forEach(el=>{
      const text=(el.textContent||'').trim().toLowerCase();
      const onclick=(el.getAttribute?.('onclick')||'');
      if(/^(log out|logout|sign out)$/.test(text) || /signOutAccount\s*\(/i.test(onclick)){
        el.setAttribute('data-f2w-logout','1');
        el.setAttribute('type','button');
      }
    });
  }

  function enforceUi(){
    normalizeAccountButton();
    markLogoutButtons();
  }

  // Capture phase beats stale inline onclick handlers such as page-local chatSupabase signOut functions.
  document.addEventListener('click',e=>{
    const el=e.target?.closest?.('[data-f2w-logout],button,a');
    if(!el) return;
    const text=(el.textContent||'').trim().toLowerCase();
    const onclick=(el.getAttribute?.('onclick')||'');
    if(el.hasAttribute('data-f2w-logout') || /^(log out|logout|sign out)$/.test(text) || /signOutAccount\s*\(/i.test(onclick)){
      e.preventDefault();
      e.stopImmediatePropagation();
      forceLogout();
    }
  },true);

  // Keep every tab in the same browser in sync when one tab logs out.
  window.addEventListener('storage',e=>{
    if(e.key==='f2w-force-logout-at' && e.newValue){
      clearLocalAuthState();
      if(location.pathname!=='/home/' && location.pathname!=='/home') location.replace('/home/');
      else location.reload();
    }
  });

  function boot(){
    enforceUi();
    const mo=new MutationObserver(enforceUi);
    mo.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
