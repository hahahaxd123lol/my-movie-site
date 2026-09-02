(() => {
  'use strict';
  if (window.__f2wV145Fixes) return;
  window.__f2wV145Fixes = true;
  const sleep = ms => new Promise(r=>setTimeout(r,ms));
  const db = () => window.chatSupabase || window.supabaseClient || window.__supabaseClient || null;
  const getClient = () => {
    const existing=db(); if(existing?.auth)return existing;
    try{return window.supabase?.createClient?.('https://viqufxlcxwgboyxbdhjb.supabase.co','sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})}catch{return null}
  };

  function openAccountStable(){
    const m=document.getElementById('account-modal'); if(!m)return false;
    m.hidden=false; m.removeAttribute('inert'); m.classList.add('open','f2w-auth-v67','f2w-auth-modal-open-v60');
    m.style.setProperty('display','flex','important'); m.setAttribute('aria-hidden','false');
    document.documentElement.classList.add('f2w-auth-v67-open'); document.body.classList.add('f2w-auth-v67-open');
    return false;
  }
  function installAccountFix(){
    window.openAccountModal=openAccountStable;
    const m=document.getElementById('account-modal'); if(!m)return;
    m.addEventListener('pointerdown',e=>{if(e.target.closest('.account-card'))e.stopPropagation();},true);
    m.addEventListener('click',e=>{if(e.target.closest('.account-card'))e.stopPropagation();},true);
  }

  let availabilityTimer=0;
  async function checkUsername(input){
    const value=String(input.value||'').trim();
    let status=document.getElementById('account-username-availability-v145');
    if(!status){status=document.createElement('div');status.id='account-username-availability-v145';status.className='account-message';input.insertAdjacentElement('afterend',status);}
    if(!/^[A-Za-z0-9]{2,30}$/.test(value)){status.textContent=value?'Use 2–30 letters or numbers.':'';status.dataset.state='bad';return;}
    status.textContent='Checking availability…'; status.dataset.state='checking';
    const c=getClient(); if(!c?.rpc){status.textContent='Could not check right now.';return;}
    const {data,error}=await c.rpc('is_username_available_v145',{p_username:value});
    if(String(input.value||'').trim()!==value)return;
    if(error){status.textContent='Could not check right now.';status.dataset.state='bad';return;}
    status.textContent=data?'Username is available.':'Username is already taken.';status.dataset.state=data?'good':'bad';
  }
  function installUsernameCheck(){
    const input=document.getElementById('account-change-username'); if(!input)return;
    const run=()=>{clearTimeout(availabilityTimer);availabilityTimer=setTimeout(()=>checkUsername(input),180)};
    input.addEventListener('input',run); input.addEventListener('focus',run); input.addEventListener('click',run);
    window.changeFlix2WatchUsername=async function(){
      const next=String(input.value||'').trim(); if(!/^[A-Za-z0-9]{2,30}$/.test(next)){await checkUsername(input);return false;}
      const c=getClient(); if(!c?.rpc)return false;
      const old=(document.getElementById('account-user-username')?.textContent||'').replace(/^@/,'').trim();
      const {data,error}=await c.rpc('change_my_username_v145',{p_username:next});
      let status=document.getElementById('account-username-availability-v145');
      if(error){if(status){status.textContent=error.message||'Could not change username.';status.dataset.state='bad';}return false;}
      try{await c.auth.updateUser({data:{username:data||next,chat_alias:data||next}})}catch{}
      try{
        if(old){localStorage.removeItem(`f2w_profile_cache_v24:${old.toLowerCase()}`);}
        localStorage.setItem('f2w_profile_username_v24',data||next);
        new BroadcastChannel('f2w-profile-v145').postMessage({type:'username-changed',old,new:data||next});
      }catch{}
      if(status){status.textContent='Username updated.';status.dataset.state='good';}
      document.getElementById('account-user-username').textContent='@'+(data||next);
      return false;
    };
  }

  function forumVisualFix(){
    if(!false)return;
    document.documentElement.classList.add('f2w-forum-v145');
  }

  function disablePublicChatImages(){
    if(!location.pathname.startsWith('/chat'))return;
    ['chat-media-btn','chat-media-input','chat-attachment-preview'].forEach(id=>{const el=document.getElementById(id);if(el){el.hidden=true;el.style.display='none';}});
    window.selectChatAttachment=()=>false;
  }

  function boot(){installAccountFix();installUsernameCheck();forumVisualFix();disablePublicChatImages();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0),{once:true}); else setTimeout(boot,0);
  window.addEventListener('pageshow',()=>setTimeout(boot,0),{passive:true});
})();
