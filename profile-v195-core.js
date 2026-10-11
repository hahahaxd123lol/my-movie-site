(() => {
  'use strict';
  if (!location.pathname.startsWith('/profile/')) return;

  const URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
  const KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
  let runId=0;

  const $=id=>document.getElementById(id);
  const cleanUser=v=>String(v||'').replace(/^@/,'').replace(/[^A-Za-z0-9]/g,'').slice(0,20);

  function username(){
    const path=location.pathname.match(/^\/profile\/@([A-Za-z0-9]+)\/?$/i);
    if(path) return cleanUser(decodeURIComponent(path[1]));
    return cleanUser(new URLSearchParams(location.search).get('user'));
  }

  function db(){
    try{ if(window.f2wSupabase) return window.f2wSupabase; }catch{}
    try{ if(typeof chatSupabase!=='undefined' && chatSupabase) return chatSupabase; }catch{}
    try{
      if(window.supabase?.createClient){
        window.f2wSupabase=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
        return window.f2wSupabase;
      }
    }catch{}
    return null;
  }

  async function timeout(p,ms=8000){
    let t;
    try{
      return await Promise.race([p,new Promise((_,rej)=>{t=setTimeout(()=>rej(new Error('Profile request timed out')),ms)})]);
    }finally{clearTimeout(t)}
  }

  async function getProfile(name){
    const c=db();
    if(c?.rpc){
      const {data,error}=await timeout(c.rpc('get_public_profile_v195',{p_username:name}),8000);
      if(error) throw error;
      return Array.isArray(data)?data[0]||null:data||null;
    }
    const r=await timeout(fetch(`${URL}/rest/v1/rpc/get_public_profile_v195`,{
      method:'POST',cache:'no-store',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({p_username:name})
    }),8000);
    if(!r.ok) throw new Error(`Profile request failed (${r.status})`);
    const data=await r.json();
    return Array.isArray(data)?data[0]||null:data||null;
  }

  function memberAge(created){
    const t=new Date(created).getTime();
    if(!Number.isFinite(t)) return '—';
    const d=Math.max(0,Date.now()-t);
    const units=[['year',31557600000],['month',2629800000],['week',604800000],['day',86400000],['hour',3600000],['minute',60000]];
    for(const [u,ms] of units){
      if(d>=ms){const n=Math.max(1,Math.floor(d/ms));return `${n} ${u}${n===1?'':'s'}`;}
    }
    return '1 minute';
  }

  function normalize(p){
    return {
      ...p,
      username:cleanUser(p?.username),
      display_name:p?.display_name??null,
      bio:p?.bio??'',
      avatar_url:p?.avatar_url??null,
      is_private:Boolean(p?.is_private),
      favorite_genres:Array.isArray(p?.favorite_genres)?p.favorite_genres:[],
      website_url:p?.website_url??'', instagram_username:p?.instagram_username??'',
      discord_username:p?.discord_username??'', snapchat_username:p?.snapchat_username??'',
      steam_profile:p?.steam_profile??'', tiktok_username:p?.tiktok_username??'',
      location:p?.location??'', status_text:p?.status_text??'', pronouns:p?.pronouns??'',
      favorite_movie_text:p?.favorite_movie_text??'', favorite_movie_tmdb_id:p?.favorite_movie_tmdb_id??null,
      favorite_movie_poster_path:p?.favorite_movie_poster_path??'', profile_quote:p?.profile_quote??''
    };
  }

  function directPaint(p){
    const display=String(p.display_name||'').trim();
    const handle=cleanUser(p.username);
    const name=$('profile-name'); if(name){name.textContent=display||handle||'Profile';name.dataset.username=handle;}
    const line=$('profile-username-line'); if(line)line.textContent=handle?`@${handle}`:'';
    const bio=$('profile-bio'); if(bio){bio.textContent=String(p.bio||'').trim()||'No bio yet.';bio.classList.toggle('empty',!String(p.bio||'').trim());}
    const joined=$('profile-joined');
    if(joined){const t=new Date(p.created_at).getTime();joined.textContent=Number.isFinite(t)?`Joined ${new Date(t).toLocaleDateString(undefined,{month:'short',year:'numeric'})}`:'Flix2Watch member';}
    const age=$('v16-profile-age'); if(age)age.textContent=memberAge(p.created_at);
    const img=$('profile-avatar'),fallback=$('profile-avatar-fallback');
    if(p.avatar_url&&img){img.src=p.avatar_url;img.style.display='block';if(fallback)fallback.style.display='none';}
    else if(fallback){fallback.textContent=(handle||'?').slice(0,2).toUpperCase();fallback.style.display='grid';if(img)img.style.display='none';}
    document.title=`${display||handle||'Profile'} • Flix2Watch`;
  }

  function expose(p){
    try{viewedProfile=p;}catch{}
    try{f2wProfileResolvedUsername=String(p.username||'').toLowerCase();}catch{}
    try{f2wProfilePendingUsername='';}catch{}
    window.__F2W_CANONICAL_PROFILE_V195=p;
    try{localStorage.setItem('f2w_profile_username_v24',p.username||'');}catch{}
    try{window.__F2W_MEMBER_SINCE_V139=p.created_at||window.__F2W_MEMBER_SINCE_V139;}catch{}
  }

  async function ownerAndEditor(p){
    const c=db(); let user=null;
    try{user=(await timeout(c?.auth?.getSession?.(),5000))?.data?.session?.user||null;}catch{}
    try{currentUser=user;}catch{}
    const own=Boolean(user&&p.user_id&&String(user.id)===String(p.user_id));
    document.body.classList.toggle('profile-own-v195',own);
    let edit=$('v35-edit-profile');
    const actions=document.querySelector('.profile-actions');
    if(!edit&&actions){
      edit=document.createElement('button');edit.id='v35-edit-profile';edit.type='button';edit.className='profile-action-btn f2w-edit-profile-btn';
      edit.innerHTML='<i class="fa-solid fa-pen-to-square"></i> <span>Edit Profile</span>';
      actions.insertBefore(edit,$('copy-profile-link-btn')||actions.firstChild);
    }
    if(edit){
      edit.hidden=!own;edit.style.setProperty('display',own?'inline-flex':'none',own?'important':'');
      if(own)edit.onclick=e=>{e.preventDefault();e.stopPropagation();window.f2wOpenProfileEditorV182?.();};
    }
    if(own){
      try{await window.f2wInstallProfileEditorV191?.();}catch(e){console.warn('[v195] editor install',e)}
      if(edit){edit.hidden=false;edit.style.setProperty('display','inline-flex','important');}
    }
  }

  async function render(name){
    const mine=++runId;
    try{
      const p=normalize(await getProfile(name));
      if(mine!==runId)return;
      if(!p?.user_id||!p.username) throw new Error('Profile not found');
      expose(p);
      // Use the site's renderer when it is healthy, then enforce the core identity fields.
      try{ if(typeof renderViewedProfile==='function') renderViewedProfile(); }catch(e){console.warn('[v195] legacy renderer failed',e)}
      directPaint(p);
      try{renderViewedFavorites?.();}catch{}
      try{renderProfilePrivacy?.();}catch{}
      try{loadProfileSocial?.();}catch{}
      try{window.renderProfilePresence?.();}catch{}
      try{window.f2wRenderProfileActivityV182?.();}catch{}
      try{window.f2wInstallProfileEditorV191?.();}catch{}
      await ownerAndEditor(p);
      try{window.dispatchEvent(new CustomEvent('f2w:profile-ready',{detail:{profile:p,canonical:true}}));}catch{}
    }catch(err){
      console.error('[v195] canonical profile load failed',err);
      const n=$('profile-name');if(n)n.textContent='Profile unavailable';
      const b=$('profile-bio');if(b){b.textContent='This profile could not be loaded. Run V195-PROFILE-CANONICAL.sql in Supabase, then refresh.';b.classList.add('empty');}
      const s=document.querySelector('#v17-profile-presence span:last-child');if(s)s.textContent='Status unavailable';
    }
  }

  function start(){
    const u=username();
    if(!u)return;
    if(location.search){history.replaceState(null,'',`/profile/@${encodeURIComponent(u)}`);}
    render(u);
    window.addEventListener('pageshow',()=>render(u),{passive:true});
    try{db()?.auth?.onAuthStateChange?.(()=>setTimeout(()=>ownerAndEditor(window.__F2W_CANONICAL_PROFILE_V195||{}),80));}catch{}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
// f2w-force-save:v195-canonical-profile:20260902
