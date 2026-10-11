
(() => {
  'use strict';

  const V15_TMDB_KEY='925c48dd6e24fd5e975fe224238bbb45';
  const SEARCH_PAGE_SIZE=30;

  /* ---------- Theme/logo reliability ---------- */
  const allowedThemes=new Set([
    'theme-red','theme-blue','theme-green',
    'theme-purple','theme-amber','theme-matrix','theme-cyan','theme-pink','theme-orange','theme-ice','theme-gold','theme-midnight'
  ]);

  function v15Theme(){
    const saved=
      localStorage.getItem('flix2watch_theme')
      ||localStorage.getItem('josh_site_theme')
      ||document.documentElement.dataset.flix2watchTheme
      ||'theme-red';

    return allowedThemes.has(saved)?saved:'theme-red';
  }

  function forceThemeState(theme,save=false){
    const value=allowedThemes.has(theme)?theme:'theme-red';
    document.documentElement.dataset.flix2watchTheme=value;

    if(document.body){
      for(const item of allowedThemes)document.body.classList.remove(item);
      document.body.classList.add(value);
    }

    if(save){
      localStorage.setItem('flix2watch_theme',value);
      localStorage.setItem('josh_site_theme',value);
    }
  }

  const previousSetTheme=window.setTheme;
  window.setTheme=function(name,themeClass){
    if(typeof previousSetTheme==='function'){
      try{previousSetTheme(name,themeClass)}catch{}
    }
    forceThemeState(themeClass,true);
  };

  /* ---------- Generic header movie search for Support/Staff ---------- */
  function installGenericMovieSearch(){
    const input=document.getElementById('search');
    if(!input||input.dataset.v15GenericMovieSearch==='1')return;

    const hasLocalSearch=
      typeof window.searchMedia==='function'
      ||typeof window.searchMediaWatch==='function';

    if(hasLocalSearch)return;

    input.dataset.v15GenericMovieSearch='1';
    input.enterKeyHint='search';

    input.addEventListener('keydown',event=>{
      if(event.key!=='Enter'||event.isComposing)return;
      event.preventDefault();
      const value=String(input.value||'').trim();
      if(value){
        window.location.href=`/home/?search=${encodeURIComponent(value)}`;
      }
    });
  }

  /* ---------- Home search results stay ABOVE Trending Today ---------- */
  let searchTimer=null;
  let searchRequest=0;
  let searchQuery='';
  let searchPage=1;
  let searchTotalPages=1;

  function isBlocked(item){
    try{
      const type=item.media_type||(item.title?'movie':'tv');
      return typeof publicBlockedMediaKeys!=='undefined'
        &&publicBlockedMediaKeys?.has?.(`${type}:${item.id}`);
    }catch{
      return false;
    }
  }

  function searchCard(item){
    const type=item.media_type||(item.title?'movie':'tv');
    const title=item.title||item.name||'Untitled';
    const date=item.release_date||item.first_air_date||'';
    const year=date?date.slice(0,4):'N/A';
    const rating=Number(item.vote_average||0);

    const card=document.createElement('a');
    card.href=`/watch/?id=${encodeURIComponent(item.id)}&type=${encodeURIComponent(type)}`;
    card.className='movie-card';
    card.dataset.mediaKey=`${type}:${item.id}`;

    const poster=document.createElement('div');
    poster.className='poster-container';

    const badge=document.createElement('span');
    badge.className=`media-badge ${type}`;
    badge.textContent=type==='tv'?'Series':'Movie';

    const img=document.createElement('img');
    img.className='poster-img';
    img.src=`https://image.tmdb.org/t/p/w500${item.poster_path}`;
    img.alt=`${title} poster`;
    img.loading='lazy';

    const overlay=document.createElement('div');
    overlay.className='play-overlay';
    overlay.innerHTML='<i class="fa-solid fa-play"></i>';

    poster.append(img,badge,overlay);

    const info=document.createElement('div');
    info.className='movie-info';

    const name=document.createElement('div');
    name.className='movie-title';
    name.textContent=title;

    const meta=document.createElement('div');
    meta.className='movie-meta';

    const yearEl=document.createElement('span');
    yearEl.innerHTML=`<i class="fa-regular fa-calendar"></i> ${year}`;

    const ratingEl=document.createElement('span');
    ratingEl.className='movie-rating';
    ratingEl.innerHTML=`<i class="fa-solid fa-star"></i> ${rating?rating.toFixed(1):'NR'}`;

    meta.append(yearEl,ratingEl);
    info.append(name,meta);
    card.append(poster,info);

    return card;
  }

  function renderSearchPagination(){
    const host=document.getElementById('v15-movie-search-pagination');
    if(!host)return;

    host.innerHTML='';
    if(searchTotalPages<=1)return;

    const add=(label,page,active=false,disabled=false)=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='catalog-page-btn';
      if(active)button.classList.add('active');
      button.disabled=disabled;
      button.innerHTML=label;
      if(!active&&!disabled){
        button.onclick=()=>loadV15MovieSearch(searchQuery,page,true);
      }
      host.appendChild(button);
    };

    add('<i class="fa-solid fa-chevron-left"></i> Prev',searchPage-1,false,searchPage<=1);

    const pages=new Set([1,searchTotalPages,searchPage]);
    for(let d=-2;d<=2;d++){
      const page=searchPage+d;
      if(page>=1&&page<=searchTotalPages)pages.add(page);
    }

    let previous=null;
    [...pages].sort((a,b)=>a-b).forEach(page=>{
      if(previous!==null&&page-previous>1){
        const gap=document.createElement('span');
        gap.className='catalog-page-gap';
        gap.textContent='…';
        host.appendChild(gap);
      }
      add(String(page),page,page===searchPage,false);
      previous=page;
    });

    add('Next <i class="fa-solid fa-chevron-right"></i>',searchPage+1,false,searchPage>=searchTotalPages);
  }

  async function loadV15MovieSearch(query,page=1,scroll=false){
    const section=document.getElementById('v15-movie-search-section');
    const grid=document.getElementById('v15-movie-search-grid');
    const title=document.getElementById('v15-movie-search-title');

    if(!section||!grid||!title)return;

    query=String(query||'').trim();

    if(!query){
      clearV15MovieSearch(false);
      return;
    }

    const requestId=++searchRequest;
    searchQuery=query;
    searchPage=Math.max(1,Number(page)||1);

    section.hidden=false;
    title.textContent=`Search Results: “${query}”`;
    grid.innerHTML='<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:30px;">Searching titles…</p>';

    if(scroll){
      const header=document.querySelector('body.f2w-main-page > header');
      const top=section.getBoundingClientRect().top+window.scrollY-(header?.offsetHeight||64)-10;
      window.scrollTo({top:Math.max(0,top),behavior:'smooth'});
    }

    try{
      const startIndex=(searchPage-1)*SEARCH_PAGE_SIZE;
      const firstPage=Math.floor(startIndex/20)+1;
      const offset=startIndex%20;

      const endpoint=pageNum=>
        `https://api.themoviedb.org/3/search/multi?api_key=${V15_TMDB_KEY}&query=${encodeURIComponent(query)}&page=${pageNum}&include_adult=false`;

      const [r1,r2]=await Promise.all([
        fetch(endpoint(firstPage)),
        fetch(endpoint(firstPage+1))
      ]);

      const [d1,d2]=await Promise.all([r1.json(),r2.json()]);

      if(requestId!==searchRequest)return;
      if(!r1.ok)throw new Error(d1?.status_message||'Search failed');

      const combined=[
        ...(Array.isArray(d1.results)?d1.results:[]),
        ...(r2.ok&&Array.isArray(d2.results)?d2.results:[])
      ].filter(item=>
        item
        &&item.media_type!=='person'
        &&item.poster_path
        &&!isBlocked(item)
      );

      const rows=combined.slice(offset,offset+SEARCH_PAGE_SIZE);
      const total=Number(d1.total_results||0);
      searchTotalPages=Math.max(1,Math.min(334,Math.ceil(total/SEARCH_PAGE_SIZE)));
      searchPage=Math.min(searchPage,searchTotalPages);

      grid.innerHTML='';

      if(!rows.length){
        grid.innerHTML='<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:30px;">No matching movies or TV shows found.</p>';
      }else{
        rows.forEach(item=>grid.appendChild(searchCard(item)));
      }

      renderSearchPagination();

      const url=new URL(window.location.href);
      url.searchParams.set('search',query);
      if(searchPage>1)url.searchParams.set('searchPage',String(searchPage));
      else url.searchParams.delete('searchPage');
      history.replaceState(null,'',url);
    }catch(error){
      console.error('V15 movie search failed:',error);
      grid.innerHTML='<p style="color:#f87171;grid-column:1/-1;text-align:center;padding:30px;">Could not search titles right now.</p>';
      document.getElementById('v15-movie-search-pagination').innerHTML='';
    }
  }

  window.clearV15MovieSearch=function(clearInput=true){
    searchQuery='';
    searchPage=1;
    searchTotalPages=1;
    searchRequest+=1;

    const section=document.getElementById('v15-movie-search-section');
    const grid=document.getElementById('v15-movie-search-grid');
    const pagination=document.getElementById('v15-movie-search-pagination');

    if(section)section.hidden=true;
    if(grid)grid.innerHTML='';
    if(pagination)pagination.innerHTML='';

    if(clearInput){
      const input=document.getElementById('search');
      if(input)input.value='';
    }

    const url=new URL(window.location.href);
    url.searchParams.delete('search');
    url.searchParams.delete('searchPage');
    history.replaceState(null,'',url);
  };

  function installHomeSearchOverride(){
    if(!document.body?.classList.contains('f2w-home-page'))return;

    window.searchMedia=function(query){
      query=String(query||'').trim();
      if(!query){
        window.clearV15MovieSearch(false);
        return;
      }
      loadV15MovieSearch(query,1,false);
    };

    window.scheduleMediaSearch=function(query){
      clearTimeout(searchTimer);
      searchTimer=setTimeout(()=>window.searchMedia(query),180);
    };

    const params=new URLSearchParams(window.location.search);
    const q=String(params.get('search')||'').trim();
    const page=Math.max(1,Number(params.get('searchPage'))||1);

    if(q){
      const input=document.getElementById('search');
      if(input)input.value=q;
      setTimeout(()=>loadV15MovieSearch(q,page,false),0);
    }
  }

  /* ---------- Playback report must stay a standalone modal ---------- */
  function installPlaybackReportGuard(){
    if(!document.body?.classList.contains('f2w-watch-page'))return;

    const button=document.getElementById('report-playback-btn');
    if(button){
      button.addEventListener('click',()=>{
        try{
          if(typeof closeChat==='function')closeChat();
        }catch{}

        const modal=document.getElementById('report-modal');
        if(modal)modal.classList.add('playback-report-mode');
      },true);
    }
  }

  function boot(){
    forceThemeState(v15Theme(),false);
    installGenericMovieSearch();
    installHomeSearchOverride();
    installPlaybackReportGuard();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  }else{
    boot();
  }
})();
