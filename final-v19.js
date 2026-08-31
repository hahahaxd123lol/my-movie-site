
(() => {
  'use strict';

  const V19_THEMES={
    'theme-red':      {color:'#e50914',rgb:'229,9,20',logo:'/flix2watch-logo-red-v34.png'},
    'theme-blue':     {color:'#3b82f6',rgb:'59,130,246',logo:'/flix2watch-logo-blue-v34.png'},
    'theme-green':    {color:'#10b981',rgb:'16,185,129',logo:'/flix2watch-logo-green-v34.png'},
    'theme-purple':   {color:'#8b5cf6',rgb:'139,92,246',logo:'/flix2watch-logo-purple-v34.png'},
    'theme-amber':    {color:'#f59e0b',rgb:'245,158,11',logo:'/flix2watch-logo-amber-v34.png'},
    'theme-matrix':   {color:'#00ff66',rgb:'0,255,102',logo:'/flix2watch-logo-matrix-v34.png'},
    'theme-cyan':     {color:'#06b6d4',rgb:'6,182,212',logo:'/flix2watch-logo-cyan-v34.png'},
    'theme-pink':     {color:'#ec4899',rgb:'236,72,153',logo:'/flix2watch-logo-pink-v34.png'},
    'theme-orange':   {color:'#f97316',rgb:'249,115,22',logo:'/flix2watch-logo-orange-v34.png'},
    'theme-ice':      {color:'#7dd3fc',rgb:'125,211,252',logo:'/flix2watch-logo-ice-v34.png'},
    'theme-gold':     {color:'#eab308',rgb:'234,179,8',logo:'/flix2watch-logo-gold-v34.png'},
    'theme-midnight': {color:'#6366f1',rgb:'99,102,241',logo:'/flix2watch-logo-midnight-v34.png'}
  };

  function currentTheme(){
    const saved=
      localStorage.getItem('flix2watch_theme')
      ||localStorage.getItem('josh_site_theme')
      ||document.documentElement.dataset.flix2watchTheme
      ||'theme-red';

    return V19_THEMES[saved]?saved:'theme-red';
  }

  function closeThemeMenu(){
    const menu=document.getElementById('theme-menu');
    const button=document.getElementById('theme-menu-button');

    if(menu){
      menu.hidden=true;
      menu.classList.remove('show');
      menu.setAttribute('aria-hidden','true');
    }

    if(button)button.setAttribute('aria-expanded','false');
  }

  function applyTheme(theme,save=true){
    const key=V19_THEMES[theme]?theme:'theme-red';
    const meta=V19_THEMES[key];

    if(save){
      localStorage.setItem('flix2watch_theme',key);
      localStorage.setItem('josh_site_theme',key);
    }

    document.documentElement.dataset.flix2watchTheme=key;
    document.documentElement.style.setProperty('--accent',meta.color);
    document.documentElement.style.setProperty('--f2w-red',meta.color);
    document.documentElement.style.setProperty('--f2w-accent-rgb',meta.rgb);
    document.documentElement.style.setProperty('--accent-glow',`rgba(${meta.rgb},.28)`);

    if(document.body){
      Object.keys(V19_THEMES).forEach(name=>document.body.classList.remove(name));
      document.body.classList.add(key);
      document.body.style.setProperty('--accent',meta.color);
      document.body.style.setProperty('--f2w-red',meta.color);
      document.body.style.setProperty('--f2w-accent-rgb',meta.rgb);
      document.body.style.setProperty('--accent-glow',`rgba(${meta.rgb},.28)`);
    }

    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content',meta.color);

    document.querySelectorAll(
      'img[src*="flix2watch-logo-"],.logo-image,.f2w-guest-brand img,.f2w-account-brand img,.support-v16-brand img,.staff-page-toolbar .logo img,.footer-brand img'
    ).forEach(img=>{
      if(img.getAttribute('src')!==meta.logo){
        img.setAttribute('src',meta.logo);
      }
    });

    closeThemeMenu();
  }

  /* Override the older class-only dropdown logic. The menu is physically
     hidden until the Theme button is clicked. */
  const previousToggleDropdown=window.toggleDropdown;

  window.toggleDropdown=function(id){
    if(id!=='theme-menu'){
      if(typeof previousToggleDropdown==='function'){
        return previousToggleDropdown(id);
      }
      return;
    }

    const menu=document.getElementById('theme-menu');
    const button=document.getElementById('theme-menu-button');
    if(!menu)return;

    const opening=menu.hidden || !menu.classList.contains('show');

    document.querySelectorAll('.dropdown-menu').forEach(other=>{
      other.classList.remove('show');
      if(other.id==='theme-menu'){
        other.hidden=true;
        other.setAttribute('aria-hidden','true');
      }
    });

    if(opening){
      menu.hidden=false;
      menu.classList.add('show');
      menu.setAttribute('aria-hidden','false');
      button?.setAttribute('aria-expanded','true');
    }else{
      closeThemeMenu();
    }
  };

  window.setTheme=function(_name,themeClass){
    applyTheme(themeClass,true);
  };

  /* ==========================================================
     USER SEARCH: KEEP PASSWORD MANAGERS AWAY FROM IT
     ========================================================== */
  function hardenUserSearch(){
    document.querySelectorAll('#user-search').forEach(input=>{
      input.type='search';
      input.name='flix2watch_member_lookup_query';
      input.autocomplete='off';
      input.inputMode='search';
      input.setAttribute('enterkeyhint','search');
      input.setAttribute('aria-autocomplete','none');
      input.setAttribute('data-form-type','other');
      input.setAttribute('data-lpignore','true');
      input.setAttribute('data-1p-ignore','true');
      input.setAttribute('data-bwignore','true');
      input.setAttribute('data-protonpass-ignore','true');
      input.setAttribute('data-keeper-ignore','true');

      if(input.dataset.v19CredentialGuard==='1')return;
      input.dataset.v19CredentialGuard='1';

      const unlock=()=>{
        input.removeAttribute('readonly');
        input.autocomplete='off';
      };

      input.addEventListener('pointerdown',unlock,{capture:true});
      input.addEventListener('touchstart',unlock,{capture:true,passive:true});
      input.addEventListener('focus',unlock,{capture:true});

      input.addEventListener('blur',()=>{
        // Restore readonly after interaction so password-manager scans continue
        // to see this as a lookup/search control rather than an account field.
        setTimeout(()=>{
          if(document.activeElement!==input){
            input.setAttribute('readonly','');
          }
        },80);
      });
    });
  }

  /* ==========================================================
     WATCH: BLACK LOCKED PLAYER, NEVER ABOUT:BLANK ON SCREEN
     ========================================================== */
  function paintWatchLock(locked){
    if(!document.body?.classList.contains('f2w-watch-page'))return;

    const frame=document.getElementById('video-frame');
    const overlay=document.getElementById('watch-login-overlay');
    const container=document.getElementById('flix-player-container');

    document.body.classList.toggle('watch-locked',locked);
    document.body.classList.toggle('watch-authenticated',!locked);

    if(container){
      container.style.background='#000';
    }

    if(locked){
      if(frame){
        frame.style.display='none';
        frame.style.visibility='hidden';
        frame.style.opacity='0';
        frame.setAttribute('aria-hidden','true');

        if(frame.src && frame.src!=='data:text/html,%3Cbody%20style%3D%22margin%3A0%3Bbackground%3A%23000%22%3E'){
          frame.src='data:text/html,%3Cbody%20style%3D%22margin%3A0%3Bbackground%3A%23000%22%3E';
        }
      }

      if(overlay){
        overlay.hidden=false;
        overlay.style.display='grid';
        overlay.setAttribute('aria-hidden','false');
      }
    }else{
      if(frame){
        frame.style.display='block';
        frame.style.visibility='visible';
        frame.style.opacity='1';
        frame.removeAttribute('aria-hidden');
      }

      if(overlay){
        overlay.hidden=true;
        overlay.style.display='none';
        overlay.setAttribute('aria-hidden','true');
      }
    }
  }

  async function syncWatchLock(){
    if(!document.body?.classList.contains('f2w-watch-page'))return;

    // Lock immediately. Nothing white is allowed to paint while auth resolves.
    paintWatchLock(true);

    let user=null;

    try{
      const client=
        (typeof chatSupabase!=='undefined'&&chatSupabase)
        ||window.__flix2watchAccountGuardClient
        ||null;

      if(client){
        const {data}=await client.auth.getSession();
        user=data?.session?.user||null;
      }
    }catch{}

    paintWatchLock(!user);
  }

  /* ==========================================================
     FEATURED: REAL FIVE-TITLE CAROUSEL
     ========================================================== */
  const FEATURED_API_KEY='925c48dd6e24fd5e975fe224238bbb45';
  let featuredItems=[];
  let featuredIndex=0;
  let featuredTimer=null;
  let touchStartX=0;
  let touchStartY=0;

  function filteredFeatured(items){
    const seen=new Set();

    return (Array.isArray(items)?items:[])
      .filter(item=>{
        if(!item||!item.id||!item.backdrop_path)return false;

        const type=item.media_type||(item.title?'movie':'tv');
        if(type!=='movie'&&type!=='tv')return false;

        const key=`${type}:${item.id}`;
        if(seen.has(key))return false;
        seen.add(key);

        try{
          if(
            typeof publicBlockedMediaKeys!=='undefined'
            &&publicBlockedMediaKeys?.has?.(key)
          ){
            return false;
          }
        }catch{}

        return true;
      })
      .slice(0,5);
  }

  function updateFeaturedDots(){
    document.querySelectorAll('#v19-hero-dots button').forEach((button,index)=>{
      const available=index<featuredItems.length;
      const active=available&&index===featuredIndex;

      button.hidden=!available;
      button.classList.toggle('active',active);
      button.setAttribute('aria-current',active?'true':'false');
    });

    const arrowsVisible=featuredItems.length>1;
    const prev=document.getElementById('v19-hero-prev');
    const next=document.getElementById('v19-hero-next');

    if(prev)prev.hidden=!arrowsVisible;
    if(next)next.hidden=!arrowsVisible;
  }

  function renderFeatured(index,animate=true){
    if(!featuredItems.length)return;

    featuredIndex=(index+featuredItems.length)%featuredItems.length;
    const item=featuredItems[featuredIndex];
    const hero=document.getElementById('hero-banner');
    if(!hero)return;

    if(animate)hero.classList.add('v19-hero-changing');

    const paint=()=>{
      try{
        if(typeof setupHeroBanner==='function'){
          setupHeroBanner(item);
        }else{
          const type=item.media_type||(item.title?'movie':'tv');
          const title=item.title||item.name||'Featured';
          hero.style.backgroundImage=
            `url('https://image.tmdb.org/t/p/original${item.backdrop_path}')`;

          document.getElementById('hero-title').textContent=title;
          document.getElementById('hero-overview').textContent=
            item.overview||'Featured on Flix2Watch.';

          document.getElementById('hero-link').href=
            `/watch/?id=${encodeURIComponent(item.id)}&type=${encodeURIComponent(type)}`;
        }
      }catch(error){
        console.warn('Could not render featured title:',error);
      }

      updateFeaturedDots();
      hero.classList.remove('v19-hero-changing');
    };

    if(animate)setTimeout(paint,120);
    else paint();
  }

  function resetFeaturedTimer(){
    clearInterval(featuredTimer);

    if(featuredItems.length>1){
      featuredTimer=setInterval(()=>{
        renderFeatured(featuredIndex+1,true);
      },8000);
    }
  }

  window.v19SeedFeatured=function(items){
    const usable=filteredFeatured(items);

    if(usable.length<2)return false;

    featuredItems=usable;
    featuredIndex=0;
    window.v19FeaturedReady=true;

    renderFeatured(0,false);
    resetFeaturedTimer();
    return true;
  };

  async function fetchFeatured(){
    try{
      const response=await fetch(
        `https://api.themoviedb.org/3/trending/all/day?api_key=${FEATURED_API_KEY}&language=en-US&page=1`
      );

      if(!response.ok)throw new Error('Featured request failed');

      const data=await response.json();
      window.v19SeedFeatured(data?.results||[]);
    }catch(error){
      console.warn('Featured carousel fallback:',error);
    }
  }

  function installFeaturedControls(){
    const hero=document.getElementById('hero-banner');
    if(!hero)return;

    document.getElementById('v19-hero-prev')?.addEventListener('click',event=>{
      event.preventDefault();
      renderFeatured(featuredIndex-1,true);
      resetFeaturedTimer();
    });

    document.getElementById('v19-hero-next')?.addEventListener('click',event=>{
      event.preventDefault();
      renderFeatured(featuredIndex+1,true);
      resetFeaturedTimer();
    });

    document.querySelectorAll('#v19-hero-dots button').forEach((button,index)=>{
      button.addEventListener('click',event=>{
        event.preventDefault();
        renderFeatured(index,true);
        resetFeaturedTimer();
      });
    });

    hero.addEventListener('touchstart',event=>{
      const touch=event.changedTouches?.[0];
      if(!touch)return;
      touchStartX=touch.clientX;
      touchStartY=touch.clientY;
    },{passive:true});

    hero.addEventListener('touchend',event=>{
      const touch=event.changedTouches?.[0];
      if(!touch)return;

      const dx=touch.clientX-touchStartX;
      const dy=touch.clientY-touchStartY;

      if(Math.abs(dx)>48 && Math.abs(dx)>Math.abs(dy)*1.2){
        renderFeatured(featuredIndex+(dx<0?1:-1),true);
        resetFeaturedTimer();
      }
    },{passive:true});

    hero.addEventListener('mouseenter',()=>clearInterval(featuredTimer));
    hero.addEventListener('mouseleave',resetFeaturedTimer);
    hero.addEventListener('focusin',()=>clearInterval(featuredTimer));
    hero.addEventListener('focusout',resetFeaturedTimer);
  }

  /* ==========================================================
     BOOT
     ========================================================== */
  function boot(){
    closeThemeMenu();
    applyTheme(currentTheme(),false);
    hardenUserSearch();
    installFeaturedControls();

    if(document.body?.classList.contains('f2w-home-page')){
      fetchFeatured();
    }

    if(document.body?.classList.contains('f2w-watch-page')){
      syncWatchLock();

      try{
        const client=
          (typeof chatSupabase!=='undefined'&&chatSupabase)
          ||window.__flix2watchAccountGuardClient
          ||null;

        client?.auth?.onAuthStateChange?.((_event,session)=>{
          paintWatchLock(!session?.user);
        });
      }catch{}
    }
  }

  document.addEventListener('click',event=>{
    if(!event.target.closest('.dropdown-wrapper')){
      closeThemeMenu();
    }
  },true);

  window.addEventListener('storage',event=>{
    if(event.key==='flix2watch_theme'||event.key==='josh_site_theme'){
      applyTheme(currentTheme(),false);
    }
  });

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  }else{
    boot();
  }
})();
