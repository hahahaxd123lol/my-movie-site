const CACHE='flix2watch-ultra-v35';
const STATIC=[
  '/leaderboard/',
  '/privacy/',
  '/final-v35.js',
  '/final-v35.css',
  '/forum/',
  '/popup-protection-v34.js',
  '/social-v34.js',
  '/final-v34.css',
  '/chat-safety-v33.js',
  '/final-v33.css',
  '/final-v32.css',
  '/final-v28.css',
  '/final-v27.css',
  '/final-v26.css',
  '/final-v22.js',
  '/final-v22.css',
  '/final-v20.js',
  '/final-v20.css',
  '/final-v19.css',
  '/final-v19.js',
  '/final-v18.js',
  '/final-v18.css',
  '/final-v17.css',
  '/final-v17.js',
  '/seo-v17.js',
  '/robots.txt',
  '/sitemap.xml',
  '/flix2watch-logo-red-v34.png',
  '/flix2watch-logo-blue-v34.png',
  '/flix2watch-logo-green-v34.png',
  '/flix2watch-logo-purple-v34.png',
  '/flix2watch-logo-amber-v34.png',
  '/flix2watch-logo-matrix-v34.png',
  '/flix2watch-logo-cyan-v34.png',
  '/flix2watch-logo-pink-v34.png',
  '/flix2watch-logo-orange-v34.png',
  '/flix2watch-logo-ice-v34.png',
  '/flix2watch-logo-gold-v34.png',
  '/flix2watch-logo-midnight-v34.png',
  '/account-guard-v16.js',
  '/silent-account-v16.js',
  '/final-v16.js',
  '/final-v16.css',
  '/final-v15.js',
  '/final-v15.css',
  '/final-v14.js',
  '/final-v14.css',
  '/final-fixes-v13.js',
  '/final-fixes-v13.css',
  '/approved-ui-v12.js',
  '/approved-ui-v12.css',
  '/favicon-16x16-v16.png',
  '/final-v9.css',
  '/realtime-v7.js',
  '/interaction-v7.js',
  '/responsive-v7.css',
  '/favicon-v16.ico',
  '/favicon-32x32-v16.png',
  '/apple-touch-icon-v16.png',
  '/android-chrome-192x192-v16.png',
  '/android-chrome-512x512-v16.png',
  '/og-image-v16.png',
  '/site.webmanifest'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE).then(cache=>cache.addAll(STATIC)).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;

  const url=new URL(request.url);

  // Never cache HTML/profile shells, auth, Supabase API, or chat worker.
  // This prevents stale profile markup from surviving deployments.
  const accept=request.headers.get('accept')||'';
  if(
    request.mode==='navigate' ||
    request.destination==='document' ||
    accept.includes('text/html') ||
    url.pathname.endsWith('/') ||
    url.hostname.includes('supabase.co') ||
    url.pathname.includes('/functions/')
  ){
    return;
  }

  // Static same-origin assets: cache first.
  if(url.origin===self.location.origin){
    event.respondWith(
      caches.match(request).then(hit=>hit||fetch(request).then(response=>{
        const clone=response.clone();
        caches.open(CACHE).then(cache=>cache.put(request,clone));
        return response;
      }))
    );
    return;
  }


  // Reuse third-party libraries/fonts on repeat visits without making them
  // block the network every page load.
  if(
    url.hostname==='cdn.jsdelivr.net' ||
    url.hostname==='cdnjs.cloudflare.com' ||
    url.hostname==='fonts.googleapis.com' ||
    url.hostname==='fonts.gstatic.com'
  ){
    event.respondWith(
      caches.open(CACHE).then(async cache=>{
        const hit=await cache.match(request);
        const network=fetch(request).then(response=>{
          if(response.ok||response.type==='opaque'){
            cache.put(request,response.clone());
          }
          return response;
        }).catch(()=>hit);

        return hit||network;
      })
    );
    return;
  }

  // TMDB API/artwork: stale-while-revalidate for faster repeat browsing.
  if(url.hostname==='api.themoviedb.org'||url.hostname==='image.tmdb.org'){
    event.respondWith(
      caches.open(CACHE).then(async cache=>{
        const hit=await cache.match(request);
        const network=fetch(request).then(response=>{
          if(response.ok)cache.put(request,response.clone());
          return response;
        }).catch(()=>hit);
        return hit||network;
      })
    );
  }
});
