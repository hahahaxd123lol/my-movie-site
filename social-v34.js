(() => {
  'use strict';
  const SUPABASE_URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
  const SUPABASE_KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
  const API_KEY='925c48dd6e24fd5e975fe224238bbb45';
  let client=null;
  let searchTimer=null;
  let searchRows=[];

  function db(){
    if(client)return client;
    try{ if(typeof chatSupabase!=='undefined'&&chatSupabase)return client=chatSupabase; }catch{}
    try{ if(typeof window.supabase?.createClient==='function')return client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY); }catch{}
    return null;
  }
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const fmtDate=v=>{try{return new Date(v).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})}catch{return ''}};

  // ----- force new V34 brand even if an older theme script tries to overwrite it -----
  const themeAssets={
    'theme-red':'/flix2watch-logo-red-v34.png','theme-blue':'/flix2watch-logo-blue-v34.png','theme-green':'/flix2watch-logo-green-v34.png',
    'theme-purple':'/flix2watch-logo-purple-v34.png','theme-amber':'/flix2watch-logo-amber-v34.png','theme-matrix':'/flix2watch-logo-matrix-v34.png',
    'theme-cyan':'/flix2watch-logo-cyan-v34.png','theme-pink':'/flix2watch-logo-pink-v34.png','theme-orange':'/flix2watch-logo-orange-v34.png',
    'theme-ice':'/flix2watch-logo-ice-v34.png','theme-gold':'/flix2watch-logo-gold-v34.png','theme-midnight':'/flix2watch-logo-midnight-v34.png'
  };
  function themeName(){return Object.keys(themeAssets).find(x=>document.body?.classList.contains(x))||'theme-red'}
  function forceBrand(){
    const src=themeAssets[themeName()];
    document.querySelectorAll('img.logo-image,.f2w-guest-brand img,.f2w-account-brand img,.support-v16-brand img,.watch-footer-logo,.f2w-block-logo').forEach(img=>{
      if(img.getAttribute('src')!==src)img.setAttribute('src',src);
    });
  }
  window.addEventListener('f2w-theme-change',()=>setTimeout(forceBrand,0));

  // ----- global movie search on every page -----
  function searchHost(){
    const wrap=document.querySelector('body.f2w-main-page > header .search-container');
    if(!wrap)return null;
    let host=wrap.querySelector('.f2w-v34-movie-results');
    if(!host){host=document.createElement('div');host.className='f2w-v34-movie-results';wrap.appendChild(host)}
    return host;
  }
  async function doSearch(q){
    const host=searchHost(); if(!host)return;
    const clean=String(q||'').trim(); if(clean.length<2){host.classList.remove('show');host.innerHTML='';searchRows=[];return}
    host.classList.add('show');host.innerHTML='<div class="f2w-v34-search-state">Searching…</div>';
    try{
      const r=await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&language=en-US&include_adult=false&query=${encodeURIComponent(clean)}&page=1`);
      const data=await r.json();
      searchRows=(data.results||[]).filter(x=>x.media_type==='movie'||x.media_type==='tv').slice(0,8);
      if(!searchRows.length){host.innerHTML='<div class="f2w-v34-search-state">No titles found.</div>';return}
      host.innerHTML=searchRows.map((x,i)=>`<button type="button" data-i="${i}">${x.poster_path?`<img src="https://image.tmdb.org/t/p/w92${x.poster_path}" alt="">`:'<span class="f2w-v34-no-poster"><i class="fa-solid fa-film"></i></span>'}<span><strong>${esc(x.title||x.name||'Untitled')}</strong><small>${esc(String((x.release_date||x.first_air_date||'').slice(0,4)||'—'))} · ${x.media_type==='tv'?'TV':'Movie'}</small></span></button>`).join('');
      host.querySelectorAll('button').forEach(b=>b.onclick=()=>{const x=searchRows[Number(b.dataset.i)];if(x)location.href=`/watch/?id=${encodeURIComponent(x.id)}&type=${x.media_type}`});
    }catch{host.innerHTML='<div class="f2w-v34-search-state">Search unavailable.</div>'}
  }
  window.v18HeaderMovieSearch=function(value){clearTimeout(searchTimer);searchTimer=setTimeout(()=>doSearch(value),140)};
  function installSearch(){
    const input=document.getElementById('movie-search'); if(!input||input.dataset.v34==='1')return;input.dataset.v34='1';
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();if(searchRows[0])location.href=`/watch/?id=${searchRows[0].id}&type=${searchRows[0].media_type}`;else doSearch(input.value)}});
    document.addEventListener('click',e=>{if(!e.target.closest('.search-container'))searchHost()?.classList.remove('show')});
  }

  // ----- modal drag-out guard -----
  let dragInside=false, dragUntil=0;
  document.addEventListener('pointerdown',e=>{dragInside=Boolean(e.target.closest('.modal-card,.chat-card,.account-card,.report-card,.support-v16-card,.f2w-v34-thread-composer'));},true);
  document.addEventListener('pointerup',()=>{if(dragInside)dragUntil=Date.now()+450;dragInside=false;},true);
  document.addEventListener('click',e=>{if(Date.now()>dragUntil)return;const overlay=e.target.closest('.modal-overlay,.chat-modal,.account-modal,.report-modal');if(overlay&&e.target===overlay){e.preventDefault();e.stopImmediatePropagation();}},true);

  async function session(){try{return (await db()?.auth.getSession())?.data?.session||null}catch{return null}}

  // ----- Watch ratings -----
  async function initRating(){
    const card=document.getElementById('f2w-v34-rating-card');if(!card)return;
    const params=new URLSearchParams(location.search), mediaId=Number(params.get('id')), mediaType=params.get('type')==='tv'?'tv':'movie';
    if(!mediaId)return;
    const stars=document.getElementById('f2w-v34-rating-stars'), your=document.getElementById('f2w-v34-your-rating'), community=document.getElementById('f2w-v34-community-rating'), review=document.getElementById('f2w-v34-rating-review');
    let chosen=0;
    stars.innerHTML=Array.from({length:10},(_,i)=>{const v=(i+1)/2;return `<button type="button" data-v="${v}" title="${v} stars"><i class="fa-${(i%2===0)?'regular':'solid'} fa-star"></i><span>${v}</span></button>`}).join('');
    function paint(){stars.querySelectorAll('button').forEach(b=>b.classList.toggle('active',Number(b.dataset.v)<=chosen));your.textContent=chosen?`${chosen.toFixed(1)}★`:'—'}
    stars.querySelectorAll('button').forEach(b=>b.onclick=()=>{chosen=Number(b.dataset.v);paint()});
    const c=db(); if(!c)return;
    try{
      const {data:all}=await c.from('user_ratings').select('rating').eq('media_id',mediaId).eq('media_type',mediaType);
      if(all?.length)community.textContent=(all.reduce((a,x)=>a+Number(x.rating||0),0)/all.length).toFixed(1)+'★'; else community.textContent='—';
      const s=await session();
      if(s){const {data:mine}=await c.from('user_ratings').select('*').eq('user_id',s.user.id).eq('media_id',mediaId).eq('media_type',mediaType).maybeSingle();if(mine){chosen=Number(mine.rating);review.value=mine.review||'';paint()}}
    }catch{}
    document.getElementById('f2w-v34-save-rating').onclick=async()=>{
      const s=await session();if(!s){window.openAccountModal?.();return}if(!chosen){alert('Choose a rating first.');return}
      const title=(document.getElementById('detail-title')?.textContent||'Untitled').trim();const poster=document.getElementById('detail-poster')?.src||'';const posterPath=poster.includes('image.tmdb.org')?new URL(poster).pathname.replace(/^\/t\/p\/w\d+/,''):'';
      const {error}=await c.from('user_ratings').upsert({user_id:s.user.id,media_id:mediaId,media_type:mediaType,title,poster_path:posterPath,rating:chosen,review:review.value.trim()||null,updated_at:new Date().toISOString()},{onConflict:'user_id,media_type,media_id'});
      if(error)alert(error.message);else{your.textContent=chosen.toFixed(1)+'★';alert('Rating saved to your profile.')}
    };
    document.getElementById('f2w-v34-clear-rating').onclick=async()=>{const s=await session();if(!s)return;await c.from('user_ratings').delete().eq('user_id',s.user.id).eq('media_id',mediaId).eq('media_type',mediaType);chosen=0;review.value='';paint()};
  }

  // ----- Profile ratings + forum activity -----
  async function initProfileSocial(){
    const ratingsHost=document.getElementById('f2w-v34-profile-ratings');if(!ratingsHost)return;
    const username=(new URLSearchParams(location.search).get('user')||location.pathname.match(/@([^/]+)/)?.[1]||'').replace(/^@/,'');if(!username)return;
    const c=db();if(!c)return;const {data:p}=await c.from('profiles').select('user_id,username').ilike('username',username).maybeSingle();if(!p)return;
    try{
      const {data:ratings}=await c.from('user_ratings').select('*').eq('user_id',p.user_id).order('updated_at',{ascending:false}).limit(12);
      const rows=ratings||[];const stats=document.getElementById('f2w-v34-profile-rating-stats');if(stats)stats.innerHTML=`<span><strong>${rows.length}</strong> rated</span><span><strong>${rows.length?(rows.reduce((a,x)=>a+Number(x.rating),0)/rows.length).toFixed(1):'—'}</strong> avg</span>`;
      ratingsHost.innerHTML=rows.length?rows.map(r=>`<a class="f2w-v34-profile-rating" href="/watch/?id=${r.media_id}&type=${r.media_type}">${r.poster_path?`<img src="https://image.tmdb.org/t/p/w185${r.poster_path}" alt="">`:'<div class="f2w-v34-rating-placeholder"><i class="fa-solid fa-film"></i></div>'}<span><strong>${esc(r.title)}</strong><b>${Number(r.rating).toFixed(1)}★</b>${r.review?`<small>${esc(r.review)}</small>`:''}</span></a>`).join(''):'<div class="profile-v16-none">No ratings yet.</div>';
      const {data:threads}=await c.from('forum_threads').select('id,title,body,created_at').eq('author_id',p.user_id).order('created_at',{ascending:false}).limit(5);
      const {data:posts}=await c.from('forum_posts').select('id,thread_id,body,created_at').eq('author_id',p.user_id).order('created_at',{ascending:false}).limit(5);
      const items=[...(threads||[]).map(x=>({...x,kind:'Thread'})),...(posts||[]).map(x=>({...x,kind:'Reply',id:x.thread_id}))].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,8);
      const host=document.getElementById('f2w-v34-profile-forum');host.innerHTML=items.length?items.map(x=>`<a href="/forum/?thread=${x.id}"><b>${x.kind}</b><strong>${esc(x.title||x.body.slice(0,90))}</strong><small>${fmtDate(x.created_at)}</small></a>`).join(''):'<div class="profile-v16-none">No community posts yet.</div>';
    }catch{}
  }

  // ----- Forum -----
  async function initForum(){
    const feed=document.getElementById('f2w-v34-thread-feed');if(!feed)return;const c=db();if(!c)return;
    const composer=document.getElementById('f2w-v34-thread-composer');
    document.getElementById('f2w-v34-new-thread').onclick=async()=>{const s=await session();if(!s){window.openAccountModal?.();return}composer.hidden=false;document.getElementById('f2w-v34-thread-title').focus()};
    document.getElementById('f2w-v34-thread-cancel').onclick=()=>composer.hidden=true;
    document.getElementById('f2w-v34-thread-submit').onclick=async()=>{const s=await session();if(!s)return;const title=document.getElementById('f2w-v34-thread-title').value.trim(),body=document.getElementById('f2w-v34-thread-body').value.trim();if(title.length<3||!body)return alert('Add a title and message.');const {data,error}=await c.from('forum_threads').insert({author_id:s.user.id,title,body}).select().single();if(error)return alert(error.message);location.href=`/forum/?thread=${data.id}`};
    const threadId=new URLSearchParams(location.search).get('thread');
    if(threadId){return loadThread(threadId)}
    const {data:threads,error}=await c.from('forum_threads').select('*').order('created_at',{ascending:false}).limit(50);if(error){feed.innerHTML='<div class="f2w-v34-forum-state">Community tables are not installed yet. Run the V34 SQL.</div>';return}
    const ids=[...new Set((threads||[]).map(x=>x.author_id))];let profiles={};if(ids.length){const {data:ps}=await c.from('profiles').select('user_id,username,display_name,avatar_url').in('user_id',ids);(ps||[]).forEach(x=>profiles[x.user_id]=x)}
    const postCounts={};if((threads||[]).length){const {data:posts}=await c.from('forum_posts').select('thread_id').in('thread_id',threads.map(x=>x.id));(posts||[]).forEach(x=>postCounts[x.thread_id]=(postCounts[x.thread_id]||0)+1)}
    feed.innerHTML=(threads||[]).length?threads.map(t=>{const p=profiles[t.author_id]||{};return `<article class="f2w-v34-thread-card"><a class="f2w-v34-thread-author" href="/profile/?user=${encodeURIComponent(p.username||'')}">${p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="">`:'<span><i class="fa-solid fa-user"></i></span>'}<b>${esc(p.display_name||p.username||'User')}</b><small>@${esc(p.username||'user')}</small></a><a class="f2w-v34-thread-body" href="/forum/?thread=${t.id}"><h2>${esc(t.title)}</h2><p>${esc(t.body.slice(0,240))}</p><footer><span>${fmtDate(t.created_at)}</span><span><i class="fa-regular fa-comment"></i> ${postCounts[t.id]||0}</span></footer></a></article>`}).join(''):'<div class="f2w-v34-forum-state">No threads yet. Start the first one.</div>';
    async function loadThread(){}
  }
  async function loadThread(id){
    const feed=document.getElementById('f2w-v34-thread-feed'),c=db();if(!feed||!c)return;const {data:t,error}=await c.from('forum_threads').select('*').eq('id',id).maybeSingle();if(error||!t){feed.innerHTML='<div class="f2w-v34-forum-state">Thread not found.</div>';return}
    const {data:posts}=await c.from('forum_posts').select('*').eq('thread_id',id).order('created_at',{ascending:true});const ids=[...new Set([t.author_id,...(posts||[]).map(x=>x.author_id)])];const {data:ps}=await c.from('profiles').select('user_id,username,display_name,avatar_url').in('user_id',ids);const pm={};(ps||[]).forEach(x=>pm[x.user_id]=x);
    const row=(x,kind)=>{const p=pm[x.author_id]||{};return `<article class="f2w-v34-post"><a href="/profile/?user=${encodeURIComponent(p.username||'')}">${p.avatar_url?`<img src="${esc(p.avatar_url)}" alt="">`:'<span><i class="fa-solid fa-user"></i></span>'}<b>${esc(p.display_name||p.username||'User')}</b><small>@${esc(p.username||'user')}</small></a><div>${kind==='thread'?`<h1>${esc(x.title)}</h1>`:''}<p>${esc(x.body)}</p><small>${fmtDate(x.created_at)}</small></div></article>`};
    feed.innerHTML=`<a class="f2w-v34-back" href="/forum/"><i class="fa-solid fa-arrow-left"></i> All threads</a>${row(t,'thread')}${(posts||[]).map(x=>row(x,'post')).join('')}<section class="f2w-v34-reply"><textarea id="f2w-v34-reply-body" maxlength="5000" placeholder="Write a reply..."></textarea><button id="f2w-v34-reply-send" type="button">Post reply</button></section>`;
    document.getElementById('f2w-v34-reply-send').onclick=async()=>{const s=await session();if(!s){window.openAccountModal?.();return}const body=document.getElementById('f2w-v34-reply-body').value.trim();if(!body)return;const {error}=await c.from('forum_posts').insert({thread_id:id,author_id:s.user.id,body});if(error)alert(error.message);else location.reload()};
  }

  function boot(){forceBrand();installSearch();initRating();initProfileSocial();initForum();const obs=new MutationObserver(()=>forceBrand());obs.observe(document.body,{attributes:true,attributeFilter:['class'],subtree:false});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();