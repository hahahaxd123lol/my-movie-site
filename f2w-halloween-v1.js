(()=>{
  'use strict';
  if (window.__f2wHalloweenV1) return;
  window.__f2wHalloweenV1 = true;

  const STORAGE_KEY = 'f2w_halloween_theme_v1';
  const ROOT_CLASS = 'f2w-halloween-on';

  function preferReducedMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  }

  function isOn() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === null) return true; // default ON for season
      return v === '1';
    } catch { return true; }
  }

  function setOn(on) {
    try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch {}
    document.documentElement.classList.toggle(ROOT_CLASS, !!on);
    const btn = document.getElementById('f2w-halloween-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.title = on ? 'Turn off Halloween theme' : 'Turn on Halloween theme';
      btn.innerHTML = on
        ? '<span class="f2w-hw-icon" aria-hidden="true">🎃</span><span class="f2w-hw-label">Halloween</span>'
        : '<span class="f2w-hw-icon" aria-hidden="true">🎃</span><span class="f2w-hw-label">Halloween off</span>';
    }
  }

  function ensureStyle() {
    if (document.getElementById('f2w-halloween-v1-css')) return;
    const s = document.createElement('style');
    s.id = 'f2w-halloween-v1-css';
    s.textContent = `
/* ===== Halloween toggle button (always visible) ===== */
#f2w-halloween-toggle{
  position:fixed!important;
  left:14px!important;
  bottom:14px!important;
  z-index:2147483001!important;
  display:inline-flex!important;
  align-items:center!important;
  gap:8px!important;
  height:42px!important;
  padding:0 14px!important;
  border-radius:999px!important;
  border:1px solid rgba(255,140,0,.55)!important;
  background:linear-gradient(135deg,rgba(40,12,4,.92),rgba(12,8,20,.94))!important;
  color:#ffd7a8!important;
  font:700 12px/1 Inter,system-ui,sans-serif!important;
  letter-spacing:.02em!important;
  cursor:pointer!important;
  pointer-events:auto!important;
  box-shadow:0 8px 28px rgba(0,0,0,.45),0 0 18px rgba(255,100,0,.22)!important;
  backdrop:none!important;
  user-select:none!important;
  backdrop:filter .18s ease, box-shadow .18s ease, border-color .18s ease!important;
}
#f2w-halloween-toggle:hover{
  border-color:rgba(255,170,40,.9)!important;
  box-shadow:0 10px 32px rgba(0,0,0,.5),0 0 26px rgba(255,120,0,.35)!important;
  filter:brightness(1.08)!important;
}
#f2w-halloween-toggle .f2w-hw-icon{font-size:18px!important;line-height:1!important}
#f2w-halloween-toggle .f2w-hw-label{white-space:nowrap!important}
@media(max-width:520px){
  #f2w-halloween-toggle{left:10px!important;bottom:10px!important;padding:0 12px!important;height:40px!important}
  #f2w-halloween-toggle .f2w-hw-label{font-size:11px!important}
}

/* ===== Theme decorations (only when ON) ===== */
html.f2w-halloween-on body::before{
  content:""!important;
  position:fixed!important;
  inset:0!important;
  pointer-events:none!important;
  z-index:2147482000!important;
  background:
    radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255,100,0,.14), transparent 55%),
    radial-gradient(ellipse 60% 40% at 100% 100%, rgba(120,0,180,.10), transparent 50%),
    radial-gradient(ellipse 50% 35% at 0% 90%, rgba(255,60,0,.08), transparent 45%);
  animation:f2wHwPulse 8s ease-in-out infinite alternate;
}
html.f2w-halloween-on body::after{
  content:""!important;
  position:fixed!important;
  left:0!important;right:0!important;bottom:0!important;
  height:120px!important;
  pointer-events:none!important;
  z-index:2147482001!important;
  background:linear-gradient(to top, rgba(8,2,12,.55), transparent);
}

/* Soft orange/purple accent on borders / glow */
html.f2w-halloween-on header{
  box-shadow:0 1px 0 rgba(255,120,0,.18), 0 8px 28px rgba(0,0,0,.25)!important;
}
html.f2w-halloween-on .account-card,
html.f2w-halloween-on .f2w-quick-auth-pane,
html.f2w-halloween-on .sport-card{
  box-shadow:0 0 0 1px rgba(255,120,0,.12), 0 12px 40px rgba(0,0,0,.35)!important;
}

/* Floating bats layer */
#f2w-halloween-fx{
  position:fixed!important;
  inset:0!important;
  pointer-events:none!important;
  z-index:2147482002!important;
  overflow:hidden!important;
}
html:not(.f2w-halloween-on) #f2w-halloween-fx{display:none!important}

.f2w-hw-bat{
  position:absolute!important;
  font-size:18px!important;
  opacity:.55!important;
  filter:drop-shadow(0 0 6px rgba(255,100,0,.35));
  animation:f2wHwFly linear infinite;
  will-change:transform;
}
.f2w-hw-ghost{
  position:absolute!important;
  font-size:22px!important;
  opacity:.4!important;
  animation:f2wHwFloat ease-in-out infinite;
  will-change:transform;
}
.f2w-hw-web{
  position:fixed!important;
  width:90px!important;height:90px!important;
  pointer-events:none!important;
  opacity:.22!important;
  z-index:2147482002!important;
  background:
    radial-gradient(circle at 0 0, transparent 28px, rgba(255,200,150,.35) 29px, transparent 30px),
    linear-gradient(135deg, rgba(255,200,150,.25) 1px, transparent 1px),
    linear-gradient(45deg, rgba(255,200,150,.2) 1px, transparent 1px);
  background-size:100% 100%, 14px 14px, 14px 14px;
}
html.f2w-halloween-on .f2w-hw-web-tl{top:0;left:0;border-top-left-radius:0}
html.f2w-halloween-on .f2w-hw-web-tr{top:0;right:0;transform:scaleX(-1)}
html:not(.f2w-halloween-on) .f2w-hw-web{display:none!important}

@keyframes f2wHwPulse{
  from{opacity:.85}
  to{opacity:1}
}
@keyframes f2wHwFly{
  0%{transform:translate(0,0) rotate(0deg)}
  25%{transform:translate(40vw,-12vh) rotate(12deg)}
  50%{transform:translate(70vw,8vh) rotate(-8deg)}
  75%{transform:translate(30vw,18vh) rotate(6deg)}
  100%{transform:translate(0,0) rotate(0deg)}
}
@keyframes f2wHwFloat{
  0%,100%{transform:translateY(0)}
  50%{transform:translateY(-18px)}
}

@media(prefers-reduced-motion:reduce){
  html.f2w-halloween-on body::before{animation:none!important}
  .f2w-hw-bat,.f2w-hw-ghost{animation:none!important;opacity:.25!important}
}
`;
    (document.head || document.documentElement).appendChild(s);
  }

  function ensureFx() {
    if (document.getElementById('f2w-halloween-fx')) return;
    const layer = document.createElement('div');
    layer.id = 'f2w-halloween-fx';
    layer.setAttribute('aria-hidden', 'true');

    if (!preferReducedMotion()) {
      const bats = 5;
      for (let i = 0; i < bats; i++) {
        const b = document.createElement('span');
        b.className = 'f2w-hw-bat';
        b.textContent = '🦇';
        b.style.left = (8 + i * 18) + '%';
        b.style.top = (10 + (i % 3) * 22) + '%';
        b.style.animationDuration = (18 + i * 3) + 's';
        b.style.animationDelay = (-i * 2.5) + 's';
        b.style.fontSize = (14 + (i % 3) * 4) + 'px';
        layer.appendChild(b);
      }
      for (let i = 0; i < 3; i++) {
        const g = document.createElement('span');
        g.className = 'f2w-hw-ghost';
        g.textContent = '👻';
        g.style.left = (15 + i * 30) + '%';
        g.style.top = (55 + i * 8) + '%';
        g.style.animationDuration = (6 + i * 1.5) + 's';
        g.style.animationDelay = (-i) + 's';
        layer.appendChild(g);
      }
    }
    document.body.appendChild(layer);

    // corner webs
    [['f2w-hw-web-tl','tl'],['f2w-hw-web-tr','tr']].forEach(([cls]) => {
      if (document.querySelector('.' + cls)) return;
      const w = document.createElement('div');
      w.className = 'f2w-hw-web ' + cls;
      w.setAttribute('aria-hidden', 'true');
      document.body.appendChild(w);
    });
  }

  function ensureToggle() {
    if (document.getElementById('f2w-halloween-toggle')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'f2w-halloween-toggle';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setOn(!document.documentElement.classList.contains(ROOT_CLASS));
    });
    document.body.appendChild(btn);
    setOn(isOn());
  }

  function boot() {
    ensureStyle();
    ensureFx();
    ensureToggle();
    setOn(isOn());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Keep toggle present if body is rewritten
  const mo = new MutationObserver(() => {
    if (!document.getElementById('f2w-halloween-toggle')) ensureToggle();
    if (!document.getElementById('f2w-halloween-fx')) ensureFx();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
