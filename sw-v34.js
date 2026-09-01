/* Flix2Watch v34 navigation cache */
const CACHE='f2w-v133-1788311800';
const CORE=[
  '/home/','/favorites/','/profile/','/support/','/chat/',
  '/leaderboard/','/forum/','/users/',
  '/global-header-v1.css','/global-header-chat-v1.js',
  '/final-v35.css','/final-v35.js',
  '/flix2watch-logo-red-v34.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(CORE.map(x=>new Request(x,{cache:'reload'}))).catch(()=>{}))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k.startsWith('f2w-v')&&k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

async function staleWhileRevalidate(request){
  const cache=await caches.open(CACHE);
  const cached=await cache.match(request,{ignoreSearch:false});
  const network=fetch(request).then(response=>{
    if(response&&response.ok)cache.put(request,response.clone()).catch(()=>{});
    return response;
  }).catch(()=>cached);
  return cached||network;
}

async function navigationResponse(request){
  const cache=await caches.open(CACHE);

  // v58: NETWORK-FIRST for HTML navigation.
  // This prevents an old cached page from surviving a new deployment.
  try{
    const network=await fetch(request,{cache:'no-cache'});
    if(network&&network.ok){
      cache.put(request,network.clone()).catch(()=>{});
      return network;
    }
  }catch{}

  const cached=await cache.match(request,{ignoreSearch:false});
  if(cached)return cached;

  const path=new URL(request.url).pathname;
  // Friendly profile URLs (/profile/@name) use the same profile shell.
  // Without this, the service worker returned the literal word "Offline"
  // whenever navigation fallback was needed for an offline user/profile route.
  if(path==='/profile/' || path==='/profile' || /^\/profile\/@[A-Za-z0-9]+\/?$/.test(path)){
    const shell=await cache.match('/profile/');
    if(shell)return shell;
  }

  // Prefer the cached home shell over a blank one-word failure page.
  const home=await cache.match('/home/');
  if(home)return home;
  return new Response('Temporarily unavailable',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;

  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  // Never cache Supabase/API/auth-style endpoints.
  if(url.pathname.startsWith('/auth/')||url.pathname.startsWith('/rest/')||url.pathname.startsWith('/functions/'))return;

  if(request.mode==='navigate'){
    event.respondWith(navigationResponse(request));
    return;
  }

  if(/\.(?:css|js|png|jpe?g|webp|svg|ico|woff2?)(?:$|\?)/i.test(url.pathname)){
    event.respondWith(staleWhileRevalidate(request));
  }
});
// f2w-force-save:service-worker-network-first-v58:1788221340
 
// f2w-force-save:v128-instant-profile-presence:1788304200
