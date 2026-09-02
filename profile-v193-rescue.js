(() => {
  'use strict';
  if (!location.pathname.startsWith('/profile/')) return;

  const SUPABASE_URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
  const SUPABASE_KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
  let rescueRun=0;

  function usernameFromPath(){
    const match=location.pathname.match(/^\/profile\/@([^/]+)\/?$/i);
    return match ? decodeURIComponent(match[1]).replace(/[^A-Za-z0-9]/g,'') : '';
  }

  function client(){
    try {
      if (window.f2wSupabase) return window.f2wSupabase;
      if (window.supabase?.createClient) {
        window.f2wSupabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
          auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
        });
        return window.f2wSupabase;
      }
    } catch {}
    return null;
  }

  async function withTimeout(promise, ms=7000){
    let timer;
    try{
      return await Promise.race([
        promise,
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),ms)})
      ]);
    }finally{ clearTimeout(timer); }
  }

  async function rpcRaw(name,args){
    const response=await withTimeout(fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`,{
      method:'POST',
      headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify(args||{}),
      cache:'no-store'
    }),7000);
    if(!response.ok) throw new Error(`${name} ${response.status}`);
    return response.json();
  }

  async function fetchProfile(username){
    const c=client();
    const attempts=[];
    if(c){
      attempts.push(async()=>{
        const r=await withTimeout(c.rpc('get_public_profile_v191',{p_username:username}),7000);
        if(r?.error) throw r.error;
        return r?.data||null;
      });
      attempts.push(async()=>{
        const r=await withTimeout(c.rpc('get_public_profile_v160',{p_username:username}),7000);
        if(r?.error) throw r.error;
        return r?.data||null;
      });
      attempts.push(async()=>{
        const r=await withTimeout(c.from('profiles').select('*').ilike('username',username).maybeSingle(),7000);
        if(r?.error) throw r.error;
        return r?.data||null;
      });
    }
    attempts.push(()=>rpcRaw('get_public_profile_v191',{p_username:username}));
    attempts.push(()=>rpcRaw('get_public_profile_v160',{p_username:username}));

    let lastError=null;
    for(const attempt of attempts){
      try{
        const value=await attempt();
        if(value) return value;
      }catch(error){ lastError=error; }
    }
    throw lastError||new Error('Profile not found');
  }

  function normalizeProfile(p){
    return {
      ...p,
      display_name:p?.display_name??null,
      bio:p?.bio??'',
      avatar_url:p?.avatar_url??null,
      is_private:Boolean(p?.is_private),
      favorite_genres:Array.isArray(p?.favorite_genres)?p.favorite_genres:[],
      website_url:p?.website_url??'',
      instagram_username:p?.instagram_username??'',
      discord_username:p?.discord_username??'',
      snapchat_username:p?.snapchat_username??'',
      steam_profile:p?.steam_profile??'',
      tiktok_username:p?.tiktok_username??'',
      location:p?.location??'',
      status_text:p?.status_text??'',
      pronouns:p?.pronouns??'',
      favorite_movie_text:p?.favorite_movie_text??'',
      favorite_movie_tmdb_id:p?.favorite_movie_tmdb_id??null,
      favorite_movie_poster_path:p?.favorite_movie_poster_path??'',
      profile_quote:p?.profile_quote??''
    };
  }

  function paintMinimum(profile){
    const name=document.getElementById('profile-name');
    const username=document.getElementById('profile-username-line');
    const bio=document.getElementById('profile-bio');
    const joined=document.getElementById('profile-joined');
    const img=document.getElementById('profile-avatar');
    const fallback=document.getElementById('profile-avatar-fallback');
    const display=String(profile.display_name||'').trim();
    const handle=String(profile.username||'').trim();
    if(name) name.textContent=display||handle||'Profile';
    if(username) username.textContent=handle?`@${handle}`:'';
    if(bio){ bio.textContent=String(profile.bio||'').trim()||'No bio yet.'; bio.classList.toggle('empty',!String(profile.bio||'').trim()); }
    if(joined){
      const d=profile.created_at?new Date(profile.created_at):null;
      joined.textContent=d&&Number.isFinite(d.getTime())?`Joined ${d.toLocaleDateString(undefined,{month:'short',year:'numeric'})}`:'Flix2Watch member';
    }
    if(profile.avatar_url&&img&&fallback){ img.src=profile.avatar_url; img.style.display='block'; fallback.style.display='none'; }
    else if(fallback){ fallback.textContent=(handle||'?').slice(0,2).toUpperCase(); fallback.style.display='grid'; if(img)img.style.display='none'; }
  }

  async function syncOwner(profile){
    const c=client();
    let user=null;
    try{ user=(await withTimeout(c?.auth?.getSession?.(),5000))?.data?.session?.user||null; }catch{}
    try{ if(user) currentUser=user; }catch{}
    const own=Boolean(user&&profile?.user_id&&String(user.id)===String(profile.user_id));
    document.body.classList.toggle('profile-authenticated-owner',own);
    const edit=document.getElementById('v35-edit-profile');
    if(edit){
      edit.hidden=!own;
      edit.style.setProperty('display',own?'inline-flex':'none',own?'important':'');
      if(own){
        edit.onclick=(event)=>{
          event.preventDefault();
          event.stopPropagation();
          if(typeof window.f2wOpenProfileEditorV182==='function') window.f2wOpenProfileEditorV182();
        };
      }
    }
    if(own){
      try{ await window.f2wInstallProfileEditorV191?.(); }catch{}
      if(edit){edit.hidden=false;edit.style.setProperty('display','inline-flex','important');}
    }
  }

  async function rescue(force=false){
    const run=++rescueRun;
    const username=usernameFromPath();
    if(!username)return;
    const name=document.getElementById('profile-name');
    const bio=document.getElementById('profile-bio');
    const stillLoading=/^Loading/i.test(name?.textContent||'') || /Loading profile/i.test(bio?.textContent||'');
    if(!force&&!stillLoading){
      try{ await window.f2wInstallProfileEditorV191?.(); }catch{}
      return;
    }
    try{
      const profile=normalizeProfile(await fetchProfile(username));
      if(run!==rescueRun)return;
      try{ viewedProfile=profile; }catch{}
      try{ f2wProfileResolvedUsername=String(profile.username||username).toLowerCase(); }catch{}
      try{ f2wProfilePendingUsername=''; }catch{}
      try{ localStorage.setItem('f2w_profile_username_v24',profile.username||username); }catch{}

      let rendered=false;
      try{
        if(typeof renderViewedProfile==='function'){
          renderViewedProfile();
          rendered=true;
        }
      }catch(error){ console.warn('[v193] legacy profile renderer failed; using rescue paint',error); }
      if(!rendered) paintMinimum(profile);

      try{ window.dispatchEvent(new CustomEvent('f2w:profile-ready',{detail:{profile,rescued:true}})); }catch{}
      try{ window.renderProfilePresence?.(); }catch{}
      try{ window.f2wRenderProfileActivityV182?.(); }catch{}
      try{ await syncOwner(profile); }catch{}
      setTimeout(()=>syncOwner(profile),250);
      setTimeout(()=>syncOwner(profile),900);
    }catch(error){
      if(run!==rescueRun)return;
      console.error('[v193] profile rescue failed',error);
      if(name&&/^Loading/i.test(name.textContent||'')) name.textContent='Profile unavailable';
      if(bio&&/Loading profile/i.test(bio.textContent||'')){
        bio.textContent='This profile could not be loaded right now.';
        bio.classList.add('empty');
      }
      const presence=document.querySelector('#v17-profile-presence span:last-child');
      if(presence&&/Checking status/i.test(presence.textContent||'')) presence.textContent='Status unavailable';
    }
  }

  function start(){
    setTimeout(()=>rescue(false),350);
    setTimeout(()=>rescue(false),1200);
    setTimeout(()=>rescue(false),3000);
    window.addEventListener('pageshow',()=>setTimeout(()=>rescue(false),120),{passive:true});
    window.addEventListener('focus',()=>rescue(false),{passive:true});
    try{
      client()?.auth?.onAuthStateChange?.(()=>setTimeout(()=>rescue(false),80));
    }catch{}
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
// f2w-force-save:v193-profile-rescue:20260902
