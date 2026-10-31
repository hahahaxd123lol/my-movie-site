(() => {
  'use strict';
  if (window.__f2wChristmasV2) return;
  window.__f2wChristmasV2 = true;
  const ROOT='f2w-christmas-on', LAYER='f2w-christmas-v2-decor', PREF='f2w_christmas_theme_v1';
  let enabled=true, layer=null, observer=null, pending=0;

  function installStyles(){
    if(document.getElementById('f2w-christmas-v2-css'))return;
    const s=document.createElement('style');s.id='f2w-christmas-v2-css';
    s.textContent=[
      'html.f2w-christmas-on{--xmas-pine:#174b34;--xmas-forest:#07180f;--xmas-red:#a92336;--xmas-gold:#e8ca82}',
      'html.f2w-christmas-on body{background-color:#07180f!important;background-image:radial-gradient(ellipse at 10% 0%,rgba(24,104,66,.3),transparent 42%),radial-gradient(ellipse at 92% 18%,rgba(153,31,51,.16),transparent 38%),radial-gradient(ellipse at 50% 100%,rgba(214,187,126,.09),transparent 54%)!important;color:#edf5ef}',
      'html.f2w-christmas-on header,html.f2w-christmas-on nav,html.f2w-christmas-on .navbar,html.f2w-christmas-on .site-header,html.f2w-christmas-on .sidebar,html.f2w-christmas-on .category-tabs,html.f2w-christmas-on .filter-tabs{border-color:rgba(222,194,126,.3)!important}',
      'html.f2w-christmas-on h1,html.f2w-christmas-on h2,html.f2w-christmas-on h3,html.f2w-christmas-on .section-title,html.f2w-christmas-on .hero-title{color:#f0dba8!important;text-shadow:0 2px 18px rgba(218,185,113,.17)!important}',
      'html.f2w-christmas-on a:hover,html.f2w-christmas-on .f2w-nav-link:hover{color:#efd18a!important}',
      'html.f2w-christmas-on .movie-card,html.f2w-christmas-on .show-card,html.f2w-christmas-on .recent-card,html.f2w-christmas-on .f2w-cw-card,html.f2w-christmas-on .category-card,html.f2w-christmas-on .card{border-color:rgba(199,177,125,.3)!important;box-shadow:0 12px 34px rgba(0,0,0,.28),0 0 20px rgba(21,91,58,.15)!important}',
      'html.f2w-christmas-on .progress-fill,html.f2w-christmas-on .f2w-cw-bar>i,html.f2w-christmas-on .progress-bar>i{background:linear-gradient(90deg,#9d2637,#e8ca82,#287b4f)!important}',
      'html.f2w-christmas-on input:focus,html.f2w-christmas-on textarea:focus,html.f2w-christmas-on select:focus{border-color:#d6b96f!important;box-shadow:0 0 0 3px rgba(214,185,111,.16)!important}',
      '#f2w-christmas-v2-decor{position:fixed;inset:0;z-index:99990;pointer-events:none;overflow:hidden;contain:layout paint}',
      '#f2w-christmas-v2-decor .xmas-snowfall{position:absolute;inset:0;overflow:hidden}',
      '#f2w-christmas-v2-decor .xmas-flake{position:absolute;top:-12vh;left:var(--x);color:#fff;text-shadow:0 0 5px rgba(255,255,255,.9),0 0 14px rgba(202,229,255,.8);font-family:Arial,sans-serif;line-height:1;opacity:var(--alpha);font-size:var(--size);animation:xmasSnowFall var(--duration) linear var(--delay) infinite;will-change:transform}',
      '@keyframes xmasSnowFall{0%{transform:translate3d(0,-12vh,0) rotate(0)}25%{transform:translate3d(calc(var(--drift)*.45),20vh,0) rotate(100deg)}55%{transform:translate3d(var(--drift),59vh,0) rotate(230deg)}100%{transform:translate3d(calc(var(--drift)*-.35),116vh,0) rotate(390deg)}}',
      '#f2w-christmas-v2-decor .xmas-sleigh-flight{position:absolute;top:clamp(54px,8vh,102px);left:0;white-space:nowrap;font-size:clamp(27px,4.2vw,52px);line-height:1;filter:drop-shadow(0 3px 12px rgba(235,205,140,.62));animation:xmasSleighFlight 25s linear infinite;will-change:transform}',
      '#f2w-christmas-v2-decor .xmas-sleigh-flight .trail{font-size:.52em;color:#f4d990;letter-spacing:.15em;vertical-align:middle}',
      '#f2w-christmas-v2-decor .xmas-sleigh-flight .sleigh{display:inline-block;margin-left:14px;filter:drop-shadow(0 0 10px rgba(206,46,60,.8))}',
      '@keyframes xmasSleighFlight{0%{transform:translate3d(-115vw,0,0)}100%{transform:translate3d(115vw,0,0)}}',
      '#f2w-christmas-v2-decor .xmas-garland{position:absolute;top:0;left:-1%;right:-1%;height:42px;overflow:hidden}',
      '#f2w-christmas-v2-decor .xmas-garland:before{content:"";position:absolute;left:-1%;right:-1%;top:-19px;height:48px;border-bottom:4px solid #1c633f;border-radius:0 0 50% 50%;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))}',
      '#f2w-christmas-v2-decor .xmas-bulb{position:absolute;top:18px;width:9px;height:13px;border-radius:50%;background:#f1d178;color:#f1d178;box-shadow:0 0 7px 2px currentColor,0 0 17px currentColor;animation:xmasLightGlow 1.7s ease-in-out infinite alternate}',
      '#f2w-christmas-v2-decor .xmas-bulb:nth-child(4n+1){background:#ff5b65;color:#ff5b65;animation-delay:.2s}',
      '#f2w-christmas-v2-decor .xmas-bulb:nth-child(4n+2){background:#f4d77f;color:#f4d77f;animation-delay:.65s}',
      '#f2w-christmas-v2-decor .xmas-bulb:nth-child(4n+3){background:#66dc9a;color:#66dc9a;animation-delay:1s}',
      '#f2w-christmas-v2-decor .xmas-bulb:nth-child(4n){background:#d6edff;color:#d6edff;animation-delay:1.3s}',
      '@keyframes xmasLightGlow{from{opacity:.5;filter:brightness(.85)}to{opacity:1;filter:brightness(1.65)}}',
      'html.f2w-christmas-on header a.logo,html.f2w-christmas-on a.logo{position:relative!important;isolation:isolate!important;overflow:visible!important;filter:drop-shadow(0 3px 10px rgba(202,177,111,.3))}',
      '.f2w-xmas-logo-decoration{position:absolute!important;inset:-12px -17px!important;z-index:5!important;pointer-events:none!important;display:block!important}',
      '.f2w-xmas-logo-decoration:before{content:"";position:absolute;inset:7px 4px;border:3px solid rgba(28,112,65,.92);border-radius:50%;box-shadow:inset 0 0 0 2px rgba(218,190,119,.48),0 0 12px rgba(45,137,80,.35)}',
      '.f2w-xmas-logo-decoration:after{content:"🎅";position:absolute;top:-8px;right:0;font-size:24px;line-height:1;transform:rotate(12deg);filter:drop-shadow(0 2px 4px rgba(0,0,0,.7))}',
      '.f2w-xmas-logo-decoration .holly{position:absolute;bottom:-4px;right:1px;font-size:18px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.7))}',
      '.f2w-xmas-logo-decoration .berry{position:absolute;width:7px;height:7px;border-radius:50%;background:#d93443;box-shadow:0 0 7px #d93443}',
      '.f2w-xmas-logo-decoration .berry.one{left:4px;top:18px}.f2w-xmas-logo-decoration .berry.two{left:12px;top:8px}.f2w-xmas-logo-decoration .berry.three{right:16px;bottom:4px}',
      '#f2w-christmas-v2-decor .xmas-bottom{position:absolute;left:0;right:0;bottom:0;height:clamp(72px,13vh,145px)}',
      '#f2w-christmas-v2-decor .snowbank{position:absolute;bottom:-25px;background:linear-gradient(180deg,#fff 0%,#eef7fc 44%,#cbdce8 100%);filter:drop-shadow(0 -3px 9px rgba(210,234,249,.45))}',
      '#f2w-christmas-v2-decor .snowbank.back{left:-5%;width:110%;height:82px;border-radius:50% 50% 0 0/48% 48% 0 0;bottom:-39px;opacity:.95}',
      '#f2w-christmas-v2-decor .snowbank.mid{left:18%;width:53%;height:72px;border-radius:50% 50% 0 0/75% 75% 0 0;bottom:-43px;background:linear-gradient(180deg,#fff,#e0edf5)}',
      '#f2w-christmas-v2-decor .snowbank.front{left:-7%;width:114%;height:54px;border-radius:48% 52% 0 0/68% 65% 0 0;bottom:-30px;background:linear-gradient(180deg,#fff,#d6e4ee)}',
      '#f2w-christmas-v2-decor .snowbank.left-mound{left:-40px;bottom:8px;width:230px;height:74px;border-radius:50% 50% 25% 15%;background:radial-gradient(ellipse at 62% 24%,#fff 0 20%,#e5f1f8 62%,#c9dce8 100%)}',
      '#f2w-christmas-v2-decor .snowbank.right-mound{right:-36px;bottom:4px;width:280px;height:92px;border-radius:55% 45% 15% 20%;background:radial-gradient(ellipse at 35% 20%,#fff 0 18%,#e7f1f7 63%,#c8dbe7 100%)}',
      '#f2w-christmas-v2-decor .snow-sparkle{position:absolute;bottom:40px;color:#fff;text-shadow:0 0 8px #fff,0 0 18px #d2ecff;font-size:18px;animation:xmasSparkle 2.2s ease-in-out infinite alternate}',
      '@keyframes xmasSparkle{from{opacity:.3;transform:scale(.75)}to{opacity:1;transform:scale(1.2)}}',
      '#f2w-christmas-v2-decor .xmas-tree{position:absolute;bottom:42px;font-size:clamp(43px,6vw,76px);filter:drop-shadow(0 4px 7px rgba(0,0,0,.35))}',
      '#f2w-christmas-v2-decor .xmas-tree.left{left:1.2%}#f2w-christmas-v2-decor .xmas-tree.right{right:1.5%;font-size:clamp(50px,7vw,88px)}',
      '#f2w-christmas-v2-decor .xmas-gifts{position:absolute;bottom:24px;left:clamp(88px,14vw,210px);font-size:clamp(20px,3vw,34px);filter:drop-shadow(0 2px 5px rgba(0,0,0,.35))}',
      '#f2w-christmas-v2-decor .xmas-snowman{position:absolute;bottom:38px;right:clamp(105px,15vw,220px);font-size:clamp(29px,4vw,46px);filter:drop-shadow(0 3px 6px rgba(0,0,0,.25))}',
      '#f2w-christmas-toggle-v2{position:fixed!important;right:max(15px,env(safe-area-inset-right))!important;bottom:max(15px,env(safe-area-inset-bottom))!important;left:auto!important;top:auto!important;z-index:100002!important;display:flex!important;align-items:center!important;gap:8px!important;padding:11px 15px!important;border:1px solid rgba(235,207,139,.72)!important;border-radius:999px!important;background:linear-gradient(135deg,rgba(8,53,32,.98),rgba(131,27,45,.98))!important;color:#fff0cb!important;font:900 12px/1.1 system-ui,sans-serif!important;letter-spacing:.04em!important;box-shadow:0 7px 24px rgba(0,0,0,.42),0 0 18px rgba(227,192,111,.23)!important;cursor:pointer!important;backdrop-filter:blur(12px)!important;pointer-events:auto!important}',
      '#f2w-christmas-toggle-v2 .xmas-toggle-icon{font-size:19px;line-height:1}',
      '#f2w-christmas-toggle-v2:hover{filter:brightness(1.15)!important;transform:translateY(-2px)!important}',
      '@media(max-width:640px){#f2w-christmas-v2-decor .xmas-sleigh-flight{top:78px;font-size:28px}#f2w-christmas-v2-decor .xmas-tree.left{left:-9px}#f2w-christmas-v2-decor .xmas-tree.right{right:-12px}#f2w-christmas-v2-decor .xmas-gifts{left:90px}#f2w-christmas-v2-decor .xmas-snowman{right:95px}#f2w-christmas-v2-decor .xmas-bottom{height:90px}.f2w-xmas-logo-decoration{inset:-8px -10px!important}.f2w-xmas-logo-decoration:after{font-size:20px}}',
      '@media(prefers-reduced-motion:reduce){#f2w-christmas-v2-decor .xmas-sleigh-flight{animation-duration:60s}#f2w-christmas-v2-decor .xmas-bulb{animation-duration:5s}}'
    ].join('\n');
    (document.head||document.documentElement).appendChild(s);
  }

  function decorateLogo(){
    document.querySelectorAll('header a.logo,a.logo').forEach(logo=>{
      if(logo.querySelector('.f2w-xmas-logo-decoration'))return;
      const d=document.createElement('span');d.className='f2w-xmas-logo-decoration';d.setAttribute('aria-hidden','true');
      d.innerHTML='<i class="berry one"></i><i class="berry two"></i><i class="berry three"></i><span class="holly">🌿</span>';
      logo.appendChild(d);
    });
  }

  function makeSnow(snowfall){
    const total=Math.min(190,Math.max(95,Math.round(window.innerWidth/7)));
    const symbols=['❄','✻','❅','·'];
    for(let i=0;i<total;i++){
      const f=document.createElement('span');f.className='xmas-flake';f.textContent=symbols[i%symbols.length];
      f.style.setProperty('--x',(Math.random()*100)+'vw');
      f.style.setProperty('--size',(8+Math.random()*20)+'px');
      f.style.setProperty('--duration',(7+Math.random()*13)+'s');
      f.style.setProperty('--delay',(-Math.random()*20)+'s');
      f.style.setProperty('--drift',(-65+Math.random()*130)+'px');
      f.style.setProperty('--alpha',(.42+Math.random()*.58).toFixed(2));
      snowfall.appendChild(f);
    }
  }

  function createLayer(){
    if(document.getElementById(LAYER)){layer=document.getElementById(LAYER);return}
    layer=document.createElement('div');layer.id=LAYER;layer.setAttribute('aria-hidden','true');
    layer.innerHTML='<div class="xmas-snowfall"></div><div class="xmas-garland"></div><div class="xmas-sleigh-flight"><span class="trail">✦ ✧ ✦</span><span class="reindeer">🦌🦌🦌</span><span class="trail">✦ ✧ ✦</span><span class="sleigh">🛷🎅</span></div><div class="xmas-bottom"><div class="snowbank back"></div><div class="snowbank mid"></div><div class="snowbank front"></div><div class="snowbank left-mound"></div><div class="snowbank right-mound"></div><div class="xmas-tree left">🎄</div><div class="xmas-tree right">🎄</div><div class="xmas-gifts">🎁 🎁</div><div class="xmas-snowman">⛄</div><span class="snow-sparkle" style="left:18%;animation-delay:.3s">✦</span><span class="snow-sparkle" style="left:38%;animation-delay:1s">✧</span><span class="snow-sparkle" style="right:23%;animation-delay:.7s">✦</span></div>';
    (document.body||document.documentElement).appendChild(layer);
    const garland=layer.querySelector('.xmas-garland');
    for(let i=0;i<42;i++){const b=document.createElement('i');b.className='xmas-bulb';b.style.left=(1.5+i*2.38)+'%';garland.appendChild(b)}
    makeSnow(layer.querySelector('.xmas-snowfall'));
  }

  function makeToggle(){
    let b=document.getElementById('f2w-christmas-toggle-v2');
    if(!b){b=document.createElement('button');b.id='f2w-christmas-toggle-v2';b.type='button';b.addEventListener('click',()=>apply(!enabled));(document.body||document.documentElement).appendChild(b)}
    b.innerHTML='<span class="xmas-toggle-icon" aria-hidden="true">🎄</span><span>CHRISTMAS '+(enabled?'ON':'OFF')+'</span>';
    b.setAttribute('aria-pressed',enabled?'true':'false');b.title=enabled?'Turn off Christmas decorations':'Turn on Christmas decorations';
  }

  function apply(on){
    enabled=!!on;try{localStorage.setItem(PREF,enabled?'1':'0')}catch(_){}
    document.documentElement.classList.toggle(ROOT,enabled);
    if(enabled){createLayer();decorateLogo();layer.hidden=false;layer.style.display='block'}
    else if(layer){layer.hidden=true;layer.style.display='none'}
    makeToggle();
  }

  function boot(){
    installStyles();apply((()=>{try{const v=localStorage.getItem(PREF);return v===null?true:v==='1'}catch(_){return true}})());
    if(!observer&&document.body){
      observer=new MutationObserver(()=>{
        if(pending)cancelAnimationFrame(pending);
        pending=requestAnimationFrame(()=>{pending=0;if(enabled){decorateLogo();if(!document.getElementById(LAYER))createLayer()}});
      });
      observer.observe(document.body,{childList:true,subtree:true});
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();