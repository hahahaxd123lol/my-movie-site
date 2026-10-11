(()=>{
  'use strict';
  if (window.__f2wHalloweenV6) return;
  window.__f2wHalloweenV6 = true;
  window.__f2wHalloweenV5 = true;
  window.__f2wHalloweenV4 = true;
  window.__f2wHalloweenV3 = true;
  window.__f2wHalloweenV1 = true;

  const STORAGE_KEY = 'f2w_halloween_theme_v1';
  const ROOT = 'f2w-halloween-on';
  const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Creepster&display=swap';

  function reduced() {
    try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  }

  function isOn() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === null) return true;
      return v === '1';
    } catch { return true; }
  }

  function setOn(on) {
    try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch {}
    document.documentElement.classList.toggle(ROOT, !!on);
    const btn = document.getElementById('f2w-halloween-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.title = on ? 'Turn off Halloween mode' : 'Turn on Halloween mode';
      btn.innerHTML = on
        ? '<span class="f2w-hw-ico" aria-hidden="true">🎃</span><span class="f2w-hw-txt">Halloween ON</span>'
        : '<span class="f2w-hw-ico" aria-hidden="true">🎃</span><span class="f2w-hw-txt">Halloween OFF</span>';
    }
  }

  function loadFonts() {
    if (document.getElementById('f2w-hw-fonts')) return;
    const l = document.createElement('link');
    l.id = 'f2w-hw-fonts';
    l.rel = 'stylesheet';
    l.href = FONT_HREF;
    (document.head || document.documentElement).appendChild(l);
  }

  function ensureStyle() {
    if (document.getElementById('f2w-halloween-v6-css')) return;
    const s = document.createElement('style');
    s.id = 'f2w-halloween-v6-css';
    s.textContent = `
/* v6: viewport-fixed control outside transformed app/body wrappers */
html>#f2w-halloween-toggle,#f2w-halloween-toggle{position:fixed!important;left:max(14px,env(safe-area-inset-left))!important;bottom:max(14px,env(safe-area-inset-bottom))!important;top:auto!important;right:auto!important;margin:0!important;transform:none!important;z-index:2147483647!important}
html.f2w-halloween-on,html.f2w-halloween-on body,html.f2w-halloween-on #app,html.f2w-halloween-on #root,html.f2w-halloween-on main,html.f2w-halloween-on .main-content,html.f2w-halloween-on .home-container,html.f2w-halloween-on .page-content,html.f2w-halloween-on .content-wrapper{background:#080503!important;background-image:radial-gradient(ellipse at 50% 0%,rgba(255,92,0,.22),transparent 52%),radial-gradient(ellipse at 0% 70%,rgba(130,25,0,.13),transparent 40%),linear-gradient(180deg,#080503 0%,#160a04 48%,#070506 100%)!important;color:#fff0df!important}
html.f2w-halloween-on header,html.f2w-halloween-on nav,html.f2w-halloween-on .navbar,html.f2w-halloween-on .site-header,html.f2w-halloween-on .sidebar,html.f2w-halloween-on .category-tabs,html.f2w-halloween-on .filter-tabs{background-color:rgba(17,8,4,.97)!important;border-color:rgba(255,111,20,.36)!important}
html.f2w-halloween-on .logo,html.f2w-halloween-on .logo img,html.f2w-halloween-on .logo-image,html.f2w-halloween-on [class*="logo"] img{filter:sepia(1) saturate(6) hue-rotate(345deg) drop-shadow(0 0 12px rgba(255,91,0,.6))!important}
html.f2w-halloween-on h1,html.f2w-halloween-on h2,html.f2w-halloween-on h3,html.f2w-halloween-on .section-title,html.f2w-halloween-on .hero-title{color:#ffb36b!important;font-family:Creepster,cursive!important;text-shadow:0 0 16px rgba(255,91,0,.28)!important}
html.f2w-halloween-on button,html.f2w-halloween-on .btn,html.f2w-halloween-on .tool-btn,html.f2w-halloween-on .active,html.f2w-halloween-on [aria-selected="true"]{--accent:#ff7518!important;border-color:rgba(255,117,24,.45)!important}
html.f2w-halloween-on .movie-card,html.f2w-halloween-on .show-card,html.f2w-halloween-on .recent-card,html.f2w-halloween-on .f2w-cw-card,html.f2w-halloween-on .category-card{border-color:rgba(255,117,24,.22)!important;box-shadow:0 10px 30px rgba(0,0,0,.4),0 0 16px rgba(255,85,0,.07)!important}
html.f2w-halloween-on .progress-fill,html.f2w-halloween-on .f2w-cw-bar>i{background:linear-gradient(90deg,#ff4d00,#ffb52e)!important}
html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-bat{animation:f2wHwBat 22s linear infinite!important}
html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-ghost{animation:f2wHwFloat 7s ease-in-out infinite!important}
html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-pump{animation:f2wHwBob 5.5s ease-in-out infinite!important}
html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-spider{animation:f2wHwSpider 13s ease-in-out infinite!important}
html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-ember{animation:f2wHwFall 9s linear infinite!important}
html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-bat:nth-child(3n){animation-duration:29s!important}
html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-ghost:nth-child(even){animation-delay:-3s!important}

#f2w-halloween-toggle{
  position:fixed!important;left:14px!important;bottom:14px!important;z-index:2147483640!important;
  display:inline-flex!important;align-items:center!important;gap:8px!important;
  height:44px!important;padding:0 16px!important;border-radius:999px!important;
  border:1px solid rgba(255,140,0,.65)!important;
  background:linear-gradient(135deg,rgba(55,18,6,.96),rgba(18,8,28,.97))!important;
  color:#ffd7a8!important;font:800 12px/1 Inter,system-ui,sans-serif!important;
  letter-spacing:.04em!important;cursor:pointer!important;pointer-events:auto!important;
  box-shadow:0 10px 32px rgba(0,0,0,.55),0 0 22px rgba(255,100,0,.28),inset 0 1px 0 rgba(255,200,120,.15)!important;
  transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease,filter .15s ease!important;
  user-select:none!important;
}
#f2w-halloween-toggle:hover{
  border-color:rgba(255,180,50,.95)!important;filter:brightness(1.08)!important;
  box-shadow:0 12px 36px rgba(0,0,0,.6),0 0 30px rgba(255,120,0,.4)!important;
  transform:translateY(-1px)!important;
}
#f2w-halloween-toggle .f2w-hw-ico{font-size:20px!important;line-height:1!important;filter:drop-shadow(0 0 6px rgba(255,140,0,.5))}
#f2w-halloween-toggle .f2w-hw-txt{white-space:nowrap!important}
@media(max-width:520px){
  #f2w-halloween-toggle{left:10px!important;bottom:10px!important;height:40px!important;padding:0 12px!important}
  #f2w-halloween-toggle .f2w-hw-txt{font-size:11px!important}
}

html.f2w-halloween-on,html.f2w-halloween-on body{
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ctext y='24' font-size='22'%3E%F0%9F%8E%83%3C/text%3E%3C/svg%3E") 4 4, auto !important;
}
html.f2w-halloween-on a,html.f2w-halloween-on button,html.f2w-halloween-on [role="button"],
html.f2w-halloween-on .f2w-cw-card,html.f2w-halloween-on .recent-card{
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ctext y='24' font-size='20'%3E%F0%9F%91%BB%3C/text%3E%3C/svg%3E") 4 4, pointer !important;
}
html.f2w-halloween-on input,html.f2w-halloween-on textarea,html.f2w-halloween-on select,
html.f2w-halloween-on iframe,html.f2w-halloween-on video{
  cursor: auto !important;
}

html.f2w-halloween-on body::before{
  content:""!important;position:fixed!important;inset:0!important;
  pointer-events:none!important;z-index:2147482500!important;
  background:
    radial-gradient(ellipse 90% 55% at 50% -8%, rgba(255,90,0,.16), transparent 58%),
    radial-gradient(ellipse 50% 40% at 100% 100%, rgba(110,0,160,.14), transparent 50%),
    radial-gradient(ellipse 45% 35% at 0% 95%, rgba(255,40,0,.10), transparent 48%),
    linear-gradient(180deg, rgba(12,4,18,.12), transparent 30%, rgba(8,2,12,.18) 100%);
  animation:f2wHwSky 10s ease-in-out infinite alternate;
}
html.f2w-halloween-on body::after{
  content:""!important;position:fixed!important;left:0!important;right:0!important;bottom:0!important;
  height:140px!important;pointer-events:none!important;z-index:2147482501!important;
  background:linear-gradient(to top, rgba(10,2,14,.65), rgba(10,2,14,.2), transparent);
}

/* Halloween mode: full orange/ember/black visual skin; functional behaviour untouched. */
html.f2w-halloween-on body{
  --bg-main:#080604!important;--bg-card:rgba(20,11,7,.94)!important;
  --accent:#ff7518!important;--accent-glow:rgba(255,91,0,.42)!important;
  --text-main:#fff4e6!important;--text-muted:#b9a08b!important;
  background-color:#080604!important;
  background-image:radial-gradient(ellipse at 50% 0%,rgba(112,36,0,.24),transparent 55%),linear-gradient(180deg,#090604,#100805 55%,#060405)!important;
}
html.f2w-halloween-on body::selection{background:#ff7518!important;color:#080604!important}
html.f2w-halloween-on header,
html.f2w-halloween-on nav,
html.f2w-halloween-on .telemetry-bar,
html.f2w-halloween-on .dropdown-menu{
  background:rgba(12,7,5,.94)!important;border-color:rgba(255,117,24,.25)!important;
  backdrop-filter:blur(18px)!important;
}
html.f2w-halloween-on button,
html.f2w-halloween-on .tool-btn,
html.f2w-halloween-on .filter-tabs button,
html.f2w-halloween-on .f2w-nav-link{
  border-color:rgba(255,117,24,.35)!important;
}
html.f2w-halloween-on .tool-btn:hover,
html.f2w-halloween-on button:hover,
html.f2w-halloween-on .f2w-nav-link:hover{
  box-shadow:0 0 22px rgba(255,90,0,.24)!important;border-color:#ff7518!important;
}
html.f2w-halloween-on .recent-card,
html.f2w-halloween-on .movie-card,
html.f2w-halloween-on .show-card,
html.f2w-halloween-on .glass-chip,
html.f2w-halloween-on #f2w-continue-watching-section .f2w-cw-poster-shell{
  border-color:rgba(255,117,24,.22)!important;
  box-shadow:0 12px 34px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,180,90,.035)!important;
}
html.f2w-halloween-on .f2w-cw-bar>i,
html.f2w-halloween-on .progress-bar,
html.f2w-halloween-on .progress-fill{
  background:linear-gradient(90deg,#ff4d00,#ffb000)!important;
}
html.f2w-halloween-on h1,html.f2w-halloween-on h2,html.f2w-halloween-on h3,
html.f2w-halloween-on .logo,html.f2w-halloween-on .section-title{
  text-shadow:0 0 24px rgba(255,87,0,.16);
}
html.f2w-halloween-on input,html.f2w-halloween-on select,html.f2w-halloween-on textarea{
  background-color:#120b08!important;border-color:rgba(255,117,24,.3)!important;color:#fff4e6!important;
}
@media(prefers-reduced-motion:no-preference){
  .f2w-hw-bat{animation-name:f2wHwBatFlight!important;animation-timing-function:ease-in-out!important;animation-iteration-count:infinite!important}
  @keyframes f2wHwBatFlight{
    0%{transform:translate3d(-4vw,0,0) rotate(-8deg)}
    25%{transform:translate3d(5vw,3vh,0) rotate(5deg)}
    50%{transform:translate3d(12vw,-2vh,0) rotate(-4deg)}
    75%{transform:translate3d(4vw,4vh,0) rotate(7deg)}
    100%{transform:translate3d(-4vw,0,0) rotate(-8deg)}
  }
}

html.f2w-halloween-on header{
  box-shadow:0 1px 0 rgba(255,120,0,.22), 0 10px 36px rgba(0,0,0,.35)!important;
}
html.f2w-halloween-on .logo,
html.f2w-halloween-on .logo-image{
  filter:drop-shadow(0 0 10px rgba(255,120,0,.35))!important;
}
html.f2w-halloween-on .section-kicker{
  color:#fb923c!important;
  font-family:Creepster,cursive!important;
  letter-spacing:.08em!important;
  font-size:.85rem!important;
}
html.f2w-halloween-on #f2w-continue-watching-section h2,
html.f2w-halloween-on .recent-section h2,
html.f2w-halloween-on #section-title{
  font-family:Creepster,cursive!important;
  letter-spacing:.03em!important;
  text-shadow:0 0 18px rgba(255,100,0,.3)!important;
}

.f2w-hw-web-logo{
  position:absolute!important;top:-6px!important;left:-8px!important;
  width:72px!important;height:72px!important;pointer-events:none!important;z-index:50!important;
  opacity:0;transition:opacity .35s ease;
}
html.f2w-halloween-on .f2w-hw-web-logo{opacity:.6}
.f2w-hw-web-logo svg,.f2w-hw-web-tl svg,.f2w-hw-web-tr svg{width:100%!important;height:100%!important;display:block!important}

.f2w-hw-web-tl,.f2w-hw-web-tr{
  position:fixed!important;top:0!important;z-index:2147482502!important;
  width:110px!important;height:110px!important;opacity:0;pointer-events:none!important;
  transition:opacity .35s ease;
}
.f2w-hw-web-tl{left:0!important}
.f2w-hw-web-tr{right:0!important;transform:scaleX(-1)}
html.f2w-halloween-on .f2w-hw-web-tl,html.f2w-halloween-on .f2w-hw-web-tr{opacity:.42}

#f2w-halloween-fx{
  position:fixed!important;inset:0!important;overflow:hidden!important;
  pointer-events:none!important;z-index:2147482503!important;
}
html:not(.f2w-halloween-on) #f2w-halloween-fx,
html:not(.f2w-halloween-on) .f2w-hw-web-logo,
html:not(.f2w-halloween-on) .f2w-hw-web-tl,
html:not(.f2w-halloween-on) .f2w-hw-web-tr{display:none!important}

.f2w-hw-bat,.f2w-hw-ghost,.f2w-hw-pump,.f2w-hw-spider{
  position:absolute!important;pointer-events:none!important;will-change:transform;
  filter:drop-shadow(0 0 8px rgba(255,100,0,.35));user-select:none!important;
}
.f2w-hw-bat{font-size:18px;opacity:.65;animation:f2wHwBat linear infinite}
.f2w-hw-ghost{font-size:22px;opacity:.45;animation:f2wHwFloat ease-in-out infinite}
.f2w-hw-pump{font-size:16px;opacity:.4;animation:f2wHwBob ease-in-out infinite}
.f2w-hw-spider{font-size:16px;opacity:.7;animation:f2wHwSpider 12s ease-in-out infinite}
.f2w-hw-ember{
  position:absolute!important;width:4px!important;height:4px!important;border-radius:50%!important;
  background:radial-gradient(circle,#ffb347,#ff4d00);opacity:.55;
  animation:f2wHwFall linear infinite;pointer-events:none!important;
  box-shadow:0 0 6px rgba(255,100,0,.6);
}
.f2w-hw-strand{
  position:absolute!important;top:100%!important;width:1px!important;
  background:linear-gradient(to bottom, rgba(255,220,180,.5), transparent)!important;
  pointer-events:none!important;opacity:0;transform-origin:top center;
  animation:f2wHwSway ease-in-out infinite;
}
html.f2w-halloween-on .f2w-hw-strand{opacity:.75}

html.f2w-halloween-on iframe[src*="player"],
html.f2w-halloween-on #player-iframe,
html.f2w-halloween-on .player-frame{
  pointer-events:auto!important;position:relative!important;z-index:5!important;
}

/* v5: site-wide Halloween art direction (presentation only). */
html.f2w-halloween-on body,html.f2w-halloween-on #app,html.f2w-halloween-on main,
html.f2w-halloween-on .main-content,html.f2w-halloween-on .home-container{
  background-color:#090604!important;
  background-image:radial-gradient(ellipse at 50% -10%,rgba(255,94,0,.25),transparent 48%),radial-gradient(ellipse at 0% 45%,rgba(120,35,0,.13),transparent 38%),linear-gradient(180deg,#090604 0%,#130904 48%,#070506 100%)!important;
  color:#fff1df!important;
}
html.f2w-halloween-on header,html.f2w-halloween-on .site-header,
html.f2w-halloween-on .navbar,html.f2w-halloween-on .f2w-primary-nav{
  background:linear-gradient(100deg,rgba(16,7,4,.98),rgba(35,13,4,.96),rgba(12,5,10,.98))!important;
  border-color:rgba(255,112,20,.38)!important;
}
html.f2w-halloween-on .logo,html.f2w-halloween-on .logo-image,
html.f2w-halloween-on header .logo,html.f2w-halloween-on header .logo img{
  color:#ff7918!important;filter:sepia(1) saturate(5) hue-rotate(345deg) drop-shadow(0 0 12px rgba(255,91,0,.5))!important;
}
html.f2w-halloween-on h1,html.f2w-halloween-on h2,html.f2w-halloween-on h3,
html.f2w-halloween-on .section-title,html.f2w-halloween-on .hero-title{
  color:#fff0dc!important;text-shadow:0 0 18px rgba(255,105,0,.24)!important;
}
html.f2w-halloween-on .movie-card,html.f2w-halloween-on .show-card,
html.f2w-halloween-on .recent-card,html.f2w-halloween-on .f2w-cw-card,
html.f2w-halloween-on .glass-chip,html.f2w-halloween-on .category-card{
  outline:1px solid rgba(255,115,20,.16)!important;box-shadow:0 12px 34px rgba(0,0,0,.42),0 0 18px rgba(255,80,0,.055)!important;
}
html.f2w-halloween-on a:hover,html.f2w-halloween-on .f2w-nav-link:hover{
  color:#ff9b42!important;text-shadow:0 0 12px rgba(255,110,0,.3)!important;
}
html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-bat{filter:drop-shadow(0 0 10px rgba(255,110,0,.55))!important}

/* v4 hardening: viewport-pinned switch, unmistakable theme, guaranteed motion */
#f2w-halloween-toggle{
  position:fixed!important;left:14px!important;bottom:14px!important;top:auto!important;
  right:auto!important;transform:none!important;z-index:2147483647!important;
}
body>#f2w-halloween-toggle{position:fixed!important}
html.f2w-halloween-on body{
  --bg-main:#090604!important;--bg-card:#160d08!important;--accent:#ff7518!important;
  --accent-glow:rgba(255,100,0,.45)!important;--text-main:#fff1df!important;
  --text-muted:#c2a58d!important;background-color:#090604!important;
  background-image:radial-gradient(ellipse at 50% 0%,rgba(255,83,0,.24),transparent 54%),linear-gradient(180deg,#090604 0%,#100805 60%,#050405 100%)!important;
  color:#fff1df!important;
}
html.f2w-halloween-on header,html.f2w-halloween-on nav,
html.f2w-halloween-on .filter-tabs,html.f2w-halloween-on .dropdown-menu{
  background-color:rgba(13,7,4,.96)!important;border-color:rgba(255,117,24,.35)!important;
}
html.f2w-halloween-on button,html.f2w-halloween-on .tool-btn,
html.f2w-halloween-on .f2w-nav-link{
  --accent:#ff7518!important;border-color:rgba(255,117,24,.4)!important;
}
html.f2w-halloween-on .f2w-cw-bar>i,html.f2w-halloween-on .progress-fill{
  background:linear-gradient(90deg,#ff4d00,#ffb52e)!important;
}
html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-bat{
  animation:f2wHwBat 19s linear infinite!important;will-change:transform!important;
}
html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-ghost{
  animation:f2wHwFloat 6s ease-in-out infinite!important;will-change:transform!important;
}
html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-pump{
  animation:f2wHwBob 4.8s ease-in-out infinite!important;will-change:transform!important;
}
html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-spider{
  animation:f2wHwSpider 12s ease-in-out infinite!important;will-change:transform!important;
}
html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-ember{
  animation:f2wHwFall 9s linear infinite!important;will-change:transform!important;
}

@keyframes f2wHwSky{from{opacity:.85}to{opacity:1}}
@keyframes f2wHwBat{
  0%{transform:translate(0,0) rotate(0) scale(1)}
  25%{transform:translate(35vw,-14vh) rotate(14deg) scale(1.05)}
  50%{transform:translate(72vw,6vh) rotate(-10deg) scale(.95)}
  75%{transform:translate(28vw,16vh) rotate(8deg) scale(1.08)}
  100%{transform:translate(0,0) rotate(0) scale(1)}
}
@keyframes f2wHwFloat{
  0%,100%{transform:translateY(0) translateX(0)}
  50%{transform:translateY(-22px) translateX(8px)}
}
@keyframes f2wHwBob{
  0%,100%{transform:translateY(0) rotate(-4deg)}
  50%{transform:translateY(-10px) rotate(4deg)}
}
@keyframes f2wHwSpider{
  0%{transform:translateY(-10px)}
  40%{transform:translateY(70px)}
  60%{transform:translateY(70px)}
  100%{transform:translateY(-10px)}
}
@keyframes f2wHwFall{
  0%{transform:translateY(-10vh) translateX(0);opacity:0}
  10%{opacity:.7}
  100%{transform:translateY(110vh) translateX(40px);opacity:0}
}
@keyframes f2wHwSway{
  0%,100%{transform:rotate(-3deg)}
  50%{transform:rotate(3deg)}
}
@media(prefers-reduced-motion:reduce){
  html.f2w-halloween-on body::before{animation:none!important}
  html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-bat{animation:f2wHwBat 24s linear infinite!important}
  html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-ghost{animation:f2wHwFloat 8s ease-in-out infinite!important}
  html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-pump{animation:f2wHwBob 7s ease-in-out infinite!important}
  html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-spider{animation:f2wHwSpider 16s ease-in-out infinite!important}
  html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-ember{animation:f2wHwFall 12s linear infinite!important}
  .f2w-hw-strand{animation:f2wHwSway 6s ease-in-out infinite!important}
}
/* v6 final override layer — must remain last to beat legacy Halloween CSS */
html>#f2w-halloween-toggle,#f2w-halloween-toggle{position:fixed!important;left:14px!important;bottom:14px!important;top:auto!important;right:auto!important;margin:0!important;transform:none!important;z-index:2147483647!important}
html.f2w-halloween-on body,html.f2w-halloween-on #app,html.f2w-halloween-on #root,html.f2w-halloween-on main,html.f2w-halloween-on .main-content,html.f2w-halloween-on .home-container,html.f2w-halloween-on .page-content,html.f2w-halloween-on .content-wrapper{background:#080503!important;background-image:radial-gradient(ellipse at 50% 0%,rgba(255,92,0,.25),transparent 52%),linear-gradient(180deg,#080503 0%,#160a04 48%,#070506 100%)!important;color:#fff0df!important}
html.f2w-halloween-on header,html.f2w-halloween-on nav,html.f2w-halloween-on .navbar,html.f2w-halloween-on .site-header{background:linear-gradient(100deg,#100704,#230d04,#0c050a)!important;border-color:rgba(255,111,20,.4)!important}
html.f2w-halloween-on .logo,html.f2w-halloween-on .logo img,html.f2w-halloween-on .logo-image,html.f2w-halloween-on [class*="logo"] img{filter:sepia(1) saturate(7) hue-rotate(345deg) drop-shadow(0 0 12px rgba(255,91,0,.65))!important}
html.f2w-halloween-on h1,html.f2w-halloween-on h2,html.f2w-halloween-on h3,html.f2w-halloween-on .section-title,html.f2w-halloween-on .hero-title{color:#ffb36b!important;font-family:Creepster,cursive!important;text-shadow:0 0 16px rgba(255,91,0,.3)!important}
html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-bat{animation:f2wHwBat 22s linear infinite!important}
html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-ghost{animation:f2wHwFloat 7s ease-in-out infinite!important}
html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-pump{animation:f2wHwBob 5.5s ease-in-out infinite!important}
html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-spider{animation:f2wHwSpider 13s ease-in-out infinite!important}
html.f2w-halloween-on #f2w-halloween-fx .f2w-hw-ember{animation:f2wHwFall 9s linear infinite!important}

`;
    (document.head || document.documentElement).appendChild(s);
  }

  const WEB_SVG = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2 2 L98 2 M2 2 L2 98 M2 2 L70 70 M2 2 L40 90 M2 2 L90 40" stroke="rgba(255,220,180,0.55)" stroke-width="1" fill="none"/><path d="M2 18 Q30 30 50 18 Q70 8 98 18" stroke="rgba(255,220,180,0.4)" stroke-width="0.8" fill="none"/><path d="M2 36 Q28 50 52 38 Q74 26 98 36" stroke="rgba(255,220,180,0.35)" stroke-width="0.8" fill="none"/><path d="M2 54 Q26 70 50 56 Q72 44 98 54" stroke="rgba(255,220,180,0.3)" stroke-width="0.8" fill="none"/><path d="M18 2 Q28 30 18 55 Q10 78 18 98" stroke="rgba(255,220,180,0.35)" stroke-width="0.8" fill="none"/><path d="M40 2 Q52 32 42 60 Q34 82 40 98" stroke="rgba(255,220,180,0.3)" stroke-width="0.8" fill="none"/><circle cx="2" cy="2" r="2" fill="rgba(255,220,180,0.5)"/></svg>';

  function ensureWebs() {
    if (!document.querySelector('.f2w-hw-web-tl')) {
      const tl = document.createElement('div');
      tl.className = 'f2w-hw-web-tl';
      tl.innerHTML = WEB_SVG;
      tl.setAttribute('aria-hidden', 'true');
      document.body.appendChild(tl);
    }
    if (!document.querySelector('.f2w-hw-web-tr')) {
      const tr = document.createElement('div');
      tr.className = 'f2w-hw-web-tr';
      tr.innerHTML = WEB_SVG;
      tr.setAttribute('aria-hidden', 'true');
      document.body.appendChild(tr);
    }

    const logo = document.querySelector('header .logo') || document.querySelector('header a.logo') || document.querySelector('.logo');
    if (logo) {
      const cs = getComputedStyle(logo);
      if (cs.position === 'static') logo.style.position = 'relative';
      if (!logo.querySelector('.f2w-hw-web-logo')) {
        const w = document.createElement('div');
        w.className = 'f2w-hw-web-logo';
        w.innerHTML = WEB_SVG;
        w.setAttribute('aria-hidden', 'true');
        logo.appendChild(w);
      }
      if (!logo.querySelector('.f2w-hw-strand')) {
        for (let i = 0; i < 3; i++) {
          const st = document.createElement('div');
          st.className = 'f2w-hw-strand';
          st.style.left = (20 + i * 28) + '%';
          st.style.height = (18 + i * 10) + 'px';
          st.style.animationDuration = (3 + i * 0.7) + 's';
          st.style.animationDelay = (-i) + 's';
          logo.appendChild(st);
        }
      }
    }
  }

  function ensureFx() {
    let layer = document.getElementById('f2w-halloween-fx');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'f2w-halloween-fx';
      layer.setAttribute('aria-hidden', 'true');
      document.body.appendChild(layer);
    }
    if (layer.childElementCount > 0) return;

    if (reduced()) {
      for (let i = 0; i < 3; i++) {
        const p = document.createElement('span');
        p.className = 'f2w-hw-pump';
        p.textContent = '🎃';
        p.style.left = (15 + i * 30) + '%';
        p.style.top = (70 + i * 5) + '%';
        p.style.animation = 'f2wHwBob 5s ease-in-out infinite';
        layer.appendChild(p);
      }
      return;
    }

    for (let i = 0; i < 7; i++) {
      const b = document.createElement('span');
      b.className = 'f2w-hw-bat';
      b.textContent = '🦇';
      b.style.left = (4 + i * 13) + '%';
      b.style.top = (6 + (i % 4) * 16) + '%';
      b.style.animationDuration = (16 + i * 2.2) + 's';
      b.style.animationDelay = (-i * 1.8) + 's';
      b.style.fontSize = (14 + (i % 4) * 4) + 'px';
      layer.appendChild(b);
    }
    for (let i = 0; i < 4; i++) {
      const g = document.createElement('span');
      g.className = 'f2w-hw-ghost';
      g.textContent = '👻';
      g.style.left = (12 + i * 22) + '%';
      g.style.top = (50 + i * 7) + '%';
      g.style.animationDuration = (5.5 + i * 1.2) + 's';
      g.style.animationDelay = (-i * 0.8) + 's';
      layer.appendChild(g);
    }
    for (let i = 0; i < 5; i++) {
      const p = document.createElement('span');
      p.className = 'f2w-hw-pump';
      p.textContent = '🎃';
      p.style.left = (8 + i * 18) + '%';
      p.style.bottom = (4 + (i % 3) * 6) + '%';
      p.style.top = 'auto';
      p.style.animationDuration = (4 + i * 0.6) + 's';
      p.style.animationDelay = (-i) + 's';
      layer.appendChild(p);
    }
    for (let i = 0; i < 2; i++) {
      const sp = document.createElement('span');
      sp.className = 'f2w-hw-spider';
      sp.textContent = '🕷️';
      sp.style.left = (20 + i * 55) + '%';
      sp.style.top = (0 + i * 8) + '%';
      sp.style.animationDelay = (-i * 4) + 's';
      layer.appendChild(sp);
    }
    for (let i = 0; i < 18; i++) {
      const e = document.createElement('span');
      e.className = 'f2w-hw-ember';
      e.style.left = (Math.random() * 100) + '%';
      e.style.animationDuration = (7 + Math.random() * 10) + 's';
      e.style.animationDelay = (-Math.random() * 12) + 's';
      e.style.width = e.style.height = (2 + Math.random() * 4) + 'px';
      layer.appendChild(e);
    }
  }

  function ensureToggle() {
    let btn = document.getElementById('f2w-halloween-toggle');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'f2w-halloween-toggle';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setOn(!document.documentElement.classList.contains(ROOT));
      });
      (document.documentElement || document.body).appendChild(btn);
    }
    if (document.documentElement && btn.parentElement !== document.documentElement) document.documentElement.appendChild(btn);
    btn.style.setProperty('position','fixed','important');
    btn.style.setProperty('left','14px','important');
    btn.style.setProperty('bottom','14px','important');
    btn.style.setProperty('top','auto','important');
    btn.style.setProperty('right','auto','important');
    btn.style.setProperty('z-index','2147483647','important');
    setOn(isOn());
  }

  function boot() {
    loadFonts();
    ensureStyle();
    ensureWebs();
    ensureFx();
    ensureToggle();
    setOn(isOn());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Avoid a MutationObserver feedback loop: ensureToggle() updates button DOM,
  // so only rebuild it when it is missing or has been reparented by the app.
  const mo = new MutationObserver(() => {
    const toggle = document.getElementById('f2w-halloween-toggle');
    if (!toggle || (document.documentElement && toggle.parentElement !== document.documentElement)) ensureToggle();
    if (!document.getElementById('f2w-halloween-fx') && document.body) ensureFx();
    if ((!document.querySelector('.f2w-hw-web-tl') || !document.querySelector('.f2w-hw-web-tr')) && document.body) ensureWebs();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  let tries = 0;
  const t = setInterval(() => {
    ensureWebs();
    ensureToggle();
    ensureFx();
    if (++tries > 120) clearInterval(t);
  }, 350);

  console.info('[f2w] Halloween v6 active');
})();
