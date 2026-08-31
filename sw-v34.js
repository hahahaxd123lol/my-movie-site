/* Flix2Watch v34 navigation cache */
const CACHE='f2w-v34-1788217565';
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

  // Race a warm cached page against network. The v33 prefetcher usually means
  // the page is already in the HTTP cache; this adds a second fast path.
  const cached=await cache.match(request,{ignoreSearch:false});
  const networkPromise=fetch(request).then(response=>{
    if(response&&response.ok)cache.put(request,response.clone()).catch(()=>{});
    return response;
  }).catch(()=>null);

  if(cached){
    // Refresh in the background without delaying navigation.
    networkPromise.catch(()=>{});
    return cached;
  }

  const network=await networkPromise;
  if(network)return network;

  // For profile query URLs, fall back to the base profile shell.
  if(new URL(request.url).pathname==='/profile/'){
    const shell=await cache.match('/profile/');
    if(shell)return shell;
  }

  return new Response('Offline',{status:503,headers:{'Content-Type':'text/plain'}});
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
 