/* Flix2Watch v185 — fresh critical-code service worker */
const CACHE='f2w-v185-auth-hardfix-20260902';
const CORE=[
  '/home/','/profile/index.html','/chat/','/watch/','/leaderboard/',
  '/v174-viewport-popups.js','/v176-sitewide.js','/final-v35.js',
  '/page-transitions-v135.css','/page-transitions-v135.js',
  '/v177-watch-realtime.js','/v177-profile-playback.js'
];
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.all(CORE.map(async path=>{try{const r=await fetch(path,{cache:'reload'});if(r.ok)await cache.put(path,r.clone())}catch{}}));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('f2w-v')&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
async function networkFirst(request){
  const cache=await caches.open(CACHE);
  try{
    const fresh=await fetch(request,{cache:'no-cache'});
    if(fresh&&fresh.ok)cache.put(request,fresh.clone()).catch(()=>{});
    return fresh;
  }catch{
    return (await cache.match(request,{ignoreSearch:false})) || (await cache.match(new URL(request.url).pathname));
  }
}
async function imageSWR(request){
  const cache=await caches.open(CACHE),cached=await cache.match(request,{ignoreSearch:false});
  const fresh=fetch(request).then(r=>{if(r&&r.ok)cache.put(request,r.clone()).catch(()=>{});return r}).catch(()=>null);
  return cached||fresh;
}
async function navigation(request){
  const cache=await caches.open(CACHE),u=new URL(request.url),path=u.pathname;
  if(/^\/profile\/@[A-Za-z0-9]+\/?$/.test(path)){
    try{const r=await fetch('/profile/index.html',{cache:'no-store'});if(r.ok){cache.put('/profile/index.html',r.clone()).catch(()=>{});return r}}catch{}
    return (await cache.match('/profile/index.html')) || fetch('/profile/index.html',{cache:'reload'});
  }
  try{
    const r=await fetch(request,{cache:'no-cache'});if(r&&r.ok){cache.put(request,r.clone()).catch(()=>{});return r}
  }catch{}
  return (await cache.match(request,{ignoreSearch:false})) || (await cache.match('/home/')) || fetch('/home/index.html',{cache:'reload'});
}
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const u=new URL(request.url);if(u.origin!==self.location.origin)return;
  if(request.mode==='navigate'){event.respondWith(navigation(request));return}
  if(/\.(?:js|css)$/i.test(u.pathname)){event.respondWith(networkFirst(request));return}
  if(/\.(?:png|jpe?g|webp|svg|ico|woff2?)$/i.test(u.pathname)){event.respondWith(imageSWR(request));return}
});
// f2w-force-save:v185-auth-hardfix-service-worker:20260902
