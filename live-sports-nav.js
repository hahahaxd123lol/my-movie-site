(function(){
  'use strict';
  function ensureStyle(){
    if(document.getElementById('f2w-live-sports-nav-global-style'))return;
    const s=document.createElement('style');
    s.id='f2w-live-sports-nav-global-style';
    s.textContent='.f2w-live-sports-link{gap:6px!important}.f2w-live-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 6px;border-radius:999px;background:rgba(229,9,20,.16);border:1px solid rgba(255,44,55,.65);color:#ff4652;font-size:.49rem;font-weight:900;letter-spacing:.08em;line-height:1;text-transform:uppercase;box-shadow:0 0 0 rgba(229,9,20,.45);animation:f2wLivePulse 1.35s ease-in-out infinite}.f2w-live-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff2636;box-shadow:0 0 8px #ff2636;animation:f2wLiveDot 1.05s ease-in-out infinite}@keyframes f2wLivePulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(229,9,20,.34)}50%{transform:scale(1.05);box-shadow:0 0 0 5px rgba(229,9,20,0)}}@keyframes f2wLiveDot{0%,100%{opacity:.55;transform:scale(.78)}50%{opacity:1;transform:scale(1.2)}}@media(prefers-reduced-motion:reduce){.f2w-live-badge,.f2w-live-dot{animation:none!important}}';
    document.head.appendChild(s);
  }
  function paint(){
    ensureStyle();
    document.querySelectorAll('.f2w-primary-nav').forEach(function(nav){
      if(nav.querySelector('[data-f2w-live-sports]'))return;
      const a=document.createElement('a');
      a.className='f2w-nav-link f2w-live-sports-link';
      a.href='/live/';
      a.setAttribute('data-f2w-live-sports','1');
      a.innerHTML='<span class="f2w-live-badge"><span class="f2w-live-dot"></span>LIVE</span><span>Live Sports</span>';
      if(location.pathname.indexOf('/live')===0)a.classList.add('active');
      const genres=Array.prototype.slice.call(nav.querySelectorAll('a,button')).find(function(el){return /^(genres)$/i.test(String(el.textContent||'').trim())});
      if(genres)nav.insertBefore(a,genres);else nav.appendChild(a);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',paint,{once:true});else paint();
  new MutationObserver(function(){paint()}).observe(document.documentElement,{childList:true,subtree:true});
})();
