
(() => {
  'use strict';

  const ORIGIN='https://flix2watch.com';

  function ensureMeta(name,content,property=false){
    const selector=property
      ?`meta[property="${name}"]`
      :`meta[name="${name}"]`;

    let el=document.head.querySelector(selector);

    if(!el){
      el=document.createElement('meta');
      el.setAttribute(property?'property':'name',name);
      document.head.appendChild(el);
    }

    el.setAttribute('content',content);
    return el;
  }

  function ensureCanonical(url){
    let link=document.head.querySelector('link[rel="canonical"]');

    if(!link){
      link=document.createElement('link');
      link.rel='canonical';
      document.head.appendChild(link);
    }

    link.href=url;
  }

  function setJsonLd(id,data){
    let script=document.getElementById(id);

    if(!script){
      script=document.createElement('script');
      script.id=id;
      script.type='application/ld+json';
      document.head.appendChild(script);
    }

    script.textContent=JSON.stringify(data);
  }

  function siteMetadata(){
    ensureMeta(
      'description',
      'Flix2Watch is a free-to-use movie and TV discovery site. Browse films, TV shows, cast, plots, profiles and favorites; sign in for account-gated playback where available.'
    );
    ensureMeta(
      'robots',
      'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
    );
    ensureMeta('googlebot','index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
    ensureMeta('og:site_name','Flix2Watch',true);
    ensureMeta('og:type','website',true);
    ensureMeta('og:image',`${ORIGIN}/og-image-v16.png`,true);
    ensureMeta('twitter:card','summary_large_image');
    ensureMeta('twitter:image',`${ORIGIN}/og-image-v16.png`);

    setJsonLd('v17-website-schema',{
      '@context':'https://schema.org',
      '@type':'WebSite',
      name:'Flix2Watch',
      alternateName:'Flix 2 Watch',
      url:`${ORIGIN}/`,
      description:'Free-to-use movie and TV discovery, profiles, favorites and community features with account-gated playback where available.',
      inLanguage:'en'
    });

    setJsonLd('v17-organization-schema',{
      '@context':'https://schema.org',
      '@type':'Organization',
      name:'Flix2Watch',
      url:`${ORIGIN}/`,
      logo:`${ORIGIN}/android-chrome-512x512-v16.png`
    });
  }

  function staticCanonical(){
    const path=window.location.pathname;

    const map={
      '/':'/',
      '/home/':'/home/',
      '/favorites/':'/favorites/',
      '/users/':'/users/',
      '/support/':'/support/',
      '/staff/':'/staff/'
    };

    if(map[path])ensureCanonical(`${ORIGIN}${map[path]}`);
  }

  function watchMetadata(){
    if(!document.body?.classList.contains('f2w-watch-page'))return;

    const params=new URLSearchParams(window.location.search);
    const id=params.get('id')||'';
    const type=(params.get('type')||'movie').toLowerCase()==='tv'?'tv':'movie';

    if(id){
      ensureCanonical(`${ORIGIN}/watch/?id=${encodeURIComponent(id)}&type=${type}`);
    }

    const update=()=>{
      const title=String(document.getElementById('detail-title')?.textContent||'').trim();
      const overview=String(document.getElementById('detail-overview')?.textContent||'').trim();
      const poster=document.getElementById('detail-poster')?.getAttribute('src')||'';

      if(!title||/loading/i.test(title))return;

      document.title=`${title} | Flix2Watch`;

      const description=overview
        ?`${overview.slice(0,155)}${overview.length>155?'…':''}`
        :`View ${title} details, cast, ratings and more on Flix2Watch.`;

      ensureMeta('description',description);
      ensureMeta('og:title',`${title} | Flix2Watch`,true);
      ensureMeta('og:description',description,true);
      ensureMeta('og:type',type==='tv'?'video.tv_show':'video.movie',true);
      ensureMeta('twitter:title',`${title} | Flix2Watch`);
      ensureMeta('twitter:description',description);

      if(poster&&poster.startsWith('http')){
        ensureMeta('og:image',poster,true);
        ensureMeta('twitter:image',poster);
      }

      const schema={
        '@context':'https://schema.org',
        '@type':type==='tv'?'TVSeries':'Movie',
        name:title,
        description:overview||description,
        url:id?`${ORIGIN}/watch/?id=${encodeURIComponent(id)}&type=${type}`:window.location.href
      };

      if(poster&&poster.startsWith('http'))schema.image=poster;

      setJsonLd('v17-title-schema',schema);
    };

    update();

    const target=document.getElementById('detail-title');

    if(target){
      new MutationObserver(update).observe(target,{
        childList:true,
        subtree:true,
        characterData:true
      });
    }

    setTimeout(update,700);
    setTimeout(update,1800);
  }

  function profileCanonical(){
    if(!document.body?.classList.contains('f2w-profile-page'))return;

    const params=new URLSearchParams(window.location.search);
    const user=params.get('user')||'';

    if(user){
      ensureCanonical(`${ORIGIN}/profile/@${encodeURIComponent(user)}`);
    }
  }



  function profileMetadata(){
    if(!document.body?.classList.contains('f2w-profile-page'))return;

    const update=()=>{
      const display=String(document.getElementById('profile-name')?.textContent||'').trim();
      const handle=String(document.getElementById('profile-username-line')?.textContent||'').trim();
      const bio=String(document.getElementById('profile-bio')?.textContent||'').trim();

      if(!display||/loading/i.test(display))return;

      document.title=`${display} ${handle} | Flix2Watch`;

      const description=bio&&!/loading/i.test(bio)
        ?`${bio.slice(0,155)}${bio.length>155?'…':''}`
        :`View ${display}'s public Flix2Watch profile, favorites and profile details.`;

      ensureMeta('description',description);
      ensureMeta('og:title',`${display} | Flix2Watch`,true);
      ensureMeta('og:description',description,true);
      ensureMeta('og:type','profile',true);
    };

    update();

    const target=document.getElementById('profile-name');
    if(target){
      new MutationObserver(update).observe(target,{
        childList:true,
        subtree:true,
        characterData:true
      });
    }

    setTimeout(update,700);
  }

  function homeMovieListSchema(){
    if(!document.body?.classList.contains('f2w-home-page'))return;

    const build=()=>{
      const cards=[...document.querySelectorAll('#movie-grid .movie-card')].slice(0,10);
      if(!cards.length)return;

      const items=cards.map((card,index)=>{
        const name=String(card.querySelector('.movie-title')?.textContent||'').trim();
        const image=card.querySelector('img')?.src||'';
        const href=card.href||'';

        if(!name||!href)return null;

        const badge=String(card.querySelector('.media-badge')?.textContent||'').toLowerCase();
        const media={
          '@type':badge.includes('series')?'TVSeries':'Movie',
          name,
          url:href
        };

        if(image)media.image=image;

        return {
          '@type':'ListItem',
          position:index+1,
          item:media
        };
      }).filter(Boolean);

      if(!items.length)return;

      setJsonLd('v17-home-movie-list-schema',{
        '@context':'https://schema.org',
        '@type':'ItemList',
        name:'Flix2Watch movie and TV catalogue',
        itemListElement:items
      });
    };

    build();

    const grid=document.getElementById('movie-grid');
    if(grid){
      new MutationObserver(build).observe(grid,{childList:true,subtree:true});
    }

    setTimeout(build,1000);
    setTimeout(build,2200);
  }

  function boot(){
    siteMetadata();
    staticCanonical();
    profileCanonical();
    profileMetadata();
    watchMetadata();
    homeMovieListSchema();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  }else{
    boot();
  }
})();

// v177-force-refresh-2026-09-02
