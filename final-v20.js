
(() => {
  'use strict';

  const SUPABASE_URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
  const SUPABASE_KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';

  let searchTimer=null;
  let searchRequest=0;
  let fallbackClient=null;

  function getPublicClient(){
    try{
      if(typeof chatSupabase!=='undefined'&&chatSupabase)return chatSupabase;
    }catch{}

    try{
      if(typeof db!=='undefined'&&db)return db;
    }catch{}

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

  function initials(username='?'){
    return String(username||'?').trim().slice(0,2).toUpperCase();
  }

  function userSearchValue(field){
    return String(field?.value||'')
      .replace(/[^A-Za-z0-9]/g,'')
      .slice(0,30);
  }

  function closeUserSearchPreview(){
    const host=document.getElementById('user-search-results');
    if(!host)return;
    host.classList.remove('show');
    host.innerHTML='';
  }

  async function searchUsers(query){
    const client=getPublicClient();
    const host=document.getElementById('user-search-results');

    if(!host)return;

    const clean=String(query||'')
      .replace(/[^A-Za-z0-9]/g,'')
      .slice(0,30);

    const requestId=++searchRequest;

    if(!clean){
      closeUserSearchPreview();
      return;
    }

    host.classList.add('show');
    host.innerHTML='<div class="user-search-empty">Searching users…</div>';

    if(!client){
      host.innerHTML='<div class="user-search-empty">User search unavailable.</div>';
      return;
    }

    try{
      const {data,error}=await client
        .from('profiles')
        .select('username,display_name,avatar_url')
        .ilike('username',`${clean}%`)
        .order('username',{ascending:true})
        .limit(8);

      if(requestId!==searchRequest)return;
      if(error)throw error;

      const rows=Array.isArray(data)?data:[];

      if(!rows.length){
        host.innerHTML='<div class="user-search-empty">No users found.</div>';
        return;
      }

      host.innerHTML=rows.map(profile=>{
        const username=esc(profile.username||'');
        const display=esc(profile.display_name||profile.username||'User');
        const avatar=profile.avatar_url
          ? `<img class="user-search-avatar" src="${esc(profile.avatar_url)}" alt="">`
          : `<span class="user-search-avatar">${esc(initials(profile.username))}</span>`;

        return `
          <button class="user-search-result" type="button" data-username="${username}">
            ${avatar}
            <span class="user-search-copy">
              <span class="user-search-name">${display} · @${username}</span>
              <span class="user-search-sub">View public profile</span>
            </span>
          </button>`;
      }).join('');

      host.querySelectorAll('.user-search-result').forEach(button=>{
        button.addEventListener('click',()=>{
          const username=button.dataset.username||'';
          if(username){
            window.location.href=`/profile/?user=${encodeURIComponent(username)}`;
          }
        });
      });
    }catch(error){
      console.warn('Flix2Watch user search:',error);

      if(requestId===searchRequest){
        host.innerHTML='<div class="user-search-empty">User search unavailable.</div>';
      }
    }
  }

  /* Use one search implementation everywhere so Support behaves like Home. */
  window.handleUserSearchInput=function(field){
    if(!field)return;

    const clean=userSearchValue(field);
    if(field.value!==clean)field.value=clean;

    clearTimeout(searchTimer);

    if(!clean){
      closeUserSearchPreview();
      return;
    }

    searchTimer=setTimeout(()=>searchUsers(clean),120);
  };

  window.submitUserDirectorySearch=function(){
    const input=document.getElementById('user-search');
    const clean=userSearchValue(input);

    if(!clean)return;

    window.location.href=`/users/?q=${encodeURIComponent(clean)}&page=1`;
  };

  window.protectUserSearchField=function(field){
    if(!field)return;

    field.removeAttribute('readonly');
    field.type='search';
    field.inputMode='search';
    field.autocomplete='one-time-code';
    field.setAttribute('aria-autocomplete','none');
    field.setAttribute('data-form-type','search');
    field.setAttribute('data-lpignore','true');
    field.setAttribute('data-1p-ignore','true');
    field.setAttribute('data-bwignore','true');
    field.setAttribute('data-protonpass-ignore','true');
    field.setAttribute('data-keeper-ignore','true');

    // Rotate the field name away from anything password managers may have
    // previously learned as a username credential.
    if(!field.dataset.v20SearchName){
      field.dataset.v20SearchName='1';
      field.name=`people_lookup_${Date.now().toString(36)}`;
    }
  };

  function hardenUserSearch(){
    const field=document.getElementById('user-search');
    if(!field)return;

    field.type='search';
    field.autocomplete='one-time-code';
    field.inputMode='search';
    field.setAttribute('enterkeyhint','search');
    field.setAttribute('aria-autocomplete','none');
    field.setAttribute('data-form-type','search');
    field.setAttribute('data-lpignore','true');
    field.setAttribute('data-1p-ignore','true');
    field.setAttribute('data-bwignore','true');
    field.setAttribute('data-protonpass-ignore','true');
    field.setAttribute('data-keeper-ignore','true');
    field.setAttribute('readonly','');

    if(field.dataset.v20Guard==='1')return;
    field.dataset.v20Guard='1';

    const unlock=()=>window.protectUserSearchField(field);

    field.addEventListener('pointerdown',unlock,{capture:true});
    field.addEventListener('touchstart',unlock,{capture:true,passive:true});
    field.addEventListener('focus',unlock,{capture:true});

    field.addEventListener('keydown',event=>{
      if(event.key==='Enter'&&!event.isComposing){
        event.preventDefault();
        window.submitUserDirectorySearch();
      }
    });

    field.addEventListener('blur',()=>{
      setTimeout(()=>{
        if(document.activeElement!==field){
          field.setAttribute('readonly','');
          field.autocomplete='one-time-code';
        }
      },100);
    });
  }

  /* ---------- Watch sources/auth ---------- */
  function setWatchPrivateControls(authenticated){
    if(!document.body?.classList.contains('f2w-watch-page'))return;

    const stream=document.getElementById('stream-toolbar');
    const tv=document.getElementById('tv-controls');

    for(const node of [stream,tv]){
      if(!node)continue;
      node.hidden=!authenticated;
      node.setAttribute('aria-hidden',authenticated?'false':'true');
    }
  }

  function resetUnknownBlockState(){
    if(!document.body?.classList.contains('f2w-watch-page'))return;

    document.body.classList.remove('f2w-content-block-confirmed');

    const overlay=document.getElementById('content-block-overlay');
    if(overlay){
      overlay.hidden=true;
      overlay.classList.remove('show');
      overlay.setAttribute('aria-hidden','true');
    }
  }

  async function syncWatchState(){
    if(!document.body?.classList.contains('f2w-watch-page'))return;

    const client=getPublicClient();
    let authenticated=false;

    try{
      if(client){
        const {data}=await client.auth.getSession();
        authenticated=Boolean(data?.session?.user);
      }
    }catch{}

    setWatchPrivateControls(authenticated);

    try{
      client?.auth?.onAuthStateChange?.((_event,session)=>{
        setWatchPrivateControls(Boolean(session?.user));
      });
    }catch{}
  }

  function boot(){
    hardenUserSearch();
    resetUnknownBlockState();
    syncWatchState();

    document.addEventListener('click',event=>{
      if(!event.target.closest('.user-search-container')){
        closeUserSearchPreview();
      }
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  }else{
    boot();
  }
})();
