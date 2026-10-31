(() => {
  'use strict';
  if (window.__f2wChristmasV1) return;
  window.__f2wChristmasV1 = true;

  const ROOT = 'f2w-christmas-on';
  const STORAGE_KEY = 'f2w_christmas_theme_v1';
  const STYLE_ID = 'f2w-christmas-v1-css';
  const CANVAS_ID = 'f2w-christmas-snow';
  let enabled = true;
  let canvas = null;
  let ctx = null;
  let flakes = [];
  let raf = 0;
  let width = 0;
  let height = 0;
  let dpr = 1;

  const reducedMotion = () => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (_) { return false; }
  };

  function readPreference() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === null ? true : value === '1';
    } catch (_) { return true; }
  }

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      'html.f2w-christmas-on{--f2w-xmas-green:#164b35;--f2w-xmas-deep:#071710;--f2w-xmas-red:#9d2635;--f2w-xmas-gold:#e5c477;--f2w-xmas-ice:#eaf6f3;color-scheme:dark}',
      'html.f2w-christmas-on body{background-color:#071710!important;background-image:radial-gradient(ellipse at 8% 0%,rgba(32,104,71,.24),transparent 42%),radial-gradient(ellipse at 95% 22%,rgba(145,34,49,.12),transparent 38%),radial-gradient(ellipse at 50% 100%,rgba(197,161,89,.08),transparent 55%)!important;color:#eaf2ec}',
      'html.f2w-christmas-on header,html.f2w-christmas-on nav,html.f2w-christmas-on .navbar,html.f2w-christmas-on .site-header,html.f2w-christmas-on .sidebar,html.f2w-christmas-on .category-tabs{background-color:rgba(5,25,17,.94)!important;border-color:rgba(210,185,119,.24)!important}',
      'html.f2w-christmas-on h1,html.f2w-christmas-on h2,html.f2w-christmas-on h3,html.f2w-christmas-on .section-title,html.f2w-christmas-on .hero-title{color:#f0dba8!important;text-shadow:0 2px 16px rgba(215,184,115,.15)!important;font-family:Georgia,"Times New Roman",serif!important}',
      'html.f2w-christmas-on a{transition:color .2s ease,border-color .2s ease}',
      'html.f2w-christmas-on a:hover,html.f2w-christmas-on .f2w-nav-link:hover{color:#e8cb83!important}',
      'html.f2w-christmas-on .movie-card,html.f2w-christmas-on .show-card,html.f2w-christmas-on .recent-card,html.f2w-christmas-on .f2w-cw-card,html.f2w-christmas-on .category-card,html.f2w-christmas-on .card{border-color:rgba(196,174,121,.22)!important;box-shadow:0 12px 32px rgba(0,0,0,.28),0 0 18px rgba(21,91,58,.12)!important}',
      'html.f2w-christmas-on button.primary,html.f2w-christmas-on .btn-primary,html.f2w-christmas-on .primary-btn,html.f2w-christmas-on .active,html.f2w-christmas-on [aria-selected="true"]{--accent:#d3ad60!important;border-color:rgba(229,196,119,.55)!important}',
      'html.f2w-christmas-on .progress-fill,html.f2w-christmas-on .progress-bar>i,html.f2w-christmas-on .f2w-cw-bar>i{background:linear-gradient(90deg,#8e2433,#d5b365,#246244)!important}',
      'html.f2w-christmas-on input:focus,html.f2w-christmas-on textarea:focus,html.f2w-christmas-on select:focus{border-color:#c9ad70!important;box-shadow:0 0 0 3px rgba(201,173,112,.14)!important}',
      'html.f2w-christmas-on .logo img,html.f2w-christmas-on .logo-image{filter:drop-shadow(0 0 9px rgba(218,190,126,.22))!important}',
      '#f2w-christmas-snow{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;pointer-events:none!important;z-index:9996!important;display:block!important}',
      '#f2w-christmas-garland{position:fixed!important;left:0!important;right:0!important;top:0!important;height:29px!important;z-index:9998!important;pointer-events:none!important;overflow:hidden!important}',
      '#f2w-christmas-garland:before{content:"";position:absolute;left:-2%;right:-2%;top:-13px;height:27px;border-bottom:2px solid rgba(35,55,39,.95);border-radius:0 0 50% 50%}',
      '#f2w-christmas-garland .f2w-xmas-bulb{position:absolute;top:12px;width:7px;height:10px;border-radius:50% 50% 45% 45%;background:#e8c66c;box-shadow:0 0 9px currentColor;animation:f2wXmasTwinkle 2.4s ease-in-out infinite alternate}',
      '#f2w-christmas-garland .f2w-xmas-bulb:nth-child(4n+1){background:#d64c55;color:#d64c55}',
      '#f2w-christmas-garland .f2w-xmas-bulb:nth-child(4n+2){background:#e8c66c;color:#e8c66c;animation-delay:.45s}',
      '#f2w-christmas-garland .f2w-xmas-bulb:nth-child(4n+3){background:#5cb889;color:#5cb889;animation-delay:.9s}',
      '#f2w-christmas-garland .f2w-xmas-bulb:nth-child(4n){background:#dcecf4;color:#dcecf4;animation-delay:1.3s}',
      '@keyframes f2wXmasTwinkle{from{opacity:.48;filter:brightness(.8)}to{opacity:1;filter:brightness(1.35)}}',
      '#f2w-christmas-toggle{position:fixed!important;left:max(13px,env(safe-area-inset-left))!important;bottom:max(13px,env(safe-area-inset-bottom))!important;z-index:10001!important;display:flex!important;align-items:center!important;gap:8px!important;padding:10px 14px!important;border:1px solid rgba(223,194,127,.55)!important;border-radius:999px!important;background:linear-gradient(135deg,rgba(8,43,28,.97),rgba(83,24,34,.97))!important;color:#f5e6c0!important;font:800 12px/1.1 system-ui,sans-serif!important;letter-spacing:.02em!important;box-shadow:0 6px 22px rgba(0,0,0,.38),0 0 17px rgba(196,160,91,.15)!important;cursor:pointer!important;backdrop-filter:blur(10px)!important}',
      '#f2w-christmas-toggle .f2w-xmas-icon{font-size:17px!important;line-height:1!important}',
      '#f2w-christmas-toggle:hover{transform:translateY(-2px)!important;filter:brightness(1.12)!important}',
      '@media(max-width:600px){#f2w-christmas-toggle{padding:9px 11px!important;font-size:11px!important}#f2w-christmas-garland .f2w-xmas-bulb{width:6px;height:8px}}',
      '@media(prefers-reduced-motion:reduce){#f2w-christmas-garland .f2w-xmas-bulb{animation:none!important}}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function makeGarland() {
    if (document.getElementById('f2w-christmas-garland')) return;
    const garland = document.createElement('div');
    garland.id = 'f2w-christmas-garland';
    garland.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 24; i++) {
      const bulb = document.createElement('i');
      bulb.className = 'f2w-xmas-bulb';
      bulb.style.left = (2 + i * 4.15) + '%';
      garland.appendChild(bulb);
    }
    (document.body || document.documentElement).appendChild(garland);
  }

  function makeToggle() {
    let button = document.getElementById('f2w-christmas-toggle');
    if (!button) {
      button = document.createElement('button');
      button.id = 'f2w-christmas-toggle';
      button.type = 'button';
      button.addEventListener('click', () => setEnabled(!enabled));
      (document.body || document.documentElement).appendChild(button);
    }
    button.innerHTML = '<span class="f2w-xmas-icon" aria-hidden="true">🎄</span><span>Christmas ' + (enabled ? 'ON' : 'OFF') + '</span>';
    button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    button.title = enabled ? 'Turn off the Christmas theme' : 'Turn on the Christmas theme';
  }

  function resizeSnow() {
    if (!canvas || !ctx) return;
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.max(42, Math.min(116, Math.round(width / 12)));
    flakes = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: .7 + Math.random() * 2.5,
      speed: .45 + Math.random() * 1.45,
      drift: .25 + Math.random() * .9,
      phase: Math.random() * Math.PI * 2,
      alpha: .35 + Math.random() * .55
    }));
  }

  function snowFrame() {
    raf = 0;
    if (!enabled || document.hidden || reducedMotion() || !ctx) return;
    ctx.clearRect(0, 0, width, height);
    const time = performance.now() / 1000;
    for (const flake of flakes) {
      flake.y += flake.speed;
      flake.x += Math.sin(time * .8 + flake.phase) * flake.drift;
      if (flake.y > height + 5) { flake.y = -6; flake.x = Math.random() * width; }
      if (flake.x < -5) flake.x = width + 4;
      if (flake.x > width + 5) flake.x = -4;
      ctx.beginPath();
      ctx.fillStyle = 'rgba(244,250,255,' + flake.alpha + ')';
      ctx.shadowColor = 'rgba(224,242,255,.65)';
      ctx.shadowBlur = flake.r * 3;
      ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    raf = window.requestAnimationFrame(snowFrame);
  }

  function startSnow() {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = CANVAS_ID;
      canvas.setAttribute('aria-hidden', 'true');
      (document.body || document.documentElement).appendChild(canvas);
      ctx = canvas.getContext('2d', { alpha: true });
      window.addEventListener('resize', resizeSnow, { passive: true });
    }
    resizeSnow();
    if (enabled && !document.hidden && !reducedMotion() && !raf) raf = window.requestAnimationFrame(snowFrame);
  }

  function stopSnow() {
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
    if (canvas) {
      canvas.remove();
      canvas = null;
      ctx = null;
    }
  }

  function setEnabled(value) {
    enabled = !!value;
    try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch (_) {}
    document.documentElement.classList.toggle(ROOT, enabled);
    if (enabled) {
      makeGarland();
      startSnow();
    } else {
      const garland = document.getElementById('f2w-christmas-garland');
      if (garland) garland.remove();
      stopSnow();
    }
    makeToggle();
  }

  function boot() {
    addStyles();
    enabled = readPreference();
    makeToggle();
    setEnabled(enabled);
    document.addEventListener('visibilitychange', () => {
      if (enabled && !document.hidden && !reducedMotion()) startSnow();
      else if (document.hidden && raf) { window.cancelAnimationFrame(raf); raf = 0; }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();